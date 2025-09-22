#!/usr/bin/env python3
"""Check database contents after scraping"""

import asyncio
import asyncpg

async def check_database():
    conn = await asyncpg.connect(
        host='localhost',
        port=5433,
        database='musicdb',
        user='musicdb_user',
        password='musicdb_secure_pass'
    )

    # Get counts
    songs = await conn.fetchval("SELECT COUNT(*) FROM songs")
    artists = await conn.fetchval("SELECT COUNT(*) FROM artists")
    playlists = await conn.fetchval("SELECT COUNT(*) FROM playlists")
    adjacencies = await conn.fetchval("SELECT COUNT(*) FROM song_adjacency")

    print(f"Database Status:")
    print(f"  Songs: {songs}")
    print(f"  Artists: {artists}")
    print(f"  Playlists: {playlists}")
    print(f"  Adjacencies: {adjacencies}")

    # Get sample data
    if songs > 0:
        sample_songs = await conn.fetch("SELECT title, song_id FROM songs LIMIT 5")
        print(f"\nSample Songs:")
        for song in sample_songs:
            print(f"  - {song['title']} (ID: {song['song_id']})")

    if adjacencies > 0:
        sample_adj = await conn.fetch("""
            SELECT s1.title as song1, s2.title as song2, sa.occurrence_count
            FROM song_adjacency sa
            JOIN songs s1 ON sa.song_id_1 = s1.song_id
            JOIN songs s2 ON sa.song_id_2 = s2.song_id
            LIMIT 5
        """)
        print(f"\nSample Adjacencies:")
        for adj in sample_adj:
            print(f"  - {adj['song1']} → {adj['song2']} (count: {adj['occurrence_count']})")

    await conn.close()

if __name__ == "__main__":
    asyncio.run(check_database())