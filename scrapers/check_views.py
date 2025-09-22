#!/usr/bin/env python3
"""Check database views"""

import asyncio
import asyncpg

async def check_views():
    conn = await asyncpg.connect(
        host='localhost',
        port=5433,
        database='musicdb',
        user='musicdb_user',
        password='musicdb_secure_pass'
    )

    # Check graph_nodes view
    nodes_query = """
    SELECT * FROM graph_nodes LIMIT 5
    """

    try:
        nodes = await conn.fetch(nodes_query)
        print(f"graph_nodes view returned {len(nodes)} rows")
        if nodes:
            print("Sample node:", dict(nodes[0]))
    except Exception as e:
        print(f"Error querying graph_nodes: {e}")

    # Check raw songs table
    songs = await conn.fetch("SELECT song_id, title FROM songs LIMIT 5")
    print(f"\nRaw songs table has {len(songs)} rows")
    for song in songs:
        print(f"  - {song['title']} (ID: {song['song_id']})")

    # Check if graph_nodes view exists
    view_exists = await conn.fetchval("""
        SELECT EXISTS (
            SELECT 1
            FROM information_schema.views
            WHERE table_schema = 'public'
            AND table_name = 'graph_nodes'
        )
    """)
    print(f"\ngraph_nodes view exists: {view_exists}")

    # Check view definition if it exists
    if view_exists:
        view_def = await conn.fetchval("""
            SELECT view_definition
            FROM information_schema.views
            WHERE table_schema = 'public'
            AND table_name = 'graph_nodes'
        """)
        print(f"\ngraph_nodes view definition:")
        print(view_def[:500] + "..." if len(view_def) > 500 else view_def)

    await conn.close()

if __name__ == "__main__":
    asyncio.run(check_views())