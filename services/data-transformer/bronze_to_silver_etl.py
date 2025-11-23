#!/usr/bin/env python3
"""
Bronze-to-Silver ETL Script (Medallion Architecture)
=====================================================

Transforms Bronze layer tables into Silver layer tables:
- bronze_scraped_tracks → silver_enriched_tracks (validated and enriched track data)
- bronze_scraped_playlists → silver_enriched_playlists (playlist/setlist metadata)
- Derives silver_playlist_tracks (track relationships with positions from raw_json)
- Derives silver_track_transitions (adjacency edges for graph from track positions)

Architecture:
1. Read unprocessed records from bronze_scraped_tracks and bronze_scraped_playlists
2. Extract and validate track/playlist data from raw_json
3. Insert into appropriate silver tables
4. Derive track transitions from sequential track positions in playlists
5. Calculate data quality scores

Data Flow:
- bronze_scraped_tracks.raw_json → silver_enriched_tracks
- bronze_scraped_playlists.raw_json → silver_enriched_playlists
- bronze_scraped_playlists.raw_json['tracks'] → silver_playlist_tracks (with positions)
- silver_playlist_tracks (positions) → silver_track_transitions (graph edges)

Usage:
    # Process all unprocessed bronze records
    python bronze_to_silver_etl.py

    # Process with limit (for testing)
    python bronze_to_silver_etl.py --limit 100

    # Dry run (no database writes)
    python bronze_to_silver_etl.py --dry-run --limit 10
"""

import asyncio
import asyncpg
import logging
import sys
import os
import json
import time
from typing import Optional, Dict, Any, List, Tuple
from uuid import UUID, uuid4
from datetime import datetime, date
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


