"""JT1: a job's finish time is when it finished, not when its handler's transaction began.

The runner claims a job in one transaction, then runs the handler and `jobs.complete` together in a second one, so
NOW() in `complete` is the handler's start (job 09543085, 2 Nov 2026: a 3.5-minute scrape "finished" 35 ms after it
started). The database tests run against a throwaway PostgreSQL when JOBS_TEST_DATABASE_URL is set, for example
`docker run --rm -d -p 55432:5432 -e POSTGRES_PASSWORD=x postgres:18-alpine` and
`JOBS_TEST_DATABASE_URL=postgresql://postgres:x@127.0.0.1:55432/postgres`; each test uses its own schema.
"""
import asyncio
import os
import re
import unittest
from pathlib import Path
from unittest.mock import AsyncMock
from uuid import uuid4

from common.datalayer import handlers, jobs, runner

DSN = os.getenv('JOBS_TEST_DATABASE_URL')
MIGRATION = Path(__file__).resolve().parents[3] / 'sql' / 'migrations' / '013_ingestion_jobs_up.sql'
HANDLER_SECONDS = 0.4


class TestFinishTimeSql(unittest.IsolatedAsyncioTestCase):
    """Without a database: the statements use the wall clock and leave an interrupted job without a finish time."""

    async def test_complete_and_fail_stamp_the_wall_clock(self):
        conn = AsyncMock()
        await jobs.complete(conn, uuid4(), {})
        await jobs.fail(conn, uuid4(), 'boom')
        for call in conn.fetchrow.call_args_list:
            sql = call.args[0]
            self.assertIn('finished_at', sql)
            self.assertNotRegex(sql, r'finished_at = (CASE .*? THEN )?NOW\(\)')
            self.assertIn('clock_timestamp()', sql)

    async def test_lease_expiry_leaves_finished_at_empty_and_says_why(self):
        conn = AsyncMock()
        conn.transaction = lambda: _NoTransaction()
        await jobs.claim_next(conn, ['scrape'])
        sql = conn.execute.call_args.args[0]
        self.assertRegex(sql, r"status = 'dead', finished_at = NULL")
        self.assertIn("'lease expired with no attempts left' || COALESCE('; previous error: ' || last_error, '')", sql)


class _NoTransaction:
    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False


@unittest.skipUnless(DSN, 'set JOBS_TEST_DATABASE_URL to a throwaway PostgreSQL to run the database tests')
class TestFinishTimeOnPostgres(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        import asyncpg
        self.schema = f'jt1_{uuid4().hex[:12]}'
        self.conn = await asyncpg.connect(DSN)
        await self.conn.execute(f'CREATE SCHEMA {self.schema}; SET search_path TO {self.schema}, public')
        await self.conn.execute(re.sub(r'^\s*(BEGIN|COMMIT);\s*$', '', MIGRATION.read_text(encoding='utf-8'), flags=re.M))
        self.kind = f'jt1_slow_{uuid4().hex[:6]}'

        async def slow(conn, ctx, payload):
            await asyncio.sleep(HANDLER_SECONDS)
            return {'slept': HANDLER_SECONDS}
        handlers.HANDLERS[self.kind] = slow

    async def asyncTearDown(self):
        handlers.HANDLERS.pop(self.kind, None)
        await self.conn.execute(f'DROP SCHEMA {self.schema} CASCADE')
        await self.conn.close()

    async def test_a_slow_job_finishes_when_its_handler_returns(self):
        job, _ = await jobs.enqueue(self.conn, self.kind, 'k1', {})
        outcome = await runner.run_one(self.conn, handlers.Context(), [self.kind])
        self.assertEqual(outcome['status'], 'succeeded')
        row = await self.conn.fetchrow('SELECT started_at, finished_at FROM ingestion_jobs WHERE id = $1', job['id'])
        self.assertGreaterEqual((row['finished_at'] - row['started_at']).total_seconds(), HANDLER_SECONDS)

    async def test_a_failed_attempt_is_stamped_when_it_fails(self):
        async def slow_failure(conn, ctx, payload):
            await asyncio.sleep(HANDLER_SECONDS)
            raise ValueError('nope')
        handlers.HANDLERS[self.kind] = slow_failure
        job, _ = await jobs.enqueue(self.conn, self.kind, 'k1', {}, max_attempts=1)
        outcome = await runner.run_one(self.conn, handlers.Context(), [self.kind])
        self.assertEqual(outcome['status'], 'dead')
        row = await self.conn.fetchrow('SELECT started_at, finished_at FROM ingestion_jobs WHERE id = $1', job['id'])
        self.assertGreaterEqual((row['finished_at'] - row['started_at']).total_seconds(), HANDLER_SECONDS)

    async def test_an_interrupted_job_is_dead_without_a_finish_time(self):
        job, _ = await jobs.enqueue(self.conn, self.kind, 'k1', {}, max_attempts=1)
        await self.conn.execute("""
            UPDATE ingestion_jobs SET status = 'running', attempts = 1, started_at = NOW() - interval '3 days',
                   last_error = 'Scrape request timeout' WHERE id = $1""", job['id'])
        self.assertIsNone(await jobs.claim_next(self.conn, [self.kind]))
        row = await self.conn.fetchrow('SELECT status, finished_at, last_error FROM ingestion_jobs WHERE id = $1', job['id'])
        self.assertEqual(row['status'], 'dead')
        self.assertIsNone(row['finished_at'])
        self.assertEqual(row['last_error'], 'lease expired with no attempts left; previous error: Scrape request timeout')


if __name__ == '__main__':
    unittest.main()
