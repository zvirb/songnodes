"""End-to-end integration test for the Celery worker.

Tests job submission via REST API, worker execution, data pipeline flow,
and status polling with robust cleanup on success or failure.

Run: pytest tests/integration/test_worker_e2e.py
"""
import subprocess
import time
import unittest
from uuid import uuid4

from hygiene import remove_orphans, started_at
from test_dev_workflows import ROOT, request, sql


def service_running(service):
    """True if the dev Compose stack runs this service; False without Docker."""
    try:
        out = subprocess.run(
            ['docker', 'compose', '-f', 'compose.dev.yaml', 'ps', '--status', 'running', '--format', '{{.Service}}', service],
            cwd=ROOT, capture_output=True
        )
    except FileNotFoundError:
        return False
    return service.encode() in out.stdout


def worker_running():
    return service_running('worker')


def scraper_running():
    return service_running('unified-scraper')


def poll_until(predicate, timeout=10.0, interval=0.1, description="condition"):
    """Polls predicate every `interval` seconds until it returns truthy or `timeout` is reached."""
    deadline = time.time() + timeout
    last_val = None
    while time.time() < deadline:
        last_val = predicate()
        if last_val:
            return last_val
        time.sleep(interval)
    raise TimeoutError(f"Timed out after {timeout}s waiting for {description}. Last state: {last_val}")


def wait_for_job(job_id, states, timeout=10.0, interval=0.1):
    def check():
        status, job = request(8082, f'/api/v1/jobs/{job_id}')
        if status == 200 and job.get('status') in states:
            return job
        return None

    return poll_until(check, timeout=timeout, interval=interval, description=f"job {job_id} to reach {states}")


class TestWorkerE2EPolling(unittest.TestCase):
    """Unit tests for the polling helper mechanism itself."""

    def test_poll_until_success(self):
        counter = [0]

        def cond():
            counter[0] += 1
            return counter[0] >= 3

        result = poll_until(cond, timeout=1.0, interval=0.01, description="counter >= 3")
        self.assertTrue(result)
        self.assertEqual(counter[0], 3)

    def test_poll_until_timeout(self):
        with self.assertRaises(TimeoutError):
            poll_until(lambda: False, timeout=0.05, interval=0.01, description="always false")


