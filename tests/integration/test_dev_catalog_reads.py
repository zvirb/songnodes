"""Database-backed catalog contract tests; all fixtures are explicitly synthetic."""
from urllib.parse import urlencode
from uuid import uuid4
import unittest

from test_dev_workflows import request, sql


class CatalogReads(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.ids = {key: str(uuid4()) for key in ['t1', 't2', 'a1', 'a2', 'p1', 'p2',
                                                'bt1', 'bt2', 'ba1', 'ba2', 'bp1']}
        cls.marker = str(uuid4())
        cls.name = f'Björk Catalog Fixture {cls.marker}'
        cls.title = f'Catalog {cls.marker} 50%_literal'
        cls.addClassCleanup(cls.cleanup)
        v = cls.ids
        sql(f"""BEGIN;
            INSERT INTO bronze_scraped_tracks (id, source, source_url, source_track_id, scraper_version, raw_json)
            VALUES ('{v['bt1']}', 'fixture-a', 'https://example.invalid/{cls.marker}/a', 'provider:one', 'test', '{{}}'),
                   ('{v['bt2']}', 'fixture-b', 'https://example.invalid/{cls.marker}/b', 'provider:two', 'test', '{{}}');
            INSERT INTO bronze_scraped_artists (id, source, source_artist_id, scraper_version, raw_json, artist_name)
            VALUES ('{v['ba1']}', 'fixture-a', '{cls.marker}a', 'test', '{{}}', '{cls.name}'),
                   ('{v['ba2']}', 'fixture-b', '{cls.marker}b', 'test', '{{}}', '{cls.name}');
            INSERT INTO silver_enriched_artists
                (id, bronze_ids, canonical_name, normalized_name, aliases, validation_status, enrichment_metadata)
            VALUES ('{v['a1']}', ARRAY['{v['ba1']}'::uuid, '{v['ba2']}'::uuid], '{cls.name}', lower('{cls.name}'),
                    ARRAY['Alias {cls.marker}'], 'valid', '{{}}'),
                   ('{v['a2']}', '{{}}', 'Unattributed {cls.marker}', 'unattributed {cls.marker}', NULL, 'valid', '{{}}');
            INSERT INTO silver_enriched_tracks
                (id, bronze_id, additional_bronze_ids, artist_name, track_title, bpm, energy, genre, duration_ms,
                 release_date, validation_status, enrichment_metadata)
            VALUES ('{v['t1']}', '{v['bt1']}', ARRAY['{v['bt2']}'::uuid], '{cls.name}', '{cls.title}',
                    240, 0, ARRAY['House', 'Techno'], 210500, '2024-01-02', 'valid', '{{}}'),
                   ('{v['t2']}', NULL, NULL, '{cls.name}', 'Manual {cls.marker}', NULL, NULL, NULL, NULL, NULL, 'valid', '{{}}');
            INSERT INTO bronze_scraped_playlists (id, source, source_url, scraper_version, raw_json)
            VALUES ('{v['bp1']}', 'fixture-a', 'https://example.invalid/{cls.marker}/set', 'test', '{{}}');
            INSERT INTO silver_enriched_playlists
                (id, bronze_id, playlist_name, artist_id, artist_name, track_count, total_duration_ms, validation_status, enrichment_metadata)
            VALUES ('{v['p1']}', '{v['bp1']}', 'Ordered Fixture {cls.marker}', '{v['a1']}', '{cls.name}', 5, NULL, 'valid', '{{}}'),
                   ('{v['p2']}', NULL, 'Empty Fixture {cls.marker}', NULL, 'Unattributed', 0, 0, 'valid', '{{}}');
            INSERT INTO silver_playlist_tracks (playlist_id, track_id, position, cue_time_ms)
            VALUES ('{v['p1']}', '{v['t1']}', 1, 0), ('{v['p1']}', '{v['t2']}', 4, 210500),
                   ('{v['p1']}', '{v['t1']}', 7, NULL);
            COMMIT;""")

    @classmethod
    def cleanup(cls):
        v = cls.ids
        sql(f"""BEGIN;
            DELETE FROM silver_enriched_playlists WHERE id IN ('{v['p1']}', '{v['p2']}');
            DELETE FROM silver_enriched_tracks WHERE id IN ('{v['t1']}', '{v['t2']}');
            DELETE FROM silver_enriched_artists WHERE id IN ('{v['a1']}', '{v['a2']}');
            DELETE FROM bronze_scraped_playlists WHERE id = '{v['bp1']}';
            DELETE FROM bronze_scraped_tracks WHERE id IN ('{v['bt1']}', '{v['bt2']}');
            DELETE FROM bronze_scraped_artists WHERE id IN ('{v['ba1']}', '{v['ba2']}');
            COMMIT;""")

    def get(self, path):
        status, data = request(8082, path)
        self.assertEqual(status, 200, data)
        return data

    def test_stored_json_metadata_matches_graph_detail_and_ordered_sets(self):
        import json
        v = self.ids
        stored = json.dumps({'camelot_key': {'value': '8A'}, 'energy_scale': 'legacy_0_1',
                             'tidal_id': 12345, 'deezer_id': '67890',
                             'label': 'Fixture Records', 'mix_name': 'Extended',
                             'bpm': 128, 'energy': 0.9, 'duration_ms': 180000})
        try:
            sql(f"UPDATE silver_enriched_tracks SET enrichment_metadata = '{stored}'::jsonb WHERE id IN ('{v['t1']}', '{v['t2']}')")
            known = self.get('/api/tracks/' + v['t1'])
            unknown = self.get('/api/tracks/' + v['t2'])
            expected = {'camelot_key': '8A', 'energy_scale': 'legacy_0_1',
                        'tidal_id': '12345', 'deezer_id': '67890',
                        'record_label': 'Fixture Records', 'mix_name': 'Extended',
                        'bpm': 240, 'energy': 0, 'duration_ms': 210500, 'duration': 210.5}
            for key, value in expected.items():
                self.assertEqual(known[key], value, key)
            for key in ['bpm', 'energy', 'duration_ms', 'key']:
                self.assertIsNone(unknown[key], key)  # Explicit silver NULL beats stale JSON.
            for route in ['/api/graph/data', '/api/graph', '/api/v1/graph',
                          f"/api/graph/neighborhood/song_{v['t1']}"]:
                status, graph = request(8084, route)
                self.assertEqual(status, 200, graph)
                graph = graph.get('data', graph)
                node = next(n for n in graph['nodes'] if n['id'] == 'song_' + v['t1'])
                for key, value in expected.items():
                    self.assertEqual(node['metadata'][key], value, (route, key))
                self.assertNotEqual(node['metadata']['label'], 'Fixture Records')
            entries = self.get('/api/v1/setlists/' + v['p1'] + '/tracks')
            for key, value in expected.items():
                self.assertEqual(entries[0]['track'][key], value, key)
        finally:
            sql(f"UPDATE silver_enriched_tracks SET enrichment_metadata = '{{}}'::jsonb WHERE id IN ('{v['t1']}', '{v['t2']}')")

    def test_track_identity_units_and_primary_and_additional_provenance(self):
        for route in ['/api/tracks/', '/api/v1/tracks/']:
            for prefix in ['', 'song_']:
                row = self.get(route + prefix + self.ids['t1'])
                self.assertEqual(row['id'], self.ids['t1'])
                self.assertEqual(row['song_id'], row['track_id'])
                self.assertEqual(row['source_track_id'], 'provider:one')
                self.assertEqual(row['bpm'], 240)  # Valid silver value outside scraper's 60–200 rule.
                self.assertEqual(row['energy'], 0)
                self.assertEqual(row['duration_ms'], 210500)
                self.assertEqual(row['duration'], 210.5)
                self.assertEqual(row['release_date'], '2024-01-02')
                self.assertEqual(row['genres'], ['House', 'Techno'])
                self.assertEqual(row['data_layer'], 'silver')
                self.assertEqual(row['data_source'], 'fixture-a')
                self.assertEqual(row['data_sources'], ['fixture-a', 'fixture-b'])
                self.assertTrue(row['source_url'].endswith('/a'))

    def test_unknown_metadata_is_not_filled_with_invented_values(self):
        row = self.get('/api/tracks/' + self.ids['t2'])
        for field in ['bpm', 'energy', 'duration_ms', 'duration', 'release_date', 'genres',
                      'data_source', 'source_url', 'scrape_timestamp']:
            self.assertIsNone(row[field], field)
        self.assertEqual(row['data_sources'], [])

    def test_track_filters_and_pagination(self):
        params = {'artist_id': self.ids['a1'], 'min_bpm': 230, 'max_bpm': 250}
        rows = self.get('/api/v1/tracks?' + urlencode(params))
        self.assertEqual([row['id'] for row in rows], [self.ids['t1']])
        page = self.get('/api/v1/tracks?' + urlencode({'artist_id': self.ids['a1'], 'limit': 1, 'offset': 1}))
        self.assertEqual(len(page), 1)
        self.assertEqual(self.get('/api/v1/tracks?limit=1&offset=1000000'), [])

    def test_track_search_preserves_literal_wildcards(self):
        rows = self.get('/api/search/tracks?' + urlencode({'query': self.title}))
        self.assertEqual([row['id'] for row in rows], [self.ids['t1']])
        rows = self.get('/api/search/tracks?' + urlencode({'query': f"{self.marker}' OR 1=1 --"}))
        self.assertEqual(rows, [])

    def test_artist_reads_and_alias_search_preserve_sources(self):
        row = self.get('/api/v1/artists/' + self.ids['a1'])
        self.assertEqual(row['artist_name'], self.name)
        self.assertEqual(row['track_count'], 2)
        self.assertIsNone(row['data_source'])  # There is no unique primary provider.
        self.assertEqual(row['data_sources'], ['fixture-a', 'fixture-b'])
        listed = self.get('/api/v1/artists')
        self.assertTrue(any(item['artist_id'] == self.ids['a1'] for item in listed))
        rows = self.get('/api/v1/artists/search?' + urlencode({'query': f'Alias {self.marker}'}))
        self.assertEqual([item['artist_id'] for item in rows], [self.ids['a1']])
        self.assertGreater(rows[0]['match_score'], 0)
        unknown = self.get('/api/v1/artists/' + self.ids['a2'])
        self.assertIsNone(unknown['scrape_timestamp'])
        self.assertEqual(unknown['data_sources'], [])

    def test_setlist_aliases_filters_and_declared_counts(self):
        for route in ['/api/v1/setlists', '/api/v1/playlists']:
            rows = self.get(route + '?' + urlencode({'dj_id': self.ids['a1'], 'source': 'fixture-a'}))
            self.assertEqual([row['playlist_id'] for row in rows], [self.ids['p1']])
            self.assertEqual(rows[0]['total_tracks'], 3)
            self.assertEqual(rows[0]['declared_track_count'], 5)
            self.assertIsNone(rows[0]['duration_minutes'])
            self.assertEqual(self.get(route + '?source=no-such-provider'), [])

    def test_ordered_setlist_retains_repeats_gaps_and_unknown_cue_times(self):
        detail = self.get('/api/v1/setlists/' + self.ids['p1'])
        alias = self.get('/api/v1/playlists/' + self.ids['p1'])
        self.assertEqual(detail, alias)
        tracks = self.get('/api/v1/setlists/' + self.ids['p1'] + '/tracks')
        self.assertEqual(detail['tracks'], tracks)
        direct = self.get('/api/tracks/' + self.ids['t1'])
        self.assertEqual(tracks[0]['track'], direct)
        self.assertEqual([entry['position'] for entry in tracks], [1, 4, 7])
        self.assertEqual([entry['track_id'] for entry in tracks], [self.ids['t1'], self.ids['t2'], self.ids['t1']])
        self.assertEqual([entry['cue_time_ms'] for entry in tracks], [0, 210500, None])

    def test_empty_setlist_is_not_missing(self):
        row = self.get('/api/v1/setlists/' + self.ids['p2'])
        self.assertEqual(row['tracks'], [])
        self.assertEqual(row['duration_minutes'], 0)
        self.assertIsNone(row['data_source'])
        self.assertEqual(request(8082, '/api/v1/setlists/' + str(uuid4()))[0], 404)

    def test_invalid_queries_and_missing_records_keep_correct_status(self):
        for path in ['/api/v1/tracks?limit=0', '/api/v1/artists?offset=-1',
                     '/api/v1/tracks?min_bpm=250&max_bpm=100', '/api/v1/tracks?artist_id=invalid',
                     '/api/search/tracks?query=%20', '/api/v1/artists/search?query=%20',
                     '/api/v1/setlists?dj_id=invalid', '/api/tracks/not-a-uuid']:
            self.assertEqual(request(8082, path)[0], 422, path)
        self.assertEqual(request(8082, '/api/tracks/' + str(uuid4()))[0], 404)
        self.assertEqual(request(8082, '/api/v1/artists/' + str(uuid4()))[0], 404)
