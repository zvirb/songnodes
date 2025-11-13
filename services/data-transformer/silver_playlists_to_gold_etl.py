#!/usr/bin/env python3
"""
Silver-to-Gold Playlist ETL Script (Medallion Architecture)
============================================================

Transforms silver_enriched_playlists into gold layer tables:
- playlists (main playlist metadata)
- playlist_tracks (track relationships with positions)

This ETL fills the critical gap causing only 354/16,476 playlists to be
in the gold layer, resulting in sparse song_adjacency graphs.

Architecture:
1. Read from silver_enriched_playlists
2. Create/update playlist entries in playlists table
3. Create playlist_tracks relationships with proper positions
4. Enable setlist_graph_generator to create adjacency edges

Usage:
    # Process all un-transformed silver playlists
    python silver_playlists_to_gold_etl.py

    # Process with limit (for testing)
    python silver_playlists_to_gold_etl.py --limit 100

    # Dry run (no database writes)
    python silver_playlists_to_gold_etl.py --dry-run --limit 10
"""

import asyncio
import asyncpg
import logging
import sys
import os
import re
import json
from typing import Optional, Dict, Any, List
from uuid import UUID
from datetime import datetime
import argparse

# Add common directory to path for secrets manager
sys.path.insert(0, '/app/common')
try:
    from secrets_manager import get_database_config
    SECRETS_AVAILABLE = True
except ImportError:
    SECRETS_AVAILABLE = False

# Configure logging
logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

GENERIC_ARTIST_NAMES = {
    "unknown dj",
    "various artist",
    "various artists",
    "va",
}


