import pytest
import asyncio
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi.testclient import TestClient
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
import multiprocessing
import time
import requests
import sys

from music_search import search_tracks, MusicSearchError, _normalize_spotify_track, _normalize_tidal_track
from search_routes import router

sys.path.insert(0, "/app/tests")
from fakes.fake_music_services import create_fake_app
import aiohttp
from aiohttp import web

app = FastAPI()
app.include_router(router)
client = TestClient(app)

@pytest.fixture
def mock_pipeline():
    pipeline = MagicMock()

    spotify_client = AsyncMock()
    spotify_client.client_id = "spotify_id"
    spotify_client.base_url = "http://localhost:8080/spotify"
    spotify_client._get_access_token.return_value = "fake_spotify_token"

    tidal_client = AsyncMock()
    tidal_client.client_id = "tidal_id"
    tidal_client.base_url = "http://localhost:8080/tidal"
    tidal_client._get_token.return_value = "fake_tidal_token"

    pipeline.spotify_client = spotify_client
    pipeline.tidal_client = tidal_client

    app.state.enrichment_pipeline = pipeline
    yield pipeline

def test_normalize_spotify_track():
    raw_track = {
        "id": "abcde",
        "name": "Looking at Your Pager",
        "artists": [{"name": "Four Tet"}, {"name": "Another"}],
        "album": {
            "name": "Looking at Your Pager",
            "images": [{"url": "https://fake.spotify.com/image"}]
        },
        "duration_ms": 180000,
        "preview_url": "https://fake.spotify.com/preview",
        "external_ids": {"isrc": "US1234567890"},
        "external_urls": {"spotify": "https://open.spotify.com/track/abcde"}
    }

    normalized = _normalize_spotify_track(raw_track)
    assert normalized["id"] == "abcde"
    assert normalized["title"] == "Looking at Your Pager"
    assert normalized["artist"] == "Four Tet"
    assert len(normalized["artists"]) == 2
    assert normalized["album"]["name"] == "Looking at Your Pager"
    assert normalized["album"]["images"][0]["url"] == "https://fake.spotify.com/image"
    assert normalized["image"] == "https://fake.spotify.com/image"
    assert normalized["isrc"] == "US1234567890"

def test_normalize_tidal_track():
    raw_track = {
        "id": "12345",
        "title": "Looking at Your Pager",
        "artist": {"name": "Four Tet"},
        "artists": [{"name": "Four Tet"}],
        "album": {
            "title": "Looking at Your Pager",
            "cover": "uuid-1234"
        },
        "duration": 180,
        "isrc": "US1234567890"
    }

    normalized = _normalize_tidal_track(raw_track)
    assert normalized["id"] == "12345"
    assert normalized["title"] == "Looking at Your Pager"
    assert normalized["artist"] == "Four Tet"
    assert normalized["image"] == "https://resources.tidal.com/images/uuid/1234/320x320.jpg"
    assert normalized["isrc"] == "US1234567890"

def run_fake_server():
    fake_app = create_fake_app()
    web.run_app(fake_app, port=8080, access_log=None)

@pytest.fixture(scope="module")
def fake_server():
    p = multiprocessing.Process(target=run_fake_server)
    p.start()

    # Wait for server to be up
    for _ in range(20):
        try:
            requests.get("http://localhost:8080/")
        except:
            time.sleep(0.1)

    yield
    p.terminate()
    p.join()

def test_search_spotify_success(mock_pipeline, fake_server):
    response = client.get("/api/v1/search/spotify?q=pager")
    assert response.status_code == 200
    data = response.json()
    assert "tracks" in data
    assert len(data["tracks"]) == 1
    assert data["tracks"][0]["name"] == "Looking at Your Pager"
    assert data["tracks"][0]["image"] == "https://fake.spotify.com/image"

def test_search_tidal_success(mock_pipeline, fake_server):
    response = client.get("/api/v1/search/tidal?q=pager")
    assert response.status_code == 200
    data = response.json()
    assert "tracks" in data
    assert len(data["tracks"]) == 1
    assert data["tracks"][0]["name"] == "Looking at Your Pager"

def test_search_validation():
    response = client.get("/api/v1/search/unknown?q=test")
    assert response.status_code == 400
    assert response.json()["code"] == "bad_request"

    response = client.get("/api/v1/search/spotify?q=  ")
    assert response.status_code == 400

def test_no_credentials(mock_pipeline):
    mock_pipeline.spotify_client = None
    response = client.get("/api/v1/search/spotify?q=pager")
    assert response.status_code == 424
    assert response.json()["code"] == "spotify_not_configured"

    mock_pipeline.tidal_client = MagicMock()
    mock_pipeline.tidal_client.client_id = None
    response = client.get("/api/v1/search/tidal?q=pager")
    assert response.status_code == 424
    assert response.json()["code"] == "tidal_not_configured"
