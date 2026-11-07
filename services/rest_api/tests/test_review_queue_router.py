"""Unit tests for the review queue count endpoint (/api/v1/library/review-queue/count)."""

import os
import sys
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.."))
for path in (os.path.join(ROOT, "services/rest_api"), os.path.join(ROOT, "services"), ROOT):
    if path not in sys.path:
        sys.path.insert(0, path)

from routers import library_overrides, review_queue  # noqa: E402


def make_client() -> TestClient:
    app = FastAPI()
    library_overrides.register(app)
    app.include_router(review_queue.router)
    return TestClient(app)


def test_review_queue_count_from_csv(tmp_path):
    """Returns pending review queue count from latest outputs/<date>/review_queue.csv excluding overridden tracks."""
    out_dir = tmp_path / "outputs" / "2026-11-07"
    out_dir.mkdir(parents=True)
    rq_csv = out_dir / "review_queue.csv"
    rq_csv.write_text(
        "track_id,artist,title,bpm,energy_score\n"
        "t1,Artist 1,Title 1,128.0,\n"
        "t2,Artist 2,Title 2,,6.5\n"
        "t3,Artist 3,Title 3,126.0,7.0\n",
        encoding="utf-8",
    )

    overrides_dir = tmp_path / "overrides"
    overrides_dir.mkdir(parents=True)
    ov_csv = overrides_dir / "energy_overrides.csv"
    ov_csv.write_text(
        "track_id,artist,title,energy_score,genre_pillar,rotation_status,tags,local_path,note\n"
        "t2,Artist 2,Title 2,8.0,Techno,High Rotation,,,\n",
        encoding="utf-8",
    )

    client = make_client()
    with patch.dict(os.environ, {"MUSIC_LIBRARY_DIR": str(tmp_path)}):
        res = client.get("/api/v1/library/review-queue/count")
    assert res.status_code == 200
    assert res.json() == {"count": 2}


def test_review_queue_count_falls_back_to_db_when_no_csv(tmp_path):
    """Queries enrichment_reviews / library.pending when no CSV exists on disk."""
    mock_conn = AsyncMock()
    mock_conn.fetchval.return_value = 7
    mock_pool = MagicMock()
    mock_pool.acquire.return_value.__aenter__.return_value = mock_conn
    mock_pool.acquire.return_value.__aexit__.return_value = None

    client = make_client()
    with patch.dict(os.environ, {"MUSIC_LIBRARY_DIR": str(tmp_path)}):
        with patch.object(library_overrides, "get_pool", return_value=mock_pool):
            res = client.get("/api/v1/library/review-queue/count")
    assert res.status_code == 200
    assert res.json() == {"count": 7}


def test_review_queue_count_returns_zero_when_unavailable(tmp_path):
    """Gracefully returns {'count': 0} when neither CSV nor DB is available."""
    client = make_client()
    with patch.dict(os.environ, {"MUSIC_LIBRARY_DIR": str(tmp_path)}):
        with patch.object(library_overrides, "get_pool", return_value=None):
            res = client.get("/api/v1/library/review-queue/count")
    assert res.status_code == 200
    assert res.json() == {"count": 0}
