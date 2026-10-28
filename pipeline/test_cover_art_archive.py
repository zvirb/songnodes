"""Unit tests for Cover Art Archive public resolver module."""

import json
import os
import unittest
from unittest.mock import MagicMock, patch
import urllib.error

from pipeline.djlib.cover_art_archive import (
    get_cover_art_for_release,
    resolve_release_from_recording,
)


class TestCoverArtArchive(unittest.TestCase):
    """Unit tests for Cover Art Archive resolver."""

    def test_get_cover_art_for_release_valid(self):
        """Test get_cover_art_for_release returns correct canonical front image URL."""
        release_gid = "12345678-1234-1234-1234-123456789012"
        expected_url = f"https://coverartarchive.org/release/{release_gid}/front"
        self.assertEqual(get_cover_art_for_release(release_gid), expected_url)

    def test_get_cover_art_for_release_empty(self):
        """Test get_cover_art_for_release handles empty or None input."""
        self.assertEqual(get_cover_art_for_release(""), "")
        self.assertEqual(get_cover_art_for_release(None), "")

    @patch("urllib.request.urlopen")
    def test_resolve_release_from_recording_success(self, mock_urlopen):
        """Test resolve_release_from_recording successfully parses first release ID."""
        recording_gid = "rec-87e8e006-a7f3-43fc"
        expected_release_id = "rel-12345678-abcd"

        mock_response = MagicMock()
        mock_response.status = 200
        mock_response.read.return_value = json.dumps({
            "releases": [
                {"id": expected_release_id, "title": "Test Release First"},
                {"id": "rel-second-id", "title": "Test Release Second"},
            ]
        }).encode("utf-8")
        mock_urlopen.return_value.__enter__.return_value = mock_response

        release_id = resolve_release_from_recording(recording_gid)
        self.assertEqual(release_id, expected_release_id)

        # Verify URL and User-Agent header
        mock_urlopen.assert_called_once()
        req = mock_urlopen.call_args[0][0]
        self.assertIn("musicbrainz.org/ws/2/recording/rec-87e8e006-a7f3-43fc?inc=releases&fmt=json", req.full_url)
        self.assertTrue(req.has_header("User-agent"))

    @patch("urllib.request.urlopen")
    def test_resolve_release_from_recording_empty_releases(self, mock_urlopen):
        """Test resolve_release_from_recording returns None when releases list is empty."""
        mock_response = MagicMock()
        mock_response.status = 200
        mock_response.read.return_value = json.dumps({"releases": []}).encode("utf-8")
        mock_urlopen.return_value.__enter__.return_value = mock_response

        self.assertIsNone(resolve_release_from_recording("rec-123"))

    @patch("urllib.request.urlopen")
    def test_resolve_release_from_recording_missing_releases_key(self, mock_urlopen):
        """Test resolve_release_from_recording returns None when response lacks releases key."""
        mock_response = MagicMock()
        mock_response.status = 200
        mock_response.read.return_value = json.dumps({"title": "No releases field"}).encode("utf-8")
        mock_urlopen.return_value.__enter__.return_value = mock_response

        self.assertIsNone(resolve_release_from_recording("rec-123"))

    @patch("urllib.request.urlopen")
    def test_resolve_release_from_recording_http_error(self, mock_urlopen):
        """Test resolve_release_from_recording returns None on HTTP error."""
        mock_urlopen.side_effect = urllib.error.HTTPError(
            url="http://example.com", code=404, msg="Not Found", hdrs={}, fp=None
        )

        self.assertIsNone(resolve_release_from_recording("rec-notfound"))

    @patch("urllib.request.urlopen")
    def test_resolve_release_from_recording_url_error(self, mock_urlopen):
        """Test resolve_release_from_recording returns None on network URL error."""
        mock_urlopen.side_effect = urllib.error.URLError(reason="Connection refused")

        self.assertIsNone(resolve_release_from_recording("rec-networkerror"))

    @patch("urllib.request.urlopen")
    def test_resolve_release_from_recording_invalid_json(self, mock_urlopen):
        """Test resolve_release_from_recording returns None on invalid JSON response."""
        mock_response = MagicMock()
        mock_response.status = 200
        mock_response.read.return_value = b"INVALID JSON {{{{"
        mock_urlopen.return_value.__enter__.return_value = mock_response

        self.assertIsNone(resolve_release_from_recording("rec-badjson"))

    def test_resolve_release_from_recording_empty_input(self):
        """Test resolve_release_from_recording handles empty or None input."""
        self.assertIsNone(resolve_release_from_recording(""))
        self.assertIsNone(resolve_release_from_recording(None))

    @patch.dict(os.environ, {"REF_MB_URL": "https://custom-mb.internal/ws/2"})
    @patch("urllib.request.urlopen")
    def test_resolve_release_from_recording_custom_ref_mb_url(self, mock_urlopen):
        """Test resolve_release_from_recording respects custom HTTP REF_MB_URL environment variable."""
        mock_response = MagicMock()
        mock_response.status = 200
        mock_response.read.return_value = json.dumps({
            "releases": [{"id": "rel-custom-url"}]
        }).encode("utf-8")
        mock_urlopen.return_value.__enter__.return_value = mock_response

        release_id = resolve_release_from_recording("rec-custom")
        self.assertEqual(release_id, "rel-custom-url")

        req = mock_urlopen.call_args[0][0]
        self.assertTrue(req.full_url.startswith("https://custom-mb.internal/ws/2/recording/rec-custom"))


if __name__ == "__main__":
    unittest.main()
