"""
Raw Data Processor - Bridge between raw_scrape_data and persistence pipeline
Reads unprocessed scrapes from raw_scrape_data and processes them through the persistence pipeline

Uses unified secrets management (2025 best practices) for credentials.

This file uses the modern pipelines.persistence_pipeline.PersistencePipeline architecture.
"""
import asyncio
import asyncpg
import json
import logging
import os
import sys
import uuid
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional

# Load .env file if running from host
try:
    from dotenv import load_dotenv
    env_path = Path(__file__).parent.parent / '.env'
    if env_path.exists():
        load_dotenv(env_path)
        logging.info(f"Loaded environment from {env_path}")
except ImportError:
    logging.warning("python-dotenv not installed - using system environment only")

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from common.secrets_manager import get_database_config, validate_secrets

# Import track string parser for artist extraction
try:
    from spiders.utils import parse_track_string
except ImportError:
    # Fallback for different import paths
    import sys
    sys.path.insert(0, str(Path(__file__).parent / 'spiders'))
    from utils import parse_track_string

# Import track ID generator for cross-source deduplication
from track_id_generator import generate_track_id, extract_remix_type

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class RawDataProcessor:
    """Processes raw scrape data and feeds it through database_pipeline"""

    def __init__(self, db_config: Optional[Dict] = None, use_localhost: bool = False):
        """
        Initialize raw data processor.

        Args:
            db_config: Optional database configuration override
            use_localhost: If True, connects to localhost:5433 (for host execution)
        """
        if db_config:
            self.db_config = db_config
        elif use_localhost:
            # Running from host - use external port
            self.db_config = get_database_config(
                host_override="localhost",
                port_override=5433
            )
        else:
            # Running in container - use docker network
            self.db_config = get_database_config()

        self.connection_pool = None
        # Don't use persistence_pipeline - has event loop conflicts
        # Use direct database inserts instead

    async def initialize(self):
        """Initialize database connections"""
        connection_string = f"postgresql://{self.db_config['user']}:{self.db_config['password']}@{self.db_config['host']}:{self.db_config['port']}/{self.db_config['database']}"

        self.connection_pool = await asyncpg.create_pool(
            connection_string,
            min_size=2,
            max_size=10,
            command_timeout=30
        )

        logger.info("✓ Raw data processor initialized")

    async def process_unprocessed_scrapes(self, limit: int = 100) -> Dict[str, Any]:
        """Process all unprocessed scrapes from raw_scrape_data"""
        if not self.connection_pool:
            await self.initialize()

        stats = {
            "processed": 0,
            "failed": 0,
            "tracks_created": 0,
            "playlists_created": 0,
            "edges_created": 0
        }

        try:
            async with self.connection_pool.acquire() as conn:
                # Fetch unprocessed scrapes
                rows = await conn.fetch("""
                    SELECT scrape_id, source, scrape_type, raw_data
                    FROM raw_scrape_data
                    WHERE processed = FALSE
                    ORDER BY scraped_at
                    LIMIT $1
                """, limit)

                logger.info(f"Found {len(rows)} unprocessed scrapes")

                for row in rows:
                    try:
                        scrape_id = row['scrape_id']
                        source = row['source']
                        raw_data = row['raw_data']

                        # Parse JSON if it's a string
                        if isinstance(raw_data, str):
                            raw_data = json.loads(raw_data)

                        # Process this scrape
                        result = await self._process_single_scrape(
                            scrape_id, source, raw_data
                        )

                        stats["processed"] += 1
                        stats["tracks_created"] += result.get("tracks", 0)
                        stats["playlists_created"] += result.get("playlists", 0)
                        stats["edges_created"] += result.get("edges", 0)

                        # Mark as processed
                        await conn.execute("""
                            UPDATE raw_scrape_data
                            SET processed = TRUE,
                                processed_at = CURRENT_TIMESTAMP
                            WHERE scrape_id = $1
                        """, scrape_id)

                        logger.info(f"✓ Processed scrape {scrape_id}: {result}")

                    except Exception as e:
                        stats["failed"] += 1
                        logger.error(f"Failed to process scrape {scrape_id}: {e}")

                        # Mark as processed with error
                        await conn.execute("""
                            UPDATE raw_scrape_data
                            SET processed = TRUE,
                                processed_at = CURRENT_TIMESTAMP,
                                error_message = $2
                            WHERE scrape_id = $1
                        """, scrape_id, str(e))

        except Exception as e:
            logger.error(f"Error processing unprocessed scrapes: {e}")
            raise

        return stats

    async def _process_single_scrape(
        self,
        scrape_id: uuid.UUID,
        source: str,
        raw_data: Dict[str, Any]
    ) -> Dict[str, int]:
        """Process a single scrape through database_pipeline"""

        result = {"tracks": 0, "playlists": 0, "edges": 0}

        try:
            # Detect format: EnhancedTrackItem vs Playlist
            if 'track_id' in raw_data and 'artist_name' in raw_data:
                # EnhancedTrackItem format - process as single track
                return await self._process_enhanced_track_item(raw_data, source)

            # Playlist format - extract playlist metadata
            playlist_id = str(uuid.uuid4())
            playlist_name = raw_data.get('name', 'Unknown Playlist')
            playlist_url = raw_data.get('url', '')
            artist_name = raw_data.get('artist', 'Various Artists')

            # Create playlist item
            playlist_item = {
                'item_type': 'playlist',
                'playlist_id': playlist_id,
                'name': playlist_name,
                'source': source,
                'source_url': playlist_url,
                'dj_artist_name': artist_name,
                'event_date': raw_data.get('date'),
                'venue_name': raw_data.get('venue'),
                'tracklist_count': len(raw_data.get('tracks', []))
            }

            # Playlist metadata extracted (not inserting to database - only tracks matter for medallion)
            result["playlists"] += 1

            # Process tracks
            tracks = raw_data.get('tracks', [])
            track_song_ids = []

            for idx, track_data in enumerate(tracks):
                # Handle two formats:
                # 1. String format: "Artist - Track Name"
                # 2. Dict format: {"track": {"name": "...", "artist": "..."}, "position": 1}

                parsed = None  # Track if we parsed the track string
                track_name = None
                artist_name = None
                position = idx + 1

                if isinstance(track_data, str):
                    # Format 1: Parse track string
                    track_string = track_data

                    # Parse artist and track name from string
                    parsed = parse_track_string(track_string)
                    if not parsed or not parsed.get('primary_artists'):
                        logger.debug(f"Could not parse track string: {track_string}")
                        continue

                    artist_name = parsed['primary_artists'][0]
                    track_name = parsed['track_name']

                elif isinstance(track_data, dict):
                    # Format 2: Extract from nested dict
                    track_info = track_data.get('track', {})
                    position = track_data.get('position', idx + 1)

                    # Create song if it has valid data
                    if not track_info.get('name'):
                        continue

                    # Extract artist and track name with validation
                    track_name = track_info.get('name', 'Unknown')
                    artist_name = track_info.get('artist', 'Unknown Artist')

                    # CRITICAL: Validate artist name - NO GENERIC PLACEHOLDERS (2025 best practices)
                    if artist_name in ['Various Artists', 'Unknown Artist', None, '', 'Various', 'Unknown']:
                        # Attempt to extract artist from track name
                        if ' - ' in track_name:
                            logger.info(f"Attempting artist extraction from track string: {track_name}")
                            parsed = parse_track_string(track_name)

                            if parsed and parsed.get('primary_artists'):
                                artist_name = parsed['primary_artists'][0]
                                track_name = parsed['track_name']
                                logger.info(f"✓ Extracted artist: {artist_name} - Track: {track_name}")
                            else:
                                logger.warning(f"❌ Could not extract artist from: {track_name} - SKIPPING")
                                continue  # Skip tracks with no valid artist
                        else:
                            logger.warning(f"❌ Track has no artist and name doesn't contain separator: {track_name} - SKIPPING")
                            continue  # Skip tracks with no valid artist
                else:
                    logger.warning(f"Unknown track format: {type(track_data)}")
                    continue

                # Validate we have required data
                if not track_name or not artist_name:
                    logger.debug(f"Skipping track with missing name or artist")
                    continue

                # Skip generic placeholders (in case they slipped through)
                if artist_name in ['Various Artists', 'Unknown Artist', '', 'Various', 'Unknown']:
                    logger.debug(f"Skipping track with generic artist: {artist_name}")
                    continue

                # Detect remix type for track_id generation
                remix_type = extract_remix_type(track_name) if parsed else None
                is_remix = remix_type is not None

                # Generate deterministic track_id for cross-source deduplication
                track_id = generate_track_id(
                    title=track_name,
                    primary_artist=artist_name,
                    is_remix=is_remix,
                    remix_type=remix_type
                )

                # Create song item
                song_item = {
                    'item_type': 'track',
                    'track_id': track_id,  # Deterministic ID for cross-source matching
                    'track_name': track_name,  # database_pipeline expects 'track_name'
                    'artist_name': artist_name,  # Now validated - never generic
                    'genre': 'Electronic',  # Default genre
                    'is_remix': is_remix,
                    'remix_type': remix_type
                }

                logger.debug(f"Generated track_id {track_id} for: {artist_name} - {track_name}")

                # Direct database insert to bronze and silver layers
                try:
                    async with self.connection_pool.acquire() as conn:
                        async with conn.transaction():
                            # 1. Insert to bronze layer
                            raw_json = json.dumps(song_item, default=str)

                            bronze_id = await conn.fetchval("""
                                INSERT INTO bronze_scraped_tracks (
                                    source, source_url, source_track_id, scraper_version,
                                    raw_json, artist_name, track_title
                                )
                                VALUES ($1, $2, $3, $4, $5, $6, $7)
                                ON CONFLICT (source, source_url, source_track_id) DO UPDATE SET
                                    raw_json = EXCLUDED.raw_json,
                                    artist_name = EXCLUDED.artist_name,
                                    track_title = EXCLUDED.track_title,
                                    scraped_at = NOW()
                                RETURNING id
                            """, source, playlist_url, track_id, 'v1.0.0', raw_json, artist_name, track_name)

                            # 2. Insert to silver layer
                            quality_score = 0.4  # Has artist + track name from playlist

                            await conn.execute("""
                                INSERT INTO silver_enriched_tracks (
                                    bronze_id, artist_name, track_title,
                                    validation_status, data_quality_score, enrichment_metadata
                                )
                                VALUES ($1, $2, $3, $4, $5, $6)
                                ON CONFLICT (bronze_id) DO UPDATE SET
                                    artist_name = EXCLUDED.artist_name,
                                    track_title = EXCLUDED.track_title,
                                    data_quality_score = EXCLUDED.data_quality_score
                            """, bronze_id, artist_name, track_name, 'valid', quality_score, '{}')

                            result["tracks"] += 1
                            logger.debug(f"✓ Inserted playlist track: {artist_name} - {track_name}")

                except Exception as e:
                    logger.error(f"Error inserting track {artist_name} - {track_name}: {e}")
                    continue  # Skip this track but continue processing others

                # Store for adjacency creation (track names for lookup)
                track_song_ids.append((position, track_name, artist_name))

            # Create song adjacencies (edges between sequential tracks)
            track_song_ids.sort(key=lambda x: x[0])  # Sort by position

            for i in range(len(track_song_ids) - 1):
                _, track1_name, track1_artist = track_song_ids[i]
                _, track2_name, track2_artist = track_song_ids[i + 1]

                adjacency_item = {
                    'item_type': 'track_adjacency',
                    'track1_name': track1_name,
                    'track1_artist': track1_artist,
                    'track2_name': track2_name,
                    'track2_artist': track2_artist,
                    'distance': 1,
                    'occurrence_count': 1,
                    'source_context': f"{playlist_name} at position {i+1}-{i+2}",
                    'source_url': playlist_url
                }

                # Note: Track adjacencies not currently stored in medallion architecture
                # They would belong in a gold layer graph structure
                result["edges"] += 1

        except Exception as e:
            logger.error(f"Error processing scrape data: {e}")
            raise

        return result

    async def _process_enhanced_track_item(
        self,
        raw_data: Dict[str, Any],
        source: str
    ) -> Dict[str, int]:
        """
        Process EnhancedTrackItem format - individual track records from spiders.

        Uses direct database inserts to bronze/silver tables to avoid
        event loop conflicts with persistence_pipeline.

        EnhancedTrackItem structure:
        {
            'track_id': 'deterministic_id',
            'track_name': 'Walkie Talkie',
            'artist_name': 'DJ Shadow',  # NOW POPULATED via backfill!
            'genre': 'Electronic',
            'bpm': 128,
            'musical_key': 'A Minor',
            'is_remix': False,
            'remix_type': None,
            'data_source': 'mixesdb',
            'source_context': 'DJ Shadow - Walkie Talkie',
            ...
        }
        """
        result = {"tracks": 0, "playlists": 0, "edges": 0}

        try:
            # Extract track data - already has artist_name from backfill!
            track_id = raw_data.get('track_id')
            track_name = raw_data.get('track_name')
            artist_name = raw_data.get('artist_name')

            # Validate required fields
            if not track_name or not artist_name:
                logger.debug(f"EnhancedTrackItem missing required fields: track_name={track_name}, artist_name={artist_name}")
                return result

            # Skip generic placeholders
            if artist_name in ['Unknown Artist', 'Various Artists', '']:
                logger.debug(f"Skipping track with generic artist: {artist_name} - {track_name}")
                return result

            # Direct database insert
            async with self.connection_pool.acquire() as conn:
                async with conn.transaction():
                    # 1. Insert to bronze layer (raw data preservation)
                    raw_json = json.dumps(raw_data, default=str)
                    source_url = raw_data.get('source_url', 'unknown')
                    source_track_id = track_id or str(uuid.uuid4())

                    bronze_id = await conn.fetchval("""
                        INSERT INTO bronze_scraped_tracks (
                            source, source_url, source_track_id, scraper_version,
                            raw_json, artist_name, track_title
                        )
                        VALUES ($1, $2, $3, $4, $5, $6, $7)
                        ON CONFLICT (source, source_url, source_track_id) DO UPDATE SET
                            raw_json = EXCLUDED.raw_json,
                            artist_name = EXCLUDED.artist_name,
                            track_title = EXCLUDED.track_title,
                            scraped_at = NOW()
                        RETURNING id
                    """, source, source_url, source_track_id, 'v1.0.0', raw_json, artist_name, track_name)

                    # 2. Insert to silver layer (enriched data with bronze_id FK)
                    bpm = float(raw_data['bpm']) if raw_data.get('bpm') else None
                    energy = float(raw_data['energy']) if raw_data.get('energy') else None

                    # Calculate data quality score
                    quality_score = 0.4  # Has artist + track name
                    if bpm: quality_score += 0.1
                    if raw_data.get('musical_key'): quality_score += 0.1
                    if energy: quality_score += 0.1
                    if raw_data.get('genre'): quality_score += 0.05

                    await conn.execute("""
                        INSERT INTO silver_enriched_tracks (
                            bronze_id, artist_name, track_title,
                            bpm, key, genre, energy,
                            validation_status, data_quality_score, enrichment_metadata
                        )
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                        ON CONFLICT (bronze_id) DO UPDATE SET
                            artist_name = EXCLUDED.artist_name,
                            track_title = EXCLUDED.track_title,
                            bpm = EXCLUDED.bpm,
                            key = EXCLUDED.key,
                            genre = EXCLUDED.genre,
                            energy = EXCLUDED.energy,
                            data_quality_score = EXCLUDED.data_quality_score
                    """, bronze_id, artist_name, track_name,
                         bpm, raw_data.get('musical_key'),
                         [raw_data.get('genre')] if raw_data.get('genre') else None,
                         energy, 'valid', quality_score, '{}')

                    result["tracks"] += 1
                    logger.debug(f"✓ Inserted EnhancedTrackItem: {artist_name} - {track_name}")

        except Exception as e:
            logger.error(f"Error processing EnhancedTrackItem: {e}", exc_info=True)
            raise

        return result

    async def close(self):
        """Close all connections"""
        if self.connection_pool:
            await self.connection_pool.close()
            logger.info("✓ Database connection pool closed")


