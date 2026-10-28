"""Unit tests for Deezer artwork extraction in pipeline/djlib/deezer.py."""

import json
import unittest
from unittest.mock import MagicMock, patch

from pipeline.djlib import deezer


class TestDeezerArtwork(unittest.TestCase):
    """Offline unit tests verifying artwork_url extraction and key preservation."""

    @patch("urllib.request.urlopen")
    def test_detail_extracts_cover_xl(self, mock_urlopen):
        """Verify detail() prefers cover_xl when present."""
        sample_response = {
            "id": 3135556,
            "title": "Harder, Better, Faster, Stronger",
            "isrc": "GBDUW0100005",
            "bpm": 123.0,
            "release_date": "2001-03-07",
            "artist": {"name": "Daft Punk"},
            "album": {
                "id": 302127,
                "cover_medium": "https://e-cdns-images.dzcdn.net/images/cover/medium.jpg",
                "cover_big": "https://e-cdns-images.dzcdn.net/images/cover/big.jpg",
                "cover_xl": "https://e-cdns-images.dzcdn.net/images/cover/xl.jpg",
            },
        }

        mock_resp = MagicMock()
        mock_resp.read.return_value = json.dumps(sample_response).encode("utf-8")
        mock_resp.__enter__.return_value = mock_resp
        mock_urlopen.return_value = mock_resp

        result = deezer.detail(3135556)

        self.assertIsNotNone(result)
        self.assertEqual(result["id"], 3135556)
        self.assertEqual(result["title"], "Harder, Better, Faster, Stronger")
        self.assertEqual(result["artist"], "Daft Punk")
        self.assertEqual(result["bpm"], 123.0)
        self.assertEqual(result["isrc"], "GBDUW0100005")
        self.assertEqual(result["release_date"], "2001-03-07")
        self.assertEqual(result["album_id"], 302127)
        self.assertEqual(result["artwork_url"], "https://e-cdns-images.dzcdn.net/images/cover/xl.jpg")

    @patch("urllib.request.urlopen")
    def test_detail_fallback_cover_big(self, mock_urlopen):
        """Verify detail() falls back to cover_big when cover_xl is missing."""
        sample_response = {
            "id": 3135556,
            "title": "Harder, Better, Faster, Stronger",
            "isrc": "GBDUW0100005",
            "bpm": 123.0,
            "artist": {"name": "Daft Punk"},
            "album": {
                "id": 302127,
                "release_date": "2001-03-07",
                "cover_medium": "https://e-cdns-images.dzcdn.net/images/cover/medium.jpg",
                "cover_big": "https://e-cdns-images.dzcdn.net/images/cover/big.jpg",
                "cover_xl": None,
            },
        }

        mock_resp = MagicMock()
        mock_resp.read.return_value = json.dumps(sample_response).encode("utf-8")
        mock_resp.__enter__.return_value = mock_resp
        mock_urlopen.return_value = mock_resp

        result = deezer.detail("3135556")

        self.assertIsNotNone(result)
        self.assertEqual(result["bpm"], 123.0)
        self.assertEqual(result["isrc"], "GBDUW0100005")
        self.assertEqual(result["release_date"], "2001-03-07")
        self.assertEqual(result["album_id"], 302127)
        self.assertEqual(result["artwork_url"], "https://e-cdns-images.dzcdn.net/images/cover/big.jpg")

    @patch("urllib.request.urlopen")
    def test_detail_fallback_cover_medium(self, mock_urlopen):
        """Verify detail() falls back to cover_medium when cover_xl and cover_big are missing."""
        sample_response = {
            "id": 3135556,
            "title": "Harder, Better, Faster, Stronger",
            "isrc": "GBDUW0100005",
            "bpm": 123.0,
            "release_date": "2001-03-07",
            "artist": {"name": "Daft Punk"},
            "album": {
                "id": 302127,
                "cover_medium": "https://e-cdns-images.dzcdn.net/images/cover/medium.jpg",
            },
        }

        mock_resp = MagicMock()
        mock_resp.read.return_value = json.dumps(sample_response).encode("utf-8")
        mock_resp.__enter__.return_value = mock_resp
        mock_urlopen.return_value = mock_resp

        result = deezer.detail(3135556)

        self.assertIsNotNone(result)
        self.assertEqual(result["artwork_url"], "https://e-cdns-images.dzcdn.net/images/cover/medium.jpg")

    @patch("urllib.request.urlopen")
    def test_detail_no_artwork(self, mock_urlopen):
        """Verify detail() handles tracks/albums without cover artwork cleanly."""
        sample_response = {
            "id": 3135556,
            "title": "Harder, Better, Faster, Stronger",
            "isrc": "GBDUW0100005",
            "bpm": 0,
            "artist": {"name": "Daft Punk"},
            "album": None,
        }

        mock_resp = MagicMock()
        mock_resp.read.return_value = json.dumps(sample_response).encode("utf-8")
        mock_resp.__enter__.return_value = mock_resp
        mock_urlopen.return_value = mock_resp

        result = deezer.detail(3135556)

        self.assertIsNotNone(result)
        self.assertIsNone(result["artwork_url"])
        self.assertEqual(result["bpm"], 0)
        self.assertEqual(result["isrc"], "GBDUW0100005")

    def test_detail_invalid_track_id(self):
        """Verify detail() returns None on invalid or empty track_id."""
        self.assertIsNone(deezer.detail(""))
        self.assertIsNone(deezer.detail(None))

    @patch("urllib.request.urlopen")
    def test_detail_api_error(self, mock_urlopen):
        """Verify detail() handles Deezer API error payload cleanly."""
        error_response = {"error": {"type": "Exception", "message": "Data not found", "code": 800}}

        mock_resp = MagicMock()
        mock_resp.read.return_value = json.dumps(error_response).encode("utf-8")
        mock_resp.__enter__.return_value = mock_resp
        mock_urlopen.return_value = mock_resp

        self.assertIsNone(deezer.detail(999999999))

    @patch("urllib.request.urlopen")
    def test_search_extracts_cover_medium(self, mock_urlopen):
        """Verify search() extracts cover_medium into artwork_url."""
        sample_response = {
            "data": [
                {
                    "id": 3135556,
                    "title": "Harder, Better, Faster, Stronger",
                    "isrc": "GBDUW0100005",
                    "bpm": 123.0,
                    "release_date": "2001-03-07",
                    "artist": {"name": "Daft Punk"},
                    "album": {
                        "id": 302127,
                        "cover_medium": "https://e-cdns-images.dzcdn.net/images/cover/medium.jpg",
                    },
                }
            ],
            "total": 1,
        }

        mock_resp = MagicMock()
        mock_resp.read.return_value = json.dumps(sample_response).encode("utf-8")
        mock_resp.__enter__.return_value = mock_resp
        mock_urlopen.return_value = mock_resp

        results = deezer.search("Daft Punk Harder Better Faster Stronger")

        self.assertEqual(len(results), 1)
        res = results[0]
        self.assertEqual(res["id"], 3135556)
        self.assertEqual(res["title"], "Harder, Better, Faster, Stronger")
        self.assertEqual(res["artist"], "Daft Punk")
        self.assertEqual(res["bpm"], 123.0)
        self.assertEqual(res["isrc"], "GBDUW0100005")
        self.assertEqual(res["release_date"], "2001-03-07")
        self.assertEqual(res["album_id"], 302127)
        self.assertEqual(res["artwork_url"], "https://e-cdns-images.dzcdn.net/images/cover/medium.jpg")

    @patch("urllib.request.urlopen")
    def test_search_no_cover_medium(self, mock_urlopen):
        """Verify search() sets artwork_url to None when cover_medium is absent."""
        sample_response = {
            "data": [
                {
                    "id": 3135556,
                    "title": "Harder, Better, Faster, Stronger",
                    "artist": {"name": "Daft Punk"},
                    "album": {"id": 302127},
                }
            ]
        }

        mock_resp = MagicMock()
        mock_resp.read.return_value = json.dumps(sample_response).encode("utf-8")
        mock_resp.__enter__.return_value = mock_resp
        mock_urlopen.return_value = mock_resp

        results = deezer.search(artist="Daft Punk", title="Harder, Better, Faster, Stronger")

        self.assertEqual(len(results), 1)
        self.assertIsNone(results[0]["artwork_url"])

    def test_search_empty_query(self):
        """Verify search() with empty parameters returns empty list without network call."""
        self.assertEqual(deezer.search(""), [])


if __name__ == "__main__":
    unittest.main()
