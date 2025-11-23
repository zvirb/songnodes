#!/usr/bin/env python3
"""
Silver-to-Gold Track ETL Script (Medallion Architecture)
=========================================================

Transforms silver_enriched_tracks into gold_track_analytics table with:
- Denormalized track data optimized for analytics
- Aggregated metrics (playlist appearances, play counts)
- Precomputed harmonic compatibility (Camelot wheel)
- Data quality scores and enrichment completeness

Architecture:
1. Read from silver_enriched_tracks (validated, enriched data)
2. Calculate aggregated metrics from silver_playlist_tracks
3. Compute harmonic compatibility using Camelot wheel
4. Insert/update gold_track_analytics with denormalized data

Usage:
    # Process all un-transformed silver tracks
    python silver_tracks_to_gold_etl.py

    # Process with limit (for testing)
    python silver_tracks_to_gold_etl.py --limit 100

    # Dry run (no database writes)
    python silver_tracks_to_gold_etl.py --dry-run --limit 10
"""

import asyncio
import asyncpg
import logging
import sys
import os
import re
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


# Camelot Wheel Harmonic Compatibility
# https://en.wikipedia.org/wiki/Camelot_Wheel
CAMELOT_WHEEL = {
    # Major keys (outer wheel)
    'C Major': {'camelot': '8B', 'compatible': ['7B', '9B', '8A']},
    'G Major': {'camelot': '9B', 'compatible': ['8B', '10B', '9A']},
    'D Major': {'camelot': '10B', 'compatible': ['9B', '11B', '10A']},
    'A Major': {'camelot': '11B', 'compatible': ['10B', '12B', '11A']},
    'E Major': {'camelot': '12B', 'compatible': ['11B', '1B', '12A']},
    'B Major': {'camelot': '1B', 'compatible': ['12B', '2B', '1A']},
    'F# Major': {'camelot': '2B', 'compatible': ['1B', '3B', '2A']},
    'Db Major': {'camelot': '3B', 'compatible': ['2B', '4B', '3A']},
    'Ab Major': {'camelot': '4B', 'compatible': ['3B', '5B', '4A']},
    'Eb Major': {'camelot': '5B', 'compatible': ['4B', '6B', '5A']},
    'Bb Major': {'camelot': '6B', 'compatible': ['5B', '7B', '6A']},
    'F Major': {'camelot': '7B', 'compatible': ['6B', '8B', '7A']},

    # Minor keys (inner wheel)
    'A Minor': {'camelot': '8A', 'compatible': ['7A', '9A', '8B']},
    'E Minor': {'camelot': '9A', 'compatible': ['8A', '10A', '9B']},
    'B Minor': {'camelot': '10A', 'compatible': ['9A', '11A', '10B']},
    'F# Minor': {'camelot': '11A', 'compatible': ['10A', '12A', '11B']},
    'C# Minor': {'camelot': '12A', 'compatible': ['11A', '1A', '12B']},
    'G# Minor': {'camelot': '1A', 'compatible': ['12A', '2A', '1B']},
    'D# Minor': {'camelot': '2A', 'compatible': ['1A', '3A', '2B']},
    'A# Minor': {'camelot': '3A', 'compatible': ['2A', '4A', '3B']},
    'F Minor': {'camelot': '4A', 'compatible': ['3A', '5A', '4B']},
    'C Minor': {'camelot': '5A', 'compatible': ['4A', '6A', '5B']},
    'G Minor': {'camelot': '6A', 'compatible': ['5A', '7A', '6B']},
    'D Minor': {'camelot': '7A', 'compatible': ['6A', '8A', '7B']},
}


def calculate_compatible_keys(key: Optional[str]) -> List[str]:
    """
    Calculate harmonically compatible keys using Camelot wheel.

    Args:
        key: Musical key (e.g., "C Major", "A Minor")

    Returns:
        List of compatible key names
    """
    if not key or key not in CAMELOT_WHEEL:
        return []

    compatible_camelot_codes = CAMELOT_WHEEL[key]['compatible']

    # Convert Camelot codes back to key names
    compatible_keys = []
    for name, data in CAMELOT_WHEEL.items():
        if data['camelot'] in compatible_camelot_codes:
            compatible_keys.append(name)

    return compatible_keys


