"""
LIB2: library_ingest handler enqueues projections and backfill after importing.
"""
import asyncio
import unittest
from unittest.mock import AsyncMock, patch

import common.datalayer.handlers  # noqa: F401
from library.ingest.handler import library_ingest


class TestLibraryIngestHandler(unittest.TestCase):
    def test_handler_returns_enqueued_follow_ups(self):
        mock_conn = AsyncMock()
        mock_ctx = AsyncMock()
        fake_stats = {'tracks': {'inserted': 5, 'updated': 10, 'unchanged': 0}}

        with patch('library.importer.import_library.process_payload', new=AsyncMock(return_value=fake_stats)):
            res = asyncio.run(library_ingest(mock_conn, mock_ctx, {'job_id': 'job-123', 'tracks': []}))

        self.assertIn('enqueue', res)
        enqueued_kinds = [item['kind'] for item in res['enqueue']]
        self.assertIn('projection_consume', enqueued_kinds)
        self.assertIn('graph_projection_consume', enqueued_kinds)
        self.assertIn('enrichment_backfill', enqueued_kinds)
        self.assertEqual(res['tracks']['inserted'], 5)


if __name__ == '__main__':
    unittest.main()
