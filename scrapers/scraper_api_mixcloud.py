"""
FastAPI wrapper for Mixcloud scraper
Handles REST API + embedded JSON extraction with NLP fallback for tracklists
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

app = FastAPI(title="Mixcloud Scraper", version="1.0.0")

class ScrapeRequest(BaseModel):
    url: Optional[str] = None
    params: Optional[Dict[str, Any]] = {}
    task_id: Optional[str] = None
    target_track: Optional[Dict[str, Any]] = None

# Rate limiting configuration
RATE_LIMIT_DELAY = 2.0  # Conservative 2 second delay between requests

# Database configuration
DATABASE_CONFIG = {
    'host': os.getenv('POSTGRES_HOST', 'postgres'),
    'port': int(os.getenv('POSTGRES_PORT', '5432')),
    'database': os.getenv('POSTGRES_DB', 'musicdb'),
    'user': os.getenv('POSTGRES_USER', 'musicdb_user'),
    'password': os.getenv('POSTGRES_PASSWORD', 'musicdb_secure_pass')
}

def extract_next_data(html: str) -> Optional[Dict]:
    """
    Extract embedded __NEXT_DATA__ JSON from Mixcloud HTML
    """
    try:
        # Look for __NEXT_DATA__ script tag
        match = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', html, re.DOTALL)
        if match:
            json_str = match.group(1)
            return json.loads(json_str)
    except Exception as e:
        logger.error(f"Error extracting __NEXT_DATA__: {e}")
    return None

def parse_tracklist_from_next_data(next_data: Dict) -> List[Dict]:
    """
    Parse tracklist from Mixcloud's __NEXT_DATA__ structure
    """
    tracklist = []
    try:
        # Navigate the JSON structure to find tracklist data
        # Structure varies, so we need to check multiple paths
        props = next_data.get('props', {})
        page_props = props.get('pageProps', {})

        # Check for cloudcast data
        cloudcast = page_props.get('cloudcast', {})
        sections = cloudcast.get('sections', [])

        for idx, section in enumerate(sections):
            track = {
                'position': idx + 1,
                'track_name': section.get('track', {}).get('name', ''),
                'artist_name': section.get('track', {}).get('artist', {}).get('name', ''),
                'start_time': section.get('startTime'),
                'item_type': 'playlist_track'
            }

            # Only add if we have track name
            if track['track_name']:
                tracklist.append(track)

    except Exception as e:
        logger.error(f"Error parsing tracklist from __NEXT_DATA__: {e}")

    return tracklist

def parse_description_tracklist(description: str) -> List[Dict]:
    """
    Parse tracklist from description text using NLP patterns
    Common patterns:
    - 01. Artist - Track
    - 00:00 Artist - Track
    - 1. Artist Name - Track Name
    """
    tracklist = []

    # Pattern for numbered tracks: "1. Artist - Track" or "01. Artist - Track"
    pattern1 = re.compile(r'(\d+)\.\s*([^-]+?)\s*-\s*(.+?)(?:\n|$)', re.MULTILINE)

    # Pattern for timestamped tracks: "00:00 Artist - Track"
    pattern2 = re.compile(r'(\d{1,2}:\d{2})\s+([^-]+?)\s*-\s*(.+?)(?:\n|$)', re.MULTILINE)

    matches1 = pattern1.findall(description)
    matches2 = pattern2.findall(description)

    if matches1:
        for match in matches1:
            position, artist, track = match
            tracklist.append({
                'position': int(position),
                'artist_name': artist.strip(),
                'track_name': track.strip(),
                'item_type': 'playlist_track'
            })
    elif matches2:
        for idx, match in enumerate(matches2):
            timestamp, artist, track = match
            tracklist.append({
                'position': idx + 1,
                'artist_name': artist.strip(),
                'track_name': track.strip(),
                'start_time': timestamp,
                'item_type': 'playlist_track'
            })

    return tracklist

async def scrape_mixcloud_mix(url: str) -> Dict[str, Any]:
    """
    Scrape a single Mixcloud mix for tracklist data
    """
    async with httpx.AsyncClient(timeout=30.0) as client:
        headers = {
            'User-Agent': 'SongNodes/1.0 (+https://github.com/songnodes)'
        }

        # Fetch the page
        response = await client.get(url, headers=headers, follow_redirects=True)
        response.raise_for_status()

        html = response.text
        extraction_method = "unknown"

        # Try to extract __NEXT_DATA__ first (most structured - Primary Method)
        next_data = extract_next_data(html)
        tracklist = []

        if next_data:
            tracklist = parse_tracklist_from_next_data(next_data)
            if tracklist:
                extraction_method = "json"
                logger.info(f"Extracted {len(tracklist)} tracks from __NEXT_DATA__")

        # If no tracklist from __NEXT_DATA__, try parsing description (Secondary Method)
        if not tracklist:
            soup = BeautifulSoup(html, 'html.parser')
            description_elem = soup.find('meta', property='og:description')

            if description_elem:
                description = description_elem.get('content', '')
                tracklist = parse_description_tracklist(description)
                if tracklist:
                    extraction_method = "regex"
                    logger.info(f"Extracted {len(tracklist)} tracks from description")

        # If still no tracklist and NLP is enabled, use NLP fallback (Tertiary Method)
        if not tracklist and ENABLE_NLP_FALLBACK:
            try:
                logger.info("Attempting NLP fallback for Mixcloud")
                # Extract clean text from entire page
                text = await extract_text_from_html(html)

                # Try NLP extraction
                tracklist = await extract_via_nlp(text, url)

                if tracklist:
                    extraction_method = "nlp"
                    logger.info(f"NLP fallback extracted {len(tracklist)} tracks")
            except Exception as e:
                logger.warning(f"NLP fallback failed: {e}")

        # Extract mix metadata
        soup = BeautifulSoup(html, 'html.parser')
        title_elem = soup.find('meta', property='og:title')
        date_elem = soup.find('time', {'class': 'cloudcast-created-at'})

        mix_data = {
            'name': title_elem.get('content', '') if title_elem else '',
            'source_url': url,
            'platform': 'mixcloud',
            'tracklist': tracklist,
            'playlist_date': None,
            'extraction_method': extraction_method
        }

        # Try to extract date
        if date_elem:
            try:
                date_str = date_elem.get('datetime', '')
                if date_str:
                    mix_data['playlist_date'] = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
            except Exception as e:
                logger.warning(f"Could not parse date: {e}")

        return mix_data

async def save_to_database(mix_data: Dict[str, Any], spider_context: Any = None):
    """
    Save scraped mix data to database using DatabasePipeline
    """
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
                    'source': 'mixcloud'
                }
                await db_pipeline.process_item(playlist_track_item, spider_context)

        # Flush remaining batches
        await db_pipeline.flush_all_batches()

        logger.info(f"Successfully saved mix '{mix_data['name']}' to database")

    finally:
        await db_pipeline.close_spider(spider_context)

@app.get("/health")
async def health_check():
    return {"status": "healthy", "scraper": "mixcloud"}

@app.post("/scrape")
async def scrape_url(request: ScrapeRequest):
    """
    Execute scraping task for Mixcloud mix
    """
    task_id = request.task_id or f"mixcloud_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

    if not request.url:
        raise HTTPException(status_code=400, detail="URL is required for Mixcloud scraper")

    if 'mixcloud.com' not in request.url:
        raise HTTPException(status_code=400, detail="URL must be a Mixcloud URL")

    try:
        # Rate limiting delay
        await asyncio.sleep(RATE_LIMIT_DELAY)

        # Scrape the mix
        mix_data = await scrape_mixcloud_mix(request.url)

        # Save to database
        await save_to_database(mix_data)

        return {
            "status": "success",
            "task_id": task_id,
            "url": request.url,
            "mix_name": mix_data['name'],
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
    uvicorn.run(app, host="0.0.0.0", port=8015)