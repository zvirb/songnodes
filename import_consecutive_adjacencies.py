#!/usr/bin/env python3
"""
Import consecutive adjacencies directly to fix isolated tracks
This script creates adjacencies ONLY between consecutive tracks (distance = 1)
"""

import asyncio
import asyncpg
import logging
import sys
import os
from datetime import datetime

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Database configuration for Docker environment
DB_CONFIG = {
    'host': 'localhost',
    'port': 5433,  # Docker mapped port
    'database': 'musicdb',
    'user': 'musicdb_user',
    'password': 'musicdb_secure_pass'  # Default from docker-compose
}

# Setlist data with consecutive adjacencies
SETLIST_DATA = {
    "setlists": [
        {
            "setlist_name": "FISHER - Tomorrowland 2025 Weekend 1 Mainstage",
            "dj_artist": "FISHER",
            "event_name": "Tomorrowland 2025",
            "tracks": [
                {"position": 1, "title": "ID", "artist": "FISHER"},
                {"position": 2, "title": "Pump The Brakes", "artist": "Dom Dolla"},
                {"position": 3, "title": "Miracle Maker", "artist": "Dom Dolla"},
                {"position": 4, "title": "San Francisco", "artist": "Dom Dolla"},
                {"position": 5, "title": "Stay", "artist": "FISHER"},
                {"position": 6, "title": "Get Hype", "artist": "Chris Lake"},
                {"position": 7, "title": "Freak", "artist": "FISHER"},
                {"position": 8, "title": "Atmosphere", "artist": "FISHER"},
                {"position": 9, "title": "Tidal Wave", "artist": "Chris Lake"},
                {"position": 10, "title": "A Drug From God", "artist": "Chris Lake & NPC"},
                {"position": 11, "title": "Goosebumps", "artist": "HVDES"},
                {"position": 12, "title": "Jungle", "artist": "X Ambassadors & Jamie N Commons"},
                {"position": 13, "title": "Push To Start", "artist": "Noizu"},
                {"position": 14, "title": "ID", "artist": "Unknown"},
                {"position": 15, "title": "Somebody (2024)", "artist": "Gotye, Kimbra, FISHER, Chris Lake, Sante Sansone"},
                {"position": 16, "title": "Baby Baby", "artist": "Mau P"},
                {"position": 17, "title": "Drugs From Amsterdam", "artist": "Mau P"},
                {"position": 18, "title": "Gimme! Gimme! Gimme!", "artist": "Mau P"},
                {"position": 19, "title": "Metro", "artist": "Mau P"},
                {"position": 20, "title": "Shake The Bottle", "artist": "Mau P"},
                {"position": 21, "title": "Take It Off", "artist": "FISHER"},
                {"position": 22, "title": "Crazy", "artist": "Patrick Topping"},
                {"position": 23, "title": "World, Hold On", "artist": "Bob Sinclar"},
                {"position": 24, "title": "ID", "artist": "FISHER"},
                {"position": 25, "title": "Losing It", "artist": "FISHER"}
            ]
        },
        {
            "setlist_name": "Fred again.. - EDC Las Vegas 2024",
            "dj_artist": "Fred again..",
            "event_name": "EDC Las Vegas 2024",
            "tracks": [
                {"position": 1, "title": "Marea (We've Lost Dancing)", "artist": "Fred again.."},
                {"position": 2, "title": "Kyle (I Found You)", "artist": "Fred again.."},
                {"position": 3, "title": "Danielle (smile on my face)", "artist": "Fred again.."},
                {"position": 4, "title": "Angie (I've Been Lost)", "artist": "Fred again.."},
                {"position": 5, "title": "Turn On The Lights again..", "artist": "Fred again.., Swedish House Mafia"},
                {"position": 6, "title": "Rumble", "artist": "Skrillex, Fred again.., Flowdan"},
                {"position": 7, "title": "Baby again..", "artist": "Fred again.., Skrillex"},
                {"position": 8, "title": "Clara (the night is dark)", "artist": "Fred again.."},
                {"position": 9, "title": "adore u", "artist": "Fred again.., Obongjayar"},
                {"position": 10, "title": "places to be", "artist": "Fred again.., Anderson .Paak, CHIKA"},
                {"position": 11, "title": "Jungle", "artist": "Fred again.."},
                {"position": 12, "title": "Lights Out", "artist": "Fred again.."},
                {"position": 13, "title": "leavemealone", "artist": "Fred again.., Baby Keem"},
                {"position": 14, "title": "Bleu (better with time)", "artist": "Fred again.."},
                {"position": 15, "title": "fear less", "artist": "Fred again.., Sampha"},
                {"position": 16, "title": "Strong", "artist": "Romy, Fred again.."},
                {"position": 17, "title": "Billie (loving arms)", "artist": "Fred again.."},
                {"position": 18, "title": "ten", "artist": "Fred again.., Jozzy"},
                {"position": 19, "title": "Delilah (pull me out of this)", "artist": "Fred again.."}
            ]
        }
    ]
}

