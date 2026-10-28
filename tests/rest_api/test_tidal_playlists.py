"""TIDAL official API client and playlist routes, with no network access.

Every outbound request goes through httpx.MockTransport, which records it.
"""
import asyncio
import json
import os
import sys

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
for path in (os.path.join(ROOT, 'services/rest_api'), os.path.join(ROOT, 'services'), ROOT):
    if path not in sys.path:
        sys.path.insert(0, path)

from utils import tidal_user_api  # noqa: E402
from utils.tidal_user_api import TidalUserApi, parse_iso_duration_seconds  # noqa: E402
import routers.tidal_playlists as tidal_playlists  # noqa: E402

TOKEN = 'user-access-token'


class Recorder:
    """MockTransport handler that records requests and answers like openapi.tidal.com."""

    def __init__(self, status: int = 200, headers=None):
        self.requests = []
        self.status = status
        self.headers = headers or {}

    def __call__(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        if self.status != 200:
            return httpx.Response(self.status, headers=self.headers, json={'errors': []})
        path = request.url.path
        if request.method == 'POST' and path == '/v2/playlists':
            return httpx.Response(201, json={'data': {'id': 'pl-1', 'type': 'playlists'}})
        if request.method == 'POST' and path.endswith('/relationships/items'):
            return httpx.Response(201, json={})
        if path == '/v2/playlists':
            return httpx.Response(200, json={'data': [{
                'id': 'pl-1', 'type': 'playlists',
                'attributes': {'name': 'Set', 'numberOfItems': 3, 'duration': 'PT5M4S', 'accessType': 'PUBLIC'},
            }]})
        if path == '/v2/searchResults':
            return httpx.Response(200, json={'data': {'relationships': {'tracks': {'data': [{'id': '42', 'type': 'tracks'}]}}}})
        if path == '/v2/tracks':
            return httpx.Response(200, json={
                'data': [{'id': '42', 'type': 'tracks',
                          'attributes': {'title': 'Strobe', 'duration': 'PT10M37S', 'isrc': 'X1'},
                          'relationships': {'artists': {'data': [{'id': 'a1', 'type': 'artists'}]}}}],
                'included': [{'id': 'a1', 'type': 'artists', 'attributes': {'name': 'deadmau5'}}],
            })
        return httpx.Response(404, json={})


def make_api(recorder: Recorder, **kwargs) -> TidalUserApi:
    client = httpx.AsyncClient(transport=httpx.MockTransport(recorder))
    return TidalUserApi(access_token=TOKEN, client=client, **kwargs)


def assert_official_and_safe(recorder: Recorder, country: str = 'AU'):
    assert recorder.requests, 'expected at least one request'
    for req in recorder.requests:
        assert req.url.host == 'openapi.tidal.com'
        assert req.url.params.get('countryCode') == country
        assert req.headers['Authorization'] == f'Bearer {TOKEN}'
        assert TOKEN not in str(req.url)


def test_parse_iso_duration():
    assert parse_iso_duration_seconds('PT5M4S') == 304
    assert parse_iso_duration_seconds('PT1H0M0S') == 3600
    assert parse_iso_duration_seconds('P1DT1S') == 86401
    assert parse_iso_duration_seconds(None) == 0
    assert parse_iso_duration_seconds('garbage') == 0


def test_create_then_add_120_ids_makes_three_ordered_calls():
    rec = Recorder()
    api = make_api(rec)
    ids = [str(i) for i in range(120)]

    async def run():
        pid = await api.create_playlist('SongNodes test')
        await api.add_tracks_in_order(pid, ids)
        return pid

    assert asyncio.run(run()) == 'pl-1'
    assert_official_and_safe(rec)
    assert rec.requests[0].url.path == '/v2/playlists'
    adds = rec.requests[1:]
    assert len(adds) == 3
    sent = []
    for req in adds:
        assert req.url.path == '/v2/playlists/pl-1/relationships/items'
        sent.extend(item['id'] for item in json.loads(req.content)['data'])
    assert sent == ids
    keys = [req.headers['Idempotency-Key'] for req in adds]
    assert len(set(keys)) == 3


def test_country_code_from_env(monkeypatch):
    monkeypatch.setenv('TIDAL_COUNTRY_CODE', 'GB')
    rec = Recorder()
    api = make_api(rec)
    asyncio.run(api.create_playlist('x'))
    assert_official_and_safe(rec, country='GB')


def test_country_code_defaults_to_au(monkeypatch):
    monkeypatch.delenv('TIDAL_COUNTRY_CODE', raising=False)
    assert TidalUserApi(access_token=TOKEN).country_code == 'AU'


def test_list_playlists_passes_limit_and_offset():
    rec = Recorder()
    api = make_api(rec)
    result = asyncio.run(api.list_playlists(limit=10, offset=20))
    assert_official_and_safe(rec)
    params = rec.requests[0].url.params
    assert params['page[limit]'] == '10'
    assert params['page[offset]'] == '20'
    assert result[0]['duration'] == 304


def test_search_track_sends_country_code():
    rec = Recorder()
    api = make_api(rec)
    track = asyncio.run(api.search_track('deadmau5', 'Strobe'))
    assert track['name'] == 'Strobe'
    assert track['duration'] == 637
    assert_official_and_safe(rec)


def test_owns_and_closes_its_own_client():
    api = TidalUserApi(access_token=TOKEN)
    assert api._owns_client is True

    async def run():
        client = await api._get_client()
        await api.close()
        return client

    client = asyncio.run(run())
    assert client.is_closed
    assert api._client is None


def test_does_not_close_injected_client():
    injected = httpx.AsyncClient(transport=httpx.MockTransport(Recorder()))
    api = TidalUserApi(access_token=TOKEN, client=injected)
    assert api._owns_client is False
    asyncio.run(api.close())
    assert not injected.is_closed
    asyncio.run(injected.aclose())


# ---------------------------------------------------------------- routes

@pytest.fixture
def route_client(monkeypatch):
    holder = {'recorder': Recorder()}

    real = tidal_user_api.TidalUserApi

    def factory(access_token, **kwargs):
        client = httpx.AsyncClient(transport=httpx.MockTransport(holder['recorder']))
        return real(access_token=access_token, client=client, **kwargs)

    monkeypatch.setattr(tidal_playlists, 'TidalUserApi', factory)
    app = FastAPI()
    app.include_router(tidal_playlists.router)
    return TestClient(app), holder


def test_route_create_and_add(route_client):
    client, holder = route_client
    auth = {'Authorization': f'Bearer {TOKEN}'}
    r = client.post('/api/v1/tidal/playlists/create', json={'name': 'SongNodes test'}, headers=auth)
    assert r.status_code == 200, r.text
    assert r.json()['id'] == 'pl-1'
    r = client.post('/api/v1/tidal/playlists/pl-1/tracks', json={'track_ids': ['3', '1', '2']}, headers=auth)
    assert r.status_code == 200, r.text
    assert_official_and_safe(holder['recorder'])


def test_route_list_passes_paging(route_client):
    client, holder = route_client
    r = client.get('/api/v1/tidal/playlists/list?limit=5&offset=15', headers={'Authorization': f'Bearer {TOKEN}'})
    assert r.status_code == 200, r.text
    params = holder['recorder'].requests[0].url.params
    assert (params['page[limit]'], params['page[offset]']) == ('5', '15')


@pytest.mark.parametrize('status', [401, 429])
def test_check_availability_keeps_upstream_status(route_client, status):
    client, holder = route_client
    holder['recorder'] = Recorder(status=status, headers={'Retry-After': '7'} if status == 429 else None)
    r = client.post('/api/v1/tidal/tracks/check-availability',
                    json={'artist': 'deadmau5', 'title': 'Strobe'},
                    headers={'Authorization': f'Bearer {TOKEN}'})
    assert r.status_code == status
    if status == 429:
        assert r.headers.get('Retry-After') == '7'


def test_check_availability_rejects_bad_header(route_client):
    client, _ = route_client
    r = client.post('/api/v1/tidal/tracks/check-availability',
                    json={'artist': 'deadmau5', 'title': 'Strobe'},
                    headers={'Authorization': 'Token nope'})
    assert r.status_code == 401


# ---------------------------------------------------------------- send a set (TX1)

def test_tidal_track_id_accepts_ids_and_urls():
    assert tidal_playlists.tidal_track_id('123') == '123'
    assert tidal_playlists.tidal_track_id('https://tidal.com/browse/track/456?u') == '456'
    assert tidal_playlists.tidal_track_id('https://tidal.com/browse/album/9') is None
    assert tidal_playlists.tidal_track_id(None) is None


def test_send_set_makes_one_playlist_in_play_order(route_client):
    client, holder = route_client
    body = {
        'name': '28 Oct 2026 · Warmup',
        'description': 'Friday',
        'tracks': [
            {'artist': 'A', 'title': 'Known', 'tidal': 'https://tidal.com/browse/track/7'},
            {'artist': 'deadmau5', 'title': 'Strobe'},
            {'artist': '', 'title': ''},
            {'artist': 'B', 'title': 'Also known', 'tidal': '9'},
        ],
    }
    r = client.post('/api/v1/tidal/sets/send', json=body, headers={'Authorization': f'Bearer {TOKEN}'})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data['playlist_id'] == 'pl-1'
    assert data['url'] == 'https://tidal.com/browse/playlist/pl-1'
    assert data['added'] == 3
    assert data['unmatched'] == [{'position': 3, 'artist': '', 'title': ''}]
    rec = holder['recorder']
    assert_official_and_safe(rec)
    create = next(req for req in rec.requests if req.method == 'POST' and req.url.path == '/v2/playlists')
    attrs = json.loads(create.content)['data']['attributes']
    assert attrs == {'name': '28 Oct 2026 · Warmup', 'description': 'Friday'}
    adds = [req for req in rec.requests if req.url.path.endswith('/relationships/items')]
    sent = [item['id'] for req in adds for item in json.loads(req.content)['data']]
    assert sent == ['7', '42', '9']


def test_send_set_without_tidal_login_is_401(route_client):
    client, holder = route_client
    r = client.post('/api/v1/tidal/sets/send', json={'name': 'x', 'tracks': [{'artist': 'a', 'title': 't'}]})
    assert r.status_code == 401
    assert 'Settings' in r.json()['detail']
    assert holder['recorder'].requests == []


def test_send_set_with_nothing_found_makes_no_playlist(route_client):
    client, holder = route_client
    r = client.post('/api/v1/tidal/sets/send', json={'name': 'x', 'tracks': [{'artist': '', 'title': ''}]},
                    headers={'Authorization': f'Bearer {TOKEN}'})
    assert r.status_code == 422
    assert not any(req.method == 'POST' for req in holder['recorder'].requests)
