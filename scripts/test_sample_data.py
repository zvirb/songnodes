#!/usr/bin/env python3
"""
Test script to validate the sample data generation
"""

import asyncio
import asyncpg
import os
import sys

async def test_sample_data():
    """Test the sample data generation"""
    
    # Database configuration 
    password = os.getenv('POSTGRES_PASSWORD', 'musicdb_secure_pass')
    connection_string = f"postgresql://musicdb_user:{password}@localhost:5432/musicdb"
    
    try:
        conn = await asyncpg.connect(connection_string)
        print("✓ Connected to database")
        
        # Test basic queries
        artist_count = await conn.fetchval("SELECT COUNT(*) FROM musicdb.artists WHERE metadata->>'sample_data' = 'true'")
        track_count = await conn.fetchval("SELECT COUNT(*) FROM musicdb.tracks WHERE metadata->>'sample_data' = 'true'")
        relationship_count = await conn.fetchval("""
            SELECT COUNT(*) FROM musicdb.track_artists ta
            JOIN musicdb.tracks t ON ta.track_id = t.id
            WHERE t.metadata->>'sample_data' = 'true'
        """)
        
        print(f"✓ Found {artist_count} sample artists")
        print(f"✓ Found {track_count} sample tracks")
        print(f"✓ Found {relationship_count} sample relationships")
        
        # Test graph structure
        if track_count > 0:
            sample_track = await conn.fetchrow("""
                SELECT id, title, bpm, key, genre FROM musicdb.tracks 
                WHERE metadata->>'sample_data' = 'true' 
                LIMIT 1
            """)
            print(f"✓ Sample track: '{sample_track['title']}' ({sample_track['genre']}, {sample_track['bpm']} BPM, {sample_track['key']})")
            
            # Test relationships for this track
            track_artists = await conn.fetch("""
                SELECT a.name, ta.role FROM musicdb.track_artists ta
                JOIN musicdb.artists a ON ta.artist_id = a.id
                WHERE ta.track_id = $1
            """, sample_track['id'])
            
            print(f"✓ Track relationships: {len(track_artists)}")
            for rel in track_artists:
                print(f"  • {rel['name']} ({rel['role']})")
        
        await conn.close()
        print("✓ Test completed successfully")
        return True
        
    except Exception as e:
        print(f"✗ Test failed: {e}")
        return False

if __name__ == "__main__":
    success = asyncio.run(test_sample_data())
    sys.exit(0 if success else 1)