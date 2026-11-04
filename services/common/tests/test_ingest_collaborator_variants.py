"""
ING2: upsert_track links collaborator and base-title variants to canonical tracks.
"""
import asyncio
import json
import sys
import unittest
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from common.datalayer import ingest  # noqa: E402


class _Tx:
    async def __aenter__(self):
        return self
    async def __aexit__(self, *exc):
        return False


class FakeUpsertConn:
    def transaction(self):
        return _Tx()

    def __init__(self, existing_tracks=None):
        self.tracks = list(existing_tracks or [])
        self.outbox = []

    async def fetchrow(self, query, *args):
        if 'FROM silver_enriched_tracks WHERE id = $1' in query:
            return {'id': args[0], 'genre': []}
        return None

    async def execute(self, query, *args):
        # locks or updates
        return 'OK'

    async def fetchval(self, query, *args):
        if 'SELECT canonical_name FROM silver_enriched_artists' in query:
            return args[0]
        if 'INSERT INTO silver_enriched_artists' in query:
            return args[0]
        if 'lower(artist_name) = lower($1) AND lower(track_title) = lower($2)' in query:
            canonical, title = args[0], args[1]
            for t in self.tracks:
                if t['artist_name'].lower() == canonical.lower() and t['track_title'].lower() == title.lower():
                    return t['id']
            return None
        if 'WHERE isrc = $1' in query:
            isrc = args[0]
            for t in self.tracks:
                if t.get('isrc') == isrc:
                    return t['id']
            return None
        if 'INSERT INTO silver_enriched_tracks' in query:
            new_id = uuid.uuid4()
            self.tracks.append({'id': new_id, 'artist_name': args[1], 'track_title': args[2], 'isrc': None})
            return new_id
        if 'INSERT INTO outbox_events' in query:
            self.outbox.append((args[2], json.loads(args[3])))
            return len(self.outbox)
        if 'INSERT INTO silver_track_metadata_evidence' in query:
            return True
        raise AssertionError(f'unexpected fetchval query: {query}')

    async def fetch(self, query, *args):
        if 'SELECT id, artist_name, track_title FROM silver_enriched_tracks' in query:
            token = args[0].lower()
            return [{'id': t['id'], 'artist_name': t['artist_name'], 'track_title': t['track_title']}
                    for t in self.tracks if t['track_title'].lower().startswith(token) or token in t['track_title'].lower()]
        if 'SELECT field, raw, source, independent_group, value' in query:
            return []
        if 'FROM silver_track_metadata_evidence' in query:
            return []
        raise AssertionError(f'unexpected fetch query: {query}')


class TestIngestCollaboratorVariants(unittest.TestCase):
    def test_exact_match(self):
        tid = uuid.uuid4()
        conn = FakeUpsertConn([{'id': tid, 'artist_name': 'Djrum', 'track_title': 'Watermark', 'isrc': None}])
        res = asyncio.run(ingest.upsert_track(conn, 'Djrum', 'Watermark', None, 'test'))
        self.assertEqual(res['id'], tid)
        self.assertEqual(res['status'], 'updated')

    def test_collaborator_variant_matches_canonical(self):
        tid = uuid.uuid4()
        conn = FakeUpsertConn([{'id': tid, 'artist_name': 'lifelike, Kris Menace', 'track_title': 'Discopolis 2.0', 'isrc': None}])
        # Incoming scraped track lists only primary artist "Lifelike"
        res = asyncio.run(ingest.upsert_track(conn, 'Lifelike', 'Discopolis 2.0', None, 'test'))
        self.assertEqual(res['id'], tid)
        self.assertEqual(res['status'], 'updated')

    def test_remix_variant_does_not_falsely_match_original(self):
        tid = uuid.uuid4()
        conn = FakeUpsertConn([{'id': tid, 'artist_name': 'Lifelike', 'track_title': 'Discopolis 2.0', 'isrc': None}])
        # Incoming scraped track is a different remix version
        res = asyncio.run(ingest.upsert_track(conn, 'Lifelike', 'Discopolis 2.0 (Club Mix)', None, 'test'))
        self.assertNotEqual(res['id'], tid)
        self.assertEqual(res['status'], 'created')

    def test_isrc_matches_when_titles_have_minor_differences(self):
        tid = uuid.uuid4()
        conn = FakeUpsertConn([{'id': tid, 'artist_name': 'Bicep', 'track_title': 'Glue', 'isrc': 'GBAKX1700201'}])
        res = asyncio.run(ingest.upsert_track(conn, 'Bicep', 'Glue (Original Mix)', None, 'test', raw={'isrc': 'GBAKX1700201'}))
        self.assertEqual(res['id'], tid)
        self.assertEqual(res['status'], 'updated')


if __name__ == '__main__':
    unittest.main()
