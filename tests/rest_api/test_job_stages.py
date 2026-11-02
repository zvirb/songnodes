"""JOBSTG: GET /api/v1/jobs/{job_id}/stages reports every stage of a scrape job honestly."""
import json
import os
import sys
import uuid
from datetime import datetime, timedelta, timezone

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../services/rest_api')))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../services')))

import main  # noqa: E402,F401  (routers.catalog_writes imports from main; load it first)
import routers.jobs as jobs_router  # noqa: E402

T0 = datetime(2026, 11, 1, 10, 0, 0, tzinfo=timezone.utc)
SCRAPE_ID = uuid.UUID('0b9f6a52-1c1d-4c55-9a51-3f9b8c6d2e10')
INGEST_ID = uuid.UUID('1c2e7b63-2d2e-4d66-8b62-4a0c9d7e3f21')


def at(seconds):
    return T0 + timedelta(seconds=seconds)


def job(kind='scrape', key=None, status='queued', attempts=0, started=None, finished=None, error=None, result=None,
        job_id=None, created=0):
    return {'id': job_id or uuid.uuid4(), 'kind': kind, 'idempotency_key': key or str(uuid.uuid4()), 'status': status,
            'attempts': attempts, 'max_attempts': 3, 'payload': {'source': 'mixesdb', 'search_query': 'Deadmau5 Strobe'},
            'result': json.dumps(result) if result is not None else None, 'last_error': error,
            'created_at': at(created), 'started_at': at(started) if started is not None else None,
            'finished_at': at(finished) if finished is not None else None, 'run_after': at(created), 'updated_at': at(created)}


def scrape(**kw):
    return job(job_id=SCRAPE_ID, **kw)


def ingest(status='succeeded', **kw):
    return job('ingest_pending', f'ingest-after-scrape:{SCRAPE_ID}', status, job_id=INGEST_ID, created=60, **kw)


def proj(kind, status='succeeded', started=150, finished=155):
    tag = 'proj-after-ingest' if kind == 'projection_consume' else 'graph-proj-after-ingest'
    return job(kind, f'{tag}:{INGEST_ID}', status, started=started, finished=finished, created=140)


SUCCEEDED = dict(status='succeeded', attempts=1, started=5, finished=60, result={'bronze_playlists': 2, 'bronze_tracks': 10,
                                                                                  'found_nothing': False})


class FakeConn:
    def __init__(self, rows, waiting=0, backlog=0):
        self.rows, self.waiting, self.backlog = rows, waiting, backlog

    async def fetchrow(self, query, job_id):
        return next((r for r in self.rows if r['id'] == job_id), None)

    async def fetch(self, query, kinds, keys):
        assert 'idempotency_key' in query and 'LIMIT' not in query
        return [r for r in self.rows if (r['kind'], r['idempotency_key']) in set(zip(kinds, keys))]

    async def fetchval(self, query, *args):
        if 'bronze_scraped_playlists' in query:
            assert args[0] == 'mixesdb'
            return self.waiting
        assert 'outbox_events' in query
        return self.backlog


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
def stages(monkeypatch):
    def call(rows, progress=(None, jobs_router.NO_RECORD), job_id=SCRAPE_ID, **conn_kw):
        monkeypatch.setattr(jobs_router, 'get_pool', lambda: FakePool(FakeConn(rows, **conn_kw)))

        async def fake_progress(job_id, since):
            return progress
        monkeypatch.setattr(jobs_router, 'fetch_scrape_progress', fake_progress)
        app = FastAPI()
        app.include_router(jobs_router.router)
        return TestClient(app).get(f'/api/v1/jobs/{job_id}/stages')
    return call


def states(response):
    assert response.status_code == 200, response.text
    return [(s['key'], s['state']) for s in response.json()['stages']]


def by_key(response):
    return {s['key']: s for s in response.json()['stages']}


def test_queued_waits_for_a_worker(stages):
    response = stages([scrape()])
    assert states(response) == [('queued', 'running'), ('scrape', 'waiting'), ('ingest', 'waiting'), ('projection', 'waiting')]
    body = response.json()
    assert [s['label'] for s in body['stages']] == ['Queued', 'Scraping and saving raw data', 'Ingest to silver', 'Graph projection']
    assert by_key(response)['queued']['detail'] == 'Waiting for a worker'
    assert body['last_progress_at'] == '2026-11-01T10:00:00Z' and body['kind'] == 'scrape'


def test_retry_in_backoff_names_a_fixed_reason_never_the_raw_error(stages):
    response = stages([scrape(attempts=1, started=5, error='RetryableError: unified scraper unreachable: ConnectError secret-host')])
    assert states(response)[:2] == [('queued', 'running'), ('scrape', 'waiting')]
    assert by_key(response)['queued']['detail'] == 'Waiting to retry: the scraper could not be reached on attempt 1 of 3'
    assert 'secret-host' not in response.text and 'ConnectError' not in response.text


