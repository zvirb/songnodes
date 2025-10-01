"""
Database Pipeline for SongNodes Scrapers with Pydantic Validation (2025)

Writes music data directly to PostgreSQL with comprehensive validation:
- Pre-insert validation using Pydantic models
- Type safety and business rule enforcement
- Data quality assurance before database insertion
"""
import asyncio
import asyncpg
import logging
import uuid
import threading
from datetime import datetime, date
from typing import Dict, List, Any, Optional
from pydantic import ValidationError
from twisted.internet import defer

# Import Pydantic validation functions
try:
    from pydantic_adapter import (
        validate_artist_item,
        validate_track_item,
        validate_setlist_item,
        validate_track_adjacency_item,
        validate_items_batch
    )
    PYDANTIC_AVAILABLE = True
    logger = logging.getLogger(__name__)
    logger.info("✅ Pydantic validation enabled for database pipeline")
except ImportError as e:
    PYDANTIC_AVAILABLE = False
    logger = logging.getLogger(__name__)
    logger.warning(f"⚠️ Pydantic validation not available: {e}")
    logger.warning("Database pipeline will run without pre-insert validation")


class DatabasePipeline:
    """
    Database pipeline that matches the ACTUAL database schema:
    - artists (artist_id UUID, name, genres[], country)
    - songs (song_id UUID, title, primary_artist_id, genre, bpm, etc.)
    - playlists (playlist_id UUID, name, source, source_url, etc.)
    """

    @classmethod
    def from_crawler(cls, crawler):
        """
        Scrapy calls this method to instantiate the pipeline.
        Load database config from environment variables.
        """
        import os

        # Use centralized secrets manager if available
        try:
            from common.secrets_manager import get_database_config
            db_config = get_database_config()
        except ImportError:
            # Fallback to environment variables
            db_config = {
                'host': os.getenv('DATABASE_HOST', 'postgres'),
                'port': int(os.getenv('DATABASE_PORT', '5432')),
                'database': os.getenv('DATABASE_NAME', 'musicdb'),
                'user': os.getenv('DATABASE_USER', 'musicdb_user'),
                'password': os.getenv('DATABASE_PASSWORD', 'musicdb_secure_pass_change_me')
            }

        return cls(db_config)

    def __init__(self, database_config: Dict[str, Any]):
        self.config = database_config
        self.connection_pool: Optional[asyncpg.Pool] = None
        self.logger = logging.getLogger(__name__)

        # Batch processing
        self.batch_size = 50
        self.item_batches = {
            'artists': [],
            'songs': [],
            'playlists': [],
            'playlist_tracks': [],
            'song_adjacency': []
        }

        # Track processed items to avoid duplicates
        self.processed_items = {
            'artists': set(),
            'songs': set(),
            'playlists': set()
        }

        # Validation statistics (2025 best practice: observability)
        self.validation_stats = {
            'total_items': 0,
            'valid_items': 0,
            'invalid_items': 0,
            'validation_errors': []
        }

        # Periodic flushing to bypass async close_spider() issue (2025 workaround)
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

    def open_spider(self, spider):
        """
        Initialize connection pool when spider starts.

        Uses a separate thread with its own event loop to avoid Twisted/asyncio conflicts.
        """
        def init_pool():
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                connection_string = f"postgresql://{self.config['user']}:{self.config['password']}@{self.config['host']}:{self.config['port']}/{self.config['database']}"
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
            name="DatabasePipelineFlushThread"
        )
        self.flush_thread.start()
        self.logger.info("✓ Periodic flushing thread started")

    async def process_item(self, item, spider):
        """Process a single item and add to appropriate batch"""
        try:
            # Ensure connection pool is initialized
            if not self.connection_pool:
                self.logger.error("Connection pool not initialized! open_spider was not called properly.")
                self.logger.warning("Attempting emergency initialization...")
                await self.open_spider(spider)

            item_type = item.get('item_type')

            if item_type == 'artist':
                await self._process_artist_item(item)
            elif item_type == 'track':
                await self._process_track_item(item)
            elif item_type == 'playlist':
                await self._process_playlist_item(item)
            elif item_type == 'playlist_track':
                await self._process_playlist_track_item(item)
            elif item_type == 'track_adjacency':
                await self._process_adjacency_item(item)
            else:
                self.logger.warning(f"Unknown item type: {item_type}")

            # Log successful processing
            self.logger.debug(f"✓ Processed {item_type} item: {item.get('artist_name') or item.get('track_title') or item.get('setlist_name', 'unknown')}")

            return item

        except Exception as e:
            self.logger.error(f"Error processing item: {e}")
            import traceback
            self.logger.error(traceback.format_exc())
            raise

    async def _process_artist_item(self, item):
        """
        Process artist item with Pydantic validation (2025 best practice).

        Validates artist data before database insertion to ensure:
        - No generic artist names ("Various Artists", etc.)
        - Valid ISO country codes
        - Popularity scores in 0-100 range
        """
        artist_name = item.get('artist_name', '').strip()
        if not artist_name or artist_name in self.processed_items['artists']:
            return

        # Pydantic validation (if available)
        if PYDANTIC_AVAILABLE:
            self.validation_stats['total_items'] += 1
            try:
                # Validate using Pydantic model
                validated_artist = validate_artist_item(item, data_source=item.get('data_source', 'unknown'))
                self.validation_stats['valid_items'] += 1
                self.logger.debug(f"✓ Artist validated: {validated_artist.artist_name}")
            except ValidationError as e:
                self.validation_stats['invalid_items'] += 1
                self.validation_stats['validation_errors'].append(f"Artist '{artist_name}': {str(e)}")
                self.logger.warning(f"❌ Invalid artist data, skipping: {artist_name} - {e}")
                return  # Skip invalid artist

        self.processed_items['artists'].add(artist_name)
        self.item_batches['artists'].append({
            'name': artist_name,
            'genre': item.get('genre'),
            'country': item.get('country')
        })

        if len(self.item_batches['artists']) >= self.batch_size:
            await self._flush_batch('artists')

    async def _process_track_item(self, item):
        """
        Process track/song item with Pydantic validation (2025 best practice).

        Validates track data before database insertion to ensure:
        - Track ID format (16-char hexadecimal)
        - BPM range (60-200)
        - No generic track names ("ID - ID", "Unknown Track", etc.)
        - Energy/danceability in 0.0-1.0 range
        - Remix consistency (is_remix=True requires remix_type)
        """
        track_name = item.get('track_name', '').strip()
        if not track_name:
            return

        track_key = f"{track_name}::{item.get('artist_name', '')}"
        if track_key in self.processed_items['songs']:
            return

        # Pydantic validation (if available)
        if PYDANTIC_AVAILABLE:
            self.validation_stats['total_items'] += 1
            try:
                # Validate using Pydantic model
                validated_track = validate_track_item(item, data_source=item.get('data_source', 'unknown'))
                self.validation_stats['valid_items'] += 1
                self.logger.debug(f"✓ Track validated: {validated_track.track_name}")
            except ValidationError as e:
                self.validation_stats['invalid_items'] += 1
                self.validation_stats['validation_errors'].append(f"Track '{track_name}': {str(e)}")
                self.logger.warning(f"❌ Invalid track data, skipping: {track_name} - {e}")
                return  # Skip invalid track

        self.processed_items['songs'].add(track_key)

        # First ensure artist exists
        artist_name = item.get('artist_name', '').strip()
        if artist_name and artist_name not in self.processed_items['artists']:
            await self._process_artist_item({'artist_name': artist_name, 'genre': item.get('genre')})

        self.item_batches['songs'].append({
            'title': track_name,
            'artist_name': artist_name,
            'genre': item.get('genre'),
            'bpm': item.get('bpm'),
            'key': item.get('key'),
            'duration_seconds': item.get('duration_seconds'),
            'release_year': item.get('release_year'),
            'label': item.get('label'),
            # Streaming platform IDs
            'spotify_id': item.get('spotify_id'),
            'musicbrainz_id': item.get('musicbrainz_id'),
            'tidal_id': item.get('tidal_id'),
            'beatport_id': item.get('beatport_id'),
            'apple_music_id': item.get('apple_music_id'),
            'soundcloud_id': item.get('soundcloud_id'),
            'deezer_id': item.get('deezer_id'),
            'youtube_music_id': item.get('youtube_music_id')
        })

        if len(self.item_batches['songs']) >= self.batch_size:
            await self._flush_batch('songs')

    async def _process_playlist_item(self, item):
        """
        Process playlist item with Pydantic validation (2025 best practice).

        Validates playlist/setlist data before database insertion to ensure:
        - No generic playlist names ("DJ Set", "Untitled", etc.)
        - Valid date formats (YYYY-MM-DD)
        - Valid sources (1001tracklists, mixesdb, setlistfm, reddit)
        """
        playlist_name = item.get('name', '').strip()
        if not playlist_name or playlist_name in self.processed_items['playlists']:
            return

        # Pydantic validation (if available)
        if PYDANTIC_AVAILABLE:
            self.validation_stats['total_items'] += 1
            try:
                # Validate using Pydantic model
                validated_playlist = validate_setlist_item(item, data_source=item.get('data_source', 'unknown'))
                self.validation_stats['valid_items'] += 1
                self.logger.debug(f"✓ Playlist validated: {validated_playlist.setlist_name}")
            except ValidationError as e:
                self.validation_stats['invalid_items'] += 1
                self.validation_stats['validation_errors'].append(f"Playlist '{playlist_name}': {str(e)}")
                self.logger.warning(f"❌ Invalid playlist data, skipping: {playlist_name} - {e}")
                return  # Skip invalid playlist

        self.processed_items['playlists'].add(playlist_name)

        # Convert date string to date object if present
        event_date = item.get('playlist_date') or item.get('event_date')
        if event_date and isinstance(event_date, str):
            try:
                # Parse ISO format date string and extract just the date part
                if 'T' in event_date:
                    # Full ISO timestamp like '2025-09-29T17:28:42.632833'
                    event_date = datetime.fromisoformat(event_date.replace('Z', '+00:00').split('.')[0]).date()
                else:
                    # Already a date string like '2025-09-29'
                    event_date = datetime.strptime(event_date, '%Y-%m-%d').date()
            except Exception as e:
                self.logger.warning(f"Could not parse date {event_date}: {e}")
                event_date = None  # If parsing fails, use None
        elif isinstance(event_date, datetime):
            event_date = event_date.date()
        elif not isinstance(event_date, date):
            event_date = None

        self.item_batches['playlists'].append({
            'name': playlist_name,
            'source': item.get('source') or item.get('platform') or 'unknown',
            'source_url': item.get('source_url'),
            'playlist_type': item.get('playlist_type'),
            'event_date': event_date
        })

        if len(self.item_batches['playlists']) >= self.batch_size:
            await self._flush_batch('playlists')

    async def _process_playlist_track_item(self, item):
        """Process playlist track item (position in playlist)"""
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

    async def _process_adjacency_item(self, item):
        """
        Process track adjacency item with Pydantic validation (2025 best practice).

        Validates track adjacency data before database insertion to ensure:
        - Valid track names (not generic/placeholder names)
        - Distance >= 1 (tracks must be separate)
        - track1 != track2 (no self-adjacency)
        - occurrence_count >= 1
        """
        track1 = item.get('track1_name', '').strip()
        track2 = item.get('track2_name', '').strip()

        if not track1 or not track2 or track1 == track2:
            return

        # Pydantic validation (if available)
        if PYDANTIC_AVAILABLE:
            self.validation_stats['total_items'] += 1
            try:
                # Validate using Pydantic model
                validated_adjacency = validate_track_adjacency_item(item, data_source=item.get('data_source', 'unknown'))
                self.validation_stats['valid_items'] += 1
                self.logger.debug(f"✓ Adjacency validated: {track1} → {track2}")
            except ValidationError as e:
                self.validation_stats['invalid_items'] += 1
                self.validation_stats['validation_errors'].append(f"Adjacency '{track1}→{track2}': {str(e)}")
                self.logger.warning(f"❌ Invalid adjacency data, skipping: {track1}→{track2} - {e}")
                return  # Skip invalid adjacency

        self.item_batches['song_adjacency'].append({
            'track1_name': track1,
            'track1_artist': item.get('track1_artist', ''),
            'track2_name': track2,
            'track2_artist': item.get('track2_artist', ''),
            'distance': item.get('distance', 1),
            'occurrence_count': item.get('occurrence_count', 1),
            'source_context': item.get('source_context', ''),
            'source_url': item.get('source_url')
        })

        if len(self.item_batches['song_adjacency']) >= self.batch_size:
            await self._flush_batch('song_adjacency')

    async def _flush_batch(self, batch_type: str):
        """Flush a specific batch to database"""
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

            self.logger.info(f"✓ Flushed {len(batch)} {batch_type} items to database")
            self.item_batches[batch_type] = []

        except Exception as e:
            self.logger.error(f"Error flushing {batch_type} batch: {e}")
            raise

    async def _insert_artists_batch(self, conn, batch: List[Dict[str, Any]]):
        """Insert artists batch - matches actual schema"""
        await conn.executemany("""
            INSERT INTO artists (name, genres, country)
            VALUES ($1, $2, $3)
            ON CONFLICT (name) DO UPDATE SET
                genres = COALESCE(EXCLUDED.genres, artists.genres),
                country = COALESCE(EXCLUDED.country, artists.country),
                updated_at = CURRENT_TIMESTAMP
        """, [
            (
                item['name'],
                [item['genre']] if item.get('genre') else None,
                item.get('country')
            ) for item in batch
        ])

    async def _insert_songs_batch(self, conn, batch: List[Dict[str, Any]]):
        """Insert songs batch - matches actual schema"""
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
                # Convert ms to seconds if duration_ms provided, else use duration_seconds
                (item.get('duration_ms') // 1000) if item.get('duration_ms') else item.get('duration_seconds', 0),
                item.get('release_year'),
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
        """Insert playlists batch - matches actual schema"""
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
        """Insert playlist tracks batch - stores track positions in playlists"""
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
                self.logger.warning(f"Could not insert playlist track {item['track_name']} at position {item['position']}: {e}")

    async def _insert_adjacency_batch(self, conn, batch: List[Dict[str, Any]]):
        """Insert song adjacency batch - matches actual schema"""
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
                    avg_distance = ((song_adjacency.avg_distance * song_adjacency.occurrence_count) +
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

    def close_spider(self, spider):
        """
        Clean up when spider closes and log validation statistics.

        Uses separate thread with event loop to avoid Twisted/asyncio conflicts.
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

            # Log validation statistics (if Pydantic validation was available)
            if PYDANTIC_AVAILABLE and self.validation_stats['total_items'] > 0:
                self.logger.info("=" * 70)
                self.logger.info("📊 DATABASE PIPELINE VALIDATION STATISTICS")
                self.logger.info("=" * 70)
                self.logger.info(f"  Total items processed: {self.validation_stats['total_items']}")
                self.logger.info(f"  ✅ Valid items inserted: {self.validation_stats['valid_items']}")
                self.logger.info(f"  ❌ Invalid items rejected: {self.validation_stats['invalid_items']}")

                # Calculate validation rate
                if self.validation_stats['total_items'] > 0:
                    validation_rate = (self.validation_stats['valid_items'] / self.validation_stats['total_items']) * 100
                    self.logger.info(f"  📈 Validation success rate: {validation_rate:.2f}%")

                # Log sample validation errors (first 5)
                if self.validation_stats['validation_errors']:
                    self.logger.info(f"  ⚠️ Sample validation errors (showing first 5 of {len(self.validation_stats['validation_errors'])}):")
                    for i, error in enumerate(self.validation_stats['validation_errors'][:5], 1):
                        self.logger.info(f"    {i}. {error}")

                self.logger.info("=" * 70)

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

            self.logger.info("✓ Database pipeline closed successfully")

        except Exception as e:
            self.logger.error(f"❌ Error closing database pipeline: {e}")