"""BRZ2: ingest rejects a bronze playlist that BRZ1 flagged bronze_incomplete (fake connection, no database)."""
import asyncio
import json
import sys
import unittest
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from common.datalayer import ingest  # noqa: E402

FLAG = {'bronze_incomplete': {'reason': 'track_insert_failed', 'failed_positions': [5]}}


class _Tx:
    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False


class FakeConn:
    """One bronze playlist whose saved track rows look complete (1..4); position 5 failed in bronze."""

    def __init__(self, raw_json):
        self.bronze_id = uuid.uuid4()
        self.raw_json = raw_json
        self.silver_id = uuid.uuid4()
        self.outbox = []

    def transaction(self):
        return _Tx()

    async def fetchrow(self, query, *args):
        if 'FROM bronze_scraped_playlists' in query:
            return {'id': self.bronze_id, 'raw_json': self.raw_json, 'source': 'mixesdb', 'artist_name': None,
                    'playlist_name': 'Artist One @ Club A 2024', 'event_name': None, 'event_date': None,
                    'source_url': 'https://www.mixesdb.com/w/Mix_1'}
        return None  # no silver row yet

    async def fetch(self, query, *args):
        return [{'id': uuid.uuid4(), 'position': p, 'artist_name': 'Deadmau5', 'track_title': f'Track {p}',
                 'raw_json': '{}', 'source': 'mixesdb'} for p in range(1, 5)]

    async def fetchval(self, query, *args):
        if 'INSERT INTO silver_enriched_playlists' in query:
            return self.silver_id
        if 'INSERT INTO outbox_events' in query:
            self.outbox.append((args[2], json.loads(args[3])))
            return len(self.outbox)
        raise AssertionError(f'unexpected query: {query}')

    async def execute(self, query, *args):
        raise AssertionError(f'unexpected query: {query}')


class BronzeIncomplete(unittest.TestCase):
    def _ingest(self, raw_json):
        conn = FakeConn(raw_json)
        return conn, asyncio.run(ingest.ingest_playlist(conn, conn.bronze_id))

    def test_flagged_object_raw_json_is_rejected(self):
        conn, result = self._ingest(json.dumps({'name': 'Artist One @ Club A 2024', **FLAG}))
        self.assertEqual(result['status'], 'rejected')
        self.assertEqual(result['errors']['reason'], 'bronze_incomplete')
        self.assertEqual(result['errors']['failed_positions'], [5])
        self.assertEqual(conn.outbox[0][0], 'rejected')

    def test_flagged_old_string_row_wrapped_under_raw_is_rejected(self):
        old = json.dumps("{'name': 'Artist One @ Club A 2024', 'total_tracks': 5}")
        conn, result = self._ingest(json.dumps({'raw': json.loads(old), **FLAG}))
        self.assertEqual(result['status'], 'rejected')
        self.assertEqual(result['errors']['reason'], 'bronze_incomplete')

    def test_old_string_raw_json_reads_as_empty_object(self):
        self.assertEqual(ingest.raw_object(json.dumps("{'total_tracks': 5}")), {})
        self.assertEqual(ingest.raw_object(json.dumps({'total_tracks': 5})), {'total_tracks': 5})


if __name__ == '__main__':
    unittest.main()
