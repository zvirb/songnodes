"""Operational data-layer endpoints: job submission, review queue, merges, canonical ids, outbox status."""
import json
from typing import Any, Dict, List, Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, Header, HTTPException, Query
from pydantic import BaseModel, Field

from common.datalayer import er, identity, jobs as jobs_domain, outbox, projection
from common.datalayer.errors import CatalogError
from common.providers.getsongbpm import ATTRIBUTION
from routers.catalog_writes import domain_errors, get_pool

router = APIRouter(tags=['datalayer'])

# `scrape` is submitted through /api/v1/scrape/trigger so its payload is validated in one place.
ENQUEUEABLE = {'ingest_pending', 'enrichment_backfill', 'enrich_track', 'camelot_repair', 'projection_consume',
               'projection_rebuild', 'projection_reconcile', 'er_shadow'}


class EnqueueRequest(BaseModel):
    kind: str
    payload: Dict[str, Any] = Field(default_factory=dict)
    max_attempts: int = Field(3, ge=1, le=10)


class MergeRequest(BaseModel):
    duplicate_id: UUID
    reason: Optional[str] = Field(None, max_length=500)


def uuid_of(value: str, what: str) -> UUID:
    try:
        return UUID(value.removeprefix('song_'))
    except ValueError:
        raise HTTPException(status_code=422, detail=f'Invalid {what}')


@router.post('/api/v1/jobs', status_code=202)
@domain_errors
async def enqueue_job(request: EnqueueRequest, idempotency_key: Optional[str] = Header(None, min_length=1, max_length=200)):
    """Queue a data-layer job. Send an Idempotency-Key to retry safely; without one every call is a new job."""
    if request.kind not in ENQUEUEABLE:
        raise HTTPException(status_code=422, detail=f'kind must be one of {", ".join(sorted(ENQUEUEABLE))}')
    if request.kind == 'enrich_track':
        uuid_of(str(request.payload.get('track_id', '')), 'payload.track_id')
    async with get_pool().acquire() as conn:
        row, created = await jobs_domain.enqueue(conn, request.kind, idempotency_key or str(uuid4()), request.payload,
                                                 request.max_attempts)
    return {'job_id': str(row['id']), 'kind': row['kind'], 'status': row['status'], 'created': created}


@router.get('/api/v1/metadata/review')
@domain_errors
async def metadata_review(reason: Optional[str] = Query(None, max_length=100), limit: int = Query(50, ge=1, le=200),
                          offset: int = Query(0, ge=0)):
    """Tracks flagged for review, with the reasons and (where fields disagree) the competing evidence."""
    async with get_pool().acquire() as conn:
        rows = await conn.fetch("""
            SELECT t.id, t.artist_name, t.track_title, t.metadata_review_reasons FROM silver_enriched_tracks t
            WHERE t.metadata_review AND ($1::text IS NULL OR $1 = ANY(t.metadata_review_reasons))
            ORDER BY t.updated_at DESC, t.id LIMIT $2 OFFSET $3""", reason, limit, offset)
        conflicts: Dict[UUID, List[Dict[str, Any]]] = {}
        for record in await conn.fetch('SELECT track_id, field, evidence FROM v_metadata_conflicts WHERE track_id = ANY($1::uuid[])',
                                       [r['id'] for r in rows]):
            evidence = json.loads(record['evidence']) if isinstance(record['evidence'], str) else record['evidence']
            conflicts.setdefault(record['track_id'], []).append({'field': record['field'], 'evidence': evidence})
    return [{'track_id': str(r['id']), 'artist': r['artist_name'], 'title': r['track_title'],
             'reasons': list(r['metadata_review_reasons']), 'conflicts': conflicts.get(r['id'], [])} for r in rows]


@router.get('/api/v1/tracks/{track_id}/canonical')
@domain_errors
async def canonical_track(track_id: str):
    """Resolve a (possibly merged-away) track id to the surviving id."""
    requested = uuid_of(track_id, 'track ID')
    async with get_pool().acquire() as conn:
        survivor = await identity.resolve_id(conn, 'track', requested)
        exists = await conn.fetchval('SELECT EXISTS(SELECT 1 FROM silver_enriched_tracks WHERE id = $1)', survivor)
    if not exists:
        raise HTTPException(status_code=404, detail='Track not found')
    return {'requested': str(requested), 'canonical': str(survivor), 'redirected': survivor != requested}


