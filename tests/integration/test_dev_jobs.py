"""Database-backed tests for ingestion jobs and the silver track preview endpoint.

Run: python -m unittest discover -s tests/integration -p test_dev_jobs.py -v
Synthetic rows carry a per-test marker and are removed afterwards. Queue semantics run
inside the rest-api container because Postgres is not published to the host.
"""
import subprocess
import textwrap
from uuid import uuid4
import unittest

from hygiene import remove_orphans, started_at
from test_dev_workflows import ROOT, request, sql

QUEUE_SCENARIO = textwrap.dedent('''
    import asyncio, os, sys
    import asyncpg
    from common.datalayer import jobs
    from common.datalayer.errors import CatalogError

    KIND = sys.argv[1]

    async def main():
        conn = await asyncpg.connect(os.environ['DATABASE_URL'])
        first, created = await jobs.enqueue(conn, KIND, 'k1', {'n': 1})
        again, created_again = await jobs.enqueue(conn, KIND, 'k1', {'n': 2})
        assert created and not created_again and first['id'] == again['id'], 'idempotent enqueue'
        assert (await conn.fetchval('SELECT payload->>\\'n\\' FROM ingestion_jobs WHERE id = $1', first['id'])) == '1'

        claimed = await jobs.claim_next(conn, [KIND])
        assert claimed['id'] == first['id'] and claimed['status'] == 'running' and claimed['attempts'] == 1
        assert await jobs.claim_next(conn, [KIND]) is None, 'running job is not claimable twice'

        failed = await jobs.fail(conn, first['id'], 'boom', backoff_seconds=0)
        assert failed['status'] == 'queued' and failed['last_error'] == 'boom'
        claimed = await jobs.claim_next(conn, [KIND])
        assert claimed['attempts'] == 2
        delayed = await jobs.fail(conn, first['id'], 'slow', backoff_seconds=3600)
        assert delayed['status'] == 'queued'
        assert await conn.fetchval('SELECT run_after > NOW() + interval \\'30 minutes\\' FROM ingestion_jobs WHERE id = $1',
                                   first['id']), 'backoff delays the next attempt'
        assert await jobs.claim_next(conn, [KIND]) is None, 'not claimable before run_after'

        await conn.execute('UPDATE ingestion_jobs SET run_after = NOW() WHERE id = $1', first['id'])
        claimed = await jobs.claim_next(conn, [KIND])
        assert claimed['attempts'] == 3
        dead = await jobs.fail(conn, first['id'], 'final', backoff_seconds=0)
        assert dead['status'] == 'dead' and dead['finished_at'] is not None, 'dead-letter after max attempts'
        assert await jobs.claim_next(conn, [KIND]) is None

        revived = await jobs.retry_dead(conn, first['id'])
        assert revived['status'] == 'queued' and revived['attempts'] == 0
        claimed = await jobs.claim_next(conn, [KIND])
        done = await jobs.complete(conn, claimed['id'], {'tracks': 3})
        assert done['status'] == 'succeeded' and done['last_error'] is None
        for call in (jobs.complete(conn, first['id']), jobs.fail(conn, first['id'], 'late'), jobs.retry_dead(conn, first['id'])):
            try:
                await call
            except CatalogError as error:
                assert error.status == 409
            else:
                raise AssertionError('finished job must reject further transitions')

        lease, _ = await jobs.enqueue(conn, KIND, 'lease', {})
        await jobs.claim_next(conn, [KIND])
        await conn.execute("UPDATE ingestion_jobs SET started_at = NOW() - interval '1 hour' WHERE id = $1", lease['id'])
        reclaimed = await jobs.claim_next(conn, [KIND], lease_seconds=60)
        assert reclaimed['id'] == lease['id'] and reclaimed['attempts'] == 2, 'expired lease is reclaimed'

        spent, _ = await jobs.enqueue(conn, KIND, 'spent', {}, max_attempts=1)
        await jobs.claim_next(conn, [KIND])
        await conn.execute("UPDATE ingestion_jobs SET started_at = NOW() - interval '1 hour' WHERE id = $1", spent['id'])
        assert await jobs.claim_next(conn, [KIND], lease_seconds=60) is None
        assert await conn.fetchval('SELECT status FROM ingestion_jobs WHERE id = $1', spent['id']) == 'dead'

        # A scrape is one long synchronous call: its lease is 30 minutes, so a 10-minute-old claim is NOT reclaimed,
        # while an ordinary job (5-minute lease) claimed at the same time is.
        slow, _ = await jobs.enqueue(conn, 'scrape', f'{KIND}-slow', {'search_query': 'x y'})
        fast, _ = await jobs.enqueue(conn, KIND, 'fast', {})
        await jobs.claim_next(conn, ['scrape', KIND])
        await jobs.claim_next(conn, ['scrape', KIND])
        await conn.execute("UPDATE ingestion_jobs SET started_at = NOW() - interval '10 minutes' WHERE id = ANY($1::uuid[])", [slow['id'], fast['id']])
        again = await jobs.claim_next(conn, ['scrape', KIND])
        assert again is not None and again['id'] == fast['id'], 'only the ordinary job is reclaimed'
        assert await conn.fetchval('SELECT status FROM ingestion_jobs WHERE id = $1', slow['id']) == 'running'
        await conn.execute("UPDATE ingestion_jobs SET started_at = NOW() - interval '40 minutes' WHERE id = $1", slow['id'])
        reclaimed = await jobs.claim_next(conn, ['scrape'])
        assert reclaimed is not None and reclaimed['id'] == slow['id'], 'a scrape past its own lease is reclaimed'
        perm, _ = await jobs.enqueue(conn, KIND, 'perm', {}, max_attempts=5)
        claimed = await jobs.claim_next(conn, [KIND])
        assert claimed['id'] == perm['id']
        assert (await jobs.fail(conn, perm['id'], 'invalid', permanent=True))['status'] == 'dead'
        await conn.execute("DELETE FROM ingestion_jobs WHERE id = $1", slow['id'])
        await conn.execute('DELETE FROM ingestion_jobs WHERE kind = $1', KIND)
        for n in range(5):
            await jobs.enqueue(conn, KIND, f'c{n}', {})
        pool = [await asyncpg.connect(os.environ['DATABASE_URL']) for _ in range(5)]
        got = await asyncio.gather(*(jobs.claim_next(c, [KIND]) for c in pool))
        ids = {row['id'] for row in got if row}
        assert len(ids) == 5, f'concurrent claims must not overlap: {len(ids)}'
        for c in pool:
            await c.close()
        await conn.close()
        print('QUEUE-OK')

    asyncio.run(main())
''')


