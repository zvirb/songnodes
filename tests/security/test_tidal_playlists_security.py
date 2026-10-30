"""
Security regression tests for Tidal Playlists router.
Verifies that exception handling across endpoints does not leak internal trace or error details in HTTP responses.
"""

import os
import sys
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
for path in (os.path.join(ROOT, "services/rest_api"), os.path.join(ROOT, "services"), ROOT):
    if path not in sys.path:
        sys.path.insert(0, path)

import routers.tidal_playlists as tidal_playlists  # noqa: E402
from utils import tidal_user_api  # noqa: E402

SECRET_ERROR_MSG = "SECRET_SENSITIVE_INTERNAL_STATE_TRACE"


@pytest.fixture
def test_app():
    app = FastAPI()
    app.include_router(tidal_playlists.router)
    return app


def test_create_playlist_sanitizes_exception(monkeypatch, test_app):
    class FaultyTidalUserApi:
        def __init__(self, *args, **kwargs):
            pass

        async def create_playlist(self, *args, **kwargs):
            raise Exception(SECRET_ERROR_MSG)

        async def close(self):
            pass

    monkeypatch.setattr(tidal_playlists, "TidalUserApi", FaultyTidalUserApi)
    client = TestClient(test_app)

    response = client.post(
        "/api/v1/tidal/playlists/create",
        json={"name": "Test Playlist"},
        headers={"Authorization": "Bearer test-token"},
    )
    assert response.status_code == 500
    assert response.json()["detail"] == "Playlist creation failed"
    assert SECRET_ERROR_MSG not in response.text


def test_list_playlists_sanitizes_exception(monkeypatch, test_app):
    class FaultyTidalUserApi:
        def __init__(self, *args, **kwargs):
            pass

        async def list_playlists(self, *args, **kwargs):
            raise Exception(SECRET_ERROR_MSG)

        async def close(self):
            pass

    monkeypatch.setattr(tidal_playlists, "TidalUserApi", FaultyTidalUserApi)
    client = TestClient(test_app)

    response = client.get(
        "/api/v1/tidal/playlists/list",
        headers={"Authorization": "Bearer test-token"},
    )
    assert response.status_code == 500
    assert response.json()["detail"] == "Failed to fetch playlists"
    assert SECRET_ERROR_MSG not in response.text


def test_add_tracks_sanitizes_exception(monkeypatch, test_app):
    class FaultyTidalUserApi:
        def __init__(self, *args, **kwargs):
            pass

        async def add_tracks_in_order(self, *args, **kwargs):
            raise Exception(SECRET_ERROR_MSG)

        async def close(self):
            pass

    monkeypatch.setattr(tidal_playlists, "TidalUserApi", FaultyTidalUserApi)
    client = TestClient(test_app)

    response = client.post(
        "/api/v1/tidal/playlists/pl-123/tracks",
        json={"track_ids": ["1", "2"]},
        headers={"Authorization": "Bearer test-token"},
    )
    assert response.status_code == 500
    assert response.json()["detail"] == "Failed to add tracks"
    assert SECRET_ERROR_MSG not in response.text


def test_search_track_sanitizes_exception(monkeypatch, test_app):
    class FaultyTidalUserApi:
        def __init__(self, *args, **kwargs):
            pass

        async def search_track(self, *args, **kwargs):
            raise Exception(SECRET_ERROR_MSG)

        async def close(self):
            pass

    monkeypatch.setattr(tidal_playlists, "TidalUserApi", FaultyTidalUserApi)
    client = TestClient(test_app)

    response = client.post(
        "/api/v1/tidal/tracks/search",
        json={"artist": "Artist", "title": "Track"},
        headers={"Authorization": "Bearer test-token"},
    )
    assert response.status_code == 500
    assert response.json()["detail"] == "Track search failed"
    assert SECRET_ERROR_MSG not in response.text


def test_check_availability_sanitizes_exception(monkeypatch, test_app):
    class FaultyTidalUserApi:
        def __init__(self, *args, **kwargs):
            pass

        async def search_track(self, *args, **kwargs):
            raise Exception(SECRET_ERROR_MSG)

        async def close(self):
            pass

    monkeypatch.setattr(tidal_playlists, "TidalUserApi", FaultyTidalUserApi)
    client = TestClient(test_app)

    response = client.post(
        "/api/v1/tidal/tracks/check-availability",
        json={"artist": "Artist", "title": "Track"},
        headers={"Authorization": "Bearer test-token"},
    )
    assert response.status_code == 500
    assert response.json()["detail"] in ("Availability check failed", "Track search failed")
    assert SECRET_ERROR_MSG not in response.text
