"""Job submission and status endpoints; claim/complete/fail belong to workers, not HTTP."""
import json
import os
import re
from datetime import date, datetime, time, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

from uuid import UUID, uuid4

import httpx
from fastapi import APIRouter, Header, HTTPException, Query
from pydantic import BaseModel, Field

from common.datalayer import graph_projection, outbox, projection
from common.datalayer import jobs as domain
from common.datalayer.ingest import INGEST_MARKER
from routers.catalog_writes import domain_errors, get_pool

router = APIRouter(tags=['jobs'])

STATUSES = ('queued', 'running', 'succeeded', 'dead')


class JobResponse(BaseModel):
    job_id: UUID
    kind: str
    idempotency_key: str
    status: str
    attempts: int
    max_attempts: int
    run_after: datetime
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    last_error: Optional[str] = None
    payload: Dict[str, Any] = Field(default_factory=dict)
    result: Optional[Dict[str, Any]] = None
    warning: Optional[str] = None
    created_at: datetime
    updated_at: datetime


def decode(value):
    return json.loads(value) if isinstance(value, str) else value


def job_response(row) -> JobResponse:
    data = dict(row)
    data['job_id'] = data.pop('id')
    data['payload'] = decode(data['payload']) or {}
    res = decode(data['result'])
    data['result'] = res
    if isinstance(res, dict) and res.get('warning'):
        data['warning'] = res['warning']
    elif isinstance(res, dict) and res.get('found_nothing'):
        data['warning'] = 'No tracks or playlists found by scraper'
    return JobResponse(**data)


def job_uuid(value: str) -> UUID:
    try:
        return UUID(value)
    except ValueError:
        raise HTTPException(status_code=422, detail='Invalid job ID')


@router.post('/api/v1/scrape/trigger', status_code=202)
@domain_errors
async def trigger_scrape(source: str = Query('1001tracklists', min_length=1, max_length=100),
                         search_query: Optional[str] = Query(None, min_length=1, max_length=255),
                         idempotency_key: Optional[str] = Header(None, min_length=1, max_length=200)):
    """Record a scrape job. It stays queued until the worker claims it (the Compose stack runs one).

    Send the same Idempotency-Key to retry safely; without one every call is a new job.
    """
    payload = {'source': source, **({'search_query': search_query.strip()} if search_query else {})}
    async with get_pool().acquire() as conn:
        row, created = await domain.enqueue(conn, 'scrape', idempotency_key or str(uuid4()), payload)
    return {
        'status': row['status'], 'job_id': str(row['id']), 'source': source, 'created': created,
        'message': (f'Job queued; the worker starts it when it is free. Follow it at /api/v1/jobs/{row["id"]}/stages.'
                    if created else 'An existing job was returned for this idempotency key.'),
    }


ISO_DATE = re.compile(r'\d{4}-\d{2}-\d{2}')

# Bounds go in as naive Melbourne midnights; Postgres turns them into instants with its own
# time zone data (the python:slim images have no tzdata for zoneinfo).
LIST_JOBS_IN_SPAN = """
    SELECT * FROM ingestion_jobs
    WHERE ($1::text IS NULL OR status = $1) AND ($2::text IS NULL OR kind = $2)
      AND ($3::timestamp IS NULL OR created_at >= ($3::timestamp AT TIME ZONE 'Australia/Melbourne'))
      AND ($4::timestamp IS NULL OR created_at < ($4::timestamp AT TIME ZONE 'Australia/Melbourne'))
    ORDER BY created_at DESC, id LIMIT $5 OFFSET $6
"""


def melbourne_day(name: str, value: Optional[str]) -> Optional[date]:
    if value is None:
        return None
    try:
        if not ISO_DATE.fullmatch(value):
            raise ValueError(value)
        return date.fromisoformat(value)
    except ValueError:
        raise HTTPException(status_code=422, detail=f'{name} must be a date as YYYY-MM-DD')


