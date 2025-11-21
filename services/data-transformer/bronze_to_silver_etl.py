#!/usr/bin/env python3
"""
Bronze-to-Silver ETL Script (Medallion Architecture)
=====================================================

Transforms raw_scrape_data (bronze layer) into silver layer tables:
- silver_enriched_tracks (validated and enriched track data)
- silver_enriched_artists (deduplicated artist data)
- silver_enriched_playlists (playlist/setlist metadata)
- silver_playlist_tracks (track relationships with positions)
- silver_track_transitions (adjacency edges for graph)

Architecture:
1. Read unprocessed records from raw_scrape_data
2. Validate and clean data
3. Insert into appropriate silver tables based on scrape_type
4. Mark raw records as processed
5. Calculate data quality scores

Scrape Types Handled:
- enhancedtrack → silver_enriched_tracks
- enhancedartist → silver_enriched_artists
- enhancedsetlist/playlist → silver_enriched_playlists
- enhancedsetlisttrack → silver_playlist_tracks
- enhancedtrackadjacency → silver_track_transitions
- enhancedtrackartist → enhances track artist relationships

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
    ETL process to transform raw_scrape_data → silver layer tables.

    Validates, cleans, and enriches bronze data into the silver layer.
    """

    def __init__(self, dry_run: bool = False):
        self.dry_run = dry_run
        self.pool: Optional[asyncpg.Pool] = None
        self.stats = {
            'bronze_records_processed': 0,
            'tracks_created': 0,
            'artists_created': 0,
            'playlists_created': 0,
            'playlist_tracks_created': 0,
            'track_transitions_created': 0,
            'errors': 0,
            'skipped_invalid': 0
        }

        # Track created IDs to link relationships
        self.bronze_to_silver_track_map: Dict[str, UUID] = {}
        self.bronze_to_silver_artist_map: Dict[str, UUID] = {}
        self.bronze_to_silver_playlist_map: Dict[str, UUID] = {}

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

    async def process_enhanced_track(self, conn: asyncpg.Connection, bronze_id: UUID, raw_data: Dict) -> Optional[UUID]:
        """Process enhancedtrack scrape type into silver_enriched_tracks"""
        try:
            # Debug: Check raw_data type
            if not isinstance(raw_data, dict):
                logger.error(f"process_enhanced_track received non-dict raw_data: type={type(raw_data)}, value={str(raw_data)[:100]}")
                self.stats['errors'] += 1
                return None

            # Extract and validate required fields
            artist_name = raw_data.get('artist_name', '').strip()
            track_title = raw_data.get('track_name', '').strip()

            if not artist_name or not track_title:
                self.stats['skipped_invalid'] += 1
                return None

            # Calculate data quality score
            quality_score = self.calculate_data_quality_score(raw_data)

            # Prepare enrichment metadata
            enrichment_metadata = {
                'source': raw_data.get('data_source', 'unknown'),
                'original_string': raw_data.get('metadata', {}).get('original_string', ''),
                'extraction_source': raw_data.get('metadata', {}).get('extraction_source', ''),
                'scraped_at': raw_data.get('scrape_timestamp', datetime.now().isoformat())
            }

            # Create silver enriched track
            silver_track_id = await conn.fetchval("""
                INSERT INTO silver_enriched_tracks (
                    bronze_id,
                    artist_name,
                    track_title,
                    spotify_id,
                    isrc,
                    duration_ms,
                    bpm,
                    key,
                    genre,
                    validation_status,
                    data_quality_score,
                    enrichment_metadata,
                    validated_at,
                    enriched_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                ON CONFLICT (bronze_id) DO UPDATE SET
                    artist_name = EXCLUDED.artist_name,
                    track_title = EXCLUDED.track_title,
                    updated_at = NOW()
                RETURNING id
            """,
                bronze_id,
                artist_name,
                track_title,
                raw_data.get('spotify_id'),
                raw_data.get('isrc'),
                raw_data.get('duration_ms'),
                raw_data.get('bpm'),
                raw_data.get('musical_key'),
                [raw_data.get('genre')] if raw_data.get('genre') else None,
                'valid' if quality_score >= 0.7 else 'warning' if quality_score >= 0.4 else 'needs_review',
                quality_score,
                json.dumps(enrichment_metadata),
                datetime.now(),
                datetime.now()
            )

            # Track the mapping
            track_id_from_bronze = raw_data.get('track_id', str(bronze_id))
            self.bronze_to_silver_track_map[track_id_from_bronze] = silver_track_id

            self.stats['tracks_created'] += 1
            return silver_track_id

        except Exception as e:
            logger.error(f"Error processing enhanced track {bronze_id}: {e}")
            self.stats['errors'] += 1
            return None

    async def process_enhanced_artist(self, conn: asyncpg.Connection, bronze_id: UUID, raw_data: Dict) -> Optional[UUID]:
        """Process enhancedartist scrape type into silver_enriched_artists"""
        try:
            artist_name = raw_data.get('artist_name', '').strip()
            if not artist_name:
                self.stats['skipped_invalid'] += 1
                return None

            # Create normalized name for deduplication
            normalized_name = artist_name.lower().strip()

            # Prepare enrichment metadata
            enrichment_metadata = {
                'source': raw_data.get('data_source', 'bronze_layer'),
                'scraped_at': raw_data.get('scrape_timestamp', datetime.now().isoformat())
            }

            # Create or get silver enriched artist
            silver_artist_id = await conn.fetchval("""
                INSERT INTO silver_enriched_artists (
                    bronze_ids,
                    canonical_name,
                    normalized_name,
                    aliases,
                    validation_status,
                    data_quality_score,
                    enrichment_metadata
                ) VALUES (ARRAY[$1::uuid], $2, $3, $4, $5, $6, $7)
                ON CONFLICT (canonical_name) DO UPDATE SET
                    bronze_ids = array_append(silver_enriched_artists.bronze_ids, $8::uuid),
                    updated_at = NOW()
                RETURNING id
            """,
                bronze_id,  # $1 - for initial array creation
                artist_name,  # $2
                normalized_name,  # $3 - normalized for searching/deduplication
                [],  # $4 - aliases
                'valid',  # $5
                0.8,  # $6 - default quality
                json.dumps(enrichment_metadata),  # $7
                bronze_id  # $8 - for array_append on conflict
            )

            self.bronze_to_silver_artist_map[artist_name] = silver_artist_id
            self.stats['artists_created'] += 1
            return silver_artist_id

        except Exception as e:
            logger.error(f"Error processing enhanced artist {bronze_id}: {e}")
            self.stats['errors'] += 1
            return None

    async def process_enhanced_playlist(self, conn: asyncpg.Connection, bronze_id: UUID, raw_data: Dict) -> Optional[UUID]:
        """Process enhancedsetlist/playlist scrape type into silver_enriched_playlists"""
        try:
            playlist_name = raw_data.get('name', raw_data.get('playlist_name', '')).strip()
            if not playlist_name:
                self.stats['skipped_invalid'] += 1
                return None

            # Parse event_date from string to date object if needed
            event_date = raw_data.get('event_date')
            if event_date and isinstance(event_date, str):
                try:
                    # Try parsing ISO format date string (YYYY-MM-DD)
                    event_date = datetime.strptime(event_date, '%Y-%m-%d').date()
                except ValueError:
                    logger.warning(f"Failed to parse event_date '{event_date}' for playlist {bronze_id}, setting to None")
                    event_date = None

            # Calculate data quality and validation status
            quality_score = self.calculate_data_quality_score(raw_data)
            validation_status = 'valid' if quality_score >= 0.7 else 'warning' if quality_score >= 0.4 else 'needs_review'

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
                    updated_at = NOW()
                RETURNING id
            """,
                bronze_id,
                playlist_name,
                raw_data.get('artist_name', '').strip(),
                raw_data.get('event_name'),
                event_date,
                raw_data.get('venue', raw_data.get('location')),
                raw_data.get('track_count', 0),
                validation_status,
                quality_score,
                json.dumps({})  # Empty metadata for now
            )

            playlist_id_from_bronze = raw_data.get('playlist_id', str(bronze_id))
            self.bronze_to_silver_playlist_map[playlist_id_from_bronze] = silver_playlist_id

            self.stats['playlists_created'] += 1
            return silver_playlist_id

        except Exception as e:
            logger.error(f"Error processing enhanced playlist {bronze_id}: {e}")
            self.stats['errors'] += 1
            return None

    async def process_setlist_track(self, conn: asyncpg.Connection, bronze_id: UUID, raw_data: Dict) -> bool:
        """Process enhancedsetlisttrack into silver_playlist_tracks"""
        try:
            # Try to get IDs first, fall back to name-based lookup
            playlist_id = raw_data.get('setlist_id', raw_data.get('playlist_id'))
            track_id = raw_data.get('track_id')
            position = raw_data.get('position', raw_data.get('position_in_source', raw_data.get('track_order', 0)))

            # Get names for fallback lookup
            setlist_name = raw_data.get('setlist_name', '').strip()
            track_name = raw_data.get('track_name', '').strip()
            artist_name = raw_data.get('artist_name', '').strip()

            silver_playlist_id = None
            silver_track_id = None

            # Try ID-based lookup first
            if playlist_id:
                silver_playlist_id = self.bronze_to_silver_playlist_map.get(playlist_id)
                if not silver_playlist_id:
                    try:
                        silver_playlist_id = await conn.fetchval("""
                            SELECT id FROM silver_enriched_playlists WHERE bronze_id = $1
                        """, UUID(playlist_id) if isinstance(playlist_id, str) else playlist_id)
                    except (ValueError, TypeError):
                        pass

            # Fall back to name-based lookup for playlist
            if not silver_playlist_id and setlist_name:
                silver_playlist_id = await conn.fetchval("""
                    SELECT id FROM silver_enriched_playlists WHERE playlist_name = $1 LIMIT 1
                """, setlist_name)

            if track_id:
                silver_track_id = self.bronze_to_silver_track_map.get(track_id)
                if not silver_track_id:
                    try:
                        silver_track_id = await conn.fetchval("""
                            SELECT id FROM silver_enriched_tracks WHERE bronze_id = $1
                        """, UUID(track_id) if isinstance(track_id, str) else track_id)
                    except (ValueError, TypeError):
                        pass

            # Fall back to name-based lookup for track
            if not silver_track_id and track_name:
                if artist_name:
                    silver_track_id = await conn.fetchval("""
                        SELECT id FROM silver_enriched_tracks
                        WHERE track_title = $1 AND artist_name = $2 LIMIT 1
                    """, track_name, artist_name)
                if not silver_track_id:
                    silver_track_id = await conn.fetchval("""
                        SELECT id FROM silver_enriched_tracks WHERE track_title = $1 LIMIT 1
                    """, track_name)

            if not silver_playlist_id or not silver_track_id:
                logger.debug(f"Skipping setlist track - missing playlist ({silver_playlist_id}) or track ({silver_track_id}) for {setlist_name}/{track_name}")
                return False

            await conn.execute("""
                INSERT INTO silver_playlist_tracks (
                    playlist_id,
                    track_id,
                    position
                ) VALUES ($1, $2, $3)
                ON CONFLICT (playlist_id, position) DO NOTHING
            """, silver_playlist_id, silver_track_id, position)

            self.stats['playlist_tracks_created'] += 1
            return True

        except Exception as e:
            logger.error(f"Error processing setlist track {bronze_id}: {e}")
            self.stats['errors'] += 1
            return False

    async def process_track_adjacency(self, conn: asyncpg.Connection, bronze_id: UUID, raw_data: Dict) -> bool:
        """Process enhancedtrackadjacency into silver_track_transitions"""
        try:
            # Extract track names (adjacency data uses names, not bronze IDs)
            track_1_name = raw_data.get('track_1_name', '').strip()
            track_2_name = raw_data.get('track_2_name', '').strip()

            if not track_1_name or not track_2_name:
                logger.debug(f"Skipping adjacency {bronze_id} - missing track names")
                return False

            # Find silver track IDs by matching track names
            # Note: This may match multiple tracks with the same name from different artists
            # For now, we'll take the first match
            silver_from_id = await conn.fetchval("""
                SELECT id FROM silver_enriched_tracks
                WHERE track_title = $1
                LIMIT 1
            """, track_1_name)

            silver_to_id = await conn.fetchval("""
                SELECT id FROM silver_enriched_tracks
                WHERE track_title = $1
                LIMIT 1
            """, track_2_name)

            if not silver_from_id or not silver_to_id:
                logger.debug(f"Skipping adjacency {bronze_id} - tracks not found in silver layer: {track_1_name} → {track_2_name}")
                return False

            # Filter out self-loops (track transitioning to itself)
            if silver_from_id == silver_to_id:
                logger.debug(f"Skipping self-loop adjacency {bronze_id}: {track_1_name} → {track_2_name}")
                return False

            await conn.execute("""
                INSERT INTO silver_track_transitions (
                    from_track_id,
                    to_track_id,
                    transition_count,
                    last_observed_at
                ) VALUES ($1, $2, 1, NOW())
                ON CONFLICT (from_track_id, to_track_id) DO UPDATE SET
                    transition_count = silver_track_transitions.transition_count + 1,
                    last_observed_at = NOW()
            """, silver_from_id, silver_to_id)

            self.stats['track_transitions_created'] += 1
            return True

        except Exception as e:
            logger.error(f"Error processing track adjacency {bronze_id}: {e}")
            self.stats['errors'] += 1
            return False

    async def process_track_artist(self, conn: asyncpg.Connection, bronze_id: UUID, raw_data: Dict) -> bool:
        """
        Process enhancedtrackartist into silver layer.

        This scrape_type represents track-artist relationships. It creates both
        the track and artist if they don't exist, leveraging the existing handlers.
        """
        try:
            artist_name = raw_data.get('artist_name', '').strip()
            track_name = raw_data.get('track_name', '').strip()

            if not artist_name or not track_name:
                self.stats['skipped_invalid'] += 1
                return False

            # Process as both artist and track creation
            # First create/update artist
            await self.process_enhanced_artist(conn, bronze_id, raw_data)

            # Then create/update track (which includes artist_name field)
            await self.process_enhanced_track(conn, bronze_id, raw_data)

            return True

        except Exception as e:
            logger.error(f"Error processing track-artist relationship {bronze_id}: {e}")
            self.stats['errors'] += 1
            return False

    async def process_bronze_record(self, conn: asyncpg.Connection, record: Dict) -> bool:
        """
        Process a single bronze record and insert into appropriate silver table

        Args:
            conn: Database connection
            record: Bronze record from raw_scrape_data

        Returns:
            True if processing succeeded, False otherwise
        """
        scrape_id = record['scrape_id']
        scrape_type = record['scrape_type']
        raw_data = record['raw_data']

        success = False

        try:
            if scrape_type == 'enhancedtrack':
                success = await self.process_enhanced_track(conn, scrape_id, raw_data) is not None
            elif scrape_type == 'enhancedartist':
                success = await self.process_enhanced_artist(conn, scrape_id, raw_data) is not None
            elif scrape_type in ('enhancedsetlist', 'playlist'):
                success = await self.process_enhanced_playlist(conn, scrape_id, raw_data) is not None
            elif scrape_type == 'enhancedsetlisttrack':
                success = await self.process_setlist_track(conn, scrape_id, raw_data)
            elif scrape_type == 'enhancedtrackadjacency':
                success = await self.process_track_adjacency(conn, scrape_id, raw_data)
            elif scrape_type == 'enhancedtrackartist':
                success = await self.process_track_artist(conn, scrape_id, raw_data)
            else:
                logger.warning(f"Unknown scrape_type: {scrape_type}")

            if success:
                self.stats['bronze_records_processed'] += 1

                # Mark as processed
                if not self.dry_run:
                    await conn.execute("""
                        UPDATE raw_scrape_data
                        SET processed = true, processed_at = NOW()
                        WHERE scrape_id = $1
                    """, scrape_id)

        except Exception as e:
            logger.error(f"Error processing bronze record {scrape_id}: {e}")
            self.stats['errors'] += 1
            success = False

        return success

    async def run(self, limit: Optional[int] = None) -> Dict[str, int]:
        """
        Run the Bronze-to-Silver ETL process

        Args:
            limit: Maximum number of records to process (None = all)

        Returns:
            Statistics dictionary
        """
        logger.info("="*80)
        logger.info("BRONZE-TO-SILVER ETL PROCESS STARTING")
        logger.info("="*80)

        if self.dry_run:
            logger.info("⚠️ DRY RUN MODE - No database writes will occur")

        async with self.pool.acquire() as conn:
            # Query unprocessed bronze records (asyncpg will auto-convert JSONB to dict)
            query = """
                SELECT scrape_id, scrape_type, raw_data, scraped_at
                FROM raw_scrape_data
                WHERE processed = false
                ORDER BY scraped_at ASC
            """
            if limit:
                query += f" LIMIT {limit}"
                logger.info(f"Querying bronze records (limit={limit})...")
            else:
                logger.info("Querying all unprocessed bronze records...")

            records = await conn.fetch(query)
            logger.info(f"Found {len(records)} unprocessed bronze records")

            if not records:
                logger.info("No records to process")
                return self.stats

            # Debug: Check type of raw_data immediately after fetch
            if records:
                sample = records[0]
                logger.debug(f"Sample record type: {type(sample)}")
                logger.debug(f"Sample raw_data type: {type(sample['raw_data'])}")
                logger.debug(f"Sample raw_data value (first 100 chars): {str(sample['raw_data'])[:100]}")

            # Group by scrape_type for proper ordering
            records_by_type = {
                'enhancedartist': [],
                'enhancedtrack': [],
                'enhancedsetlist': [],
                'playlist': [],
                'enhancedsetlisttrack': [],
                'enhancedtrackadjacency': [],
                'enhancedtrackartist': []
            }

            for record in records:
                scrape_type = record['scrape_type']
                if scrape_type in records_by_type:
                    # Keep as asyncpg Record to preserve native types (esp. JSONB → dict)
                    records_by_type[scrape_type].append(record)

            # Process in correct order (dependencies)
            processing_order = [
                'enhancedartist',
                'enhancedtrack',
                'enhancedsetlist',
                'playlist',
                'enhancedsetlisttrack',
                'enhancedtrackadjacency',
                'enhancedtrackartist'  # Process last as it links tracks to artists
            ]

            for scrape_type in processing_order:
                type_records = records_by_type[scrape_type]
                if not type_records:
                    continue

                logger.info(f"Processing {len(type_records)} {scrape_type} records...")

                for record in type_records:
                    # Verify raw_data is a dict (asyncpg should auto-convert JSONB)
                    raw_data_type = type(record['raw_data'])
                    is_dict = isinstance(record['raw_data'], dict)
                    scrape_id_str = str(record['scrape_id'])[:8]

                    if not isinstance(record['raw_data'], dict):
                        # Fallback: Try parsing as JSON string if codec didn't work
                        if isinstance(record['raw_data'], str):
                            try:
                                # Create mutable dict from record and parse JSON
                                record_dict = dict(record)
                                record_dict['raw_data'] = json.loads(record_dict['raw_data'])
                                logger.info(f"✅ Fallback JSON parsing succeeded for {scrape_id_str}")
                                # Process the modified record dict
                                await self.process_bronze_record(conn, record_dict)
                                continue
                            except json.JSONDecodeError as e:
                                logger.error(f"raw_data for {record['scrape_id']} failed JSON parsing: {e}")
                                self.stats['errors'] += 1
                                continue
                        else:
                            logger.error(f"raw_data for {record['scrape_id']} is not a dict, it's {type(record['raw_data'])}: {str(record['raw_data'])[:100]}")
                            self.stats['errors'] += 1
                            continue

                    # Parse nested JSON strings (JSONB codec only decodes top level)
                    record_dict = dict(record)
                    record_dict['raw_data'] = self._parse_nested_json(record_dict['raw_data'])

                    await self.process_bronze_record(conn, record_dict)

            logger.info("="*80)
            logger.info("BRONZE-TO-SILVER ETL PROCESS COMPLETE")
            logger.info("="*80)
            logger.info(f"Statistics:")
            logger.info(f"  - Bronze records processed: {self.stats['bronze_records_processed']}")
            logger.info(f"  - Tracks created: {self.stats['tracks_created']}")
            logger.info(f"  - Artists created: {self.stats['artists_created']}")
            logger.info(f"  - Playlists created: {self.stats['playlists_created']}")
            logger.info(f"  - Playlist tracks created: {self.stats['playlist_tracks_created']}")
            logger.info(f"  - Track transitions created: {self.stats['track_transitions_created']}")
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
