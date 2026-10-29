import os
import sys
import uuid
import pytest
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from common.metadata.matching import Track
from common.providers.list_providers import list_providers
from common.providers.musicbrainz_local import MusicBrainzLocalProvider
from common.refmb.settings import RefMBSettings


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

    pool.acquire.return_value = AsyncContextManagerMock(conn)

    async def mock_fetchrow(query, *args):
        if "SELECT isrc" in query:
            return {"isrc": "USRC00000001"}
        if "SELECT length" in query:
            return {"length": 300000}
        return None

    conn.fetchrow = mock_fetchrow
    return pool


def test_provider_chain_order():
    """Verify list_providers registers musicbrainz_local ahead of web musicbrainz."""
    chain = list_providers()
    print(f"\nProvider chain: {chain}")

    assert "musicbrainz_local" in chain
    assert "musicbrainz" in chain

    local_idx = chain.index("musicbrainz_local")
    web_idx = chain.index("musicbrainz")
    assert local_idx < web_idx, f"musicbrainz_local ({local_idx}) must be ahead of musicbrainz ({web_idx})"


@pytest.mark.asyncio
async def test_mb_local_provider_unset_skip(monkeypatch):
    """Graceful skip when REFMB_DATABASE_URL and MB_LOCAL_ENABLED are unset."""
    monkeypatch.delenv("REFMB_DATABASE_URL", raising=False)
    monkeypatch.delenv("MB_LOCAL_ENABLED", raising=False)

    settings = RefMBSettings(enabled=False)
    provider = MusicBrainzLocalProvider(settings)

    target = Track(title="Strobe", artist="deadmau5", isrc="USRC00000001", duration_ms=300000)
    result = await provider.lookup(target)

    assert result is None, "Provider must return None immediately when database is unset"


@pytest.mark.asyncio
async def test_mb_local_provider_unreachable_db(monkeypatch):
    """Graceful skip without exception when database connection fails."""
    monkeypatch.setenv("REFMB_DATABASE_URL", "postgresql://ref_mb_reader:secret@invalid_host:5432/ref_mb")

    provider = MusicBrainzLocalProvider()

    target = Track(title="Strobe", artist="deadmau5", isrc="USRC00000001", duration_ms=300000)
    result = await provider.lookup(target)

    assert result is None, "Provider must return None without raising an exception when DB is unreachable"


@pytest.mark.asyncio
async def test_mb_local_provider_mock_db_match(mock_pool, monkeypatch):
    """Provider finds a track in mock refmb DB and returns ProviderTrack fields."""
    monkeypatch.setenv("REFMB_DATABASE_URL", "postgresql://ref_mb_reader:secret@localhost:55433/ref_mb")

    settings = RefMBSettings(enabled=True)
    provider = MusicBrainzLocalProvider(settings)
    provider.pool = mock_pool

    mock_match = MagicMock()
    mock_match.canonical_mbid = uuid.UUID("12345678-1234-5678-1234-567812345678")
    mock_match.mbid = uuid.UUID("12345678-1234-5678-1234-567812345678")
    mock_match.method = "isrc"
    mock_match.confidence_bucket = "auto"
    mock_match.dump_version = "2026-10-26"

    mock_resolver_cls = MagicMock()
    mock_resolver_instance = AsyncMock()
    mock_resolver_instance.resolve.return_value = mock_match
    mock_resolver_cls.return_value = mock_resolver_instance

    monkeypatch.setattr("common.providers.musicbrainz_local.MusicBrainzResolver", mock_resolver_cls)

    target = Track(title="Strobe", artist="deadmau5", isrc="USRC00000001", duration_ms=300000)
    results = await provider.lookup(target)

    assert results is not None
    assert len(results) == 1
    pt = results[0]

    assert pt.provider == "musicbrainz_local"
    assert pt.fields.get("musicbrainz_id") == "12345678-1234-5678-1234-567812345678"
    assert pt.fields.get("isrc") == "USRC00000001"
    assert pt.fields.get("duration_ms") == 300000
    assert pt.raw.get("licence") == "CC0"
    assert pt.raw.get("matched_by") == "isrc"
    assert pt.confidence == 1.0


@pytest.mark.asyncio
async def test_mb_local_provider_mock_db_no_match(mock_pool, monkeypatch):
    """Provider returns None on no match from refmb DB."""
    monkeypatch.setenv("REFMB_DATABASE_URL", "postgresql://ref_mb_reader:secret@localhost:55433/ref_mb")

    settings = RefMBSettings(enabled=True)
    provider = MusicBrainzLocalProvider(settings)
    provider.pool = mock_pool

    mock_resolver_cls = MagicMock()
    mock_resolver_instance = AsyncMock()
    mock_resolver_instance.resolve.return_value = None
    mock_resolver_cls.return_value = mock_resolver_instance

    monkeypatch.setattr("common.providers.musicbrainz_local.MusicBrainzResolver", mock_resolver_cls)

    target = Track(title="Unknown Track", artist="Unknown Artist")
    result = await provider.lookup(target)

    assert result is None, "Provider must return None on no match"
