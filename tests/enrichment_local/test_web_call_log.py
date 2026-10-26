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
