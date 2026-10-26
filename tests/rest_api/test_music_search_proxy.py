import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../services/rest_api')))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../services')))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))
from main import app
import aiohttp
import asyncio
import os
import subprocess

client = TestClient(app)

class MockResponse:
    def __init__(self, status, json_data=None, text_data=None):
        self.status = status
        self._json_data = json_data
        self._text_data = text_data

    async def json(self):
        if self._json_data is not None:
            return self._json_data
        raise Exception("Not a JSON response")

    async def text(self):
        return self._text_data or ""

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        pass


@pytest.fixture
def mock_aiohttp_session():
    with patch('aiohttp.ClientSession') as mock_session_class:
        mock_session = MagicMock()
        mock_session_class.return_value.__aenter__.return_value = mock_session
        yield mock_session


def test_music_search_proxy_200(mock_aiohttp_session):
    mock_response = MockResponse(200, json_data={"tracks": [{"id": "1", "title": "Real Track"}]})
    mock_aiohttp_session.get.return_value = mock_response

    response = client.get("/api/v1/music-search/tidal?q=test")
    assert response.status_code == 200
    assert response.json() == {"tracks": [{"id": "1", "title": "Real Track"}]}


def test_music_search_proxy_424(mock_aiohttp_session):
    mock_response = MockResponse(424, json_data={"detail": "Tidal credentials not configured"})
    mock_aiohttp_session.get.return_value = mock_response

    response = client.get("/api/v1/music-search/tidal?q=test")
    assert response.status_code == 424
    assert response.json() == {"detail": {"detail": "Tidal credentials not configured"}}


def test_music_search_proxy_502(mock_aiohttp_session):
    mock_response = MockResponse(502, text_data="Bad Gateway")
    mock_aiohttp_session.get.return_value = mock_response

    response = client.get("/api/v1/music-search/tidal?q=test")
    assert response.status_code == 502
    assert response.json() == {"detail": "Bad Gateway"}


def test_music_search_proxy_503_on_connection_error(mock_aiohttp_session):
    mock_aiohttp_session.get.side_effect = aiohttp.ClientConnectorError(MagicMock(), OSError("Connection refused"))

    response = client.get("/api/v1/music-search/tidal?q=test")
    assert response.status_code == 503
    assert response.json() == {"detail": {"code": "search_service_unavailable"}}


def test_music_search_proxy_503_on_timeout(mock_aiohttp_session):
    mock_aiohttp_session.get.side_effect = asyncio.TimeoutError()

    response = client.get("/api/v1/music-search/tidal?q=test")
    assert response.status_code == 503
    assert response.json() == {"detail": {"code": "search_service_unavailable"}}


def test_no_mock_data_left_in_codebase():
    """Grep test that mock data strings no longer appear in the relevant directories."""
    strings_to_check = ["Mock Artist", "Mock Album", "placeholder.com"]
    directories = ["services/rest_api", "services/metadata-enrichment"]

    for s in strings_to_check:
        for d in directories:
            # We skip tests directories to avoid matching our own test file or other tests
            try:
                result = subprocess.run(
                    ["grep", "-r", s, d],
                    capture_output=True, text=True
                )
                output = result.stdout

                # Filter out our test file if we ran it from root and somehow included tests
                # But grep is only running on services/...

                # It should find nothing
                assert not output.strip(), f"Found '{s}' in {d}:\n{output}"
            except FileNotFoundError:
                pass
