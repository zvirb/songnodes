import os
import sys

import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from pipeline.run_weekly import build_record, choose_version, cmd_resolve


def test_tidal_none_bpm_inherits_deezer_bpm():
    tv = {"title": "Test Track", "version": "TIDAL", "bpm": None}
    dz = {"title": "Test Track", "version": "Deezer", "bpm": 124.0}

    record = build_record(tv, dz)
    assert record is not None
    assert record["bpm"] == 124
    assert isinstance(record["bpm"], int)


def test_tidal_zero_bpm_inherits_deezer_bpm():
    tv = {"title": "Test Track", "version": "TIDAL", "bpm": 0}
    dz = {"title": "Test Track", "version": "Deezer", "bpm": 128.0}

    record = build_record(tv, dz)
    assert record is not None
    assert record["bpm"] == 128


def test_tidal_populated_bpm_not_overwritten():
    tv = {"title": "Test Track", "version": "TIDAL", "bpm": 130}
    dz = {"title": "Test Track", "version": "Deezer", "bpm": 124.0}

    record = build_record(tv, dz)
    assert record is not None
    assert record["bpm"] == 130


def test_neither_has_valid_bpm_preserves_none():
    tv = {"title": "Test Track", "version": "TIDAL", "bpm": None}
    dz = {"title": "Test Track", "version": "Deezer", "bpm": None}

    record = build_record(tv, dz)
    assert record is not None
    assert record["bpm"] is None


def test_no_version_returns_none():
    assert build_record(None, None) is None


def test_deezer_only_version():
    dz = {"title": "Test Track", "version": "Deezer", "bpm": 122.0}
    record = build_record(None, dz)
    assert record is not None
    assert record["bpm"] == 122


class FakeDeezer:
    def __init__(self, details):
        self._details = details

    def detail(self, track_id):
        return self._details.get(track_id)


def test_cmd_resolve_captures_artwork_url():
    tracks = [
        {"deezer_id": "dz123", "title": "Track 1"},
        {"deezer_id": "dz456", "title": "Track 2"},
    ]
    deezer = FakeDeezer({
        "dz123": {"artwork_url": "https://e-cdns-images.dzcdn.net/images/cover/1.jpg"},
        "dz456": {"artwork_url": None},
    })

    resolved = cmd_resolve(tracks, deezer)
    assert resolved[0]["artwork_url"] == "https://e-cdns-images.dzcdn.net/images/cover/1.jpg"
    assert resolved[1]["artwork_url"] is None


def test_build_record_artwork_url_from_chosen_version():
    tv = {"title": "Test Track", "version": "TIDAL", "artwork_url": "https://tidal.com/art.jpg"}
    dz = {"title": "Test Track", "version": "Deezer", "artwork_url": "https://deezer.com/art.jpg"}

    record = build_record(tv, dz)
    assert record is not None
    assert record["artwork_url"] == "https://tidal.com/art.jpg"


def test_build_record_artwork_url_fallback_to_deezer_twin():
    tv = {"title": "Test Track", "version": "TIDAL", "artwork_url": None}
    dz = {"title": "Test Track", "version": "Deezer", "artwork_url": "https://deezer.com/art.jpg"}

    record = build_record(tv, dz)
    assert record is not None
    assert record["artwork_url"] == "https://deezer.com/art.jpg"


def test_build_record_artwork_url_none_when_absent():
    tv = {"title": "Test Track", "version": "TIDAL"}
    dz = {"title": "Test Track", "version": "Deezer"}

    record = build_record(tv, dz)
    assert record is not None
    assert record["artwork_url"] is None