class SilverPlaylistsToGoldETL:
    """
    ETL process to transform silver_enriched_playlists → playlists + playlist_tracks.

    Fills the missing medallion architecture layer for playlists.
    """

    def __init__(self, dry_run: bool = False):
        self.dry_run = dry_run
        self.pool: Optional[asyncpg.Pool] = None
        self.stats = {
            'silver_playlists_processed': 0,
            'playlists_created': 0,
            'playlists_updated': 0,
            'playlist_tracks_created': 0,
            'errors': 0,
            'skipped_no_tracks': 0,
            'skipped_invalid': 0
        }

    async def connect(self):
        """Initialize database connection pool"""
        if SECRETS_AVAILABLE:
            db_config = get_database_config()
            logger.info("✅ Using centralized secrets manager for database configuration")
        else:
            db_config = {
                'host': os.getenv('POSTGRES_HOST', 'db-connection-pool'),
                'port': int(os.getenv('POSTGRES_PORT', '6432')),
                'database': os.getenv('POSTGRES_DB', 'musicdb'),
                'user': os.getenv('POSTGRES_USER', 'musicdb_user'),
                'password': os.getenv('POSTGRES_PASSWORD', 'musicdb_secure_pass_2024')
            }
            logger.info("⚠️ Secrets manager not available - using environment variables")

        self.pool = await asyncpg.create_pool(
            host=db_config['host'],
            port=db_config['port'],
            database=db_config['database'],
            user=db_config['user'],
            password=db_config['password'],
            min_size=5,
            max_size=20,
            command_timeout=60,
            server_settings={'search_path': 'musicdb,public'}
        )
        logger.info("✅ Database connection pool initialized")

    async def close(self):
        """Close database connection pool"""
        if self.pool:
            await self.pool.close()
            logger.info("✅ Database connection pool closed")

    async def map_silver_artist_to_gold(
        self,
        conn: asyncpg.Connection,
        silver_artist_id: Optional[UUID],
        artist_name: str
    ) -> Optional[UUID]:
        """
        Map silver layer artist to gold layer artist.

        First tries to find by silver_artist_id mapping, then by name.

        Returns artist_id (UUID) from gold artists table if successful, None if failed.
        """
        if not artist_name or artist_name.strip() == '':
            logger.debug(
                f"⚠️ Empty artist name provided (silver_artist_id={silver_artist_id})"
            )
            return None

        normalized = artist_name.lower().strip()
        if normalized in GENERIC_ARTIST_NAMES:
            logger.debug(
                f"Skipping generic artist name '{artist_name}' (silver_artist_id={silver_artist_id})"
            )
            return None

        # Normalize artist name
        normalized = re.sub(r'\s+', ' ', normalized)

        try:
            if self.dry_run:
                logger.debug(f"[DRY RUN] Would map artist: {artist_name}")
                return UUID('00000000-0000-0000-0000-000000000000')  # Dummy UUID

            # Try to find by name in gold layer artists table
            existing = await conn.fetchrow("""
                SELECT id FROM gold_artist_analytics
                WHERE artist_name = $1
                LIMIT 1
            """, artist_name)

            if existing:
                logger.debug(
                    f"✓ Found existing gold artist: '{artist_name}' (id={existing['id']})"
                )
                return existing['id']

            # Create new artist in gold layer if not found
            artist_id = await conn.fetchval("""
                INSERT INTO gold_artist_analytics (artist_name, silver_artist_id)
                VALUES ($1, $2)
                ON CONFLICT (artist_name) DO UPDATE SET artist_name = EXCLUDED.artist_name
                RETURNING id
            """, artist_name, silver_artist_id)

            logger.info(
                f"✅ Created gold artist: '{artist_name}' (UUID: {artist_id})",
                extra={'artist_name': artist_name, 'artist_id': artist_id}
            )
            return artist_id

        except Exception as e:
            logger.error(
                f"❌ Error mapping artist '{artist_name}': {e}",
                extra={
                    'artist_name': artist_name,
                    'silver_artist_id': silver_artist_id,
                    'error': str(e)
                },
                exc_info=True
            )
            return None

    async def map_silver_track_to_gold(
        self,
        conn: asyncpg.Connection,
        silver_track_id: UUID
    ) -> Optional[UUID]:
        """
        Map silver layer track to its gold layer track_id.

        Uses the silver_enriched_tracks table to get normalized_title and artist_name,
        then finds matching track in gold tracks table.
        """
        if not silver_track_id:
            logger.debug("⚠️ map_silver_track_to_gold called with NULL silver_track_id")
            return None

        try:
            # Get silver track info
            silver_track = await conn.fetchrow("""
                SELECT artist_name, track_title
                FROM silver_enriched_tracks
                WHERE id = $1
            """, silver_track_id)

            if not silver_track:
                logger.warning(
                    f"⚠️ Silver track not found in silver_enriched_tracks: {silver_track_id}",
                    extra={'silver_track_id': silver_track_id}
                )
                return None

            artist_name = silver_track['artist_name']
            track_title = silver_track['track_title']

            if not track_title or track_title.strip() == '':
                logger.warning(
                    f"⚠️ Empty track_title for silver track {silver_track_id} (artist={artist_name})",
                    extra={'silver_track_id': silver_track_id, 'artist_name': artist_name}
                )
                return None

            normalized_title = track_title.lower().strip()
            normalized_title = re.sub(r'\s+', ' ', normalized_title)

            # First try: exact title + artist match
            if artist_name and artist_name.strip() != '':
                normalized_artist = artist_name.lower().strip()
                normalized_artist = re.sub(r'\s+', ' ', normalized_artist)

                track_id = await conn.fetchval("""
                    SELECT id
                    FROM gold_track_analytics
                    WHERE track_title = $1 AND artist_name = $2
                    LIMIT 1
                """, track_title, artist_name)

                if track_id:
                    logger.debug(
                        f"✓ Mapped silver track {silver_track_id} → gold track {track_id} (artist+title match)"
                    )
                    return track_id
                else:
                    logger.debug(
                        f"⚠️ No artist+title match for '{artist_name} - {track_title}' (silver_id={silver_track_id})"
                    )

            # Second try: title-only match (for tracks without artist info)
            track_id = await conn.fetchval("""
                SELECT id FROM gold_track_analytics
                WHERE track_title = $1
                LIMIT 1
            """, track_title)

            if track_id:
                logger.debug(
                    f"✓ Mapped silver track {silver_track_id} → gold track {track_id} (title-only match)"
                )
            else:
                logger.warning(
                    f"⚠️ No gold track found for '{artist_name} - {track_title}' (silver_id={silver_track_id})",
                    extra={
                        'silver_track_id': silver_track_id,
                        'artist_name': artist_name,
                        'track_title': track_title
                    }
                )

            return track_id

        except Exception as e:
            logger.error(
                f"❌ Error mapping silver track {silver_track_id}: {e}",
                extra={'silver_track_id': silver_track_id, 'error': str(e)},
                exc_info=True
            )
            return None

    async def transform_silver_playlist(
        self,
        conn: asyncpg.Connection,
        silver_playlist: Dict[str, Any]
    ) -> bool:
        """
        Transform a single silver playlist to gold tables.

        Steps:
        1. Map DJ artist from silver to gold layer
        2. Create/update playlist in playlists table (legacy gold table)
        3. Get tracks from silver_playlist_tracks join table
        4. Map each track from silver to gold layer
        5. Create playlist_tracks relationships with positions

        Returns True if successful, False otherwise.
        """
        try:
            playlist_id = silver_playlist['id']
            playlist_name = silver_playlist['playlist_name']
            artist_name = silver_playlist['artist_name']
            silver_artist_id = silver_playlist.get('artist_id')

            # Generate unique source identifier for this playlist
            # Use "silver_{uuid}" format to ensure uniqueness
            source = f"silver_{playlist_id}"

            # Step 1: Map DJ artist from silver to gold
            dj_artist_id = None
            if artist_name:
                dj_artist_id = await self.map_silver_artist_to_gold(
                    conn, silver_artist_id, artist_name
                )

            # Step 2: Get tracks from silver_playlist_tracks
            silver_tracks = await conn.fetch("""
                SELECT track_id, position
                FROM silver_playlist_tracks
                WHERE playlist_id = $1
                ORDER BY position ASC
            """, playlist_id)

            # Skip if no tracks
            if not silver_tracks or len(silver_tracks) == 0:
                logger.warning(
                    f"⚠️ No tracks found for playlist '{playlist_name}' (silver_id={playlist_id})",
                    extra={
                        'playlist_id': playlist_id,
                        'playlist_name': playlist_name,
                        'artist_name': artist_name
                    }
                )
                self.stats['skipped_no_tracks'] += 1
                return False

            logger.debug(
                f"Processing playlist '{playlist_name}' with {len(silver_tracks)} tracks (silver_id={playlist_id})"
            )

            # Step 3: Create/update playlist in gold playlists table
            if self.dry_run:
                logger.info(f"[DRY RUN] Would create/update playlist: {playlist_name}")
                gold_playlist_id = UUID('00000000-0000-0000-0000-000000000001')
                self.stats['playlists_created'] += 1
            else:
                # Create unique source_url using silver playlist ID
                source_url = f"silver_etl:{playlist_id}"

                # Upsert playlist (using source_url as unique key)
                gold_playlist_id = await conn.fetchval("""
                    INSERT INTO playlists (
                        name, source, source_url, dj_artist_id,
                        event_name, event_date, tracklist_count
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                    ON CONFLICT (source_url) DO UPDATE SET
                        name = EXCLUDED.name,
                        dj_artist_id = EXCLUDED.dj_artist_id,
                        event_name = EXCLUDED.event_name,
                        event_date = EXCLUDED.event_date,
                        tracklist_count = EXCLUDED.tracklist_count,
                        updated_at = CURRENT_TIMESTAMP
                    RETURNING playlist_id
                """,
                    playlist_name,  # name
                    'silver_etl',  # source
                    source_url,  # source_url (unique)
                    dj_artist_id,  # dj_artist_id
                    silver_playlist.get('event_name'),  # event_name
                    silver_playlist.get('event_date'),  # event_date
                    len(silver_tracks)  # tracklist_count
                )

                self.stats['playlists_created'] += 1

            # Step 4 & 5: Map tracks from silver to gold and create relationships
            tracks_added = 0
            for track_row in silver_tracks:
                silver_track_id = track_row['track_id']
                position = track_row['position']

                # Map silver track to gold track
                gold_track_id = await self.map_silver_track_to_gold(conn, silver_track_id)

                if not gold_track_id:
                    logger.debug(f"Could not map silver track {silver_track_id} to gold")
                    continue

                # Create playlist_tracks relationship
                if self.dry_run:
                    logger.debug(f"[DRY RUN] Would link track {gold_track_id} at position {position}")
                    tracks_added += 1
                else:
                    await conn.execute("""
                        INSERT INTO playlist_tracks (playlist_id, song_id, position)
                        VALUES ($1, $2, $3)
                        ON CONFLICT (playlist_id, position) DO UPDATE SET
                            song_id = EXCLUDED.song_id
                    """, gold_playlist_id, gold_track_id, position)

                    tracks_added += 1
                    self.stats['playlist_tracks_created'] += 1

            if tracks_added == 0:
                logger.warning(f"No tracks mapped for playlist {playlist_id}")
                self.stats['skipped_no_tracks'] += 1
                return False

            self.stats['silver_playlists_processed'] += 1

            if self.stats['silver_playlists_processed'] % 10 == 0:
                logger.info(
                    f"Progress: {self.stats['silver_playlists_processed']} playlists processed, "
                    f"{self.stats['playlists_created']} created, "
                    f"{self.stats['playlist_tracks_created']} track relationships created"
                )

            return True

        except Exception as e:
            logger.error(
                f"Error transforming silver playlist (id={silver_playlist.get('id')}): {e}",
                exc_info=True
            )
            self.stats['errors'] += 1
            return False

    async def run(self, limit: Optional[int] = None):
        """
        Run the ETL process.

        Args:
            limit: Maximum number of silver playlists to process (None = all)
        """
        start_time = datetime.now()
        logger.info("="*80)
        logger.info("SILVER-TO-GOLD PLAYLIST ETL PROCESS STARTING")
        logger.info("="*80)

        if self.dry_run:
            logger.warning("🔍 DRY RUN MODE - No database writes will be performed")

        await self.connect()

        try:
            async with self.pool.acquire() as conn:
                # Query silver playlists that haven't been processed yet
                # Exclude playlists already in gold layer (check by source_url pattern)
                # Note: We filter by existence of tracks in silver_playlist_tracks, not by track_count
                # since track_count may be out of sync
                query = """
                    SELECT DISTINCT
                        sep.id,
                        sep.playlist_name,
                        sep.artist_id,
                        sep.artist_name,
                        sep.event_name,
                        sep.event_date,
                        sep.event_location,
                        sep.event_venue,
                        sep.track_count,
                        sep.validation_status,
                        sep.created_at
                    FROM silver_enriched_playlists sep
                    WHERE EXISTS (
                          SELECT 1 FROM silver_playlist_tracks spt
                          WHERE spt.playlist_id = sep.id
                      )
                      AND NOT EXISTS (
                          SELECT 1 FROM playlists p
                          WHERE p.source_url = 'silver_etl:' || sep.id::text
                      )
                    ORDER BY sep.created_at ASC
                """

                if limit:
                    query += f" LIMIT {limit}"

                logger.info(f"Querying silver_enriched_playlists (limit={limit or 'none'})...")
                silver_playlists = await conn.fetch(query)
                total_playlists = len(silver_playlists)

                logger.info(f"Found {total_playlists} silver playlists to process")

                if total_playlists == 0:
                    logger.warning("No silver playlists found to process!")
                    await self.close()
                    return self.stats

                # Process each silver playlist in a transaction
                for silver_playlist in silver_playlists:
                    async with conn.transaction():
                        await self.transform_silver_playlist(conn, dict(silver_playlist))

        finally:
            await self.close()

        # Report statistics
        duration = (datetime.now() - start_time).total_seconds()

        logger.info("="*80)
        logger.info("SILVER-TO-GOLD PLAYLIST ETL PROCESS COMPLETE")
        logger.info("="*80)
        logger.info(f"Duration: {duration:.2f}s")
        logger.info(f"Silver playlists processed: {self.stats['silver_playlists_processed']}")
        logger.info(f"Playlists created/updated: {self.stats['playlists_created']}")
        logger.info(f"Playlist-track relationships created: {self.stats['playlist_tracks_created']}")
        logger.info(f"Skipped (no tracks): {self.stats['skipped_no_tracks']}")
        logger.info(f"Errors: {self.stats['errors']}")

        if self.stats['silver_playlists_processed'] > 0:
            playlists_per_second = self.stats['silver_playlists_processed'] / duration
            tracks_per_playlist = self.stats['playlist_tracks_created'] / self.stats['silver_playlists_processed']
            logger.info(f"Throughput: {playlists_per_second:.1f} playlists/sec")
            logger.info(f"Average tracks per playlist: {tracks_per_playlist:.1f}")

        logger.info("="*80)

        return self.stats


async def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description="Silver-to-Gold Playlist ETL Process")
    parser.add_argument('--limit', type=int, help="Maximum number of playlists to process")
    parser.add_argument('--dry-run', action='store_true', help="Run without writing to database")
    args = parser.parse_args()

    etl = SilverPlaylistsToGoldETL(dry_run=args.dry_run)

    try:
        stats = await etl.run(limit=args.limit)

        # Exit with error code if there were errors
        if stats['errors'] > 0:
            logger.error(f"ETL completed with {stats['errors']} errors")
            sys.exit(1)

        logger.info("✅ ETL completed successfully")
        sys.exit(0)

    except KeyboardInterrupt:
        logger.warning("ETL interrupted by user")
        sys.exit(130)
    except Exception as e:
        logger.error(f"ETL failed with exception: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
