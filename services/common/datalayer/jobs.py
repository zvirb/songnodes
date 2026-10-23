"""Durable ingestion job records (domain logic, independent of HTTP handlers).

States: queued -> running -> succeeded, or back to queued with backoff until
`max_attempts` is exhausted, then dead (the dead-letter state, revivable by `retry_dead`).
Workers claim with FOR UPDATE SKIP LOCKED; a running job whose lease expires is reclaimed,
or marked dead when it has no attempts left. Submissions are deduplicated by
(kind, idempotency_key), so a retried request returns the original job.
"""
import json
from typing import Any, Dict, List, Optional, Tuple
from uuid import UUID

from .errors import CatalogError

MAX_BACKOFF_SECONDS = 3600
DEFAULT_LEASE_SECONDS = 300


async def enqueue(conn, kind: str, idempotency_key: str, payload: Dict[str, Any],
                  max_attempts: int = 3) -> Tuple[Any, bool]:
    """Return (job, created); created is False when the key was already submitted."""
    row = await conn.fetchrow("""
        INSERT INTO ingestion_jobs (kind, idempotency_key, payload, max_attempts)
        VALUES ($1, $2, $3::jsonb, $4)
        ON CONFLICT (kind, idempotency_key) DO NOTHING RETURNING *
    """, kind, idempotency_key, json.dumps(payload), max_attempts)
    if row is not None:
        return row, True
    return await conn.fetchrow(
        'SELECT * FROM ingestion_jobs WHERE kind = $1 AND idempotency_key = $2', kind, idempotency_key), False


async def claim_next(conn, kinds: Optional[List[str]] = None, lease_seconds: int = DEFAULT_LEASE_SECONDS):
    """Claim the next runnable job, or return None. Each claim consumes one attempt."""
    async with conn.transaction():
        await conn.execute("""
            UPDATE ingestion_jobs SET status = 'dead', finished_at = NOW(), updated_at = NOW(),
                   last_error = COALESCE(last_error, 'lease expired with no attempts left')
            WHERE status = 'running' AND attempts >= max_attempts
              AND started_at < NOW() - make_interval(secs => $1)
        """, float(lease_seconds))
        return await conn.fetchrow("""
            WITH next AS (
                SELECT id FROM ingestion_jobs
                WHERE ($1::text[] IS NULL OR kind = ANY($1))
                  AND ((status = 'queued' AND run_after <= NOW())
                       OR (status = 'running' AND started_at < NOW() - make_interval(secs => $2)))
                ORDER BY run_after, created_at
                FOR UPDATE SKIP LOCKED LIMIT 1)
            UPDATE ingestion_jobs j
            SET status = 'running', attempts = j.attempts + 1, started_at = NOW(), updated_at = NOW()
            FROM next WHERE j.id = next.id RETURNING j.*
        """, kinds, float(lease_seconds))


async def complete(conn, job_id: UUID, result: Optional[Dict[str, Any]] = None):
    row = await conn.fetchrow("""
        UPDATE ingestion_jobs SET status = 'succeeded', result = $2::jsonb, finished_at = NOW(),
               updated_at = NOW(), last_error = NULL
        WHERE id = $1 AND status = 'running' RETURNING *
    """, job_id, json.dumps(result) if result is not None else None)
    if row is None:
        raise CatalogError(409, 'Job is not running')
    return row


async def fail(conn, job_id: UUID, error: str, backoff_seconds: float = 30):
    """Re-queue with exponential backoff, or dead-letter once the attempt budget is spent."""
    row = await conn.fetchrow("""
        UPDATE ingestion_jobs SET
            status = CASE WHEN attempts >= max_attempts THEN 'dead' ELSE 'queued' END,
            run_after = CASE WHEN attempts >= max_attempts THEN run_after ELSE NOW() +
                make_interval(secs => LEAST($3::float8 * power(2, attempts - 1), $4::float8)) END,
            finished_at = CASE WHEN attempts >= max_attempts THEN NOW() END,
            last_error = $2, updated_at = NOW()
        WHERE id = $1 AND status = 'running' RETURNING *
    """, job_id, error[:2000], float(backoff_seconds), float(MAX_BACKOFF_SECONDS))
    if row is None:
        raise CatalogError(409, 'Job is not running')
    return row


async def retry_dead(conn, job_id: UUID):
    """Give a dead-lettered job a fresh attempt budget."""
    row = await conn.fetchrow("""
        UPDATE ingestion_jobs SET status = 'queued', attempts = 0, run_after = NOW(), finished_at = NULL,
               updated_at = NOW()
        WHERE id = $1 AND status = 'dead' RETURNING *
    """, job_id)
    if row is not None:
        return row
    exists = await conn.fetchval('SELECT EXISTS(SELECT 1 FROM ingestion_jobs WHERE id = $1)', job_id)
    raise CatalogError(409 if exists else 404, 'Only a dead job can be retried' if exists else 'Job not found')


async def get_job(conn, job_id: UUID):
    row = await conn.fetchrow('SELECT * FROM ingestion_jobs WHERE id = $1', job_id)
    if row is None:
        raise CatalogError(404, 'Job not found')
    return row


async def list_jobs(conn, status: Optional[str], kind: Optional[str], limit: int, offset: int):
    return await conn.fetch("""
        SELECT * FROM ingestion_jobs
        WHERE ($1::text IS NULL OR status = $1) AND ($2::text IS NULL OR kind = $2)
        ORDER BY created_at DESC, id LIMIT $3 OFFSET $4
    """, status, kind, limit, offset)
