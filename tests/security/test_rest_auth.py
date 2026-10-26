import os
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from unittest.mock import patch
import sys

# Insert rest_api directory so it resolves correctly
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../services/rest_api')))
from security.auth import register_security, _401_limits

@pytest.fixture
def clear_401_limits():
    _401_limits.clear()

def create_test_app(token=None):
    if token is not None:
        os.environ["SONGNODES_API_TOKEN"] = token
    else:
        if "SONGNODES_API_TOKEN" in os.environ:
            del os.environ["SONGNODES_API_TOKEN"]

    app = FastAPI()

    @app.get("/health")
    def health():
        return {"status": "ok"}

    @app.get("/api/v1/tracks")
    def list_tracks():
        return {"tracks": []}

    @app.get("/api/v1/jobs")
    def list_jobs():
        return {"jobs": []}

    @app.post("/api/v1/artists/dirty")
    def write_artist():
        return {"status": "dirty"}

    register_security(app)
    return app

def test_auth_unset_open(clear_401_limits):
    app = create_test_app(token=None)
    client = TestClient(app)

    # Write route should be open
    assert client.post("/api/v1/artists/dirty").status_code == 200

    # Sensitive GET route should be open
    assert client.get("/api/v1/jobs").status_code == 200

    # Read-only routes and health should be open
    assert client.get("/api/v1/tracks").status_code == 200
    assert client.get("/health").status_code == 200

def test_auth_set_requires_token(clear_401_limits):
    app = create_test_app(token="secret-token")
    client = TestClient(app)

    # 401 without token
    assert client.post("/api/v1/artists/dirty").status_code == 401
    assert client.get("/api/v1/jobs").status_code == 401

    # 401 with wrong token
    assert client.post("/api/v1/artists/dirty", headers={"Authorization": "Bearer wrong"}).status_code == 401
    assert client.post("/api/v1/artists/dirty", headers={"X-API-Token": "wrong"}).status_code == 401

    # 200 with correct token
    assert client.post("/api/v1/artists/dirty", headers={"Authorization": "Bearer secret-token"}).status_code == 200
    assert client.post("/api/v1/artists/dirty", headers={"X-API-Token": "secret-token"}).status_code == 200
    assert client.get("/api/v1/jobs", headers={"Authorization": "Bearer secret-token"}).status_code == 200

    # Health and read-only routes are still open without token
    assert client.get("/health").status_code == 200
    assert client.get("/api/v1/tracks").status_code == 200

def test_rate_limit(clear_401_limits):
    app = create_test_app(token="secret-token")
    client = TestClient(app)

    # 5 attempts fail with 401
    for _ in range(5):
        assert client.post("/api/v1/artists/dirty", headers={"Authorization": "Bearer wrong"}).status_code == 401

    # The 6th attempt is blocked entirely
    response = client.post("/api/v1/artists/dirty", headers={"Authorization": "Bearer secret-token"})
    assert response.status_code == 401