def calculate_key_family(key: Optional[str]) -> Optional[str]:
    """
    Determine if key is Major or Minor.

    Args:
        key: Musical key (e.g., "C Major", "A Minor")

    Returns:
        "Major", "Minor", or None
    """
    if not key:
        return None

    if 'Major' in key:
        return 'Major'
    elif 'Minor' in key:
        return 'Minor'

    return None


def calculate_enrichment_completeness(track_data: Dict[str, Any]) -> float:
    """
    Calculate percentage of enrichable fields that have been populated.

    Enrichable fields: spotify_id, isrc, bpm, key, genre, energy, valence, danceability

    Args:
        track_data: Dictionary of track data from silver_enriched_tracks

    Returns:
        Enrichment completeness score (0.0 to 1.0)
    """
    enrichable_fields = [
        'spotify_id', 'isrc', 'bpm', 'key', 'genre',
        'energy', 'valence', 'danceability'
    ]

    populated_count = 0
    for field in enrichable_fields:
        value = track_data.get(field)
        if value is not None:
            # Check for non-empty arrays
            if isinstance(value, list):
                if len(value) > 0:
                    populated_count += 1
            # Check for non-empty strings
            elif isinstance(value, str):
                if value.strip() != '':
                    populated_count += 1
            # Numeric fields
            else:
                populated_count += 1

    return round(populated_count / len(enrichable_fields), 2)