@router.get('/api/v1/jobs', response_model=List[JobResponse])
@domain_errors
async def list_jobs(status: Optional[str] = Query(None), kind: Optional[str] = Query(None),
                    limit: int = Query(50, ge=1, le=200), offset: int = Query(0, ge=0),
                    created_from: Optional[str] = Query(
                        None, description='First Australia/Melbourne day, YYYY-MM-DD, inclusive.'),
                    created_to: Optional[str] = Query(
                        None, description='Last Australia/Melbourne day, YYYY-MM-DD, inclusive. Succeeded '
                                          'jobs are deleted after JOB_RETENTION_DAYS (default 14).')):
    if status is not None and status not in STATUSES:
        raise HTTPException(status_code=422, detail=f'status must be one of {", ".join(STATUSES)}')
    first, last = melbourne_day('created_from', created_from), melbourne_day('created_to', created_to)
    if first and last and first > last:
        raise HTTPException(status_code=422, detail='created_from must not be after created_to')
    async with get_pool().acquire() as conn:
        if first is None and last is None:
            rows = await domain.list_jobs(conn, status, kind, limit, offset)
        else:
            start = datetime.combine(first, time.min) if first else None
            end = datetime.combine(last + timedelta(days=1), time.min) if last and last < date.max else None
            rows = await conn.fetch(LIST_JOBS_IN_SPAN, status, kind, start, end, limit, offset)
        return [job_response(row) for row in rows]


@router.get('/api/v1/jobs/{job_id}', response_model=JobResponse)
@domain_errors
async def get_job(job_id: str):
    async with get_pool().acquire() as conn:
        return job_response(await domain.get_job(conn, job_uuid(job_id)))


@router.post('/api/v1/jobs/{job_id}/retry', response_model=JobResponse)
@domain_errors
async def retry_job(job_id: str):
    """Re-queue a dead-lettered job with a fresh attempt budget."""
    async with get_pool().acquire() as conn:
        return job_response(await domain.retry_dead(conn, job_uuid(job_id)))


# ---- Stages of one scrape job (JOBSTG). States are StagedProgress's; the page derives "stalled" from last_progress_at.

SCRAPER_URL = os.getenv('UNIFIED_SCRAPER_URL', 'http://unified-scraper:8000')
LABELS = {'queued': 'Queued', 'scrape': 'Scraping and saving raw data', 'ingest': 'Ingest to silver',
          'projection': 'Graph projection'}
NO_ANSWER = 'Live progress is unavailable: the scraper did not answer'
NO_RECORD = 'No live progress is recorded for this attempt'
UPSTREAM_FAILED = 'Not run: an earlier stage failed'
NO_PROJECTION = 'The ingest after this scrape changed nothing, so no projection was queued for it'
# last_error is raw exception text: only these fixed sentences leave the API.
FAILURES = (('lease expired', 'The worker stopped before the scrape finished'),
            ('unified scraper unreachable', 'The scraper could not be reached'),
            ('unified scraper rejected', 'The scraper rejected the request'),
            ('unified scraper returned', 'The scraper returned an error'),
            ('scrape jobs need', 'The job has no search query or URL'))


def as_utc(value: Optional[datetime]) -> Optional[datetime]:
    if value is None:
        return None
    return (value if value.tzinfo else value.replace(tzinfo=timezone.utc)).astimezone(timezone.utc)


def iso(value: Optional[datetime]) -> Optional[str]:
    return as_utc(value).isoformat().replace('+00:00', 'Z') if value is not None else None


def failure(job) -> str:
    return next((text for needle, text in FAILURES if needle in (job['last_error'] or '')), 'The scrape failed')


def step(key: str, state: str, started=None, finished=None, detail: Optional[str] = None) -> Dict[str, Any]:
    return {'key': key, 'label': LABELS[key], 'state': state, 'started_at': as_utc(started),
            'finished_at': as_utc(finished), 'detail': detail}


