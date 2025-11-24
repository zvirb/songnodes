"""
Persistence Pipeline for SongNodes Scrapers (Priority 300)

Persists validated and enriched items to PostgreSQL database.
Implements Scrapy Specification Section VI.1: Separation of Concerns

Responsibilities:
- Database connection pooling (asyncpg)
- Upsert logic (INSERT ... ON CONFLICT DO UPDATE)
- Batch processing for performance
- Transaction management
- Periodic flushing to handle Scrapy/Twisted async issues

Refactored from database_pipeline.py with clean separation of concerns.

Usage:
    ITEM_PIPELINES = {
        'pipelines.validation_pipeline.ValidationPipeline': 100,
        'pipelines.enrichment_pipeline.EnrichmentPipeline': 200,
        'pipelines.persistence_pipeline.PersistencePipeline': 300,
    }
"""
import asyncio
import asyncpg
import logging
import threading
from datetime import datetime, date
from typing import Dict, List, Any, Optional
from scrapy import Spider

# Add Prometheus metrics for monitoring
try:
    from prometheus_client import Counter, Gauge
    METRICS_AVAILABLE = True
except ImportError:
    METRICS_AVAILABLE = False
    logging.warning("Prometheus client not available - metrics disabled")

logger = logging.getLogger(__name__)

# Define Prometheus metrics if available
if METRICS_AVAILABLE:
    playlists_created = Counter(
        'playlists_created_total',
        'Total playlists created',
        ['source', 'tracklist_count']
    )

    silent_failures = Counter(
        'silent_scraping_failures_total',
        'Playlists with 0 tracks and no error',
        ['source', 'parsing_version']
    )

    tracks_extracted = Counter(
        'tracks_extracted_total',
        'Total tracks extracted',
        ['source']
    )


