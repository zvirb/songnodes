"""
FastAPI wrapper for YouTube scraper
Uses YouTube Data API v3 with quota management + NLP for tracklist parsing
"""
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import httpx
import asyncio
import redis.asyncio as aioredis
import json
import os
import logging
import re
from typing import Dict, Any, Optional, List
from datetime import datetime, date
from urllib.parse import urlparse, parse_qs

from database_pipeline import DatabasePipeline

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="YouTube Scraper", version="1.0.0")

class ScrapeRequest(BaseModel):
    url: Optional[str] = None
    params: Optional[Dict[str, Any]] = {}
    task_id: Optional[str] = None
    target_track: Optional[Dict[str, Any]] = None

# YouTube API configuration
YOUTUBE_API_KEY = os.getenv('YOUTUBE_API_KEY', '')
YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3"

# Rate limiting and quota management
DAILY_QUOTA_LIMIT = 10000  # YouTube API daily quota
REDIS_HOST = os.getenv('REDIS_HOST', 'redis')
REDIS_PORT = int(os.getenv('REDIS_PORT', '6379'))

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

async def get_redis_client():
    """Get Redis client for quota tracking"""
    return await aioredis.from_url(f"redis://{REDIS_HOST}:{REDIS_PORT}", decode_responses=True)

async def check_quota() -> bool:
    """Check if daily quota is available"""
    redis = await get_redis_client()
    try:
        quota_key = f"youtube:quota:{date.today().isoformat()}"
        current_usage = await redis.get(quota_key)

        if current_usage is None:
            return True

        return int(current_usage) < DAILY_QUOTA_LIMIT
    finally:
        await redis.close()

async def increment_quota(cost: int):
    """Increment quota usage"""
    redis = await get_redis_client()
    try:
        quota_key = f"youtube:quota:{date.today().isoformat()}"
        await redis.incrby(quota_key, cost)
        await redis.expire(quota_key, 86400)  # Expire after 24 hours
    finally:
        await redis.close()

def extract_video_id(url: str) -> Optional[str]:
    """Extract video ID from YouTube URL"""
    parsed = urlparse(url)

    if parsed.hostname in ['www.youtube.com', 'youtube.com']:
        if parsed.path == '/watch':
            query = parse_qs(parsed.query)
            return query.get('v', [None])[0]
        elif parsed.path.startswith('/embed/'):
            return parsed.path.split('/')[2]
    elif parsed.hostname == 'youtu.be':
        return parsed.path[1:]

    return None

async def get_video_details(video_id: str) -> Dict[str, Any]:
    """Fetch video details from YouTube API"""
    if not YOUTUBE_API_KEY:
        raise HTTPException(status_code=500, detail="YouTube API key not configured")

    # Check quota
    if not await check_quota():
        raise HTTPException(status_code=429, detail="Daily YouTube API quota exceeded")

    async with httpx.AsyncClient(timeout=30.0) as client:
        url = f"{YOUTUBE_API_BASE}/videos"
        params = {
            'part': 'snippet,contentDetails',
            'id': video_id,
            'key': YOUTUBE_API_KEY
        }

        response = await client.get(url, params=params)
        response.raise_for_status()

        # Increment quota (videos.list costs 1 unit)
        await increment_quota(1)

        data = response.json()

        if not data.get('items'):
            raise HTTPException(status_code=404, detail="Video not found")

        return data['items'][0]

async def get_video_comments(video_id: str, max_results: int = 100) -> List[Dict[str, Any]]:
    """Fetch video comments from YouTube API"""
    if not YOUTUBE_API_KEY:
        return []

    # Check quota
    if not await check_quota():
        logger.warning("Quota exceeded, skipping comment extraction")
        return []

    async with httpx.AsyncClient(timeout=30.0) as client:
        url = f"{YOUTUBE_API_BASE}/commentThreads"
        params = {
            'part': 'snippet',
            'videoId': video_id,
            'maxResults': min(max_results, 100),
            'order': 'relevance',
            'key': YOUTUBE_API_KEY
        }

        try:
            response = await client.get(url, params=params)
            response.raise_for_status()

            # Increment quota (commentThreads.list costs 1 unit)
            await increment_quota(1)

            data = response.json()
            comments = []

            for item in data.get('items', []):
                comment = item['snippet']['topLevelComment']['snippet']
                comments.append({
                    'text': comment['textDisplay'],
                    'author': comment['authorDisplayName'],
                    'likes': comment.get('likeCount', 0)
                })

            return comments

        except httpx.HTTPStatusError as e:
            if e.response.status_code == 403:
                logger.warning("Comments disabled for this video")
            return []

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
        return parse_description_basic(text)

