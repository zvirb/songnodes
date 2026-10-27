"""Target-track queue API; accepts the JSON payloads sent by the management UI."""
from typing import List, Literal, Optional
from uuid import UUID

from fastapi import APIRouter, HTTPException
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


@router.get('')
async def list_targets():
    async with get_pool().acquire() as conn:
        rows = await conn.fetch("""
            SELECT * FROM target_tracks
            ORDER BY CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
                     added_at DESC, track_id
        """)
    return [dict(row) for row in rows]


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
