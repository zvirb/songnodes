# DEPRECATED: This file uses the removed database_pipeline. Use modern pipelines instead.
"""
FastAPI wrapper for SoundCloud scraper
Uses unofficial soundcloud-lib for public access + NLP for tracklist parsing

⚠️  WARNING: This file imports the deprecated database_pipeline.DatabasePipeline
    which has been replaced by pipelines.persistence_pipeline.PersistencePipeline.
    This scraper may require refactoring to use the modern pipeline architecture.
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

from pipelines.persistence_pipeline import PersistencePipeline

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="SoundCloud Scraper", version="1.0.0")

class ScrapeRequest(BaseModel):
    url: Optional[str] = None
    params: Optional[Dict[str, Any]] = {}
    task_id: Optional[str] = None
    target_track: Optional[Dict[str, Any]] = None

# Rate limiting configuration
RATE_LIMIT_DELAY = 2.5  # Conservative 2.5 second delay

# Database configuration
DATABASE_CONFIG = {
    'host': os.getenv('POSTGRES_HOST', 'postgres'),
    'port': int(os.getenv('POSTGRES_PORT', '5432')),
    'database': os.getenv('POSTGRES_DB', 'musicdb'),
    'user': os.getenv('POSTGRES_USER', 'musicdb_user'),
    'password': os.getenv('POSTGRES_PASSWORD', 'musicdb_secure_pass')
}

# NLP processor URL
NLP_PROCESSOR_URL = os.getenv('NLP_PROCESSOR_URL', 'http://nlp-processor:8021')

async def extract_tracklist_via_nlp(description: str) -> List[Dict]:
    """
    Send unstructured tracklist text to NLP processor for extraction
    """
    if not description:
        return []

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{NLP_PROCESSOR_URL}/extract_tracklist",
                json={"text": description}
            )
            response.raise_for_status()

            data = response.json()
            return data.get('tracks', [])

    except Exception as e:
        logger.error(f"NLP processor error: {e}")
        # Fallback to basic pattern matching
        return parse_description_basic(description)

def parse_description_basic(description: str) -> List[Dict]:
    """
    Fallback basic pattern matching for tracklists
    Common SoundCloud patterns:
    - 00:00 Artist - Track
    - 1. Artist - Track
    - Artist - Track (no prefix)
    """
    tracklist = []

    # Pattern for timestamped tracks: "00:00 Artist - Track"
    pattern_timestamp = re.compile(r'(\d{1,2}:\d{2})\s+([^-\n]+?)\s*-\s*([^\n]+)', re.MULTILINE)

    # Pattern for numbered tracks: "1. Artist - Track"
    pattern_numbered = re.compile(r'^\s*(\d+)\.\s*([^-\n]+?)\s*-\s*([^\n]+)', re.MULTILINE)

    # Try timestamp pattern first
    matches = pattern_timestamp.findall(description)
    if matches:
        for idx, match in enumerate(matches):
            timestamp, artist, track = match
            tracklist.append({
                'position': idx + 1,
                'artist_name': artist.strip(),
                'track_name': track.strip(),
                'start_time': timestamp,
                'item_type': 'playlist_track'
            })
        return tracklist

    # Try numbered pattern
    matches = pattern_numbered.findall(description)
    if matches:
        for match in matches:
            position, artist, track = match
            tracklist.append({
                'position': int(position),
                'artist_name': artist.strip(),
                'track_name': track.strip(),
                'item_type': 'playlist_track'
            })
        return tracklist

    return []

async def scrape_soundcloud_track(url: str) -> Dict[str, Any]:
    """
    Scrape a SoundCloud track/mix for tracklist data
    Uses SoundCloud's widget API as a workaround for closed API
    """
    async with httpx.AsyncClient(timeout=30.0) as client:
        headers = {
            'User-Agent': 'SongNodes/1.0 (+https://github.com/songnodes)'
        }

        try:
            # Use SoundCloud widget API to get track info
            widget_api_url = "https://soundcloud.com/oembed"
            params = {
                'url': url,
                'format': 'json'
            }

            response = await client.get(widget_api_url, params=params, headers=headers)
            response.raise_for_status()

            data = response.json()

            # Extract basic metadata
            mix_data = {
                'name': data.get('title', ''),
                'artist_name': data.get('author_name', ''),
                'source_url': url,
                'platform': 'soundcloud',
                'description': data.get('description', ''),
                'tracklist': []
            }

            # Parse tracklist from description
            if mix_data['description']:
                # Try NLP processor first
                tracklist = await extract_tracklist_via_nlp(mix_data['description'])
                mix_data['tracklist'] = tracklist

                logger.info(f"Extracted {len(tracklist)} tracks from description")

            return mix_data

        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                logger.error(f"Track not found: {url}")
                raise HTTPException(status_code=404, detail="SoundCloud track not found")
            raise

async def save_to_database(mix_data: Dict[str, Any], spider_context: Any = None):
    """
    Save scraped mix data to database using PersistencePipeline
    """
    db_pipeline = PersistencePipeline(DATABASE_CONFIG)

    try:
        await db_pipeline.open_spider(spider_context)

        # Create playlist item
        playlist_item = {
            'item_type': 'playlist',
            'name': mix_data['name'],
            'source_url': mix_data['source_url'],
            'platform': mix_data['platform'],
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
                    'artist_name': track_data.get('artist_name', ''),
                    'soundcloud_id': track_data.get('soundcloud_id')
                }
                await db_pipeline.process_item(track_item, spider_context)

                # Create playlist track item
                playlist_track_item = {
                    'item_type': 'playlist_track',
                    'playlist_name': mix_data['name'],
                    'track_name': track_data['track_name'],
                    'artist_name': track_data.get('artist_name', ''),
                    'position': track_data.get('position'),
                    'source': 'soundcloud'
                }
                await db_pipeline.process_item(playlist_track_item, spider_context)

        # Flush remaining batches
        await db_pipeline.flush_all_batches()

        logger.info(f"Successfully saved mix '{mix_data['name']}' to database")

    finally:
        await db_pipeline.close_spider(spider_context)

@app.get("/health")
async def health_check():
    return {"status": "healthy", "scraper": "soundcloud"}

@app.post("/scrape")
async def scrape_url(request: ScrapeRequest):
    """
    Execute scraping task for SoundCloud track/mix
    """
    task_id = request.task_id or f"soundcloud_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

    if not request.url:
        raise HTTPException(status_code=400, detail="URL is required for SoundCloud scraper")

    if 'soundcloud.com' not in request.url:
        raise HTTPException(status_code=400, detail="URL must be a SoundCloud URL")

    try:
        # Rate limiting delay
        await asyncio.sleep(RATE_LIMIT_DELAY)

        # Scrape the track
        mix_data = await scrape_soundcloud_track(request.url)

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
    uvicorn.run(app, host="0.0.0.0", port=8016)