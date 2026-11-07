"""
Security tests for main REST API endpoints.
Ensures raw exception details and internal error strings are not leaked in HTTP response bodies.
"""

import os
import sys
from unittest.mock import patch
from fastapi.testclient import TestClient

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
for path in (os.path.join(ROOT, "services/rest_api"), os.path.join(ROOT, "services"), ROOT):
    if path not in sys.path:
        sys.path.insert(0, path)

from main import app

client = TestClient(app, raise_server_exceptions=False)

SECRET_ERROR_MSG = "DATABASE_PASSWORD_INTERNAL_SERVER_STACK_TRACE_SECRET_12345"


class MockFailingPool:
    def acquire(self):
        raise RuntimeError(SECRET_ERROR_MSG)


def test_get_graph_nodes_sanitizes_exception():
    """Verify raw exception message is not leaked in /api/graph/nodes error response."""
    with patch("main.db_pool", MockFailingPool()):
        response = client.get("/api/graph/nodes")
        assert response.status_code == 500
        assert SECRET_ERROR_MSG not in response.text
        assert response.json()["detail"] == "Failed to fetch graph nodes"


def test_get_graph_edges_sanitizes_exception():
    """Verify raw exception message is not leaked in /api/graph/edges error response."""
    with patch("main.db_pool", MockFailingPool()):
        response = client.get("/api/graph/edges")
        assert response.status_code == 500
        assert SECRET_ERROR_MSG not in response.text
        assert response.json()["detail"] == "Failed to fetch graph edges"


def test_music_search_sanitizes_exception():
    """Verify raw exception message is not leaked in /api/v1/music-search/{service} error response."""
    with patch("aiohttp.ClientSession", side_effect=RuntimeError(SECRET_ERROR_MSG)):
        response = client.get("/api/v1/music-search/spotify?q=test")
        assert response.status_code == 500
        assert SECRET_ERROR_MSG not in response.text
        assert response.json()["detail"] == "Music search failed"
