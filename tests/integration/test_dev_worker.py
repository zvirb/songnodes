"""End-to-end through the running Celery worker: REST submits a job, the worker executes it, Postgres shows the result.

Run: python -m unittest discover -s tests/integration -p test_dev_worker.py -v
Skipped when the worker container is not running. All rows are synthetic, tagged with a per-test marker and removed.
"""
import json
import subprocess
import time
import unittest
from uuid import uuid4

from test_dev_workflows import ROOT, request, sql


def worker_running():
    out = subprocess.run(['docker', 'compose', '-f', 'compose.dev.yaml', 'ps', '--status', 'running', '--format', '{{.Service}}', 'worker'],
                         cwd=ROOT, capture_output=True)
    return b'worker' in out.stdout


def wait_for(job_id, states, timeout=60):
    deadline = time.time() + timeout
    while time.time() < deadline:
        status, job = request(8082, f'/api/v1/jobs/{job_id}')
        if status == 200 and job['status'] in states:
            return job
        time.sleep(1)
    raise AssertionError(f'job {job_id} did not reach {states} within {timeout}s: {job}')


@unittest.skipUnless(worker_running(), 'worker container is not running')
class WorkerEndToEnd(unittest.TestCase):
    def setUp(self):
        self.marker = uuid4().hex[:12]
        self.addCleanup(self.cleanup)

    def cleanup(self):
        m = f'%{self.marker}%'
        sql(f"""BEGIN;
            DELETE FROM outbox_events WHERE payload::text LIKE '{m}'
                OR aggregate_id IN (SELECT id FROM silver_enriched_tracks WHERE track_title LIKE '{m}')
                OR aggregate_id IN (SELECT id FROM silver_enriched_playlists WHERE playlist_name LIKE '{m}');
            DELETE FROM ingestion_jobs WHERE payload::text LIKE '{m}' OR idempotency_key LIKE '{m}'
                OR idempotency_key ~ '^(backfill-after-ingest|backfill-next|proj-after-ingest|proj-after-backfill|ingest-next|ingest-after-scrape):';
            DELETE FROM projection_tracks WHERE track_title LIKE '{m}';
            DELETE FROM silver_enriched_playlists WHERE playlist_name LIKE '{m}';
            DELETE FROM silver_enriched_tracks WHERE track_title LIKE '{m}' OR artist_name LIKE '{m}';
            DELETE FROM silver_enriched_artists WHERE canonical_name LIKE '{m}';
            DELETE FROM bronze_scraped_tracks WHERE source_url LIKE '{m}';
            DELETE FROM bronze_scraped_playlists WHERE source_url LIKE '{m}';
            COMMIT;""")

    def test_worker_runs_jobs_submitted_over_rest(self):
        status, queued = request(8082, '/api/v1/jobs', 'POST', {'kind': 'projection_reconcile', 'payload': {'repair': False, 'note': self.marker}})
        self.assertEqual(status, 202, queued)
        job = wait_for(queued['job_id'], {'succeeded', 'dead'})
        self.assertEqual((job['status'], job['attempts']), ('succeeded', 1), job)
        self.assertEqual(set(job['result']) >= {'missing', 'extra', 'stale'}, True)

    def test_scrape_trigger_is_retried_by_the_worker_when_the_scraper_is_unreachable(self):
        status, queued = request(8082, '/api/v1/scrape/trigger?source=mixesdb&search_query=' + f'Marker%20{self.marker}', 'POST')
        self.assertEqual(status, 202, queued)
        deadline, job = time.time() + 60, None
        while time.time() < deadline:
            job = request(8082, f"/api/v1/jobs/{queued['job_id']}")[1]
            if job['attempts'] >= 1 and job['last_error']:
                break
            time.sleep(1)
        # No unified scraper runs in the minimal stack: the failure is recorded, retried later, never reported as success.
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
        job = wait_for(queued['job_id'], {'succeeded', 'dead'})
        self.assertEqual(job['status'], 'succeeded', job)
        self.assertGreaterEqual(job['result']['playlists']['ingested'], 1)
        edges = sql(f"""SELECT a.track_title || '>' || b.track_title || ':' || x.occurrence_count FROM silver_track_transitions x
                        JOIN silver_enriched_tracks a ON a.id = x.from_track_id JOIN silver_enriched_tracks b ON b.id = x.to_track_id
                        WHERE a.track_title LIKE '%{self.marker}' ORDER BY 1""").split('\n')
        self.assertEqual([e.replace(f' {self.marker}', '') for e in edges if e], ['Flow One>Flow Two:1', 'Flow Two>Flow Three:1'])
        # The worker chains projection and enrichment follow-ups by itself.
        deadline = time.time() + 60
        projected = '0'
        while time.time() < deadline:
            projected = sql(f"SELECT count(*) FROM projection_tracks WHERE track_title LIKE '%{self.marker}'").strip()
            if projected == '3':
                break
            time.sleep(1)
        self.assertEqual(projected, '3', 'the projection consumer caught up through the chained job')
        one = sql(f"SELECT bpm || '|' || camelot_key FROM projection_tracks WHERE track_title = 'Flow One {self.marker}'").strip()
        self.assertEqual(one, '128.00|8A', 'scraped BPM/key flow through evidence into the projection')
        self.assertEqual(request(8082, f"/api/v1/jobs/{queued['job_id']}")[1]['status'], 'succeeded')
        # Re-running ingestion changes nothing.
        again = request(8082, '/api/v1/jobs', 'POST', {'kind': 'ingest_pending', 'payload': {'limit': 25, 'note': self.marker, 'again': True}})[1]
        rerun = wait_for(again['job_id'], {'succeeded', 'dead'})
        self.assertEqual(rerun['result']['playlists']['examined'] >= 0, True)
        self.assertEqual(sql(f"SELECT count(*) FROM silver_enriched_tracks WHERE track_title LIKE '%{self.marker}'").strip(), '3')


if __name__ == '__main__':
    unittest.main()
