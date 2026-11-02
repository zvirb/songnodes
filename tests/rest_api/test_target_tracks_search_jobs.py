"""TT1: GET /api/v1/target-tracks reports each target's latest search jobs, not a hand-set percentage."""
import os
import sys
from datetime import datetime, timezone

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../services/rest_api')))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../services')))

import routers.target_tracks as target_tracks  # noqa: E402

SEARCHED = datetime(2026, 11, 2, 3, 5, tzinfo=timezone.utc)
FINISHED = datetime(2026, 11, 2, 3, 9, tzinfo=timezone.utc)


def target(track_id, last_searched=None, **search):
    row = {'track_id': track_id, 'title': 'Strobe', 'artist': 'Deadmau5', 'priority': 'high',
           'last_searched': last_searched, 'playlists_found': 3, 'completion_percentage': 0}
    # The LEFT JOIN LATERAL aggregate always yields one row: zero counts and nulls when no job matched.
    for name in target_tracks.SEARCH_JOB_COLUMNS:
        row[f'search_{name}'] = search.get(name, None if name in ('finished_at', 'last_error') else 0)
    return row


class FakeConn:
    def __init__(self, rows):
        self.rows, self.queries = rows, []

    async def fetch(self, query, *params):
        self.queries.append(query)
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
def make_client(monkeypatch):
    def build(rows):
        conn = FakeConn(rows)
        monkeypatch.setattr(target_tracks, 'get_pool', lambda: FakePool(conn))
        app = FastAPI()
        app.include_router(target_tracks.router)
        client = TestClient(app)
        client.conn = conn
        return client
    return build


def test_never_searched_target_has_no_search_jobs(make_client):
    body = make_client([target('a')]).get('/api/v1/target-tracks').json()
    assert body[0]['search_jobs'] is None
    assert not any(key.startswith('search_') and key != 'search_jobs' for key in body[0])


def test_searched_target_reports_job_counts_finish_and_error(make_client):
    rows = [target('b', SEARCHED, succeeded=1, dead=1, finished_at=FINISHED, last_error='HTTP 503')]
    body = make_client(rows).get('/api/v1/target-tracks').json()
    jobs = body[0]['search_jobs']
    assert datetime.fromisoformat(jobs.pop('finished_at')) == FINISHED
    assert jobs == {'queued': 0, 'running': 0, 'succeeded': 1, 'dead': 1, 'last_error': 'HTTP 503'}
    assert body[0]['playlists_found'] == 3


def test_running_search_is_reported(make_client):
    rows = [target('c', SEARCHED, queued=1, running=1)]
    jobs = make_client(rows).get('/api/v1/target-tracks').json()[0]['search_jobs']
    assert (jobs['queued'], jobs['running'], jobs['succeeded'], jobs['dead']) == (1, 1, 0, 0)


def test_query_counts_only_the_latest_search_of_this_target(make_client):
    client = make_client([])
    assert client.get('/api/v1/target-tracks').json() == []
    query = client.conn.queries[0]
    assert "j.kind = 'scrape'" in query
    assert 'j.created_at >= t.last_searched' in query
    assert "j.payload->>'target_track_id' = t.track_id::text" in query
