"""
Raw Data Processor - Bridge between raw_scrape_data and database_pipeline
Reads unprocessed scrapes from raw_scrape_data and processes them through database_pipeline

Uses unified secrets management (2025 best practices) for credentials.
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

from services.common.secrets_manager import get_database_config, validate_secrets
from database_pipeline import DatabasePipeline

# Import track string parser for artist extraction
try:
    from spiders.utils import parse_track_string
except ImportError:
    # Fallback for different import paths
    import sys
    sys.path.insert(0, str(Path(__file__).parent / 'spiders'))
    from utils import parse_track_string

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
        self.pipeline = DatabasePipeline(self.db_config)

    async def initialize(self):
        """Initialize database connections"""
        connection_string = f"postgresql://{self.db_config['user']}:{self.db_config['password']}@{self.db_config['host']}:{self.db_config['port']}/{self.db_config['database']}"

        self.connection_pool = await asyncpg.create_pool(
            connection_string,
            min_size=2,
            max_size=5
        )

        # Initialize pipeline
        await self.pipeline.open_spider(spider=None)

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

            # Flush any remaining batches in pipeline
            await self.pipeline.close_spider(spider=None)

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
            # Extract playlist metadata
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

            await self.pipeline.process_item(playlist_item, spider=None)
            result["playlists"] += 1

            # CRITICAL: Flush playlists batch immediately so it exists before we add playlist_tracks
            await self.pipeline._flush_batch('playlists')

            # Process tracks
            tracks = raw_data.get('tracks', [])
            track_song_ids = []

            for track_data in tracks:
                track_info = track_data.get('track', {})
                position = track_data.get('position', 0)

                # Create song if it has valid data
                if track_info.get('name'):
                    song_id = str(uuid.uuid4())

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

                    # Create song item
                    song_item = {
                        'item_type': 'track',
                        'track_name': track_name,  # database_pipeline expects 'track_name'
                        'artist_name': artist_name,  # Now validated - never generic
                        'genre': track_info.get('genre', 'Electronic'),
                        'release_year': track_info.get('year'),
                        'label': track_info.get('label')
                    }

                    await self.pipeline.process_item(song_item, spider=None)
                    result["tracks"] += 1

                    # Create playlist_track link
                    playlist_track_item = {
                        'item_type': 'playlist_track',
                        'playlist_name': playlist_name,  # database_pipeline expects 'playlist_name'
                        'track_name': track_name,         # database_pipeline expects 'track_name'
                        'artist_name': track_info.get('artist', 'Unknown Artist'),
                        'position': position,
                        'source': source
                    }

                    await self.pipeline.process_item(playlist_track_item, spider=None)

                    # Store for adjacency creation (track names for lookup)
                    track_song_ids.append((position, track_name, track_info.get('artist', 'Unknown Artist')))

            # CRITICAL: Flush songs batch so they exist before creating playlist_tracks and adjacencies
            await self.pipeline._flush_batch('songs')

            # CRITICAL: Flush playlist_tracks batch so relationships are recorded
            await self.pipeline._flush_batch('playlist_tracks')

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

                await self.pipeline.process_item(adjacency_item, spider=None)
                result["edges"] += 1

        except Exception as e:
            logger.error(f"Error processing scrape data: {e}")
            raise

        return result

    async def close(self):
        """Close all connections"""
        if self.pipeline:
            await self.pipeline.close_spider(spider=None)
        if self.connection_pool:
            await self.connection_pool.close()


async def main():
    """Main entry point - process all unprocessed scrapes"""
    # Validate secrets before starting
    logger.info("Validating secrets...")
    if not validate_secrets():
        logger.error("❌ Required secrets missing - cannot start processor")
        sys.exit(1)

    # Detect if running from host (check if we can connect to docker socket)
    use_localhost = not os.path.exists('/var/run/docker.sock')
    if use_localhost:
        logger.info("Running from HOST - connecting to localhost:5433")
    else:
        logger.info("Running in CONTAINER - connecting to postgres:5432")

    processor = RawDataProcessor(use_localhost=use_localhost)

    try:
        logger.info("Starting raw data processor...")

        await processor.initialize()

        stats = await processor.process_unprocessed_scrapes(limit=100)

        logger.info("=" * 60)
        logger.info("PROCESSING COMPLETE")
        logger.info(f"  Processed: {stats['processed']} scrapes")
        logger.info(f"  Failed: {stats['failed']} scrapes")
        logger.info(f"  Tracks created: {stats['tracks_created']}")
        logger.info(f"  Playlists created: {stats['playlists_created']}")
        logger.info(f"  Edges created: {stats['edges_created']}")
        logger.info("=" * 60)

    except Exception as e:
        logger.error(f"Fatal error: {e}")
        raise
    finally:
        await processor.close()


if __name__ == "__main__":
    asyncio.run(main())