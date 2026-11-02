"""
Security tests for Music Auth Router.
Ensures raw exception details and internal error strings are not leaked in HTTP response bodies.
"""

from unittest.mock import AsyncMock, patch
from fastapi import FastAPI
from fastapi.testclient import TestClient

from routers.music_auth import router

app = FastAPI()
app.include_router(router)
client = TestClient(app)


def test_spotify_callback_exception_sanitized():
    """Verify raw exception message is not leaked in spotify_callback."""
    with patch("routers.music_auth.get_redis", side_effect=Exception("Redis secret failure connection string")):
        response = client.get("/api/v1/music-auth/spotify/callback?code=fakecode&state=fakestate")
        assert response.status_code == 500
        assert "Redis secret failure" not in response.text
        assert response.json()["detail"] == "OAuth callback failed"


def test_store_token_exception_sanitized():
    """Verify raw exception message is not leaked in store_oauth_token."""
    with patch("routers.music_auth.get_db_pool", side_effect=Exception("Database password exposed")):
        response = client.post(
            "/api/v1/music-auth/store-token",
            json={
                "service": "spotify",
                "access_token": "token123",
                "expires_in": 3600
            }
        )
        assert response.status_code == 500
        assert "Database password exposed" not in response.text
        assert response.json()["detail"] == "Failed to store tokens"


def test_spotify_exchange_token_exception_sanitized():
    """Verify raw exception message is not leaked in spotify_exchange_token."""
    with patch("routers.music_auth.SPOTIFY_CLIENT_ID", "mock_id"), \
         patch("routers.music_auth.SPOTIFY_CLIENT_SECRET", "mock_secret"), \
         patch("aiohttp.ClientSession.post", side_effect=Exception("Internal auth stack trace")):
        response = client.post("/api/v1/music-auth/spotify/token?authorization_code=code123&redirect_uri=http://localhost")
        assert response.status_code == 500
        assert "Internal auth stack trace" not in response.text
        assert response.json()["detail"] == "Unexpected error during token exchange"


def test_spotify_refresh_token_exception_sanitized():
    """Verify raw exception message is not leaked in spotify_refresh_token."""
    with patch("routers.music_auth.SPOTIFY_CLIENT_ID", "mock_id"), \
         patch("routers.music_auth.SPOTIFY_CLIENT_SECRET", "mock_secret"), \
         patch("aiohttp.ClientSession.post", side_effect=Exception("Secret token refresh internal error")):
        response = client.post("/api/v1/music-auth/spotify/refresh?refresh_token=refresh123")
        assert response.status_code == 500
        assert "Secret token refresh" not in response.text
        assert response.json()["detail"] == "Token refresh failed"


def test_search_spotify_tracks_exception_sanitized():
    """Verify raw exception message is not leaked in search_spotify_tracks."""
    with patch("aiohttp.ClientSession.get", side_effect=Exception("Internal Spotify search failure")):
        response = client.get("/api/v1/music-auth/spotify/search?query=test&access_token=token123")
        assert response.status_code == 500
        assert "Internal Spotify search failure" not in response.text
        assert response.json()["detail"] == "Track search failed"


def test_init_tidal_oauth_exception_sanitized():
    """Verify raw exception message is not leaked in init_tidal_oauth."""
    with patch("routers.music_auth.get_redis", side_effect=Exception("Redis connection refused")):
        response = client.post(
            "/api/v1/music-auth/tidal/oauth/init",
            json={"redirect_uri": "http://localhost/callback"}
        )
        assert response.status_code == 500
        assert "Redis connection refused" not in response.text
        assert response.json()["detail"] == "OAuth initialization failed"


def test_tidal_oauth_callback_exception_sanitized():
    """Verify raw exception message is not leaked in tidal_oauth_callback."""
    with patch("routers.music_auth.get_redis", side_effect=Exception("Redis session corrupted")):
        response = client.get("/api/v1/music-auth/tidal/oauth/callback?code=code123&state=state123")
        assert response.status_code == 500
        assert "Redis session corrupted" not in response.text
        assert response.json()["detail"] == "OAuth callback failed"


def test_refresh_tidal_token_exception_sanitized():
    """Verify raw exception message is not leaked in refresh_tidal_token."""
    with patch("routers.music_auth.TIDAL_CLIENT_ID", "mock_id"), \
         patch("routers.music_auth.TIDAL_CLIENT_SECRET", "mock_secret"), \
         patch("aiohttp.ClientSession.post", side_effect=Exception("Tidal upstream secret failed")):
        response = client.post("/api/v1/music-auth/tidal/oauth/refresh?refresh_token=ref123")
        assert response.status_code == 500
        assert "Tidal upstream secret" not in response.text
        assert response.json()["detail"] == "Token refresh failed"


def test_get_spotify_token_status_exception_sanitized():
    """Verify raw exception message is not leaked in get_spotify_token_status."""
    with patch("routers.music_auth.get_db_pool", side_effect=Exception("Postgres connection timeout")):
        response = client.get("/api/v1/music-auth/spotify/token/status")
        assert response.status_code == 500
        assert "Postgres connection timeout" not in response.text
        assert response.json()["detail"] == "Failed to get token status"


def test_manual_refresh_spotify_token_exception_sanitized():
    """Verify raw exception message is not leaked in manual_refresh_spotify_token."""
    with patch("routers.music_auth.get_db_pool", side_effect=Exception("DB pool failure")):
        response = client.post("/api/v1/music-auth/spotify/token/refresh-manual")
        assert response.status_code == 500
        assert "DB pool failure" not in response.text
        assert response.json()["detail"] == "Manual refresh failed"
