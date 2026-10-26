from fastapi import APIRouter, Header, HTTPException, Body
from typing import Dict, Any, Optional
from common.datalayer import jobs as domain
from .catalog_writes import domain_errors, get_pool
from library.model.library_db import get_sets, save_set, delete_set, get_set_export
import uuid

router = APIRouter(tags=['library'])

@router.post('/api/v1/library/ingest', status_code=202)
@domain_errors
async def ingest_library(idempotency_key: str = Header(..., min_length=1, max_length=200),
                         payload: Dict[str, Any] = Body(...)):
    """Idempotent bulk ingest for music library data."""
    async with get_pool().acquire() as conn:
        row, created = await domain.enqueue(conn, 'library_ingest', idempotency_key, payload)

    return {'job_id': str(row['id']), 'status': row['status'], 'created': created}


@router.get('/api/v1/library/sets')
@domain_errors
async def list_sets():
    async with get_pool().acquire() as conn:
        return await get_sets(conn)


@router.put('/api/v1/library/sets/{set_id}')
@domain_errors
async def update_set(set_id: int, payload: Dict[str, Any] = Body(...)):
    async with get_pool().acquire() as conn:
        sid = await save_set(conn, set_id, payload.get('name'), payload.get('description'), payload.get('tracks', []))
        return {"id": sid}


@router.delete('/api/v1/library/sets/{set_id}')
@domain_errors
async def remove_set(set_id: int):
    async with get_pool().acquire() as conn:
        await delete_set(conn, set_id)
        return {"success": True}


@router.get('/api/v1/library/sets/export')
@domain_errors
async def export_sets():
    async with get_pool().acquire() as conn:
        return await get_set_export(conn)

def register(app):
    app.include_router(router)
