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

logger = logging.getLogger(__name__)


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
            'artists': [],
            'songs': [],
            'playlists': [],
            'playlist_tracks': [],
            'song_adjacency': []
        }

        # Track processed items to avoid duplicates within same scraping session
        self.processed_items = {
            'artists': set(),
            'songs': set(),
            'playlists': set()
        }

        # Statistics for observability
        self.stats = {
            'total_items': 0,
            'persisted_items': 0,
            'failed_items': 0,
            'items_by_type': {}
        }

        # Periodic flushing to bypass Scrapy/Twisted async close_spider() issue
        self.flush_interval = 10  # seconds
        self.flush_thread: Optional[threading.Thread] = None
        self._stop_flushing = threading.Event()
        self._flushing_lock = threading.Lock()

    def _periodic_flush_thread_target(self):
        """
        Background thread that periodically flushes batches to database.

        Runs in its own thread with its own asyncio event loop to bypass
        Scrapy's Twisted reactor async incompatibility. Ensures data is saved
        even if close_spider() fails.
        """
        # Create new event loop for this thread
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

        self.logger.info(f"🔄 Starting periodic batch flushing thread (every {self.flush_interval} seconds)")

        try:
            while not self._stop_flushing.is_set():
                # Wait for flush interval or stop signal
                if self._stop_flushing.wait(timeout=self.flush_interval):
                    # Stop signal received
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
        finally:
            loop.close()

    def open_spider(self, spider: Spider):
        """
        Initialize connection pool when spider starts.

        Uses a separate thread with its own event loop to avoid Twisted/asyncio conflicts.

        Args:
            spider: Spider instance
        """
        def init_pool():
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                connection_string = (
                    f"postgresql://{self.config['user']}:{self.config['password']}"
                    f"@{self.config['host']}:{self.config['port']}/{self.config['database']}"
                )
                self.connection_pool = loop.run_until_complete(asyncpg.create_pool(
                    connection_string,
                    min_size=5,
                    max_size=15,
                    command_timeout=30,
                    max_queries=50000,
                    max_inactive_connection_lifetime=1800,
                    server_settings={
                        'statement_timeout': '30000',
                        'idle_in_transaction_session_timeout': '300000'
                    }
                ))
                self.logger.info("✓ Database connection pool initialized")
            except Exception as e:
                self.logger.error(f"Failed to initialize database connection pool: {e}")
                raise
            finally:
                # Don't close loop - connection pool needs it
                pass

        # Initialize pool in separate thread to avoid Twisted/asyncio conflicts
        init_thread = threading.Thread(target=init_pool)
        init_thread.start()
        init_thread.join()  # Wait for initialization to complete

        # Start periodic flushing thread
        self._stop_flushing.clear()
        self.flush_thread = threading.Thread(
            target=self._periodic_flush_thread_target,
            daemon=True,
            name="PersistencePipelineFlushThread"
        )
        self.flush_thread.start()
        self.logger.info("✓ Periodic flushing thread started")

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

            item_type = item.get('item_type')

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
                self.logger.warning(f"Unknown item type: {item_type}")
                return item

            # Track statistics
            if item_type not in self.stats['items_by_type']:
                self.stats['items_by_type'][item_type] = 0
            self.stats['items_by_type'][item_type] += 1

            # Log successful processing
            self.logger.debug(
                f"✓ Queued {item_type} item: "
                f"{item.get('artist_name') or item.get('track_name') or item.get('setlist_name', 'unknown')}"
            )

            return item

        except Exception as e:
            self.stats['failed_items'] += 1
            self.logger.error(f"Error processing item: {e}")
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
        Process track/song item and add to batch.

        Args:
            item: Track item
        """
        track_name = item.get('track_name') or item.get('title', '').strip()
        if not track_name:
            return

        track_key = f"{track_name}::{item.get('artist_name', '')}"
        if track_key in self.processed_items['songs']:
            return

        self.processed_items['songs'].add(track_key)

        # First ensure artist exists
        artist_name = item.get('artist_name', '').strip()
        if artist_name and artist_name not in self.processed_items['artists']:
            await self._process_artist_item({'artist_name': artist_name, 'genre': item.get('genre')})

        self.item_batches['songs'].append({
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
            'popularity_score': item.get('popularity_score')
        })

        if len(self.item_batches['songs']) >= self.batch_size:
            await self._flush_batch('songs')

    async def _process_playlist_item(self, item: Dict[str, Any]):
        """
        Process playlist/setlist item and add to batch.

        Args:
            item: Playlist item
        """
        playlist_name = item.get('setlist_name') or item.get('name', '').strip()
        if not playlist_name or playlist_name in self.processed_items['playlists']:
            return

        self.processed_items['playlists'].add(playlist_name)

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

        self.item_batches['playlists'].append({
            'name': playlist_name,
            'source': item.get('data_source') or item.get('source') or item.get('platform') or 'unknown',
            'source_url': item.get('source_url'),
            'playlist_type': item.get('playlist_type') or item.get('event_type'),
            'event_date': event_date
        })

        if len(self.item_batches['playlists']) >= self.batch_size:
            await self._flush_batch('playlists')

    async def _process_playlist_track_item(self, item: Dict[str, Any]):
        """
        Process playlist track item (position in playlist).

        Args:
            item: Playlist track item
        """
        playlist_name = item.get('playlist_name', '').strip()
        track_name = item.get('track_name', '').strip()
        position = item.get('position')

        if not playlist_name or not track_name or position is None:
            return

        self.item_batches['playlist_tracks'].append({
            'playlist_name': playlist_name,
            'track_name': track_name,
            'artist_name': item.get('artist_name', ''),
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

    async def _flush_batch(self, batch_type: str):
        """
        Flush a specific batch to database.

        Args:
            batch_type: Type of batch to flush
        """
        batch = self.item_batches[batch_type]
        if not batch:
            return

        try:
            async with self.connection_pool.acquire() as conn:
                async with conn.transaction():
                    if batch_type == 'artists':
                        await self._insert_artists_batch(conn, batch)
                    elif batch_type == 'songs':
                        await self._insert_songs_batch(conn, batch)
                    elif batch_type == 'playlists':
                        await self._insert_playlists_batch(conn, batch)
                    elif batch_type == 'playlist_tracks':
                        await self._insert_playlist_tracks_batch(conn, batch)
                    elif batch_type == 'song_adjacency':
                        await self._insert_adjacency_batch(conn, batch)

            self.stats['persisted_items'] += len(batch)
            self.logger.info(f"✓ Flushed {len(batch)} {batch_type} items to database")
            self.item_batches[batch_type] = []

        except Exception as e:
            self.logger.error(f"Error flushing {batch_type} batch: {e}")
            raise

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
        """Insert songs batch with upsert logic."""
        # First, get artist IDs for songs that have artists
        songs_with_artists = []
        for item in batch:
            primary_artist_id = None
            if item.get('artist_name'):
                try:
                    result = await conn.fetchrow(
                        "SELECT artist_id FROM artists WHERE name = $1",
                        item['artist_name']
                    )
                    if result:
                        primary_artist_id = result['artist_id']
                except Exception as e:
                    self.logger.warning(f"Could not find artist ID for {item.get('artist_name')}: {e}")

            songs_with_artists.append({
                **item,
                'primary_artist_id': primary_artist_id
            })

        await conn.executemany("""
            INSERT INTO songs (track_id, title, primary_artist_id, genre, bpm, key,
                             duration_seconds, release_year, label, spotify_id, musicbrainz_id,
                             tidal_id, beatport_id, apple_music_id, soundcloud_id, deezer_id, youtube_music_id,
                             energy, danceability, valence, acousticness, instrumentalness,
                             liveness, speechiness, loudness, normalized_title, popularity_score,
                             is_remix, is_mashup, is_live, is_cover, is_instrumental, is_explicit)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,
                    $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33)
            ON CONFLICT (title, primary_artist_id) DO UPDATE SET
                track_id = COALESCE(EXCLUDED.track_id, songs.track_id),
                genre = COALESCE(EXCLUDED.genre, songs.genre),
                bpm = COALESCE(EXCLUDED.bpm, songs.bpm),
                key = COALESCE(EXCLUDED.key, songs.key),
                duration_seconds = COALESCE(EXCLUDED.duration_seconds, songs.duration_seconds),
                release_year = COALESCE(EXCLUDED.release_year, songs.release_year),
                label = COALESCE(EXCLUDED.label, songs.label),
                spotify_id = COALESCE(EXCLUDED.spotify_id, songs.spotify_id),
                musicbrainz_id = COALESCE(EXCLUDED.musicbrainz_id, songs.musicbrainz_id),
                tidal_id = COALESCE(EXCLUDED.tidal_id, songs.tidal_id),
                beatport_id = COALESCE(EXCLUDED.beatport_id, songs.beatport_id),
                apple_music_id = COALESCE(EXCLUDED.apple_music_id, songs.apple_music_id),
                soundcloud_id = COALESCE(EXCLUDED.soundcloud_id, songs.soundcloud_id),
                deezer_id = COALESCE(EXCLUDED.deezer_id, songs.deezer_id),
                youtube_music_id = COALESCE(EXCLUDED.youtube_music_id, songs.youtube_music_id),
                energy = COALESCE(EXCLUDED.energy, songs.energy),
                danceability = COALESCE(EXCLUDED.danceability, songs.danceability),
                valence = COALESCE(EXCLUDED.valence, songs.valence),
                acousticness = COALESCE(EXCLUDED.acousticness, songs.acousticness),
                instrumentalness = COALESCE(EXCLUDED.instrumentalness, songs.instrumentalness),
                liveness = COALESCE(EXCLUDED.liveness, songs.liveness),
                speechiness = COALESCE(EXCLUDED.speechiness, songs.speechiness),
                loudness = COALESCE(EXCLUDED.loudness, songs.loudness),
                normalized_title = COALESCE(EXCLUDED.normalized_title, songs.normalized_title),
                popularity_score = COALESCE(EXCLUDED.popularity_score, songs.popularity_score),
                updated_at = CURRENT_TIMESTAMP
        """, [
            (
                item.get('track_id'),
                item['title'],
                item.get('primary_artist_id'),
                item.get('genre'),
                item.get('bpm'),
                item.get('key'),
                item.get('duration_seconds', 0),
                int(item.get('release_year')) if item.get('release_year') else None,
                item.get('label'),
                item.get('spotify_id'),
                item.get('musicbrainz_id'),
                item.get('tidal_id'),
                item.get('beatport_id'),
                item.get('apple_music_id'),
                item.get('soundcloud_id'),
                item.get('deezer_id'),
                item.get('youtube_music_id'),
                # Audio features
                item.get('energy'),
                item.get('danceability'),
                item.get('valence'),
                item.get('acousticness'),
                item.get('instrumentalness'),
                item.get('liveness'),
                item.get('speechiness'),
                item.get('loudness'),
                # Additional metadata
                item.get('normalized_title') or item['title'].lower().strip(),
                item.get('popularity_score'),
                item.get('is_remix', False),
                item.get('is_mashup', False),
                item.get('is_live', False),
                item.get('is_cover', False),
                item.get('is_instrumental', False),
                item.get('is_explicit', False)
            ) for item in songs_with_artists
        ])

    async def _insert_playlists_batch(self, conn, batch: List[Dict[str, Any]]):
        """Insert playlists batch with conflict handling."""
        # Check if playlists already exist first
        for item in batch:
            existing = await conn.fetchval(
                "SELECT playlist_id FROM playlists WHERE name = $1 AND source = $2",
                item['name'], item.get('source', 'scraped_data')
            )
            if not existing:
                await conn.execute("""
                    INSERT INTO playlists (name, source, source_url, playlist_type, event_date)
                    VALUES ($1, $2, $3, $4, $5)
                """,
                    item['name'],
                    item.get('source', 'scraped_data'),
                    item.get('source_url'),
                    item.get('playlist_type'),
                    item.get('event_date')
                )

    async def _insert_playlist_tracks_batch(self, conn, batch: List[Dict[str, Any]]):
        """Insert playlist tracks batch with upsert logic."""
        for item in batch:
            try:
                # Get playlist ID
                playlist_result = await conn.fetchrow(
                    "SELECT playlist_id FROM playlists WHERE name = $1 AND source = $2",
                    item['playlist_name'], item.get('source', 'scraped_data')
                )

                if not playlist_result:
                    self.logger.warning(f"Playlist not found: {item['playlist_name']}")
                    continue

                # Get song ID
                song_result = await conn.fetchrow(
                    "SELECT song_id FROM songs WHERE title = $1 LIMIT 1",
                    item['track_name']
                )

                if not song_result:
                    self.logger.warning(f"Song not found: {item['track_name']}")
                    continue

                # Insert playlist track
                await conn.execute("""
                    INSERT INTO playlist_tracks (playlist_id, position, song_id)
                    VALUES ($1, $2, $3)
                    ON CONFLICT (playlist_id, position) DO UPDATE SET
                        song_id = EXCLUDED.song_id
                """,
                    playlist_result['playlist_id'],
                    item['position'],
                    song_result['song_id']
                )

            except Exception as e:
                self.logger.warning(
                    f"Could not insert playlist track {item['track_name']} at position {item['position']}: {e}"
                )

    async def _insert_adjacency_batch(self, conn, batch: List[Dict[str, Any]]):
        """Insert song adjacency batch with upsert logic."""
        # Get song IDs for adjacencies
        adjacencies_with_ids = []
        for item in batch:
            try:
                song1_result = await conn.fetchrow(
                    "SELECT song_id FROM songs WHERE title = $1 LIMIT 1",
                    item['track1_name']
                )
                song2_result = await conn.fetchrow(
                    "SELECT song_id FROM songs WHERE title = $1 LIMIT 1",
                    item['track2_name']
                )

                if song1_result and song2_result:
                    # Ensure song_id_1 < song_id_2 for the CHECK constraint
                    id1, id2 = song1_result['song_id'], song2_result['song_id']
                    if str(id1) > str(id2):
                        id1, id2 = id2, id1

                    adjacencies_with_ids.append({
                        'song_id_1': id1,
                        'song_id_2': id2,
                        'occurrence_count': item.get('occurrence_count', 1),
                        'avg_distance': item.get('distance', 1.0)
                    })
            except Exception as e:
                self.logger.warning(f"Could not create adjacency for {item['track1_name']} -> {item['track2_name']}: {e}")

        if adjacencies_with_ids:
            await conn.executemany("""
                INSERT INTO song_adjacency (song_id_1, song_id_2, occurrence_count, avg_distance)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (song_id_1, song_id_2) DO UPDATE SET
                    occurrence_count = song_adjacency.occurrence_count + EXCLUDED.occurrence_count,
                    avg_distance = ((COALESCE(song_adjacency.avg_distance, 0) * song_adjacency.occurrence_count) +
                                    (EXCLUDED.avg_distance * EXCLUDED.occurrence_count)) /
                                   (song_adjacency.occurrence_count + EXCLUDED.occurrence_count)
            """, [
                (
                    item['song_id_1'],
                    item['song_id_2'],
                    item['occurrence_count'],
                    item['avg_distance']
                ) for item in adjacencies_with_ids
            ])

    async def flush_all_batches(self):
        """
        Flush all batches to database.

        Thread-safe via async lock to prevent concurrent flushes
        from periodic task and manual flush calls.
        """
        for batch_type in self.item_batches:
            await self._flush_batch(batch_type)

    def close_spider(self, spider: Spider):
        """
        Clean up when spider closes and log persistence statistics.

        Uses separate thread with event loop to avoid Twisted/asyncio conflicts.

        Args:
            spider: Spider instance
        """
        self.logger.info("🔄 close_spider called - stopping periodic flushing and flushing remaining batches...")
        try:
            # Stop periodic flushing thread
            if self.flush_thread and self.flush_thread.is_alive():
                self.logger.info("Stopping periodic flush thread...")
                self._stop_flushing.set()
                self.flush_thread.join(timeout=5.0)
                if self.flush_thread.is_alive():
                    self.logger.warning("Periodic flush thread did not stop gracefully")
                else:
                    self.logger.info("✓ Periodic flush thread stopped")

            # Log batch sizes before flushing
            with self._flushing_lock:
                for batch_type, batch in self.item_batches.items():
                    if batch:
                        self.logger.info(f"  Pending {batch_type}: {len(batch)} items")

            # Final flush of any remaining batches (in separate thread)
            def final_flush():
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                try:
                    loop.run_until_complete(self.flush_all_batches())
                    self.logger.info("✓ All batches flushed successfully")
                finally:
                    pass  # Don't close loop

            flush_thread = threading.Thread(target=final_flush)
            flush_thread.start()
            flush_thread.join()

            # Log persistence statistics
            self.logger.info("=" * 80)
            self.logger.info("PERSISTENCE PIPELINE STATISTICS")
            self.logger.info("=" * 80)
            self.logger.info(f"  Spider: {spider.name}")
            self.logger.info(f"  Total items processed: {self.stats['total_items']}")
            self.logger.info(f"  ✅ Items persisted: {self.stats['persisted_items']}")
            self.logger.info(f"  ❌ Items failed: {self.stats['failed_items']}")

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

            # Close connection pool (in separate thread)
            if self.connection_pool:
                def close_pool():
                    loop = asyncio.new_event_loop()
                    asyncio.set_event_loop(loop)
                    try:
                        loop.run_until_complete(self.connection_pool.close())
                        self.logger.info("✓ Database connection pool closed successfully")
                    finally:
                        loop.close()

                close_thread = threading.Thread(target=close_pool)
                close_thread.start()
                close_thread.join()

            self.logger.info("✓ Persistence pipeline closed successfully")

        except Exception as e:
            self.logger.error(f"❌ Error closing persistence pipeline: {e}")
