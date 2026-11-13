"""
Security regression tests for Music Authentication router.
Verifies that exception handling across OAuth, token, and search endpoints
does not leak internal error strings or traceback details in HTTP responses.
"""

import os
import sys
import pytest
from unittest.mock import patch, AsyncMock
from fastapi import FastAPI
from fastapi.testclient import TestClient

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
for path in (os.path.join(ROOT, "services/rest_api"), os.path.join(ROOT, "services"), ROOT):
    if path not in sys.path:
        sys.path.insert(0, path)

import routers.music_auth as music_auth  # noqa: E402

SECRET_ERROR_MSG = "SENSITIVE_DB_CREDENTIAL_ERROR_TRACE_12345"
PREFIX = "/api/v1/music-auth"


@pytest.fixture
def test_app():
    app = FastAPI()
    app.include_router(music_auth.router)
    return app


def test_spotify_callback_sanitizes_exception(monkeypatch, test_app):
    client = TestClient(test_app)

    with patch.object(music_auth, "get_redis", side_effect=Exception(SECRET_ERROR_MSG)):
        response = client.get(f"{PREFIX}/spotify/callback?code=test_code&state=test_state")
        assert response.status_code == 500
        assert SECRET_ERROR_MSG not in response.text
        assert response.json()["detail"] == "OAuth callback failed"


def test_store_oauth_token_sanitizes_exception(monkeypatch, test_app):
    client = TestClient(test_app)

    with patch.object(music_auth, "get_db_pool", side_effect=Exception(SECRET_ERROR_MSG)):
        response = client.post(
            f"{PREFIX}/store-token",
            json={
                "service": "spotify",
                "access_token": "valid_token",
                "expires_in": 3600,
                "token_type": "Bearer",
            },
        )
        assert response.status_code == 500
        assert SECRET_ERROR_MSG not in response.text
        assert response.json()["detail"] == "Failed to store tokens"


def test_spotify_refresh_sanitizes_exception(monkeypatch, test_app):
    client = TestClient(test_app)

    monkeypatch.setattr(music_auth, "SPOTIFY_CLIENT_ID", "dummy_client_id")
    monkeypatch.setattr(music_auth, "SPOTIFY_CLIENT_SECRET", "dummy_client_secret")

    with patch("aiohttp.ClientSession.post", side_effect=Exception(SECRET_ERROR_MSG)):
        response = client.post(
            f"{PREFIX}/spotify/refresh",
            params={
                "refresh_token": "dummy_refresh",
            },
        )
        assert response.status_code == 500
        assert SECRET_ERROR_MSG not in response.text
        assert response.json()["detail"] == "Token refresh failed"


def test_spotify_search_sanitizes_exception(monkeypatch, test_app):
    client = TestClient(test_app)

    with patch("aiohttp.ClientSession.get", side_effect=Exception(SECRET_ERROR_MSG)):
        response = client.get(
            f"{PREFIX}/spotify/search?query=test&access_token=dummy_access_token",
        )
        assert response.status_code == 500
        assert SECRET_ERROR_MSG not in response.text
        assert response.json()["detail"] == "Spotify search failed"


def test_tidal_oauth_init_sanitizes_exception(monkeypatch, test_app):
    client = TestClient(test_app)

    with patch.dict(os.environ, {"TIDAL_CLIENT_ID": "cid", "TIDAL_CLIENT_SECRET": "sec"}):
        with patch.object(music_auth, "get_redis", side_effect=Exception(SECRET_ERROR_MSG)):
            response = client.post(
                f"{PREFIX}/tidal/oauth/init",
                json={"redirect_uri": "http://localhost:3000/callback"},
            )
            assert response.status_code == 500
            assert SECRET_ERROR_MSG not in response.text
            assert response.json()["detail"] == "OAuth initialization failed"


def test_tidal_oauth_callback_sanitizes_exception(monkeypatch, test_app):
    client = TestClient(test_app)

    with patch.object(music_auth, "get_redis", side_effect=Exception(SECRET_ERROR_MSG)):
        response = client.get(f"{PREFIX}/tidal/oauth/callback?code=tidal_code&state=tidal_state")
        assert response.status_code == 500
        assert SECRET_ERROR_MSG not in response.text
        assert response.json()["detail"] == "OAuth callback failed"


def test_tidal_refresh_sanitizes_exception(monkeypatch, test_app):
    client = TestClient(test_app)

    monkeypatch.setattr(music_auth, "TIDAL_CLIENT_ID", "dummy_cid")
    monkeypatch.setattr(music_auth, "TIDAL_CLIENT_SECRET", "dummy_csec")

    with patch("aiohttp.ClientSession.post", side_effect=Exception(SECRET_ERROR_MSG)):
        response = client.post(f"{PREFIX}/tidal/oauth/refresh?refresh_token=tok")
        assert response.status_code == 500
        assert SECRET_ERROR_MSG not in response.text
        assert response.json()["detail"] == "Token refresh failed"


def test_spotify_token_status_sanitizes_exception(monkeypatch, test_app):
    client = TestClient(test_app)

    with patch.object(music_auth, "get_db_pool", side_effect=Exception(SECRET_ERROR_MSG)):
        response = client.get(f"{PREFIX}/spotify/token/status")
        assert response.status_code == 500
        assert SECRET_ERROR_MSG not in response.text
        assert response.json()["detail"] == "Failed to get token status"


def test_spotify_manual_refresh_sanitizes_exception(monkeypatch, test_app):
    client = TestClient(test_app)

    with patch.object(music_auth, "get_db_pool", side_effect=Exception(SECRET_ERROR_MSG)):
        response = client.post(f"{PREFIX}/spotify/token/refresh-manual")
        assert response.status_code == 500
        assert SECRET_ERROR_MSG not in response.text
        assert response.json()["detail"] == "Manual refresh failed"


def test_spotify_callback_sanitizes_error_param(test_app):
    client = TestClient(test_app)
    response = client.get(f"{PREFIX}/spotify/callback?code=foo&state=bar&error={SECRET_ERROR_MSG}")
    assert response.status_code == 400
    assert SECRET_ERROR_MSG not in response.text
    assert response.json()["detail"] == "Spotify authorization failed"


def test_tidal_device_init_sanitizes_upstream_error(monkeypatch, test_app):
    client = TestClient(test_app)

    monkeypatch.setattr(music_auth, "TIDAL_CLIENT_ID", "dummy_cid")
    monkeypatch.setattr(music_auth, "TIDAL_CLIENT_SECRET", "dummy_csec")

    class FakeResponse:
        status = 400

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc_val, exc_tb):
            pass

        async def text(self):
            return SECRET_ERROR_MSG

    class FakeSession:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc_val, exc_tb):
            pass

        def post(self, *args, **kwargs):
            return FakeResponse()

    monkeypatch.setattr(music_auth.aiohttp, "ClientSession", FakeSession)

    response = client.post(f"{PREFIX}/tidal/device/init")
    assert response.status_code == 400
    assert SECRET_ERROR_MSG not in response.text
    assert response.json()["detail"] == "Device authorization failed"