def follow_up_step(key: str, job, what: str) -> Dict[str, Any]:
    """A follow-up job that has not succeeded: queued or running is the current step, dead is failed."""
    if job['status'] == 'queued':
        return step(key, 'running', job['created_at'], detail='Queued for a worker' if not job['attempts'] else
                    f'Waiting to retry after attempt {job["attempts"]} of {job["max_attempts"]}')
    if job['status'] == 'running':
        return step(key, 'running', job['started_at'])
    return step(key, 'failed', job['started_at'], job['finished_at'], f'The {what} failed; earlier data is kept')


async def follow_ups(conn, pairs: List[Tuple[str, str]]) -> Dict[str, Any]:
    """Follow-up jobs by (kind, idempotency key) through the unique index, not the paged job list."""
    rows = await conn.fetch("""
        SELECT * FROM ingestion_jobs
        WHERE (kind, idempotency_key) IN (SELECT * FROM unnest($1::text[], $2::text[]))""",
                            [kind for kind, _ in pairs], [key for _, key in pairs])
    return {row['kind']: row for row in rows}


async def not_ingested(conn, job) -> int:
    """Bronze playlists from this scrape's source, written while it ran, that no ingest has taken to silver yet."""
    source = (decode(job['payload']) or {}).get('source', '1001tracklists')
    return await conn.fetchval("""
        SELECT count(*) FROM bronze_scraped_playlists b
        LEFT JOIN silver_enriched_playlists p ON p.bronze_id = b.id AND p.enrichment_metadata->>'ingested_by' = $4
        WHERE b.source = $1 AND b.scraped_at::timestamptz BETWEEN $2 AND $3 AND p.id IS NULL""",
                               source, job['started_at'], job['finished_at'], INGEST_MARKER)


async def fetch_scrape_progress(job_id: str, since: Optional[datetime]) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    """The unified scraper's live record for this attempt, or (None, why not)."""
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            response = await client.get(f'{SCRAPER_URL.rstrip("/")}/scrape/progress/{job_id}')
        if response.status_code == 404:
            return None, NO_RECORD
        response.raise_for_status()
        data = response.json()
        started, updated = (as_utc(datetime.fromisoformat(data[k])) for k in ('started_at', 'updated_at'))
        progress = {'pages': int(data['pages']), 'playlists': int(data['playlists']), 'tracks': int(data['tracks']),
                    'updated_at': updated}
    except (httpx.HTTPError, ValueError, KeyError, TypeError):
        return None, NO_ANSWER
    if since is not None and started < as_utc(since):
        return None, NO_RECORD  # an earlier attempt's record; this attempt has not reached the scraper yet
    return progress, None


def final_counts(result: Dict[str, Any], record: Optional[Dict[str, Any]], finished) -> Optional[Dict[str, Any]]:
    """The counts of a finished scrape: bronze rows from the job result, pages from the scraper's record while it keeps
    it (in memory, its last 200 runs). Pages is None once that record is gone."""
    rec = record or {}
    if not rec and 'bronze_playlists' not in result and 'bronze_tracks' not in result:
        return None
    return {'pages': rec.get('pages'), 'playlists': int(result.get('bronze_playlists', rec.get('playlists')) or 0),
            'tracks': int(result.get('bronze_tracks', rec.get('tracks')) or 0),
            'updated_at': as_utc(finished) or rec.get('updated_at')}


def after_scrape(result, ingest_job, projections, waiting: int, backlog: int) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    """Ingest and projection steps for a succeeded scrape."""
    if ingest_job is not None and ingest_job['status'] != 'succeeded':
        ingest = follow_up_step('ingest', ingest_job, 'ingest')
        return ingest, step('projection', 'waiting', detail=UPSTREAM_FAILED if ingest['state'] == 'failed' else None)
    span = (ingest_job['started_at'], ingest_job['finished_at']) if ingest_job is not None else (None, None)
    if projections:
        pending = [j for s in ('dead', 'running', 'queued') for j in projections if j['status'] == s]
        return step('ingest', 'done', *span), (follow_up_step('projection', pending[0], 'graph projection') if pending else
                                               step('projection', 'done', min(j['started_at'] for j in projections),
                                                    max(j['finished_at'] for j in projections)))
    # No projection follow-up: the ingest after this scrape changed nothing (a recurring run may have taken the rows).
    if result.get('found_nothing'):
        return step('ingest', 'done', *span, 'Nothing to ingest'), step('projection', 'done', detail='Nothing to project')
    if waiting:
        return (step('ingest', 'waiting', detail='Some playlists from this scrape are still waiting for ingest'
                     if ingest_job is not None else 'No ingest is recorded for this scrape'), step('projection', 'waiting'))
    ingest = step('ingest', 'done', *span, 'Already ingested by a recurring ingest run')
    if backlog:
        return ingest, step('projection', 'waiting', detail=f'{NO_PROJECTION}; the recurring projection has events left')
    return ingest, step('projection', 'done', detail=f'{NO_PROJECTION}; the recurring projection is up to date')


