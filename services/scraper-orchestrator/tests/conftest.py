"""Pytest fixtures for Scraper Orchestrator tests"""
import pytest
import asyncio
from typing import AsyncGenerator, Generator
from unittest.mock import AsyncMock, MagicMock
from httpx import AsyncClient


@pytest.fixture(scope="session")
def event_loop() -> Generator:
    """Create event loop for async tests"""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
def mock_redis_client():
    """Mock Redis client"""
    redis_mock = MagicMock()
    redis_mock.get.return_value = None
    redis_mock.set.return_value = True
    redis_mock.lpush.return_value = 1
    redis_mock.rpop.return_value = None
    return redis_mock


@pytest.fixture
def mock_db_engine():
    """Mock database engine"""
    engine_mock = AsyncMock()
    return engine_mock
