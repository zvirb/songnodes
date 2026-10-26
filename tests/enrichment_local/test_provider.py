import pytest
from unittest.mock import AsyncMock, MagicMock
from common.metadata.matching import Track
from common.providers.musicbrainz_local import MusicBrainzLocalProvider
from common.refmb.settings import RefMBSettings
import uuid

class AsyncContextManagerMock:
    def __init__(self, obj):
        self.obj = obj
    async def __aenter__(self):
        return self.obj
    async def __aexit__(self, exc_type, exc, tb):
        pass

@pytest.fixture
def mock_pool():
    pool = MagicMock()
    conn = AsyncMock()

    # Context manager setup for acquire()
    pool.acquire.return_value = AsyncContextManagerMock(conn)

    # Mock data to return from conn.fetch and conn.fetchrow
    async def mock_fetch(query, *args):
        if "isrc i" in query:
            if args[0] == "USRC00000001":
                return [{'mbid': uuid.UUID('12345678-1234-5678-1234-567812345678'), 'title': 'Recording 1', 'artist': 'Artist 1', 'duration': 300000}]
            return []
        if "canonical_musicbrainz_data" in query:
            return []
        if "r.name <-> $1" in query:
            return []
        return []

    async def mock_fetchrow(query, *args):
        if "SELECT isrc" in query:
            return {"isrc": "USRC00000001"}
        if "SELECT length" in query:
            return {"length": 300000}
        return None

    conn.fetch = mock_fetch
    conn.fetchval = AsyncMock(return_value=None) # No canonical redirect
    conn.fetchrow = mock_fetchrow

    return pool


@pytest.mark.asyncio
async def test_musicbrainz_local_provider_enabled(mock_pool):
    settings = RefMBSettings(enabled=True)
    provider = MusicBrainzLocalProvider(settings)
    provider.pool = mock_pool

    target = Track(title="Recording 1", artist="Artist 1", isrc="USRC00000001", duration_ms=300000)
    results = await provider.lookup(target)

    assert len(results) == 1
    pt = results[0]

    assert pt.provider == "musicbrainz_local"
    assert pt.fields.get("musicbrainz_id") == "12345678-1234-5678-1234-567812345678"
    assert pt.fields.get("isrc") == "USRC00000001"
    assert pt.fields.get("duration_ms") == 300000
    assert pt.raw.get("licence") == "CC0"
    assert pt.confidence == 1.0


@pytest.mark.asyncio
async def test_musicbrainz_local_provider_disabled():
    settings = RefMBSettings(enabled=False)
    provider = MusicBrainzLocalProvider(settings)

    target = Track(title="Recording 1", artist="Artist 1", isrc="USRC00000001", duration_ms=300000)
    results = await provider.lookup(target)

    # Should do nothing when disabled
    assert len(results) == 0