class SilverTracksToGoldETL:
    """
    ETL process to transform silver_enriched_tracks → gold_track_analytics.

    Populates the Gold layer with denormalized, analytics-ready track data.
    """

    def __init__(self, dry_run: bool = False):
        self.dry_run = dry_run
        self.pool: Optional[asyncpg.Pool] = None
        self.stats = {
            'silver_tracks_processed': 0,
            'tracks_created': 0,
            'tracks_updated': 0,
            'errors': 0,
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

    async def calculate_aggregated_metrics(
        self,
        conn: asyncpg.Connection,
        silver_track_id: UUID
    ) -> Dict[str, Any]:
        """
        Calculate aggregated metrics for a track from silver_playlist_tracks.

        Returns:
            Dictionary with playlist_appearances, first_seen_at, last_played_at
        """
        try:
            # Count playlist appearances
            playlist_count = await conn.fetchval("""
                SELECT COUNT(DISTINCT playlist_id)
                FROM silver_playlist_tracks
                WHERE track_id = $1
            """, silver_track_id)

            # Get first and last playlist appearance dates
            dates = await conn.fetchrow("""
                SELECT
                    MIN(sep.event_date) as first_seen_date,
                    MAX(sep.event_date) as last_played_date
                FROM silver_playlist_tracks spt
                JOIN silver_enriched_playlists sep ON spt.playlist_id = sep.id
                WHERE spt.track_id = $1
                  AND sep.event_date IS NOT NULL
            """, silver_track_id)

            return {
                'playlist_appearances': playlist_count or 0,
                'first_seen_at': dates['first_seen_date'] if dates else None,
                'last_played_at': dates['last_played_date'] if dates else None
            }

        except Exception as e:
            logger.error(f"Error calculating metrics for track {silver_track_id}: {e}")
            return {
                'playlist_appearances': 0,
                'first_seen_at': None,
                'last_played_at': None
            }

    async def transform_silver_track(
        self,
        conn: asyncpg.Connection,
        silver_track: Dict[str, Any]
    ) -> bool:
        """
        Transform a single silver track to gold_track_analytics.

        Steps:
        1. Calculate enrichment completeness
        2. Calculate harmonic compatibility (compatible keys)
        3. Calculate aggregated metrics (playlist appearances)
        4. Insert or update gold_track_analytics

        Returns True if successful, False otherwise.
        """
        try:
            track_id = silver_track['id']
            artist_name = silver_track['artist_name']
            track_title = silver_track['track_title']

            # Skip invalid tracks
            if not artist_name or not track_title:
                logger.warning(f"Skipping track with missing artist/title (id={track_id})")
                self.stats['skipped_invalid'] += 1
                return False

            # Calculate metrics
            enrichment_completeness = calculate_enrichment_completeness(silver_track)
            compatible_keys = calculate_compatible_keys(silver_track.get('key'))
            key_family = calculate_key_family(silver_track.get('key'))
            aggregated_metrics = await self.calculate_aggregated_metrics(conn, track_id)

            # Create full track name for display
            full_track_name = f"{artist_name} - {track_title}"

            # Get primary genre (first genre in array)
            genres = silver_track.get('genre') or []
            genre_primary = genres[0] if genres and len(genres) > 0 else None

            if self.dry_run:
                logger.info(f"[DRY RUN] Would create/update track: {full_track_name}")
                self.stats['tracks_created'] += 1
                return True

            # Check if track already exists in gold layer
            existing_id = await conn.fetchval("""
                SELECT id FROM gold_track_analytics
                WHERE silver_track_id = $1
            """, track_id)

            if existing_id:
                # Update existing track
                await conn.execute("""
                    UPDATE gold_track_analytics
                    SET artist_name = $2,
                        track_title = $3,
                        full_track_name = $4,
                        spotify_id = $5,
                        isrc = $6,
                        bpm = $7,
                        key = $8,
                        genre_primary = $9,
                        genres = $10,
                        energy = $11,
                        valence = $12,
                        danceability = $13,
                        playlist_appearances = $14,
                        first_seen_at = $15,
                        last_played_at = $16,
                        compatible_keys = $17,
                        key_family = $18,
                        data_quality_score = $19,
                        enrichment_completeness = $20,
                        updated_at = CURRENT_TIMESTAMP,
                        last_analyzed_at = CURRENT_TIMESTAMP
                    WHERE id = $1
                """,
                    existing_id,
                    artist_name,
                    track_title,
                    full_track_name,
                    silver_track.get('spotify_id'),
                    silver_track.get('isrc'),
                    silver_track.get('bpm'),
                    silver_track.get('key'),
                    genre_primary,
                    genres,
                    silver_track.get('energy'),
                    silver_track.get('valence'),
                    silver_track.get('danceability'),
                    aggregated_metrics['playlist_appearances'],
                    aggregated_metrics['first_seen_at'],
                    aggregated_metrics['last_played_at'],
                    compatible_keys,
                    key_family,
                    silver_track.get('data_quality_score'),
                    enrichment_completeness
                )
                logger.debug(f"Updated gold track: {full_track_name} (id={existing_id})")
                self.stats['tracks_updated'] += 1
            else:
                # Insert new track
                gold_id = await conn.fetchval("""
                    INSERT INTO gold_track_analytics (
                        silver_track_id, artist_name, track_title, full_track_name,
                        spotify_id, isrc, bpm, key, genre_primary, genres,
                        energy, valence, danceability,
                        playlist_appearances, first_seen_at, last_played_at,
                        compatible_keys, key_family,
                        data_quality_score, enrichment_completeness,
                        last_analyzed_at
                    )
                    VALUES (
                        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                        $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
                        CURRENT_TIMESTAMP
                    )
                    RETURNING id
                """,
                    track_id,
                    artist_name,
                    track_title,
                    full_track_name,
                    silver_track.get('spotify_id'),
                    silver_track.get('isrc'),
                    silver_track.get('bpm'),
                    silver_track.get('key'),
                    genre_primary,
                    genres,
                    silver_track.get('energy'),
                    silver_track.get('valence'),
                    silver_track.get('danceability'),
                    aggregated_metrics['playlist_appearances'],
                    aggregated_metrics['first_seen_at'],
                    aggregated_metrics['last_played_at'],
                    compatible_keys,
                    key_family,
                    silver_track.get('data_quality_score'),
                    enrichment_completeness
                )
                logger.debug(f"Created gold track: {full_track_name} (id={gold_id})")
                self.stats['tracks_created'] += 1

            self.stats['silver_tracks_processed'] += 1

            if self.stats['silver_tracks_processed'] % 100 == 0:
                logger.info(
                    f"Progress: {self.stats['silver_tracks_processed']} tracks processed, "
                    f"{self.stats['tracks_created']} created, {self.stats['tracks_updated']} updated"
                )

            return True

        except Exception as e:
            logger.error(
                f"Error transforming silver track (id={silver_track.get('id')}): {e}",
                exc_info=True
            )
            self.stats['errors'] += 1
            return False

    async def run(self, limit: Optional[int] = None):
        """
        Run the ETL process.

        Args:
            limit: Maximum number of silver tracks to process (None = all)
        """
        start_time = datetime.now()
        logger.info("="*80)
        logger.info("SILVER-TO-GOLD TRACK ETL PROCESS STARTING")
        logger.info("="*80)

        if self.dry_run:
            logger.warning("🔍 DRY RUN MODE - No database writes will be performed")

        await self.connect()

        try:
            async with self.pool.acquire() as conn:
                # Query silver tracks that need processing
                # Process all tracks to ensure gold layer is up-to-date
                query = """
                    SELECT
                        id, bronze_id, artist_name, track_title,
                        spotify_id, isrc, release_date, duration_ms,
                        bpm, key, genre, energy, valence, danceability,
                        validation_status, data_quality_score,
                        enrichment_metadata, created_at, updated_at
                    FROM silver_enriched_tracks
                    WHERE validation_status IN ('valid', 'warning')
                    ORDER BY updated_at DESC
                """

                if limit:
                    query += f" LIMIT {limit}"

                logger.info(f"Querying silver_enriched_tracks (limit={limit or 'none'})...")
                silver_tracks = await conn.fetch(query)
                total_tracks = len(silver_tracks)

                logger.info(f"Found {total_tracks} silver tracks to process")

                if total_tracks == 0:
                    logger.warning("No silver tracks found to process!")
                    await self.close()
                    return self.stats

                # Process each silver track
                for silver_track in silver_tracks:
                    # Use savepoint for error isolation (not full transaction)
                    try:
                        async with conn.transaction():
                            await self.transform_silver_track(conn, dict(silver_track))
                    except Exception as e:
                        logger.error(f"Transaction failed for track {silver_track['id']}: {e}")
                        self.stats['errors'] += 1
                        continue

        finally:
            await self.close()

        # Report statistics
        duration = (datetime.now() - start_time).total_seconds()

        logger.info("="*80)
        logger.info("SILVER-TO-GOLD TRACK ETL PROCESS COMPLETE")
        logger.info("="*80)
        logger.info(f"Duration: {duration:.2f}s")
        logger.info(f"Silver tracks processed: {self.stats['silver_tracks_processed']}")
        logger.info(f"Tracks created: {self.stats['tracks_created']}")
        logger.info(f"Tracks updated: {self.stats['tracks_updated']}")
        logger.info(f"Skipped (invalid): {self.stats['skipped_invalid']}")
        logger.info(f"Errors: {self.stats['errors']}")

        if self.stats['silver_tracks_processed'] > 0:
            tracks_per_second = self.stats['silver_tracks_processed'] / duration
            logger.info(f"Throughput: {tracks_per_second:.1f} tracks/sec")

        logger.info("="*80)

        return self.stats


async def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description="Silver-to-Gold Track ETL Process")
    parser.add_argument('--limit', type=int, help="Maximum number of tracks to process")
    parser.add_argument('--dry-run', action='store_true', help="Run without writing to database")
    args = parser.parse_args()

    etl = SilverTracksToGoldETL(dry_run=args.dry_run)

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
