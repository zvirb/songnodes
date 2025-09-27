#!/usr/bin/env python3
"""
Migrate target tracks from JSON file to database
"""

import json
import asyncio
import asyncpg
from pathlib import Path
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def migrate_target_tracks():
    """Load target tracks from JSON and insert into database"""

    # Database connection (use Docker mapped port)
    conn = await asyncpg.connect(
        host='localhost',
        port=5433,  # Docker mapped port
        database='musicdb',
        user='musicdb_user',
        password='7D82_xqNs55tGyk'
    )

    try:
        # Load JSON file
        json_path = Path(__file__).parent / 'target_tracks_for_scraping.json'
        with open(json_path, 'r') as f:
            data = json.load(f)

        # Extract tracks
        priority_tracks = data.get('scraper_targets', {}).get('priority_tracks', [])
        all_tracks = data.get('scraper_targets', {}).get('all_tracks', [])

        # Combine and deduplicate
        tracks_by_key = {}

        # Process priority tracks first (they have higher priority)
        for track in priority_tracks:
            key = (track.get('title'), track.get('primary_artist') or track.get('artists', ['Unknown'])[0])
            if key not in tracks_by_key:
                tracks_by_key[key] = {
                    'title': track.get('title'),
                    'artist': track.get('primary_artist') or track.get('artists', ['Unknown'])[0],
                    'priority': track.get('priority', 'high'),  # Priority tracks default to high
                    'search_terms': track.get('search_terms', []),
                    'genres': [track.get('genre')] if track.get('genre') else []
                }

        # Then process all tracks (lower priority)
        for track in all_tracks:
            key = (track.get('title'), track.get('primary_artist') or track.get('artists', ['Unknown'])[0])
            if key not in tracks_by_key:
                tracks_by_key[key] = {
                    'title': track.get('title'),
                    'artist': track.get('primary_artist') or track.get('artists', ['Unknown'])[0],
                    'priority': track.get('priority', 'medium'),  # Default to medium
                    'search_terms': track.get('search_terms', []),
                    'genres': [track.get('genre')] if track.get('genre') else []
                }

        logger.info(f"Found {len(tracks_by_key)} unique tracks to migrate")

        # Insert into database
        insert_query = """
            INSERT INTO target_tracks (title, artist, priority, search_terms, genres)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (title, artist) DO UPDATE
            SET priority = EXCLUDED.priority,
                search_terms = EXCLUDED.search_terms,
                genres = EXCLUDED.genres,
                updated_at = CURRENT_TIMESTAMP
        """

        inserted = 0
        for track_data in tracks_by_key.values():
            try:
                await conn.execute(
                    insert_query,
                    track_data['title'],
                    track_data['artist'],
                    track_data['priority'],
                    track_data.get('search_terms', []),
                    track_data.get('genres', [])
                )
                inserted += 1
            except Exception as e:
                logger.error(f"Error inserting track {track_data['title']}: {e}")

        logger.info(f"Successfully migrated {inserted} tracks to database")

        # Show summary
        result = await conn.fetch("""
            SELECT priority, COUNT(*) as count
            FROM target_tracks
            GROUP BY priority
            ORDER BY priority
        """)

        logger.info("Target tracks by priority:")
        for row in result:
            logger.info(f"  {row['priority']}: {row['count']} tracks")

        # Show sample tracks
        sample = await conn.fetch("""
            SELECT title, artist, priority
            FROM target_tracks
            ORDER BY priority, title
            LIMIT 5
        """)

        logger.info("\nSample target tracks:")
        for row in sample:
            logger.info(f"  [{row['priority']}] {row['artist']} - {row['title']}")

    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(migrate_target_tracks())