import json
import os
import sqlite3
import sys
import tempfile
from unittest.mock import patch

import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from pipeline.build_db import build_database, insert_track
from pipeline.run_weekly import build_record, choose_version, cmd_resolve, export_library_json, run_pipeline


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


def test_cmd_resolve_with_dsp_and_ref_mb():
    to_resolve = [{"id": "t1", "title": "Track 1", "isrc": "TEST00000001",
                   "preview": "https://example.com/t1.mp3", "bpm": None, "camelot_key": None}]
    dsp = {"bpm": 124.0, "musical_key": "F# minor", "camelot_key": "11A", "confidence": 0.95}
    mb = {"mbid": "00000000-0000-0000-0000-000000000001"}
    with patch("pipeline.run_weekly.analyze_preview", return_value=dsp), \
         patch("pipeline.run_weekly.resolve_isrc_local", return_value=mb):
        resolved = cmd_resolve(to_resolve)
    assert resolved[0]["bpm"] == 124.0
    assert resolved[0]["camelot_key"] == "11A"
    assert resolved[0]["mbid"] == "00000000-0000-0000-0000-000000000001"


def test_cmd_resolve_keeps_existing_bpm_and_key():
    tracks = [{"id": "t1", "preview": "https://example.com/t1.mp3", "bpm": 126, "camelot_key": "8A"}]
    with patch("pipeline.run_weekly.analyze_preview") as dsp, \
         patch("pipeline.run_weekly.resolve_isrc_local", return_value=None):
        cmd_resolve(tracks)
    dsp.assert_not_called()
    assert tracks[0]["bpm"] == 126


def test_export_library_json():
    tracks = [{"id": "t1", "title": "Track 1", "bpm": 124.0, "camelot_key": "10A"},
              {"id": "t2", "title": "Track 2", "bpm": None, "camelot_key": None}]
    with tempfile.TemporaryDirectory() as tmp_dir:
        json_path = os.path.join(tmp_dir, "library.json")
        export_library_json(tracks, output_path=json_path)
        with open(json_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    assert data["count"] == 2
    assert data["tracks"][0]["k"] == "10A"
    assert data["tracks"][1]["k"] is None


def test_database_has_mbid_isrc_and_key_columns():
    with tempfile.TemporaryDirectory() as tmp_dir:
        conn = build_database(os.path.join(tmp_dir, "library.db"))
        insert_track(conn, {"id": "t1", "title": "Track 1", "isrc": "TEST00000001",
                            "mbid": "00000000-0000-0000-0000-000000000001", "bpm": 124.0, "camelot_key": "10A"})
        cols = [row[1] for row in conn.execute("PRAGMA table_info(tracks)")]
        indexes = [row[1] for row in conn.execute("PRAGMA index_list(tracks)")]
        row = conn.execute("SELECT mbid, isrc, camelot_key, key, bpm FROM tracks").fetchone()
        conn.close()
    assert {"mbid", "isrc", "camelot_key"} <= set(cols)
    assert "idx_tracks_mbid" in indexes
    assert row == ("00000000-0000-0000-0000-000000000001", "TEST00000001", "10A", "10A", 124.0)


def test_old_database_gets_new_columns():
    with tempfile.TemporaryDirectory() as tmp_dir:
        path = os.path.join(tmp_dir, "library.db")
        old = sqlite3.connect(path)
        old.execute("CREATE TABLE tracks (id TEXT PRIMARY KEY, artist TEXT, title TEXT, mix TEXT, duration INTEGER, "
                    "bpm REAL, key TEXT, energy INTEGER, pillar TEXT, rotation INTEGER, tags TEXT, sources TEXT, "
                    "first_heard TEXT, last_heard TEXT, genre TEXT, label TEXT, sync TEXT, tidal TEXT, deezer TEXT, "
                    "beatport TEXT, artwork_url TEXT)")
        old.close()
        conn = build_database(path)
        cols = [row[1] for row in conn.execute("PRAGMA table_info(tracks)")]
        conn.close()
    assert {"mbid", "isrc", "camelot_key", "preview"} <= set(cols)


def test_run_pipeline_writes_db_and_artifact():
    tracks = [{"id": "t1", "title": "Track 1", "artist": "Artist", "isrc": "TEST00000001", "bpm": 124.0, "camelot_key": "10A"}]
    with tempfile.TemporaryDirectory() as tmp_dir, \
         patch("pipeline.run_weekly.resolve_isrc_local", return_value={"mbid": "00000000-0000-0000-0000-000000000001"}):
        out = os.path.join(tmp_dir, "library.json")
        run_pipeline(tracks, db_path=os.path.join(tmp_dir, "library.db"), output_path=out)
        with open(out, "r", encoding="utf-8") as f:
            data = json.load(f)
    assert data["tracks"][0]["k"] == "10A"
    assert data["tracks"][0]["mbid"] == "00000000-0000-0000-0000-000000000001"
