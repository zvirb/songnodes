import pytest
import json
import asyncio
from unittest.mock import patch, MagicMock, AsyncMock
import sys
import os

# Adjust paths to match CI
sys.path.append("services/rest_api")
sys.path.append("services")

from fastapi.testclient import TestClient
from fastapi import FastAPI
import aiohttp

# Import the ai_proxy router directly
from routers.ai_proxy import router as ai_proxy_router
import routers.ai_proxy

app = FastAPI()
app.include_router(ai_proxy_router)

# We need to mock get_api_key in the ai_proxy module where it's imported
@pytest.fixture
def mock_get_api_key():
    with patch('routers.ai_proxy.get_api_key', new_callable=AsyncMock) as mock:
        mock.return_value = "fake-secret-key-12345"
        yield mock

@pytest.fixture
def mock_aiohttp_session():
    with patch('aiohttp.ClientSession') as mock_session_class:
        mock_session_instance = MagicMock()
        mock_session_class.return_value.__aenter__.return_value = mock_session_instance
        yield mock_session_instance

@pytest.fixture
def client():
    # To prevent DB pool errors
    async def mock_get_db_pool():
        return MagicMock()

    # We must patch get_db_pool inside the router module using dependency_overrides
    app.dependency_overrides[routers.ai_proxy.get_db_pool] = mock_get_db_pool
    yield TestClient(app)
    app.dependency_overrides.clear()

def test_claude_success(client, mock_get_api_key, mock_aiohttp_session):
    # Setup mock response
    mock_resp = AsyncMock()
    mock_resp.status = 200
    mock_resp.json.return_value = {
        "content": [{"type": "text", "text": "Hello from Claude!"}],
        "usage": {"input_tokens": 10, "output_tokens": 5}
    }

    mock_post = MagicMock()
    mock_post.__aenter__.return_value = mock_resp
    mock_aiohttp_session.post.return_value = mock_post

    response = client.post("/api/v1/ai/complete", json={
        "provider": "claude",
        "model": "claude-3-haiku-20240307",
        "prompt": "Say hello"
    })

    assert response.status_code == 200, response.text
    data = response.json()
    assert data["text"] == "Hello from Claude!"
    assert data["provider"] == "claude"
    assert "fake-secret-key-12345" not in json.dumps(data)

    # Verify the API key was passed in headers correctly
    mock_aiohttp_session.post.assert_called_once()
    call_args = mock_aiohttp_session.post.call_args
    assert call_args[1]["headers"]["x-api-key"] == "fake-secret-key-12345"

def test_openai_success(client, mock_get_api_key, mock_aiohttp_session):
    mock_resp = AsyncMock()
    mock_resp.status = 200
    mock_resp.json.return_value = {
        "choices": [{"message": {"content": "Hello from OpenAI!"}}],
        "usage": {"total_tokens": 15}
    }

    mock_post = MagicMock()
    mock_post.__aenter__.return_value = mock_resp
    mock_aiohttp_session.post.return_value = mock_post

    response = client.post("/api/v1/ai/complete", json={
        "provider": "openai",
        "model": "gpt-4o-mini",
        "prompt": "Say hello"
    })

    assert response.status_code == 200, response.text
    data = response.json()
    assert data["text"] == "Hello from OpenAI!"
    assert data["provider"] == "openai"
    assert "fake-secret-key-12345" not in json.dumps(data)

    # Verify auth header
    call_args = mock_aiohttp_session.post.call_args
    assert call_args[1]["headers"]["Authorization"] == "Bearer fake-secret-key-12345"

def test_gemini_success(client, mock_get_api_key, mock_aiohttp_session):
    mock_resp = AsyncMock()
    mock_resp.status = 200
    mock_resp.json.return_value = {
        "candidates": [{"content": {"parts": [{"text": "Hello from Gemini!"}]}}],
        "usageMetadata": {"totalTokenCount": 20}
    }

    mock_post = MagicMock()
    mock_post.__aenter__.return_value = mock_resp
    mock_aiohttp_session.post.return_value = mock_post

    response = client.post("/api/v1/ai/complete", json={
        "provider": "gemini",
        "model": "gemini-1.5-flash",
        "prompt": "Say hello"
    })

    assert response.status_code == 200, response.text
    data = response.json()
    assert data["text"] == "Hello from Gemini!"
    assert data["provider"] == "gemini"
    assert "fake-secret-key-12345" not in json.dumps(data)

    # Verify auth header
    call_args = mock_aiohttp_session.post.call_args
    assert call_args[1]["headers"]["x-goog-api-key"] == "fake-secret-key-12345"

def test_missing_api_key(client, mock_get_api_key):
    mock_get_api_key.return_value = None

    response = client.post("/api/v1/ai/complete", json={
        "provider": "claude",
        "model": "claude-3-haiku-20240307",
        "prompt": "Say hello"
    })

    assert response.status_code == 401
    assert "fake-secret-key-12345" not in response.text

def test_unsupported_provider(client):
    response = client.post("/api/v1/ai/complete", json={
        "provider": "unknown-provider",
        "model": "some-model",
        "prompt": "Say hello"
    })

    assert response.status_code == 400

def test_rate_limit(client, mock_get_api_key, mock_aiohttp_session):
    mock_resp = AsyncMock()
    mock_resp.status = 429
    mock_resp.text.return_value = "Rate limit exceeded: you sent too many requests. Your key fake-secret-key-12345 is blocked."

    mock_post = MagicMock()
    mock_post.__aenter__.return_value = mock_resp
    mock_aiohttp_session.post.return_value = mock_post

    response = client.post("/api/v1/ai/complete", json={
        "provider": "claude",
        "model": "claude-3-haiku-20240307",
        "prompt": "Say hello"
    })

    assert response.status_code == 429
    assert response.json()["detail"] == "Upstream rate limit exceeded"
    assert "fake-secret-key-12345" not in response.text

def test_upstream_500(client, mock_get_api_key, mock_aiohttp_session):
    mock_resp = AsyncMock()
    mock_resp.status = 500
    mock_resp.text.return_value = "Internal Server Error at fake-secret-key-12345"

    mock_post = MagicMock()
    mock_post.__aenter__.return_value = mock_resp
    mock_aiohttp_session.post.return_value = mock_post

    response = client.post("/api/v1/ai/complete", json={
        "provider": "openai",
        "model": "gpt-4o",
        "prompt": "Say hello"
    })

    assert response.status_code == 502
    assert response.json()["detail"] == "Upstream provider error"
    assert "fake-secret-key-12345" not in response.text

def test_upstream_timeout(client, mock_get_api_key, mock_aiohttp_session):
    mock_post = MagicMock()
    mock_post.__aenter__.side_effect = asyncio.TimeoutError()
    mock_aiohttp_session.post.return_value = mock_post

    response = client.post("/api/v1/ai/complete", json={
        "provider": "gemini",
        "model": "gemini-1.5-flash",
        "prompt": "Say hello"
    })

    assert response.status_code == 504
    assert response.json()["detail"] == "Upstream timeout"
    assert "fake-secret-key-12345" not in response.text

def test_oversized_body(client, mock_get_api_key):
    # Simulate a large payload
    headers = {"content-length": "200000"}  # ~200KB

    response = client.post("/api/v1/ai/complete", headers=headers, json={
        "provider": "claude",
        "model": "claude-3-haiku-20240307",
        "prompt": "Say hello"
    })

    assert response.status_code == 413
    assert response.json()["detail"] == "Request body too large"
