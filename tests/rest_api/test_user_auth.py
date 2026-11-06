"""Unit tests for Cisco Duo Web SDK v4 (OIDC) Universal Prompt and User Authentication router."""

import json
import time
import urllib.parse
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
import jwt
import respx
import httpx

import sys
sys.path.append("services/rest_api")
sys.path.append("services")

from routers.user_auth import (
    router,
    register,
    COOKIE_NAME,
    hash_password,
    verify_password,
    verify_user_credentials,
    create_session_token,
    verify_session_token,
    store_auth_state,
    get_duo_config,
)


@pytest.fixture
def app():
    """Create test FastAPI application with user_auth router registered."""
    test_app = FastAPI()
    register(test_app)
    return test_app


@pytest.fixture
def client(app):
    """Test client for user_auth router."""
    return TestClient(app)


@pytest.fixture
def duo_env(monkeypatch):
    """Set up standard Duo and Auth environment variables for tests."""
    monkeypatch.setenv("DUO_CLIENT_ID", "DIEXAMPLECLIENTID123")
    monkeypatch.setenv("DUO_CLIENT_SECRET", "supersecretsigningskeyfortestcases12345")
    monkeypatch.setenv("DUO_API_HOSTNAME", "api-test.duosecurity.com")
    monkeypatch.setenv("DUO_REDIRECT_URI", "https://song.aiwfe.com/api/v1/auth/duo/callback")
    monkeypatch.setenv("JWT_SECRET_KEY", "jwt-test-signing-key-for-unit-tests-1234567")
    monkeypatch.setenv("AUTH_USERNAME", "dj_test")
    monkeypatch.setenv("AUTH_PASSWORD", "correct_horse_battery_staple")
    return {
        "client_id": "DIEXAMPLECLIENTID123",
        "client_secret": "supersecretsigningskeyfortestcases12345",
        "api_hostname": "api-test.duosecurity.com",
        "redirect_uri": "https://song.aiwfe.com/api/v1/auth/duo/callback",
        "jwt_secret": "jwt-test-signing-key-for-unit-tests-1234567",
        "username": "dj_test",
        "password": "correct_horse_battery_staple",
    }


# ============================================================================
# Password Hashing and Verification Unit Tests
# ============================================================================

def test_password_hashing_and_verification():
    raw_pw = "UltraSecurePassword2026!"
    hashed = hash_password(raw_pw)

    assert hashed.startswith("pbkdf2_sha256$")
    assert verify_password(raw_pw, hashed) is True
    assert verify_password("WrongPassword!", hashed) is False
    assert verify_password("", hashed) is False


def test_verify_user_credentials_env(duo_env, monkeypatch):
    assert verify_user_credentials("dj_test", "correct_horse_battery_staple") is True
    assert verify_user_credentials("dj_test", "wrong_password") is False
    assert verify_user_credentials("unknown_user", "correct_horse_battery_staple") is False

    # Test with password hash
    pw_hash = hash_password("hashed_secret")
    monkeypatch.setenv("AUTH_PASSWORD_HASH", pw_hash)
    assert verify_user_credentials("dj_test", "hashed_secret") is True
    assert verify_user_credentials("dj_test", "wrong_secret") is False

    # Test with AUTH_USERS JSON mapping
    users_dict = {
        "alice": "alice_secret",
        "bob": hash_password("bob_secret"),
    }
    monkeypatch.setenv("AUTH_USERS", json.dumps(users_dict))
    assert verify_user_credentials("alice", "alice_secret") is True
    assert verify_user_credentials("alice", "wrong") is False
    assert verify_user_credentials("bob", "bob_secret") is True
    assert verify_user_credentials("bob", "wrong") is False


# ============================================================================
# Session Token Unit Tests
# ============================================================================

def test_create_and_verify_session_token(duo_env):
    user_info = {
        "sub": "dj_test",
        "username": "dj_test",
        "email": "dj_test@songnodes.local",
        "auth_method": "duo_universal_prompt",
    }
    token = create_session_token(user_info, secret_key="test-secret", expires_in=3600)
    decoded = verify_session_token(token, secret_key="test-secret")

    assert decoded["sub"] == "dj_test"
    assert decoded["username"] == "dj_test"
    assert decoded["email"] == "dj_test@songnodes.local"
    assert decoded["auth_method"] == "duo_universal_prompt"


def test_verify_session_token_expired(duo_env):
    token = create_session_token({"sub": "dj_test"}, secret_key="test-secret", expires_in=-10)
    with pytest.raises(jwt.ExpiredSignatureError):
        verify_session_token(token, secret_key="test-secret")


# ============================================================================
# POST /api/v1/auth/login Endpoint Tests
# ============================================================================

