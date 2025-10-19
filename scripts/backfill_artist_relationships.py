#!/usr/bin/env python3
"""
Backfill Artist Relationships for Enriched Tracks

This script populates artist relationships for tracks that:
- Have been successfully enriched (enrichment_status = 'completed')
- Have Spotify IDs
- But have NO artist relationships in track_artists table

This fixes a bug where enrichment completed but artist relationships weren't created.

Usage:
    python backfill_artist_relationships.py --limit 100
    python backfill_artist_relationships.py --all
"""

import argparse
import asyncio
import logging
import sys
from datetime import datetime
from uuid import UUID

import asyncpg

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Database configuration (host external port)
DB_CONFIG = {
    'host': 'localhost',
    'port': 5433,
    'user': 'musicdb_user',
    'password': 'K8Vabm2sn4gtgqIfex7u',  # From .env
    'database': 'musicdb'
}


async def backfill_artists(limit: int = None, dry_run: bool = False):
    """
    Backfill artist relationships for enriched tracks

    Args:
        limit: Maximum number of tracks to process (None = all)
        dry_run: If True, only show what would be done
    """
    stats = {
        'tracks_processed': 0,
        'artists_created': 0,
        'relationships_created': 0,
        'errors': 0
    }

    logger.info("=" * 80)
    logger.info("ARTIST RELATIONSHIP BACKFILL")
    logger.info("=" * 80)

    if dry_run:
        logger.warning("DRY RUN MODE - No database writes")

    # Connect to database
    logger.info("Connecting to database...")
    conn = await asyncpg.connect(**DB_CONFIG)

    try:
        # Find tracks that need artist backfill
        query = """
            SELECT
                t.id,
                t.title,
                t.spotify_id
            FROM tracks t
            LEFT JOIN track_artists ta ON t.id = ta.track_id
            LEFT JOIN enrichment_status es ON t.id = es.track_id
            WHERE ta.track_id IS NULL
              AND es.status = 'completed'
              AND t.spotify_id IS NOT NULL
            ORDER BY t.created_at DESC
        """

        if limit:
            query += f" LIMIT {limit}"

        logger.info(f"Fetching tracks (limit={limit or 'none'})...")
        tracks = await conn.fetch(query)

        logger.info(f"Found {len(tracks)} tracks to backfill")

        if not tracks:
            logger.info("No tracks need backfilling!")
            return stats

        # Show sample
        logger.info("\nSample tracks:")
        for track in tracks[:5]:
            logger.info(
                f"  - {str(track['id'])[:8]}... | "
                f"{track['title'][:50]:50} | "
                f"Spotify: {track['spotify_id']}"
            )

        if dry_run:
            logger.info(f"\nWould backfill {len(tracks)} tracks")
            return stats

        # Process each track
        for idx, track in enumerate(tracks, 1):
            track_id = track['id']
            spotify_id = track['spotify_id']

            try:
                # Call the /enrich endpoint to re-trigger enrichment
                # This will create artist relationships
                logger.info(
                    f"[{idx}/{len(tracks)}] Backfilling: {track['title'][:40]}"
                )

                # ALTERNATIVE APPROACH: Call Spotify API directly to get artists
                # Then create artist records and relationships
                # This requires importing the SpotifyClient which may not work outside container

                # SIMPLER APPROACH: Use SQL to extract artists from metadata JSONB
                # Many tracks may already have artist data in metadata
                query_metadata = """
                    SELECT metadata FROM tracks WHERE id = $1
                """
                row = await conn.fetchrow(query_metadata, track_id)

                if row and row['metadata']:
                    metadata = row['metadata']

                    # Check if metadata has artists array
                    if 'artists' in metadata and isinstance(metadata['artists'], list):
                        for position, artist_data in enumerate(metadata['artists']):
                            artist_name = artist_data.get('name')
                            artist_spotify_id = artist_data.get('spotify_id') or artist_data.get('id')

                            if not artist_name:
                                continue

                            # Create or get artist
                            artist_result = await conn.fetchrow("""
                                INSERT INTO artists (name, spotify_id)
                                VALUES ($1, $2)
                                ON CONFLICT (name) DO UPDATE
                                  SET spotify_id = COALESCE(artists.spotify_id, $2)
                                RETURNING artist_id
                            """, artist_name, artist_spotify_id)

                            artist_id = artist_result['artist_id']
                            stats['artists_created'] += 1

                            # Link to track
                            await conn.execute("""
                                INSERT INTO track_artists (track_id, artist_id, role, position)
                                VALUES ($1, $2, 'primary', $3)
                                ON CONFLICT (track_id, artist_id) DO NOTHING
                            """, track_id, artist_id, position)

                            stats['relationships_created'] += 1

                        logger.info(
                            f"  ✓ Created {len(metadata['artists'])} artist relationships"
                        )
                    else:
                        logger.warning(
                            f"  ✗ No artists in metadata for track {track_id}"
                        )

                stats['tracks_processed'] += 1

                # Progress update
                if idx % 100 == 0:
                    logger.info(
                        f"Progress: {idx}/{len(tracks)} tracks, "
                        f"{stats['relationships_created']} relationships created"
                    )

            except Exception as e:
                logger.error(
                    f"Error processing track {track_id}: {e}",
                    exc_info=True
                )
                stats['errors'] += 1

        # Summary
        logger.info("\n" + "=" * 80)
        logger.info("BACKFILL COMPLETE")
        logger.info("=" * 80)
        logger.info(f"Tracks Processed:         {stats['tracks_processed']}")
        logger.info(f"Artists Created/Updated:  {stats['artists_created']}")
        logger.info(f"Relationships Created:    {stats['relationships_created']}")
        logger.info(f"Errors:                   {stats['errors']}")

        return stats

    finally:
        await conn.close()


async def main():
    parser = argparse.ArgumentParser(
        description='Backfill artist relationships for enriched tracks'
    )
    parser.add_argument(
        '--limit',
        type=int,
        help='Maximum number of tracks to process'
    )
    parser.add_argument(
        '--all',
        action='store_true',
        help='Process all tracks (ignores --limit)'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Show what would be done without making changes'
    )

    args = parser.parse_args()

    limit = None if args.all else (args.limit or 100)

    try:
        stats = await backfill_artists(limit=limit, dry_run=args.dry_run)

        if stats['errors'] > 0:
            logger.error(f"Completed with {stats['errors']} errors")
            sys.exit(1)

        logger.info("✓ Backfill completed successfully")
        sys.exit(0)

    except KeyboardInterrupt:
        logger.warning("Interrupted by user")
        sys.exit(130)
    except Exception as e:
        logger.error(f"Fatal error: {e}", exc_info=True)
        sys.exit(1)


if __name__ == '__main__':
    asyncio.run(main())
