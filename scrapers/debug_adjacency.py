#!/usr/bin/env python3
"""Debug why adjacencies aren't being inserted"""

import asyncio
import asyncpg

async def debug_adjacency():
    conn = await asyncpg.connect(
        host='localhost',
        port=5433,
        database='musicdb',
        user='musicdb_user',
        password='musicdb_secure_pass'
    )

    # Check what song titles we have
    songs = await conn.fetch("SELECT title FROM songs ORDER BY title LIMIT 20")
    print("Sample song titles in database:")
    for song in songs:
        print(f"  '{song['title']}'")

    # Test looking up a song
    test_title = "Strobe"
    result = await conn.fetchval("""
        SELECT song_id FROM songs
        WHERE LOWER(TRIM(title)) = LOWER(TRIM($1))
        LIMIT 1
    """, test_title)
    print(f"\nLookup test for '{test_title}': {result}")

    # Check what's in the song_adjacency table
    adjacencies = await conn.fetch("""
        SELECT s1.title as song1, s2.title as song2, sa.occurrence_count
        FROM song_adjacency sa
        JOIN songs s1 ON sa.song_id_1 = s1.song_id
        JOIN songs s2 ON sa.song_id_2 = s2.song_id
    """)
    print(f"\nCurrent adjacencies in database ({len(adjacencies)} total):")
    for adj in adjacencies:
        print(f"  {adj['song1']} → {adj['song2']} (count: {adj['occurrence_count']})")

    await conn.close()

if __name__ == "__main__":
    asyncio.run(debug_adjacency())