@unittest.skipUnless(worker_running(), 'worker container is not running')
class WorkerEndToEnd(unittest.TestCase):
    def setUp(self):
        self.marker = uuid4().hex[:12]
        self.spawned_jobs = set()
        started = started_at(sql)
        self.addCleanup(lambda: remove_orphans(sql, started))
        self.addCleanup(self.cleanup)

    def cleanup(self):
        """Clean up spawned test tasks and synthetic DB records on test completion or failure."""
        m = f'%{self.marker}%'

        # Cancel or cleanup any spawned job records created during test
        for job_id in list(self.spawned_jobs):
            try:
                request(8082, f'/api/v1/jobs/{job_id}', 'DELETE')
            except Exception:
                pass

        # 1) Emit deleted events so live worker can detach synthetic graph projection nodes cleanly
        try:
            sql(f"""BEGIN;
                INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, payload)
                SELECT 'track', id, 'deleted', '{{"_marker": "{self.marker}"}}'::jsonb FROM silver_enriched_tracks
                WHERE track_title LIKE '{m}' OR artist_name LIKE '{m}';
                COMMIT;""")
        except Exception:
            pass

        # 2) Poll until worker processes deletion events (timeout after 10s, 0.1s interval)
        try:
            def outbox_drained():
                cnt = sql(f"SELECT count(*) FROM outbox_events WHERE payload::text LIKE '{m}' AND seq > COALESCE((SELECT head FROM outbox_consumers WHERE consumer = 'graph_projection'), 0)").strip()
                return cnt == '0'

            poll_until(outbox_drained, timeout=10.0, interval=0.1, description="outbox deletion events drained")
        except Exception:
            pass

        # 3) Remove source rows first
        try:
            sql(f"""BEGIN;
                DELETE FROM ingestion_jobs WHERE payload::text LIKE '{m}' OR idempotency_key LIKE '{m}'
                    OR idempotency_key ~ '^(backfill-after-ingest|backfill-next|proj-after-ingest|proj-after-backfill|ingest-next|ingest-after-scrape):';
                DELETE FROM silver_enriched_playlists WHERE playlist_name LIKE '{m}';
                DELETE FROM silver_enriched_tracks WHERE track_title LIKE '{m}' OR artist_name LIKE '{m}';
                DELETE FROM silver_enriched_artists WHERE canonical_name LIKE '{m}';
                DELETE FROM bronze_scraped_tracks WHERE source_url LIKE '{m}';
                DELETE FROM bronze_scraped_playlists WHERE source_url LIKE '{m}';
                COMMIT;""")
        except Exception:
            pass

        # 4) Remove derived rows and events
        try:
            sql(f"""BEGIN;
                DELETE FROM silver_track_transitions WHERE playlist_occurrences::text LIKE '{m}';
                DELETE FROM projection_tracks WHERE track_title LIKE '{m}' OR artist_name LIKE '{m}';
                DELETE FROM outbox_events WHERE payload::text LIKE '{m}';
                COMMIT;""")
        except Exception:
            pass

    def test_worker_runs_jobs_submitted_over_rest(self):
        status, queued = request(8082, '/api/v1/jobs', 'POST', {'kind': 'projection_reconcile', 'payload': {'repair': False, 'note': self.marker}})
        self.assertEqual(status, 202, queued)
        job_id = queued['job_id']
        self.spawned_jobs.add(job_id)

        job = wait_for_job(job_id, {'succeeded', 'dead'}, timeout=10.0, interval=0.1)
        self.assertEqual((job['status'], job['attempts']), ('succeeded', 1), job)
        self.assertTrue(set(job['result']) >= {'missing', 'extra', 'stale'}, job)

    @unittest.skipIf(scraper_running(), 'a scraper is running: this test would start a real scrape against external sites')
    def test_scrape_trigger_is_retried_by_the_worker_when_the_scraper_is_unreachable(self):
        status, queued = request(8082, f'/api/v1/scrape/trigger?source=mixesdb&search_query=Marker%20{self.marker}', 'POST')
        self.assertEqual(status, 202, queued)
        job_id = queued['job_id']
        self.spawned_jobs.add(job_id)

        def check_scrape_job():
            st, res = request(8082, f'/api/v1/jobs/{job_id}')
            if st == 200 and res.get('attempts', 0) >= 1 and res.get('last_error'):
                return res
            return None

        job = poll_until(check_scrape_job, timeout=10.0, interval=0.1, description=f"scrape job {job_id} failure record")
        self.assertEqual(job['status'], 'queued', job)
        self.assertIn('unified scraper unreachable', job['last_error'])
        self.assertEqual(job['payload']['search_query'], f'Marker {self.marker}')

    def test_bronze_playlist_flows_to_silver_transitions_and_the_projection(self):
        playlist, artist = str(uuid4()), f'Flow Artist {self.marker}'
        url = f'https://example.invalid/{self.marker}/flow'
        sql(f"""BEGIN;
            INSERT INTO bronze_scraped_playlists (id, source, source_url, source_playlist_id, scraper_version, raw_json, playlist_name, artist_name)
            VALUES ('{playlist}', 'fixture', '{url}', 'flow', 'test', '{{}}', 'Flow Set {self.marker}', 'Flow DJ {self.marker}');
            INSERT INTO bronze_scraped_tracks (source, source_url, source_track_id, scraper_version, raw_json, artist_name, track_title, playlist_id, position)
            VALUES ('fixture', '{url}', 'f1', 'test', '{{"bpm": 128, "key": "A minor"}}', '{artist}', 'Flow One {self.marker}', '{playlist}', 1),
                   ('fixture', '{url}', 'f2', 'test', '{{}}', '{artist}', 'Flow Two {self.marker}', '{playlist}', 2),
                   ('fixture', '{url}', 'f3', 'test', '{{}}', '{artist}', 'Flow Three {self.marker}', '{playlist}', 3);
            COMMIT;""")

        status, queued = request(8082, '/api/v1/jobs', 'POST', {'kind': 'ingest_pending', 'payload': {'limit': 25, 'note': self.marker}})
        self.assertEqual(status, 202, queued)
        job_id = queued['job_id']
        self.spawned_jobs.add(job_id)

        job = wait_for_job(job_id, {'succeeded', 'dead'}, timeout=10.0, interval=0.1)
        self.assertEqual(job['status'], 'succeeded', job)
        self.assertGreaterEqual(job['result']['playlists']['ingested'], 1)

        edges = sql(f"""SELECT a.track_title || '>' || b.track_title || ':' || x.occurrence_count FROM silver_track_transitions x
                        JOIN silver_enriched_tracks a ON a.id = x.from_track_id JOIN silver_enriched_tracks b ON b.id = x.to_track_id
                        WHERE a.track_title LIKE '%{self.marker}' ORDER BY 1""").split('\n')
        self.assertEqual([e.replace(f' {self.marker}', '') for e in edges if e], ['Flow One>Flow Two:1', 'Flow Two>Flow Three:1'])

        def projection_caught_up():
            projected = sql(f"SELECT count(*) FROM projection_tracks WHERE track_title LIKE '%{self.marker}'").strip()
            graph_drained = sql(f"SELECT count(*) FROM outbox_events WHERE payload::text LIKE '%{self.marker}%' AND seq > COALESCE((SELECT head FROM outbox_consumers WHERE consumer = 'graph_projection'), 0)").strip() == '0'
            if projected == '3' and graph_drained:
                return True
            return False

        poll_until(projection_caught_up, timeout=10.0, interval=0.1, description="projection consumer catch-up")

        one = sql(f"SELECT bpm || '|' || camelot_key FROM projection_tracks WHERE track_title = 'Flow One {self.marker}'").strip()
        self.assertEqual(one, '128.00|8A', 'scraped BPM/key flow through evidence into the projection')

        status, again_data = request(8082, '/api/v1/jobs', 'POST', {'kind': 'ingest_pending', 'payload': {'limit': 25, 'note': self.marker, 'again': True}})
        self.assertEqual(status, 202, again_data)
        again_id = again_data['job_id']
        self.spawned_jobs.add(again_id)

        rerun = wait_for_job(again_id, {'succeeded', 'dead'}, timeout=10.0, interval=0.1)
        self.assertTrue(rerun['result']['playlists']['examined'] >= 0)
        self.assertEqual(sql(f"SELECT count(*) FROM silver_enriched_tracks WHERE track_title LIKE '%{self.marker}'").strip(), '3')


if __name__ == '__main__':
    unittest.main()
