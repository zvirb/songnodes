"""DS24B: GET/PUT /api/v1/scrape/window stores the scheduled-scrape date window."""
import os
import sys
from datetime import datetime, timezone

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../services/rest_api')))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../services')))

import routers.scrape_window as scrape_window  # noqa: E402

URL = '/api/v1/scrape/window'
SAVED_AT = datetime(2026, 11, 1, 9, 0, tzinfo=timezone.utc)


class UndefinedTableError(Exception):
    """Same class name asyncpg raises for a missing table."""


class FakeConn:
    def __init__(self):
        self.row, self.missing, self.writes = None, False, []

    async def fetchrow(self, query, *params):
        if self.missing:
            raise UndefinedTableError('relation "scrape_window" does not exist')
        if 'INSERT' in query:
            self.writes.append(params)
            self.row = {'starts_on': params[0], 'ends_on': params[1], 'updated_at': SAVED_AT}
        return self.row


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
def client(monkeypatch):
    conn = FakeConn()
    monkeypatch.setattr(scrape_window, 'get_pool', lambda: FakePool(conn))
    app = FastAPI()
    scrape_window.register(app)
    test_client = TestClient(app)
    test_client.conn = conn
    return test_client


def test_no_row_is_no_window(client):
    response = client.get(URL)
    assert response.status_code == 200
    assert response.json() == {'starts_on': None, 'ends_on': None, 'updated_at': None}


def test_put_then_get_returns_the_window(client):
    response = client.put(URL, json={'starts_on': '2026-12-01', 'ends_on': '2026-12-31'})
    assert response.status_code == 200
    assert response.json()['starts_on'] == '2026-12-01'
    assert response.json()['ends_on'] == '2026-12-31'
    assert client.get(URL).json() == {'starts_on': '2026-12-01', 'ends_on': '2026-12-31',
                                      'updated_at': '2026-11-01T09:00:00Z'}


def test_open_ended_and_cleared(client):
    assert client.put(URL, json={'starts_on': '2026-12-01', 'ends_on': None}).json()['ends_on'] is None
    assert client.put(URL, json={'starts_on': None, 'ends_on': '2026-12-31'}).json()['starts_on'] is None
    response = client.put(URL, json={'starts_on': None, 'ends_on': None})
    assert (response.json()['starts_on'], response.json()['ends_on']) == (None, None)
    assert client.put(URL, json={}).status_code == 200


def test_single_day(client):
    assert client.put(URL, json={'starts_on': '2026-12-01', 'ends_on': '2026-12-01'}).status_code == 200


@pytest.mark.parametrize('body, sentence', [
    ({'starts_on': '2026-12-31', 'ends_on': '2026-12-01'}, 'starts_on must be on or before ends_on.'),
    ({'starts_on': '2026-02-30', 'ends_on': None}, 'starts_on must be a real date written as YYYY-MM-DD'),
    ({'starts_on': None, 'ends_on': '31/12/2026'}, 'ends_on must be a real date written as YYYY-MM-DD'),
    ({'starts_on': '20261201', 'ends_on': None}, 'starts_on must be a real date written as YYYY-MM-DD'),
])
def test_bad_windows_are_422_with_a_sentence(client, body, sentence):
    response = client.put(URL, json=body)
    assert response.status_code == 422
    assert sentence in response.json()['detail'][0]['msg']
    assert client.conn.writes == []


def test_missing_table(client):
    client.conn.missing = True
    assert client.get(URL).json() == {'starts_on': None, 'ends_on': None, 'updated_at': None}
    response = client.put(URL, json={'starts_on': '2026-12-01', 'ends_on': '2026-12-31'})
    assert response.status_code == 503
    assert '260_scrape_window_up.sql' in response.json()['detail']
