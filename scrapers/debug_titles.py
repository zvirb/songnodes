#!/usr/bin/env python3
"""Debug title matching issues"""

import asyncio
import asyncpg

async def debug_titles():
    conn = await asyncpg.connect(
        host='localhost',
        port=5433,
        database='musicdb',
        user='musicdb_user',
        password='musicdb_secure_pass'
    )

    # Get all song titles
    songs = await conn.fetch("SELECT title FROM songs ORDER BY title")
    print(f"Total songs in database: {len(songs)}")
    print("\nAll song titles:")
    for song in songs:
        print(f"  '{song['title']}'")

    # Test some lookups
    test_titles = ["Strobe", "Levels", "Animals", "One"]
    print("\nTest lookups:")
    for title in test_titles:
        result = await conn.fetchval("""
            SELECT song_id FROM songs
            WHERE LOWER(TRIM(title)) = LOWER(TRIM($1))
            LIMIT 1
        """, title)
        print(f"  '{title}': {'FOUND' if result else 'NOT FOUND'}")

    await conn.close()

if __name__ == "__main__":
    asyncio.run(debug_titles())