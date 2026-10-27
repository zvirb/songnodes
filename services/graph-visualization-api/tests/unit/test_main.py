import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, AsyncMock
from main import app

client = TestClient(app)

@patch('main.db_circuit_breaker.call', new_callable=AsyncMock)
def test_health(mock_breaker):
    mock_breaker.return_value = {"status": "ok"}
    response = client.get("/health")
    # Our mocked health check doesn't bypass everything but TestClient hits the real endpoint
    # We should patch the underlying dependencies instead for a proper test.
    pass

@patch('main.get_container_memory_usage', return_value=50.0)
@patch('main.async_session')
@patch('main.redis_pool')
def test_health_endpoint(mock_redis, mock_session_maker, mock_memory):
    mock_redis.ping = AsyncMock(return_value=True)

    mock_session = AsyncMock()
    mock_session.execute = AsyncMock(return_value=True)

    # We need to mock the context manager properly
    mock_session_maker.return_value.__aenter__.return_value = mock_session
    mock_session_maker.return_value.__aexit__.return_value = None

    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["checks"]["database"]["connected"] is True
    assert data["checks"]["redis"]["connected"] is True

@patch('main.db_circuit_breaker.call', new_callable=AsyncMock)
def test_get_visualization_graph(mock_db_call):
    # Setup mock return values for nodes and edges
    mock_db_call.side_effect = [
        {'nodes': [{'id': 'node1'}]},
        {'edges': [{'source': 'node1', 'target': 'node2'}]}
    ]

    query_payload = {
        "center_node_id": "12345678-1234-5678-1234-567812345678",
        "max_depth": 2,
        "max_nodes": 100,
        "filters": {}
    }

    response = client.post("/api/v1/visualization/graph", json=query_payload)
    assert response.status_code == 200
    data = response.json()
    assert len(data['nodes']) == 1
    assert len(data['edges']) == 1
    assert data['nodes'][0]['id'] == 'node1'
