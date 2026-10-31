import asyncio
import os
import sys
from pathlib import Path
import pytest
import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'services'))
from common.providers.web_call_log import WebCallLogger, attach_web_call_wrapper

@pytest.mark.asyncio
async def test_web_call_log_records_request():
    logs = []

    def log_callback(entry):
        logs.append(entry)

    logger = WebCallLogger(provider_name="fake_provider", run_id="run_123", log_callback=log_callback)

    # Use a mock transport to avoid actual network calls
    def mock_handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"result": "success"}, request=request)

    transport = httpx.MockTransport(mock_handler)

    async with httpx.AsyncClient(transport=transport) as client:
        # Attach the wrapper to the client
        client = attach_web_call_wrapper(client, logger)

        # Make a request
        response = await client.get("https://fake.provider.com/api/v1/search")
        assert response.status_code == 200

    assert len(logs) == 1

    log = logs[0]
    assert log["provider"] == "fake_provider"
    assert log["endpoint"] == "https://fake.provider.com/api/v1/search"
    assert log["run_id"] == "run_123"
    assert log["status"] == 200
    assert "duration_ms" in log
    assert isinstance(log["duration_ms"], int)


# --- WEB1: the wrapper is attached where every provider client is built (HttpProvider) ---

from common.metadata.matching import Track  # noqa: E402
from common.providers import base  # noqa: E402
from common.providers.lastfm import LastFmClient  # noqa: E402
from common.providers.web_call_log import PostgresSink, default_sink, redact_url  # noqa: E402

LASTFM_TAGS = {"toptags": {"tag": [{"name": "progressive house", "count": 100}]}}


class FakeConnection:
    def __init__(self, rows):
        self.rows = rows
        self.closed = False

    async def execute(self, sql, *args, timeout=None):
        assert sql.startswith("INSERT INTO web_call_log")
        self.rows.append(args)

    async def close(self):
        self.closed = True


def built_client_with_transport(monkeypatch, handler):
    """Let HttpProvider build its own client (the production path) but answer it from a mock transport."""
    real = httpx.AsyncClient
    monkeypatch.setattr(base.httpx, "AsyncClient", lambda **kw: real(transport=httpx.MockTransport(handler), **kw))


@pytest.mark.asyncio
async def test_provider_call_through_built_client_records_one_row_without_the_key(monkeypatch):
    built_client_with_transport(monkeypatch, lambda request: httpx.Response(200, json=LASTFM_TAGS, request=request))
    rows, connections = [], []

    async def fake_connect(dsn, timeout=None):
        connections.append(FakeConnection(rows))
        return connections[-1]

    sink = PostgresSink("postgresql://db/songnodes", connect=fake_connect)
    provider = LastFmClient("the-secret-key", rate_interval=0, call_log=sink)
    found = await provider.lookup(Track("Strobe", "Deadmau5"))
    await provider.aclose()

    assert found and found[0].fields["genre"] == ["progressive house"]
    assert len(rows) == 1
    provider_name, endpoint, field, run_id, status, duration_ms = rows[0]
    assert (provider_name, field, run_id, status) == ("lastfm", None, None, 200)
    assert isinstance(duration_ms, int)
    assert "the-secret-key" not in endpoint
    assert "api_key=REDACTED" in endpoint and "method=track.gettoptags" in endpoint
    assert connections[0].closed


@pytest.mark.asyncio
async def test_recording_failure_does_not_fail_the_call(monkeypatch):
    built_client_with_transport(monkeypatch, lambda request: httpx.Response(200, json=LASTFM_TAGS, request=request))

    async def broken_connect(dsn, timeout=None):
        raise OSError("connection refused")

    def raising_callback(entry):
        raise RuntimeError("sink down")

    for sink in (PostgresSink("postgresql://db/songnodes", connect=broken_connect), raising_callback):
        provider = LastFmClient("k", rate_interval=0, call_log=sink)
        found = await provider.lookup(Track("Strobe", "Deadmau5"))
        await provider.aclose()
        assert found and found[0].fields["genre"] == ["progressive house"]


@pytest.mark.asyncio
async def test_injected_client_is_left_alone():
    async with httpx.AsyncClient(transport=httpx.MockTransport(lambda r: httpx.Response(200, json={}))) as shared:
        LastFmClient("k", client=shared, call_log=lambda entry: None)
        assert shared.event_hooks == {"request": [], "response": []}


def test_default_sink_follows_database_url():
    assert default_sink({}) is None
    sink = default_sink({"DATABASE_URL": "postgresql+asyncpg://songnodes@postgres:5432/songnodes"})
    assert sink.dsn == "postgresql://songnodes@postgres:5432/songnodes"


def test_redact_url_masks_credentials():
    url = redact_url("https://user:pw@api.example.com/search?q=strobe&token=abc&x-api-key=def&Signature=ghi#frag")
    assert url == "https://api.example.com/search?q=strobe&token=REDACTED&x-api-key=REDACTED&Signature=REDACTED"
