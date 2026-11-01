import os
import unittest
from unittest.mock import AsyncMock, patch, MagicMock
from uuid import uuid4
from datetime import date, datetime, timezone
from zoneinfo import ZoneInfoNotFoundError

from common.datalayer.target_scrape import melbourne_date, scrape_targets, today_in_melbourne
from common.datalayer import jobs


class TestTargetScrape(unittest.IsolatedAsyncioTestCase):
    async def test_scrape_targets_logic(self):
        conn = AsyncMock()
        conn.fetchrow.return_value = None  # no scrape window: every day
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
        conn.fetchrow.return_value = None  # no scrape window: every day
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

class UndefinedTableError(Exception):
    """Same class name asyncpg raises for a missing table."""


def window(starts_on, ends_on):
    return {'starts_on': starts_on, 'ends_on': ends_on, 'updated_at': datetime(2026, 11, 1, tzinfo=timezone.utc)}


class TestScrapeWindow(unittest.IsolatedAsyncioTestCase):
    """DS24B: the hourly run queues nothing outside the owner's Melbourne date window."""

    async def run_at(self, row, now):
        conn = AsyncMock()
        conn.fetchrow.return_value = row
        conn.fetch.return_value = [{'track_id': uuid4(), 'artist': 'Deadmau5', 'title': 'Strobe'}]
        with patch('common.datalayer.jobs.enqueue', new_callable=AsyncMock, return_value=({'id': uuid4()}, True)) as enqueue, \
                patch('common.datalayer.target_scrape.datetime') as fake_datetime:
            fake_datetime.now.return_value = now
            result = await scrape_targets(conn)
        return conn, enqueue, result

    async def test_inside_window_runs(self):
        conn, enqueue, result = await self.run_at(window(date(2026, 11, 12), date(2026, 11, 20)), datetime(2026, 11, 20, 1, tzinfo=timezone.utc))
        conn.fetch.assert_called_once()
        self.assertEqual(enqueue.call_count, 2)
        self.assertNotIn('outside_window', result)

    async def test_before_window_queues_nothing_and_leaves_last_searched(self):
        with self.assertLogs('songnodes.target_scrape', level='INFO') as logs:
            conn, enqueue, result = await self.run_at(window(date(2026, 11, 12), date(2026, 11, 20)), datetime(2026, 11, 1, 1, tzinfo=timezone.utc))
        conn.fetch.assert_not_called()  # the selection query is also the one that sets last_searched
        enqueue.assert_not_called()
        self.assertEqual(result, {'selected': 0, 'enqueued': 0, 'skipped_existing': 0, 'outside_window': True,
                                  'starts_on': '2026-11-12', 'ends_on': '2026-11-20'})
        self.assertIn('outside the window 2026-11-12 to 2026-11-20', logs.output[0])

    async def test_after_window_queues_nothing(self):
        conn, enqueue, result = await self.run_at(window(date(2026, 11, 12), date(2026, 11, 20)), datetime(2026, 11, 21, 1, tzinfo=timezone.utc))
        conn.fetch.assert_not_called()
        self.assertTrue(result['outside_window'])

    async def test_open_ended_windows(self):
        now = datetime(2026, 11, 15, 1, tzinfo=timezone.utc)
        conn, _, result = await self.run_at(window(date(2026, 11, 1), None), now)
        conn.fetch.assert_called_once()
        conn, _, result = await self.run_at(window(None, date(2026, 11, 14)), now)
        conn.fetch.assert_not_called()
        self.assertEqual((result['starts_on'], result['ends_on']), (None, '2026-11-14'))
        conn, _, result = await self.run_at(window(None, None), now)
        conn.fetch.assert_called_once()

    async def test_melbourne_date_not_utc(self):
        # 2026-10-03T15:30Z is 01:30 on 4 Oct in Melbourne (AEST, +10), still 3 Oct in UTC.
        conn, _, result = await self.run_at(window(date(2026, 10, 4), date(2026, 10, 4)), datetime(2026, 10, 3, 15, 30, tzinfo=timezone.utc))
        conn.fetch.assert_called_once()
        conn, _, result = await self.run_at(window(date(2026, 10, 3), date(2026, 10, 3)), datetime(2026, 10, 3, 15, 30, tzinfo=timezone.utc))
        conn.fetch.assert_not_called()

    def test_daylight_saving_boundaries(self):
        # AEDT (+11) from 2am 4 Oct 2026; AEST (+10) again from 3am 5 Apr 2026.
        self.assertEqual(melbourne_date(datetime(2026, 10, 4, 13, 30, tzinfo=timezone.utc)), date(2026, 10, 5))
        self.assertEqual(melbourne_date(datetime(2026, 4, 5, 13, 30, tzinfo=timezone.utc)), date(2026, 4, 5))

    async def test_no_tz_database_asks_postgres(self):
        conn = AsyncMock()
        conn.fetchval.return_value = date(2026, 11, 2)
        with patch('common.datalayer.target_scrape.ZoneInfo', side_effect=ZoneInfoNotFoundError('no tz')):
            self.assertEqual(await today_in_melbourne(conn), date(2026, 11, 2))
        self.assertIn("AT TIME ZONE 'Australia/Melbourne'", conn.fetchval.call_args[0][0])

    async def test_missing_table_means_no_window(self):
        conn = AsyncMock()
        conn.fetchrow.side_effect = UndefinedTableError('relation "scrape_window" does not exist')
        conn.fetch.return_value = []
        with self.assertLogs('songnodes.target_scrape', level='WARNING'):
            result = await scrape_targets(conn)
        conn.fetch.assert_called_once()
        self.assertNotIn('outside_window', result)


if __name__ == '__main__':
    unittest.main()
