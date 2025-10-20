"""
YouTube Data API v3 Router with Quota Management
Implements daily quota limits to stay within Google's free tier (10,000 units/day)
Search cost: ~100 units per request
"""

from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel
from typing import Optional, List
import aiohttp
from datetime import date
import logging

router = APIRouter(prefix="/api/v1/youtube", tags=["YouTube API"])
logger = logging.getLogger(__name__)

# Get database pool from app state (injected by main.py)
async def get_db_pool():
    """Dependency to get database pool"""
    from main import db_pool
    if not db_pool:
        raise HTTPException(
            status_code=500,
            detail="Database connection pool not available"
        )
    return db_pool

# YouTube API quota costs
SEARCH_COST = 100  # Each search query costs 100 units
VIDEO_DETAILS_COST = 1  # Each video details request costs 1 unit


class QuotaStatus(BaseModel):
    """Current quota usage status"""
    service: str
    date: str
    units_used: int
    max_units: int
    remaining_units: int
    percentage_used: float
    searches_remaining: int


class YouTubeSearchResult(BaseModel):
    """YouTube video search result"""
    video_id: str
    title: str
    channel_title: str
    description: str
    published_at: str
    thumbnail_url: str


async def check_and_update_quota(
    service_name: str,
    units_cost: int,
    pool = Depends(get_db_pool)
) -> dict:
    """
    Check if quota available and update usage
    Returns quota info or raises HTTPException if exceeded
    """
    async with pool.acquire() as conn:
        # Get today's quota
        today = date.today()

        quota = await conn.fetchrow("""
            SELECT units_used, max_units
            FROM api_quota_tracking
            WHERE service_name = $1 AND quota_date = $2
        """, service_name, today)

        if not quota:
            # Create today's quota entry
            await conn.execute("""
                INSERT INTO api_quota_tracking (service_name, quota_date, units_used, max_units)
                VALUES ($1, $2, 0, 9900)
            """, service_name, today)
            quota = {'units_used': 0, 'max_units': 9900}

        units_used = quota['units_used']
        max_units = quota['max_units']

        # Check if request would exceed quota
        if units_used + units_cost > max_units:
            remaining = max_units - units_used
            raise HTTPException(
                status_code=429,
                detail={
                    "error": "Daily quota exceeded",
                    "quota_limit": max_units,
                    "quota_used": units_used,
                    "quota_remaining": remaining,
                    "request_cost": units_cost,
                    "reset_time": "Midnight Pacific Time"
                }
            )

        # Update quota usage
        new_usage = await conn.fetchval("""
            UPDATE api_quota_tracking
            SET units_used = units_used + $1, updated_at = NOW()
            WHERE service_name = $2 AND quota_date = $3
            RETURNING units_used
        """, units_cost, service_name, today)

        return {
            'units_used': new_usage,
            'max_units': max_units,
            'remaining': max_units - new_usage
        }


@router.get("/quota", response_model=QuotaStatus)
async def get_quota_status(pool = Depends(get_db_pool)):
    """Get current YouTube API quota usage status"""
    async with pool.acquire() as conn:
        today = date.today()

        quota = await conn.fetchrow("""
            SELECT units_used, max_units
            FROM api_quota_tracking
            WHERE service_name = 'youtube' AND quota_date = $1
        """, today)

        if not quota:
            # Create today's entry
            await conn.execute("""
                INSERT INTO api_quota_tracking (service_name, quota_date, units_used, max_units)
                VALUES ('youtube', $1, 0, 9900)
            """, today)
            units_used = 0
            max_units = 9900
        else:
            units_used = quota['units_used']
            max_units = quota['max_units']

        remaining = max_units - units_used
        percentage = (units_used / max_units * 100) if max_units > 0 else 0
        searches_remaining = remaining // SEARCH_COST

        return QuotaStatus(
            service="youtube",
            date=str(today),
            units_used=units_used,
            max_units=max_units,
            remaining_units=remaining,
            percentage_used=round(percentage, 2),
            searches_remaining=searches_remaining
        )


@router.get("/search", response_model=List[YouTubeSearchResult])
async def search_youtube(
    query: str = Query(..., description="Search query (DJ mix, artist name, etc.)"),
    api_key: str = Query(..., description="YouTube Data API key"),
    max_results: int = Query(10, ge=1, le=50, description="Max results (1-50)"),
    pool = Depends(get_db_pool)
):
    """
    Search YouTube videos with quota enforcement
    Cost: 100 units per request
    Max 99 searches per day to stay within free tier
    """

    # Check and update quota
    quota_info = await check_and_update_quota('youtube', SEARCH_COST, pool)

    logger.info(f"🎥 [YOUTUBE] Search: '{query}' (Quota: {quota_info['units_used']}/{quota_info['max_units']})")

    try:
        async with aiohttp.ClientSession() as session:
            params = {
                'part': 'snippet',
                'q': query,
                'type': 'video',
                'maxResults': max_results,
                'key': api_key
            }

            async with session.get(
                'https://www.googleapis.com/youtube/v3/search',
                params=params,
                timeout=aiohttp.ClientTimeout(total=10)
            ) as response:
                if response.status == 200:
                    data = await response.json()

                    results = []
                    for item in data.get('items', []):
                        snippet = item['snippet']
                        results.append(YouTubeSearchResult(
                            video_id=item['id']['videoId'],
                            title=snippet['title'],
                            channel_title=snippet['channelTitle'],
                            description=snippet['description'],
                            published_at=snippet['publishedAt'],
                            thumbnail_url=snippet['thumbnails']['high']['url']
                        ))

                    logger.info(f"🎥 [YOUTUBE] Found {len(results)} results. Remaining: {quota_info['remaining']} units")
                    return results

                elif response.status == 403:
                    error = await response.json()
                    error_reason = error.get('error', {}).get('errors', [{}])[0].get('reason', 'unknown')

                    if error_reason == 'quotaExceeded':
                        raise HTTPException(
                            status_code=429,
                            detail="YouTube API quota exceeded. Resets at midnight Pacific Time."
                        )
                    elif error_reason in ['keyInvalid', 'badRequest']:
                        raise HTTPException(
                            status_code=403,
                            detail="Invalid YouTube API key. Please check your credentials."
                        )
                    else:
                        raise HTTPException(
                            status_code=403,
                            detail=f"YouTube API error: {error_reason}"
                        )
                else:
                    error_text = await response.text()
                    logger.error(f"YouTube API error: {response.status} - {error_text}")
                    raise HTTPException(
                        status_code=response.status,
                        detail=f"YouTube API request failed: {error_text}"
                    )

    except aiohttp.ClientError as e:
        logger.error(f"Network error calling YouTube API: {str(e)}")
        raise HTTPException(
            status_code=503,
            detail="YouTube API is currently unavailable"
        )


@router.post("/quota/reset")
async def reset_quota(pool = Depends(get_db_pool)):
    """
    Reset today's quota (admin function)
    Use this if you need to manually reset the counter
    """
    async with pool.acquire() as conn:
        today = date.today()

        await conn.execute("""
            UPDATE api_quota_tracking
            SET units_used = 0, updated_at = NOW()
            WHERE service_name = 'youtube' AND quota_date = $1
        """, today)

        return {
            "success": True,
            "message": "YouTube quota reset to 0",
            "date": str(today)
        }
