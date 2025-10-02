"""Pytest fixtures for WebSocket API tests"""
import pytest
import asyncio
from typing import AsyncGenerator, Generator
from unittest.mock import AsyncMock, MagicMock, patch
from httpx import AsyncClient
from fastapi.testclient import TestClient


@pytest.fixture(scope="session")
def event_loop() -> Generator:
    """Create event loop for async tests"""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
def mock_redis_client():
    """Mock Redis client"""
    redis_mock = AsyncMock()
    redis_mock.ping.return_value = True
    redis_mock.get.return_value = None
    redis_mock.set.return_value = True
    redis_mock.lpush.return_value = 1
    redis_mock.ltrim.return_value = True
    redis_mock.lrange.return_value = []
    redis_mock.close.return_value = None
    return redis_mock


@pytest.fixture
def mock_rabbitmq_connection():
    """Mock RabbitMQ connection"""
    connection_mock = AsyncMock()
    channel_mock = AsyncMock()
    exchange_mock = AsyncMock()

    connection_mock.channel.return_value = channel_mock
    channel_mock.declare_exchange.return_value = exchange_mock
    channel_mock.declare_queue.return_value = AsyncMock()

    connection_mock.close.return_value = None
    exchange_mock.publish.return_value = None

    return connection_mock, channel_mock, exchange_mock


@pytest.fixture
async def test_client(mock_redis_client, mock_rabbitmq_connection):
    """Create test client with mocked dependencies"""
    rabbitmq_conn, rabbitmq_channel, rabbitmq_exchange = mock_rabbitmq_connection

    # Mock Redis and RabbitMQ connections
    with patch('main.redis.ConnectionPool', return_value=MagicMock()):
        with patch('main.redis.from_url', return_value=mock_redis_client):
            with patch('main.aio_pika.connect_robust', return_value=rabbitmq_conn):
                from main import app, websocket_service

                # Override service dependencies
                websocket_service.redis_client = mock_redis_client
                websocket_service.rabbitmq_connection = rabbitmq_conn
                websocket_service.rabbitmq_channel = rabbitmq_channel
                websocket_service.exchange = rabbitmq_exchange

                async with AsyncClient(app=app, base_url="http://test") as client:
                    yield client


@pytest.fixture
def sync_test_client(mock_redis_client, mock_rabbitmq_connection):
    """Create synchronous test client"""
    rabbitmq_conn, rabbitmq_channel, rabbitmq_exchange = mock_rabbitmq_connection

    with patch('main.redis.ConnectionPool', return_value=MagicMock()):
        with patch('main.redis.from_url', return_value=mock_redis_client):
            with patch('main.aio_pika.connect_robust', return_value=rabbitmq_conn):
                from main import app, websocket_service

                websocket_service.redis_client = mock_redis_client
                websocket_service.rabbitmq_connection = rabbitmq_conn
                websocket_service.rabbitmq_channel = rabbitmq_channel
                websocket_service.exchange = rabbitmq_exchange

                with TestClient(app) as client:
                    yield client


@pytest.fixture
def sample_websocket_message():
    """Sample WebSocket message"""
    return {
        "type": "chat",
        "data": {
            "message": "Hello, WebSocket!"
        }
    }


@pytest.fixture
def sample_graph_interaction_message():
    """Sample graph interaction message"""
    return {
        "type": "graph_interaction",
        "data": {
            "action": "select",
            "node_id": "node_123",
            "position": {"x": 100, "y": 200}
        }
    }


@pytest.fixture
def sample_subscribe_message():
    """Sample subscribe message"""
    return {
        "type": "subscribe",
        "data": {
            "channel": "graph_updates"
        }
    }