@router.post('/api/v1/tracks/{track_id}/merge')
@domain_errors
async def merge_track(track_id: str, request: MergeRequest):
    """Merge `duplicate_id` into this track. Reversible via POST /api/v1/merges/{id}/revert."""
    async with get_pool().acquire() as conn:
        history = await identity.merge_tracks(conn, uuid_of(track_id, 'track ID'), request.duplicate_id, request.reason)
    return {'history_id': history, 'survivor_id': track_id.removeprefix('song_'), 'duplicate_id': str(request.duplicate_id)}


@router.get('/api/v1/merges')
@domain_errors
async def list_merges(entity_type: Optional[str] = Query(None, pattern='^(track|artist)$'), limit: int = Query(50, ge=1, le=200)):
    async with get_pool().acquire() as conn:
        rows = await conn.fetch("""SELECT id, entity_type, survivor_id, duplicate_id, reason, merged_at, reverted_at
                                   FROM entity_merge_history WHERE $1::text IS NULL OR entity_type = $1
                                   ORDER BY id DESC LIMIT $2""", entity_type, limit)
    return [{**dict(r), 'survivor_id': str(r['survivor_id']), 'duplicate_id': str(r['duplicate_id'])} for r in rows]


@router.post('/api/v1/merges/{history_id}/revert')
@domain_errors
async def revert_merge(history_id: int):
    async with get_pool().acquire() as conn:
        kind = await conn.fetchval('SELECT entity_type FROM entity_merge_history WHERE id = $1', history_id)
        if kind is None:
            raise CatalogError(404, 'Merge not found')
        return await (identity.unmerge_tracks if kind == 'track' else identity.unmerge_artists)(conn, history_id)


@router.get('/api/v1/outbox/status')
@domain_errors
async def outbox_status():
    """Consumer lag and dead letters, for operations dashboards."""
    async with get_pool().acquire() as conn:
        consumers = [{'consumer': r['consumer'], 'backlog': await outbox.backlog(conn, r['consumer']), 'updated_at': r['updated_at']}
                     for r in await conn.fetch('SELECT consumer, updated_at FROM outbox_consumers ORDER BY consumer')]
        if not any(c['consumer'] == projection.CONSUMER for c in consumers):
            consumers.append({'consumer': projection.CONSUMER, 'backlog': await outbox.backlog(conn, projection.CONSUMER), 'updated_at': None})
        dead = await conn.fetchval('SELECT count(*) FROM outbox_dead_letters')
        reconcile = await projection.reconcile(conn)
    return {'consumers': consumers, 'dead_letters': dead, 'projection': reconcile}


@router.post('/api/v1/projections/tracks/reconcile')
@domain_errors
async def reconcile_projection(repair: bool = False):
    async with get_pool().acquire() as conn:
        return await projection.reconcile(conn, repair=repair)


@router.get('/api/v1/attributions')
async def attributions():
    """Provider attributions the interface must show. GetSongBPM requires a visible backlink once enabled."""
    import os
    enabled = (os.getenv('GETSONGBPM_ENABLED', '').strip().lower() in ('1', 'true', 'yes', 'on')) and bool(os.getenv('GETSONGBPM_API_KEY'))
    return {'attributions': [ATTRIBUTION] if enabled else []}


class ReviewVerdict(BaseModel):
    outcome: str = Field(..., pattern='^(same|different)$')


@router.get('/api/v1/resolution/review')
@domain_errors
async def resolution_review(limit: int = Query(50, ge=1, le=200), offset: int = Query(0, ge=0)):
    """Shadow entity-resolution pairs awaiting a human verdict, most similar first."""
    async with get_pool().acquire() as conn:
        rows = await er.pending_review(conn, limit, offset)
    return [{'decision_id': r['id'], 'entity_type': r['entity_type'], 'left_id': str(r['left_id']), 'right_id': str(r['right_id']),
             'score': r['score'], 'decision': r['decision'], 'artist': r['left_artist'], 'left_title': r['left_title'],
             'right_title': r['right_title'], 'features': json.loads(r['features']) if isinstance(r['features'], str) else r['features']}
            for r in rows]


@router.post('/api/v1/resolution/{decision_id}/review')
@domain_errors
async def resolution_verdict(decision_id: int, verdict: ReviewVerdict):
    """`same` merges the pair through the reversible track merge; `different` records that they must stay apart."""
    async with get_pool().acquire() as conn:
        return await er.review(conn, decision_id, verdict.outcome)
