"""Pytest fixtures for Metadata Enrichment tests"""
import pytest
import asyncio
from typing import Generator
from unittest.mock import AsyncMock, MagicMock


@pytest.fixture(scope="session")
def event_loop() -> Generator:
    """Create event loop for async tests"""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
def mock_redis_client():
    """Mock Redis client"""
    redis_mock = AsyncMock()
    redis_mock.get.return_value = None
    redis_mock.set.return_value = True
    return redis_mock
