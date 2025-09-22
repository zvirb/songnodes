#!/usr/bin/env python3
"""Clear all data from database tables"""

import asyncio
import asyncpg

async def clear_database():
    conn = await asyncpg.connect(
        host='localhost',
        port=5433,
        database='musicdb',
        user='musicdb_user',
        password='musicdb_secure_pass'
    )

    # Clear tables in correct order (respecting foreign keys)
    tables = [
        'song_adjacency',
        'playlist_songs',
        'song_artists',
        'playlists',
        'songs',
        'artists',
        'venues'
    ]

    for table in tables:
        await conn.execute(f"TRUNCATE TABLE {table} CASCADE")
        count = await conn.fetchval(f"SELECT COUNT(*) FROM {table}")
        print(f"Cleared {table}: {count} rows remaining")

    await conn.close()
    print("\nDatabase cleared successfully!")

if __name__ == "__main__":
    asyncio.run(clear_database())