def parse_description_basic(description: str) -> List[Dict]:
    """
    Fallback basic pattern matching for YouTube tracklists
    Common patterns:
    - 00:00 Artist - Track
    - 0:00 Artist - Track
    - [00:00] Artist - Track
    """
    tracklist = []

    # Pattern for timestamped tracks with brackets
    pattern1 = re.compile(r'\[?(\d{1,2}:\d{2}(?::\d{2})?)\]?\s+([^-\n]+?)\s*-\s*([^\n]+)', re.MULTILINE)

    matches = pattern1.findall(description)

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

async def scrape_youtube_video(url: str) -> Dict[str, Any]:
    """Scrape a YouTube video for tracklist data"""
    video_id = extract_video_id(url)

    if not video_id:
        raise HTTPException(status_code=400, detail="Invalid YouTube URL")

    # Get video details
    video_data = await get_video_details(video_id)

    snippet = video_data['snippet']
    title = snippet['title']
    description = snippet['description']
    published_at = snippet['publishedAt']

    # Extract tracklist from description
    tracklist = await extract_tracklist_via_nlp(description)

    # If description didn't yield results, check comments
    if not tracklist:
        logger.info("No tracklist in description, checking comments...")
        comments = await get_video_comments(video_id, max_results=50)

        # Look for comments that might contain tracklists
        for comment in comments:
            comment_tracklist = await extract_tracklist_via_nlp(comment['text'])
            if len(comment_tracklist) > len(tracklist):
                tracklist = comment_tracklist
                logger.info(f"Found tracklist in comment by {comment['author']}")
                break

    mix_data = {
        'name': title,
        'source_url': url,
        'platform': 'youtube',
        'youtube_music_id': video_id,
        'tracklist': tracklist,
        'playlist_date': None
    }

    # Parse published date
    try:
        mix_data['playlist_date'] = datetime.fromisoformat(published_at.replace('Z', '+00:00'))
    except Exception as e:
        logger.warning(f"Could not parse date: {e}")

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
                    'artist_name': track_data.get('artist_name', ''),
                    'youtube_music_id': track_data.get('youtube_music_id')
                }
                await db_pipeline.process_item(track_item, spider_context)

                # Create playlist track item
                playlist_track_item = {
                    'item_type': 'playlist_track',
                    'playlist_name': mix_data['name'],
                    'track_name': track_data['track_name'],
                    'artist_name': track_data.get('artist_name', ''),
                    'position': track_data.get('position'),
                    'source': 'youtube'
                }
                await db_pipeline.process_item(playlist_track_item, spider_context)

        # Flush remaining batches
        await db_pipeline.flush_all_batches()

        logger.info(f"Successfully saved mix '{mix_data['name']}' to database")

    finally:
        await db_pipeline.close_spider(spider_context)

@app.get("/health")
async def health_check():
    """Health check with API key validation"""
    status = {
        "status": "healthy",
        "scraper": "youtube",
        "api_key_configured": bool(YOUTUBE_API_KEY),
        "can_scrape": bool(YOUTUBE_API_KEY)
    }

    if not YOUTUBE_API_KEY:
        status["warning"] = "YouTube API key not configured - scraper will not function"
        status["status"] = "degraded"

    return status

@app.get("/quota")
async def get_quota_status():
    """Get current quota usage"""
    redis = await get_redis_client()
    try:
        quota_key = f"youtube:quota:{date.today().isoformat()}"
        current_usage = await redis.get(quota_key)
        usage = int(current_usage) if current_usage else 0

        return {
            "date": date.today().isoformat(),
            "used": usage,
            "limit": DAILY_QUOTA_LIMIT,
            "remaining": DAILY_QUOTA_LIMIT - usage,
            "percentage": round((usage / DAILY_QUOTA_LIMIT) * 100, 2)
        }
    finally:
        await redis.close()

@app.post("/scrape")
async def scrape_url(request: ScrapeRequest):
    """Execute scraping task for YouTube video"""
    task_id = request.task_id or f"youtube_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

    if not request.url:
        raise HTTPException(status_code=400, detail="URL is required for YouTube scraper")

    if 'youtube.com' not in request.url and 'youtu.be' not in request.url:
        raise HTTPException(status_code=400, detail="URL must be a YouTube URL")

    try:
        # Scrape the video
        mix_data = await scrape_youtube_video(request.url)

        # Save to database
        await save_to_database(mix_data)

        return {
            "status": "success",
            "task_id": task_id,
            "url": request.url,
            "video_title": mix_data['name'],
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
    uvicorn.run(app, host="0.0.0.0", port=8017)