def test_running_with_live_progress(stages):
    progress = {'pages': 7, 'playlists': 2, 'tracks': 31, 'updated_at': at(112)}
    response = stages([scrape(status='running', attempts=1, started=5)], progress=(progress, None))
    print(json.dumps(response.json(), indent=2))
    assert states(response) == [('queued', 'done'), ('scrape', 'running'), ('ingest', 'waiting'), ('projection', 'waiting')]
    step = by_key(response)['scrape']
    assert step['progress'] == {'pages': 7, 'playlists': 2, 'tracks': 31, 'updated_at': '2026-11-01T10:01:52Z'}
    assert step['started_at'] == '2026-11-01T10:00:05Z' and step['detail'] is None
    assert response.json()['last_progress_at'] == '2026-11-01T10:01:52Z'
    assert all('progress' not in s for s in response.json()['stages'] if s['key'] != 'scrape')


def test_running_without_an_answer_from_the_scraper_has_no_progress(stages):
    response = stages([scrape(status='running', attempts=1, started=5)], progress=(None, jobs_router.NO_ANSWER))
    step = by_key(response)['scrape']
    assert step['progress'] is None and step['detail'] == jobs_router.NO_ANSWER
    assert response.json()['last_progress_at'] == '2026-11-01T10:00:05Z'  # the claim: the page can call it stalled


def test_succeeded_with_ingest_and_projection(stages):
    response = stages([scrape(**SUCCEEDED), ingest(started=70, finished=140),
                       proj('projection_consume'), proj('graph_projection_consume', started=151, finished=170)])
    assert states(response) == [('queued', 'done'), ('scrape', 'done'), ('ingest', 'done'), ('projection', 'done')]
    projection = by_key(response)['projection']
    assert (projection['started_at'], projection['finished_at']) == ('2026-11-01T10:02:30Z', '2026-11-01T10:02:50Z')
    assert response.json()['last_progress_at'] == '2026-11-01T10:02:50Z'


def test_succeeded_scrape_keeps_its_final_counts_and_real_duration(stages):
    """JT1: the done scrape step keeps the scraper's counts, not progress null (2 Nov local test)."""
    record = {'pages': 41, 'playlists': 1, 'tracks': 9, 'updated_at': at(55)}
    response = stages([scrape(**SUCCEEDED), ingest(started=70, finished=140)], progress=(record, None))
    step = by_key(response)['scrape']
    assert step['progress'] == {'pages': 41, 'playlists': 2, 'tracks': 10, 'updated_at': '2026-11-01T10:01:00Z'}
    assert (step['started_at'], step['finished_at']) == ('2026-11-01T10:00:05Z', '2026-11-01T10:01:00Z')
    gone = by_key(stages([scrape(**SUCCEEDED), ingest(started=70, finished=140)]))['scrape']
    assert gone['progress'] == {'pages': None, 'playlists': 2, 'tracks': 10, 'updated_at': '2026-11-01T10:01:00Z'}
    old = by_key(stages([scrape(**dict(SUCCEEDED, result={}))]))['scrape']
    assert old['progress'] is None and old['detail'] is None


def test_follow_ups_still_in_flight(stages):
    assert states(stages([scrape(**SUCCEEDED), ingest(status='queued')]))[2:] == [('ingest', 'running'), ('projection', 'waiting')]
    response = stages([scrape(**SUCCEEDED), ingest(started=70, finished=140), proj('projection_consume'),
                       proj('graph_projection_consume', status='running', finished=None)])
    assert states(response)[3] == ('projection', 'running')


def test_ingest_dead_fails_the_ingest_step(stages):
    response = stages([scrape(**SUCCEEDED), ingest(status='dead', attempts=3, started=70, finished=80, error='boom: dsn=x')])
    assert states(response)[2:] == [('ingest', 'failed'), ('projection', 'waiting')]
    assert by_key(response)['projection']['detail'] == jobs_router.UPSTREAM_FAILED and 'dsn' not in response.text


def test_dead_scrape(stages):
    response = stages([scrape(status='dead', attempts=3, started=5, finished=900,
                              error='lease expired with no attempts left')])
    assert states(response) == [('queued', 'done'), ('scrape', 'failed'), ('ingest', 'waiting'), ('projection', 'waiting')]
    assert by_key(response)['scrape']['detail'] == 'The worker stopped before the scrape finished (3 of 3 attempts used)'
    assert by_key(response)['ingest']['detail'] == jobs_router.UPSTREAM_FAILED
    unknown = stages([scrape(status='dead', attempts=3, started=5, finished=9, error='KeyError: /etc/passwd')])
    assert by_key(unknown)['scrape']['detail'] == 'The scrape failed (3 of 3 attempts used)' and 'passwd' not in unknown.text


