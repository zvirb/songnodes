"""HTTP tests for the data-layer operations endpoints (jobs, review queue, merges, canonical ids, outbox status).

Run: python -m unittest discover -s tests/integration -p test_dev_datalayer_api.py -v
Synthetic rows carry a per-test marker and are removed afterwards.
"""
from uuid import uuid4
import json
import unittest

from test_dev_workflows import request, sql


class DataLayerApi(unittest.TestCase):
    def setUp(self):
        self.marker = uuid4().hex[:12]
        self.addCleanup(self.cleanup)

    def cleanup(self):
        m = f'%{self.marker}%'
        sql(f"""BEGIN;
            DELETE FROM outbox_events WHERE payload::text LIKE '{m}'
                OR aggregate_id IN (SELECT id FROM silver_enriched_tracks WHERE track_title LIKE '{m}' OR artist_name LIKE '{m}')
                OR aggregate_id IN (SELECT id FROM silver_enriched_artists WHERE canonical_name LIKE '{m}')
                OR aggregate_id IN (SELECT duplicate_id FROM entity_merge_history WHERE snapshot::text LIKE '{m}');
            DELETE FROM entity_redirects WHERE history_id IN (SELECT id FROM entity_merge_history WHERE snapshot::text LIKE '{m}');
            DELETE FROM entity_merge_history WHERE snapshot::text LIKE '{m}';
            DELETE FROM ingestion_jobs WHERE payload::text LIKE '{m}' OR idempotency_key LIKE '{m}';
            DELETE FROM silver_enriched_tracks WHERE track_title LIKE '{m}' OR artist_name LIKE '{m}';
            DELETE FROM silver_enriched_artists WHERE canonical_name LIKE '{m}';
            COMMIT;""")

    def new_track(self, label, artist=None):
        status, data = request(8082, '/api/v1/tracks', 'POST', {
            'track_name': f'{label} {self.marker}', 'artist_name': artist or f'Merge Artist {self.marker}', 'data_source': 'spotify'})
        self.assertEqual(status, 201, data)
        return data['song_id']

    def test_job_enqueue_validates_kind_and_payload_and_honours_idempotency(self):
        post = lambda body, key=None: request(8082, '/api/v1/jobs', 'POST', body)  # noqa: E731
        self.assertEqual(post({'kind': 'scrape'})[0], 422, 'scrape goes through /scrape/trigger')
        self.assertEqual(post({'kind': 'drop_database'})[0], 422)
        self.assertEqual(post({'kind': 'enrich_track', 'payload': {'track_id': 'nope'}})[0], 422)
        from urllib.request import Request, urlopen
        def submit(key):
            req = Request('http://127.0.0.1:8082/api/v1/jobs', method='POST', headers={'Content-Type': 'application/json', 'Idempotency-Key': key},
                          data=json.dumps({'kind': 'camelot_repair', 'payload': {'limit': 5, 'note': self.marker}}).encode())
            with urlopen(req, timeout=15) as response:
                return response.status, json.loads(response.read())
        (s1, a), (s2, b) = submit(f'key-{self.marker}'), submit(f'key-{self.marker}')
        self.assertEqual((s1, s2, a['created'], b['created'], a['job_id'] == b['job_id']), (202, 202, True, False, True))
        self.assertEqual(request(8082, f"/api/v1/jobs/{a['job_id']}")[1]['status'], 'queued')

    def test_track_merge_redirect_and_revert_over_http(self):
        survivor, duplicate = self.new_track('survivor'), self.new_track('duplicate')
        status, merged = request(8082, f'/api/v1/tracks/{survivor}/merge', 'POST', {'duplicate_id': duplicate, 'reason': f'dupe {self.marker}'})
        self.assertEqual(status, 200, merged)
        status, canonical = request(8082, f'/api/v1/tracks/{duplicate}/canonical')
        self.assertEqual((status, canonical['canonical'], canonical['redirected']), (200, survivor, True))
        self.assertFalse(request(8082, f'/api/v1/tracks/{survivor}/canonical')[1]['redirected'])
        self.assertEqual(request(8082, f'/api/v1/tracks/{uuid4()}/canonical')[0], 404)
        self.assertEqual(request(8082, f'/api/v1/tracks/{survivor}/merge', 'POST', {'duplicate_id': survivor})[0], 400)
        self.assertEqual(request(8082, f'/api/v1/tracks/{survivor}/merge', 'POST', {'duplicate_id': str(uuid4())})[0], 404)
        listed = request(8082, '/api/v1/merges?entity_type=track&limit=200')[1]
        entry = next(m for m in listed if m['id'] == merged['history_id'])
        self.assertEqual((entry['survivor_id'], entry['duplicate_id'], entry['reverted_at']), (survivor, duplicate, None))
        self.assertEqual(request(8082, f"/api/v1/merges/{merged['history_id']}/revert", 'POST')[0], 200)
        self.assertEqual(request(8082, f"/api/v1/merges/{merged['history_id']}/revert", 'POST')[0], 409)
        self.assertFalse(request(8082, f'/api/v1/tracks/{duplicate}/canonical')[1]['redirected'])
        self.assertEqual(request(8082, f'/api/v1/tracks/{duplicate}')[0], 200, 'the duplicate exists again')
        self.assertEqual(request(8082, '/api/v1/merges/999999999/revert', 'POST')[0], 404)

    def test_artist_merge_is_reversible_and_recorded(self):
        keep = request(8082, '/api/v1/artists', 'POST', {'artist_name': f'Keep {self.marker}', 'data_source': 'spotify'})[1]['artist_id']
        lose = request(8082, '/api/v1/artists', 'POST', {'artist_name': f'Lose {self.marker}', 'data_source': 'spotify', 'aliases': [f'Alias {self.marker}']})[1]['artist_id']
        track = self.new_track('artist merge', artist=f'Lose {self.marker}')
        status, merged = request(8082, f'/api/v1/artists/{lose}/merge', 'POST', {'new_name': f'Keep {self.marker}'})
        self.assertEqual((status, merged['tracks_moved']), (200, 1), merged)
        self.assertEqual(request(8082, f'/api/v1/tracks/{track}')[1]['artist_name'], f'Keep {self.marker}')
        self.assertEqual(request(8082, f'/api/v1/artists/{lose}')[0], 404)
        self.assertEqual(request(8082, f"/api/v1/merges/{merged['history_id']}/revert", 'POST')[0], 200)
        self.assertEqual(request(8082, f'/api/v1/tracks/{track}')[1]['artist_name'], f'Lose {self.marker}')
        restored = request(8082, f'/api/v1/artists/{lose}')[1]
        self.assertEqual((restored['name'], restored['aliases']), (f'Lose {self.marker}', [f'Alias {self.marker}']))
        self.assertEqual(request(8082, f'/api/v1/artists/{keep}')[1]['aliases'], None, 'survivor aliases return to their pre-merge value')
        # a name taken in the meantime blocks the revert instead of overwriting it
        second = request(8082, f'/api/v1/artists/{lose}/merge', 'POST', {'new_name': f'Keep {self.marker}'})[1]
        request(8082, '/api/v1/artists', 'POST', {'artist_name': f'Lose {self.marker}', 'data_source': 'spotify'})
        self.assertEqual(request(8082, f"/api/v1/merges/{second['history_id']}/revert", 'POST')[0], 409)

    def test_review_queue_lists_flagged_tracks_with_competing_evidence(self):
        track = self.new_track('flagged')
        sql(f"""INSERT INTO silver_track_metadata_evidence (track_id, field, value, source, independent_group)
                VALUES ('{track}', 'key', '"8A"', 'tidal', 'tidal'), ('{track}', 'key', '"9A"', 'deezer', 'deezer');
                UPDATE silver_enriched_tracks SET metadata_review = true, metadata_review_reasons = ARRAY['key_unresolved']
                WHERE id = '{track}'""")
        status, rows = request(8082, '/api/v1/metadata/review?reason=key_unresolved&limit=200')
        self.assertEqual(status, 200, rows)
        mine = [r for r in rows if r['track_id'] == track]
        self.assertEqual(len(mine), 1)
        self.assertEqual(mine[0]['reasons'], ['key_unresolved'])
        self.assertEqual({e['source'] for e in mine[0]['conflicts'][0]['evidence']}, {'tidal', 'deezer'})
        self.assertNotIn(track, [r['track_id'] for r in request(8082, '/api/v1/metadata/review?reason=isrc_conflict&limit=200')[1]])
        self.assertEqual(request(8082, '/api/v1/metadata/review?limit=0')[0], 422)

    def test_canonical_metadata_reaches_rest_and_graph_reads_identically(self):
        track = self.new_track('exposed')
        sql(f"""UPDATE silver_enriched_tracks SET camelot_key = '8A', record_label = 'Label {self.marker}', mix_name = 'Extended',
                    tidal_id = 'T1', deezer_id = 'D1', energy_canonical = 7.5, energy_source = 'manual_rating',
                    energy_calibrated = true, energy_contract_version = 'energy-1', metadata_review = true,
                    metadata_review_reasons = ARRAY['key_near'], energy = 0.3 WHERE id = '{track}'""")
        expected = {'camelot_key': '8A', 'record_label': f'Label {self.marker}', 'mix_name': 'Extended', 'tidal_id': 'T1',
                    'deezer_id': 'D1', 'energy_canonical': 7.5, 'energy_band': 'peak', 'energy_calibrated': True,
                    'energy_source': 'manual_rating', 'energy_contract_version': 'energy-1', 'metadata_review': True,
                    'metadata_review_reasons': ['key_near'], 'energy': 0.3}
        status, detail = request(8082, f'/api/v1/tracks/{track}')
        self.assertEqual(status, 200, detail)
        for key, value in expected.items():
            self.assertEqual(detail[key], value, f'REST {key}')
        status, graph = request(8084, '/api/graph/data')
        self.assertEqual(status, 200, graph)
        node = next(n for n in graph.get('data', graph)['nodes'] if n['id'] == f'song_{track}')
        for key, value in expected.items():
            self.assertEqual(node['metadata'][key], value, f'graph {key}')
        self.assertNotEqual(node['metadata']['label'], f'Label {self.marker}', 'display label stays distinct from the record label')
        # Legacy 0-1 energy is never relabelled as canonical, and uncalibrated or unknown energy has no band.
        sql(f"UPDATE silver_enriched_tracks SET energy_calibrated = false WHERE id = '{track}'")
        self.assertEqual(request(8082, f'/api/v1/tracks/{track}')[1]['energy_band'], None)
        sql(f"UPDATE silver_enriched_tracks SET energy_canonical = NULL, energy_source = NULL, energy_calibrated = NULL, energy_contract_version = NULL WHERE id = '{track}'")
        unknown = request(8082, f'/api/v1/tracks/{track}')[1]
        self.assertEqual((unknown['energy_canonical'], unknown['energy_band'], unknown['energy']), (None, None, 0.3))

    def test_outbox_status_and_attributions(self):
        self.new_track('outbox')
        status, body = request(8082, '/api/v1/outbox/status')
        self.assertEqual(status, 200, body)
        projection = next(c for c in body['consumers'] if c['consumer'] == 'projection_tracks')
        self.assertGreaterEqual(projection['backlog'], 1)
        self.assertEqual(set(body['projection']) >= {'missing', 'extra', 'stale', 'source_total', 'projection_total'}, True)
        self.assertEqual(request(8082, '/api/v1/projections/tracks/reconcile')[0], 405, 'reconcile is a POST')
        self.assertEqual(request(8082, '/api/v1/projections/tracks/reconcile', 'POST')[0], 200)
        self.assertEqual(request(8082, '/api/v1/attributions')[1], {'attributions': []}, 'GetSongBPM is disabled by default')


if __name__ == '__main__':
    unittest.main()
