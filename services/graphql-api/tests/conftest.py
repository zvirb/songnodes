"""Pytest fixtures for GraphQL API tests"""
import pytest
import asyncio
from typing import AsyncGenerator, Generator
from httpx import AsyncClient
from fastapi.testclient import TestClient


@pytest.fixture(scope="session")
def event_loop() -> Generator:
    """Create event loop for async tests"""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
async def test_client() -> AsyncGenerator:
    """Create async test client for GraphQL API"""
    from main import app

    async with AsyncClient(app=app, base_url="http://test") as client:
        yield client


@pytest.fixture
def sync_test_client() -> Generator:
    """Create synchronous test client"""
    from main import app

    with TestClient(app) as client:
        yield client


@pytest.fixture
def sample_graphql_query():
    """Sample GraphQL query for artists"""
    return """
    query {
        artists(limit: 10) {
            id
            name
            genre
            popularity
        }
    }
    """


@pytest.fixture
def sample_graphql_query_with_variables():
    """Sample GraphQL query with variables"""
    return {
        "query": """
            query GetArtist($id: Int!) {
                artist(id: $id) {
                    id
                    name
                    genre
                }
            }
        """,
        "variables": {"id": 1}
    }


@pytest.fixture
def sample_graphql_mutation():
    """Sample GraphQL mutation"""
    return """
    mutation {
        triggerScrape(source: "1001tracklists")
    }
    """


@pytest.fixture
def sample_tracks_query():
    """Sample GraphQL query for tracks"""
    return """
    query {
        tracks(artistId: 1) {
            id
            title
            artistId
            duration
            bpm
        }
    }
    """


@pytest.fixture
def sample_graph_query():
    """Sample GraphQL query for graph data"""
    return """
    query {
        graphNodes {
            id
            label
            type
            size
        }
        graphLinks {
            source
            target
            type
        }
    }
    """
