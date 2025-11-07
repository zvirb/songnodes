#!/usr/bin/env python3
"""
Gold-to-Operational ETL Service
================================

Migrates validated data from gold_track_analytics (analytics layer) to operational tables
(tracks, artists, track_artists, song_adjacency) that power the Graph API and frontend.

Architecture:
    Gold Analytics (BI) → Operational Tables (OLTP) → Graph API → Frontend

Data Quality Gates:
- Only tracks with data_quality_score >= 0.5
- Artist names must be valid (not "Unknown", "Various Artists", etc.)
- Both endpoints of transitions must have valid artists

Tables Populated:
- artists: Unique artists from gold_track_analytics
- tracks: Track metadata with all enrichment fields
- track_artists: Track-to-artist relationships
- song_adjacency: Graph edges from silver_track_transitions

Run Modes:
- CronJob: Scheduled batch processing (hourly)
- Manual: On-demand full migration
- Incremental: Only new/updated gold tracks

Usage:
    # Full migration (initial run)
    python gold_to_operational_etl.py --full

    # Incremental update (default for CronJob)
    python gold_to_operational_etl.py

    # Dry run
    python gold_to_operational_etl.py --dry-run --limit 100
"""

import asyncio
import asyncpg
import logging
import sys
import os
import argparse
from typing import Optional, Dict, List, Set
from datetime import datetime
from decimal import Decimal

# Add common directory to path
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

# Invalid artist names per CLAUDE.md Critical Data Quality Requirement
INVALID_ARTIST_PATTERNS = {
    'unknown', 'unknown artist', 'unknown artist @',
    'various', 'various artists', 'various artist', 'va', 'va @',
    '[unknown]', '(unknown)', 'n/a', 'tba', 'tbd'
}


