"""Job submission and status endpoints; claim/complete/fail belong to workers, not HTTP."""
import json
import re
from datetime import date, datetime, time, timedelta
from typing import Any, Dict, List, Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, Header, HTTPException, Query
from pydantic import BaseModel, Field

from common.datalayer import jobs as domain
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
    """Record a scrape job. It stays queued until a worker claims it; none runs in the minimal stack.

    Send the same Idempotency-Key to retry safely; without one every call is a new job.
    """
    payload = {'source': source, **({'search_query': search_query.strip()} if search_query else {})}
    async with get_pool().acquire() as conn:
        row, created = await domain.enqueue(conn, 'scrape', idempotency_key or str(uuid4()), payload)
    return {
        'status': row['status'], 'job_id': str(row['id']), 'source': source, 'created': created,
        'message': ('Job recorded and waiting for a worker; no worker runs in the minimal development stack.'
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