class IngestionJobs(unittest.TestCase):
    def setUp(self):
        self.marker = uuid4().hex[:12]
        started = started_at(sql)
        self.addCleanup(lambda: remove_orphans(sql, started))   # registered first, so it runs last
        self.addCleanup(lambda: sql(f"DELETE FROM ingestion_jobs WHERE payload::text LIKE '%{self.marker}%' "
                                    f"OR kind LIKE '%{self.marker}%'"))
        self.addCleanup(lambda: sql(f"DELETE FROM silver_enriched_tracks WHERE track_title LIKE '%{self.marker}%'"))

    def trigger(self, **params):
        query = '&'.join(f'{key}={value}' for key, value in {'source': f'test-{self.marker}', **params}.items())
        return request(8082, f'/api/v1/scrape/trigger?{query}', 'POST')

    def test_trigger_records_a_real_queued_job_instead_of_a_placeholder(self):
        status, data = self.trigger(search_query='Synthetic%20Artist%20Track')
        self.assertEqual((status, data['status'], data['created']), (202, 'queued', True), data)
        self.assertNotEqual(data['job_id'], 'scrape_12345')
        status, job = request(8082, f"/api/v1/jobs/{data['job_id']}")
        self.assertEqual(status, 200, job)
        self.assertEqual((job['kind'], job['status'], job['attempts'], job['max_attempts']), ('scrape', 'queued', 0, 3))
        self.assertEqual(job['payload'], {'source': f'test-{self.marker}', 'search_query': 'Synthetic Artist Track'})
        listed = request(8082, '/api/v1/jobs?status=queued&kind=scrape&limit=200')[1]
        self.assertIn(data['job_id'], [j['job_id'] for j in listed])
        self.assertNotIn(data['job_id'], [j['job_id'] for j in request(8082, '/api/v1/jobs?status=dead')[1]])
        other = self.trigger(search_query='Synthetic%20Artist%20Track')[1]
        self.assertNotEqual(other['job_id'], data['job_id'], 'no key means a new job each time')

    def test_same_idempotency_key_returns_the_original_job(self):
        from urllib.request import Request, urlopen
        import json

        def post(key):
            req = Request(f'http://127.0.0.1:8082/api/v1/scrape/trigger?source=test-{self.marker}', method='POST',
                          headers={'Idempotency-Key': key})
            with urlopen(req, timeout=15) as response:
                return json.loads(response.read())

        first, second = post(f'key-{self.marker}'), post(f'key-{self.marker}')
        self.assertEqual((first['created'], second['created']), (True, False))
        self.assertEqual(first['job_id'], second['job_id'])
        count = sql(f"SELECT count(*) FROM ingestion_jobs WHERE idempotency_key = 'key-{self.marker}'").strip()
        self.assertEqual(count, '1')

    def test_job_endpoints_validate_input_and_reject_invalid_retries(self):
        job_id = self.trigger()[1]['job_id']
        self.assertEqual(request(8082, '/api/v1/jobs?status=bogus')[0], 422)
        self.assertEqual(request(8082, '/api/v1/jobs/not-a-uuid')[0], 422)
        self.assertEqual(request(8082, f'/api/v1/jobs/{uuid4()}')[0], 404)
        self.assertEqual(request(8082, f'/api/v1/jobs/{job_id}/retry', 'POST')[0], 409)
        self.assertEqual(request(8082, f'/api/v1/jobs/{uuid4()}/retry', 'POST')[0], 404)
        sql(f"UPDATE ingestion_jobs SET status = 'dead', attempts = 3, last_error = 'x' WHERE id = '{job_id}'")
        status, revived = request(8082, f'/api/v1/jobs/{job_id}/retry', 'POST')
        self.assertEqual((status, revived['status'], revived['attempts']), (200, 'queued', 0))

    def test_queue_claims_retries_dead_letters_and_leases_on_real_postgres(self):
        kind = f'queue-{self.marker}'
        result = subprocess.run(
            ['docker', 'compose', '-f', 'compose.dev.yaml', 'exec', '-T', 'rest-api', 'python', '-', kind],
            cwd=ROOT, input=QUEUE_SCENARIO.encode(), capture_output=True)
        self.assertEqual(result.returncode, 0, result.stderr.decode()[-2000:])
        self.assertIn('QUEUE-OK', result.stdout.decode())

    def test_preview_reads_silver_and_never_invents_a_preview_url(self):
        track_id = str(uuid4())
        sql(f"""INSERT INTO silver_enriched_tracks (id, artist_name, track_title, spotify_id, validation_status,
                    enrichment_metadata)
                VALUES ('{track_id}', 'Preview Artist {self.marker}', 'Preview {self.marker}', 'sp-{self.marker}', 'valid',
                        '{{"tidal_id": "td-{self.marker}"}}')""")
        for identifier in (track_id, f'song_{track_id}', f'sp-{self.marker}'):
            status, data = request(8082, f'/api/v1/tracks/{identifier}/preview')
            self.assertEqual(status, 200, data)
            self.assertEqual(data['track_id'], track_id)
            self.assertIsNone(data['preview_url'])
            self.assertEqual(data['streaming_options'], {'spotify_id': f'sp-{self.marker}',
                                                          'tidal_id': f'td-{self.marker}', 'apple_music_id': None})
        self.assertEqual(request(8082, f'/api/v1/tracks/{uuid4()}/preview')[0], 404)


if __name__ == '__main__':
    unittest.main()
