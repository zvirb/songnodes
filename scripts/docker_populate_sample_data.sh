#!/bin/bash

# SongNodes Sample Data Population Script - Docker Version
# This script runs the sample data population inside a Python container

echo "🎵 SongNodes Sample Data Population - Docker Execution"
echo "======================================================="

# Check if postgres container is running
if ! docker ps | grep -q "postgres"; then
    echo "❌ Error: PostgreSQL container is not running"
    echo "Please start the database with: docker-compose up -d postgres"
    exit 1
fi

# Create a temporary Python script that doesn't require external dependencies
cat > /tmp/populate_simple.py << 'EOF'
import psycopg2
import json
import random
from datetime import datetime

def populate_sample_data():
    """Populate the database with sample music data"""
    
    # Database connection
    conn = psycopg2.connect(
        host="postgres",
        port=5432,
        database="musicdb",
        user="musicdb_user",
        password="musicdb_secure_pass"
    )
    cur = conn.cursor()
    
    print("✓ Connected to database")
    
    # Sample genres and their relationships
    genres = ["Techno", "House", "Deep House", "Progressive House", "Tech House", 
              "Minimal", "Ambient", "Trance", "Drum & Bass", "Dubstep"]
    
    # Sample artists
    artists = []
    for i in range(50):
        artist_name = f"Artist_{i+1:03d}"
        artists.append(artist_name)
        cur.execute("""
            INSERT INTO musicdb.artists (artist_name, bio, created_at)
            VALUES (%s, %s, %s)
            ON CONFLICT (artist_name) DO NOTHING
        """, (artist_name, f"Electronic music producer #{i+1}", datetime.now()))
    
    print(f"✓ Created {len(artists)} artists")
    
    # Sample tracks
    tracks = []
    for i in range(100):
        track_name = f"Track_{i+1:03d}"
        artist = random.choice(artists)
        genre = random.choice(genres)
        bpm = round(random.uniform(120, 140), 1)
        key = random.choice(['Am', 'C', 'G', 'F', 'Dm', 'Em', 'Bm'])
        
        cur.execute("""
            INSERT INTO musicdb.tracks (
                track_name, genre, bpm, musical_key, 
                energy, danceability, valence, created_at
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (track_name) DO NOTHING
            RETURNING track_id
        """, (
            track_name, genre, bpm, key,
            random.random(), random.random(), random.random(),
            datetime.now()
        ))
        
        result = cur.fetchone()
        if result:
            track_id = result[0]
            tracks.append((track_id, track_name, bpm, key, genre))
            
            # Link track to artist
            cur.execute("""
                INSERT INTO musicdb.track_artists (track_name, artist_name, artist_role)
                VALUES (%s, %s, %s)
                ON CONFLICT DO NOTHING
            """, (track_name, artist, 'primary'))
    
    print(f"✓ Created {len(tracks)} tracks")
    
    # Create relationships between tracks
    relationships = 0
    for i in range(500):
        track1 = random.choice(tracks)
        track2 = random.choice(tracks)
        
        if track1[0] != track2[0]:  # Don't create self-relationships
            # Calculate weight based on similarity
            bpm_diff = abs(track1[2] - track2[2])
            weight = max(0.1, 1.0 - (bpm_diff / 20))
            
            # Bonus for same genre
            if track1[4] == track2[4]:
                weight = min(1.0, weight + 0.2)
            
            # Create relationship (as edge in graph context)
            cur.execute("""
                INSERT INTO musicdb.relationships (
                    source_id, target_id, relationship_type, weight, created_at
                )
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT DO NOTHING
            """, (track1[0], track2[0], 'similar', weight, datetime.now()))
            
            relationships += 1
    
    print(f"✓ Created {relationships} relationships")
    
    # Commit changes
    conn.commit()
    
    # Display summary
    cur.execute("SELECT COUNT(*) FROM musicdb.tracks")
    total_tracks = cur.fetchone()[0]
    
    cur.execute("SELECT COUNT(*) FROM musicdb.artists")
    total_artists = cur.fetchone()[0]
    
    cur.execute("SELECT COUNT(*) FROM musicdb.relationships")
    total_relationships = cur.fetchone()[0]
    
    print("\n" + "="*60)
    print("SAMPLE DATA GENERATION COMPLETED")
    print("="*60)
    print(f"✓ Total Tracks: {total_tracks}")
    print(f"✓ Total Artists: {total_artists}")
    print(f"✓ Total Relationships: {total_relationships}")
    print("="*60)
    print("✓ Ready for graph visualization!")
    
    cur.close()
    conn.close()

if __name__ == "__main__":
    try:
        populate_sample_data()
    except Exception as e:
        print(f"❌ Error: {e}")
        exit(1)
EOF

echo "Running data population in container..."
echo ""

# Run the script in a Python container connected to the network
docker run --rm \
    --network songnodes_default \
    -v /tmp/populate_simple.py:/app/populate.py \
    python:3.11-slim \
    sh -c "pip install psycopg2-binary && python /app/populate.py"

echo ""
echo "✅ Sample data population complete!"
echo ""
echo "To verify the data, run:"
echo "  docker exec postgres psql -U musicdb_user -d musicdb -c 'SELECT COUNT(*) FROM musicdb.tracks;'"