class ConsecutiveAdjacencyImporter:
    """Import consecutive adjacencies directly to the database"""

    def __init__(self, db_config):
        self.db_config = db_config
        self.pool = None

    async def connect(self):
        """Connect to database"""
        connection_string = (
            f"postgresql://{self.db_config['user']}:{self.db_config['password']}@"
            f"{self.db_config['host']}:{self.db_config['port']}/{self.db_config['database']}"
        )

        self.pool = await asyncpg.create_pool(
            connection_string,
            min_size=1,
            max_size=5,
            command_timeout=60
        )
        logger.info("✓ Connected to database")

    async def close(self):
        """Close database connection"""
        if self.pool:
            await self.pool.close()
            logger.info("✓ Database connection closed")

    async def find_or_create_song(self, conn, title, artist):
        """Find or create a song record"""
        # First try to find existing song
        song_id = await conn.fetchval("""
            SELECT id FROM songs
            WHERE LOWER(TRIM(title)) = LOWER(TRIM($1))
            AND LOWER(TRIM(artist)) = LOWER(TRIM($2))
            LIMIT 1
        """, title, artist)

        if song_id:
            return song_id

        # Create new song if not found
        import uuid
        new_song_id = str(uuid.uuid4())

        await conn.execute("""
            INSERT INTO songs (id, title, artist, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT DO NOTHING
        """, new_song_id, title, artist, datetime.now(), datetime.now())

        logger.info(f"Created new song: {title} - {artist}")
        return new_song_id

    async def create_consecutive_adjacency(self, conn, song_id_1, song_id_2):
        """Create a consecutive adjacency relationship"""
        # Ensure song_id_1 < song_id_2 for schema constraint
        if song_id_1 > song_id_2:
            song_id_1, song_id_2 = song_id_2, song_id_1

        await conn.execute("""
            INSERT INTO song_adjacency (song_id_1, song_id_2, occurrence_count, avg_distance)
            VALUES ($1, $2, 1, 1.0)
            ON CONFLICT (song_id_1, song_id_2)
            DO UPDATE SET
                occurrence_count = song_adjacency.occurrence_count + 1,
                avg_distance = 1.0
        """, song_id_1, song_id_2)

    async def import_setlist_adjacencies(self, setlist):
        """Import consecutive adjacencies from a single setlist"""
        async with self.pool.acquire() as conn:
            async with conn.transaction():
                setlist_name = setlist['setlist_name']
                tracks = sorted(setlist['tracks'], key=lambda x: x['position'])

                logger.info(f"Processing setlist: {setlist_name}")
                logger.info(f"  Tracks: {len(tracks)}")

                adjacency_count = 0
                prev_song_id = None

                for track in tracks:
                    title = track['title']
                    artist = track['artist']

                    # Find or create song
                    song_id = await self.find_or_create_song(conn, title, artist)

                    # Create adjacency with previous track (consecutive only)
                    if prev_song_id and song_id != prev_song_id:
                        await self.create_consecutive_adjacency(conn, prev_song_id, song_id)
                        adjacency_count += 1
                        logger.debug(f"  Created adjacency: {adjacency_count}")

                    prev_song_id = song_id

                logger.info(f"  ✓ Created {adjacency_count} consecutive adjacencies")
                return adjacency_count

    async def import_all_setlists(self):
        """Import all setlist data with consecutive adjacencies"""
        total_adjacencies = 0

        logger.info("🚀 Starting consecutive adjacency import")
        logger.info(f"Processing {len(SETLIST_DATA['setlists'])} setlists")

        for setlist in SETLIST_DATA['setlists']:
            adjacencies = await self.import_setlist_adjacencies(setlist)
            total_adjacencies += adjacencies

        logger.info(f"✅ Import complete! Total consecutive adjacencies created: {total_adjacencies}")
        return total_adjacencies

    async def get_adjacency_stats(self):
        """Get current adjacency statistics"""
        async with self.pool.acquire() as conn:
            stats = await conn.fetchrow("""
                SELECT
                    COUNT(*) as total_adjacencies,
                    COUNT(DISTINCT song_id_1) + COUNT(DISTINCT song_id_2) as connected_songs,
                    AVG(occurrence_count) as avg_occurrence_count,
                    MAX(occurrence_count) as max_occurrence_count
                FROM song_adjacency
            """)

            total_songs = await conn.fetchval("SELECT COUNT(*) FROM songs")

            return {
                'total_songs': total_songs,
                'total_adjacencies': stats['total_adjacencies'],
                'connected_songs': stats['connected_songs'],
                'isolated_songs': total_songs - stats['connected_songs'] if stats['connected_songs'] else total_songs,
                'avg_occurrence_count': float(stats['avg_occurrence_count'] or 0),
                'max_occurrence_count': stats['max_occurrence_count'] or 0
            }

async def main():
    """Main import function"""
    importer = ConsecutiveAdjacencyImporter(DB_CONFIG)

    try:
        await importer.connect()

        # Get stats before import
        logger.info("📊 Statistics before import:")
        before_stats = await importer.get_adjacency_stats()
        for key, value in before_stats.items():
            logger.info(f"  {key}: {value}")

        # Clear existing adjacencies to ensure clean consecutive-only data
        async with importer.pool.acquire() as conn:
            await conn.execute("DELETE FROM song_adjacency")
            logger.info("🧹 Cleared existing adjacencies for clean import")

        # Import consecutive adjacencies
        total_adjacencies = await importer.import_all_setlists()

        # Get stats after import
        logger.info("📊 Statistics after import:")
        after_stats = await importer.get_adjacency_stats()
        for key, value in after_stats.items():
            logger.info(f"  {key}: {value}")

        # Calculate improvement
        if before_stats['isolated_songs'] > 0:
            improvement = ((before_stats['isolated_songs'] - after_stats['isolated_songs']) /
                          before_stats['isolated_songs']) * 100
            logger.info(f"🎯 Improvement: {improvement:.1f}% reduction in isolated tracks")

    except Exception as e:
        logger.error(f"❌ Import failed: {e}")
        raise
    finally:
        await importer.close()

if __name__ == "__main__":
    asyncio.run(main())