"""
Security tests for User Authentication router endpoints.
Ensures raw exception details, network error traces, upstream response text,
and claims decoding errors are not leaked in HTTP response bodies.
"""

import os
import sys
import urllib.parse
from unittest.mock import AsyncMock, patch
import httpx
import pytest
from fastapi.testclient import TestClient

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
for path in (os.path.join(ROOT, "services/rest_api"), os.path.join(ROOT, "services"), ROOT):
    if path not in sys.path:
        sys.path.insert(0, path)

from main import app
from routers import user_auth

client = TestClient(app, raise_server_exceptions=False)

SECRET_ERROR_MSG = "INTERNAL_NETWORK_STACK_TRACE_SECRET_12345"
SECRET_UPSTREAM_BODY = "UPSTREAM_BODY_CONTAINING_SENSITIVE_CREDENTIALS_AND_KEYS"
SECRET_CLAIMS_ERROR = "JWT_DECODE_INTERNAL_STATE_LEAK_SECRET_67890"


@pytest.fixture(autouse=True)
def duo_auth_env(monkeypatch):
    """Set standard Duo and JWT environment variables for testing."""
    monkeypatch.setenv("JWT_SECRET_KEY", "test_jwt_secret_key_minimum_length_32_bytes_long")
    monkeypatch.setenv("DUO_CLIENT_ID", "DIEXAMPLECLIENTID123")
    monkeypatch.setenv("DUO_CLIENT_SECRET", "test_duo_client_secret_xyz123abc456")
    monkeypatch.setenv("DUO_API_HOSTNAME", "api-test.duosecurity.com")
    monkeypatch.setenv("AUTH_USERNAME", "dj_test")
    monkeypatch.setenv("AUTH_PASSWORD", "correct_horse_battery_staple")
    monkeypatch.setenv("DISABLE_REDIS", "true")
    user_auth._AUTH_STATE_STORE.clear()


def _get_auth_state():
    """Trigger login to generate a valid pending auth state parameter."""
    login_resp = client.post(
        "/api/v1/auth/login",
        json={"username": "dj_test", "password": "correct_horse_battery_staple"},
    )
    assert login_resp.status_code == 200
    query = urllib.parse.parse_qs(urllib.parse.urlparse(login_resp.json()["duo_auth_url"]).query)
    return query["state"][0]


@patch("routers.user_auth.httpx.AsyncClient.post", new_callable=AsyncMock)
def test_duo_callback_token_endpoint_request_error_sanitized(mock_post):
    """Verify network exceptions when calling Duo token endpoint do not leak in HTTP 502 response."""
    state = _get_auth_state()
    mock_post.side_effect = httpx.ConnectError(SECRET_ERROR_MSG)

    resp = client.get("/api/v1/auth/duo/callback", params={"state": state, "code": "valid_code"})
    assert resp.status_code == 502
    assert SECRET_ERROR_MSG not in resp.text
    assert resp.json()["detail"] == "Failed to communicate with Duo token endpoint"


@patch("routers.user_auth.httpx.AsyncClient.post", new_callable=AsyncMock)
def test_duo_callback_upstream_failure_body_sanitized(mock_post):
    """Verify raw upstream error response bodies do not leak in HTTP 400 response."""
    state = _get_auth_state()
    mock_post.return_value = httpx.Response(
        status_code=400,
        text=SECRET_UPSTREAM_BODY,
    )

    resp = client.get("/api/v1/auth/duo/callback", params={"state": state, "code": "valid_code"})
    assert resp.status_code == 400
    assert SECRET_UPSTREAM_BODY not in resp.text
    assert resp.json()["detail"] == "Duo token exchange failed"


@patch("routers.user_auth.jwt.decode")
@patch("routers.user_auth.httpx.AsyncClient.post", new_callable=AsyncMock)
def test_duo_callback_claims_decoding_exception_sanitized(mock_post, mock_jwt_decode):
    """Verify raw JWT claims decoding exception message is not leaked in HTTP 400 response."""
    state = _get_auth_state()
    mock_post.return_value = httpx.Response(
        status_code=200,
        json={"id_token": "mocked.id.token"},
    )
    mock_jwt_decode.side_effect = RuntimeError(SECRET_CLAIMS_ERROR)

    resp = client.get("/api/v1/auth/duo/callback", params={"state": state, "code": "valid_code"})
    assert resp.status_code == 400
    assert SECRET_CLAIMS_ERROR not in resp.text
    assert resp.json()["detail"] == "Invalid id_token claims"
