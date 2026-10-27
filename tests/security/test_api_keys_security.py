"""
Security Regression Tests for API Keys Router
Ensures database error details and sensitive trace information are never leaked in API response details.
"""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from unittest.mock import MagicMock, AsyncMock
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../services/rest_api')))
from routers.api_keys import router as api_keys_router, get_db_pool


class FauxDatabaseError(Exception):
    """Simulated internal database exception containing sensitive connection strings."""
    pass


class MockFailingPool:
    def acquire(self):
        return MockFailingConnectionContext()


class MockFailingConnectionContext:
    async def __aenter__(self):
        raise FauxDatabaseError("FATAL: connect failed for user 'admin' pass='supersecretpass123' at host 10.0.0.5")

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        pass


def create_mock_failing_app():
    app = FastAPI()
    app.include_router(api_keys_router)

    async def mock_db_pool():
        return MockFailingPool()

    app.dependency_overrides[get_db_pool] = mock_db_pool
    return app


def test_api_key_requirements_does_not_leak_exception_details():
    app = create_mock_failing_app()
    client = TestClient(app, raise_server_exceptions=False)

    response = client.get("/api/v1/api-keys/requirements")
    assert response.status_code == 500
    data = response.json()
    assert "supersecretpass123" not in response.text
    assert "FATAL" not in response.text
    assert data["detail"] == "Failed to fetch API key requirements"


def test_get_api_keys_does_not_leak_exception_details():
    app = create_mock_failing_app()
    client = TestClient(app, raise_server_exceptions=False)

    response = client.get("/api/v1/api-keys")
    assert response.status_code == 500
    data = response.json()
    assert "supersecretpass123" not in response.text
    assert "FATAL" not in response.text
    assert data["detail"] == "Failed to fetch API keys"


def test_create_api_key_does_not_leak_exception_details():
    app = create_mock_failing_app()
    client = TestClient(app, raise_server_exceptions=False)

    payload = {
        "service_name": "spotify",
        "key_name": "client_id",
        "key_value": "test_val"
    }
    response = client.post("/api/v1/api-keys", json=payload)
    assert response.status_code == 500
    data = response.json()
    assert "supersecretpass123" not in response.text
    assert "FATAL" not in response.text
    assert data["detail"] == "Failed to store API key"


def test_delete_api_key_does_not_leak_exception_details():
    app = create_mock_failing_app()
    client = TestClient(app, raise_server_exceptions=False)

    response = client.delete("/api/v1/api-keys/spotify/client_id")
    assert response.status_code == 500
    data = response.json()
    assert "supersecretpass123" not in response.text
    assert "FATAL" not in response.text
    assert data["detail"] == "Failed to delete API key"


def test_test_api_key_does_not_leak_exception_details():
    app = create_mock_failing_app()
    client = TestClient(app, raise_server_exceptions=False)

    payload = {
        "service_name": "spotify",
        "key_name": "client_id"
    }
    response = client.post("/api/v1/api-keys/test", json=payload)
    assert response.status_code == 500
    data = response.json()
    assert "supersecretpass123" not in response.text
    assert "FATAL" not in response.text
    assert data["detail"] == "Failed to test API key"