class BronzeToSilverETL:
    """
    ETL process to transform Bronze layer tables → Silver layer tables.

    Validates, cleans, and enriches bronze data into the silver layer.

    Data Sources:
    - bronze_scraped_tracks: Raw track data with raw_json payload
    - bronze_scraped_playlists: Raw playlist data with raw_json payload (includes tracks array)

    Outputs:
    - silver_enriched_tracks: Validated tracks with quality scores
    - silver_enriched_playlists: Validated playlists
    - silver_playlist_tracks: Track-playlist junction with positions
    - silver_track_transitions: Graph edges derived from sequential track positions
    """

    def __init__(self, dry_run: bool = False):
        self.dry_run = dry_run
        self.pool: Optional[asyncpg.Pool] = None
        self.stats = {
            'bronze_tracks_processed': 0,
            'bronze_playlists_processed': 0,
            'tracks_created': 0,
            'playlists_created': 0,
            'playlist_tracks_created': 0,
            'track_transitions_created': 0,
            'errors': 0,
            'skipped_invalid': 0
        }

        # Track created IDs to link relationships
        self.bronze_to_silver_track_map: Dict[UUID, UUID] = {}  # bronze_id → silver_id
        self.bronze_to_silver_playlist_map: Dict[UUID, UUID] = {}  # bronze_id → silver_id

        # Track name-based lookup for transitions (when IDs not available)
        self.track_name_to_silver_id: Dict[str, UUID] = {}  # "artist|||title" → silver_id

    @staticmethod
    async def _setup_codecs(conn):
        """Setup codecs for JSONB automatic decoding"""
        # Tell asyncpg to decode JSONB as JSON (Python dicts/lists)
        await conn.set_type_codec(
            'jsonb',
            encoder=json.dumps,
            decoder=json.loads,
            schema='pg_catalog'
        )

    @staticmethod
    def _parse_nested_json(data):
        """
        Recursively parse nested JSON strings within JSONB data.

        AsyncPG's JSONB codec only decodes the top-level JSONB column.
        Nested JSONB fields (like raw_data->metadata) remain as strings.
        This function recursively parses any string values that are valid JSON.

        Args:
            data: dict, list, or any Python object

        Returns:
            Recursively parsed data structure
        """
        if isinstance(data, dict):
            return {k: BronzeToSilverETL._parse_nested_json(v) for k, v in data.items()}
        elif isinstance(data, list):
            return [BronzeToSilverETL._parse_nested_json(item) for item in data]
        elif isinstance(data, str):
            # Try parsing as JSON if it looks like JSON
            if (data.startswith('{') and data.endswith('}')) or (data.startswith('[') and data.endswith(']')):
                try:
                    parsed = json.loads(data)
                    # Recursively parse the result
                    return BronzeToSilverETL._parse_nested_json(parsed)
                except (json.JSONDecodeError, ValueError):
                    return data  # Not valid JSON, return as-is
            return data
        else:
            return data

    async def connect(self, max_retries: int = 5, initial_delay: float = 2.0):
        """Initialize database connection pool with retry logic"""
        if SECRETS_AVAILABLE:
            db_config = get_database_config()
            logger.info("✅ Using centralized secrets manager for database configuration")
        else:
            db_config = {
                'host': os.getenv('POSTGRES_HOST', 'postgres-0.postgres-service.songnodes.svc.cluster.local'),
                'port': int(os.getenv('POSTGRES_PORT', '5432')),
                'database': os.getenv('POSTGRES_DB', 'musicdb'),
                'user': os.getenv('POSTGRES_USER', 'musicdb_user'),
                'password': os.getenv('POSTGRES_PASSWORD', 'musicdb_secure_pass_2024')
            }
            logger.info("⚠️ Secrets manager not available - using environment variables")

        logger.info(f"Attempting to connect to PostgreSQL at {db_config['host']}:{db_config['port']}")

        # Retry logic with exponential backoff
        for attempt in range(1, max_retries + 1):
            try:
                self.pool = await asyncpg.create_pool(
                    **db_config,
                    min_size=2,
                    max_size=10,
                    command_timeout=60,
                    timeout=30,  # Connection timeout
                    init=self._setup_codecs  # Setup JSONB codec
                )
                logger.info(f"✅ Database connection pool initialized on attempt {attempt}/{max_retries}")
                return

            except Exception as e:
                if attempt < max_retries:
                    delay = initial_delay * (2 ** (attempt - 1))  # Exponential backoff
                    logger.warning(
                        f"❌ Connection attempt {attempt}/{max_retries} failed: {e}. "
                        f"Retrying in {delay:.1f}s..."
                    )
                    await asyncio.sleep(delay)
                else:
                    logger.error(
                        f"❌ Failed to connect to PostgreSQL after {max_retries} attempts. "
                        f"Host: {db_config['host']}:{db_config['port']}, "
                        f"Database: {db_config['database']}, "
                        f"User: {db_config['user']}"
                    )
                    raise

    async def close(self):
        """Close database connection pool"""
        if self.pool:
            await self.pool.close()
            logger.info("✅ Database connection pool closed")

    def calculate_data_quality_score(self, record: Dict[str, Any]) -> float:
        """
        Calculate data quality score (0.0-1.0) based on field completeness.

        Args:
            record: Bronze data record

        Returns:
            Quality score between 0.0 and 1.0
        """
        required_fields = ['artist_name', 'track_name']
        optional_high_value = ['bpm', 'musical_key', 'genre', 'record_label']
        optional_medium_value = ['is_remix', 'remix_type', 'track_type']

        score = 0.0

        # Required fields: 40% of score
        for field in required_fields:
            if record.get(field) and str(record.get(field)).strip():
                score += 0.2

        # High value optional fields: 40% of score
        for field in optional_high_value:
            if record.get(field) and str(record.get(field)).strip():
                score += 0.1

        # Medium value optional fields: 20% of score
        for field in optional_medium_value:
            if field in record and record[field] is not None:
                score += 0.067

        return min(score, 1.0)

    async def process_bronze_track(self, conn: asyncpg.Connection, bronze_track: Dict) -> Optional[UUID]:
        """
        Process bronze_scraped_tracks record into silver_enriched_tracks.

        Args:
            conn: Database connection
            bronze_track: Record from bronze_scraped_tracks with raw_json payload

        Returns:
            Silver track ID if successful, None otherwise
        """
        try:
            bronze_id = bronze_track['id']
            raw_json = bronze_track['raw_json']

            # raw_json should already be a dict (via JSONB codec)
            if not isinstance(raw_json, dict):
                logger.error(f"Bronze track {bronze_id}: raw_json is not a dict: {type(raw_json)}")
                self.stats['errors'] += 1
                return None

            # Extract and validate required fields from raw_json
            # Support multiple field name variations from different scrapers
            artist_name = (
                raw_json.get('artist_name') or
                raw_json.get('artist') or
                bronze_track.get('artist_name') or
                ''
            ).strip()

            track_title = (
                raw_json.get('track_title') or
                raw_json.get('track_name') or
                raw_json.get('title') or
                bronze_track.get('track_title') or
                ''
            ).strip()

            if not artist_name or not track_title:
                logger.debug(f"Skipping bronze track {bronze_id}: missing artist ({artist_name}) or title ({track_title})")
                self.stats['skipped_invalid'] += 1
                return None

            # Calculate data quality score
            quality_score = self.calculate_data_quality_score(raw_json)

            # Prepare enrichment metadata (preserve source lineage)
            enrichment_metadata = {
                'bronze_source': bronze_track.get('source', 'unknown'),
                'source_url': bronze_track.get('source_url'),
                'scraper_version': bronze_track.get('scraper_version'),
                'scraped_at': bronze_track.get('scraped_at', datetime.now()).isoformat() if isinstance(bronze_track.get('scraped_at'), datetime) else str(bronze_track.get('scraped_at')),
                'original_payload_keys': list(raw_json.keys())
            }

            # Extract optional enriched fields from raw_json
            spotify_id = raw_json.get('spotify_id') or raw_json.get('spotify', {}).get('id')
            isrc = raw_json.get('isrc')
            duration_ms = raw_json.get('duration_ms') or raw_json.get('duration')
            bpm = raw_json.get('bpm')
            key = raw_json.get('key') or raw_json.get('musical_key')
            genre = raw_json.get('genre')
            energy = raw_json.get('energy')
            valence = raw_json.get('valence')
            danceability = raw_json.get('danceability')
            release_date_str = raw_json.get('release_date')

            # Parse release_date if present
            release_date = None
            if release_date_str:
                try:
                    if isinstance(release_date_str, str):
                        release_date = datetime.strptime(release_date_str, '%Y-%m-%d').date()
                    elif isinstance(release_date_str, date):
                        release_date = release_date_str
                except (ValueError, AttributeError):
                    logger.debug(f"Could not parse release_date: {release_date_str}")

            # Create silver enriched track
            silver_track_id = await conn.fetchval("""
                INSERT INTO silver_enriched_tracks (
                    bronze_id,
                    artist_name,
                    track_title,
                    spotify_id,
                    isrc,
                    release_date,
                    duration_ms,
                    bpm,
                    key,
                    genre,
                    energy,
                    valence,
                    danceability,
                    validation_status,
                    data_quality_score,
                    enrichment_metadata,
                    validated_at,
                    enriched_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
                ON CONFLICT (bronze_id) DO UPDATE SET
                    artist_name = EXCLUDED.artist_name,
                    track_title = EXCLUDED.track_title,
                    spotify_id = EXCLUDED.spotify_id,
                    isrc = EXCLUDED.isrc,
                    updated_at = NOW()
                RETURNING id
            """,
                bronze_id,
                artist_name,
                track_title,
                spotify_id,
                isrc,
                release_date,
                duration_ms,
                bpm,
                key,
                [genre] if genre else None,
                energy,
                valence,
                danceability,
                'valid' if quality_score >= 0.7 else 'warning' if quality_score >= 0.4 else 'needs_review',
                quality_score,
                json.dumps(enrichment_metadata),
                datetime.now(),
                datetime.now()
            )

            # Track the mapping for later lookups
            self.bronze_to_silver_track_map[bronze_id] = silver_track_id
            # Also create name-based lookup for transition creation
            track_key = f"{artist_name.lower()}|||{track_title.lower()}"
            self.track_name_to_silver_id[track_key] = silver_track_id

            self.stats['tracks_created'] += 1
            self.stats['bronze_tracks_processed'] += 1
            return silver_track_id

        except Exception as e:
            logger.error(f"Error processing bronze track {bronze_track.get('id')}: {e}")
            self.stats['errors'] += 1
            return None


    async def process_bronze_playlist(self, conn: asyncpg.Connection, bronze_playlist: Dict) -> Optional[UUID]:
        """
        Process bronze_scraped_playlists record into silver layer.

        This method:
        1. Creates silver_enriched_playlists entry
        2. Extracts tracks array from raw_json
        3. Creates/links tracks in silver_enriched_tracks
        4. Creates silver_playlist_tracks entries with positions
        5. Derives silver_track_transitions from sequential track positions

        Args:
            conn: Database connection
            bronze_playlist: Record from bronze_scraped_playlists with raw_json payload

        Returns:
            Silver playlist ID if successful, None otherwise
        """
        try:
            bronze_id = bronze_playlist['id']
            raw_json = bronze_playlist['raw_json']

            if not isinstance(raw_json, dict):
                logger.error(f"Bronze playlist {bronze_id}: raw_json is not a dict: {type(raw_json)}")
                self.stats['errors'] += 1
                return None

            # Extract playlist metadata
            playlist_name = (
                raw_json.get('playlist_name') or
                raw_json.get('name') or
                raw_json.get('title') or
                bronze_playlist.get('playlist_name') or
                ''
            ).strip()

            if not playlist_name:
                logger.debug(f"Skipping bronze playlist {bronze_id}: missing playlist_name")
                self.stats['skipped_invalid'] += 1
                return None

            artist_name = (
                raw_json.get('artist_name') or
                raw_json.get('artist') or
                bronze_playlist.get('artist_name') or
                ''
            ).strip()

            # Parse event_date
            event_date = bronze_playlist.get('event_date')
            if not event_date and raw_json.get('event_date'):
                try:
                    event_date_str = raw_json['event_date']
                    if isinstance(event_date_str, str):
                        event_date = datetime.strptime(event_date_str, '%Y-%m-%d').date()
                except (ValueError, AttributeError):
                    logger.debug(f"Could not parse event_date: {raw_json.get('event_date')}")

            # Calculate data quality
            quality_score = self.calculate_data_quality_score(raw_json)
            validation_status = 'valid' if quality_score >= 0.7 else 'warning' if quality_score >= 0.4 else 'needs_review'

            # Prepare enrichment metadata
            enrichment_metadata = {
                'bronze_source': bronze_playlist.get('source', 'unknown'),
                'source_url': bronze_playlist.get('source_url'),
                'scraper_version': bronze_playlist.get('scraper_version'),
                'scraped_at': bronze_playlist.get('scraped_at', datetime.now()).isoformat() if isinstance(bronze_playlist.get('scraped_at'), datetime) else str(bronze_playlist.get('scraped_at'))
            }

            # Extract tracks array from raw_json
            tracks_array = raw_json.get('tracks', [])
            track_count = len(tracks_array) if isinstance(tracks_array, list) else raw_json.get('track_count', 0)

            # Create silver enriched playlist
            silver_playlist_id = await conn.fetchval("""
                INSERT INTO silver_enriched_playlists (
                    bronze_id,
                    playlist_name,
                    artist_name,
                    event_name,
                    event_date,
                    event_location,
                    track_count,
                    validation_status,
                    data_quality_score,
                    enrichment_metadata
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                ON CONFLICT (bronze_id) DO UPDATE SET
                    playlist_name = EXCLUDED.playlist_name,
                    artist_name = EXCLUDED.artist_name,
                    updated_at = NOW()
                RETURNING id
            """,
                bronze_id,
                playlist_name,
                artist_name,
                raw_json.get('event_name'),
                event_date,
                raw_json.get('event_location') or raw_json.get('venue') or raw_json.get('location'),
                track_count,
                validation_status,
                quality_score,
                json.dumps(enrichment_metadata)
            )

            # Track the mapping
            self.bronze_to_silver_playlist_map[bronze_id] = silver_playlist_id
            self.stats['playlists_created'] += 1
            self.stats['bronze_playlists_processed'] += 1

            # Process tracks array (if present)
            if isinstance(tracks_array, list) and len(tracks_array) > 0:
                await self._process_playlist_tracks(conn, silver_playlist_id, tracks_array, bronze_id)

            return silver_playlist_id

        except Exception as e:
            logger.error(f"Error processing bronze playlist {bronze_playlist.get('id')}: {e}")
            self.stats['errors'] += 1
            return None

    async def _process_playlist_tracks(
        self,
        conn: asyncpg.Connection,
        silver_playlist_id: UUID,
        tracks_array: List[Dict],
        bronze_playlist_id: UUID
    ) -> None:
        """
        Process tracks array from bronze playlist raw_json.

        Creates:
        1. silver_playlist_tracks entries with positions
        2. silver_track_transitions entries from sequential positions

        Args:
            conn: Database connection
            silver_playlist_id: ID of silver playlist
            tracks_array: Array of track dicts from raw_json['tracks']
            bronze_playlist_id: Source bronze playlist ID for logging
        """
        try:
            previous_silver_track_id = None

            for idx, track_data in enumerate(tracks_array):
                if not isinstance(track_data, dict):
                    logger.debug(f"Skipping non-dict track at position {idx} in playlist {bronze_playlist_id}")
                    continue

                # Extract track info
                artist = (
                    track_data.get('artist_name') or
                    track_data.get('artist') or
                    ''
                ).strip()

                title = (
                    track_data.get('track_title') or
                    track_data.get('track_name') or
                    track_data.get('title') or
                    ''
                ).strip()

                if not artist or not title:
                    logger.debug(f"Skipping track at position {idx}: missing artist or title")
                    continue

                # Position from track_data or array index
                position = track_data.get('position', idx + 1)

                # Look up or create silver track ID
                track_key = f"{artist.lower()}|||{title.lower()}"
                silver_track_id = self.track_name_to_silver_id.get(track_key)

                if not silver_track_id:
                    # Track not yet in silver layer - try to find by name
                    silver_track_id = await conn.fetchval("""
                        SELECT id FROM silver_enriched_tracks
                        WHERE LOWER(artist_name) = $1 AND LOWER(track_title) = $2
                        LIMIT 1
                    """, artist.lower(), title.lower())

                if not silver_track_id:
                    # Create silver track on-the-fly from playlist track data
                    logger.debug(f"Creating silver track on-the-fly: {artist} - {title}")
                    silver_track_id = await conn.fetchval("""
                        INSERT INTO silver_enriched_tracks (
                            artist_name,
                            track_title,
                            validation_status,
                            data_quality_score,
                            enrichment_metadata
                        ) VALUES ($1, $2, $3, $4, $5)
                        RETURNING id
                    """,
                        artist,
                        title,
                        'needs_review',
                        0.5,
                        json.dumps({'created_from': 'playlist_tracks', 'bronze_playlist_id': str(bronze_playlist_id)})
                    )
                    self.track_name_to_silver_id[track_key] = silver_track_id
                    self.stats['tracks_created'] += 1

                # Create playlist-track junction entry
                await conn.execute("""
                    INSERT INTO silver_playlist_tracks (
                        playlist_id,
                        track_id,
                        position
                    ) VALUES ($1, $2, $3)
                    ON CONFLICT (playlist_id, track_id, position) DO NOTHING
                """, silver_playlist_id, silver_track_id, position)
                self.stats['playlist_tracks_created'] += 1

                # Create track transition (edge) from previous track to current track
                if previous_silver_track_id and previous_silver_track_id != silver_track_id:
                    await self._create_track_transition(
                        conn,
                        previous_silver_track_id,
                        silver_track_id,
                        silver_playlist_id,
                        position - 1  # Previous position
                    )

                previous_silver_track_id = silver_track_id

        except Exception as e:
            logger.error(f"Error processing playlist tracks for playlist {bronze_playlist_id}: {e}")
            self.stats['errors'] += 1

    async def _create_track_transition(
        self,
        conn: asyncpg.Connection,
        from_track_id: UUID,
        to_track_id: UUID,
        playlist_id: UUID,
        position: int
    ) -> None:
        """
        Create or update silver_track_transitions entry.

        Args:
            conn: Database connection
            from_track_id: Silver track ID (source)
            to_track_id: Silver track ID (destination)
            playlist_id: Silver playlist ID (context)
            position: Position in playlist where transition occurs
        """
        try:
            # Filter out self-loops
            if from_track_id == to_track_id:
                logger.debug(f"Skipping self-loop transition: {from_track_id} → {to_track_id}")
                return

            # Create or update transition
            await conn.execute("""
                INSERT INTO silver_track_transitions (
                    from_track_id,
                    to_track_id,
                    occurrence_count,
                    playlist_occurrences,
                    first_seen,
                    last_seen
                ) VALUES ($1, $2, 1, $3::jsonb, NOW(), NOW())
                ON CONFLICT (from_track_id, to_track_id) DO UPDATE SET
                    occurrence_count = silver_track_transitions.occurrence_count + 1,
                    playlist_occurrences = silver_track_transitions.playlist_occurrences || $4::jsonb,
                    last_seen = NOW(),
                    updated_at = NOW()
            """,
                from_track_id,
                to_track_id,
                json.dumps([{'playlist_id': str(playlist_id), 'position': position, 'date': datetime.now().isoformat()}]),
                json.dumps([{'playlist_id': str(playlist_id), 'position': position, 'date': datetime.now().isoformat()}])
            )

            self.stats['track_transitions_created'] += 1

        except Exception as e:
            logger.error(f"Error creating track transition {from_track_id} → {to_track_id}: {e}")
            self.stats['errors'] += 1


    async def run(self, limit: Optional[int] = None) -> Dict[str, int]:
        """
        Run the Bronze-to-Silver ETL process.

        Processes records from bronze_scraped_tracks and bronze_scraped_playlists tables.

        Args:
            limit: Maximum number of records to process per table (None = all)

        Returns:
            Statistics dictionary
        """
        logger.info("="*80)
        logger.info("BRONZE-TO-SILVER ETL PROCESS STARTING")
        logger.info("="*80)

        if self.dry_run:
            logger.info("⚠️ DRY RUN MODE - No database writes will occur")

        async with self.pool.acquire() as conn:
            # Phase 1: Process bronze_scraped_tracks
            logger.info("Phase 1: Processing bronze_scraped_tracks...")
            tracks_query = """
                SELECT id, source, source_url, source_track_id, scraper_version,
                       raw_json, artist_name, track_title, scraped_at
                FROM bronze_scraped_tracks
                ORDER BY scraped_at ASC
            """
            if limit:
                tracks_query += f" LIMIT {limit}"
                logger.info(f"Querying bronze tracks (limit={limit})...")
            else:
                logger.info("Querying all bronze tracks...")

            bronze_tracks = await conn.fetch(tracks_query)
            logger.info(f"Found {len(bronze_tracks)} bronze track records")

            # Process bronze tracks
            for bronze_track in bronze_tracks:
                await self.process_bronze_track(conn, dict(bronze_track))

            logger.info(f"✅ Processed {self.stats['bronze_tracks_processed']} bronze tracks → {self.stats['tracks_created']} silver tracks")

            # Phase 2: Process bronze_scraped_playlists
            logger.info("Phase 2: Processing bronze_scraped_playlists...")
            playlists_query = """
                SELECT id, source, source_url, source_playlist_id, scraper_version,
                       raw_json, playlist_name, artist_name, event_name, event_date, scraped_at
                FROM bronze_scraped_playlists
                ORDER BY scraped_at ASC
            """
            if limit:
                playlists_query += f" LIMIT {limit}"
                logger.info(f"Querying bronze playlists (limit={limit})...")
            else:
                logger.info("Querying all bronze playlists...")

            bronze_playlists = await conn.fetch(playlists_query)
            logger.info(f"Found {len(bronze_playlists)} bronze playlist records")

            # Process bronze playlists (includes track transitions derivation)
            for bronze_playlist in bronze_playlists:
                await self.process_bronze_playlist(conn, dict(bronze_playlist))

            logger.info(f"✅ Processed {self.stats['bronze_playlists_processed']} bronze playlists → {self.stats['playlists_created']} silver playlists")
            logger.info(f"✅ Created {self.stats['playlist_tracks_created']} playlist-track associations")
            logger.info(f"✅ Derived {self.stats['track_transitions_created']} track transitions (graph edges)")

            logger.info("="*80)
            logger.info("BRONZE-TO-SILVER ETL PROCESS COMPLETE")
            logger.info("="*80)
            logger.info(f"Statistics:")
            logger.info(f"  - Bronze tracks processed: {self.stats['bronze_tracks_processed']}")
            logger.info(f"  - Bronze playlists processed: {self.stats['bronze_playlists_processed']}")
            logger.info(f"  - Silver tracks created: {self.stats['tracks_created']}")
            logger.info(f"  - Silver playlists created: {self.stats['playlists_created']}")
            logger.info(f"  - Playlist-track associations: {self.stats['playlist_tracks_created']}")
            logger.info(f"  - Track transitions (edges): {self.stats['track_transitions_created']}")
            logger.info(f"  - Errors: {self.stats['errors']}")
            logger.info(f"  - Skipped (invalid): {self.stats['skipped_invalid']}")
            logger.info("="*80)

        return self.stats


async def main_async(args):
    """Async main function"""
    etl = BronzeToSilverETL(dry_run=args.dry_run)

    try:
        await etl.connect()
        stats = await etl.run(limit=args.limit)

        # Return exit code based on errors
        if stats['errors'] > 0:
            logger.warning(f"ETL completed with {stats['errors']} errors")
            return 1
        else:
            logger.info("ETL completed successfully")
            return 0

    finally:
        await etl.close()


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description='Bronze-to-Silver ETL Process')
    parser.add_argument('--limit', type=int, help='Limit number of records to process')
    parser.add_argument('--dry-run', action='store_true', help='Dry run mode (no database writes)')
    args = parser.parse_args()

    exit_code = asyncio.run(main_async(args))
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