async def main():
    """Main entry point - continuous processing loop"""
    # Validate secrets before starting
    logger.info("Validating secrets...")
    if not validate_secrets():
        logger.error("❌ Required secrets missing - cannot start processor")
        sys.exit(1)

    # Detect if running from host (check if we can connect to docker socket)
    # FORCE CONTAINER MODE - use postgres:5432
    use_localhost = False
    logger.info("Running in CONTAINER - connecting to postgres:5432")

    processor = RawDataProcessor(use_localhost=use_localhost)

    try:
        logger.info("Starting raw data processor in continuous mode...")

        await processor.initialize()

        # Get processing interval from environment (default: 60 seconds)
        processing_interval = int(os.getenv('PROCESSING_INTERVAL', '60'))
        batch_size = int(os.getenv('BATCH_SIZE', '100'))

        logger.info(f"Processing configuration: batch_size={batch_size}, interval={processing_interval}s")

        # Continuous processing loop
        while True:
            try:
                stats = await processor.process_unprocessed_scrapes(limit=batch_size)

                if stats['processed'] > 0:
                    logger.info("=" * 60)
                    logger.info("BATCH PROCESSING COMPLETE")
                    logger.info(f"  Processed: {stats['processed']} scrapes")
                    logger.info(f"  Failed: {stats['failed']} scrapes")
                    logger.info(f"  Tracks created: {stats['tracks_created']}")
                    logger.info(f"  Playlists created: {stats['playlists_created']}")
                    logger.info(f"  Edges created: {stats['edges_created']}")
                    logger.info("=" * 60)
                else:
                    logger.debug(f"No unprocessed scrapes found, sleeping for {processing_interval}s")

                # Wait before next processing cycle
                await asyncio.sleep(processing_interval)

            except Exception as batch_error:
                logger.error(f"Error in processing batch: {batch_error}", exc_info=True)
                # Continue processing after error with exponential backoff
                await asyncio.sleep(min(processing_interval * 2, 300))

    except Exception as e:
        logger.error(f"Fatal error: {e}", exc_info=True)
        raise
    finally:
        await processor.close()


if __name__ == "__main__":
    asyncio.run(main())