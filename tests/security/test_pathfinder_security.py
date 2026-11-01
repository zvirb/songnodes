"""
Security tests for Pathfinder Router.
Ensures raw exception details and internal error strings are not leaked in HTTP response bodies.
"""

import os
import sys
import pytest
from unittest.mock import patch
from fastapi import FastAPI
from fastapi.testclient import TestClient

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
for path in (os.path.join(ROOT, "services/rest_api"), os.path.join(ROOT, "services"), ROOT):
    if path not in sys.path:
        sys.path.insert(0, path)

from routers.pathfinder import router

app = FastAPI()
app.include_router(router)
client = TestClient(app)

SECRET_ERROR_MSG = "DATABASE_PASSWORD_INTERNAL_SERVER_STACK_TRACE"


def test_find_dj_path_sanitizes_exception():
    """Verify raw exception message is not leaked in HTTP response during unexpected pathfinding errors."""
    payload = {
        "start_track_id": "track_1",
        "end_track_id": "track_2",
        "target_duration_ms": 300000,
        "tracks": [
            {
                "id": "track_1",
                "name": "Track 1",
                "artist": "Artist 1",
                "duration_ms": 150000,
                "camelot_key": "8A",
                "bpm": 124.0,
            },
            {
                "id": "track_2",
                "name": "Track 2",
                "artist": "Artist 2",
                "duration_ms": 150000,
                "camelot_key": "8A",
                "bpm": 124.0,
            },
        ],
        "edges": [
            {
                "from_id": "track_1",
                "to_id": "track_2",
                "weight": 1.0,
            }
        ],
    }

    with patch("routers.pathfinder.find_path", side_effect=Exception(SECRET_ERROR_MSG)):
        response = client.post("/api/v1/pathfinder/find-path", json=payload)
        assert response.status_code == 500
        assert SECRET_ERROR_MSG not in response.text
        assert response.json()["detail"] == "Pathfinding failed"