def test_ingest_by_a_recurring_tick(stages):
    """The follow-up found nothing left because a tick ingested the rows first: shown as done only when bronze agrees."""
    tick = ingest(started=70, finished=71, result={'playlists': {'examined': 0, 'ingested': 0}})
    response = stages([scrape(**SUCCEEDED), tick], waiting=0, backlog=0)
    assert states(response)[2:] == [('ingest', 'done'), ('projection', 'done')]
    assert by_key(response)['ingest']['detail'] == 'Already ingested by a recurring ingest run'
    assert by_key(response)['projection']['detail'].startswith(jobs_router.NO_PROJECTION)
    busy = stages([scrape(**SUCCEEDED), tick], waiting=0, backlog=12)
    assert states(busy)[3] == ('projection', 'waiting')
    left = stages([scrape(**SUCCEEDED), tick], waiting=2)
    assert states(left)[2:] == [('ingest', 'waiting'), ('projection', 'waiting')]
    assert by_key(left)['ingest']['detail'] == 'Some playlists from this scrape are still waiting for ingest'
    missing = stages([scrape(**SUCCEEDED)], waiting=1)
    assert by_key(missing)['ingest']['detail'] == 'No ingest is recorded for this scrape'


def test_found_nothing(stages):
    nothing = dict(SUCCEEDED, result={'bronze_playlists': 0, 'bronze_tracks': 0, 'found_nothing': True})
    response = stages([scrape(**nothing), ingest(started=70, finished=71)])
    assert states(response)[1:] == [('scrape', 'done'), ('ingest', 'done'), ('projection', 'done')]
    assert by_key(response)['scrape']['detail'] == 'The scraper found no playlists or tracks'


def test_unknown_invalid_and_other_kinds(stages):
    missing = stages([], job_id=uuid.uuid4())
    assert (missing.status_code, missing.json()) == (404, {'detail': 'Job not found'})
    bad = stages([], job_id='not-a-uuid')
    assert (bad.status_code, bad.json()) == (422, {'detail': 'Invalid job ID'})
    other = stages([job('ingest_pending', job_id=SCRAPE_ID)])
    assert (other.status_code, other.json()) == (422, {'detail': 'Stages are reported for scrape jobs only'})


@pytest.mark.asyncio
async def test_fetch_scrape_progress_reads_the_scraper(monkeypatch):
    answers = {}

    def handle(request):
        assert request.url.path == f'/scrape/progress/{SCRAPE_ID}'
        if answers.get('error'):
            raise httpx.ConnectError('down')
        return httpx.Response(answers['status'], json=answers.get('body', {}))

    real = httpx.AsyncClient
    monkeypatch.setattr(jobs_router.httpx, 'AsyncClient', lambda **kw: real(transport=httpx.MockTransport(handle), **kw))
    body = {'pages': 3, 'playlists': 1, 'tracks': 12, 'items': 4, 'running': True,
            'started_at': '2026-11-01T10:00:05.300000+00:00', 'updated_at': '2026-11-01T10:00:41+00:00'}
    answers.update(status=200, body=body)
    progress, why = await jobs_router.fetch_scrape_progress(str(SCRAPE_ID), at(5))
    assert why is None and progress == {'pages': 3, 'playlists': 1, 'tracks': 12, 'updated_at': at(41)}
    assert await jobs_router.fetch_scrape_progress(str(SCRAPE_ID), at(30)) == (None, jobs_router.NO_RECORD)  # older attempt
    answers.update(status=404)
    assert await jobs_router.fetch_scrape_progress(str(SCRAPE_ID), at(5)) == (None, jobs_router.NO_RECORD)
    answers.update(error=True)
    assert await jobs_router.fetch_scrape_progress(str(SCRAPE_ID), at(5)) == (None, jobs_router.NO_ANSWER)


def test_trigger_message_says_the_worker_picks_the_job_up(monkeypatch):
    """JT1: the Compose stack runs a worker, so the message no longer says none runs."""
    row = job(job_id=SCRAPE_ID)

    class EnqueueConn:
        async def fetchrow(self, query, *args):
            return row
    monkeypatch.setattr(jobs_router, 'get_pool', lambda: FakePool(EnqueueConn()))
    app = FastAPI()
    app.include_router(jobs_router.router)
    body = TestClient(app).post('/api/v1/scrape/trigger?source=mixesdb&search_query=Deadmau5%20Strobe').json()
    assert body['created'] is True and body['status'] == 'queued'
    assert body['message'] == f'Job queued; the worker starts it when it is free. Follow it at /api/v1/jobs/{SCRAPE_ID}/stages.'
    assert 'no worker' not in body['message']
