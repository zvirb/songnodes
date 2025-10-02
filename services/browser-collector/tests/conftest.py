"""Pytest fixtures"""
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
