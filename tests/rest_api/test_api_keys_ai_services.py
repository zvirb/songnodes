"""
AK1: AI provider keys are stored under the names the AI proxy reads
('anthropic', 'openai', 'google' / 'api_key'), Beatport is gone, and the
key tests send the key in a header only and never echo it back.
"""

import asyncio
import os
import sys
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from pydantic import ValidationError

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../services/rest_api')))

import routers.api_keys as api_keys  # noqa: E402
from routers.api_keys import APIKeyCreate  # noqa: E402

# Built from parts so secret scanners do not mistake the test value for a real key.
KEY = "-".join(["placeholder", "test", "value", "0000"])


@pytest.mark.parametrize("service", ["anthropic", "openai", "google", "Anthropic"])
def test_allow_list_accepts_ai_services(service):
    model = APIKeyCreate(service_name=service, key_name="api_key", key_value=KEY)
    assert model.service_name == service.lower()


def test_allow_list_rejects_beatport():
    with pytest.raises(ValidationError):
        APIKeyCreate(service_name="beatport", key_name="api_key", key_value=KEY)


def test_dispatcher_has_no_beatport():
    result = asyncio.run(api_keys._test_api_key_by_service("beatport", "api_key", KEY, MagicMock()))
    assert result["valid"] is False


def test_requirements_query_excludes_beatport():
    conn = MagicMock()
    conn.fetch = AsyncMock(return_value=[])
    ctx = MagicMock()
    ctx.__aenter__ = AsyncMock(return_value=conn)
    ctx.__aexit__ = AsyncMock(return_value=None)
    pool = MagicMock()
    pool.acquire.return_value = ctx

    asyncio.run(api_keys.get_api_key_requirements(pool))

    sql = conn.fetch.call_args[0][0]
    assert "service_name <> 'beatport'" in sql


def _mock_session(status, text=""):
    response = MagicMock()
    response.status = status
    response.text = AsyncMock(return_value=text)
    get_ctx = MagicMock()
    get_ctx.__aenter__ = AsyncMock(return_value=response)
    get_ctx.__aexit__ = AsyncMock(return_value=None)
    session = MagicMock()
    session.get.return_value = get_ctx
    session_ctx = MagicMock()
    session_ctx.__aenter__ = AsyncMock(return_value=session)
    session_ctx.__aexit__ = AsyncMock(return_value=None)
    return session, session_ctx


@pytest.mark.parametrize(
    "service,host,header,value",
    [
        ("anthropic", "api.anthropic.com", "x-api-key", KEY),
        ("openai", "api.openai.com", "Authorization", f"Bearer {KEY}"),
        ("google", "generativelanguage.googleapis.com", "x-goog-api-key", KEY),
    ],
)
def test_dispatcher_tests_ai_key_in_header_only(service, host, header, value):
    session, session_ctx = _mock_session(200)
    with patch.object(api_keys.aiohttp, "ClientSession", return_value=session_ctx):
        result = asyncio.run(api_keys._test_api_key_by_service(service, "api_key", KEY, MagicMock()))

    assert result["valid"] is True
    args, kwargs = session.get.call_args
    url = args[0]
    assert host in url
    assert KEY not in url
    assert kwargs["headers"][header] == value
    assert kwargs["timeout"].total == 10
    if service == "anthropic":
        assert kwargs["headers"]["anthropic-version"]
    assert KEY not in str(result)


@pytest.mark.parametrize("service", ["anthropic", "openai", "google"])
def test_provider_error_is_truncated_and_redacted(service):
    body = f"bad request for key {KEY} " + ("x" * 1000)
    session, session_ctx = _mock_session(500, body)
    with patch.object(api_keys.aiohttp, "ClientSession", return_value=session_ctx):
        result = asyncio.run(api_keys._test_api_key_by_service(service, "api_key", KEY, MagicMock()))

    assert result["valid"] is False
    assert len(result["error"]) <= 200
    assert KEY not in str(result)


@pytest.mark.parametrize("service", ["anthropic", "openai", "google"])
def test_exception_message_never_echoes_key(service):
    session_ctx = MagicMock()
    session_ctx.__aenter__ = AsyncMock(side_effect=RuntimeError(f"boom {KEY}"))
    session_ctx.__aexit__ = AsyncMock(return_value=None)
    with patch.object(api_keys.aiohttp, "ClientSession", return_value=session_ctx):
        result = asyncio.run(api_keys._test_api_key_by_service(service, "api_key", KEY, MagicMock()))

    assert result["valid"] is False
    assert KEY not in str(result)


def test_safe_error_drops_key_cut_at_the_limit():
    text = ("y" * 190) + KEY
    out = api_keys._safe_error(text, KEY)
    assert KEY[:9] not in out
    assert len(out) <= 200
