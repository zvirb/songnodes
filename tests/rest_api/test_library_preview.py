"""PV1: GET /api/v1/library/tracks/{id}/preview returns a Deezer preview URL or an honest null."""
import os
import sys
import uuid

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../services/rest_api')))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../services')))

from common.metadata.matching import Track  # noqa: E402
from common.providers.base import MemoryCache, ProviderError, ProviderTrack, ProviderUnavailable  # noqa: E402
from common.providers.deezer import DeezerClient  # noqa: E402
import routers.preview as preview  # noqa: E402

TRACK_ID = uuid.UUID('11111111-2222-3333-4444-555555555555')
URL = 'https://cdnt-preview.dzcdn.net/api/1/1/a/b/c/0/abc.mp3?hdnea=exp=1~acl=*~hmac=x'


def row(**overrides):
    base = {'track_id': TRACK_ID, 'artist_name': 'Deadmau5', 'track_title': 'Strobe', 'isrc': None,
            'deezer_id': None, 'duration_ms': 637000}
    base.update(overrides)
    return base


class FakeConn:
    def __init__(self, record):
        self.record, self.calls = record, []

    async def fetchrow(self, query, *params):
        self.calls.append(params)
        return self.record


class FakePool:
    def __init__(self, conn):
        self.conn = conn

    def acquire(self):
        conn = self.conn

        class Ctx:
            async def __aenter__(self):
                return conn

            async def __aexit__(self, *exc):
                return False
        return Ctx()


def candidate(ref='3135556', preview_url=URL, title='Strobe', artist='Deadmau5', isrc=None, duration=637000):
    return ProviderTrack('deezer', Track(title, artist, isrc, duration, ref), {'deezer_id': ref}, {'preview': preview_url})


class FakeDeezer:
    name = 'deezer'

    def __init__(self, detail=None, lookup=None, error=None):
        self.cache = MemoryCache()
        self._detail, self._lookup, self.error = detail, lookup or [], error
        self.detail_calls, self.lookup_calls = [], []

    async def detail(self, track_id):
        self.detail_calls.append(track_id)
        if self.error:
            raise self.error
        return self._detail

    async def lookup(self, target, genres=None):
        self.lookup_calls.append(target)
        if self.error:
            raise self.error
        return self._lookup


@pytest.fixture
def make_client(monkeypatch):
    def build(record, deezer):
        monkeypatch.setattr(preview, 'get_pool', lambda: FakePool(FakeConn(record)))
        monkeypatch.setattr(preview, 'get_deezer', lambda: deezer)
        app = FastAPI()
        preview.register(app)
        return TestClient(app)
    return build


def path(track_id=TRACK_ID):
    return f'/api/v1/library/tracks/{track_id}/preview'


def test_stored_deezer_id_uses_track_detail(make_client):
    deezer = FakeDeezer(detail=candidate())
    response = make_client(row(deezer_id='3135556'), deezer).get(path())
    assert response.status_code == 200
    assert response.json() == {'url': URL, 'source': 'deezer'}
    assert deezer.detail_calls == ['3135556'] and deezer.lookup_calls == []


def test_without_deezer_id_looks_up_by_isrc_then_text(make_client):
    deezer = FakeDeezer(lookup=[candidate(isrc='GBUM70906033')])
    response = make_client(row(isrc='GBUM70906033'), deezer).get(path())
    assert response.json() == {'url': URL, 'source': 'deezer'}
    target = deezer.lookup_calls[0]
    assert (target.artist, target.title, target.isrc) == ('Deadmau5', 'Strobe', 'GBUM70906033')


def test_unmatched_search_result_is_an_honest_null(make_client):
    deezer = FakeDeezer(lookup=[candidate(title='Ghosts n Stuff')])
    response = make_client(row(), deezer).get(path())
    assert response.status_code == 200
    assert response.json() == {'url': None, 'source': 'deezer'}


def test_track_without_preview_is_null(make_client):
    deezer = FakeDeezer(detail=candidate(preview_url=''))
    assert make_client(row(deezer_id='3135556'), deezer).get(path()).json() == {'url': None, 'source': 'deezer'}


def test_unknown_track_is_404(make_client):
    deezer = FakeDeezer()
    response = make_client(None, deezer).get(path())
    assert response.status_code == 404
    assert deezer.detail_calls == [] and deezer.lookup_calls == []


def test_invalid_id_is_422(make_client):
    assert make_client(row(), FakeDeezer()).get(path('not-a-uuid')).status_code == 422


def test_result_is_cached(make_client):
    deezer = FakeDeezer(detail=candidate())
    client = make_client(row(deezer_id='3135556'), deezer)
    client.get(path())
    assert client.get(path()).json()['url'] == URL
    assert deezer.detail_calls == ['3135556']


@pytest.mark.parametrize('error,status', [
    (ProviderUnavailable('deezer', 'secret upstream detail'), 503),
    (ProviderError('deezer', 'API error 99: secret upstream detail'), 502),
    (RuntimeError('secret upstream detail'), 500),
])
def test_errors_do_not_leak_exception_text(make_client, error, status):
    response = make_client(row(deezer_id='3135556'), FakeDeezer(error=error)).get(path())
    assert response.status_code == status
    assert 'secret' not in response.text


def test_database_error_does_not_leak(monkeypatch):
    class BrokenPool:
        def acquire(self):
            raise RuntimeError('password=hunter2')
    monkeypatch.setattr(preview, 'get_pool', lambda: BrokenPool())
    app = FastAPI()
    preview.register(app)
    response = TestClient(app).get(path())
    assert response.status_code == 500
    assert 'hunter2' not in response.text


def test_real_deezer_client_isrc_path(make_client):
    """The shared DeezerClient's ISRC lookup feeds the endpoint (no network: httpx.MockTransport)."""
    def handler(request):
        assert request.url.path == '/track/isrc:GBUM70906033'
        return httpx.Response(200, json={'id': 3135556, 'title': 'Strobe', 'isrc': 'GBUM70906033', 'duration': 637,
                                         'artist': {'name': 'Deadmau5'}, 'preview': URL, 'album': {'id': 1}})
    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    deezer = DeezerClient(client=client, rate_interval=0)
    response = make_client(row(isrc='GBUM70906033'), deezer).get(path())
    assert response.json() == {'url': URL, 'source': 'deezer'}
