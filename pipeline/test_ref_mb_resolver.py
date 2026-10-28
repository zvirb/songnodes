"""Tests for local ref_mb ISRC Resolver."""

import unittest
from unittest.mock import MagicMock, patch
import psycopg2

from pipeline.djlib import ref_mb_resolver


class TestRefMBResolverUnit(unittest.TestCase):
    """Unit tests with mocked database connections."""

    @patch("pipeline.djlib.ref_mb_resolver.get_connection_pool")
    def test_resolve_isrc_local_db_offline(self, mock_get_pool):
        """Test resolve_isrc_local returns None cleanly when DB is offline."""
        mock_get_pool.return_value = None
        result = ref_mb_resolver.resolve_isrc_local("DEAZ30809510")
        self.assertIsNone(result)

    @patch("pipeline.djlib.ref_mb_resolver.get_connection_pool")
    def test_batch_resolve_isrcs_db_offline(self, mock_get_pool):
        """Test batch_resolve_isrcs returns empty dict when DB is offline."""
        mock_get_pool.return_value = None
        result = ref_mb_resolver.batch_resolve_isrcs(["DEAZ30809510"])
        self.assertEqual(result, {})

    def test_resolve_isrc_local_empty_isrc(self):
        """Test resolve_isrc_local handles empty or None ISRC input."""
        self.assertIsNone(ref_mb_resolver.resolve_isrc_local(""))
        self.assertIsNone(ref_mb_resolver.resolve_isrc_local(None))

    def test_batch_resolve_isrcs_empty_list(self):
        """Test batch_resolve_isrcs handles empty list input."""
        self.assertEqual(ref_mb_resolver.batch_resolve_isrcs([]), {})
        self.assertEqual(ref_mb_resolver.batch_resolve_isrcs([""]), {})

    @patch("pipeline.djlib.ref_mb_resolver.get_connection_pool")
    def test_resolve_isrc_local_mock_found(self, mock_get_pool):
        """Test resolve_isrc_local with mocked database cursor returning a match."""
        mock_pool = MagicMock()
        mock_conn = MagicMock()
        mock_cursor = MagicMock()

        mock_get_pool.return_value = mock_pool
        mock_pool.getconn.return_value = mock_conn
        mock_conn.cursor.return_value.__enter__.return_value = mock_cursor

        mock_cursor.fetchone.return_value = ("87e8e006-a7f3-43fc-87a9-f4852249e88b", "Test Track Title", 240000)

        result = ref_mb_resolver.resolve_isrc_local("DEAZ30809510")

        self.assertIsNotNone(result)
        self.assertEqual(result["mbid"], "87e8e006-a7f3-43fc-87a9-f4852249e88b")
        self.assertEqual(result["title"], "Test Track Title")
        self.assertEqual(result["duration_ms"], 240000)

        mock_pool.putconn.assert_called_once_with(mock_conn)

    @patch("pipeline.djlib.ref_mb_resolver.get_connection_pool")
    def test_batch_resolve_isrcs_mock_found(self, mock_get_pool):
        """Test batch_resolve_isrcs with mocked database cursor returning multiple matches."""
        mock_pool = MagicMock()
        mock_conn = MagicMock()
        mock_cursor = MagicMock()

        mock_get_pool.return_value = mock_pool
        mock_pool.getconn.return_value = mock_conn
        mock_conn.cursor.return_value.__enter__.return_value = mock_cursor

        mock_cursor.fetchall.return_value = [
            ("DEAZ30809510", "87e8e006-a7f3-43fc-87a9-f4852249e88b", "Track 1", 200000),
            ("USRC11200001", "12345678-1234-1234-1234-123456789012", "Track 2", 180000),
        ]

        result = ref_mb_resolver.batch_resolve_isrcs(["DEAZ30809510", "USRC11200001"])

        self.assertEqual(len(result), 2)
        self.assertEqual(result["DEAZ30809510"]["mbid"], "87e8e006-a7f3-43fc-87a9-f4852249e88b")
        self.assertEqual(result["DEAZ30809510"]["title"], "Track 1")
        self.assertEqual(result["DEAZ30809510"]["duration_ms"], 200000)

        self.assertEqual(result["USRC11200001"]["mbid"], "12345678-1234-1234-1234-123456789012")
        mock_pool.putconn.assert_called_once_with(mock_conn)

    @patch("pipeline.djlib.ref_mb_resolver.get_connection_pool")
    def test_resolve_isrc_local_db_exception_handled(self, mock_get_pool):
        """Test exception during execution is caught and warning logged without crashing."""
        mock_pool = MagicMock()
        mock_conn = MagicMock()
        mock_cursor = MagicMock()

        mock_get_pool.return_value = mock_pool
        mock_pool.getconn.return_value = mock_conn
        mock_conn.cursor.return_value.__enter__.return_value = mock_cursor

        mock_cursor.execute.side_effect = psycopg2.DatabaseError("Connection lost")

        result = ref_mb_resolver.resolve_isrc_local("DEAZ30809510")
        self.assertIsNone(result)
        mock_pool.putconn.assert_called_once_with(mock_conn)


class TestRefMBResolverLive(unittest.TestCase):
    """Integration test against live local PostgreSQL database if accessible."""

    def test_live_known_isrc_lookup(self):
        """Test against known ISRC DEAZ30809510 if live DB is online."""
        pool = ref_mb_resolver.get_connection_pool()
        if pool is None:
            self.skipTest("Local PostgreSQL ref_mb database is offline.")

        result = ref_mb_resolver.resolve_isrc_local("DEAZ30809510")
        self.assertIsNotNone(result, "Known ISRC DEAZ30809510 should be resolved in live database")
        self.assertEqual(result["mbid"], "87e8e006-a7f3-43fc-87a9-f4852249e88b")
        self.assertIn("title", result)
        self.assertIn("duration_ms", result)


if __name__ == "__main__":
    unittest.main()
