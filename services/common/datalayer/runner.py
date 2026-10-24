"""Claim, execute and settle jobs. Used by the Celery worker and directly by tests.

A claim consumes one attempt (see `jobs.claim_next`); success completes the job, a failure re-queues it with
exponential backoff until the attempt budget is spent and it is dead-lettered. Follow-up jobs returned by a handler
are enqueued with their idempotency keys in the same transaction as the completion.
"""
import json
from typing import Any, Dict, List, Optional

from common.providers.base import ProviderUnavailable

from . import jobs
from .errors import CatalogError
from .handlers import HANDLERS, Context, RetryableError

BACKOFF_SECONDS = 30
TRANSIENT = (RetryableError, ProviderUnavailable)


def is_permanent(error: Exception) -> bool:
    """A request the handler or the service rejected as invalid never succeeds on retry (429 and 408 are the exceptions)."""
    return isinstance(error, CatalogError) and 400 <= error.status < 500 and error.status not in (408, 429)


async def run_one(conn, ctx: Context, kinds: Optional[List[str]] = None, lease_seconds: int = jobs.DEFAULT_LEASE_SECONDS) -> Optional[Dict[str, Any]]:
    """Run at most one runnable job. Returns a summary, or None when nothing was runnable."""
    kinds = kinds or sorted(HANDLERS)
    job = await jobs.claim_next(conn, kinds, lease_seconds)
    if job is None:
        return None
    outcome: Dict[str, Any] = {'job_id': str(job['id']), 'kind': job['kind'], 'attempt': job['attempts']}
    run = HANDLERS.get(job['kind'])
    try:
        if run is None:
            raise CatalogError(422, f"no handler for job kind {job['kind']!r}")
        payload = job['payload'] if isinstance(job['payload'], dict) else json.loads(job['payload'])
        async with conn.transaction():
            result = await run(conn, ctx, {**payload, 'job_id': str(job['id'])})
            follow_ups = result.pop('enqueue', []) if isinstance(result, dict) else []
            for item in follow_ups:
                await jobs.enqueue(conn, item['kind'], item['key'], item.get('payload') or {})
            await jobs.complete(conn, job['id'], result)
        outcome.update(status='succeeded', result=result, enqueued=[f['kind'] for f in follow_ups])
    except Exception as error:  # noqa: BLE001 - every handler failure goes through the retry/dead-letter policy
        final = await jobs.fail(conn, job['id'], f'{error.__class__.__name__}: {error}',
                                BACKOFF_SECONDS * (4 if isinstance(error, TRANSIENT) else 1), permanent=is_permanent(error))
        outcome.update(status=final['status'], error=str(error), transient=isinstance(error, TRANSIENT))
    return outcome


async def run_until_idle(conn, ctx: Context, kinds: Optional[List[str]] = None, max_jobs: int = 100) -> List[Dict[str, Any]]:
    done: List[Dict[str, Any]] = []
    for _ in range(max_jobs):
        outcome = await run_one(conn, ctx, kinds)
        if outcome is None:
            break
        done.append(outcome)
    return done