@router.get('/api/v1/jobs/{job_id}/stages')
@domain_errors
async def job_stages(job_id: str):
    """Every stage of one scrape job, from the job rows, the scraper's live progress and the follow-up jobs."""
    uid = job_uuid(job_id)
    async with get_pool().acquire() as conn:
        job = await domain.get_job(conn, uid)
        if job['kind'] != 'scrape':
            raise HTTPException(status_code=422, detail='Stages are reported for scrape jobs only')
        status, result = job['status'], decode(job['result']) or {}
        if status == 'succeeded':
            ingest_job = (await follow_ups(conn, [('ingest_pending', f'ingest-after-scrape:{uid}')])).get('ingest_pending')
            projections, waiting, backlog = [], 0, 0
            if ingest_job is not None and ingest_job['status'] == 'succeeded':
                projections = list((await follow_ups(conn, [
                    ('projection_consume', f'proj-after-ingest:{ingest_job["id"]}'),
                    ('graph_projection_consume', f'graph-proj-after-ingest:{ingest_job["id"]}')])).values())
            if not projections and not result.get('found_nothing') and (ingest_job is None or ingest_job['status'] == 'succeeded'):
                waiting = await not_ingested(conn, job)
                backlog = sum([await outbox.backlog(conn, c) for c in (projection.CONSUMER, graph_projection.CONSUMER)])
    progress, why = await fetch_scrape_progress(str(uid), job['started_at']) if status in ('running', 'succeeded') else (None, None)
    if status == 'succeeded':
        progress, why = final_counts(result, progress, job['finished_at']), None

    if status == 'queued':
        queued = step('queued', 'running', job['created_at'], detail=(
            f'Waiting to retry: {failure(job).lower()} on attempt {job["attempts"]} of {job["max_attempts"]}'
            if job['attempts'] else 'Waiting for a worker'))
        scrape = step('scrape', 'waiting')
    else:
        queued = step('queued', 'done', job['created_at'], job['started_at'])
        if status == 'running':
            scrape = step('scrape', 'running', job['started_at'], detail=why)
        elif status == 'dead':
            scrape = step('scrape', 'failed', job['started_at'], job['finished_at'],
                          f'{failure(job)} ({job["attempts"]} of {job["max_attempts"]} attempts used)')
        else:
            scrape = step('scrape', 'done', job['started_at'], job['finished_at'],
                          'The scraper found no playlists or tracks' if result.get('found_nothing') else None)
    scrape['progress'] = progress
    if status == 'succeeded':
        ingest, proj = after_scrape(result, ingest_job, projections, waiting, backlog)
    else:
        detail = UPSTREAM_FAILED if status == 'dead' else None
        ingest, proj = step('ingest', 'waiting', detail=detail), step('projection', 'waiting', detail=detail)

    stages = [queued, scrape, ingest, proj]
    moments = [m for s in stages for m in (s['started_at'], s['finished_at'])] + [progress and progress['updated_at']]
    for s in stages:
        s['started_at'], s['finished_at'] = iso(s['started_at']), iso(s['finished_at'])
    if progress:
        progress['updated_at'] = iso(progress['updated_at'])
    return {'job_id': str(uid), 'kind': job['kind'], 'stages': stages,
            'last_progress_at': iso(max((m for m in moments if m), default=None))}
