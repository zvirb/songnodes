"""HTTP layer for silver-catalog writes; domain rules live in catalog_writes.py."""
import functools
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import constr

import catalog_writes as domain
from common.artist_name_cleaner import clean_artist_name
# Request/response contracts stay in main.py; this router is registered after they are defined.
from main import (ArtistCreate, ArtistResponse, AssignArtistRequest, DirtyArtistResponse, RenameArtistRequest,
                  TrackCreate, TrackResponse, TrackWithoutArtistResponse, TracklistImportRequest,
                  TracklistImportResponse)

router = APIRouter(tags=['catalog-writes'])


def get_pool():
    from main import db_pool
    if db_pool is None:
        raise HTTPException(status_code=503, detail='Database pool not initialized')
    return db_pool


def domain_errors(handler):
    """Translate CatalogError into the HTTP status the legacy endpoints used."""
    @functools.wraps(handler)
    async def wrapper(*args, **kwargs):
        try:
            return await handler(*args, **kwargs)
        except domain.CatalogError as error:
            raise HTTPException(status_code=error.status, detail=error.detail)
    return wrapper


def pattern_type(name: str) -> str:
    if name.startswith('['):
        return 'timestamp' if ':' in name[:10] else 'numeric_bracket'
    return {'+': 'plus_prefix', '-': 'dash_prefix', '*': 'asterisk_prefix'}.get(name[:1], 'unknown')


@router.get('/api/v1/artists/dirty')
@domain_errors
async def get_dirty_artists(limit: int = Query(50, ge=1, le=500), offset: int = Query(0, ge=0)):
    """Artists whose names carry formatting artifacts (timestamps, numeric brackets, list markers)."""
    async with get_pool().acquire() as conn:
        rows = await domain.dirty_artists(conn, limit, offset)
        result = []
        for row in rows:
            suggestion = clean_artist_name(row['name'])
            result.append(DirtyArtistResponse(
                artist_id=row['artist_id'], current_name=row['name'], suggested_clean_name=suggestion,
                track_count=row['track_count'], pattern_type=pattern_type(row['name']),
                has_conflict=await domain.artist_name_exists(conn, suggestion, row['artist_id'])))
    return result


@router.post('/api/v1/artists/{artist_id}/rename')
@domain_errors
async def rename_artist(artist_id: str, request: RenameArtistRequest):
    async with get_pool().acquire() as conn:
        result = await domain.rename_artist(conn, domain.artist_uuid(artist_id), request.new_name)
    return {**result, 'updated_at': result['updated_at'].isoformat()}


@router.post('/api/v1/artists/{duplicate_id}/merge')
@domain_errors
async def merge_artist(duplicate_id: str, request: RenameArtistRequest):
    async with get_pool().acquire() as conn:
        return await domain.merge_artist(conn, domain.artist_uuid(duplicate_id), request.new_name)


@router.delete('/api/v1/artists/{artist_id}')
@domain_errors
async def delete_artist(artist_id: str):
    async with get_pool().acquire() as conn:
        return await domain.delete_artist(conn, domain.artist_uuid(artist_id))


@router.get('/api/v1/tracks/missing-artist')
@domain_errors
async def get_tracks_without_artist(limit: int = Query(50, ge=1, le=500), offset: int = Query(0, ge=0),
                                    sort_by: str = 'importance'):
    """Tracks whose primary artist is empty or a generic placeholder, most-used in sets first."""
    async with get_pool().acquire() as conn:
        rows = await domain.tracks_missing_artist(conn, limit, offset, sort_by == 'alphabetical')
    return [TrackWithoutArtistResponse(**row, importance=float(row['setlist_count'])) for row in rows]


@router.post('/api/v1/tracks/{track_id}/assign-artist')
@domain_errors
async def assign_artist_to_track(track_id: str, request: AssignArtistRequest):
    async with get_pool().acquire() as conn:
        result = await domain.assign_artist(conn, domain.track_uuid(track_id),
                                            domain.artist_uuid(request.artist_id), request.role)
    return {**result, 'created_at': result['created_at'].isoformat()}


@router.post('/api/v1/artists', status_code=201)
@domain_errors
async def create_artist(artist: ArtistCreate):
    """Create a manual silver artist; generic names are rejected by validation."""
    async with get_pool().acquire() as conn:
        row = await domain.create_artist(conn, artist)
    return ArtistResponse(**artist.model_dump(), artist_id=str(row['artist_id']),
                                   created_at=row['created_at'], updated_at=row['updated_at'])


class ManualTrackCreate(TrackCreate):
    """Silver requires a primary artist, which the shared TrackCreate contract lacks."""
    artist_name: constr(min_length=1, max_length=255)


@router.post('/api/v1/tracks', status_code=201)
@domain_errors
async def create_track(track: ManualTrackCreate):
    async with get_pool().acquire() as conn:
        row = await domain.create_track(conn, track, track.artist_name)
    return TrackResponse(**track.model_dump(exclude={'artist_name'}), song_id=str(row['song_id']),
                                  created_at=row['created_at'], updated_at=row['updated_at'])


@router.post('/api/v1/tracks/import-tracklist')
@domain_errors
async def import_tracklist(request: TracklistImportRequest):
    async with get_pool().acquire() as conn:
        stats = await domain.import_tracklist(conn, request.tracks, request.dj_artist, request.name)
    return TracklistImportResponse(**stats)
