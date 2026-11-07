"""Tests for transitions export endpoint (Module M3)."""
import json
import os
import sys
import uuid
import pytest
from jsonschema import validate
from fastapi import FastAPI
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../services/rest_api')))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../services')))

import main
import routers.transitions_export as transitions_export


class FakeConn:
    def __init__(self, rows):
        self.rows = rows
        self.calls = []

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
                pass

        return Ctx()


@pytest.mark.parametrize('bpm_diff,harmonic_compatible', [(2.0, True), (None, None)])
def test_transitions_export_conforms_to_schema(mocker, bpm_diff, harmonic_compatible):
    track1_id = str(uuid.uuid4())
    track2_id = str(uuid.uuid4())

    fake_rows = [
        {
            "from_track_id": track1_id,
            "to_track_id": track2_id,
            "from_artist": "Deadmau5",
            "from_title": "Strobe",
            "to_artist": "Kaskade",
            "to_title": "Move For Me",
            "count": 3,
            "bpm_diff": bpm_diff,
            "harmonic_compatible": harmonic_compatible,
            "quality_score": 0.95,
            "sources": ["1001tracklists", "mixesdb"]
        }
    ]

    conn = FakeConn(fake_rows)
    mocker.patch('routers.transitions_export.get_pool', return_value=FakePool(conn))

    app = FastAPI()
    transitions_export.register(app)
    client = TestClient(app)

    response = client.get("/api/v1/transitions/export")
    assert response.status_code == 200
    data = response.json()

    assert data["version"] == "1.0.0"
    assert data["count"] == 1
    assert len(data["transitions"]) == 1
    assert data["transitions"][0]["bpm_diff"] == bpm_diff
    assert data["transitions"][0]["harmonic_compatible"] is harmonic_compatible

    # Load and validate with JSON Schema
    schema_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../contracts/transitions.v1.json'))
    with open(schema_path, "r", encoding="utf-8") as f:
        schema = json.load(f)

    validate(instance=data, schema=schema)
