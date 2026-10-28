import pytest
import time
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi.testclient import TestClient
from fastapi import FastAPI
import sys
sys.path.append('services')
import rest_api.routers.library_search as libsearch
from rest_api.routers.library_search import router

app = FastAPI()
app.include_router(router)
client = TestClient(app)

class FakeRecord:
    def __init__(self, d):
        self._d = d
    def __iter__(self):
        return iter(self._d.items())
    def __getitem__(self, key):
        return self._d[key]
    def keys(self):
        return self._d.keys()

class FakeConnection:
    def __init__(self, rows=None, sleep_sec=0):
        self.rows = rows or []
        self.sleep_sec = sleep_sec
        self.last_query = None
        self.last_params = None

    async def fetch(self, query, *params):
        if self.sleep_sec:
            time.sleep(self.sleep_sec)
        self.last_query = query
        self.last_params = params
        return [FakeRecord(r) for r in self.rows]

class FakePool:
    def __init__(self, conn):
        self.conn = conn

    def acquire(self):
        class ContextManager:
            def __init__(self, conn):
                self.conn = conn
            async def __aenter__(self):
                return self.conn
            async def __aexit__(self, exc_type, exc, tb):
                pass
        return ContextManager(self.conn)

@pytest.fixture
def fake_conn():
    # Return a basic valid record to satisfy response_model
    row = {
        "id": "trk_1",
        "a": "Artist",
        "t": "Title",
        "m": None, "d": None, "bpm": None, "k": None, "e": None, "eb": None,
        "p": None, "rot": None, "tags": [], "src": [],
        "first": None, "last": None, "g": None, "lbl": None,
        "sync": None, "tidal": None, "dz": None, "bp": None, "chart": None,
        "rev": False, "ovr": False, "local": False,
        "mbid": None, "mbconf": None, "mbdump": None, "source_url": None
    }
    return FakeConnection(rows=[row])

@pytest.fixture
def patch_pool(fake_conn):
    pool = FakePool(fake_conn)
    with patch("rest_api.routers.library_search.get_pool", return_value=pool):
        yield fake_conn

def test_energy_min_max(patch_pool):
    res = client.get("/api/v1/library/search?energy_min=4.0&energy_max=7.5")
    assert res.status_code == 200

    q = patch_pool.last_query
    p = patch_pool.last_params

    assert "pt.energy_canonical >=" in q
    assert "pt.energy_canonical <=" in q
    assert 4.0 in p
    assert 7.5 in p

def test_energy_band(patch_pool):
    res = client.get("/api/v1/library/search?energy_band=Peak,warm")
    assert res.status_code == 200

    q = patch_pool.last_query
    p = patch_pool.last_params

    assert "pt.energy_band = ANY(" in q
    assert ['peak', 'warm'] in p

def test_energy_band_invalid():
    res = client.get("/api/v1/library/search?energy_band=Peak,invalid")
    assert res.status_code == 422
    assert "Unknown energy band" in res.json()["detail"]

def test_energy_min_greater_than_max():
    res = client.get("/api/v1/library/search?energy_min=8.0&energy_max=6.0")
    assert res.status_code == 422
    assert "energy_min cannot be greater than energy_max" in res.json()["detail"]

def test_x_search_ms_header(patch_pool):
    res = client.get("/api/v1/library/search")
    assert res.status_code == 200
    assert "X-Search-Ms" in res.headers
    # check it's a valid float
    float(res.headers["X-Search-Ms"])

def test_slow_query_logging(patch_pool, caplog):
    import logging
    patch_pool.sleep_sec = 0.2
    with caplog.at_level(logging.WARNING):
        res = client.get("/api/v1/library/search")
        assert res.status_code == 200
        assert "library_search slow query" in caplog.text

def test_existing_filters(patch_pool):
    res = client.get("/api/v1/library/search?q=test&limit=5")
    assert res.status_code == 200
    assert "%test%" in patch_pool.last_params