class PersistencePipeline:
    """
    Pipeline that persists validated and enriched items to PostgreSQL (Priority 300).

    Features:
    - Connection pooling with configurable limits (min_size=5, max_size=15)
    - Batch processing for performance (default batch_size=50)
    - Upsert operations (INSERT ... ON CONFLICT DO UPDATE)
    - Transaction management
    - Periodic background flushing (every 10 seconds)
    - Comprehensive error handling and logging
    - Supports secrets_manager for centralized credentials
    """

    @classmethod
    def from_crawler(cls, crawler):
        """
        Scrapy calls this method to instantiate the pipeline.
        Load database config from environment variables or secrets manager.

        Args:
            crawler: Scrapy crawler instance

        Returns:
            Configured PersistencePipeline instance
        """
        import os

        # Use centralized secrets manager if available
        try:
            # Try to import from parent directory (scrapers/../services/common/)
            import sys
            parent_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            services_common = os.path.join(parent_dir, 'services', 'common')
            if services_common not in sys.path:
                sys.path.insert(0, services_common)

            from secrets_manager import get_database_config
            db_config = get_database_config()
            logger.info("✅ Using centralized secrets manager for database configuration")
        except ImportError:
            # Fallback to environment variables
            # First try parsing DATABASE_URL if available (common in containers)
            database_url = os.getenv('DATABASE_URL')
            if database_url and database_url.startswith('postgresql'):
                # Parse postgresql://user:password@host:port/database
                from urllib.parse import urlparse
                parsed = urlparse(database_url)
                db_config = {
                    'host': parsed.hostname or 'postgres',
                    'port': parsed.port or 5432,
                    'database': parsed.path.lstrip('/') or 'musicdb',
                    'user': parsed.username or 'musicdb_user',
                    'password': parsed.password or 'musicdb_secure_pass_2024'
                }
                logger.info(f"✅ Using DATABASE_URL: {parsed.hostname}:{parsed.port}/{parsed.path.lstrip('/')}")
            else:
                # Fall back to individual env vars
                db_config = {
                    'host': os.getenv('DATABASE_HOST', 'postgres'),
                    'port': int(os.getenv('DATABASE_PORT', '5432')),
                    'database': os.getenv('DATABASE_NAME', 'musicdb'),
                    'user': os.getenv('DATABASE_USER', 'musicdb_user'),
                    'password': os.getenv('DATABASE_PASSWORD', os.getenv('POSTGRES_PASSWORD', 'musicdb_secure_pass_2024'))
                }
                logger.info("⚠️ Secrets manager not available - using environment variables")

        return cls(db_config)

    def __init__(self, database_config: Dict[str, Any]):
        """
        Initialize persistence pipeline with database configuration.

        Args:
            database_config: Database connection parameters
        """
        self.config = database_config
        self.connection_pool: Optional[asyncpg.Pool] = None
        self.logger = logging.getLogger(__name__)

        # Batch processing configuration
        self.batch_size = 50
        self.item_batches = {
            'bronze_tracks': [],  # NEW: Bronze layer for raw track data
            'bronze_playlists': [],  # NEW: Bronze layer for raw playlist data
            'artists': [],
            'tracks': [],  # Silver layer tracks
            'playlists': [],  # Silver layer playlists
            'playlist_tracks': [],
            'song_adjacency': [],  # Track adjacency relationships (transitions)
        }

        # Track processed items to avoid duplicates within same scraping session
        self.processed_items = {
            'artists': set(),
            'tracks': set(),  # Changed from 'songs' to 'tracks'
            'playlists': set()
        }

        # Internal statistics tracking
        self.stats = {
            'total_items': 0,
            'persisted_items': 0,
            'failed_items': 0,
            'silent_failures': 0,  # NEW: Track silent failures
            'items_by_type': {}
        }

        # CRITICAL: Playlist context tracking for bronze_scraped_tracks FK relationships
        # Maps playlist_name -> bronze_scraped_playlists.id for linking tracks to playlists
        self._current_bronze_playlist_id: Optional[str] = None  # Current playlist being processed
        self._playlist_id_map: Dict[str, str] = {}  # Map playlist_name -> bronze_id

        # Periodic flushing to bypass Scrapy/Twisted async close_spider() issue
        self.flush_interval = 10  # seconds
        self.flush_thread: Optional[threading.Thread] = None
        self._stop_flushing = threading.Event()
        self._flushing_lock = threading.Lock()
        self._pool_ready = threading.Event()  # Signal when pool is initialized
        self._persistent_loop = None  # The event loop used by the persistent thread

    def _periodic_flush_thread_target(self):
        """
        Background thread that periodically flushes batches to database.

        Runs in its own thread with its own asyncio event loop to bypass
        Scrapy's Twisted reactor async incompatibility. Ensures data is saved
        even if close_spider() fails.

        CRITICAL: This thread also initializes the connection pool to ensure
        the pool and event loop are in the same thread.
        """
        # Create new event loop for this thread
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        self._persistent_loop = loop  # Store for use by close_spider

        self.logger.info(f"🔄 Starting persistent async thread for database operations")

        try:
            # Initialize connection pool in THIS thread's event loop
            connection_string = (
                f"postgresql://{self.config['user']}:{self.config['password']}"
                f"@{self.config['host']}:{self.config['port']}/{self.config['database']}"
            )
            # Configure database connection with proper schema search path
            # server_settings ensures queries search musicdb schema first, then public
            self.connection_pool = loop.run_until_complete(asyncpg.create_pool(
                connection_string,
                min_size=5,
                max_size=15,
                command_timeout=30,
                max_queries=50000,
                max_inactive_connection_lifetime=1800,
                server_settings={'search_path': 'musicdb,public'}
            ))
            self.logger.info("✓ Database connection pool initialized in persistent thread")
            self._pool_ready.set()  # Signal that pool is ready

            # Now start periodic flushing
            while not self._stop_flushing.is_set():
                # Wait for flush interval or stop signal
                if self._stop_flushing.wait(timeout=self.flush_interval):
                    # Stop signal received - do final flush before exiting
                    break

                # Check if there's anything to flush
                with self._flushing_lock:
                    total_items = sum(len(batch) for batch in self.item_batches.values())
                    if total_items > 0:
                        self.logger.info(f"⏰ Periodic flush triggered ({total_items} items pending)")
                        try:
                            loop.run_until_complete(self.flush_all_batches())
                        except Exception as e:
                            self.logger.error(f"Error during periodic flush: {e}")
                            import traceback
                            self.logger.error(traceback.format_exc())

            self.logger.info("✓ Periodic flushing thread stopped")
        except Exception as e:
            self.logger.error(f"Error in persistent async thread: {e}")
            import traceback
            self.logger.error(traceback.format_exc())
            self._pool_ready.set()  # Unblock waiting threads even on error
        finally:
            # Don't close loop yet - close_spider might need it
            pass

    def open_spider(self, spider: Spider):
        """
        Initialize connection pool when spider starts.

        Starts a persistent thread that manages both the connection pool
        and periodic flushing. The thread runs with its own event loop to
        avoid Twisted/asyncio conflicts.

        Args:
            spider: Spider instance
        """
        # Start persistent async thread (it will initialize the pool)
        self._stop_flushing.clear()
        self._pool_ready.clear()
        self.flush_thread = threading.Thread(
            target=self._periodic_flush_thread_target,
            daemon=True,
            name="PersistencePipelinePersistentThread"
        )
        self.flush_thread.start()

        # Wait for the pool to be initialized (with timeout)
        if not self._pool_ready.wait(timeout=30):
            raise RuntimeError("Timeout waiting for database connection pool initialization")

        self.logger.info("✓ Persistent async thread started and pool ready")

    async def process_item(self, item: Dict[str, Any], spider: Spider) -> Dict[str, Any]:
        """
        Process a validated and enriched item and add to appropriate batch.

        Args:
            item: Scrapy item (already validated and enriched)
            spider: Spider instance

        Returns:
            Processed item

        Raises:
            Exception: If processing fails
        """
        try:
            # Ensure connection pool is initialized
            if not self.connection_pool:
                self.logger.error("Connection pool not initialized! open_spider was not called properly.")
                self.logger.warning("Attempting emergency initialization...")
                self.open_spider(spider)

            self.stats['total_items'] += 1

            # Determine item type (with fallback if not explicitly set)
            item_type = self._determine_item_type(item)

            # Log item ENTRY to pipeline
            item_class_name = item.__class__.__name__ if hasattr(item, '__class__') else 'dict'
            self.logger.info(
                f"🔍 Processing item #{self.stats['total_items']}: class={item_class_name}, type={item_type}"
            )

            if item_type == 'artist':
                await self._process_artist_item(item)
            elif item_type == 'track':
                await self._process_track_item(item)
            elif item_type == 'playlist' or item_type == 'setlist':
                await self._process_playlist_item(item)
            elif item_type == 'playlist_track':
                await self._process_playlist_track_item(item)
            elif item_type == 'track_adjacency':
                await self._process_adjacency_item(item)
            else:
                self.logger.warning(f"❌ Unknown item type: {item_type} (class={item_class_name})")
                return item

            # Track statistics
            if item_type not in self.stats['items_by_type']:
                self.stats['items_by_type'][item_type] = 0
            self.stats['items_by_type'][item_type] += 1

            # Log successful queuing with batch routing info
            batch_sizes = {k: len(v) for k, v in self.item_batches.items() if v}
            self.logger.info(
                f"✓ Queued {item_type} item to batches. Current batch sizes: {batch_sizes}"
            )

            return item

        except Exception as e:
            self.stats['failed_items'] += 1
            self.logger.error(f"❌ Error processing item #{self.stats['total_items']}: {e}")
            import traceback
            self.logger.error(traceback.format_exc())
            raise

    async def _process_artist_item(self, item: Dict[str, Any]):
        """
        Process artist item and add to batch.

        Args:
            item: Artist item
        """
        artist_name = item.get('artist_name', '').strip()
        if not artist_name or artist_name in self.processed_items['artists']:
            return

        self.processed_items['artists'].add(artist_name)
        self.item_batches['artists'].append({
            'name': artist_name,
            'genre': item.get('genre'),
            'country': item.get('country'),
            'popularity_score': item.get('popularity_score'),
            'spotify_id': item.get('spotify_id'),
            'apple_music_id': item.get('apple_music_id'),
            'soundcloud_id': item.get('soundcloud_id')
        })

        if len(self.item_batches['artists']) >= self.batch_size:
            await self._flush_batch('artists')

    async def _process_track_item(self, item: Dict[str, Any]):
        """
        Process track/song item and add to BOTH bronze and silver batches.

        Medallion architecture: Raw data → Bronze → Silver

        Args:
            item: Track item
        """
        track_name = item.get('track_name') or item.get('title', '').strip()
        if not track_name:
            self.logger.warning(
                f"⚠️ Track item missing track_name/title. Available fields: {list(item.keys())}",
                extra={
                    'item_type': 'track',
                    'missing_field': 'track_name',
                    'item_keys': list(item.keys()),
                    'source': item.get('data_source', 'unknown')
                }
            )
            return

        artist_name = item.get('artist_name', '').strip()
        track_key = f"{track_name}::{artist_name}"

        if track_key in self.processed_items['tracks']:
            self.logger.debug(f"Duplicate track skipped: {track_key}")
            return

        # Log missing critical fields
        missing_fields = []
        if not artist_name:
            missing_fields.append('artist_name')
        if not item.get('track_id'):
            missing_fields.append('track_id')

        if missing_fields:
            self.logger.warning(
                f"⚠️ Track '{track_name}' missing critical fields: {', '.join(missing_fields)}",
                extra={
                    'track_name': track_name,
                    'artist_name': artist_name,
                    'missing_fields': missing_fields,
                    'source': item.get('data_source', 'unknown')
                }
            )

        self.processed_items['tracks'].add(track_key)

        # Update Prometheus metric for tracks extracted
        if METRICS_AVAILABLE:
            source = item.get('data_source', 'unknown')
            tracks_extracted.labels(source=source).inc()

        # First ensure artist exists
        artist_name = item.get('artist_name', '').strip()
        if artist_name and artist_name not in self.processed_items['artists']:
            await self._process_artist_item({'artist_name': artist_name, 'genre': item.get('genre')})

        # MEDALLION: Add to BRONZE batch (raw data preservation)
        # CRITICAL: Preserve playlist context fields (_bronze_playlist_id, _track_position)
        # These are passed from _process_playlist_track_item for bronze FK relationships
        # SKIP bronze insertion for standalone tracks (no playlist context) to avoid NULL FK violations
        # Tracks WITH playlist context come from EnhancedSetlistTrackItem processing
        has_playlist_context = item.get('_bronze_playlist_id') is not None or item.get('_track_position') is not None
        if has_playlist_context:
            self.item_batches['bronze_tracks'].append(item)  # Store complete raw item
            self.logger.debug(
                f"✓ Track '{track_name}' queued to bronze_tracks (has playlist context: "
                f"playlist_id={item.get('_bronze_playlist_id')}, position={item.get('_track_position')})"
            )
        else:
            self.logger.debug(
                f"⊘ Track '{track_name}' skipped for bronze_tracks (no playlist context - standalone track)"
            )

        # MEDALLION: Add to SILVER batch (enriched data)
        silver_item = {
            'track_id': item.get('track_id'),
            'title': track_name,
            'artist_name': artist_name,
            'genre': item.get('genre'),
            'bpm': item.get('bpm'),
            'key': item.get('musical_key') or item.get('key'),
            'duration_seconds': item.get('duration_seconds'),
            'release_year': item.get('release_date', '').split('-')[0] if item.get('release_date') else None,
            'label': item.get('record_label') or item.get('label'),
            # Streaming platform IDs
            'spotify_id': item.get('spotify_id'),
            'musicbrainz_id': item.get('musicbrainz_id'),
            'tidal_id': item.get('tidal_id'),
            'beatport_id': item.get('beatport_id'),
            'apple_music_id': item.get('apple_music_id'),
            'soundcloud_id': item.get('soundcloud_id'),
            'deezer_id': item.get('deezer_id'),
            'youtube_music_id': item.get('youtube_music_id') or item.get('youtube_id'),
            # Audio features
            'energy': item.get('energy'),
            'danceability': item.get('danceability'),
            'valence': item.get('valence'),
            'acousticness': item.get('acousticness'),
            'instrumentalness': item.get('instrumentalness'),
            'liveness': item.get('liveness'),
            'speechiness': item.get('speechiness'),
            'loudness': item.get('loudness'),
            # Track characteristics
            'is_remix': item.get('is_remix', False),
            'is_mashup': item.get('is_mashup', False),
            'is_live': item.get('is_live', False),
            'is_cover': item.get('is_cover', False),
            'is_instrumental': item.get('is_instrumental', False),
            'is_explicit': item.get('is_explicit', False),
            # Normalized fields
            'normalized_title': item.get('normalized_title'),
            'popularity_score': item.get('popularity_score'),
            # MEDALLION: Reference to raw data (will be set during flush)
            '_raw_item': item  # Keep reference to get bronze_id later
        }
        self.item_batches['tracks'].append(silver_item)

        # Flush bronze if batch full (bronze must flush before silver)
        if len(self.item_batches['bronze_tracks']) >= self.batch_size:
            await self._flush_batch('bronze_tracks')

        if len(self.item_batches['tracks']) >= self.batch_size:
            await self._flush_batch('tracks')

    async def _process_playlist_item(self, item: Dict[str, Any]):
        """
        Process playlist/setlist item with comprehensive validation.

        Args:
            item: Playlist item
        """
        self.logger.info(f"🔍 _process_playlist_item called with item keys: {list(item.keys())}")
        self.logger.info(f"🔍 Item class: {item.__class__.__name__}")
        playlist_name = item.get('setlist_name') or item.get('name', '').strip()
        self.logger.info(f"🔍 Playlist name: {playlist_name}")
        if not playlist_name or playlist_name in self.processed_items['playlists']:
            self.logger.warning(f"⚠️ Skipping playlist: name={'empty' if not playlist_name else playlist_name}, already_processed={playlist_name in self.processed_items['playlists']}")
            return

        self.processed_items['playlists'].add(playlist_name)
        self.logger.info(f"✅ Processing playlist: {playlist_name} - adding to bronze_playlists batch")

        # Extract validation fields
        tracklist_count = item.get('tracklist_count', item.get('total_tracks', 0))
        scrape_error = item.get('scrape_error')
        parsing_version = item.get('parsing_version', 'unknown')
        source = item.get('data_source') or item.get('source') or item.get('platform') or 'unknown'

        # CRITICAL: Validate tracklist count
        if tracklist_count == 0:
            if scrape_error:
                # Expected failure - log as warning
                self.logger.warning(
                    f"⚠️ Playlist '{playlist_name}' failed to extract tracks: {scrape_error}",
                    extra={
                        'source': source,
                        'source_url': item.get('source_url'),
                        'error': scrape_error,
                        'parsing_version': parsing_version
                    }
                )
            else:
                # UNEXPECTED: 0 tracks with no error = SILENT FAILURE
                self.logger.error(
                    f"🚨 SILENT FAILURE DETECTED: Playlist '{playlist_name}' has 0 tracks with no scrape_error",
                    extra={
                        'source': source,
                        'source_url': item.get('source_url'),
                        'parsing_version': parsing_version,
                        'severity': 'CRITICAL'
                    }
                )
                # Increment critical failure metric
                self.stats['silent_failures'] = self.stats.get('silent_failures', 0) + 1

                # Update Prometheus metric if available
                if METRICS_AVAILABLE:
                    silent_failures.labels(
                        source=source,
                        parsing_version=parsing_version
                    ).inc()

                # Generate synthetic error for DB constraint compliance
                scrape_error = f"Silent failure: 0 tracks extracted by {parsing_version}"

        # Update Prometheus metrics if available
        if METRICS_AVAILABLE:
            playlists_created.labels(
                source=source,
                tracklist_count='0' if tracklist_count == 0 else 'non_zero'
            ).inc()

        # Convert date string to date object if present
        event_date = item.get('set_date') or item.get('playlist_date') or item.get('event_date')
        if event_date and isinstance(event_date, str):
            try:
                # Parse ISO format date string
                if 'T' in event_date:
                    # Full ISO timestamp like '2025-09-29T17:28:42.632833'
                    event_date = datetime.fromisoformat(event_date.replace('Z', '+00:00').split('.')[0]).date()
                else:
                    # Already a date string like '2025-09-29'
                    event_date = datetime.strptime(event_date, '%Y-%m-%d').date()
            except Exception as e:
                self.logger.warning(f"Could not parse date {event_date}: {e}")
                event_date = None
        elif isinstance(event_date, datetime):
            event_date = event_date.date()
        elif not isinstance(event_date, date):
            event_date = None

        # MEDALLION: Add to BRONZE batch (raw data preservation)
        bronze_batch_size_before = len(self.item_batches['bronze_playlists'])
        self.logger.info(
            f"➕ Routing playlist '{playlist_name}' to bronze_playlists batch "
            f"(current size: {bronze_batch_size_before}/{self.batch_size})"
        )
        self.item_batches['bronze_playlists'].append(item)  # Store complete raw item
        bronze_batch_size_after = len(self.item_batches['bronze_playlists'])
        self.logger.info(
            f"📦 Added to bronze_playlists batch "
            f"(new size: {bronze_batch_size_after}/{self.batch_size}) - CONFIRMED: item added (delta={bronze_batch_size_after - bronze_batch_size_before})"
        )

        # MEDALLION: Add to SILVER batch (enriched data)
        silver_playlist = {
            'name': playlist_name,
            'source': source,
            'source_url': item.get('source_url'),
            'playlist_type': item.get('playlist_type') or item.get('event_type'),
            'event_date': event_date,
            'tracklist_count': tracklist_count,
            'scrape_error': scrape_error,
            'last_scrape_attempt': datetime.utcnow(),
            'parsing_version': parsing_version,
            # MEDALLION: Reference to raw data (will be set during flush)
            '_raw_item': item  # Keep reference to get bronze_id later
        }
        self.item_batches['playlists'].append(silver_playlist)

        # Flush bronze if batch full (bronze must flush before silver)
        if len(self.item_batches['bronze_playlists']) >= self.batch_size:
            await self._flush_batch('bronze_playlists')

        if len(self.item_batches['playlists']) >= self.batch_size:
            await self._flush_batch('playlists')

    async def _process_playlist_track_item(self, item: Dict[str, Any]):
        """
        Process playlist track item (position in playlist).

        IMPORTANT: This also extracts and queues the underlying track data,
        since playlist_track items contain both track metadata AND position info.

        Args:
            item: Playlist track item
        """
        # Handle both playlist_name and setlist_name
        playlist_name = (item.get('playlist_name') or item.get('setlist_name', '')).strip()
        track_name = item.get('track_name', '').strip()
        artist_name = item.get('artist_name', '').strip()
        # Handle both position and track_order
        position = item.get('position') or item.get('track_order')

        if not playlist_name:
            self.logger.warning(f"Missing playlist/setlist name in playlist_track item: {item.keys()}")
            return
        if not track_name:
            self.logger.warning(f"Missing track_name in playlist_track item: {item.keys()}")
            return
        if position is None:
            self.logger.warning(f"Missing position/track_order in playlist_track item: {item.keys()}")
            return

        # FIRST: Queue the track itself (so it exists when we create the relationship)
        # Use _process_track_item to handle this properly
        # Generate synthetic track_id for bronze layer (artist::title format)
        synthetic_track_id = f"{artist_name}::{track_name}" if artist_name and track_name else None

        # CRITICAL: Resolve playlist_id from playlist_name for bronze FK relationship
        bronze_playlist_id = self._playlist_id_map.get(playlist_name)
        if not bronze_playlist_id:
            self.logger.warning(
                f"⚠️ Cannot link track to playlist: playlist_name='{playlist_name}' not found in map "
                f"(map size={len(self._playlist_id_map)}, keys={list(self._playlist_id_map.keys())[:5]})"
            )

        await self._process_track_item({
            'track_name': track_name,
            'artist_name': artist_name,
            # CRITICAL: Include source_track_id so bronze layer doesn't skip this track
            'source_track_id': synthetic_track_id,
            'data_source': item.get('source') or item.get('data_source', 'playlist_track'),
            'source_url': item.get('source_url', 'unknown'),
            'normalized_title': item.get('normalized_title', track_name.lower().strip()),
            'normalized_artist': item.get('normalized_artist', artist_name.lower().strip()),
            'duration_seconds': item.get('duration_seconds'),
            'bpm': item.get('bpm'),
            'key': item.get('key'),
            'genre': item.get('genre'),
            'release_year': item.get('release_year'),
            'spotify_id': item.get('spotify_id'),
            'musicbrainz_id': item.get('musicbrainz_id'),
            'soundcloud_id': item.get('soundcloud_id'),
            'beatport_id': item.get('beatport_id'),
            'metadata': item.get('metadata'),
            # CRITICAL: Pass playlist context for bronze_scraped_tracks FK
            '_bronze_playlist_id': bronze_playlist_id,  # FK to bronze_scraped_playlists
            '_track_position': position  # Position in playlist (for transitions)
        })

        # SECOND: Queue the playlist_track relationship
        self.item_batches['playlist_tracks'].append({
            'playlist_name': playlist_name,
            'track_name': track_name,
            'artist_name': artist_name,
            'position': position,
            'source': item.get('source', 'scraped_data')
        })

        if len(self.item_batches['playlist_tracks']) >= self.batch_size:
            await self._flush_batch('playlist_tracks')

    async def _process_adjacency_item(self, item: Dict[str, Any]):
        """
        Process track adjacency item and add to batch.

        Args:
            item: Track adjacency item
        """
        track1 = item.get('track1_name') or item.get('track_1_name', '').strip()
        track2 = item.get('track2_name') or item.get('track_2_name', '').strip()

        if not track1 or not track2 or track1 == track2:
            return

        self.item_batches['song_adjacency'].append({
            'track1_name': track1,
            'track1_artist': item.get('track1_artist') or item.get('track_1_artist', ''),
            'track2_name': track2,
            'track2_artist': item.get('track2_artist') or item.get('track_2_artist', ''),
            'distance': item.get('distance', 1),
            'occurrence_count': item.get('occurrence_count', 1),
            'source_context': item.get('source_context', ''),
            'source_url': item.get('source_url')
        })

        if len(self.item_batches['song_adjacency']) >= self.batch_size:
            await self._flush_batch('song_adjacency')

    def _determine_item_type(self, item: Dict[str, Any]) -> str:
        """
        Determine item type from item data (copied from validation_pipeline.py).

        Args:
            item: Scrapy item

        Returns:
            Item type string
        """
        # Check explicit item_type field
        if 'item_type' in item:
            return item['item_type']

        # Infer from item class name
        if hasattr(item, '__class__'):
            class_name = item.__class__.__name__.lower()
            self.logger.debug(f"Item class name: {class_name}")

            if 'artist' in class_name and 'track' not in class_name:
                return 'artist'
            # Check for setlist-track relationship items BEFORE generic setlist check
            elif ('setlist' in class_name and 'track' in class_name) or 'setlisttrack' in class_name:
                self.logger.info(f"✓ Detected playlist_track from class name: {class_name}")
                return 'playlist_track'
            # CRITICAL FIX: Explicit PlaylistItem detection for bronze_playlists routing
            elif 'playlistitem' in class_name:
                self.logger.info(f"✓ Detected playlist from PlaylistItem class: {class_name}")
                return 'playlist'
            elif 'track' in class_name and 'adjacency' not in class_name and 'artist' not in class_name:
                return 'track'
            # Check for EnhancedSetlistItem (legacy format) - also routes to playlist processing
            elif 'setlist' in class_name or 'enhancedsetlist' in class_name:
                self.logger.debug(f"Detected setlist from class name: {class_name}")
                return 'setlist'
            elif 'adjacency' in class_name:
                return 'track_adjacency'
            elif 'trackartist' in class_name:
                return 'track_artist'

        # Infer from item fields
        if 'artist_name' in item and 'track_name' not in item and 'setlist_name' not in item and 'name' not in item:
            return 'artist'
        elif 'track_name' in item or 'title' in item:
            if 'track1_name' in item or 'track2_name' in item:
                return 'track_adjacency'
            elif 'artist_role' in item:
                return 'track_artist'
            # Check for setlist-track relationship (has both setlist and track fields)
            elif 'setlist_name' in item and 'track_order' in item:
                self.logger.info(f"✓ Detected playlist_track from fields: setlist_name + track_order")
                return 'playlist_track'
            else:
                return 'track'
        # CRITICAL FIX: Explicit PlaylistItem field detection
        # PlaylistItem has 'name' + 'source' + ('dj_name' or 'total_tracks' or 'tracklist_count')
        elif 'name' in item and 'source' in item and ('total_tracks' in item or 'tracklist_count' in item or 'dj_name' in item):
            self.logger.info(f"✓ Detected playlist from fields: name + source + total_tracks/dj_name")
            return 'playlist'
        # EnhancedSetlistItem detection (legacy format with setlist_name or dj_artist_name)
        elif 'setlist_name' in item or ('name' in item and 'dj_artist_name' in item):
            self.logger.debug(f"Detected setlist from fields: setlist_name or name+dj_artist_name")
            return 'setlist'
        elif 'playlist_name' in item and 'position' in item:
            return 'playlist_track'

        return 'unknown'

    async def _flush_batch(self, batch_type: str):
        """
        Flush a specific batch to database.

        For medallion architecture:
        - Bronze batches return bronze_ids for FK linkage
        - Silver batches use bronze_ids if available

        Args:
            batch_type: Type of batch to flush
        """
        batch = self.item_batches[batch_type]
        if not batch:
            self.logger.debug(f"Skipping empty batch: {batch_type}")
            return

        # Determine target table based on batch type
        table_map = {
            'bronze_tracks': 'bronze_scraped_tracks',
            'bronze_playlists': 'bronze_scraped_playlists',
            'artists': 'artists',
            'tracks': 'silver_enriched_tracks',
            'playlists': 'silver_enriched_playlists',
            'playlist_tracks': 'silver_playlist_tracks',
            'song_adjacency': 'song_adjacency'
        }
        target_table = table_map.get(batch_type, batch_type)

        self.logger.info(
            f"📤 Flushing {len(batch)} {batch_type} items to {target_table}..."
        )

        try:
            async with self.connection_pool.acquire() as conn:
                async with conn.transaction():
                    if batch_type == 'bronze_tracks':
                        results = await self._insert_bronze_tracks_batch(conn, batch)
                        # Store bronze_ids in items for silver layer linkage
                        for result in results:
                            result['item']['_bronze_id'] = result['bronze_id']
                    elif batch_type == 'bronze_playlists':
                        results = await self._insert_bronze_playlists_batch(conn, batch)
                        for result in results:
                            result['item']['_bronze_id'] = result['bronze_id']
                    elif batch_type == 'artists':
                        await self._insert_artists_batch(conn, batch)
                    elif batch_type == 'tracks':
                        await self._insert_songs_batch(conn, batch)
                    elif batch_type == 'playlists':
                        await self._insert_playlists_batch(conn, batch)
                    elif batch_type == 'playlist_tracks':
                        await self._insert_playlist_tracks_batch(conn, batch)
                    elif batch_type == 'song_adjacency':
                        await self._insert_song_adjacency_batch(conn, batch)

            self.stats['persisted_items'] += len(batch)
            self.logger.info(
                f"✅ Successfully flushed {len(batch)} {batch_type} items to {target_table} "
                f"(total persisted: {self.stats['persisted_items']})"
            )
            self.item_batches[batch_type] = []

        except Exception as e:
            self.logger.error(f"❌ Error flushing {batch_type} batch to {target_table}: {e}")
            import traceback
            self.logger.error(traceback.format_exc())
            raise

    async def _insert_bronze_tracks_batch(self, conn, batch: List[Dict[str, Any]]):
        """
        Insert raw track data to bronze_scraped_tracks (medallion layer 1).

        Preserves complete raw item data in raw_json for replay capability.
        Returns list of bronze IDs for linking to silver layer.
        """
        import json

        results = []
        skipped_count = 0
        error_count = 0

        for idx, item in enumerate(batch):
            try:
                # Get source metadata with detailed logging for missing values
                source = item.get('data_source') or item.get('source') or item.get('platform') or 'unknown'
                source_url = item.get('source_url', 'unknown')
                source_track_id = item.get('source_track_id') or item.get('track_id')
                scraper_version = item.get('scraper_version', 'v1.0.0')

                # Extract fields for generating synthetic ID if needed
                artist_name = item.get('artist_name', '').strip()
                track_title = item.get('track_name') or item.get('title', '')

                # CRITICAL: Extract playlist context for FK relationship
                # These fields are set by _process_playlist_track_item via _process_track_item
                bronze_playlist_id = item.get('_bronze_playlist_id')  # FK to bronze_scraped_playlists
                track_position = item.get('_track_position')  # Position in playlist

                # CRITICAL FIX: Generate synthetic source_track_id if missing
                # This prevents tracks from being skipped in bronze layer
                if not source_track_id:
                    if artist_name and track_title:
                        # Generate deterministic ID based on artist + title
                        source_track_id = f"{artist_name}::{track_title}"
                        self.logger.debug(
                            f"Bronze track #{idx}: Generated synthetic source_track_id='{source_track_id}'"
                        )
                    else:
                        self.logger.warning(
                            f"⚠️ Bronze track #{idx}: Cannot generate source_track_id - missing artist_name or track_title",
                            extra={
                                'source': source,
                                'artist_name': artist_name,
                                'track_title': track_title
                            }
                        )
                        skipped_count += 1
                        continue

                # Log warnings for default values being used
                if source == 'unknown':
                    self.logger.debug(
                        f"Bronze track #{idx}: Using default source='unknown' (missing data_source/source/platform)"
                    )
                if source_url == 'unknown':
                    self.logger.debug(
                        f"Bronze track #{idx}: Using default source_url='unknown'"
                    )

                # Serialize complete item as raw_json
                try:
                    raw_json = json.dumps(item, default=str)
                except (TypeError, ValueError) as e:
                    self.logger.error(
                        f"❌ Failed to serialize item #{idx} to JSON: {e}",
                        extra={'item_keys': list(item.keys())}
                    )
                    error_count += 1
                    continue

                # Note: artist_name and track_title already extracted above for ID generation

                # Log missing critical fields
                if not artist_name:
                    self.logger.debug(f"Bronze track #{idx}: Missing artist_name")
                if not track_title:
                    self.logger.warning(
                        f"⚠️ Bronze track #{idx}: Missing track_title (track_name AND title are both empty)",
                        extra={'source': source, 'source_track_id': source_track_id}
                    )

                # CRITICAL: Log playlist context before INSERT for debugging
                if bronze_playlist_id or track_position:
                    self.logger.info(
                        f"🔗 Bronze track #{idx} has playlist context: "
                        f"playlist_id={bronze_playlist_id}, position={track_position}, "
                        f"artist='{artist_name}', title='{track_title}'"
                    )

                # Insert with RETURNING id
                # CRITICAL: Include playlist_id and position for FK relationship and transition creation
                bronze_id = await conn.fetchval("""
                    INSERT INTO bronze_scraped_tracks (
                        source, source_url, source_track_id, scraper_version,
                        raw_json, artist_name, track_title, playlist_id, position
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                    ON CONFLICT (source, source_url, source_track_id) DO UPDATE SET
                        raw_json = EXCLUDED.raw_json,
                        artist_name = EXCLUDED.artist_name,
                        track_title = EXCLUDED.track_title,
                        playlist_id = COALESCE(EXCLUDED.playlist_id, bronze_scraped_tracks.playlist_id),
                        position = COALESCE(EXCLUDED.position, bronze_scraped_tracks.position),
                        scraped_at = NOW()
                    RETURNING id
                """, source, source_url, source_track_id, scraper_version, raw_json, artist_name, track_title,
                     bronze_playlist_id, track_position)

                results.append({'item': item, 'bronze_id': bronze_id})

                self.logger.debug(
                    f"✓ Bronze track inserted: {artist_name} - {track_title} (bronze_id={bronze_id})"
                )

            except Exception as e:
                error_count += 1
                self.logger.error(
                    f"❌ Error inserting bronze track #{idx}: {e}",
                    extra={
                        'artist_name': item.get('artist_name'),
                        'track_title': item.get('track_name') or item.get('title'),
                        'source': item.get('data_source'),
                        'error': str(e)
                    },
                    exc_info=True
                )

        self.logger.info(
            f"✓ Inserted {len(results)} tracks to bronze layer "
            f"(skipped={skipped_count}, errors={error_count})"
        )
        return results

    async def _insert_bronze_playlists_batch(self, conn, batch: List[Dict[str, Any]]):
        """
        Insert raw playlist data to bronze_scraped_playlists (medallion layer 1).

        Preserves complete raw item data in raw_json for replay capability.
        Returns list of bronze IDs for linking to silver layer.
        """
        import json

        self.logger.info(f"🔍 _insert_bronze_playlists_batch called with {len(batch)} items")
        results = []
        for idx, item in enumerate(batch):
            self.logger.info(f"🔍 Processing bronze playlist #{idx+1}/{len(batch)}: {item.get('name') or item.get('setlist_name')}")
            # Get source metadata
            source = item.get('data_source') or item.get('source') or item.get('platform') or 'unknown'
            source_url = item.get('source_url', 'unknown')
            source_playlist_id = item.get('source_playlist_id') or item.get('playlist_id') or item.get('setlist_id')
            scraper_version = item.get('scraper_version', 'v1.0.0')

            # Serialize complete item as raw_json
            raw_json = json.dumps(item, default=str)

            # Extract fields for indexing
            playlist_name = item.get('setlist_name') or item.get('name', '')
            artist_name = self._extract_artist_from_playlist_name(playlist_name)
            event_name = item.get('event_name')

            # Parse event_date (datetime already imported at module level, line 27)
            event_date = item.get('set_date') or item.get('playlist_date') or item.get('event_date')
            if event_date and isinstance(event_date, str):
                try:
                    if 'T' in event_date:
                        event_date = datetime.fromisoformat(event_date.replace('Z', '+00:00').split('.')[0]).date()
                    else:
                        event_date = datetime.strptime(event_date, '%Y-%m-%d').date()
                except Exception:
                    event_date = None
            elif isinstance(event_date, datetime):
                event_date = event_date.date()

            # Insert with RETURNING id
            self.logger.info(f"🔍 Executing INSERT for playlist: source={source}, url={source_url}, name={playlist_name}")
            bronze_id = await conn.fetchval("""
                INSERT INTO bronze_scraped_playlists (
                    source, source_url, source_playlist_id, scraper_version,
                    raw_json, playlist_name, artist_name, event_name, event_date
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                ON CONFLICT (source, source_url, source_playlist_id) DO UPDATE SET
                    raw_json = EXCLUDED.raw_json,
                    playlist_name = EXCLUDED.playlist_name,
                    artist_name = EXCLUDED.artist_name,
                    event_name = EXCLUDED.event_name,
                    event_date = EXCLUDED.event_date,
                    scraped_at = NOW()
                RETURNING id
            """, source, source_url, source_playlist_id, scraper_version, raw_json,
                 playlist_name, artist_name, event_name, event_date)

            self.logger.info(f"✅ Successfully inserted playlist to bronze layer: bronze_id={bronze_id}, name={playlist_name}")
            results.append({'item': item, 'bronze_id': bronze_id})

            # CRITICAL: Store playlist context for subsequent track items
            # This allows EnhancedSetlistTrackItem to link to the correct playlist
            self._current_bronze_playlist_id = bronze_id
            self._playlist_id_map[playlist_name] = bronze_id
            # Also store bronze_id in the item for downstream pipeline access
            item['_bronze_id'] = bronze_id
            self.logger.info(
                f"🔗 Stored playlist context: playlist_name='{playlist_name}' -> bronze_id={bronze_id} "
                f"(current_bronze_playlist_id updated, map size={len(self._playlist_id_map)})"
            )

        self.logger.info(f"✓ Inserted {len(results)} playlists to bronze layer (total)")
        return results

    async def _insert_artists_batch(self, conn, batch: List[Dict[str, Any]]):
        """Insert artists batch with upsert logic."""
        await conn.executemany("""
            INSERT INTO artists (name, genres, country, popularity_score, spotify_id, apple_music_id, soundcloud_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (name) DO UPDATE SET
                genres = COALESCE(EXCLUDED.genres, artists.genres),
                country = COALESCE(EXCLUDED.country, artists.country),
                popularity_score = COALESCE(EXCLUDED.popularity_score, artists.popularity_score),
                spotify_id = COALESCE(EXCLUDED.spotify_id, artists.spotify_id),
                apple_music_id = COALESCE(EXCLUDED.apple_music_id, artists.apple_music_id),
                soundcloud_id = COALESCE(EXCLUDED.soundcloud_id, artists.soundcloud_id),
                updated_at = CURRENT_TIMESTAMP
        """, [
            (
                item['name'],
                [item['genre']] if item.get('genre') else None,
                item.get('country'),
                item.get('popularity_score'),
                item.get('spotify_id'),
                item.get('apple_music_id'),
                item.get('soundcloud_id')
            ) for item in batch
        ])

    async def _insert_songs_batch(self, conn, batch: List[Dict[str, Any]]):
        """
        Insert tracks batch to silver_enriched_tracks (medallion architecture).

        MEDALLION SCHEMA: Writes to silver_enriched_tracks with:
        - bronze_id FK linking to bronze_scraped_tracks
        - Required validation fields
        - Denormalized artist_name

        Args:
            batch: List of silver layer track items (with _raw_item reference for bronze_id)
        """
        valid_items = []
        skipped_count = 0

        for idx, item in enumerate(batch):
            # CRITICAL: Validate bronze_id FK reference
            bronze_id = item.get('_raw_item', {}).get('_bronze_id')
            if not bronze_id:
                self.logger.error(
                    f"❌ Silver track #{idx}: Missing bronze_id FK reference! "
                    f"Cannot link to bronze layer. Track: {item.get('artist_name')} - {item.get('track_name') or item.get('title')}",
                    extra={
                        'artist_name': item.get('artist_name'),
                        'track_title': item.get('track_name') or item.get('title'),
                        'has_raw_item': '_raw_item' in item,
                        'raw_item_keys': list(item.get('_raw_item', {}).keys()) if '_raw_item' in item else None
                    }
                )
                skipped_count += 1
                continue

            artist_name = item.get('artist_name') or 'Unknown Artist'
            track_title = item.get('track_name') or item.get('title')

            if not track_title:
                self.logger.warning(
                    f"⚠️ Silver track #{idx}: Missing track_title (bronze_id={bronze_id})",
                    extra={'bronze_id': bronze_id, 'artist_name': artist_name}
                )
                skipped_count += 1
                continue

            # Log warnings for missing optional enrichment fields
            missing_enrichment = []
            if not item.get('spotify_id'):
                missing_enrichment.append('spotify_id')
            if not item.get('bpm'):
                missing_enrichment.append('bpm')
            if not item.get('key') and not item.get('musical_key'):
                missing_enrichment.append('key')
            if item.get('energy') is None:
                missing_enrichment.append('energy')

            if missing_enrichment:
                self.logger.debug(
                    f"Silver track '{artist_name} - {track_title}': Missing enrichment fields: {', '.join(missing_enrichment)}"
                )

            valid_items.append(item)

        if skipped_count > 0:
            self.logger.warning(f"⚠️ Skipped {skipped_count} silver tracks due to missing bronze_id or track_title")

        if not valid_items:
            self.logger.error("❌ No valid silver tracks to insert! All items were skipped.")
            return

        # Insert valid items
        try:
            await conn.executemany("""
                INSERT INTO silver_enriched_tracks (
                    bronze_id, artist_name, track_title, spotify_id, isrc, release_date, duration_ms,
                    bpm, key, genre, energy, valence, danceability,
                    validation_status, data_quality_score, enrichment_metadata
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
            """, [
                (
                    item.get('_raw_item', {}).get('_bronze_id'),  # bronze_id FK (validated above)
                    item.get('artist_name') or 'Unknown Artist',  # artist_name (REQUIRED, denormalized)
                    item.get('track_name') or item.get('title'),  # track_title
                    item.get('spotify_id'),  # spotify_id
                    item.get('isrc'),  # isrc
                    None,  # release_date (TODO: parse from item if available)
                    int(item.get('duration_ms', 0)) if item.get('duration_ms') else None,  # duration_ms
                    float(item.get('bpm')) if item.get('bpm') else None,  # bpm
                    item.get('key') or item.get('musical_key'),  # key
                    [item.get('genre')] if item.get('genre') else None,  # genre[] array
                    float(item.get('energy')) if item.get('energy') is not None else None,  # energy
                    float(item.get('valence')) if item.get('valence') is not None else None,  # valence
                    float(item.get('danceability')) if item.get('danceability') is not None else None,  # danceability
                    'valid',  # validation_status (REQUIRED)
                    self._calculate_quality_score(item),  # data_quality_score (REQUIRED)
                    '{}'  # enrichment_metadata (REQUIRED JSONB, empty for now)
                ) for item in valid_items
            ])

            self.logger.info(f"✓ Inserted {len(valid_items)} silver tracks (skipped={skipped_count})")

        except Exception as e:
            self.logger.error(
                f"❌ Failed to insert silver tracks batch: {e}",
                extra={
                    'batch_size': len(valid_items),
                    'error': str(e)
                },
                exc_info=True
            )
            raise

    def _calculate_quality_score(self, item: Dict[str, Any]) -> float:
        """Calculate data quality score based on field completeness (0.00-1.00)."""
        score = 0.0
        # Critical fields (40% weight)
        if item.get('track_name') or item.get('title'):
            score += 0.20
        if item.get('artist_name'):
            score += 0.20
        # Important fields (40% weight)
        if item.get('bpm'):
            score += 0.10
        if item.get('key') or item.get('musical_key'):
            score += 0.10
        if item.get('energy') is not None:
            score += 0.10
        if item.get('spotify_id'):
            score += 0.10
        # Optional fields (20% weight)
        if item.get('genre'):
            score += 0.05
        if item.get('duration_ms'):
            score += 0.05
        if item.get('valence') is not None:
            score += 0.05
        if item.get('danceability') is not None:
            score += 0.05
        return min(1.0, score)

    def _extract_artist_from_playlist_name(self, playlist_name: str) -> str:
        """
        Extract artist/DJ name from playlist name.

        Common patterns:
        - "2009-04-25 - John B @ Luxor, Arnhem (John B Podcast 066)"
        - "2015-02-13 - Annie Mac, Axwell & Ingrosso - Mash Up"

        Returns artist name or "Unknown DJ" if parsing fails.
        """
        try:
            # Split on " - " and take the second part
            parts = playlist_name.split(' - ', 2)
            if len(parts) >= 2:
                # Second part contains artist, potentially with venue/event
                artist_part = parts[1]
                # Remove venue (after @) or event details
                if ' @ ' in artist_part:
                    artist_part = artist_part.split(' @ ')[0]
                elif '(' in artist_part:
                    artist_part = artist_part.split('(')[0]

                artist_name = artist_part.strip()
                if artist_name:
                    return artist_name
        except Exception:
            pass
        return "Unknown DJ"

    def _calculate_playlist_quality_score(self, item: Dict[str, Any]) -> float:
        """Calculate playlist quality score based on completeness (0.00-1.00)."""
        score = 0.0
        # Critical fields (60% weight)
        if item.get('name'):
            score += 0.30
        if item.get('tracklist_count', 0) > 0:
            score += 0.30
        # Important fields (30% weight)
        if item.get('source'):
            score += 0.15
        if item.get('event_date'):
            score += 0.15
        # Optional fields (10% weight)
        if item.get('source_url'):
            score += 0.05
        if item.get('playlist_type'):
            score += 0.05
        return min(1.0, score)

    async def _insert_playlists_batch(self, conn, batch: List[Dict[str, Any]]):
        """
        Insert playlists batch to silver_enriched_playlists (medallion architecture).

        MEDALLION SCHEMA: Writes to silver_enriched_playlists with:
        - bronze_id FK linking to bronze_scraped_playlists
        - Required validation fields
        - Denormalized artist_name

        NOTE: Artist name is extracted from playlist name as a temporary solution.
        TODO: Update spiders to extract artist_name/dj_name as a separate field.

        Args:
            batch: List of silver layer playlist items (with _raw_item reference for bronze_id)
        """
        await conn.executemany("""
            INSERT INTO silver_enriched_playlists (
                bronze_id, playlist_name, artist_name, event_date, track_count,
                validation_status, data_quality_score, enrichment_metadata
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        """, [
            (
                item.get('_raw_item', {}).get('_bronze_id'),  # bronze_id FK (links to raw data)
                item.get('name'),  # playlist_name (REQUIRED)
                self._extract_artist_from_playlist_name(item.get('name', '')),  # artist_name (parsed from name)
                item.get('event_date'),  # event_date (optional)
                item.get('tracklist_count', 0),  # track_count
                'valid' if item.get('tracklist_count', 0) > 0 else 'failed',  # validation_status (constraint allows: valid, warning, needs_review, failed)
                self._calculate_playlist_quality_score(item),  # data_quality_score
                '{}'  # enrichment_metadata (REQUIRED JSONB, empty for now)
            ) for item in batch
        ])

    async def _insert_playlist_tracks_batch(self, conn, batch: List[Dict[str, Any]]):
        """
        Insert playlist tracks batch to silver_playlist_tracks (medallion architecture).

        MEDALLION SCHEMA: Writes to silver_playlist_tracks using UUID foreign keys.
        Requires playlists and tracks to exist in medallion tables first.
        """
        success_count = 0
        missing_playlist_count = 0
        missing_track_count = 0
        error_count = 0

        for idx, item in enumerate(batch):
            try:
                # Handle both playlist_name and setlist_name
                playlist_name = item.get('playlist_name') or item.get('setlist_name')
                if not playlist_name:
                    self.logger.warning(
                        f"❌ Playlist track #{idx}: Missing playlist_name/setlist_name",
                        extra={'item_keys': list(item.keys())}
                    )
                    error_count += 1
                    continue

                # Handle both position and track_order
                position = item.get('position') or item.get('track_order')
                if position is None:
                    self.logger.warning(
                        f"❌ Playlist track #{idx}: Missing position/track_order for playlist '{playlist_name}'",
                        extra={'playlist_name': playlist_name, 'item_keys': list(item.keys())}
                    )
                    error_count += 1
                    continue

                track_name = item.get('track_name')
                artist_name = item.get('artist_name', 'Unknown Artist')

                if not track_name:
                    self.logger.warning(
                        f"❌ Playlist track #{idx}: Missing track_name (playlist='{playlist_name}', position={position})"
                    )
                    error_count += 1
                    continue

                # Get playlist ID from medallion table
                playlist_result = await conn.fetchrow(
                    "SELECT id FROM silver_enriched_playlists WHERE playlist_name = $1 LIMIT 1",
                    playlist_name
                )

                if not playlist_result:
                    self.logger.warning(
                        f"⚠️ Playlist track #{idx}: Playlist not found in silver_enriched_playlists: '{playlist_name}'",
                        extra={
                            'playlist_name': playlist_name,
                            'track_name': track_name,
                            'position': position
                        }
                    )
                    missing_playlist_count += 1
                    continue

                # Get track ID from medallion table (match by artist_name + track_title for better accuracy)
                track_result = await conn.fetchrow(
                    "SELECT id FROM silver_enriched_tracks WHERE track_title = $1 AND artist_name = $2 LIMIT 1",
                    track_name,
                    artist_name
                )

                if not track_result:
                    self.logger.warning(
                        f"⚠️ Playlist track #{idx}: Track not found in silver_enriched_tracks: '{artist_name} - {track_name}'",
                        extra={
                            'playlist_name': playlist_name,
                            'artist_name': artist_name,
                            'track_name': track_name,
                            'position': position
                        }
                    )
                    missing_track_count += 1
                    continue

                # Insert playlist track (with upsert on conflict)
                await conn.execute("""
                    INSERT INTO silver_playlist_tracks (playlist_id, track_id, position, cue_time_ms)
                    VALUES ($1, $2, $3, $4)
                    ON CONFLICT (playlist_id, track_id, position) DO UPDATE SET
                        cue_time_ms = EXCLUDED.cue_time_ms
                """,
                    playlist_result['id'],
                    track_result['id'],
                    position,
                    item.get('cue_time_ms')  # Optional cue time
                )

                success_count += 1
                self.logger.debug(
                    f"✓ Playlist track inserted: '{playlist_name}' position {position}: {artist_name} - {track_name}"
                )

            except Exception as e:
                error_count += 1
                self.logger.error(
                    f"❌ Error inserting playlist track #{idx}: {e}",
                    extra={
                        'playlist_name': item.get('playlist_name') or item.get('setlist_name'),
                        'track_name': item.get('track_name'),
                        'artist_name': item.get('artist_name'),
                        'position': item.get('position') or item.get('track_order'),
                        'error': str(e)
                    },
                    exc_info=True
                )

        self.logger.info(
            f"✓ Inserted {success_count} playlist tracks "
            f"(missing_playlist={missing_playlist_count}, missing_track={missing_track_count}, errors={error_count})"
        )

    async def _insert_song_adjacency_batch(self, conn, batch: List[Dict[str, Any]]):
        """
        Insert track adjacency batch (transitions/edges) to song_adjacency table.

        Handles EnhancedTrackAdjacencyItem objects yielded by spiders.

        Args:
            conn: Database connection
            batch: List of adjacency item dicts
        """
        self.logger.info(f"🔍 Processing {len(batch)} song_adjacency items for insertion")

        adjacencies_with_ids = []
        skipped_count = 0

        for idx, item in enumerate(batch):
            try:
                # Extract track names - handle various field naming conventions
                track1_name = item.get('track_1_name') or item.get('track1_name') or item.get('source_track_name', '').strip()
                track2_name = item.get('track_2_name') or item.get('track2_name') or item.get('target_track_name', '').strip()

                if not track1_name or not track2_name:
                    self.logger.warning(
                        f"⚠️ Adjacency #{idx}: Missing track names (track1='{track1_name}', track2='{track2_name}')"
                    )
                    skipped_count += 1
                    continue

                # Look up track IDs from silver_enriched_tracks (medallion architecture)
                track1_result = await conn.fetchrow(
                    "SELECT id FROM silver_enriched_tracks WHERE track_title = $1 LIMIT 1",
                    track1_name
                )
                track2_result = await conn.fetchrow(
                    "SELECT id FROM silver_enriched_tracks WHERE track_title = $1 LIMIT 1",
                    track2_name
                )

                if track1_result and track2_result:
                    source_track_id = track1_result['id']
                    target_track_id = track2_result['id']

                    # Extract metadata
                    occurrence_count = item.get('occurrence_count', 1)
                    distance = item.get('distance', 1)
                    weight = 1.0 / float(distance) if distance > 0 else 1.0  # Inverse distance weighting
                    source = item.get('data_source') or item.get('source', 'scraped')

                    adjacencies_with_ids.append({
                        'source_track_id': source_track_id,
                        'target_track_id': target_track_id,
                        'occurrence_count': occurrence_count,
                        'weight': weight,
                        'source': source
                    })

                    self.logger.debug(
                        f"✓ Adjacency #{idx}: {track1_name} → {track2_name} "
                        f"(distance={distance}, weight={weight:.3f})"
                    )
                else:
                    skipped_count += 1
                    if not track1_result:
                        self.logger.debug(f"Track not found in silver_enriched_tracks: '{track1_name}'")
                    if not track2_result:
                        self.logger.debug(f"Track not found in silver_enriched_tracks: '{track2_name}'")

            except Exception as e:
                skipped_count += 1
                self.logger.error(
                    f"❌ Error processing adjacency #{idx}: {e}",
                    extra={
                        'track1_name': item.get('track_1_name') or item.get('track1_name'),
                        'track2_name': item.get('track_2_name') or item.get('track2_name'),
                        'error': str(e)
                    },
                    exc_info=True
                )

        if adjacencies_with_ids:
            self.logger.info(
                f"✅ Inserting {len(adjacencies_with_ids)} song_adjacency records "
                f"({skipped_count} skipped due to missing tracks)"
            )

            try:
                await conn.executemany("""
                    INSERT INTO song_adjacency (
                        source_track_id, target_track_id, occurrence_count, weight, source
                    )
                    VALUES ($1, $2, $3, $4, $5)
                    ON CONFLICT (source_track_id, target_track_id) DO UPDATE SET
                        occurrence_count = song_adjacency.occurrence_count + EXCLUDED.occurrence_count,
                        weight = (song_adjacency.weight * song_adjacency.occurrence_count +
                                  EXCLUDED.weight * EXCLUDED.occurrence_count) /
                                 (song_adjacency.occurrence_count + EXCLUDED.occurrence_count),
                        updated_at = CURRENT_TIMESTAMP
                """, [
                    (
                        item['source_track_id'],
                        item['target_track_id'],
                        item['occurrence_count'],
                        item['weight'],
                        item['source']
                    ) for item in adjacencies_with_ids
                ])

                self.logger.info(f"✓ Successfully inserted {len(adjacencies_with_ids)} song_adjacency records")

            except Exception as e:
                self.logger.error(
                    f"❌ Failed to insert song_adjacency batch: {e}",
                    extra={'batch_size': len(adjacencies_with_ids)},
                    exc_info=True
                )
                raise
        else:
            self.logger.warning(
                f"⚠️ No song_adjacency records inserted! {skipped_count} items skipped (tracks not found in DB)"
            )

    async def flush_all_batches(self):
        """
        Flush all batches to database in dependency order.

        Thread-safe via async lock to prevent concurrent flushes
        from periodic task and manual flush calls.

        Each batch flush is wrapped in try-except to ensure one failing
        batch doesn't prevent other batches from being persisted.

        IMPORTANT: Flush order matters for medallion architecture!
        Bronze layer MUST be flushed before silver to establish FK linkage.

        Flush order:
        1. Bronze layer (raw data, returns bronze_ids)
        2. Legacy/lookup tables (artists)
        3. Silver layer (enriched data, references bronze_ids)
        4. Junction tables (playlist_tracks)
        5. Track adjacency (song_adjacency, explicit spider yields)
        """
        # Define flush order to respect foreign key dependencies
        # CRITICAL: Bronze before silver for medallion architecture
        flush_order = [
            'bronze_tracks',      # 1. Bronze layer tracks (raw data)
            'bronze_playlists',   # 2. Bronze layer playlists (raw data)
            'artists',            # 3. Legacy artists table
            'tracks',             # 4. Silver layer tracks (links to bronze via bronze_id)
            'playlists',          # 5. Silver layer playlists (links to bronze via bronze_id)
            'playlist_tracks'     # 6. Junction table (triggers adjacency via DB triggers),
            'song_adjacency'      # 7. Track adjacency/transitions (depends on tracks existing)
        ]

        for batch_type in flush_order:
            if batch_type not in self.item_batches:
                continue

            try:
                # Shield the flush operation from cancellation to ensure data persistence
                await asyncio.shield(self._flush_batch(batch_type))
            except asyncio.CancelledError:
                # Task was cancelled - log but allow to continue to other batches
                self.logger.warning(f"⚠️ Flush of {batch_type} batch was cancelled - batch may be incomplete")
                # Don't clear batch - retry on next flush
            except (GeneratorExit, KeyboardInterrupt, SystemExit):
                # Don't catch these - they indicate shutdown/cancellation
                raise
            except Exception as e:
                self.logger.error(f"Error flushing {batch_type} batch (continuing with other batches): {e}")
                import traceback
                self.logger.error(traceback.format_exc())
                # Clear the failed batch to prevent retry loops
                self.item_batches[batch_type] = []

    def close_spider(self, spider: Spider):
        """
        Clean up when spider closes and log persistence statistics.

        Uses separate thread with event loop to avoid Twisted/asyncio conflicts.

        Args:
            spider: Spider instance
        """
        self.logger.info("=" * 80)
        self.logger.info("🔄 close_spider called - flushing remaining batches before stopping thread...")
        self.logger.info("=" * 80)
        try:
            # Log batch sizes before flushing
            with self._flushing_lock:
                total_pending = 0
                for batch_type, batch in self.item_batches.items():
                    if batch:
                        self.logger.info(f"  📦 Pending {batch_type}: {len(batch)} items")
                        total_pending += len(batch)
                    else:
                        self.logger.debug(f"  📭 Empty batch: {batch_type}")
                self.logger.info(f"  📊 Total pending items across all batches: {total_pending}")

            # CRITICAL: Do final flush BEFORE stopping the thread
            # The persistent thread's event loop must still be running to execute the flush
            if self._persistent_loop and self.connection_pool and self.flush_thread and self.flush_thread.is_alive():
                try:
                    # Use asyncio.run_coroutine_threadsafe to schedule in the persistent thread's loop
                    import concurrent.futures
                    import time
                    self.logger.info("Scheduling final flush_all_batches() in persistent loop...")
                    future = asyncio.run_coroutine_threadsafe(
                        self.flush_all_batches(),
                        self._persistent_loop
                    )
                    # Wait for completion with MUCH longer timeout to handle large batches
                    self.logger.info("Waiting for flush completion (timeout: 300s)...")
                    future.result(timeout=300)
                    # Give extra time for database commits to fully complete
                    time.sleep(0.5)
                    self.logger.info("✓ All batches flushed successfully")
                except concurrent.futures.TimeoutError:
                    self.logger.error("❌ Timeout waiting for final batch flush")
                except Exception as e:
                    self.logger.error(f"❌ Error during final flush: {e}")
                    import traceback
                    self.logger.error(traceback.format_exc())
            else:
                self.logger.warning("⚠️ No persistent loop or connection pool - skipping final flush")

            # NOW stop the periodic flushing thread
            if self.flush_thread and self.flush_thread.is_alive():
                self.logger.info("Stopping periodic flush thread...")
                self._stop_flushing.set()
                self.flush_thread.join(timeout=5.0)
                if self.flush_thread.is_alive():
                    self.logger.warning("Periodic flush thread did not stop gracefully")
                else:
                    self.logger.info("✓ Periodic flush thread stopped")

            # Log persistence statistics
            self.logger.info("=" * 80)
            self.logger.info("PERSISTENCE PIPELINE STATISTICS")
            self.logger.info("=" * 80)
            self.logger.info(f"  Spider: {spider.name}")
            self.logger.info(f"  Total items processed: {self.stats['total_items']}")
            self.logger.info(f"  ✅ Items persisted: {self.stats['persisted_items']}")
            self.logger.info(f"  ❌ Items failed: {self.stats['failed_items']}")
            self.logger.info(f"  🚨 Silent failures detected: {self.stats.get('silent_failures', 0)}")

            # Calculate persistence rate
            if self.stats['total_items'] > 0:
                persistence_rate = (self.stats['persisted_items'] / self.stats['total_items']) * 100
                self.logger.info(f"  📈 Persistence success rate: {persistence_rate:.2f}%")

            # Log statistics by item type
            if self.stats['items_by_type']:
                self.logger.info("")
                self.logger.info("  Items by type:")
                for item_type, count in self.stats['items_by_type'].items():
                    self.logger.info(f"    {item_type}: {count}")

            self.logger.info("=" * 80)

            # Close connection pool using the persistent thread's event loop
            if self.connection_pool and self._persistent_loop:
                try:
                    import concurrent.futures
                    future = asyncio.run_coroutine_threadsafe(
                        self.connection_pool.close(),
                        self._persistent_loop
                    )
                    future.result(timeout=10)
                    self.logger.info("✓ Database connection pool closed successfully")
                except Exception as e:
                    self.logger.error(f"Error closing connection pool: {e}")

            # Gracefully shutdown the persistent event loop
            if self._persistent_loop:
                try:
                    # Cancel all pending tasks in the loop
                    def cancel_pending_tasks():
                        pending = asyncio.all_tasks(loop=self._persistent_loop)
                        if pending:
                            self.logger.info(f"Cancelling {len(pending)} pending asyncio tasks...")
                            for task in pending:
                                task.cancel()
                            # Wait for tasks to finish cancellation
                            return asyncio.gather(*pending, return_exceptions=True)
                        return None

                    # Schedule task cancellation in the persistent loop
                    import concurrent.futures
                    future = asyncio.run_coroutine_threadsafe(
                        cancel_pending_tasks() or asyncio.sleep(0),
                        self._persistent_loop
                    )
                    # Wait for cancellation to complete (with short timeout)
                    try:
                        future.result(timeout=2.0)
                        self.logger.info("✓ All pending tasks cancelled")
                    except concurrent.futures.TimeoutError:
                        self.logger.warning("⚠️ Timeout cancelling tasks, forcing shutdown")

                    # Now stop the event loop
                    self._persistent_loop.call_soon_threadsafe(self._persistent_loop.stop)
                    self.logger.info("✓ Persistent event loop stopped")
                except Exception as e:
                    self.logger.error(f"Error shutting down event loop: {e}")

            self.logger.info("✓ Persistence pipeline closed successfully")

        except Exception as e:
            self.logger.error(f"❌ Error closing persistence pipeline: {e}")
