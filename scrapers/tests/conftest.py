"""
Pytest fixtures and test configuration for scrapers test suite

Provides shared fixtures for:
- Database mocking
- Event loop management
- Pipeline instances
- Sample data
"""
import pytest
import asyncio
from typing import Generator, Dict, Any
from unittest.mock import Mock, AsyncMock, MagicMock
from scrapers.items import EnhancedTrackItem, EnhancedArtistItem


@pytest.fixture(scope="session")
def event_loop() -> Generator:
    """
    Create event loop for async tests.
    Session-scoped to reuse across tests.
    """
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
def mock_db_config() -> Dict[str, Any]:
    """Provide mock database configuration"""
    return {
        'host': 'localhost',
        'port': 5432,
        'database': 'test_musicdb',
        'user': 'test_user',
        'password': 'test_pass'
    }


@pytest.fixture
def mock_connection_pool():
    """Mock asyncpg connection pool"""
    mock_pool = AsyncMock()
    mock_conn = AsyncMock()

    # Configure connection acquisition
    mock_pool.acquire.return_value.__aenter__.return_value = mock_conn
    mock_pool.acquire.return_value.__aexit__.return_value = None

    # Configure transaction
    mock_conn.transaction.return_value.__aenter__.return_value = None
    mock_conn.transaction.return_value.__aexit__.return_value = None

    # Configure common methods
    mock_conn.execute = AsyncMock()
    mock_conn.executemany = AsyncMock()
    mock_conn.fetch = AsyncMock(return_value=[])
    mock_conn.fetchrow = AsyncMock(return_value=None)
    mock_conn.fetchval = AsyncMock(return_value=None)

    return mock_pool, mock_conn


@pytest.fixture
def mock_spider():
    """Mock Scrapy spider instance"""
    spider = Mock()
    spider.name = "test_spider"
    spider.settings = {}
    return spider


@pytest.fixture
def sample_track_item() -> Dict[str, Any]:
    """Create a sample EnhancedTrackItem with all fields populated"""
    item = EnhancedTrackItem()
    item['track_id'] = 'test-track-001'
    item['track_name'] = 'Strobe'
    item['artist_name'] = 'Deadmau5'
    item['normalized_title'] = 'strobe'
    item['duration_ms'] = 636000  # 10:36
    item['bpm'] = 128
    item['musical_key'] = 'A Minor'
    item['energy'] = 0.85
    item['danceability'] = 0.75
    item['valence'] = 0.40
    item['spotify_id'] = 'spotify:track:test123'
    item['isrc'] = 'USUG11000123'
    item['is_remix'] = False
    item['data_source'] = '1001tracklists'
    item['source_url'] = 'https://1001tracklists.com/test'
    item['scrape_timestamp'] = '2025-10-12T10:00:00'
    return dict(item)


@pytest.fixture
def sample_artist_item() -> Dict[str, Any]:
    """Create a sample EnhancedArtistItem"""
    item = EnhancedArtistItem()
    item['artist_name'] = 'Carl Cox'
    item['normalized_name'] = 'carl cox'
    item['genre_preferences'] = ['Techno', 'House']
    item['country'] = 'GB'
    item['spotify_id'] = 'spotify:artist:test456'
    item['popularity_score'] = 85
    item['data_source'] = 'spotify'
    return dict(item)


@pytest.fixture
def sample_track_items_batch() -> list:
    """Create a batch of sample track items for testing"""
    artists = [
        ('Deadmau5', 'Strobe', 128, 'A Minor'),
        ('Carl Cox', 'I Want You', 130, 'E Minor'),
        ('Eric Prydz', 'Opus', 126, 'C Minor'),
        ('Nina Kraviz', 'Ghetto Kraviz', 132, 'F# Minor'),
        ('Adam Beyer', 'Your Mind', 135, 'D Minor'),
    ]

    items = []
    for i, (artist, track, bpm, key) in enumerate(artists):
        item = EnhancedTrackItem()
        item['track_id'] = f'test-track-{i:03d}'
        item['track_name'] = track
        item['artist_name'] = artist
        item['normalized_title'] = track.lower()
        item['bpm'] = bpm
        item['musical_key'] = key
        item['energy'] = 0.80 + (i * 0.02)
        item['data_source'] = 'test'
        item['source_url'] = f'https://test.com/track/{i}'
        items.append(dict(item))

    return items


@pytest.fixture
def sample_playlist_item() -> Dict[str, Any]:
    """Create a sample playlist/setlist item"""
    return {
        'setlist_name': '2015-08-20 - Deadmau5 @ Creamfields UK',
        'data_source': '1001tracklists',
        'source_url': 'https://1001tracklists.com/playlist/test',
        'event_date': '2015-08-20',
        'tracklist_count': 25,
        'parsing_version': 'v1.2.0',
        'playlist_type': 'DJ Set'
    }


@pytest.fixture
def mock_validation_pipeline():
    """Mock validation pipeline"""
    from scrapers.pipelines.validation_pipeline import ValidationPipeline

    pipeline = ValidationPipeline()
    return pipeline


