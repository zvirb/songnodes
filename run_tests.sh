source .venv/bin/activate || source venv/bin/activate || pip install pytest pytest-asyncio asyncpg neo4j
pytest tests/graph_projection/test_graph_projection.py
