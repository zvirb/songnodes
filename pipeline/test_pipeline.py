import os
import sys
import json
import sqlite3
import tempfile
from unittest.mock import patch, MagicMock

import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from pipeline.run_weekly import build_record, choose_version, cmd_resolve, export_library_json, run_pipeline
from pipeline.build_db import build_database


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


def test_cmd_resolve_with_dsp_and_ref_mb():
    to_resolve = [
        {
            "id": "t1",
            "title": "Plan 9",
            "artist": "808 State",
            "isrc": "DEAZ30809510",
            "preview": "https://example.com/plan9.mp3",
            "bpm": None,
            "camelot_key": None
        }
    ]

    mock_dsp_res = {
        "bpm": 124.0,
        "musical_key": "F# minor",
        "camelot_key": "11A",
        "confidence": 0.95
    }
    mock_mb_res = {
        "mbid": "87e8e006-a7f3-43fc-87a9-f4852249e88b",
        "title": "Plan 9",
        "duration_ms": 240000
    }

    with patch("pipeline.run_weekly.analyze_preview", return_value=mock_dsp_res), \
         patch("pipeline.run_weekly.resolve_isrc_local", return_value=mock_mb_res):
        resolved = cmd_resolve(to_resolve)
        assert len(resolved) == 1
        assert resolved[0]["bpm"] == 124.0
        assert resolved[0]["camelot_key"] == "11A"
        assert resolved[0]["mbid"] == "87e8e006-a7f3-43fc-87a9-f4852249e88b"


def test_export_library_json():
    tracks = [
        {"id": "t1", "title": "Track 1", "bpm": 124.0, "camelot_key": "10A"},
        {"id": "t2", "title": "Track 2", "bpm": None, "camelot_key": None}
    ]

    with tempfile.TemporaryDirectory() as tmp_dir:
        json_path = os.path.join(tmp_dir, "library.json")
        export_library_json(tracks, output_path=json_path)

        assert os.path.exists(json_path)
        with open(json_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        assert data["count"] == 2
        assert len(data["tracks"]) == 2
        assert data["tracks"][0]["bpm"] == 124.0
        assert data["tracks"][0]["k"] == "10A"
        assert data["tracks"][1]["bpm"] is None
        assert data["tracks"][1]["k"] is None


def test_build_database_schema_and_counts():
    tracks = [
        {
            "id": "t1",
            "title": "Plan 9",
            "artist": "808 State",
            "isrc": "DEAZ30809510",
            "mbid": "87e8e006-a7f3-43fc-87a9-f4852249e88b",
            "bpm": 124.0,
            "camelot_key": "10A"
        },
        {
            "id": "t2",
            "title": "Pacific State",
            "artist": "808 State",
            "isrc": "GBARL8900001",
            "mbid": "12345678-1234-1234-1234-123456789012",
            "bpm": 128.0,
            "camelot_key": "4A"
        }
    ]

    with tempfile.TemporaryDirectory() as tmp_dir:
        db_path = os.path.join(tmp_dir, "dj_library.sqlite")
        build_database(tracks, db_path=db_path)

        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        # Check mbid column in PRAGMA table_info
        cursor.execute("PRAGMA table_info(tracks)")
        cols = [row[1] for row in cursor.fetchall()]
        assert "mbid" in cols
        assert "bpm" in cols
        assert "camelot_key" in cols

        # Check mbid index
        cursor.execute("PRAGMA index_list(tracks)")
        indexes = [row[1] for row in cursor.fetchall()]
        assert "idx_tracks_mbid" in indexes

        # Check verification SQL: count(*), count(bpm), count(camelot_key)
        cursor.execute("SELECT count(*), count(bpm), count(camelot_key) FROM tracks")
        total, count_bpm, count_key = cursor.fetchone()

        assert total == 2
        assert count_bpm == 2
        assert count_key == 2
        assert (count_bpm / total) > 0.8
        assert (count_key / total) > 0.8

        conn.close()
