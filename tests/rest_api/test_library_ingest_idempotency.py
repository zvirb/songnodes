"""Tests for library ingest idempotency and 409 conflict contract."""
import json
import os
import sys
import uuid
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../services/rest_api')))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../services')))

import main
import routers.library_ingest as library_ingest


class FakeConn:
    def __init__(self, existing=None, created_job=None):
        self.existing = existing
        self.created_job = created_job
        self.calls = []

    async def fetchrow(self, query, *params):
        self.calls.append((query, params))
        if 'SELECT payload FROM ingestion_jobs' in query:
            return self.existing
        if 'SELECT * FROM ingestion_jobs WHERE' in query:
            return self.existing
        return None


class FakePool:
    def __init__(self, conn):
        self.conn = conn

    def acquire(self):
        conn = self.conn

        class Ctx:
            async def __aenter__(self):
                return conn

            async def __aexit__(self, *exc):
                pass

        return Ctx()


def test_ingest_new_payload_enqueues_and_returns_202(mocker):
    conn = FakeConn(existing=None)
    mocker.patch('routers.library_ingest.get_pool', return_value=FakePool(conn))
    job_id = uuid.uuid4()
    mocker.patch('routers.library_ingest.domain.enqueue', return_value=({'id': job_id, 'status': 'queued'}, True))

    app = FastAPI()
    library_ingest.register(app)
    client = TestClient(app)

    payload = {'tracks': [{'id': 't1', 'artist': 'Artist 1', 'title': 'Title 1'}]}
    res = client.post('/api/v1/library/ingest', headers={'Idempotency-Key': 'key-1'}, json=payload)

    assert res.status_code == 202
    assert res.json() == {'job_id': str(job_id), 'status': 'queued', 'created': True}


def test_ingest_duplicate_key_with_identical_payload_returns_202(mocker):
    payload = {'tracks': [{'id': 't1', 'artist': 'Artist 1', 'title': 'Title 1'}]}
    job_id = uuid.uuid4()
    existing_row = {'id': job_id, 'status': 'queued', 'payload': json.dumps(payload)}
    conn = FakeConn(existing=existing_row)
    mocker.patch('routers.library_ingest.get_pool', return_value=FakePool(conn))
    mocker.patch('routers.library_ingest.domain.enqueue', return_value=({'id': job_id, 'status': 'queued'}, False))

    app = FastAPI()
    library_ingest.register(app)
    client = TestClient(app)

    res = client.post('/api/v1/library/ingest', headers={'Idempotency-Key': 'key-1'}, json=payload)

    assert res.status_code == 202
    assert res.json() == {'job_id': str(job_id), 'status': 'queued', 'created': False}


def test_ingest_duplicate_key_with_different_payload_returns_409(mocker):
    original_payload = {'tracks': [{'id': 't1', 'artist': 'Original Artist'}]}
    job_id = uuid.uuid4()
    existing_row = {'id': job_id, 'status': 'queued', 'payload': json.dumps(original_payload)}
    conn = FakeConn(existing=existing_row)
    mocker.patch('routers.library_ingest.get_pool', return_value=FakePool(conn))

    app = FastAPI()
    library_ingest.register(app)
    client = TestClient(app)

    different_payload = {'tracks': [{'id': 't1', 'artist': 'Modified Artist'}]}
    res = client.post('/api/v1/library/ingest', headers={'Idempotency-Key': 'key-1'}, json=different_payload)

    assert res.status_code == 409
    assert 'Idempotency key was already submitted with a different payload' in res.json()['detail']
