#!/usr/bin/env python3
"""
Migrate static JSON data to PostgreSQL database
"""
import json
import psycopg2
from psycopg2.extras import RealDictCursor
import uuid
from datetime import datetime

# Database connection
DB_CONFIG = {
    'host': 'localhost',
    'port': 5432,
    'database': 'musicdb',
    'user': 'musicdb_user',
    'password': 'musicdb_dev_password_2024'
}

def migrate_data():
    """Migrate JSON data to database"""
    print("🎵 Loading JSON data...")

    # Load JSON data
    with open('/tmp/live-performance-data.json', 'r') as f:
        data = json.load(f)

    nodes = data['nodes']
    edges = data['edges']

    print(f"📊 Found {len(nodes)} nodes and {len(edges)} edges")

    # Connect to database
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor(cursor_factory=RealDictCursor)

    try:
        # Clear existing test data
        print("🧹 Clearing existing test data...")
        cur.execute("DELETE FROM song_adjacency")
        cur.execute("DELETE FROM song_artists")
        cur.execute("DELETE FROM songs")
        cur.execute("DELETE FROM artists")

        # Create artist mapping
        artist_map = {}

        print("👥 Inserting artists...")
        for node in nodes:
            artist_name = node.get('artist', 'Unknown')
            if artist_name and artist_name != 'Unknown' and artist_name not in artist_map:
                artist_id = str(uuid.uuid4())
                artist_map[artist_name] = artist_id

                cur.execute("""
                    INSERT INTO artists (artist_id, name, created_at, updated_at)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (artist_id) DO NOTHING
                """, (artist_id, artist_name, datetime.now(), datetime.now()))

        print(f"✅ Inserted {len(artist_map)} artists")

        # Insert songs
        print("🎵 Inserting songs...")
        song_count = 0
        for node in nodes:
            song_id = node['id']
            title = node.get('title', node.get('label', 'Unknown'))
            artist_name = node.get('artist', 'Unknown')

            # Get artist ID
            primary_artist_id = artist_map.get(artist_name)

            # Extract metadata
            metadata = node.get('metadata', {})

            cur.execute("""
                INSERT INTO songs (
                    song_id, title, primary_artist_id, genre,
                    created_at, updated_at
                )
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (song_id) DO NOTHING
            """, (
                song_id, title, primary_artist_id, 'Electronic',
                datetime.now(), datetime.now()
            ))
            song_count += 1

        print(f"✅ Inserted {song_count} songs")

        # Insert song adjacencies (edges)
        print("🔗 Inserting song adjacencies...")
        adjacency_count = 0
        for edge in edges:
            source_id = edge['source']
            target_id = edge['target']
            weight = edge.get('weight', 1)

            # Ensure source < target for the constraint
            if source_id < target_id:
                song_id_1, song_id_2 = source_id, target_id
            else:
                song_id_1, song_id_2 = target_id, source_id

            cur.execute("""
                INSERT INTO song_adjacency (song_id_1, song_id_2, occurrence_count)
                VALUES (%s, %s, %s)
                ON CONFLICT (song_id_1, song_id_2) DO UPDATE SET
                occurrence_count = EXCLUDED.occurrence_count
            """, (song_id_1, song_id_2, weight))
            adjacency_count += 1

        print(f"✅ Inserted {adjacency_count} song adjacencies")

        # Commit transaction
        conn.commit()
        print("💾 Transaction committed successfully!")

        # Verify data
        cur.execute("SELECT COUNT(*) FROM songs")
        song_count = cur.fetchone()[0]

        cur.execute("SELECT COUNT(*) FROM artists")
        artist_count = cur.fetchone()[0]

        cur.execute("SELECT COUNT(*) FROM song_adjacency")
        edge_count = cur.fetchone()[0]

        print(f"\n📈 Final counts:")
        print(f"   Songs: {song_count}")
        print(f"   Artists: {artist_count}")
        print(f"   Adjacencies: {edge_count}")

    except Exception as e:
        print(f"❌ Error: {e}")
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    migrate_data()