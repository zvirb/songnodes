"""
FastAPI wrapper for LiveTracklist scraper
High-quality timestamped tracklists for EDM festivals and radio shows with NLP fallback
"""
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import httpx
import asyncio
import json
import os
import logging
import re
from typing import Dict, Any, Optional, List
from datetime import datetime
from bs4 import BeautifulSoup

from database_pipeline import DatabasePipeline
from nlp_fallback_utils import extract_via_nlp, extract_text_from_html

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Environment configuration
ENABLE_NLP_FALLBACK = os.getenv('ENABLE_NLP_FALLBACK', 'true').lower() == 'true'
NLP_PROCESSOR_URL = os.getenv('NLP_PROCESSOR_URL', 'http://nlp-processor:8021')

app = FastAPI(title="LiveTracklist Scraper", version="1.0.0")

class ScrapeRequest(BaseModel):
    url: Optional[str] = None
    params: Optional[Dict[str, Any]] = {}
    task_id: Optional[str] = None
    target_track: Optional[Dict[str, Any]] = None

# Rate limiting configuration
RATE_LIMIT_DELAY = 2.0  # 1-3 second delays as recommended

# Database configuration
DATABASE_CONFIG = {
    'host': os.getenv('POSTGRES_HOST', 'postgres'),
    'port': int(os.getenv('POSTGRES_PORT', '5432')),
    'database': os.getenv('POSTGRES_DB', 'musicdb'),
    'user': os.getenv('POSTGRES_USER', 'musicdb_user'),
    'password': os.getenv('POSTGRES_PASSWORD', 'musicdb_secure_pass')
}

async def scrape_livetracklist_page(url: str) -> Dict[str, Any]:
    """
    Scrape a LiveTracklist page for structured tracklist data
    """
    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
        headers = {
            'User-Agent': 'SongNodes/1.0 (+https://github.com/songnodes)'
        }

        response = await client.get(url, headers=headers)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, 'html.parser')
        extraction_method = "unknown"

        # Extract set/show title
        title_elem = soup.find('h1') or soup.find('title')
        title = title_elem.get_text(strip=True) if title_elem else ''

        # Extract date if available
        date_elem = soup.find('time') or soup.find(class_=re.compile(r'date', re.I))
        date_str = None
        if date_elem:
            date_str = date_elem.get('datetime') or date_elem.get_text(strip=True)

        # Find tracklist container (Primary Method - Structured HTML)
        # LiveTracklist typically uses structured HTML for tracklists
        tracklist_container = (
            soup.find('div', class_=re.compile(r'tracklist', re.I)) or
            soup.find('table', class_=re.compile(r'track', re.I)) or
            soup.find('ol', class_=re.compile(r'track', re.I))
        )

        tracklist = []

        if tracklist_container:
            # Parse table-based tracklists
            if tracklist_container.name == 'table':
                rows = tracklist_container.find_all('tr')[1:]  # Skip header
                for idx, row in enumerate(rows):
                    cells = row.find_all('td')
                    if len(cells) >= 3:
                        timestamp = cells[0].get_text(strip=True)
                        artist = cells[1].get_text(strip=True)
                        track = cells[2].get_text(strip=True)

                        tracklist.append({
                            'position': idx + 1,
                            'artist_name': artist,
                            'track_name': track,
                            'start_time': timestamp,
                            'item_type': 'playlist_track'
                        })

            # Parse list-based tracklists
            elif tracklist_container.name in ['ol', 'ul']:
                items = tracklist_container.find_all('li')
                for idx, item in enumerate(items):
                    text = item.get_text(strip=True)

                    # Try to parse: "00:00 Artist - Track"
                    match = re.match(r'(\d{1,2}:\d{2}(?::\d{2})?)\s+(.+?)\s*-\s*(.+)', text)
                    if match:
                        timestamp, artist, track = match.groups()
                        tracklist.append({
                            'position': idx + 1,
                            'artist_name': artist.strip(),
                            'track_name': track.strip(),
                            'start_time': timestamp,
                            'item_type': 'playlist_track'
                        })

            # Parse div-based tracklists
            else:
                track_items = tracklist_container.find_all('div', class_=re.compile(r'track-item|track_item', re.I))
                for idx, item in enumerate(track_items):
                    # Look for timestamp
                    time_elem = item.find(class_=re.compile(r'time|timestamp', re.I))
                    timestamp = time_elem.get_text(strip=True) if time_elem else None

                    # Look for artist
                    artist_elem = item.find(class_=re.compile(r'artist', re.I))
                    artist = artist_elem.get_text(strip=True) if artist_elem else ''

                    # Look for track name
                    track_elem = item.find(class_=re.compile(r'title|track', re.I))
                    track = track_elem.get_text(strip=True) if track_elem else ''

                    if artist and track:
                        tracklist.append({
                            'position': idx + 1,
                            'artist_name': artist,
                            'track_name': track,
                            'start_time': timestamp,
                            'item_type': 'playlist_track'
                        })

        # Determine extraction method if tracklist found
        if tracklist:
            extraction_method = "structured_html"
            logger.info(f"Structured HTML extraction found {len(tracklist)} tracks")

        # If no tracklist found via structured parsing and NLP is enabled, try NLP fallback
        if not tracklist and ENABLE_NLP_FALLBACK:
            try:
                logger.info("Attempting NLP fallback for LiveTracklist")
                # Extract clean text from entire page
                text = await extract_text_from_html(response.text)

                # Try NLP extraction
                tracklist = await extract_via_nlp(text, url)

                if tracklist:
                    extraction_method = "nlp"
                    logger.info(f"NLP fallback extracted {len(tracklist)} tracks")
            except Exception as e:
                logger.warning(f"NLP fallback failed: {e}")

        mix_data = {
            'name': title,
            'source_url': url,
            'platform': 'livetracklist',
            'tracklist': tracklist,
            'playlist_date': None,
            'extraction_method': extraction_method
        }

        # Parse date
        if date_str:
            try:
                # Try ISO format first
                mix_data['playlist_date'] = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
            except:
                # Try common formats
                for fmt in ['%Y-%m-%d', '%B %d, %Y', '%d %B %Y', '%m/%d/%Y']:
                    try:
                        mix_data['playlist_date'] = datetime.strptime(date_str, fmt)
                        break
                    except ValueError:
                        continue

        return mix_data

