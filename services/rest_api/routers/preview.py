"""Deezer 30-second preview URL for a library track (PV1).

GET /api/v1/library/tracks/{id}/preview returns {"url": <Deezer preview MP3 URL> | null, "source": "deezer"}.
The browser plays the URL straight from Deezer; this router never fetches or proxies audio bytes. Deezer's terms
allow 30-second extract URLs to be shown to the end user in a private, non-commercial application
(docs/audio-analysis/deezer-previews.md).

The lookup reuses the shared Deezer client (services/common/providers/deezer.py): the track's stored deezer_id
first (`/track/{id}`), otherwise ISRC first and then artist + title, with the same `best_match` rules enrichment
uses so a fuzzy search never plays a different recording. Results, including "no preview", are kept in the
client's TTL cache for a short time because Deezer preview URLs are signed and expire.
"""
import logging
import os
from typing import Any, Dict, Optional
from uuid import UUID

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from common.metadata import matching
from common.providers.base import ProviderError, ProviderUnavailable
from common.providers.deezer import DeezerClient

logger = logging.getLogger(__name__)

SOURCE = 'deezer'
CACHE_TTL_SECONDS = float(os.getenv('PREVIEW_CACHE_TTL_SECONDS', '600'))

router = APIRouter(prefix="/api/v1/library", tags=["library-preview"])

_deezer: Optional[Any] = None


def get_pool():
    from main import db_pool
    return db_pool


def get_deezer():
    """One shared Deezer client per process, so its rate limiter and cache apply across requests."""
    global _deezer
    if _deezer is None:
        _deezer = DeezerClient()
    return _deezer


class PreviewResponse(BaseModel):
    url: Optional[str]
    source: str = SOURCE


TRACK_SQL = """
    SELECT pt.track_id, pt.artist_name, pt.track_title, pt.isrc, pt.deezer_id, pt.duration_ms
    FROM projection_tracks pt
    JOIN library.tracks lt ON lt.id = pt.track_id
    WHERE pt.track_id = $1
"""


def preview_of(found) -> Optional[str]:
    url = (found.raw.get('preview') if found else None) or None
    return url if isinstance(url, str) and url.startswith('https://') else None


async def find_preview(deezer, row) -> Optional[str]:
    deezer_id = (row['deezer_id'] or '').strip()
    if deezer_id.isdigit():
        return preview_of(await deezer.detail(deezer_id))
    target = matching.Track(row['track_title'], row['artist_name'], row['isrc'], row['duration_ms'])
    candidates = await deezer.lookup(target)
    if not candidates:
        return None
    decision = matching.best_match(target, [c.track for c in candidates], 'unique_exact')
    if decision.outcome != 'match':
        return None
    return preview_of(next(c for c in candidates if c.track is decision.candidate))


@router.get('/tracks/{track_id}/preview', response_model=PreviewResponse)
async def track_preview(track_id: UUID) -> Dict[str, Any]:
    try:
        async with get_pool().acquire() as conn:
            row = await conn.fetchrow(TRACK_SQL, track_id)
    except Exception:
        logger.exception('preview: track lookup failed for %s', track_id)
        raise HTTPException(status_code=500, detail="Track lookup failed")
    if row is None:
        raise HTTPException(status_code=404, detail="Track not found in the library")

    deezer = get_deezer()
    key = f'preview:{track_id}'
    cached = await deezer.cache.get(key)
    if cached is not None:
        return {'url': cached['url'], 'source': SOURCE}
    try:
        url = await find_preview(deezer, row)
    except ProviderUnavailable:
        logger.warning('preview: Deezer unavailable for %s', track_id, exc_info=True)
        raise HTTPException(status_code=503, detail="Deezer is unavailable, try again later")
    except ProviderError:
        logger.warning('preview: Deezer error for %s', track_id, exc_info=True)
        raise HTTPException(status_code=502, detail="Deezer preview lookup failed")
    except Exception:
        logger.exception('preview: unexpected error for %s', track_id)
        raise HTTPException(status_code=500, detail="Preview lookup failed")
    await deezer.cache.set(key, {'url': url}, CACHE_TTL_SECONDS)
    return {'url': url, 'source': SOURCE}


def register(app):
    app.include_router(router)
