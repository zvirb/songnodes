"""Celery application. Celery supplies scheduling and process management; the durable queue is `ingestion_jobs`.

`songnodes.drain` claims runnable jobs from Postgres (SKIP LOCKED, leased) and runs their handlers, so it is safe to
run any number of workers and a crashed worker's jobs are reclaimed when the lease expires. `songnodes.schedule`
enqueues the recurring jobs with time-bucketed idempotency keys, so overlapping beats never double-enqueue.
"""
import asyncio
import logging
import os
import sys
import time
from pathlib import Path

import asyncpg
from celery import Celery

sys.path.insert(0, '/app')
from common.datalayer import jobs, runner  # noqa: E402
from common.datalayer.handlers import Context  # noqa: E402
from common.providers.registry import build_providers  # noqa: E402

logger = logging.getLogger('songnodes.worker')
HEARTBEAT = Path(os.getenv('WORKER_HEARTBEAT', '/tmp/worker-heartbeat'))
POLL_SECONDS = float(os.getenv('JOB_POLL_SECONDS', '5'))
SCHEDULE_SECONDS = float(os.getenv('SCHEDULE_SECONDS', '30'))
INGEST_INTERVAL = int(os.getenv('INGEST_INTERVAL_SECONDS', '60'))
PROJECTION_INTERVAL = int(os.getenv('PROJECTION_INTERVAL_SECONDS', '15'))
MAX_JOBS_PER_DRAIN = int(os.getenv('MAX_JOBS_PER_DRAIN', '25'))

app = Celery('songnodes', broker=os.getenv('CELERY_BROKER_URL', 'amqp://guest:guest@rabbitmq:5672//'))
app.conf.update(
    task_acks_late=True, task_reject_on_worker_lost=True, worker_prefetch_multiplier=1,
    broker_connection_retry_on_startup=True, timezone='UTC', enable_utc=True, task_ignore_result=True,
    beat_schedule={
        'drain-jobs': {'task': 'songnodes.drain', 'schedule': POLL_SECONDS, 'options': {'expires': max(POLL_SECONDS * 3, 15)}},
        'schedule-recurring': {'task': 'songnodes.schedule', 'schedule': SCHEDULE_SECONDS, 'options': {'expires': SCHEDULE_SECONDS * 3}},
    },
)


def dsn() -> str:
    url = os.getenv('DATABASE_URL')
    if not url:
        from common.secrets_manager import get_database_url
        url = get_database_url(async_driver=False)
    return url.replace('postgresql+asyncpg://', 'postgresql://', 1)


def touch_heartbeat() -> None:
    try:
        HEARTBEAT.touch()
    except OSError:  # a read-only filesystem must not stop job processing
        logger.warning('could not write heartbeat file %s', HEARTBEAT)


async def drain_async(max_jobs: int):
    connection = await asyncpg.connect(dsn())
    providers = build_providers()
    try:
        outcomes = await runner.run_until_idle(connection, Context(providers=lambda: providers), max_jobs=max_jobs)
    finally:
        for provider in providers:
            await provider.aclose()
        await connection.close()
    return [{k: v for k, v in outcome.items() if k != 'result'} for outcome in outcomes]


async def schedule_async() -> int:
    connection = await asyncpg.connect(dsn())
    now = int(time.time())
    created = 0
    try:
        for kind, interval, payload in (('projection_consume', PROJECTION_INTERVAL, {}), ('ingest_pending', INGEST_INTERVAL, {})):
            _, was_created = await jobs.enqueue(connection, kind, f'tick:{kind}:{now // interval}', payload)
            created += int(was_created)
        await jobs.prune(connection, int(os.getenv('JOB_RETENTION_DAYS', '14')))
    finally:
        await connection.close()
    return created


@app.task(name='songnodes.drain')
def drain(max_jobs: int = MAX_JOBS_PER_DRAIN):
    touch_heartbeat()
    outcomes = asyncio.run(drain_async(max_jobs))
    for outcome in outcomes:
        logger.info('job %s %s -> %s', outcome['kind'], outcome['job_id'], outcome['status'])
    return len(outcomes)


@app.task(name='songnodes.schedule')
def schedule():
    touch_heartbeat()
    return asyncio.run(schedule_async())
