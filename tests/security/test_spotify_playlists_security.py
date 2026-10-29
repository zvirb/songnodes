"""
Security tests for Spotify Playlists Router
Ensures raw exception details and internal error strings are not leaked in HTTP response bodies.
"""

import pytest
from unittest.mock import AsyncMock, patch
from fastapi import FastAPI
from fastapi.testclient import TestClient

from routers.spotify_playlists import router

app = FastAPI()
app.include_router(router)
client = TestClient(app)


def test_create_playlist_exception_sanitized():
    """Verify raw exception message is not leaked on generic error in create_playlist."""
    with patch("routers.spotify_playlists.get_current_user", return_value={"id": "user123"}):
        with patch("aiohttp.ClientSession.post", side_effect=Exception("Internal DB secret connection error SQL string")):
            response = client.post(
                "/api/v1/spotify/playlists/create",
                json={"name": "Test Playlist"},
                headers={"Authorization": "Bearer fake-token"}
            )
            assert response.status_code == 500
            assert "Internal DB secret" not in response.text
            assert response.json()["detail"] == "Playlist creation failed"


def test_list_playlists_exception_sanitized():
    """Verify raw exception message is not leaked on error in list_playlists."""
    with patch("aiohttp.ClientSession.get", side_effect=Exception("Sensitive trace information")):
        response = client.get(
            "/api/v1/spotify/playlists/list",
            headers={"Authorization": "Bearer fake-token"}
        )
        assert response.status_code == 500
        assert "Sensitive trace" not in response.text
        assert response.json()["detail"] == "Failed to fetch playlists"


def test_add_tracks_exception_sanitized():
    """Verify raw exception message is not leaked on error in add_tracks_to_playlist."""
    with patch("aiohttp.ClientSession.post", side_effect=Exception("Database password exposed")):
        response = client.post(
            "/api/v1/spotify/playlists/pl123/tracks",
            json={"track_ids": ["tr123"]},
            headers={"Authorization": "Bearer fake-token"}
        )
        assert response.status_code == 500
        assert "Database password" not in response.text
        assert response.json()["detail"] == "Failed to add tracks"


def test_search_track_exception_sanitized():
    """Verify raw exception message is not leaked on error in search_track."""
    with patch("aiohttp.ClientSession.get", side_effect=Exception("Internal server stack trace")):
        response = client.post(
            "/api/v1/spotify/tracks/search",
            json={"artist": "Artist", "title": "Track"},
            headers={"Authorization": "Bearer fake-token"}
        )
        assert response.status_code == 500
        assert "Internal server stack" not in response.text
        assert response.json()["detail"] == "Track search failed"


def test_check_track_availability_exception_sanitized():
    """Verify raw exception message is not leaked on error in check_track_availability."""
    with patch("routers.spotify_playlists.search_track", side_effect=Exception("Internal trace error")):
        response = client.post(
            "/api/v1/spotify/tracks/check-availability",
            json={"artist": "Artist", "title": "Track"},
            headers={"Authorization": "Bearer fake-token"}
        )
        assert response.status_code == 500
        assert "Internal trace" not in response.text
        assert response.json()["detail"] == "Availability check failed"
