import pytest
from unittest.mock import AsyncMock, MagicMock
from fastapi.testclient import TestClient

# We need to test get_target_suggestions directly, and the API endpoint via mock pool
import sys
import os

# Add rest_api to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../services/rest_api')))
from target_suggestions import get_target_suggestions
import routers.target_tracks

@pytest.mark.asyncio
async def test_get_target_suggestions_logic():
    # Mock pool and connection
    mock_pool = MagicMock()
    mock_conn = AsyncMock()

    # Setup mock context manager for pool.acquire()
    mock_acquire = AsyncMock()
    mock_acquire.__aenter__.return_value = mock_conn
    mock_pool.acquire.return_value = mock_acquire

    # Return some mock data representing what asyncpg would return
    mock_conn.fetch.return_value = [
        {
            "id": "uuid-1",
            "title": "Strobe",
            "artist": "Deadmau5",
            "genres": ["House", "Electronic"],
            "camelot_key": "10A",
            "melbourne_shows": 3,
            "edge_count": 1
        },
        {
            "id": "uuid-2",
            "title": "Ghosts n Stuff",
            "artist": "Deadmau5",
            "genres": ["Electronic"],
            "camelot_key": None,
            "melbourne_shows": 1,
            "edge_count": 0
        },
        {
            "id": "uuid-3",
            "title": "Some Track",
            "artist": "Artist",
            "genres": None,
            "camelot_key": "5B",
            "melbourne_shows": 0,
            "edge_count": 10
        }
    ]

    suggestions = await get_target_suggestions(mock_pool, limit=20)

    assert len(suggestions) == 3

    # 1st track: Strobe -> 3 melb shows (50), low edge count in key (30), 0 existing targets (10) -> score 90
    assert suggestions[0]["title"] == "Strobe"
    assert suggestions[0]["priority_score"] == 90
    assert "Heard on 3 Melbourne shows" in suggestions[0]["rationale"]
    assert "Low graph edge density in key 10A (1 edges)" in suggestions[0]["rationale"]
    assert "0 existing target records" in suggestions[0]["rationale"]

    # 2nd track: Ghosts n Stuff -> 1 melb show (0), no key low edge (15), 0 targets (10) -> score 25
    assert suggestions[1]["title"] == "Ghosts n Stuff"
    assert suggestions[1]["priority_score"] == 25
    assert "Low graph edge density (0 edges)" in suggestions[1]["rationale"]

    # 3rd track: Some Track -> 0 melb shows (0), 10 edges (0), 0 targets (10) -> score 10
    assert suggestions[2]["title"] == "Some Track"
    assert suggestions[2]["priority_score"] == 10
    assert suggestions[2]["rationale"] == "0 existing target records"
    assert suggestions[2]["genres"] == [] # Testing none handling

@pytest.mark.asyncio
async def test_target_suggestions_api_no_pool():
    # If pool is None, we expect a 503 HTTP exception
    import main
    main.db_pool = None
    client = TestClient(main.app)

    response = client.get("/api/v1/target-tracks/suggestions")
    assert response.status_code == 503
    assert response.json()["detail"] == "Database pool not initialized"

@pytest.mark.asyncio
async def test_target_suggestions_api_empty_db():
    import main

    # Mock pool and connection for the API
    mock_pool = MagicMock()
    mock_conn = AsyncMock()

    # Setup mock context manager for pool.acquire()
    mock_acquire = AsyncMock()
    mock_acquire.__aenter__.return_value = mock_conn
    mock_pool.acquire.return_value = mock_acquire

    # Empty list returned from db
    mock_conn.fetch.return_value = []

    main.db_pool = mock_pool
    client = TestClient(main.app)

    response = client.get("/api/v1/target-tracks/suggestions")
    assert response.status_code == 200
    assert response.json() == []
