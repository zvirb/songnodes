"""TIDAL auth routes never take client_id/client_secret from the query string.

A client_secret query parameter is ignored: the value sent to TIDAL is the
server-side one, and the routes do not declare such a parameter. No network.
"""
import os
import sys

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
for path in (os.path.join(ROOT, 'services/rest_api'), os.path.join(ROOT, 'services'), ROOT):
    if path not in sys.path:
        sys.path.insert(0, path)

import routers.music_auth as music_auth  # noqa: E402

SERVER_ID = 'server-client-id'
SERVER_SECRET = 'server-client-secret'
EVIL = 'attacker-secret-from-query'


class FakeResponse:
    def __init__(self, payload):
        self.status = 200
        self._payload = payload

    async def json(self):
        return self._payload

    async def text(self):
        return ''

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False


class FakeSession:
    calls = []

    def __init__(self, *args, **kwargs):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    def post(self, url, data=None, **kwargs):
        FakeSession.calls.append({'url': url, 'data': dict(data or {})})
        if 'device_authorization' in url:
            return FakeResponse({
                'device_code': 'dev-code-123', 'user_code': 'ABCD',
                'verification_uri': 'https://link.tidal.com', 'verification_uri_complete': 'https://link.tidal.com/ABCD',
                'expires_in': 300, 'interval': 5,
            })
        return FakeResponse({'access_token': 'a', 'refresh_token': 'r', 'expires_in': 3600, 'token_type': 'Bearer'})


class FakeRedis:
    def __init__(self):
        self.stored = {}

    async def setex(self, key, ttl, value):
        self.stored[key] = value


@pytest.fixture
def client(monkeypatch):
    FakeSession.calls = []
    monkeypatch.setattr(music_auth, 'TIDAL_CLIENT_ID', SERVER_ID)
    monkeypatch.setattr(music_auth, 'TIDAL_CLIENT_SECRET', SERVER_SECRET)
    monkeypatch.setattr(music_auth.aiohttp, 'ClientSession', FakeSession)
    fake_redis = FakeRedis()

    async def get_redis():
        return fake_redis

    monkeypatch.setattr(music_auth, 'get_redis', get_redis)
    app = FastAPI()
    app.include_router(music_auth.router)
    return TestClient(app)


def _query_params(app_client, path):
    spec = app_client.app.openapi()
    return [p['name'] for p in spec['paths'][path]['post'].get('parameters', []) if p.get('in') == 'query']


@pytest.mark.parametrize('path', [
    '/api/v1/music-auth/tidal/device/init',
    '/api/v1/music-auth/tidal/refresh',
    '/api/v1/music-auth/tidal/oauth/refresh',
])
def test_routes_do_not_declare_client_credentials(client, path):
    params = _query_params(client, path)
    assert 'client_secret' not in params
    assert 'client_id' not in params


@pytest.mark.parametrize('path', ['/api/v1/music-auth/tidal/refresh', '/api/v1/music-auth/tidal/oauth/refresh'])
def test_refresh_ignores_query_secret(client, path):
    r = client.post(path, params={'refresh_token': 'rt', 'client_id': 'evil-id', 'client_secret': EVIL})
    assert r.status_code == 200, r.text
    assert len(FakeSession.calls) == 1
    sent = FakeSession.calls[0]
    assert sent['url'].startswith('https://auth.tidal.com/')
    assert sent['data']['client_secret'] == SERVER_SECRET
    assert sent['data']['client_id'] == SERVER_ID
    assert EVIL not in repr(FakeSession.calls)
    assert EVIL not in r.text


def test_device_init_ignores_query_secret(client):
    r = client.post('/api/v1/music-auth/tidal/device/init', params={'client_id': 'evil-id', 'client_secret': EVIL})
    assert r.status_code == 200, r.text
    assert len(FakeSession.calls) == 1
    sent = FakeSession.calls[0]
    # The device authorisation request carries the client id only, never a secret.
    assert sent['data']['client_id'] == SERVER_ID
    assert 'client_secret' not in sent['data']
    assert EVIL not in repr(FakeSession.calls)
    assert SERVER_SECRET not in r.text
