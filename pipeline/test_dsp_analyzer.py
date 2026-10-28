import re
import pytest
from unittest.mock import patch, MagicMock
from pipeline.djlib.dsp_analyzer import analyze_preview

# Real active Deezer preview URL for 808 State - Plan 9 (obtained via Deezer Search API)
PLAN_9_PREVIEW_URL = (
    "https://cdnt-preview.dzcdn.net/api/1/1/2/3/0/0/230e8063fdb7d9cc93908dcab672c36c.mp3"
    "?hdnea=exp=1793172287~acl=/api/1/1/2/3/0/0/230e8063fdb7d9cc93908dcab672c36c.mp3*"
    "~data=user_id=0,application_id=42~hmac=e57c1557dd06065220fcd652d6b7e15447f8cbd0ca59cbda0bf5e13046707fce"
)


def test_analyze_preview_invalid_url():
    """Returns None for empty or non-string URLs."""
    assert analyze_preview("") is None
    assert analyze_preview(None) is None


def test_analyze_preview_http_404():
    """Returns None when the server returns HTTP 404."""
    with patch("requests.get") as mock_get:
        mock_response = MagicMock()
        mock_response.status_code = 404
        mock_get.return_value = mock_response

        res = analyze_preview("https://example.com/nonexistent.mp3")
        assert res is None


def test_analyze_preview_network_timeout():
    """Returns None on network timeout without crashing."""
    import requests
    with patch("requests.get", side_effect=requests.exceptions.Timeout("Timed out")):
        res = analyze_preview("https://example.com/timeout.mp3")
        assert res is None


def test_analyze_preview_corrupted_audio():
    """Returns None when the downloaded file is not valid audio."""
    with patch("requests.get") as mock_get:
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.iter_content.return_value = [b"NOT_A_REAL_MP3_AUDIO_HEADER_DATA"]
        mock_get.return_value = mock_response

        res = analyze_preview("https://example.com/corrupt.mp3")
        assert res is None


def test_analyze_preview_live_plan_9():
    """
    Live integration test against Deezer preview URL for 808 State - Plan 9.
    Verifies that extracted BPM is ~123-124 and returns a valid Camelot key.
    """
    result = analyze_preview(PLAN_9_PREVIEW_URL)
    assert result is not None, "Expected valid result for Plan 9 preview track"
    assert "bpm" in result
    assert "musical_key" in result
    assert "camelot_key" in result
    assert "confidence" in result

    # Verify BPM is ~123-124
    assert 120.0 <= result["bpm"] <= 126.0, f"Unexpected BPM: {result['bpm']}"

    # Verify Camelot key pattern (e.g. "10A", "10B", etc.)
    assert re.match(r"^(1[0-2]|[1-9])[AB]$", result["camelot_key"]), f"Invalid Camelot key: {result['camelot_key']}"
    assert isinstance(result["confidence"], float)
