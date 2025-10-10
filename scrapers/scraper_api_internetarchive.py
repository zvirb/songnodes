# ============================================================================
# LEGACY FILE - NOT USED IN PRODUCTION
# ============================================================================
# This file is part of the legacy scraper_api_* family which is NOT used in
# docker-compose.yml. These files have been superseded by modern Scrapy-based
# spiders in the spiders/ directory.
#
# Retained for historical reference and potential future migration.
# See: /mnt/my_external_drive/programming/songnodes/scrapers/LEGACY_SCRAPERS_README.md
# ============================================================================
"""
FastAPI wrapper for Internet Archive scraper
Focuses on BBC Essential Mix collection and Hip-hop mixtapes

This file uses the modern pipelines.persistence_pipeline.PersistencePipeline architecture.

LEGACY: This file is not actively used. See Scrapy spiders in spiders/ directory.
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

app = FastAPI(title="Internet Archive Scraper", version="1.0.0")

class ScrapeRequest(BaseModel):
    url: Optional[str] = None
    params: Optional[Dict[str, Any]] = {}
    task_id: Optional[str] = None
    target_track: Optional[Dict[str, Any]] = None
    collection: Optional[str] = None  # e.g., "etree", "hiphopmixtapes"

# Internet Archive API configuration
IA_METADATA_BASE = "https://archive.org/metadata"
IA_SEARCH_BASE = "https://archive.org/advancedsearch.php"

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

def extract_identifier(url: str) -> Optional[str]:
    """Extract Internet Archive identifier from URL"""
    match = re.search(r'archive\.org/details/([^/]+)', url)
    return match.group(1) if match else None

async def get_item_metadata(identifier: str) -> Dict[str, Any]:
    """Fetch item metadata from Internet Archive API"""
    async with httpx.AsyncClient(timeout=30.0) as client:
        url = f"{IA_METADATA_BASE}/{identifier}"
        response = await client.get(url)
        response.raise_for_status()

        return response.json()

async def search_collection(collection: str, query: str = "*:*", rows: int = 50) -> List[Dict]:
    """Search Internet Archive collection"""
    async with httpx.AsyncClient(timeout=30.0) as client:
        params = {
            'q': f'collection:{collection} AND {query}',
            'fl[]': ['identifier', 'title', 'creator', 'date', 'description'],
            'rows': rows,
            'output': 'json'
        }

        response = await client.get(IA_SEARCH_BASE, params=params)
        response.raise_for_status()

        data = response.json()
        return data.get('response', {}).get('docs', [])

async def extract_tracklist_via_nlp(text: str) -> List[Dict]:
    """Send text to NLP processor for tracklist extraction"""
    if not text:
        return []

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{NLP_PROCESSOR_URL}/extract_tracklist",
                json={"text": text}
            )
            response.raise_for_status()

            data = response.json()
            return data.get('tracks', [])

    except Exception as e:
        logger.error(f"NLP processor error: {e}")
        return []

async def scrape_ia_item(identifier: str) -> Dict[str, Any]:
    """Scrape an Internet Archive item for mix data"""
    metadata = await get_item_metadata(identifier)

    # Extract basic metadata
    meta = metadata.get('metadata', {})
    files = metadata.get('files', [])

    title = meta.get('title', '')
    if isinstance(title, list):
        title = title[0] if title else ''

    creator = meta.get('creator', '')
    if isinstance(creator, list):
        creator = creator[0] if creator else ''

    description = meta.get('description', '')
    if isinstance(description, list):
        description = ' '.join(description)

    date_str = meta.get('date', '')
    if isinstance(date_str, list):
        date_str = date_str[0] if date_str else ''

    mix_data = {
        'name': title,
        'artist_name': creator,
        'source_url': f"https://archive.org/details/{identifier}",
        'platform': 'internet_archive',
        'description': description,
        'tracklist': [],
        'playlist_date': None
    }

    # Parse date
    if date_str:
        try:
            # Try common date formats
            for fmt in ['%Y-%m-%d', '%Y-%m', '%Y']:
                try:
                    mix_data['playlist_date'] = datetime.strptime(date_str, fmt)
                    break
                except ValueError:
                    continue
        except Exception as e:
            logger.warning(f"Could not parse date {date_str}: {e}")

    # Extract tracklist from description
    if description:
        tracklist = await extract_tracklist_via_nlp(description)
        mix_data['tracklist'] = tracklist
        logger.info(f"Extracted {len(tracklist)} tracks from description")

    return mix_data

async def save_to_database(mix_data: Dict[str, Any], spider_context: Any = None):
    """Save scraped mix data to database using PersistencePipeline"""
    db_pipeline = PersistencePipeline(DATABASE_CONFIG)

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
                    'source': 'internet_archive'
                }
                await db_pipeline.process_item(playlist_track_item, spider_context)

        # Flush remaining batches
        await db_pipeline.flush_all_batches()

        logger.info(f"Successfully saved mix '{mix_data['name']}' to database")

    finally:
        await db_pipeline.close_spider(spider_context)

@app.get("/health")
async def health_check():
    return {"status": "healthy", "scraper": "internet_archive"}

@app.get("/search")
async def search(collection: str, query: str = "*:*", rows: int = 50):
    """Search Internet Archive collection"""
    try:
        results = await search_collection(collection, query, rows)
        return {
            "status": "success",
            "collection": collection,
            "results": len(results),
            "items": results
        }
    except Exception as e:
        logger.error(f"Error searching collection: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/scrape")
async def scrape_url(request: ScrapeRequest):
    """Execute scraping task for Internet Archive item"""
    task_id = request.task_id or f"ia_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

    if not request.url:
        raise HTTPException(status_code=400, detail="URL is required for Internet Archive scraper")

    if 'archive.org' not in request.url:
        raise HTTPException(status_code=400, detail="URL must be an Internet Archive URL")

    try:
        # Extract identifier
        identifier = extract_identifier(request.url)
        if not identifier:
            raise HTTPException(status_code=400, detail="Could not extract identifier from URL")

        # Scrape the item
        mix_data = await scrape_ia_item(identifier)

        # Save to database
        await save_to_database(mix_data)

        return {
            "status": "success",
            "task_id": task_id,
            "url": request.url,
            "identifier": identifier,
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
    uvicorn.run(app, host="0.0.0.0", port=8018)