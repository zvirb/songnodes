#!/usr/bin/env python3
"""
Migrate all edges from JSON to database
"""
import json
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime

# Database connection
DB_CONFIG = {
    'host': 'localhost',
    'port': 5432,
    'database': 'musicdb',
    'user': 'musicdb_user',
    'password': 'musicdb_dev_password_2024'
}

def migrate_edges():
    """Migrate all edges from JSON to database"""
    print("🔗 Loading JSON edge data...")

    # Load JSON data
    with open('frontend/public/live-performance-data.json', 'r') as f:
        data = json.load(f)

    edges = data['edges']
    print(f"📊 Found {len(edges)} edges in JSON")

    # Connect to database
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor(cursor_factory=RealDictCursor)

    try:
        # Clear existing edges
        print("🧹 Clearing existing edges...")
        cur.execute("DELETE FROM song_adjacency")

        # Prepare for bulk insert
        print("🔗 Inserting all edges...")
        edge_count = 0
        skipped_count = 0

        for edge in edges:
            source_id = edge['source']
            target_id = edge['target']
            weight = edge.get('weight', 1.0)

            # Ensure source < target for the constraint (song_id_1 < song_id_2)
            if source_id < target_id:
                song_id_1, song_id_2 = source_id, target_id
            else:
                song_id_1, song_id_2 = target_id, source_id

            try:
                cur.execute("""
                    INSERT INTO song_adjacency (song_id_1, song_id_2, occurrence_count)
                    VALUES (%s, %s, %s)
                    ON CONFLICT (song_id_1, song_id_2) DO UPDATE SET
                    occurrence_count = EXCLUDED.occurrence_count
                """, (song_id_1, song_id_2, int(weight)))
                edge_count += 1
            except psycopg2.Error as e:
                # Skip edges where songs don't exist in database
                skipped_count += 1
                if skipped_count <= 5:  # Only show first few errors
                    print(f"⚠️  Skipped edge {source_id} -> {target_id}: {e}")

        print(f"✅ Inserted {edge_count} edges")
        if skipped_count > 0:
            print(f"⚠️  Skipped {skipped_count} edges (songs not found in database)")

        # Commit transaction
        conn.commit()
        print("💾 Transaction committed successfully!")

        # Verify data
        cur.execute("SELECT COUNT(*) FROM song_adjacency")
        final_edge_count = cur.fetchone()[0]

        print(f"\\n📈 Final edge count: {final_edge_count}")

    except Exception as e:
        print(f"❌ Error: {e}")
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    migrate_edges()