@pytest.fixture
def mock_persistence_pipeline(mock_db_config, mock_connection_pool):
    """Mock persistence pipeline with database mocks"""
    from scrapers.pipelines.persistence_pipeline import PersistencePipeline

    pipeline = PersistencePipeline(mock_db_config)
    mock_pool, mock_conn = mock_connection_pool

    # Set up the mocked pool
    pipeline.connection_pool = mock_pool
    pipeline._pool_ready.set()

    return pipeline, mock_pool, mock_conn


@pytest.fixture
def mock_asyncio_loop():
    """Mock asyncio event loop for testing event loop cleanup"""
    mock_loop = Mock()
    mock_loop.is_running = Mock(return_value=True)
    mock_loop.call_soon_threadsafe = Mock()
    mock_loop.stop = Mock()

    # Mock all_tasks
    async def mock_gather(*args, **kwargs):
        return [asyncio.CancelledError() for _ in args]

    mock_loop.run_until_complete = Mock(side_effect=lambda coro: asyncio.run(coro))

    return mock_loop


@pytest.fixture
async def async_mock_tasks():
    """Create mock async tasks for testing cancellation"""
    async def dummy_task():
        await asyncio.sleep(10)

    tasks = [
        asyncio.create_task(dummy_task()),
        asyncio.create_task(dummy_task()),
        asyncio.create_task(dummy_task())
    ]

    yield tasks

    # Cleanup
    for task in tasks:
        if not task.done():
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass


@pytest.fixture
def capture_logs(caplog):
    """Capture logs for verification in tests"""
    import logging
    caplog.set_level(logging.DEBUG)
    return caplog


@pytest.fixture
def bronze_layer_mock_data():
    """Mock data for bronze layer testing"""
    return {
        'bronze_tracks': [
            {
                'source': '1001tracklists',
                'source_url': 'https://1001tracklists.com/track/1',
                'source_track_id': 'track-001',
                'scraper_version': 'v1.0.0',
                'raw_json': '{"track_name": "Test Track", "artist_name": "Test Artist"}',
                'artist_name': 'Test Artist',
                'track_title': 'Test Track'
            }
        ],
        'bronze_playlists': [
            {
                'source': '1001tracklists',
                'source_url': 'https://1001tracklists.com/playlist/1',
                'source_playlist_id': 'playlist-001',
                'scraper_version': 'v1.0.0',
                'raw_json': '{"setlist_name": "Test Playlist"}',
                'playlist_name': 'Test Playlist',
                'artist_name': 'DJ Test',
                'event_name': 'Test Event',
                'event_date': '2025-10-12'
            }
        ]
    }


@pytest.fixture
def silver_layer_mock_data():
    """Mock data for silver layer testing"""
    return {
        'silver_tracks': [
            {
                'bronze_id': 123,
                'artist_name': 'Deadmau5',
                'track_title': 'Strobe',
                'spotify_id': 'spotify:track:test',
                'isrc': 'USUG11000123',
                'bpm': 128.0,
                'key': 'A Minor',
                'validation_status': 'valid',
                'data_quality_score': 0.85
            }
        ],
        'silver_playlists': [
            {
                'bronze_id': 456,
                'playlist_name': 'Test Playlist',
                'artist_name': 'DJ Test',
                'event_date': '2025-10-12',
                'track_count': 25,
                'validation_status': 'valid',
                'data_quality_score': 0.90
            }
        ]
    }


@pytest.fixture(autouse=True)
def reset_processed_items(request):
    """
    Automatically reset processed items tracking between tests.
    This prevents cross-test contamination.
    """
    # Only apply to integration tests
    if 'integration' in request.keywords:
        from scrapers.pipelines.persistence_pipeline import PersistencePipeline

        # This will run after each test
        yield

        # Reset logic would go here if needed
        # For now, each test creates its own pipeline instance
    else:
        yield


@pytest.fixture
def mock_secrets_manager():
    """Mock the secrets manager module"""
    with pytest.mock.patch('scrapers.pipelines.persistence_pipeline.get_database_config') as mock_get_config:
        mock_get_config.return_value = {
            'host': 'localhost',
            'port': 5432,
            'database': 'test_musicdb',
            'user': 'test_user',
            'password': 'test_pass'
        }
        yield mock_get_config


# Custom markers
def pytest_configure(config):
    """Register custom markers"""
    config.addinivalue_line(
        "markers", "unit: Unit tests that don't require external dependencies"
    )
    config.addinivalue_line(
        "markers", "integration: Integration tests that may require database/external services"
    )
    config.addinivalue_line(
        "markers", "slow: Tests that take significant time to run"
    )
    config.addinivalue_line(
        "markers", "asyncio: Async tests that require event loop"
    )


# Test database setup/teardown (if needed for real integration tests)
@pytest.fixture(scope="session")
def database_setup():
    """
    Setup test database for integration tests.
    Only used when running against real database.
    """
    # This would create test database schema
    # For now, we use mocks, so this is a placeholder
    yield
    # Teardown logic here
