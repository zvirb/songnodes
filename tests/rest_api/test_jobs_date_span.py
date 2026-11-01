"""JOBDATE: GET /api/v1/jobs filters by a created date span of Australia/Melbourne days."""
import os
import sys
import uuid
from datetime import datetime, timezone

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../services/rest_api')))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../services')))

import main  # noqa: E402,F401  (loads before routers.catalog_writes, which imports from it)
import routers.jobs as jobs  # noqa: E402

NOW = datetime(2026, 10, 4, 1, 0, tzinfo=timezone.utc)


def job_row():
    return {'id': uuid.UUID('11111111-2222-3333-4444-555555555555'), 'kind': 'scrape',
            'idempotency_key': 'k1', 'status': 'queued', 'attempts': 0, 'max_attempts': 3,
            'run_after': NOW, 'started_at': None, 'finished_at': None, 'last_error': None,
            'payload': '{"source": "mixesdb"}', 'result': None, 'created_at': NOW, 'updated_at': NOW}


class FakeConn:
    def __init__(self, rows):
        self.rows, self.calls = rows, []

    async def fetch(self, query, *params):
        self.calls.append((query, params))
        return self.rows


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


@pytest.fixture
def conn(monkeypatch):
    fake = FakeConn([job_row()])
    monkeypatch.setattr(jobs, 'get_pool', lambda: FakePool(fake))
    return fake


@pytest.fixture
def client():
    app = FastAPI()
    app.include_router(jobs.router)
    return TestClient(app)


def test_without_dates_keeps_the_existing_query(client, conn):
    response = client.get('/api/v1/jobs', params={'kind': 'scrape', 'limit': 50})
    assert response.status_code == 200
    assert response.json()[0]['payload'] == {'source': 'mixesdb'}
    query, params = conn.calls[0]
    assert query != jobs.LIST_JOBS_IN_SPAN
    assert params == (None, 'scrape', 50, 0)


def test_span_becomes_melbourne_midnights_with_an_exclusive_end(client, conn):
    response = client.get('/api/v1/jobs', params={'status': 'queued', 'kind': 'scrape', 'limit': 20, 'offset': 40,
                                                  'created_from': '2026-10-04', 'created_to': '2026-10-04'})
    assert response.status_code == 200
    assert len(response.json()) == 1
    query, params = conn.calls[0]
    assert query == jobs.LIST_JOBS_IN_SPAN
    assert "AT TIME ZONE 'Australia/Melbourne'" in query
    assert params == ('queued', 'scrape', datetime(2026, 10, 4), datetime(2026, 10, 5), 20, 40)


@pytest.mark.parametrize('extra, start, end', [
    ({'created_from': '2026-10-20'}, datetime(2026, 10, 20), None),
    ({'created_to': '2026-12-31'}, None, datetime(2027, 1, 1)),
    ({'created_to': '2028-02-29'}, None, datetime(2028, 3, 1)),
    ({'created_from': '2026-10-01', 'created_to': '9999-12-31'}, datetime(2026, 10, 1), None),
])
def test_open_ended_spans(client, conn, extra, start, end):
    assert client.get('/api/v1/jobs', params=extra).status_code == 200
    _, params = conn.calls[0]
    assert params == (None, None, start, end, 50, 0)


@pytest.mark.parametrize('extra', [
    {'created_from': '2026-13-01'},
    {'created_from': '2026-02-30'},
    {'created_to': '04/10/2026'},
    {'created_to': '2026-10-04T00:00:00'},
    {'created_from': '20261004'},
    {'created_from': ''},
])
def test_bad_dates_are_422(client, conn, extra):
    response = client.get('/api/v1/jobs', params=extra)
    assert response.status_code == 422
    assert 'must be a date as YYYY-MM-DD' in response.json()['detail']
    assert conn.calls == []


def test_from_after_to_is_422(client, conn):
    response = client.get('/api/v1/jobs', params={'created_from': '2026-10-05', 'created_to': '2026-10-04'})
    assert response.status_code == 422
    assert response.json()['detail'] == 'created_from must not be after created_to'
    assert conn.calls == []


def test_bad_status_is_still_422(client, conn):
    response = client.get('/api/v1/jobs', params={'status': 'done', 'created_from': '2026-10-04'})
    assert response.status_code == 422
    assert conn.calls == []
