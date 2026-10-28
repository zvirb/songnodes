import json
import os
import sqlite3
import sys

import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from pipeline.build_db import export_artifact_library, init_db, insert_track


@pytest.fixture
def memory_db():
    conn = sqlite3.connect(":memory:")
    init_db(conn)
    yield conn
    conn.close()


def test_insert_track_with_artwork_url(memory_db, tmp_path):
    track_data = {
        "id": "track-001",
        "artist": "Bicep",
        "title": "Glue",
        "mix": "Original Mix",
        "bpm": 128,
        "artwork_url": "https://example.com/images/bicep-glue.jpg",
    }
    insert_track(memory_db, track_data)

    cursor = memory_db.cursor()
    cursor.execute("SELECT artwork_url FROM tracks WHERE id = ?", ("track-001",))
    row = cursor.fetchone()
    assert row is not None
    assert row[0] == "https://example.com/images/bicep-glue.jpg"

    artifact_file = tmp_path / "library.json"
    artifact = export_artifact_library(memory_db, output_path=str(artifact_file))

    assert "tracks" in artifact
    assert len(artifact["tracks"]) == 1
    compact_track = artifact["tracks"][0]
    assert compact_track["id"] == "track-001"
    assert compact_track["art"] == "https://example.com/images/bicep-glue.jpg"

    assert artifact_file.exists()
    with open(artifact_file, "r", encoding="utf-8") as f:
        json_data = json.load(f)
    assert json_data["tracks"][0]["art"] == "https://example.com/images/bicep-glue.jpg"


def test_insert_track_without_artwork_url(memory_db, tmp_path):
    track_data = {
        "id": "track-002",
        "artist": "Overmono",
        "title": "So U Kno",
        "mix": "Original Mix",
        "bpm": 130,
        # artwork_url key is absent
    }
    insert_track(memory_db, track_data)

    cursor = memory_db.cursor()
    cursor.execute("SELECT artwork_url FROM tracks WHERE id = ?", ("track-002",))
    row = cursor.fetchone()
    assert row is not None
    assert row[0] is None

    artifact_file = tmp_path / "library.json"
    artifact = export_artifact_library(memory_db, output_path=str(artifact_file))

    compact_track = artifact["tracks"][0]
    assert compact_track["id"] == "track-002"
    assert compact_track["art"] is None

    with open(artifact_file, "r", encoding="utf-8") as f:
        json_data = json.load(f)
    assert json_data["tracks"][0]["art"] is None


def test_insert_track_with_none_artwork_url(memory_db, tmp_path):
    track_data = {
        "id": "track-003",
        "artist": "Four Tet",
        "title": "Looking at Your Pager",
        "artwork_url": None,
    }
    insert_track(memory_db, track_data)

    cursor = memory_db.cursor()
    cursor.execute("SELECT artwork_url FROM tracks WHERE id = ?", ("track-003",))
    row = cursor.fetchone()
    assert row is not None
    assert row[0] is None

    artifact = export_artifact_library(memory_db, output_path=None)
    assert artifact["tracks"][0]["art"] is None


def test_empty_database_export(memory_db, tmp_path):
    artifact_file = tmp_path / "empty_library.json"
    artifact = export_artifact_library(memory_db, output_path=str(artifact_file))
    assert artifact == {"tracks": []}
    assert artifact_file.exists()
