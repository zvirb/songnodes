import os
import unittest
from unittest.mock import AsyncMock, patch, MagicMock
from uuid import uuid4
from datetime import datetime, timezone

import httpx

from common.datalayer.target_scrape import record_playlists_found, scrape_targets
from common.datalayer import handlers, jobs


class TestTargetScrape(unittest.IsolatedAsyncioTestCase):
    async def test_scrape_targets_logic(self):
        conn = AsyncMock()
        target_id_1 = uuid4()
        target_id_2 = uuid4()

        conn.fetch.return_value = [
            {'track_id': target_id_1, 'artist': 'Artist A', 'title': 'Title A'},
            {'track_id': target_id_2, 'artist': 'Artist B', 'title': 'Title B'},
        ]

        with patch('common.datalayer.jobs.enqueue', new_callable=AsyncMock) as mock_enqueue:
            # First one is created, second one is not (skipped_existing)
            mock_enqueue.side_effect = [
                ({'id': uuid4()}, True),
                ({'id': uuid4()}, False),
                ({'id': uuid4()}, True),
                ({'id': uuid4()}, True)
            ]

            result = await scrape_targets(conn)

            # Verify the return summary
            self.assertEqual(result['selected'], 2)
            self.assertEqual(result['enqueued'], 3)
            self.assertEqual(result['skipped_existing'], 1)

            # Verify jobs.enqueue calls
            self.assertEqual(mock_enqueue.call_count, 4)  # 2 targets * 2 sources

            # Verify query contains correct params
            conn.fetch.assert_called_once()
            call_args = conn.fetch.call_args[0]
            query = call_args[0]

            self.assertIn('FOR UPDATE SKIP LOCKED', query)
            self.assertIn('is_active = TRUE', query)
            self.assertIn('archived = FALSE', query)
            self.assertIn('ORDER BY', query)
            self.assertIn('last_searched NULLS FIRST', query)
            self.assertIn('added_at', query)

            # Verify params
            days = call_args[1]
            limit = call_args[2]
            self.assertEqual(days, 7)
            self.assertEqual(limit, 2)

            # Check payload and idempotency keys
            now_date = datetime.now(timezone.utc).strftime('%Y-%m-%d')
            first_call_args = mock_enqueue.call_args_list[0][0]
            self.assertEqual(first_call_args[1], 'scrape')
            self.assertEqual(first_call_args[2], f'target:{target_id_1}:mixesdb:{now_date}')
            self.assertEqual(first_call_args[3]['source'], 'mixesdb')
            self.assertEqual(first_call_args[3]['search_query'], 'Artist A Title A')
            self.assertEqual(first_call_args[3]['target_track_id'], str(target_id_1))

    async def test_scrape_targets_disabled(self):
        conn = AsyncMock()
        with patch.dict(os.environ, {'SCRAPE_TARGETS_ENABLED': 'false'}):
            result = await scrape_targets(conn)

            self.assertEqual(result, {'selected': 0, 'enqueued': 0, 'skipped_existing': 0})
            conn.fetch.assert_not_called()

    async def test_skips_empty_artist_or_title(self):
        conn = AsyncMock()
        target_id_1 = uuid4()

        # Return a row with empty artist
        conn.fetch.return_value = [
            {'track_id': target_id_1, 'artist': '', 'title': 'Title A'},
        ]

        with patch('common.datalayer.jobs.enqueue', new_callable=AsyncMock) as mock_enqueue:
            result = await scrape_targets(conn)

            self.assertEqual(result['selected'], 1)
            self.assertEqual(result['enqueued'], 0)
            mock_enqueue.assert_not_called()


class _Transaction:
    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False


def _conn(locked_row):
    conn = MagicMock()
    conn.transaction = MagicMock(return_value=_Transaction())
    conn.fetchrow = AsyncMock(return_value=locked_row)
    conn.fetchval = AsyncMock(return_value=7)
    return conn


class TestRecordPlaylistsFound(unittest.IsolatedAsyncioTestCase):
    async def test_payload_without_target_writes_nothing(self):
        conn = _conn({'last_searched': None})
        self.assertIsNone(await record_playlists_found(conn, {'search_query': 'a b'}, 3))
        self.assertIsNone(await record_playlists_found(conn, {'target_track_id': 'not-a-uuid'}, 3))
        conn.fetchrow.assert_not_called()
        conn.fetchval.assert_not_called()

    async def test_missing_target_is_not_updated(self):
        conn = _conn(None)
        self.assertIsNone(await record_playlists_found(conn, {'target_track_id': str(uuid4())}, 3))
        conn.fetchval.assert_not_called()

    async def test_locks_target_then_writes_latest_search_count(self):
        conn = _conn({'last_searched': datetime.now(timezone.utc)})
        target_id, job_id = uuid4(), uuid4()
        found = await record_playlists_found(conn, {'target_track_id': str(target_id), 'job_id': str(job_id)}, 4)
        self.assertEqual(found, 7)
        self.assertIn('FOR UPDATE', conn.fetchrow.call_args[0][0])
        self.assertEqual(conn.fetchrow.call_args[0][1], target_id)
        query, *args = conn.fetchval.call_args[0]
        self.assertEqual(args, [target_id, 4, job_id])
        # latest search only: succeeded scrape jobs for this target since last_searched, never this job twice
        self.assertIn("j.status = 'succeeded'", query)
        self.assertIn("j.payload->>'target_track_id' = t.track_id::text", query)
        self.assertIn('j.created_at >= t.last_searched', query)
        self.assertIn('j.id <> $3::uuid', query)
        # a job from an older search leaves the count alone
        self.assertIn('own.created_at < t.last_searched', query)
        self.assertNotIn('playlists_found + ', query, 'not a running total')

    async def test_job_id_is_optional(self):
        conn = _conn({'last_searched': None})
        await record_playlists_found(conn, {'target_track_id': str(uuid4())}, 0)
        self.assertIsNone(conn.fetchval.call_args[0][3])


class TestScrapeHandlerRecordsTarget(unittest.IsolatedAsyncioTestCase):
    def _ctx(self, status, body):
        def reply(request):
            return httpx.Response(status, json=body)
        return handlers.Context(http=httpx.AsyncClient(transport=httpx.MockTransport(reply)), scraper_url='http://scraper.test')

    async def test_success_records_the_scrape_count(self):
        payload = {'source': 'mixesdb', 'search_query': 'A B', 'target_track_id': str(uuid4()), 'job_id': str(uuid4())}
        ctx = self._ctx(200, {'bronze_playlists_persisted': 3, 'bronze_tracks_persisted': 40})
        with patch('common.datalayer.target_scrape.record_playlists_found', new_callable=AsyncMock) as record:
            result = await handlers.scrape(MagicMock(), ctx, payload)
        record.assert_awaited_once()
        self.assertEqual(record.call_args[0][1:], (payload, 3))
        self.assertEqual(result['bronze_playlists'], 3)

    async def test_failed_attempt_records_nothing(self):
        payload = {'source': 'mixesdb', 'search_query': 'A B', 'target_track_id': str(uuid4())}
        with patch('common.datalayer.target_scrape.record_playlists_found', new_callable=AsyncMock) as record:
            with self.assertRaises(handlers.RetryableError):
                await handlers.scrape(MagicMock(), self._ctx(503, {}), payload)
        record.assert_not_called()


if __name__ == '__main__':
    unittest.main()
