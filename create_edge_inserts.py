#!/usr/bin/env python3
"""
Create SQL INSERT statements for all edges
"""
import json

def create_edge_sql():
    """Create SQL file with all edge inserts"""
    print("🔗 Loading JSON edge data...")

    # Load JSON data
    with open('frontend/public/live-performance-data.json', 'r') as f:
        data = json.load(f)

    edges = data['edges']
    print(f"📊 Found {len(edges)} edges in JSON")

    with open('/tmp/insert_all_edges.sql', 'w') as sql_file:
        sql_file.write("-- Clear existing edges and insert all from JSON\n")
        sql_file.write("DELETE FROM song_adjacency;\n\n")

        for i, edge in enumerate(edges):
            source_id = edge['source']
            target_id = edge['target']
            weight = edge.get('weight', 1.0)

            # Ensure source < target for the constraint (song_id_1 < song_id_2)
            if source_id < target_id:
                song_id_1, song_id_2 = source_id, target_id
            else:
                song_id_1, song_id_2 = target_id, source_id

            sql_file.write(f"""INSERT INTO song_adjacency (song_id_1, song_id_2, occurrence_count)
VALUES ('{song_id_1}', '{song_id_2}', {int(weight)})
ON CONFLICT (song_id_1, song_id_2) DO UPDATE SET occurrence_count = EXCLUDED.occurrence_count;
""")

        sql_file.write("\n-- Check results\n")
        sql_file.write("SELECT COUNT(*) as total_edges FROM song_adjacency;\n")

    print(f"✅ Created SQL file with {len(edges)} edge inserts at /tmp/insert_all_edges.sql")

if __name__ == "__main__":
    create_edge_sql()