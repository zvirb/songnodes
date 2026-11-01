"""Target-track queue API; accepts the JSON payloads sent by the management UI."""
from typing import List, Literal, Optional
from uuid import UUID

import time
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field, field_validator

router = APIRouter(prefix="/api/v1/target-tracks", tags=["target-tracks"])


class TargetTrackCreate(BaseModel):
    title: str = Field(min_length=1, max_length=500)
    artist: str = Field(min_length=1, max_length=255)
    priority: Literal['low', 'medium', 'high'] = 'medium'
    genres: List[str] = Field(default_factory=list)
    search_terms: List[str] = Field(default_factory=list)
    is_active: bool = True

    @field_validator('title', 'artist')
    @classmethod
    def nonempty(cls, value):
        if not value.strip():
            raise ValueError('Must contain non-whitespace text')
        return value.strip()


class TargetTrackUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=500)
    artist: Optional[str] = Field(default=None, min_length=1, max_length=255)
    priority: Optional[Literal['low', 'medium', 'high']] = None
    genres: Optional[List[str]] = None
    search_terms: Optional[List[str]] = None
    is_active: Optional[bool] = None
    archived: Optional[bool] = None
    completion_percentage: Optional[int] = Field(default=None, ge=0, le=100)

    @field_validator('title', 'artist')
    @classmethod
    def nonempty(cls, value):
        return TargetTrackCreate.nonempty(value) if value is not None else None


def get_pool():
    # The application owns pool lifecycle; resolve it after startup.
    from main import db_pool
    if db_pool is None:
        raise HTTPException(status_code=503, detail="Database pool not initialized")
    return db_pool


@router.get('/suggestions')
async def target_suggestions(limit: int = 20):
    from target_suggestions import get_target_suggestions
    pool = get_pool()
    return await get_target_suggestions(pool, limit=limit)

SEARCH_JOB_COLUMNS = ('queued', 'running', 'succeeded', 'dead', 'finished_at', 'last_error')


def with_search_jobs(row) -> dict:
    """The target row plus `search_jobs`: its latest search's scrape jobs, or None when never searched."""
    target = dict(row)
    summary = {name: target.pop(f'search_{name}', None) for name in SEARCH_JOB_COLUMNS}
    target['search_jobs'] = None if target.get('last_searched') is None else summary
    return target


@router.get('')
async def list_targets():
    # The latest search is every scrape job for the target created at or after `last_searched` (one job per
    # source; the search stamps `last_searched` in the transaction that enqueues them). This is the rule
    # target_scrape.record_playlists_found uses for `playlists_found`, so the counts and the playlists agree.
    async with get_pool().acquire() as conn:
        rows = await conn.fetch("""
            SELECT t.*, s.* FROM target_tracks t
            LEFT JOIN LATERAL (
                SELECT COUNT(*) FILTER (WHERE j.status = 'queued') AS search_queued,
                       COUNT(*) FILTER (WHERE j.status = 'running') AS search_running,
                       COUNT(*) FILTER (WHERE j.status = 'succeeded') AS search_succeeded,
                       COUNT(*) FILTER (WHERE j.status = 'dead') AS search_dead,
                       MAX(j.finished_at) AS search_finished_at,
                       (ARRAY_AGG(j.last_error ORDER BY j.updated_at DESC)
                            FILTER (WHERE j.status = 'dead'))[1] AS search_last_error
                FROM ingestion_jobs j
                WHERE j.kind = 'scrape'
                  AND t.last_searched IS NOT NULL AND j.created_at >= t.last_searched
                  AND j.payload->>'target_track_id' = t.track_id::text
            ) s ON TRUE
            ORDER BY CASE t.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
                     t.added_at DESC, t.track_id
        """)
    return [with_search_jobs(row) for row in rows]


@router.post('', status_code=201)
async def create_target(payload: TargetTrackCreate):
    async with get_pool().acquire() as conn:
        row = await conn.fetchrow("""
            INSERT INTO target_tracks (title, artist, priority, genres, search_terms, is_active)
            VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
        """, payload.title, payload.artist, payload.priority, payload.genres,
            payload.search_terms, payload.is_active)
    return dict(row)


@router.put('/{track_id}')
async def update_target(track_id: UUID, payload: TargetTrackUpdate):
    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    if any(value is None for value in updates.values()):
        raise HTTPException(status_code=422, detail="Target-track fields cannot be null")
    # Names come exclusively from the model; values remain bound parameters.
    assignments = ', '.join(f'{name} = ${i}' for i, name in enumerate(updates, start=2))
    async with get_pool().acquire() as conn:
        row = await conn.fetchrow(f"""
            UPDATE target_tracks SET {assignments}, updated_at = NOW()
            WHERE track_id = $1 RETURNING *
        """, track_id, *updates.values())
    if row is None:
        raise HTTPException(status_code=404, detail="Target track not found")
    return dict(row)


@router.delete('/{track_id}', status_code=204)
async def delete_target(track_id: UUID):
    async with get_pool().acquire() as conn:
        deleted = await conn.fetchval('DELETE FROM target_tracks WHERE track_id = $1 RETURNING track_id', track_id)
    if deleted is None:
        raise HTTPException(status_code=404, detail="Target track not found")


@router.post('/{track_id}/search', status_code=202)
async def search_target(track_id: UUID, source: str = Query('1001tracklists', min_length=1, max_length=100)):
    async with get_pool().acquire() as conn:
        row = await conn.fetchrow("""
            UPDATE target_tracks
            SET last_searched = NOW(), updated_at = NOW()
            WHERE track_id = $1
            RETURNING *
        """, track_id)
        if row is None:
            raise HTTPException(status_code=404, detail="Target track not found")

        search_query = f"{row['artist']} {row['title']}".strip()
        payload = {
            'source': source,
            'search_query': search_query,
            'target_track_id': str(track_id),
        }
        idempotency_key = f"target-search:{track_id}:{int(time.time())}"
        from common.datalayer import jobs as domain
        job_row, created = await domain.enqueue(conn, 'scrape', idempotency_key, payload)

    return {
        'status': 'queued',
        'job_id': str(job_row['id']),
        'track_id': str(track_id),
        'search_query': search_query,
        'source': source,
        'created': created,
    }
