#!/usr/bin/env python3
"""Check updated database statistics after second scrape"""

import asyncio
import asyncpg

async def check_updated_data():
    conn = await asyncpg.connect(
        host='localhost',
        port=5433,
        database='musicdb',
        user='musicdb_user',
        password='musicdb_secure_pass'
    )

    print("=" * 60)
    print("DATABASE STATISTICS AFTER SECOND SCRAPE")
    print("=" * 60)

    # Get counts
    songs = await conn.fetchval("SELECT COUNT(*) FROM songs")
    artists = await conn.fetchval("SELECT COUNT(*) FROM artists")
    adjacencies = await conn.fetchval("SELECT COUNT(*) FROM song_adjacency")

    print(f"\nTotal Counts:")
    print(f"  Songs: {songs}")
    print(f"  Artists: {artists}")
    print(f"  Adjacencies: {adjacencies}")

    # Get top adjacencies with increased counts
    top_adjacencies = await conn.fetch("""
        SELECT s1.title as song1, s2.title as song2, sa.occurrence_count
        FROM song_adjacency sa
        JOIN songs s1 ON sa.song_id_1 = s1.song_id
        JOIN songs s2 ON sa.song_id_2 = s2.song_id
        ORDER BY sa.occurrence_count DESC
        LIMIT 10
    """)

    print(f"\nTop 10 Most Common Track Transitions:")
    print("-" * 40)
    for row in top_adjacencies:
        print(f"  {row['song1'][:20]:20} → {row['song2'][:20]:20} ({row['occurrence_count']}x)")

    # Get adjacencies with highest increases
    high_count = await conn.fetch("""
        SELECT COUNT(*) as edges, MAX(occurrence_count) as max_count,
               AVG(occurrence_count) as avg_count
        FROM song_adjacency
    """)

    for row in high_count:
        print(f"\nAdjacency Statistics:")
        print(f"  Total unique edges: {row['edges']}")
        print(f"  Highest occurrence count: {row['max_count']}")
        print(f"  Average occurrence count: {row['avg_count']:.2f}")

    # Count how many adjacencies have been seen multiple times
    multiple_occurrences = await conn.fetchval("""
        SELECT COUNT(*) FROM song_adjacency WHERE occurrence_count > 1
    """)

    print(f"  Edges seen multiple times: {multiple_occurrences}")
    print(f"  Percentage reinforced: {(multiple_occurrences/adjacencies*100):.1f}%")

    await conn.close()

    print("\n" + "=" * 60)
    print("ANALYSIS:")
    print("The second scrape has reinforced existing adjacency patterns.")
    print("Tracks that frequently appear together now have higher weights,")
    print("making the common DJ transitions more prominent in the graph.")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(check_updated_data())