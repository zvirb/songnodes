"""
Pytest fixtures and configuration for integration tests.
"""
import pytest
import asyncio
import asyncpg
import httpx
from typing import AsyncGenerator, Dict, Any
from datetime import datetime
import os


# Database configuration
DB_CONFIG = {
    "host": os.getenv("DB_HOST", "localhost"),
    "port": int(os.getenv("DB_PORT", "5433")),
    "user": os.getenv("DB_USER", "musicdb_user"),
    "password": os.getenv("DB_PASSWORD", "musicdb_secure_pass_2024"),
    "database": os.getenv("DB_NAME", "musicdb")
}

# Service URLs
SERVICE_URLS = {
    "api_gateway": os.getenv("API_GATEWAY_URL", "http://localhost:8100"),
    "metadata_enrichment": os.getenv("METADATA_ENRICHMENT_URL", "http://localhost:8020"),
    "dlq_manager": os.getenv("DLQ_MANAGER_URL", "http://localhost:8024"),
}


@pytest.fixture(scope="session")
def event_loop():
    """Create event loop for async tests."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
async def db_connection() -> AsyncGenerator[asyncpg.Connection, None]:
    """Provide database connection for tests."""
    conn = await asyncpg.connect(**DB_CONFIG)
    yield conn
    await conn.close()


@pytest.fixture
async def http_client() -> AsyncGenerator[httpx.AsyncClient, None]:
    """Provide HTTP client for API calls."""
    async with httpx.AsyncClient(timeout=60.0) as client:
        yield client


@pytest.fixture
def service_urls() -> Dict[str, str]:
    """Provide service URLs."""
    return SERVICE_URLS


@pytest.fixture
async def cleanup_test_data(db_connection):
    """Clean up test data after each test."""
    yield

    # Clean up test records
    await db_connection.execute("""
        DELETE FROM bronze_scraped_tracks
        WHERE source = 'integration_test'
    """)

    await db_connection.execute("""
        DELETE FROM silver_enriched_tracks
        WHERE artist_name LIKE 'IntegrationTest%'
    """)


@pytest.fixture
async def test_track_data() -> Dict[str, Any]:
    """Provide test track data."""
    return {
        "artist": "IntegrationTestArtist",
        "title": "IntegrationTestTrack",
        "source_url": "https://test.example.com/track/12345",
        "duration_seconds": 300,
        "genre": "Electronic"
    }


@pytest.fixture
async def insert_bronze_track(db_connection, test_track_data) -> int:
    """Insert a test track into Bronze layer."""
    bronze_id = await db_connection.fetchval("""
        INSERT INTO bronze_scraped_tracks (
            source, raw_json, scraped_at, url
        ) VALUES (
            'integration_test',
            $1::jsonb,
            NOW(),
            $2
        ) RETURNING id
    """, test_track_data, test_track_data["source_url"])

    return bronze_id


@pytest.fixture
async def wait_for_service(http_client) -> callable:
    """Wait for a service to be ready."""
    async def _wait(url: str, max_retries: int = 30, delay: float = 1.0):
        for i in range(max_retries):
            try:
                response = await http_client.get(f"{url}/health")
                if response.status_code == 200:
                    return True
            except Exception:
                pass
            await asyncio.sleep(delay)
        return False

    return _wait


@pytest.fixture(scope="session", autouse=True)
async def verify_services():
    """Verify all required services are running before tests."""
    async with httpx.AsyncClient(timeout=5.0) as client:
        services_ok = True

        for service_name, url in SERVICE_URLS.items():
            try:
                response = await client.get(f"{url}/health")
                if response.status_code != 200:
                    print(f"WARNING: {service_name} at {url} not healthy")
                    services_ok = False
            except Exception as e:
                print(f"WARNING: {service_name} at {url} not reachable: {e}")
                services_ok = False

        if not services_ok:
            pytest.skip("Required services are not running. Start services with: docker compose up -d")
