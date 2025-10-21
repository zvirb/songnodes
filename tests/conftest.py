"""
Pytest configuration and shared fixtures for SongNodes testing.
"""

import pytest
import asyncio
import os
import tempfile
import shutil
from typing import AsyncGenerator, Generator
import docker
import redis
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from testcontainers.postgres import PostgresContainer
from testcontainers.redis import RedisContainer
from httpx import AsyncClient

# Pytest configuration
pytest_plugins = ["pytest_asyncio"]


@pytest.fixture(scope="session")
def event_loop():
    """Create an event loop for async tests."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session")
def docker_client():
    """Docker client for container management."""
    return docker.from_env()


@pytest.fixture(scope="session")
def postgres_container():
    """PostgreSQL test container."""
    with PostgresContainer("postgres:15-alpine") as postgres:
        # Wait for container to be ready
        postgres.get_connection_url()
        yield postgres


@pytest.fixture(scope="session")
def redis_container():
    """Redis test container."""
    with RedisContainer("redis:7-alpine") as redis_c:
        yield redis_c


@pytest.fixture(scope="session")
def test_database_url(postgres_container):
    """Test database URL."""
    return postgres_container.get_connection_url()


@pytest.fixture(scope="session")
def test_redis_url(redis_container):
    """Test Redis URL."""
    return f"redis://{redis_container.get_container_host_ip()}:{redis_container.get_exposed_port(6379)}"


@pytest.fixture
def test_db_engine(test_database_url):
    """Test database engine."""
    engine = create_engine(test_database_url)
    yield engine
    engine.dispose()


@pytest.fixture
def test_db_session(test_db_engine):
    """Test database session."""
    Session = sessionmaker(bind=test_db_engine)
    session = Session()
    yield session
    session.rollback()
    session.close()


@pytest.fixture
def test_redis_client(test_redis_url):
    """Test Redis client."""
    client = redis.from_url(test_redis_url, decode_responses=True)
    yield client
    # Clean up Redis data after test
    client.flushall()
    client.close()


@pytest.fixture
def temp_directory():
    """Temporary directory for test files."""
    temp_dir = tempfile.mkdtemp()
    yield temp_dir
    shutil.rmtree(temp_dir)


@pytest.fixture
async def async_client():
    """Async HTTP client for API testing."""
    async with AsyncClient() as client:
        yield client


@pytest.fixture
def mock_environment():
    """Mock environment variables for testing."""
    original_env = os.environ.copy()
    
    # Set test environment variables
    test_env = {
        "ENVIRONMENT": "test",
        "LOG_LEVEL": "INFO",
        "DATABASE_URL": "postgresql://test:test@localhost:5432/test",
        "REDIS_HOST": "localhost",
        "REDIS_PORT": "6379",
        "RABBITMQ_HOST": "localhost",
        "RABBITMQ_PORT": "5672",
        "JWT_SECRET": "test_secret",
        "API_VERSION": "v1"
    }
    
    os.environ.update(test_env)
    yield test_env
    
    # Restore original environment
    os.environ.clear()
    os.environ.update(original_env)


@pytest.fixture
def sample_track_data():
    """Sample track data for testing."""
    return {
        "track_name": "Test Track",
        "primary_artists": ["Test Artist"],
        "featured_artists": [],
        "remixer_artists": [],
        "is_remix": False,
        "is_mashup": False,
        "mashup_components": [],
        "start_time": "00:00:00",
        "track_type": "Original"
    }


@pytest.fixture
def sample_setlist_data():
    """Sample setlist data for testing."""
    return {
        "setlist_name": "Test Setlist",
        "dj_artist_name": "Test DJ",
        "event_name": "Test Event",
        "venue_name": "Test Venue",
        "set_date": "2024-01-01",
        "last_updated_date": None
    }


@pytest.fixture
def sample_scraping_task():
    """Sample scraping task for testing."""
    return {
        "scraper": "1001tracklists",
        "url": "https://example.com/test",
        "priority": "medium",
        "params": {},
        "retry_count": 0,
        "max_retries": 3
    }


@pytest.fixture
def mock_scrapy_settings():
    """Mock Scrapy settings for spider testing."""
    return {
        "USER_AGENT": "test-spider",
        "ROBOTSTXT_OBEY": False,
        "CONCURRENT_REQUESTS": 1,
        "DOWNLOAD_DELAY": 0,
        "RANDOMIZE_DOWNLOAD_DELAY": False,
        "COOKIES_ENABLED": False,
        "TELNETCONSOLE_ENABLED": False,
        "LOG_LEVEL": "ERROR"
    }


@pytest.fixture
def performance_test_config():
    """Configuration for performance tests."""
    return {
        "target_host": "http://localhost:8088",
        "users": 10,
        "spawn_rate": 2,
        "run_time": "60s",
        "thresholds": {
            "avg_response_time": 100,  # ms
            "p95_response_time": 200,  # ms
            "error_rate": 0.01,  # 1%
            "requests_per_second": 100
        }
    }


# Pytest markers
def pytest_configure(config):
    """Configure pytest markers."""
    config.addinivalue_line(
        "markers", "unit: Unit tests"
    )
    config.addinivalue_line(
        "markers", "integration: Integration tests"
    )
    config.addinivalue_line(
        "markers", "performance: Performance tests"
    )
    config.addinivalue_line(
        "markers", "e2e: End-to-end tests"
    )
    config.addinivalue_line(
        "markers", "slow: Slow running tests"
    )
    config.addinivalue_line(
        "markers", "external: Tests requiring external services"
    )


# Test collection hooks
def pytest_collection_modifyitems(config, items):
    """Modify test collection to add markers based on path."""
    for item in items:
        # Add markers based on test file location
        if "unit" in str(item.fspath):
            item.add_marker(pytest.mark.unit)
        elif "integration" in str(item.fspath):
            item.add_marker(pytest.mark.integration)
        elif "performance" in str(item.fspath):
            item.add_marker(pytest.mark.performance)
        elif "e2e" in str(item.fspath):
            item.add_marker(pytest.mark.e2e)
        
        # Mark external tests
        if hasattr(item, 'get_closest_marker'):
            if item.get_closest_marker('external'):
                item.add_marker(pytest.mark.skipif(
                    config.getoption("--no-external", default=False),
                    reason="External tests disabled"
                ))


def pytest_addoption(parser):
    """Add custom command line options."""
    parser.addoption(
        "--no-external",
        action="store_true",
        default=False,
        help="Skip tests that require external services"
    )
    parser.addoption(
        "--performance",
        action="store_true",
        default=False,
        help="Run performance tests"
    )
    parser.addoption(
        "--coverage-fail-under",
        type=int,
        default=90,
        help="Fail if coverage is under this percentage"
    )
