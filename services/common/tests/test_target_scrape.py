import os
import unittest
from unittest.mock import AsyncMock, patch, MagicMock
from uuid import uuid4
from datetime import datetime, timezone

from common.datalayer.target_scrape import scrape_targets
from common.datalayer import jobs


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

if __name__ == '__main__':
    unittest.main()
