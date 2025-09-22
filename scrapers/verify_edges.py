#!/usr/bin/env python3
"""Verify edge counts in database"""

import asyncio
import asyncpg

async def verify():
    conn = await asyncpg.connect(
        host='localhost',
        port=5433,
        database='musicdb',
        user='musicdb_user',
        password='musicdb_secure_pass'
    )

    # Count adjacencies directly
    adj_count = await conn.fetchval("SELECT COUNT(*) FROM song_adjacency")
    print(f"Direct count from song_adjacency table: {adj_count}")

    # Count from graph_edges view
    edge_count = await conn.fetchval("SELECT COUNT(*) FROM graph_edges")
    print(f"Count from graph_edges view: {edge_count}")

    # Get some sample edges
    edges = await conn.fetch("""
        SELECT s1.title as song1, s2.title as song2, sa.occurrence_count
        FROM song_adjacency sa
        JOIN songs s1 ON sa.song_id_1 = s1.song_id
        JOIN songs s2 ON sa.song_id_2 = s2.song_id
        ORDER BY sa.occurrence_count DESC
        LIMIT 10
    """)

    print(f"\nTop 10 adjacencies by occurrence count:")
    for edge in edges:
        print(f"  {edge['song1']} → {edge['song2']} (count: {edge['occurrence_count']})")

    await conn.close()

if __name__ == "__main__":
    asyncio.run(verify())