def test_login_success(client, duo_env):
    response = client.post(
        "/api/v1/auth/login",
        json={"username": "dj_test", "password": "correct_horse_battery_staple"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "duo_auth_url" in data
    assert "session_id" in data
    assert len(data["session_id"]) > 10

    # Validate generated Duo OIDC authorization URL structure
    parsed = urllib.parse.urlparse(data["duo_auth_url"])
    assert parsed.scheme == "https"
    assert parsed.netloc == "api-test.duosecurity.com"
    assert parsed.path == "/oauth/v1/authorize"

    query = urllib.parse.parse_qs(parsed.query)
    assert query["response_type"] == ["code"]
    assert query["client_id"] == ["DIEXAMPLECLIENTID123"]
    assert query["redirect_uri"] == ["https://song.aiwfe.com/api/v1/auth/duo/callback"]
    assert query["scope"] == ["openid"]
    assert query["duo_uname"] == ["dj_test"]
    assert len(query["state"][0]) > 10
    assert len(query["nonce"][0]) > 10


def test_login_invalid_password(client, duo_env):
    response = client.post(
        "/api/v1/auth/login",
        json={"username": "dj_test", "password": "incorrect_password"},
    )
    assert response.status_code == 401
    assert "Invalid username or password" in response.json()["detail"]


def test_login_missing_fields(client, duo_env):
    response = client.post("/api/v1/auth/login", json={"username": "dj_test"})
    assert response.status_code == 422


# ============================================================================
# GET /api/v1/auth/duo/callback Endpoint Tests
# ============================================================================

@respx.mock
def test_duo_callback_success(client, duo_env):
    # Step 1: Perform login to generate state and nonce
    login_resp = client.post(
        "/api/v1/auth/login",
        json={"username": "dj_test", "password": "correct_horse_battery_staple"},
    )
    assert login_resp.status_code == 200
    duo_auth_url = login_resp.json()["duo_auth_url"]
    query = urllib.parse.parse_qs(urllib.parse.urlparse(duo_auth_url).query)
    state = query["state"][0]
    nonce = query["nonce"][0]

    # Create Duo mock id_token with matching nonce
    id_token_payload = {
        "sub": "dj_test",
        "preferred_username": "dj_test",
        "email": "dj_test@songnodes.local",
        "nonce": nonce,
        "iss": "https://api-test.duosecurity.com/oauth/v1/token",
        "aud": "DIEXAMPLECLIENTID123",
        "exp": int(time.time()) + 300,
        "iat": int(time.time()),
    }
    mock_id_token = jwt.encode(
        id_token_payload,
        duo_env["client_secret"],
        algorithm="HS256",
    )

    # Mock Duo token endpoint
    respx.post("https://api-test.duosecurity.com/oauth/v1/token").respond(
        status_code=200,
        json={
            "id_token": mock_id_token,
            "access_token": "mock_access_token_12345",
            "token_type": "Bearer",
            "expires_in": 300,
        },
    )

    # Step 2: Call callback endpoint with authorization code and state
    callback_resp = client.get(
        "/api/v1/auth/duo/callback",
        params={"state": state, "code": "valid_duo_auth_code_xyz"},
    )

    assert callback_resp.status_code == 200
    callback_data = callback_resp.json()
    assert callback_data["authenticated"] is True
    assert callback_data["user"]["username"] == "dj_test"
    assert callback_data["user"]["auth_method"] == "duo_universal_prompt"

    # Verify HTTP-only session cookie is set
    assert COOKIE_NAME in callback_resp.cookies
    session_cookie = callback_resp.cookies[COOKIE_NAME]
    payload = verify_session_token(session_cookie, secret_key=duo_env["jwt_secret"])
    assert payload["username"] == "dj_test"


@respx.mock
def test_duo_callback_with_redirect_url(client, duo_env):
    login_resp = client.post(
        "/api/v1/auth/login",
        json={"username": "dj_test", "password": "correct_horse_battery_staple"},
    )
    duo_auth_url = login_resp.json()["duo_auth_url"]
    query = urllib.parse.parse_qs(urllib.parse.urlparse(duo_auth_url).query)
    state = query["state"][0]
    nonce = query["nonce"][0]

    mock_id_token = jwt.encode(
        {"sub": "dj_test", "nonce": nonce, "exp": int(time.time()) + 300},
        duo_env["client_secret"],
        algorithm="HS256",
    )

    respx.post("https://api-test.duosecurity.com/oauth/v1/token").respond(
        status_code=200,
        json={"id_token": mock_id_token},
    )

    callback_resp = client.get(
        "/api/v1/auth/duo/callback",
        params={
            "state": state,
            "code": "code123",
            "redirect_url": "/dashboard",
        },
        follow_redirects=False,
    )

    assert callback_resp.status_code == 302
    assert callback_resp.headers["location"] == "/dashboard"
    assert COOKIE_NAME in callback_resp.cookies


def test_duo_callback_error_param(client, duo_env):
    response = client.get(
        "/api/v1/auth/duo/callback",
        params={"state": "statetest", "error": "access_denied", "error_description": "User cancelled"},
    )
    assert response.status_code == 400
    assert "User cancelled" in response.json()["detail"]


def test_duo_callback_missing_code(client, duo_env):
    response = client.get(
        "/api/v1/auth/duo/callback",
        params={"state": "statetest"},
    )
    assert response.status_code == 400
    assert "Missing authorization code" in response.json()["detail"]


def test_duo_callback_invalid_or_expired_state(client, duo_env):
    response = client.get(
        "/api/v1/auth/duo/callback",
        params={"state": "nonexistent_or_expired_state", "code": "code123"},
    )
    assert response.status_code == 400
    assert "Invalid or expired state" in response.json()["detail"]


@respx.mock
def test_duo_callback_nonce_mismatch(client, duo_env):
    login_resp = client.post(
        "/api/v1/auth/login",
        json={"username": "dj_test", "password": "correct_horse_battery_staple"},
    )
    query = urllib.parse.parse_qs(urllib.parse.urlparse(login_resp.json()["duo_auth_url"]).query)
    state = query["state"][0]

    # Token with wrong nonce
    mock_id_token = jwt.encode(
        {"sub": "dj_test", "nonce": "completely_wrong_nonce", "exp": int(time.time()) + 300},
        duo_env["client_secret"],
        algorithm="HS256",
    )

    respx.post("https://api-test.duosecurity.com/oauth/v1/token").respond(
        status_code=200,
        json={"id_token": mock_id_token},
    )

    resp = client.get("/api/v1/auth/duo/callback", params={"state": state, "code": "code123"})
    assert resp.status_code == 400
    assert "Nonce mismatch" in resp.json()["detail"]


@respx.mock
def test_duo_callback_token_endpoint_failure(client, duo_env):
    login_resp = client.post(
        "/api/v1/auth/login",
        json={"username": "dj_test", "password": "correct_horse_battery_staple"},
    )
    query = urllib.parse.parse_qs(urllib.parse.urlparse(login_resp.json()["duo_auth_url"]).query)
    state = query["state"][0]

    respx.post("https://api-test.duosecurity.com/oauth/v1/token").respond(
        status_code=400,
        text="invalid_grant",
    )

    resp = client.get("/api/v1/auth/duo/callback", params={"state": state, "code": "code123"})
    assert resp.status_code == 400
    assert "Duo token exchange failed" in resp.json()["detail"]


# ============================================================================
# GET /api/v1/auth/me Endpoint Tests
# ============================================================================

def test_me_cloudflare_access_header(client):
    response = client.get(
        "/api/v1/auth/me",
        headers={"cf-access-authenticated-user-email": "resident_dj@nightclub.com"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["authenticated"] is True
    assert data["user"]["username"] == "resident_dj"
    assert data["user"]["email"] == "resident_dj@nightclub.com"
    assert data["user"]["auth_method"] == "cloudflare_access"


def test_me_session_cookie(client, duo_env):
    session_token = create_session_token(
        {
            "sub": "dj_test",
            "username": "dj_test",
            "email": "dj_test@songnodes.local",
            "auth_method": "duo_universal_prompt",
            "session_id": "sess_abc123",
        },
        secret_key=duo_env["jwt_secret"],
    )

    client.cookies.set(COOKIE_NAME, session_token)
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 200
    data = response.json()
    assert data["authenticated"] is True
    assert data["user"]["username"] == "dj_test"
    assert data["user"]["email"] == "dj_test@songnodes.local"
    assert data["user"]["session_id"] == "sess_abc123"


def test_me_unauthenticated(client):
    client.cookies.clear()
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 401
    assert "Authentication required" in response.json()["detail"]


def test_me_expired_session_cookie(client, duo_env):
    expired_token = create_session_token(
        {"sub": "dj_test", "username": "dj_test"},
        secret_key=duo_env["jwt_secret"],
        expires_in=-100,
    )
    client.cookies.set(COOKIE_NAME, expired_token)
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 401
    assert "Session has expired" in response.json()["detail"]


def test_me_invalid_session_cookie(client, duo_env):
    client.cookies.set(COOKIE_NAME, "completely_invalid_jwt_token_garbage")
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 401
    assert "Invalid session token" in response.json()["detail"]


# ============================================================================
# POST /api/v1/auth/logout Endpoint Tests
# ============================================================================

def test_logout(client, duo_env):
    session_token = create_session_token(
        {"sub": "dj_test", "username": "dj_test"},
        secret_key=duo_env["jwt_secret"],
    )
    client.cookies.set(COOKIE_NAME, session_token)

    response = client.post("/api/v1/auth/logout")
    assert response.status_code == 200
    assert response.json()["authenticated"] is False

    # Check response set-cookie header deletes the cookie (Max-Age=0 or expires in past)
    set_cookie_header = response.headers.get("set-cookie", "")
    assert COOKIE_NAME in set_cookie_header
    assert 'max-age=0' in set_cookie_header.lower() or 'expires=' in set_cookie_header.lower()