async def save_to_database(mix_data: Dict[str, Any], spider_context: Any = None):
    """Save scraped mix data to database using DatabasePipeline"""
    db_pipeline = DatabasePipeline(DATABASE_CONFIG)

    try:
        await db_pipeline.open_spider(spider_context)

        # Create playlist item
        playlist_item = {
            'item_type': 'playlist',
            'name': mix_data['name'],
            'source_url': mix_data['source_url'],
            'platform': mix_data['platform'],
            'playlist_date': mix_data.get('playlist_date'),
            'playlist_type': 'dj_mix'
        }

        await db_pipeline.process_item(playlist_item, spider_context)

        # Process each track
        for track_data in mix_data.get('tracklist', []):
            # Create artist item
            if track_data.get('artist_name'):
                artist_item = {
                    'item_type': 'artist',
                    'artist_name': track_data['artist_name']
                }
                await db_pipeline.process_item(artist_item, spider_context)

            # Create track item
            if track_data.get('track_name'):
                track_item = {
                    'item_type': 'track',
                    'track_name': track_data['track_name'],
                    'artist_name': track_data.get('artist_name', '')
                }
                await db_pipeline.process_item(track_item, spider_context)

                # Create playlist track item
                playlist_track_item = {
                    'item_type': 'playlist_track',
                    'playlist_name': mix_data['name'],
                    'track_name': track_data['track_name'],
                    'artist_name': track_data.get('artist_name', ''),
                    'position': track_data.get('position'),
                    'source': 'livetracklist'
                }
                await db_pipeline.process_item(playlist_track_item, spider_context)

        # Flush remaining batches
        await db_pipeline.flush_all_batches()

        logger.info(f"Successfully saved mix '{mix_data['name']}' to database")

    finally:
        await db_pipeline.close_spider(spider_context)

@app.get("/health")
async def health_check():
    return {"status": "healthy", "scraper": "livetracklist"}

@app.post("/scrape")
async def scrape_url(request: ScrapeRequest):
    """Execute scraping task for LiveTracklist page"""
    task_id = request.task_id or f"livetracklist_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

    if not request.url:
        raise HTTPException(status_code=400, detail="URL is required for LiveTracklist scraper")

    if 'livetracklist.com' not in request.url:
        raise HTTPException(status_code=400, detail="URL must be a LiveTracklist URL")

    try:
        # Rate limiting delay
        await asyncio.sleep(RATE_LIMIT_DELAY)

        # Scrape the page
        mix_data = await scrape_livetracklist_page(request.url)

        # Save to database
        await save_to_database(mix_data)

        return {
            "status": "success",
            "task_id": task_id,
            "url": request.url,
            "set_name": mix_data['name'],
            "tracks_found": len(mix_data.get('tracklist', [])),
            "message": f"Successfully scraped {len(mix_data.get('tracklist', []))} tracks"
        }

    except httpx.HTTPError as e:
        logger.error(f"HTTP error scraping {request.url}: {e}")
        return {
            "status": "error",
            "task_id": task_id,
            "error": f"HTTP error: {str(e)}"
        }
    except Exception as e:
        logger.error(f"Error scraping {request.url}: {e}")
        return {
            "status": "error",
            "task_id": task_id,
            "error": str(e)
        }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8019)