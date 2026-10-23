"""Database-backed tests for silver catalog writes.

Run: python -m unittest discover -s tests/integration -p test_dev_catalog_writes.py -v
All records are synthetic, tagged with a per-run marker, and removed afterwards.
"""
from uuid import uuid4
import unittest

from test_dev_workflows import request, sql


def quote(value):
    return "'" + value.replace("'", "''") + "'"


class CatalogWrites(unittest.TestCase):
    def setUp(self):
        # One marker per test keeps counts independent of the other tests' synthetic rows.
        self.marker = uuid4().hex[:12]
        self.addCleanup(self.cleanup)

    def cleanup(self):
        m = f'%{self.marker}%'
        sql(f"""BEGIN;
            DELETE FROM outbox_events WHERE payload::text LIKE '{m}'
                OR aggregate_id IN (SELECT id FROM silver_enriched_tracks WHERE track_title LIKE '{m}' OR artist_name LIKE '{m}')
                OR aggregate_id IN (SELECT id FROM silver_enriched_artists WHERE canonical_name LIKE '{m}')
                OR aggregate_id IN (SELECT id FROM bronze_scraped_playlists WHERE raw_json::text LIKE '{m}');
            DELETE FROM entity_redirects WHERE history_id IN (SELECT id FROM entity_merge_history WHERE snapshot::text LIKE '{m}');
            DELETE FROM entity_merge_history WHERE snapshot::text LIKE '{m}';
            DELETE FROM silver_enriched_playlists WHERE playlist_name LIKE '{m}' OR artist_name LIKE '{m}'
                OR bronze_id IN (SELECT id FROM bronze_scraped_playlists WHERE raw_json::text LIKE '{m}');
            DELETE FROM silver_enriched_tracks WHERE track_title LIKE '{m}' OR artist_name LIKE '{m}';
            DELETE FROM silver_enriched_artists WHERE canonical_name LIKE '{m}';
            DELETE FROM bronze_scraped_tracks WHERE raw_json::text LIKE '{m}';
            DELETE FROM bronze_scraped_playlists WHERE raw_json::text LIKE '{m}';
            COMMIT;""")

    def name(self, label):
        return f'{label} {self.marker}'

    def artist(self, label, **extra):
        status, data = request(8082, '/api/v1/artists', 'POST',
                               {'artist_name': self.name(label), 'data_source': 'spotify', **extra})
        self.assertEqual(status, 201, data)
        return data['artist_id']

    def track_row(self, artist, title, validation='valid'):
        track_id = str(uuid4())
        sql(f"""INSERT INTO silver_enriched_tracks (id, artist_name, track_title, validation_status, enrichment_metadata)
                VALUES ('{track_id}', {quote(artist)}, {quote(title)}, '{validation}', '{{}}')""")
        return track_id

    def track_artist(self, track_id):
        return sql(f"SELECT artist_name FROM silver_enriched_tracks WHERE id = '{track_id}'").strip()

    def test_create_artist_persists_in_silver_and_rejects_generic_or_duplicate_names(self):
        artist_id = self.artist('Created', aliases=['Alias ' + self.marker], country='AU')
        status, data = request(8082, f'/api/v1/artists/{artist_id}')
        self.assertEqual((status, data['name'], data['track_count'], data['country']),
                         (200, self.name('Created'), 0, 'AU'))
        row = sql(f"SELECT validation_status, deduplication_strategy, enrichment_metadata->>'source' "
                  f"FROM silver_enriched_artists WHERE id = '{artist_id}'").strip()
        self.assertEqual(row, 'needs_review|manual|manual')
        self.assertEqual(request(8082, '/api/v1/artists', 'POST',
                                 {'artist_name': self.name('Created').upper(), 'data_source': 'spotify'})[0], 409)
        self.assertEqual(request(8082, '/api/v1/artists', 'POST',
                                 {'artist_name': 'Unknown Artist', 'data_source': 'spotify'})[0], 422)

    def test_rename_updates_tracks_and_keeps_old_name_as_alias(self):
        artist_id, other = self.artist('Rename Source'), self.artist('Rename Taken')
        track = self.track_row(self.name('Rename Source'), self.name('Rename Track'))
        status, data = request(8082, f'/api/v1/artists/{artist_id}/rename', 'POST',
                               {'new_name': self.name('Renamed')})
        self.assertEqual((status, data['name'], data['tracks_updated']), (200, self.name('Renamed'), 1))
        self.assertEqual(self.track_artist(track), self.name('Renamed'))
        aliases = request(8082, f'/api/v1/artists/{artist_id}')[1]['aliases']
        self.assertIn(self.name('Rename Source'), aliases)
        self.assertEqual(request(8082, f'/api/v1/artists/{artist_id}/rename', 'POST',
                                 {'new_name': self.name('Rename Taken')})[0], 409)
        self.assertEqual(request(8082, f'/api/v1/artists/{uuid4()}/rename', 'POST', {'new_name': 'Someone'})[0], 404)
        self.assertEqual(request(8082, '/api/v1/artists/not-a-uuid/rename', 'POST', {'new_name': 'Someone'})[0], 422)
        self.assertEqual(request(8082, f'/api/v1/artists/{other}/rename', 'POST', {'new_name': 'Various Artists'})[0], 422)

    def test_merge_moves_tracks_and_set_ownership_then_removes_duplicate(self):
        duplicate, target = self.artist('Merge Duplicate'), self.artist('Merge Target')
        track = self.track_row(self.name('Merge Duplicate'), self.name('Merge Track'))
        sql(f"""INSERT INTO silver_enriched_playlists (playlist_name, artist_id, artist_name, validation_status,
                    enrichment_metadata) VALUES ({quote(self.name('Merge Set'))}, '{duplicate}',
                    {quote(self.name('Merge Duplicate'))}, 'valid', '{{}}')""")
        status, data = request(8082, f'/api/v1/artists/{duplicate}/merge', 'POST', {'new_name': self.name('Merge Target')})
        self.assertEqual((status, data['tracks_moved'], data['merged_into']['artist_id']), (200, 1, target), data)
        self.assertEqual(self.track_artist(track), self.name('Merge Target'))
        self.assertEqual(request(8082, f'/api/v1/artists/{duplicate}')[0], 404)
        kept = request(8082, f'/api/v1/artists/{target}')[1]
        self.assertIn(self.name('Merge Duplicate'), kept['aliases'])
        owner = sql(f"SELECT artist_id FROM silver_enriched_playlists WHERE playlist_name = {quote(self.name('Merge Set'))}")
        self.assertEqual(owner.strip(), target)
        self.assertEqual(request(8082, f'/api/v1/artists/{target}/merge', 'POST', {'new_name': self.name('Merge Target')})[0], 400)
        self.assertEqual(request(8082, f'/api/v1/artists/{target}/merge', 'POST', {'new_name': self.name('Nobody')})[0], 404)

    def test_delete_refuses_artists_with_tracks_and_removes_unused_ones(self):
        used, unused = self.artist('Delete Used'), self.artist('Delete Unused')
        track = self.track_row(self.name('Delete Used'), self.name('Delete Track'))
        status, data = request(8082, f'/api/v1/artists/{used}', 'DELETE')
        self.assertEqual(status, 409, data)
        self.assertEqual(self.track_artist(track), self.name('Delete Used'))
        self.assertEqual(request(8082, f'/api/v1/artists/{unused}', 'DELETE')[0], 200)
        self.assertEqual(request(8082, f'/api/v1/artists/{unused}')[0], 404)
        self.assertEqual(request(8082, f'/api/v1/artists/{unused}', 'DELETE')[0], 404)

    def test_dirty_artists_report_suggestion_and_conflict(self):
        clean = self.artist('Dirty Clean')
        dirty = str(uuid4())
        sql(f"""INSERT INTO silver_enriched_artists (id, bronze_ids, canonical_name, normalized_name,
                    validation_status, enrichment_metadata)
                VALUES ('{dirty}', '{{}}', {quote('[12:34] ' + self.name('Dirty Clean'))},
                        {quote('[12:34] ' + self.name('dirty clean').lower())}, 'valid', '{{}}')""")
        status, data = request(8082, '/api/v1/artists/dirty?limit=500')
        self.assertEqual(status, 200, data)
        mine = [row for row in data if row['artist_id'] == dirty]
        self.assertEqual(len(mine), 1)
        self.assertEqual((mine[0]['suggested_clean_name'], mine[0]['pattern_type'], mine[0]['has_conflict']),
                         (self.name('Dirty Clean'), 'timestamp', True))
        self.assertNotIn(clean, [row['artist_id'] for row in data])

    def test_missing_artist_list_and_assignment(self):
        artist_id = self.artist('Assign Target')
        placeholder = self.track_row('Unknown Artist', self.name('Assign Orphan'))
        attributed = self.track_row(self.name('Assign Target'), self.name('Assign Attributed'))

        def missing():
            status, data = request(8082, '/api/v1/tracks/missing-artist?limit=500')
            self.assertEqual(status, 200, data)
            return [row['title'] for row in data]

        self.assertIn(self.name('Assign Orphan'), missing())
        self.assertNotIn(self.name('Assign Attributed'), missing())
        body = {'track_id': placeholder, 'artist_id': artist_id, 'role': 'featured'}
        self.assertEqual(request(8082, f'/api/v1/tracks/{placeholder}/assign-artist', 'POST', body)[0], 422)
        status, data = request(8082, f'/api/v1/tracks/{placeholder}/assign-artist', 'POST', {**body, 'role': 'primary'})
        self.assertEqual((status, data['success'], data['artist_id']), (200, True, artist_id), data)
        self.assertEqual(self.track_artist(placeholder), self.name('Assign Target'))
        self.assertNotIn(self.name('Assign Orphan'), missing())
        self.assertEqual(request(8082, f'/api/v1/tracks/{placeholder}/assign-artist', 'POST', {**body, 'role': 'primary'})[0], 409)
        self.assertEqual(request(8082, f'/api/v1/tracks/{attributed}/assign-artist', 'POST',
                                 {**body, 'track_id': attributed, 'role': 'primary'})[0], 409)
        self.assertEqual(request(8082, f'/api/v1/tracks/{uuid4()}/assign-artist', 'POST', {**body, 'role': 'primary'})[0], 404)

    def test_create_track_requires_artist_and_leaves_unknown_metadata_null(self):
        payload = {'track_name': self.name('Manual Track'), 'artist_name': self.name('Manual Artist'),
                   'data_source': 'spotify', 'genre': 'House'}
        status, data = request(8082, '/api/v1/tracks', 'POST', payload)
        self.assertEqual(status, 201, data)
        status, detail = request(8082, f"/api/v1/tracks/{data['song_id']}")
        self.assertEqual(status, 200, detail)
        self.assertEqual((detail['artist_name'], detail['genre']), (self.name('Manual Artist'), 'House'))
        self.assertTrue(all(detail[key] is None for key in ('bpm', 'key', 'energy', 'duration_ms', 'isrc')))
        row = sql(f"SELECT validation_status, enrichment_metadata->>'source' FROM silver_enriched_tracks "
                  f"WHERE id = '{data['song_id']}'").strip()
        self.assertEqual(row, 'needs_review|manual')
        self.assertEqual(request(8082, '/api/v1/tracks', 'POST', {**payload, 'artist_name': self.name('Manual Artist').upper(),
                                                                   'track_name': self.name('Manual Track').upper()})[0], 409)
        self.assertEqual(request(8082, '/api/v1/tracks', 'POST', {k: v for k, v in payload.items() if k != 'artist_name'})[0], 422)
        self.assertEqual(request(8082, '/api/v1/tracks', 'POST', {**payload, 'artist_name': 'Various Artists'})[0], 422)

    def transitions(self, *titles):
        names = ', '.join(quote(self.name(t)) for t in titles)
        out = sql(f"""SELECT a.track_title || '>' || b.track_title || ':' || x.occurrence_count
                      FROM silver_track_transitions x
                      JOIN silver_enriched_tracks a ON a.id = x.from_track_id
                      JOIN silver_enriched_tracks b ON b.id = x.to_track_id
                      WHERE a.track_title IN ({names}) AND b.track_title IN ({names}) ORDER BY 1""")
        return out.replace(f' {self.marker}', '').split()

    def entry(self, artist, title):
        return {'artist': self.name(artist), 'title': self.name(title)}

    def test_import_goes_through_bronze_with_positions_and_ordered_transitions(self):
        tracks = [self.entry('Imp Artist', 'One'), self.entry('Imp Artist', 'Two'), self.entry('Imp Other', 'Three')]
        status, data = request(8082, '/api/v1/tracks/import-tracklist', 'POST',
                               {'tracks': tracks, 'dj_artist': self.name('Imp DJ'), 'name': self.name('Imp Set')})
        self.assertEqual(status, 200, data)
        self.assertEqual((data['created'], data['updated'], data['failed'], data['transitions_created'], data['replayed']),
                         (3, 0, 0, 2, False))
        positions = sql(f"SELECT source_track_id FROM bronze_scraped_tracks WHERE raw_json::text LIKE '%{self.marker}%' "
                        f"ORDER BY source_track_id::int").split()
        self.assertEqual(positions, ['1', '2', '3'])
        lineage = sql(f"SELECT count(*) FROM silver_enriched_tracks t JOIN bronze_scraped_tracks b ON b.id = t.bronze_id "
                      f"WHERE t.track_title LIKE '%{self.marker}%'").strip()
        self.assertEqual(lineage, '3')
        self.assertEqual(self.transitions('One', 'Two', 'Three'), ['One>Two:1', 'Two>Three:1'])
        set_id = sql(f"SELECT id FROM silver_enriched_playlists WHERE playlist_name = {quote(self.name('Imp Set'))}").strip()
        status, entries = request(8082, f'/api/v1/setlists/{set_id}/tracks')
        self.assertEqual((status, [e['position'] for e in entries]), (200, [1, 2, 3]))
        self.assertEqual([e['track']['title'] for e in entries], [self.name(t) for t in ('One', 'Two', 'Three')])

        # Replaying the identical ordered list changes nothing (no duplicate records or transitions).
        status, replay = request(8082, '/api/v1/tracks/import-tracklist', 'POST',
                                 {'tracks': tracks, 'dj_artist': self.name('Imp DJ'), 'name': self.name('Imp Set')})
        self.assertEqual((status, replay['replayed'], replay['created'], replay['transitions_created']), (200, True, 0, 0))
        self.assertEqual(self.transitions('One', 'Two', 'Three'), ['One>Two:1', 'Two>Three:1'])
        count = sql(f"SELECT count(*) FROM silver_enriched_tracks WHERE track_title LIKE '%{self.marker}%'").strip()
        self.assertEqual(count, '3')

        # A different list that repeats a pair is a new occurrence and reuses existing tracks and artists.
        status, second = request(8082, '/api/v1/tracks/import-tracklist', 'POST', {'tracks': tracks[:2]})
        self.assertEqual((status, second['updated'], second['created'], second['replayed']), (200, 2, 0, False))
        self.assertEqual(self.transitions('One', 'Two', 'Three'), ['One>Two:2', 'Two>Three:1'])
        artists = sql(f"SELECT count(*) FROM silver_enriched_artists WHERE canonical_name LIKE '%{self.marker}%'").strip()
        self.assertEqual(artists, '3')  # Imp Artist, Imp Other, Imp DJ

    def test_import_skips_invalid_rows_without_bridging_the_gap(self):
        tracks = [self.entry('Gap Artist', 'Before'), {'artist': 'Unknown Artist', 'title': self.name('Gap Bad')},
                  self.entry('Gap Artist', 'After')]
        status, data = request(8082, '/api/v1/tracks/import-tracklist', 'POST', {'tracks': tracks})
        self.assertEqual(status, 200, data)
        self.assertEqual((data['created'], data['failed'], data['transitions_created']), (2, 1, 0))
        self.assertEqual([d['status'] for d in data['details']], ['failed', 'created', 'created'])
        self.assertEqual(self.transitions('Before', 'After'), [])
        positions = sql(f"SELECT source_track_id FROM bronze_scraped_tracks WHERE raw_json::text LIKE '%{self.marker}%' "
                        f"ORDER BY source_track_id::int").split()
        self.assertEqual(positions, ['1', '3'])  # original positions are preserved, not renumbered

    def test_import_resolves_artist_case_variants_to_one_canonical_artist(self):
        first = [self.entry('Case Artist', 'Alpha'), self.entry('Case Artist', 'Beta')]
        self.assertEqual(request(8082, '/api/v1/tracks/import-tracklist', 'POST', {'tracks': first})[0], 200)
        variant = {'artist': self.name('Case Artist').upper(), 'title': self.name('Gamma')}
        status, data = request(8082, '/api/v1/tracks/import-tracklist', 'POST', {'tracks': [first[1], variant]})
        self.assertEqual(status, 200, data)
        self.assertEqual(self.track_artist(data['details'][1]['track_id']), self.name('Case Artist'))
        artists = sql(f"SELECT count(*) FROM silver_enriched_artists WHERE canonical_name ILIKE '%case artist%{self.marker}%'")
        self.assertEqual(artists.strip(), '1')


if __name__ == '__main__':
    unittest.main()
