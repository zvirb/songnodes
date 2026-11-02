"""TGT2: POST /api/v1/target-tracks adds one target per artist and title; a repeat returns the existing row."""
import os
import sys

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../services/rest_api')))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../services')))

import routers.target_tracks as target_tracks  # noqa: E402


class UniqueViolationError(Exception):
    """Same class name asyncpg raises for a unique index violation."""


class FakeConn:
    """Keeps target rows in memory and applies the router's normalised artist/title match."""

    def __init__(self, rows=None, update_error=None):
        self.rows = list(rows or [])
        self.locks, self.transactions, self.update_error = [], 0, update_error

    def transaction(self):
        conn = self

        class Tx:
            async def __aenter__(self):
                conn.transactions += 1

            async def __aexit__(self, *exc):
                return False
        return Tx()

    async def execute(self, query, *params):
        assert query == target_tracks.TARGET_KEY_LOCK_SQL
        self.locks.append(params)

    async def fetchrow(self, query, *params):
        if query == target_tracks.EXISTING_TARGET_SQL:
            artist, title = (p.lower() for p in params)
            matches = [r for r in self.rows
                       if r['artist'].strip().lower() == artist and r['title'].strip().lower() == title]
            matches.sort(key=lambda r: r.get('archived', False))
            return matches[0] if matches else None
        if 'INSERT INTO target_tracks' in query:
            title, artist, priority, genres, search_terms, is_active = params
            row = {'track_id': f'new-{len(self.rows)}', 'title': title, 'artist': artist, 'priority': priority,
                   'genres': genres, 'search_terms': search_terms, 'is_active': is_active, 'archived': False}
            self.rows.append(row)
            return row
        if 'UPDATE target_tracks' in query:
            if self.update_error:
                raise self.update_error
            return {'track_id': params[0], 'title': 'X', 'artist': 'Y'}
        raise AssertionError(query)


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
def make_client(monkeypatch):
    def build(conn):
        monkeypatch.setattr(target_tracks, 'get_pool', lambda: FakePool(conn))
        app = FastAPI()
        app.include_router(target_tracks.router)
        return TestClient(app)
    return build


def test_new_target_is_inserted_with_201(make_client):
    conn = FakeConn()
    response = make_client(conn).post('/api/v1/target-tracks', json={'artist': ' Anders Hellberg ', 'title': 'New Territory'})
    assert response.status_code == 201
    assert response.json()['artist'] == 'Anders Hellberg'
    assert len(conn.rows) == 1
    assert conn.locks == [('Anders Hellberg', 'New Territory')]
    assert conn.transactions == 1


def test_same_track_twice_returns_the_first_row_with_200(make_client):
    """The library's target button posts twice (search terms differ); only one row may result."""
    conn = FakeConn()
    client = make_client(conn)
    first = client.post('/api/v1/target-tracks', json={'artist': 'Blazej Malinowski', 'title': 'Deconstruct',
                                                       'search_terms': ['Original Mix']})
    second = client.post('/api/v1/target-tracks', json={'artist': 'blazej malinowski', 'title': 'DECONSTRUCT ',
                                                        'search_terms': ['Blazej Malinowski', 'Deconstruct']})
    assert (first.status_code, second.status_code) == (201, 200)
    assert second.json()['track_id'] == first.json()['track_id']
    assert second.json()['search_terms'] == ['Original Mix']   # the existing row is returned unchanged
    assert len(conn.rows) == 1


def test_live_row_is_preferred_over_an_archived_copy(make_client):
    rows = [{'track_id': 'old', 'artist': 'Prospa', 'title': 'Free Your Mind', 'archived': True},
            {'track_id': 'live', 'artist': 'Prospa', 'title': 'Free Your Mind', 'archived': False}]
    response = make_client(FakeConn(rows)).post('/api/v1/target-tracks', json={'artist': 'Prospa', 'title': 'Free Your Mind'})
    assert response.status_code == 200
    assert response.json()['track_id'] == 'live'


def test_rename_onto_another_target_is_a_conflict(make_client):
    conn = FakeConn(update_error=UniqueViolationError('duplicate key value violates unique constraint'))
    response = make_client(conn).put('/api/v1/target-tracks/00000000-0000-0000-0000-000000000001',
                                     json={'artist': 'Prospa', 'title': 'Free Your Mind'})
    assert response.status_code == 409


def test_lock_and_lookup_use_the_loader_key():
    assert 'lower(btrim(artist)) = lower($1) AND lower(btrim(title)) = lower($2)' in target_tracks.EXISTING_TARGET_SQL
    assert 'pg_advisory_xact_lock' in target_tracks.TARGET_KEY_LOCK_SQL
