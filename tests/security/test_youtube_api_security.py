"""
Security Regression Tests for YouTube API Router
Ensures:
1. YouTube search errors never leak raw upstream response bodies/text or credentials.
2. Endpoint resolves API key from database/backend storage or requires credentials without leaking internal details.
"""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from unittest.mock import MagicMock, AsyncMock, patch
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../services/rest_api')))
from routers.youtube_api import router as youtube_router, get_db_pool


class MockConnectionContext:
    def __init__(self, key_value=None):
        self.key_value = key_value

    async def __aenter__(self):
        conn = AsyncMock()
        # Mock quota row
        conn.fetchrow.side_effect = self._fetchrow
        conn.fetchval.return_value = 100
        conn.execute.return_value = None
        return conn

    async def _fetchrow(self, query, *args):
        if "get_api_key" in query:
            if self.key_value:
                return {'key_value': self.key_value}
            return None
        # quota check
        return {'units_used': 0, 'max_units': 9900}

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        pass


class MockPool:
    def __init__(self, key_value=None):
        self.key_value = key_value

    def acquire(self):
        return MockConnectionContext(self.key_value)


def create_test_app(key_value=None):
    app = FastAPI()
    app.include_router(youtube_router)

    async def mock_db_pool():
        return MockPool(key_value)

    app.dependency_overrides[get_db_pool] = mock_db_pool
    return app


def test_youtube_search_without_key_returns_401():
    app = create_test_app(key_value=None)
    client = TestClient(app, raise_server_exceptions=False)

    with patch.dict(os.environ, {}, clear=True):
        response = client.get("/api/v1/youtube/search?query=test")
        assert response.status_code == 401
        data = response.json()
        assert data["detail"] == "YouTube API key not configured"


def test_youtube_search_with_stored_key_does_not_leak_upstream_error_body():
    app = create_test_app(key_value="stored-google-api-key")
    client = TestClient(app, raise_server_exceptions=False)

    class MockAiohttpResponse:
        def __init__(self):
            self.status = 500

        async def text(self):
            return "<html><head><title>Internal Database Error: mysql_connect('root', 'secretpass') failed</title></head></html>"

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc_val, exc_tb):
            pass

    class MockClientSession:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc_val, exc_tb):
            pass

        def get(self, *args, **kwargs):
            return MockAiohttpResponse()

    with patch("aiohttp.ClientSession", MockClientSession):
        response = client.get("/api/v1/youtube/search?query=test")
        assert response.status_code == 500
        data = response.json()
        assert "secretpass" not in response.text
        assert "mysql_connect" not in response.text
        assert "<html>" not in response.text
        assert data["detail"] == "YouTube API request failed"
