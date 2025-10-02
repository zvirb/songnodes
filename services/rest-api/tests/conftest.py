"""Pytest fixtures for REST API tests"""
import pytest
import asyncio
from typing import AsyncGenerator, Generator
from unittest.mock import AsyncMock, MagicMock, patch
import asyncpg
from httpx import AsyncClient
from fastapi.testclient import TestClient

# Import the app but prevent actual database connections
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

@pytest.fixture(scope="session")
def event_loop() -> Generator:
    """Create event loop for async tests"""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

@pytest.fixture
def mock_db_pool():
    """Mock database connection pool"""
    pool = AsyncMock(spec=asyncpg.Pool)

    # Mock connection
    conn = AsyncMock()
    conn.fetch.return_value = []
    conn.fetchrow.return_value = None
    conn.fetchval.return_value = 1
    conn.execute.return_value = None

    # Mock pool acquire context manager
    pool.acquire.return_value.__aenter__.return_value = conn
    pool.acquire.return_value.__aexit__.return_value = None
    pool.get_size.return_value = 10
    pool.get_idle_size.return_value = 5
    pool.close.return_value = None

    return pool

@pytest.fixture
async def test_client(mock_db_pool) -> AsyncGenerator:
    """Create test client with mocked database"""
    # Mock the database pool creation
    with patch('main.asyncpg.create_pool', return_value=mock_db_pool):
        with patch('main.db_pool', mock_db_pool):
            from main import app

            # Override db_pool globally
            import main
            main.db_pool = mock_db_pool

            async with AsyncClient(app=app, base_url="http://test") as client:
                yield client

@pytest.fixture
def sync_test_client(mock_db_pool) -> Generator:
    """Create synchronous test client for non-async tests"""
    with patch('main.db_pool', mock_db_pool):
        from main import app
        import main
        main.db_pool = mock_db_pool

        with TestClient(app) as client:
            yield client

@pytest.fixture
def mock_artist_data():
    """Sample artist data for testing"""
    return {
        "artist_id": "123e4567-e89b-12d3-a456-426614174000",
        "artist_name": "Test Artist",
        "normalized_name": "test artist",
        "aliases": ["Artist Test", "TA"],
        "spotify_id": "spotify123",
        "apple_music_id": None,
        "youtube_channel_id": None,
        "soundcloud_id": None,
        "discogs_id": None,
        "musicbrainz_id": "mb123",
        "genre_preferences": ["Electronic", "House"],
        "country": "US",
        "is_verified": False,
        "follower_count": 1000,
        "monthly_listeners": 5000,
        "popularity_score": 75,
        "data_source": "spotify",
        "scrape_timestamp": "2024-01-01T00:00:00",
        "created_at": "2024-01-01T00:00:00",
        "updated_at": "2024-01-01T00:00:00"
    }

@pytest.fixture
def mock_track_data():
    """Sample track data for testing"""
    return {
        "song_id": "223e4567-e89b-12d3-a456-426614174000",
        "track_id": "abc123def456",
        "track_name": "Test Track",
        "normalized_title": "test track",
        "duration_ms": 180000,
        "isrc": "USRC17607839",
        "spotify_id": "spotify_track_123",
        "apple_music_id": None,
        "youtube_id": None,
        "soundcloud_id": None,
        "musicbrainz_id": None,
        "bpm": 128.0,
        "musical_key": "Am",
        "energy": 0.8,
        "danceability": 0.75,
        "valence": 0.6,
        "acousticness": 0.1,
        "instrumentalness": 0.9,
        "liveness": 0.2,
        "speechiness": 0.05,
        "loudness": -5.5,
        "release_date": "2024-01-01",
        "genre": "Electronic",
        "subgenre": "Techno",
        "record_label": "Test Label",
        "is_remix": False,
        "is_mashup": False,
        "is_live": False,
        "is_cover": False,
        "is_instrumental": True,
        "is_explicit": False,
        "remix_type": None,
        "original_artist": None,
        "remixer": None,
        "mashup_components": None,
        "popularity_score": 80,
        "play_count": 10000,
        "track_type": "original",
        "source_context": "album",
        "position_in_source": 1,
        "data_source": "mixesdb",
        "scrape_timestamp": "2024-01-01T00:00:00",
        "primary_artist_id": "123e4567-e89b-12d3-a456-426614174000",
        "created_at": "2024-01-01T00:00:00",
        "updated_at": "2024-01-01T00:00:00"
    }

@pytest.fixture
def mock_setlist_data():
    """Sample setlist data for testing"""
    return {
        "playlist_id": 1,
        "setlist_name": "Summer Mix 2024",
        "normalized_name": "summer mix 2024",
        "description": "A great summer playlist",
        "dj_artist_name": "DJ Test",
        "dj_artist_id": 1,
        "supporting_artists": ["Artist 1", "Artist 2"],
        "event_name": "Festival 2024",
        "event_type": "festival",
        "venue_name": "Main Stage",
        "venue_location": "Los Angeles, CA",
        "venue_capacity": 10000,
        "set_date": "2024-07-01",
        "set_start_time": "20:00:00",
        "set_end_time": "22:00:00",
        "duration_minutes": 120,
        "genre_tags": ["House", "Techno"],
        "mood_tags": ["Energetic", "Uplifting"],
        "bpm_range": [120, 135],
        "total_tracks": 20,
        "spotify_playlist_id": "spotify_playlist_123",
        "soundcloud_playlist_id": None,
        "mixcloud_id": None,
        "youtube_playlist_id": None,
        "data_source": "1001tracklists",
        "scrape_timestamp": "2024-01-01T00:00:00",
        "created_at": "2024-01-01T00:00:00",
        "updated_at": "2024-01-01T00:00:00"
    }