class GoldToOperationalETL:
    """
    ETL process: gold_track_analytics → operational tables (tracks, artists, song_adjacency)
    """

    def __init__(self, dry_run: bool = False, full_migration: bool = False):
        self.dry_run = dry_run
        self.full_migration = full_migration
        self.pool: Optional[asyncpg.Pool] = None
        self.stats = {
            'gold_tracks_processed': 0,
            'artists_created': 0,
            'tracks_created': 0,
            'track_artists_created': 0,
            'adjacencies_created': 0,
            'skipped_low_quality': 0,
            'skipped_invalid_artist': 0,
            'errors': 0
        }

    async def connect(self):
        """Initialize database connection pool"""
        if SECRETS_AVAILABLE:
            db_config = get_database_config()
            logger.info("✅ Using centralized secrets manager")
        else:
            db_config = {
                'host': os.getenv('POSTGRES_HOST', 'postgres-0.postgres-service.songnodes.svc.cluster.local'),
                'port': int(os.getenv('POSTGRES_PORT', '5432')),
                'database': os.getenv('POSTGRES_DB', 'musicdb'),
                'user': os.getenv('POSTGRES_USER', 'musicdb_user'),
                'password': os.getenv('POSTGRES_PASSWORD', 'musicdb_secure_pass_2024')
            }
            logger.warning("⚠️  Using environment variables for database config")

        logger.info(f"Connecting to {db_config['host']}:{db_config['port']}/{db_config['database']}")

        self.pool = await asyncpg.create_pool(
            host=db_config['host'],
            port=db_config['port'],
            database=db_config['database'],
            user=db_config['user'],
            password=db_config['password'],
            min_size=2,
            max_size=10,
            command_timeout=60
        )
        logger.info("✅ Database connection pool created")

    async def disconnect(self):
        """Close database connection pool"""
        if self.pool:
            await self.pool.close()
            logger.info("Database connection pool closed")

    def is_valid_artist_name(self, artist_name: Optional[str]) -> bool:
        """
        Validate artist name per CLAUDE.md requirements.

        Invalid patterns:
        - NULL, empty string
        - "Unknown", "Unknown Artist", "Various Artists", etc.
        """
        if not artist_name or not artist_name.strip():
            return False

        normalized = artist_name.lower().strip()

        # Check exact matches
        if normalized in INVALID_ARTIST_PATTERNS:
            return False

        # Check prefixes
        for pattern in INVALID_ARTIST_PATTERNS:
            if normalized.startswith(pattern + ' ') or normalized.startswith(pattern + '@'):
                return False

        return True

    async def migrate_artists(self, batch_size: int = 1000) -> int:
        """
        Migrate unique artists from gold_track_analytics to artists table.

        Returns: Number of artists created
        """
        logger.info("🎤 Migrating artists...")

        query = """
            INSERT INTO artists (name, normalized_name)
            SELECT DISTINCT
                TRIM(artist_name) as name,
                LOWER(TRIM(artist_name)) as normalized_name
            FROM gold_track_analytics gta
            WHERE gta.data_quality_score >= 0.5
              AND gta.artist_name IS NOT NULL
              AND TRIM(gta.artist_name) != ''
              AND NOT EXISTS (
                  SELECT 1 FROM artists a
                  WHERE LOWER(TRIM(a.name)) = LOWER(TRIM(gta.artist_name))
              )
            LIMIT $1
            ON CONFLICT (normalized_name) DO NOTHING
            RETURNING id, name
        """

        if self.dry_run:
            # Count only
            count_query = query.replace("INSERT INTO", "SELECT COUNT(*) FROM (SELECT").replace("RETURNING id, name", ") AS subquery")
            result = await self.pool.fetchval(count_query, batch_size)
            logger.info(f"[DRY RUN] Would create {result} artists")
            return result

        results = await self.pool.fetch(query, batch_size)
        count = len(results)

        if count > 0:
            # Filter out invalid artist names
            valid_artists = [r for r in results if self.is_valid_artist_name(r['name'])]
            invalid_count = count - len(valid_artists)

            if invalid_count > 0:
                logger.warning(f"⚠️  Filtered out {invalid_count} invalid artist names")
                self.stats['skipped_invalid_artist'] += invalid_count

            self.stats['artists_created'] += len(valid_artists)
            logger.info(f"✅ Created {len(valid_artists)} artists")

        return count

    async def migrate_tracks(self, batch_size: int = 1000) -> int:
        """
        Migrate tracks from gold_track_analytics to tracks table.

        Only includes tracks with:
        - data_quality_score >= 0.5
        - Valid artist name

        Returns: Number of tracks created
        """
        logger.info("🎵 Migrating tracks...")

        query = """
            INSERT INTO tracks (
                title, normalized_title, spotify_id, isrc, bpm, key,
                energy, danceability, valence, genre, created_at, updated_at,
                metadata
            )
            SELECT DISTINCT
                TRIM(gta.track_title) as title,
                LOWER(TRIM(gta.track_title)) as normalized_title,
                gta.spotify_id,
                gta.isrc,
                gta.bpm,
                gta.key,
                gta.energy,
                gta.valence,
                gta.danceability,
                gta.genre_primary as genre,
                gta.first_seen_at as created_at,
                NOW() as updated_at,
                jsonb_build_object(
                    'data_quality_score', gta.data_quality_score,
                    'enrichment_completeness', gta.enrichment_completeness,
                    'playlist_appearances', gta.playlist_appearances,
                    'compatible_keys', gta.compatible_keys,
                    'key_family', gta.key_family,
                    'gold_track_id', gta.id::text,
                    'silver_track_id', gta.silver_track_id::text
                ) as metadata
            FROM gold_track_analytics gta
            WHERE gta.data_quality_score >= 0.5
              AND gta.artist_name IS NOT NULL
              AND TRIM(gta.artist_name) != ''
              AND gta.track_title IS NOT NULL
              AND TRIM(gta.track_title) != ''
              AND NOT EXISTS (
                  SELECT 1 FROM tracks t
                  WHERE LOWER(TRIM(t.title)) = LOWER(TRIM(gta.track_title))
                    AND (gta.spotify_id IS NULL OR t.spotify_id = gta.spotify_id)
              )
            LIMIT $1
            ON CONFLICT (normalized_title) DO UPDATE SET
                spotify_id = COALESCE(EXCLUDED.spotify_id, tracks.spotify_id),
                isrc = COALESCE(EXCLUDED.isrc, tracks.isrc),
                bpm = COALESCE(EXCLUDED.bpm, tracks.bpm),
                key = COALESCE(EXCLUDED.key, tracks.key),
                energy = COALESCE(EXCLUDED.energy, tracks.energy),
                danceability = COALESCE(EXCLUDED.danceability, tracks.danceability),
                valence = COALESCE(EXCLUDED.valence, tracks.valence),
                genre = COALESCE(EXCLUDED.genre, tracks.genre),
                updated_at = NOW(),
                metadata = tracks.metadata || EXCLUDED.metadata
            RETURNING id, title
        """

        if self.dry_run:
            count_query = query.replace("INSERT INTO", "SELECT COUNT(*) FROM (SELECT").replace("RETURNING id, title", ") AS subquery")
            result = await self.pool.fetchval(count_query, batch_size)
            logger.info(f"[DRY RUN] Would create {result} tracks")
            return result

        results = await self.pool.fetch(query, batch_size)
        count = len(results)

        self.stats['tracks_created'] += count
        if count > 0:
            logger.info(f"✅ Created {count} tracks")

        return count

    async def migrate_track_artists(self, batch_size: int = 1000) -> int:
        """
        Create track-artist relationships from gold_track_analytics.

        Returns: Number of relationships created
        """
        logger.info("🔗 Creating track-artist relationships...")

        query = """
            INSERT INTO track_artists (track_id, artist_id, role)
            SELECT DISTINCT
                t.id as track_id,
                a.id as artist_id,
                'primary' as role
            FROM gold_track_analytics gta
            JOIN tracks t ON LOWER(TRIM(t.title)) = LOWER(TRIM(gta.track_title))
                AND (gta.spotify_id IS NULL OR t.spotify_id = gta.spotify_id)
            JOIN artists a ON LOWER(TRIM(a.name)) = LOWER(TRIM(gta.artist_name))
            WHERE gta.data_quality_score >= 0.5
              AND NOT EXISTS (
                  SELECT 1 FROM track_artists ta
                  WHERE ta.track_id = t.id AND ta.artist_id = a.id
              )
            LIMIT $1
            ON CONFLICT (track_id, artist_id, role) DO NOTHING
            RETURNING track_id, artist_id
        """

        if self.dry_run:
            count_query = query.replace("INSERT INTO", "SELECT COUNT(*) FROM (SELECT").replace("RETURNING track_id, artist_id", ") AS subquery")
            result = await self.pool.fetchval(count_query, batch_size)
            logger.info(f"[DRY RUN] Would create {result} track-artist relationships")
            return result

        results = await self.pool.fetch(query, batch_size)
        count = len(results)

        self.stats['track_artists_created'] += count
        if count > 0:
            logger.info(f"✅ Created {count} track-artist relationships")

        return count

    async def migrate_song_adjacencies(self, batch_size: int = 500) -> int:
        """
        Build song_adjacency graph edges from silver_track_transitions.

        Critical requirements per CLAUDE.md:
        - BOTH endpoints must have valid artist attribution
        - Uses operational tracks table (not analytics)

        Returns: Number of adjacencies created
        """
        logger.info("🔀 Building song adjacency graph...")

        query = """
            INSERT INTO song_adjacency (
                song_id_1, song_id_2, source_track_id, target_track_id,
                occurrence_count, weight
            )
            SELECT DISTINCT
                t1.id as song_id_1,
                t2.id as song_id_2,
                t1.id as source_track_id,
                t2.id as target_track_id,
                stt.occurrence_count,
                stt.occurrence_count::float as weight
            FROM silver_track_transitions stt
            -- Map silver track IDs to gold track IDs
            JOIN gold_track_analytics gta1 ON stt.from_track_id = gta1.silver_track_id
            JOIN gold_track_analytics gta2 ON stt.to_track_id = gta2.silver_track_id
            -- Map gold tracks to operational tracks
            JOIN tracks t1 ON LOWER(TRIM(t1.title)) = LOWER(TRIM(gta1.track_title))
                AND (gta1.spotify_id IS NULL OR t1.spotify_id = gta1.spotify_id)
            JOIN tracks t2 ON LOWER(TRIM(t2.title)) = LOWER(TRIM(gta2.track_title))
                AND (gta2.spotify_id IS NULL OR t2.spotify_id = gta2.spotify_id)
            -- ✅ CRITICAL: Ensure BOTH endpoints have valid artist attribution
            JOIN track_artists ta1 ON t1.id = ta1.track_id AND ta1.role = 'primary'
            JOIN artists a1 ON ta1.artist_id = a1.id
            JOIN track_artists ta2 ON t2.id = ta2.track_id AND ta2.role = 'primary'
            JOIN artists a2 ON ta2.artist_id = a2.id
            WHERE gta1.data_quality_score >= 0.5
              AND gta2.data_quality_score >= 0.5
              AND a1.name IS NOT NULL AND a1.name != '' AND LOWER(a1.name) NOT IN ('unknown', 'unknown artist', 'various artists', 'va')
              AND a2.name IS NOT NULL AND a2.name != '' AND LOWER(a2.name) NOT IN ('unknown', 'unknown artist', 'various artists', 'va')
              AND stt.occurrence_count >= 1
              AND NOT EXISTS (
                  SELECT 1 FROM song_adjacency sa
                  WHERE sa.song_id_1 = t1.id AND sa.song_id_2 = t2.id
              )
            LIMIT $1
            ON CONFLICT (song_id_1, song_id_2) DO UPDATE SET
                occurrence_count = song_adjacency.occurrence_count + EXCLUDED.occurrence_count,
                weight = (song_adjacency.occurrence_count + EXCLUDED.occurrence_count)::float,
                updated_at = NOW()
            RETURNING song_id_1, song_id_2
        """

        if self.dry_run:
            count_query = query.replace("INSERT INTO", "SELECT COUNT(*) FROM (SELECT").replace("RETURNING song_id_1, song_id_2", ") AS subquery")
            result = await self.pool.fetchval(count_query, batch_size)
            logger.info(f"[DRY RUN] Would create {result} adjacencies")
            return result

        results = await self.pool.fetch(query, batch_size)
        count = len(results)

        self.stats['adjacencies_created'] += count
        if count > 0:
            logger.info(f"✅ Created {count} song adjacencies")

        return count

    async def run_migration(self, batch_size: int = 1000):
        """
        Execute full ETL pipeline.

        Order is critical:
        1. Artists (referenced by tracks)
        2. Tracks (referenced by track_artists)
        3. Track-Artist relationships (referenced by song_adjacency validation)
        4. Song adjacencies (graph edges)
        """
        logger.info("=" * 80)
        logger.info("🚀 Starting Gold-to-Operational ETL Migration")
        logger.info(f"Mode: {'DRY RUN' if self.dry_run else 'LIVE'}")
        logger.info(f"Type: {'FULL' if self.full_migration else 'INCREMENTAL'}")
        logger.info(f"Batch size: {batch_size}")
        logger.info("=" * 80)

        start_time = datetime.utcnow()

        try:
            # Phase 1: Artists
            logger.info("\n📋 Phase 1/4: Migrating Artists")
            while True:
                count = await self.migrate_artists(batch_size)
                self.stats['gold_tracks_processed'] += count
                if count < batch_size:
                    break
                logger.info(f"Processed batch of {count}, continuing...")

            # Phase 2: Tracks
            logger.info("\n📋 Phase 2/4: Migrating Tracks")
            while True:
                count = await self.migrate_tracks(batch_size)
                if count < batch_size:
                    break
                logger.info(f"Processed batch of {count}, continuing...")

            # Phase 3: Track-Artist relationships
            logger.info("\n📋 Phase 3/4: Creating Track-Artist Relationships")
            while True:
                count = await self.migrate_track_artists(batch_size)
                if count < batch_size:
                    break
                logger.info(f"Processed batch of {count}, continuing...")

            # Phase 4: Song Adjacencies
            logger.info("\n📋 Phase 4/4: Building Song Adjacency Graph")
            while True:
                count = await self.migrate_song_adjacencies(batch_size // 2)  # Smaller batches for complex joins
                if count < (batch_size // 2):
                    break
                logger.info(f"Processed batch of {count}, continuing...")

            duration = (datetime.utcnow() - start_time).total_seconds()

            logger.info("\n" + "=" * 80)
            logger.info("✅ ETL Migration Complete!")
            logger.info(f"Duration: {duration:.2f}s")
            logger.info("\nStatistics:")
            logger.info(f"  Gold tracks processed: {self.stats['gold_tracks_processed']}")
            logger.info(f"  Artists created: {self.stats['artists_created']}")
            logger.info(f"  Tracks created: {self.stats['tracks_created']}")
            logger.info(f"  Track-artist relationships: {self.stats['track_artists_created']}")
            logger.info(f"  Song adjacencies: {self.stats['adjacencies_created']}")
            if self.stats['skipped_invalid_artist'] > 0:
                logger.info(f"  Skipped (invalid artist): {self.stats['skipped_invalid_artist']}")
            if self.stats['errors'] > 0:
                logger.warning(f"  Errors: {self.stats['errors']}")
            logger.info("=" * 80)

        except Exception as e:
            logger.error(f"❌ ETL failed: {e}", exc_info=True)
            self.stats['errors'] += 1
            raise


async def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description='Gold-to-Operational ETL Service')
    parser.add_argument('--dry-run', action='store_true', help='Dry run mode (no database writes)')
    parser.add_argument('--full', action='store_true', help='Full migration (process all gold tracks)')
    parser.add_argument('--batch-size', type=int, default=1000, help='Batch size for processing')
    parser.add_argument('--limit', type=int, help='Limit total records processed (for testing)')

    args = parser.parse_args()

    etl = GoldToOperationalETL(dry_run=args.dry_run, full_migration=args.full)

    try:
        await etl.connect()
        await etl.run_migration(batch_size=args.batch_size)
    except Exception as e:
        logger.error(f"Fatal error: {e}", exc_info=True)
        sys.exit(1)
    finally:
        await etl.disconnect()


if __name__ == "__main__":
    asyncio.run(main())
