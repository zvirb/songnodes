"""Job submission and status endpoints; claim/complete/fail belong to workers, not HTTP."""
import json
from datetime import datetime
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
    created_at: datetime
    updated_at: datetime


def decode(value):
    return json.loads(value) if isinstance(value, str) else value


def job_response(row) -> JobResponse:
    data = dict(row)
    data['job_id'] = data.pop('id')
    data['payload'] = decode(data['payload']) or {}
    data['result'] = decode(data['result'])
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


@router.get('/api/v1/jobs', response_model=List[JobResponse])
@domain_errors
async def list_jobs(status: Optional[str] = Query(None), kind: Optional[str] = Query(None),
                    limit: int = Query(50, ge=1, le=200), offset: int = Query(0, ge=0)):
    if status is not None and status not in STATUSES:
        raise HTTPException(status_code=422, detail=f'status must be one of {", ".join(STATUSES)}')
    async with get_pool().acquire() as conn:
        return [job_response(row) for row in await domain.list_jobs(conn, status, kind, limit, offset)]


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
