"""
Enhanced Database Pipeline for SongNodes Scrapers
Writes comprehensive music data directly to PostgreSQL with full schema support
"""
import asyncio
import asyncpg
import json
import logging
import uuid
from datetime import datetime, date
from typing import Dict, List, Any, Optional
from scrapy.exceptions import DropItem
from twisted.internet import defer, reactor
from twisted.internet.defer import ensureDeferred, inlineCallbacks
from twisted.enterprise import adbapi
import psycopg2
import psycopg2.extras

from items import (
    EnhancedArtistItem,
    EnhancedTrackItem,
    EnhancedSetlistItem,
    EnhancedTrackArtistItem,
    EnhancedSetlistTrackItem,
    EnhancedTrackAdjacencyItem,
    EnhancedVenueItem,
    TargetTrackSearchItem
)


class EnhancedMusicDatabasePipeline:
    """
    High-performance database pipeline for comprehensive music data
    Features:
    - Direct PostgreSQL integration with connection pooling
    - Comprehensive data validation and cleaning
    - Deduplication and conflict resolution
    - Target track matching and relationship building
    - Batch processing for performance
    """

    def __init__(self, database_config: Dict[str, Any]):
        self.database_config = database_config
        self.dbpool = None
        self.connection_pool = None  # For async operations
        self.logger = logging.getLogger(__name__)

        # Batch processing
        self.batch_size = 100
        self.item_batches = {
            'artists': [],
            'songs': [],
            'playlists': [],
            'venues': [],
            'song_artists': [],
            'playlist_songs': [],
            'song_adjacency': []
        }

        # Target track matching
        self.target_tracks = {}
        self.found_matches = {}

        # Deduplication tracking
        self.processed_items = {
            'artists': set(),
            'songs': set(),
            'playlists': set(),
            'venues': set()
        }

    @classmethod
    def from_crawler(cls, crawler):
        """Initialize pipeline from Scrapy crawler settings"""
        import os
        # First try crawler settings, then environment variables, then defaults
        db_config = {
            'host': crawler.settings.get('DATABASE_HOST', os.getenv('POSTGRES_HOST', 'localhost')),
            'port': crawler.settings.get('DATABASE_PORT', int(os.getenv('POSTGRES_PORT', '5433'))),
            'database': crawler.settings.get('DATABASE_NAME', os.getenv('POSTGRES_DB', 'musicdb')),
            'user': crawler.settings.get('DATABASE_USER', os.getenv('POSTGRES_USER', 'musicdb_user')),
            'password': crawler.settings.get('DATABASE_PASSWORD', os.getenv('POSTGRES_PASSWORD', 'musicdb_secure_pass'))
        }
        return cls(db_config)

    @inlineCallbacks
    def open_spider(self, spider):
        """Initialize database connection and load target tracks - Twisted compatible"""
        self.logger.info("Initializing enhanced database pipeline...")

        try:
            # Initialize Twisted database connection pool
            self.dbpool = adbapi.ConnectionPool(
                'psycopg2',
                host=self.database_config['host'],
                port=self.database_config['port'],
                database=self.database_config['database'],
                user=self.database_config['user'],
                password=self.database_config['password'],
                cp_min=5,
                cp_max=20,
                cp_noisy=False,
                cursor_factory=psycopg2.extras.RealDictCursor
            )

            # Load target tracks for matching
            yield self.load_target_tracks()

            self.logger.info("✓ Enhanced database pipeline initialized successfully")

        except Exception as e:
            self.logger.error(f"Failed to initialize database pipeline: {e}")
            raise

    @inlineCallbacks
    def close_spider(self, spider):
        """Process remaining batches and close connections - Twisted compatible"""
        self.logger.info("Closing enhanced database pipeline...")

        try:
            # Process any remaining batches - wrap async function with ensureDeferred
            yield ensureDeferred(self.flush_all_batches())

            # Generate statistics - wrap async function with ensureDeferred
            yield ensureDeferred(self.generate_pipeline_statistics())

            # Close async connection pool if it exists
            if self.connection_pool:
                yield ensureDeferred(self.connection_pool.close())
                self.logger.info("✓ Closed async connection pool")

            # Close Twisted connection pool
            if self.dbpool:
                self.dbpool.close()

            self.logger.info("✓ Enhanced database pipeline closed successfully")

        except Exception as e:
            self.logger.error(f"Error closing pipeline: {e}")

    @inlineCallbacks
    def process_item(self, item, spider):
        """Main item processing entry point - Twisted compatible"""
        # Process items using Twisted deferreds
        result = yield self._process_item_deferred(item, spider)
        defer.returnValue(result)

    def _process_item_deferred(self, item, spider):
        """Bridge method to convert async processing to Twisted deferreds"""
        return ensureDeferred(self._async_process_item(item, spider))

    async def _async_process_item(self, item, spider):
        """Async item processing implementation"""
        try:
            item_type = type(item).__name__
            self.logger.debug(f"Processing item of type: {item_type}")

            # Handle plain dictionaries from API client
            if isinstance(item, dict):
                self.logger.info(f"Received dict item with keys: {list(item.keys())}")
                # Detect item type based on dict keys
                if item.get('item_type') == 'track_adjacency':
                    self.logger.info("Detected track adjacency item from dict")
                    await self.process_track_adjacency_item(item)
                    return item
                elif 'track_name' in item and 'artist_name' in item:
                    self.logger.info("Detected track item from dict")
                    # First create/get artist
                    artist_name = item.get('artist_name', 'Unknown Artist')
                    artist_data = {
                        'name': artist_name,
                        'artist_id': str(uuid.uuid5(uuid.NAMESPACE_DNS, artist_name.lower()))
                    }
                    await self.process_artist_item(artist_data)

                    # Then process track with artist reference
                    track_data = {
                        'song_id': str(uuid.uuid5(uuid.NAMESPACE_DNS,
                            f"{item.get('track_name', '')}-{artist_name}".lower())),
                        'title': item.get('track_name', 'Unknown Track'),
                        'primary_artist_id': artist_data['artist_id'],
                        'primary_artist': artist_name,
                        'genre': item.get('genre', ''),
                        'bpm': item.get('bpm'),
                        'key': item.get('key', ''),
                        'label': item.get('label', ''),
                        'source_url': item.get('source_url', ''),
                        'spotify_id': item.get('spotify_id'),
                        'release_year': item.get('release_year')
                    }
                    await self.process_song_item(track_data)
                    return item

            processed_item = await self.validate_and_normalize_item(item, item_type)

            # Route to appropriate processor
            if isinstance(item, EnhancedArtistItem):
                await self.process_artist_item(processed_item)
            elif isinstance(item, EnhancedTrackItem):
                await self.process_song_item(processed_item)
            elif isinstance(item, EnhancedSetlistItem):
                await self.process_playlist_item(processed_item)
            elif isinstance(item, EnhancedVenueItem):
                await self.process_venue_item(processed_item)
            elif isinstance(item, EnhancedTrackArtistItem):
                await self.process_song_artist_item(processed_item)
            elif isinstance(item, EnhancedSetlistTrackItem):
                await self.process_playlist_song_item(processed_item)
            elif isinstance(item, EnhancedTrackAdjacencyItem):
                await self.process_song_adjacency_item(processed_item)
            elif isinstance(item, TargetTrackSearchItem):
                await self.process_target_track_item(processed_item)

            return item

        except Exception as e:
            self.logger.error(f"Error processing {type(item).__name__}: {e}")
            raise DropItem(f"Processing failed: {e}")

    async def load_target_tracks(self):
        """Load target tracks from JSON file for matching"""
        try:
            import os
            target_file = os.path.join(os.path.dirname(__file__), 'target_tracks_for_scraping.json')

            if os.path.exists(target_file):
                with open(target_file, 'r') as f:
                    target_data = json.load(f)

                for track in target_data.get('scraper_targets', {}).get('all_tracks', []):
                    # Create normalized key for matching
                    key = self.normalize_track_key(track['title'], track['primary_artist'])
                    self.target_tracks[key] = track

                self.logger.info(f"Loaded {len(self.target_tracks)} target tracks for matching")

        except Exception as e:
            self.logger.warning(f"Could not load target tracks: {e}")

    def normalize_track_key(self, title: str, artist: str) -> str:
        """Create normalized key for track matching"""
        import re
        normalized_title = re.sub(r'[^\w\s]', '', title.lower()).strip()
        normalized_artist = re.sub(r'[^\w\s]', '', artist.lower()).strip()
        return f"{normalized_artist}::{normalized_title}"

    async def validate_and_normalize_item(self, item, item_type: str) -> Dict[str, Any]:
        """Comprehensive item validation and normalization"""
        data = dict(item)

        # Add system fields
        data['scrape_timestamp'] = datetime.utcnow()
        if 'created_at' not in data or not data['created_at']:
            data['created_at'] = datetime.utcnow()
        if 'updated_at' not in data:
            data['updated_at'] = datetime.utcnow()

        # Generate UUIDs for primary keys
        if 'id' not in data:
            data['id'] = str(uuid.uuid4())

        # Normalize text fields
        text_fields = ['track_name', 'artist_name', 'setlist_name', 'venue_name']
        for field in text_fields:
            if field in data and data[field]:
                data[field] = self.normalize_text(data[field])

        # Validate and convert data types
        await self.validate_data_types(data, item_type)

        # Handle JSON fields
        json_fields = ['metadata', 'external_urls', 'audio_features', 'aliases', 'genre_preferences']
        for field in json_fields:
            if field in data and data[field]:
                if not isinstance(data[field], str):
                    data[field] = json.dumps(data[field])

        return data

    async def validate_data_types(self, data: Dict[str, Any], item_type: str):
        """Validate and convert data types for database compatibility"""

        # Numeric fields validation
        numeric_fields = {
            'bpm': (float, 60, 200),
            'energy': (float, 0, 1),
            'danceability': (float, 0, 1),
            'valence': (float, 0, 1),
            'popularity_score': (int, 0, 100),
            'duration_ms': (int, 0, None),
            'follower_count': (int, 0, None),
            'capacity': (int, 0, None)
        }

        for field, (dtype, min_val, max_val) in numeric_fields.items():
            if field in data and data[field] is not None:
                try:
                    data[field] = dtype(data[field])
                    if min_val is not None and data[field] < min_val:
                        data[field] = min_val
                    if max_val is not None and data[field] > max_val:
                        data[field] = max_val
                except (ValueError, TypeError):
                    self.logger.warning(f"Invalid {field} value: {data[field]}, setting to None")
                    data[field] = None

        # Boolean fields validation
        boolean_fields = ['is_remix', 'is_mashup', 'is_live', 'is_cover', 'is_explicit', 'is_verified']
        for field in boolean_fields:
            if field in data and data[field] is not None:
                data[field] = bool(data[field])

        # Date fields validation
        date_fields = ['release_date', 'set_date']
        for field in date_fields:
            if field in data and data[field]:
                if isinstance(data[field], str):
                    try:
                        data[field] = datetime.strptime(data[field], '%Y-%m-%d').date()
                    except ValueError:
                        try:
                            data[field] = datetime.strptime(data[field][:10], '%Y-%m-%d').date()
                        except ValueError:
                            self.logger.warning(f"Invalid date format for {field}: {data[field]}")
                            data[field] = None

    def normalize_text(self, text: str) -> str:
        """Normalize text for consistency"""
        if not text:
            return text
        import re
        text = text.strip()
        text = re.sub(r'\s+', ' ', text)  # Multiple spaces to single
        text = re.sub(r'\u00a0', ' ', text)  # Non-breaking space to regular space
        return text

    async def process_artist_item(self, data: Dict[str, Any]):
        """Process artist item with deduplication"""
        # Handle both 'name' and 'artist_name' fields
        artist_name = data.get('name', data.get('artist_name', ''))
        artist_key = self.normalize_text(artist_name).lower()

        if artist_key in self.processed_items['artists']:
            return  # Skip duplicate

        # Ensure we have proper fields for database
        if 'name' not in data:
            data['name'] = artist_name
        if 'artist_id' not in data:
            data['artist_id'] = str(uuid.uuid5(uuid.NAMESPACE_DNS, artist_key))

        self.processed_items['artists'].add(artist_key)
        self.item_batches['artists'].append(data)

        if len(self.item_batches['artists']) >= self.batch_size:
            await self.flush_batch('artists')

    async def process_song_item(self, data: Dict[str, Any]):
        """Process song item with target matching"""
        track_key = self.normalize_track_key(
            data.get('title', ''),
            data.get('primary_artist', '')
        )

        # Check if this matches a target track
        if track_key in self.target_tracks:
            self.found_matches[track_key] = data
            self.logger.info(f"✓ Found target track: {data['track_name']}")

            # Enhance with target track metadata
            target_info = self.target_tracks[track_key]
            data.update({
                'genre': target_info.get('genre'),
                'is_priority_track': True,
                'target_track_info': json.dumps(target_info)
            })

        # Deduplication
        if track_key in self.processed_items['songs']:
            return

        self.processed_items['songs'].add(track_key)
        self.item_batches['songs'].append(data)

        if len(self.item_batches['songs']) >= self.batch_size:
            await self.flush_batch('songs')

    async def process_playlist_item(self, data: Dict[str, Any]):
        """Process setlist item"""
        setlist_key = self.normalize_text(data['setlist_name']).lower()

        if setlist_key in self.processed_items['playlists']:
            return

        self.processed_items['playlists'].add(setlist_key)
        self.item_batches['playlists'].append(data)

        if len(self.item_batches['playlists']) >= self.batch_size:
            await self.flush_batch('playlists')

    async def process_venue_item(self, data: Dict[str, Any]):
        """Process venue item"""
        venue_key = self.normalize_text(data['venue_name']).lower()

        if venue_key in self.processed_items['venues']:
            return

        self.processed_items['venues'].add(venue_key)
        self.item_batches['venues'].append(data)

        if len(self.item_batches['venues']) >= self.batch_size:
            await self.flush_batch('venues')

    async def process_song_artist_item(self, data: Dict[str, Any]):
        """Process song-artist relationship"""
        self.item_batches['song_artists'].append(data)

        if len(self.item_batches['song_artists']) >= self.batch_size:
            await self.flush_batch('song_artists')

    async def process_playlist_song_item(self, data: Dict[str, Any]):
        """Process playlist-song relationship"""
        self.item_batches['playlist_songs'].append(data)

        if len(self.item_batches['playlist_songs']) >= self.batch_size:
            await self.flush_batch('playlist_songs')

    async def process_song_adjacency_item(self, data: Dict[str, Any]):
        """Process song adjacency relationship"""
        self.item_batches['song_adjacency'].append(data)

        if len(self.item_batches['song_adjacency']) >= self.batch_size:
            await self.flush_batch('song_adjacency')

    async def process_track_adjacency_item(self, data: Dict[str, Any]):
        """Process track adjacency relationship (alias for song adjacency)"""
        await self.process_song_adjacency_item(data)

    async def process_target_track_item(self, data: Dict[str, Any]):
        """Process target track search status"""
        # This could be used to track search progress
        pass

    async def flush_batch(self, batch_type: str):
        """Flush a specific batch to database"""
        if not self.item_batches[batch_type]:
            return

        batch = self.item_batches[batch_type].copy()
        self.item_batches[batch_type].clear()

        try:
            # Check if we have connection_pool (async context) or need to create one
            if not self.connection_pool:
                # Create connection pool if it doesn't exist
                self.connection_pool = await asyncpg.create_pool(
                    **self.database_config,
                    min_size=1,
                    max_size=10,
                    max_queries=50000,
                    max_inactive_connection_lifetime=300,
                    command_timeout=60
                )

            async with self.connection_pool.acquire() as conn:
                if batch_type == 'artists':
                    await self.insert_artists_batch(conn, batch)
                elif batch_type == 'songs':
                    await self.insert_songs_batch(conn, batch)
                elif batch_type == 'playlists':
                    await self.insert_playlists_batch(conn, batch)
                elif batch_type == 'venues':
                    await self.insert_venues_batch(conn, batch)
                elif batch_type == 'song_artists':
                    await self.insert_song_artists_batch(conn, batch)
                elif batch_type == 'playlist_songs':
                    await self.insert_playlist_songs_batch(conn, batch)
                elif batch_type == 'song_adjacency':
                    await self.insert_track_adjacencies_batch(conn, batch)

            self.logger.info(f"✓ Inserted {len(batch)} {batch_type} records")

        except Exception as e:
            self.logger.error(f"Failed to insert {batch_type} batch: {e}")
            import traceback
            self.logger.error(f"Traceback: {traceback.format_exc()}")
            # Re-add to batch for retry
            self.item_batches[batch_type].extend(batch)

    async def insert_artists_batch(self, conn, batch: List[Dict[str, Any]]):
        """Insert artists batch with correct schema"""
        # Prepare records matching the actual database schema
        records = []
        for item in batch:
            record = (
                item.get('artist_id', str(uuid.uuid4())),  # artist_id
                item.get('name', item.get('artist_name', 'Unknown')),  # name
                item.get('spotify_id'),  # spotify_id
                item.get('musicbrainz_id'),  # musicbrainz_id
                item.get('genres', []),  # genres (PostgreSQL array)
                item.get('country'),  # country
                item.get('aliases', []),  # aliases (PostgreSQL array)
                datetime.now(),  # created_at
                datetime.now()  # updated_at
            )
            records.append(record)

        await conn.executemany("""
            INSERT INTO artists (
                artist_id, name, spotify_id, musicbrainz_id,
                genres, country, aliases, created_at, updated_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9
            )
            ON CONFLICT (artist_id) DO UPDATE SET
                spotify_id = COALESCE(EXCLUDED.spotify_id, artists.spotify_id),
                genres = COALESCE(EXCLUDED.genres, artists.genres),
                updated_at = EXCLUDED.updated_at
        """, records)

    async def insert_songs_batch(self, conn, batch: List[Dict[str, Any]]):
        """Insert songs batch matching actual database schema"""
        try:
            song_records = []
            for item in batch:
                # Generate song_id if not provided
                song_id = item.get('id') or str(uuid.uuid4())

                # Convert duration from ms to seconds if needed
                duration_seconds = None
                if item.get('duration_ms'):
                    duration_seconds = int(item.get('duration_ms', 0) / 1000)
                elif item.get('duration_seconds'):
                    duration_seconds = item.get('duration_seconds')

                # Convert release date to release year
                release_year = None
                if item.get('release_date'):
                    try:
                        if isinstance(item['release_date'], str):
                            release_year = int(item['release_date'][:4])
                        elif hasattr(item['release_date'], 'year'):
                            release_year = item['release_date'].year
                    except (ValueError, TypeError):
                        pass

                song_records.append((
                    song_id,
                    item.get('track_name') or item.get('title', 'Unknown Track'),
                    None,  # primary_artist_id - will be set later via relationship
                    release_year,
                    item.get('genre'),
                    item.get('bpm'),
                    item.get('key') or item.get('musical_key'),
                    duration_seconds,
                    item.get('spotify_id'),
                    item.get('musicbrainz_id'),
                    item.get('isrc'),
                    item.get('label') or item.get('record_label'),
                    None  # remix_of - will be handled separately
                ))

            if song_records:
                await conn.executemany("""
                    INSERT INTO songs (
                        song_id, title, primary_artist_id, release_year, genre, bpm, key,
                        duration_seconds, spotify_id, musicbrainz_id, isrc, label, remix_of
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                    ON CONFLICT (song_id) DO UPDATE SET
                        spotify_id = COALESCE(EXCLUDED.spotify_id, songs.spotify_id),
                        bpm = COALESCE(EXCLUDED.bpm, songs.bpm),
                        genre = COALESCE(EXCLUDED.genre, songs.genre),
                        duration_seconds = COALESCE(EXCLUDED.duration_seconds, songs.duration_seconds),
                        updated_at = CURRENT_TIMESTAMP
                """, song_records)

                self.logger.info(f"✓ Inserted/updated {len(song_records)} songs")

        except Exception as e:
            self.logger.error(f"Error inserting songs: {e}")
            # Don't raise - continue processing other items

    async def insert_playlists_batch(self, conn, batch: List[Dict[str, Any]]):
        """Insert playlists batch matching actual database schema"""
        try:
            playlist_records = []
            for item in batch:
                # Generate a unique playlist ID based on name and source
                playlist_id = str(uuid.uuid5(
                    uuid.NAMESPACE_DNS,
                    f"{item.get('setlist_name', '')}:{item.get('data_source', '')}"
                ))

                # Parse event date
                event_date = None
                if item.get('event_date') or item.get('date_played'):
                    date_str = item.get('event_date') or item.get('date_played')
                    if isinstance(date_str, str):
                        try:
                            from datetime import datetime
                            event_date = datetime.strptime(date_str[:10], '%Y-%m-%d').date()
                        except ValueError:
                            pass

                playlist_records.append((
                    playlist_id,
                    item.get('setlist_name') or item.get('tracklist_name', 'Unknown Playlist'),
                    item.get('data_source', 'unknown'),
                    item.get('event_url') or item.get('source_url'),
                    item.get('event_type', 'dj_mix'),
                    None,  # dj_artist_id - will be set via relationship
                    item.get('event_name'),
                    None,  # venue_id - will be set via relationship
                    event_date,
                    item.get('duration_minutes'),
                    item.get('track_count', 0),
                    item.get('play_count', 0),
                    item.get('like_count', 0)
                ))

            if playlist_records:
                await conn.executemany("""
                    INSERT INTO playlists (
                        playlist_id, name, source, source_url, playlist_type, dj_artist_id,
                        event_name, venue_id, event_date, duration_minutes, tracklist_count,
                        play_count, like_count
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                    ON CONFLICT (playlist_id)
                    DO UPDATE SET
                        source_url = EXCLUDED.source_url,
                        event_date = COALESCE(EXCLUDED.event_date, playlists.event_date),
                        duration_minutes = COALESCE(EXCLUDED.duration_minutes, playlists.duration_minutes),
                        tracklist_count = GREATEST(EXCLUDED.tracklist_count, playlists.tracklist_count),
                        updated_at = CURRENT_TIMESTAMP
                """, playlist_records)

                self.logger.info(f"✓ Inserted/updated {len(playlist_records)} playlists")

        except Exception as e:
            self.logger.error(f"Error inserting playlists: {e}")
            # Don't raise - continue processing other items

    async def insert_venues_batch(self, conn, batch: List[Dict[str, Any]]):
        """Insert venues batch matching actual database schema"""
        try:
            venue_records = []
            for item in batch:
                venue_name = item.get('venue') or item.get('venue_name')
                if venue_name:
                    venue_id = str(uuid.uuid5(
                        uuid.NAMESPACE_DNS,
                        f"{venue_name}:{item.get('venue_city', '')}:{item.get('venue_country', '')}"
                    ))

                    venue_records.append((
                        venue_id,
                        venue_name,
                        item.get('venue_city'),
                        item.get('venue_country'),
                        item.get('venue_capacity'),
                        item.get('venue_type', 'club')
                    ))

            if venue_records:
                await conn.executemany("""
                    INSERT INTO venues (
                        venue_id, name, city, country, capacity, venue_type
                    )
                    VALUES ($1, $2, $3, $4, $5, $6)
                    ON CONFLICT (name, city, country)
                    DO UPDATE SET
                        capacity = COALESCE(EXCLUDED.capacity, venues.capacity),
                        venue_type = COALESCE(EXCLUDED.venue_type, venues.venue_type),
                        updated_at = CURRENT_TIMESTAMP
                """, venue_records)

                self.logger.info(f"✓ Inserted/updated {len(venue_records)} venues")

        except Exception as e:
            self.logger.error(f"Error inserting venues: {e}")
            # Don't raise - continue processing other items

    async def insert_song_artists_batch(self, conn, batch: List[Dict[str, Any]]):
        """Insert song-artist relationships"""
        try:
            # First, get song and artist IDs from the batch
            song_artist_records = []

            for item in batch:
                # Try to find song ID by title
                song_title = item.get('track_name') or item.get('title')
                artist_name = item.get('artist_name')

                if song_title and artist_name:
                    # Get song_id and artist_id from database
                    song_result = await conn.fetchrow(
                        "SELECT song_id FROM songs WHERE title ILIKE $1 LIMIT 1",
                        song_title
                    )
                    artist_result = await conn.fetchrow(
                        "SELECT artist_id FROM artists WHERE name ILIKE $1 LIMIT 1",
                        artist_name
                    )

                    if song_result and artist_result:
                        song_artist_records.append((
                            song_result['song_id'],
                            artist_result['artist_id'],
                            'performer'  # default role
                        ))

            if song_artist_records:
                await conn.executemany("""
                    INSERT INTO song_artists (song_id, artist_id, role)
                    VALUES ($1, $2, $3)
                    ON CONFLICT (song_id, artist_id, role) DO NOTHING
                """, song_artist_records)

                self.logger.info(f"✓ Inserted {len(song_artist_records)} song-artist relationships")

        except Exception as e:
            self.logger.error(f"Error inserting song-artist relationships: {e}")
            # Don't raise - continue processing other items

    async def insert_playlist_songs_batch(self, conn, batch: List[Dict[str, Any]]):
        """Insert playlist-song relationships into playlist_songs table"""
        try:
            playlist_song_records = []

            for item in batch:
                # Generate playlist ID same way as in insert_playlists_batch
                playlist_id = str(uuid.uuid5(
                    uuid.NAMESPACE_DNS,
                    f"{item.get('setlist_name', '')}:{item.get('data_source', '')}"
                ))

                # Look up song ID for track name with flexible matching
                track_name = item.get('track_name', '')
                song_query = """
                    SELECT song_id FROM songs
                    WHERE LOWER(TRIM(title)) = LOWER(TRIM($1))
                       OR LOWER(REPLACE(REPLACE(REPLACE(title, ' - ', ' '), ' (', ' '), ')', ''))
                          LIKE LOWER(REPLACE(REPLACE(REPLACE($1, ' - ', ' '), ' (', ' '), ')', '') || '%')
                       OR LOWER(title) LIKE '%' || LOWER(TRIM($1)) || '%'
                    ORDER BY
                        CASE
                            WHEN LOWER(TRIM(title)) = LOWER(TRIM($1)) THEN 1
                            WHEN LOWER(title) LIKE LOWER(TRIM($1)) || '%' THEN 2
                            ELSE 3
                        END
                    LIMIT 1
                """
                song_id = await conn.fetchval(song_query, track_name)

                if song_id:
                    playlist_song_records.append((
                        playlist_id,
                        song_id,
                        item.get('track_order', 0),
                        item.get('transition_rating'),
                        item.get('energy_level'),
                        item.get('crowd_reaction')
                    ))
                else:
                    # Track not found in songs table - add it first
                    self.logger.debug(f"Track not found in songs table: {track_name}")

            if playlist_song_records:
                # Insert playlist-song relationships
                await conn.executemany("""
                    INSERT INTO playlist_songs (
                        playlist_id, song_id, position,
                        transition_rating, energy_level, crowd_reaction
                    )
                    VALUES ($1, $2, $3, $4, $5, $6)
                    ON CONFLICT (playlist_id, position)
                    DO UPDATE SET
                        song_id = EXCLUDED.song_id,
                        transition_rating = COALESCE(EXCLUDED.transition_rating, playlist_songs.transition_rating),
                        energy_level = COALESCE(EXCLUDED.energy_level, playlist_songs.energy_level),
                        crowd_reaction = COALESCE(EXCLUDED.crowd_reaction, playlist_songs.crowd_reaction)
                """, playlist_song_records)

                self.logger.info(f"✓ Inserted {len(playlist_song_records)} playlist-song relationships")

                # After inserting playlist songs, create adjacencies from the sequences
                await self.create_adjacencies_from_playlist(conn, playlist_id)

        except Exception as e:
            self.logger.error(f"Error inserting setlist tracks: {e}")
            # Don't raise - continue processing other items

    async def create_adjacencies_from_playlist(self, conn, playlist_id: str):
        """Create song adjacencies from playlist sequences"""
        try:
            # Get all songs in the playlist in order
            songs_query = """
                SELECT song_id, position
                FROM playlist_songs
                WHERE playlist_id = $1
                ORDER BY position
            """
            songs = await conn.fetch(songs_query, playlist_id)

            if len(songs) < 2:
                return

            # Create adjacencies for consecutive songs
            adjacency_records = []
            for i in range(len(songs) - 1):
                song_1 = songs[i]['song_id']
                song_2 = songs[i + 1]['song_id']

                # Ensure song_id_1 < song_id_2 for consistency
                if song_1 != song_2:
                    song_id_1 = min(song_1, song_2)
                    song_id_2 = max(song_1, song_2)
                    adjacency_records.append((song_id_1, song_id_2, 1, 1.0))

            if adjacency_records:
                # Insert/update adjacencies
                await conn.executemany("""
                    INSERT INTO song_adjacency (song_id_1, song_id_2, occurrence_count, avg_distance)
                    VALUES ($1, $2, $3, $4)
                    ON CONFLICT (song_id_1, song_id_2)
                    DO UPDATE SET
                        occurrence_count = song_adjacency.occurrence_count + 1,
                        avg_distance = 1.0
                """, adjacency_records)

                self.logger.debug(f"Created {len(adjacency_records)} adjacencies from playlist {playlist_id}")

        except Exception as e:
            self.logger.error(f"Error creating adjacencies from playlist: {e}")

    async def insert_track_adjacencies_batch(self, conn, batch: List[Dict[str, Any]]):
        """Insert track adjacency relationships into song_adjacency table"""
        try:
            # First, we need to resolve track names to song_ids
            adjacency_records = []
            failed_lookups = 0
            successful_lookups = 0

            for item in batch:
                track1_name = item.get('track1_name', '')
                track2_name = item.get('track2_name', '')

                # Look up song IDs for track names using flexible matching
                # First try exact match, then progressively more flexible
                song_1_query = """
                    SELECT song_id FROM songs
                    WHERE LOWER(TRIM(title)) = LOWER(TRIM($1))
                       OR LOWER(REPLACE(REPLACE(REPLACE(title, ' - ', ' '), ' (', ' '), ')', ''))
                          LIKE LOWER(REPLACE(REPLACE(REPLACE($1, ' - ', ' '), ' (', ' '), ')', '') || '%')
                       OR LOWER(title) LIKE '%' || LOWER(TRIM($1)) || '%'
                    ORDER BY
                        CASE
                            WHEN LOWER(TRIM(title)) = LOWER(TRIM($1)) THEN 1
                            WHEN LOWER(title) LIKE LOWER(TRIM($1)) || '%' THEN 2
                            ELSE 3
                        END
                    LIMIT 1
                """
                song_2_query = """
                    SELECT song_id FROM songs
                    WHERE LOWER(TRIM(title)) = LOWER(TRIM($1))
                       OR LOWER(REPLACE(REPLACE(REPLACE(title, ' - ', ' '), ' (', ' '), ')', ''))
                          LIKE LOWER(REPLACE(REPLACE(REPLACE($1, ' - ', ' '), ' (', ' '), ')', '') || '%')
                       OR LOWER(title) LIKE '%' || LOWER(TRIM($1)) || '%'
                    ORDER BY
                        CASE
                            WHEN LOWER(TRIM(title)) = LOWER(TRIM($1)) THEN 1
                            WHEN LOWER(title) LIKE LOWER(TRIM($1)) || '%' THEN 2
                            ELSE 3
                        END
                    LIMIT 1
                """

                song_1_result = await conn.fetchval(song_1_query, track1_name)
                song_2_result = await conn.fetchval(song_2_query, track2_name)

                if not song_1_result or not song_2_result:
                    if not song_1_result and not song_2_result:
                        self.logger.debug(f"Failed to find both tracks: '{track1_name}' and '{track2_name}'")
                    elif not song_1_result:
                        self.logger.debug(f"Failed to find track1: '{track1_name}'")
                    else:
                        self.logger.debug(f"Failed to find track2: '{track2_name}'")
                    failed_lookups += 1

                if song_1_result and song_2_result and song_1_result != song_2_result:
                    successful_lookups += 1
                    # Ensure song_id_1 < song_id_2 as per schema constraint
                    song_id_1 = min(song_1_result, song_2_result)
                    song_id_2 = max(song_1_result, song_2_result)

                    adjacency_records.append({
                        'song_id_1': song_id_1,
                        'song_id_2': song_id_2,
                        'distance': item.get('distance', 1),
                        'occurrence_count': item.get('occurrence_count', 1)
                    })

            if adjacency_records:
                # Insert/update adjacency relationships
                await conn.executemany("""
                    INSERT INTO song_adjacency (song_id_1, song_id_2, occurrence_count, avg_distance)
                    VALUES ($1, $2, $3, $4)
                    ON CONFLICT (song_id_1, song_id_2)
                    DO UPDATE SET
                        occurrence_count = song_adjacency.occurrence_count + EXCLUDED.occurrence_count,
                        avg_distance = (
                            (song_adjacency.avg_distance * song_adjacency.occurrence_count +
                             EXCLUDED.avg_distance * EXCLUDED.occurrence_count) /
                            (song_adjacency.occurrence_count + EXCLUDED.occurrence_count)
                        )
                """, [
                    (record['song_id_1'], record['song_id_2'],
                     record['occurrence_count'], record['distance'])
                    for record in adjacency_records
                ])

                self.logger.info(f"✓ Inserted/updated {len(adjacency_records)} track adjacency relationships")

            # Log the summary of this batch
            self.logger.info(f"Adjacency batch summary: {successful_lookups} successful, {failed_lookups} failed out of {len(batch)} total")

        except Exception as e:
            self.logger.error(f"Error inserting track adjacencies: {e}")
            raise

    async def flush_all_batches(self):
        """Flush all remaining batches"""
        for batch_type in self.item_batches.keys():
            if self.item_batches[batch_type]:
                await self.flush_batch(batch_type)

    async def process_batch(self, items: List[Any]):
        """Process a batch of items through the pipeline"""
        self.logger.info(f"process_batch called with {len(items)} items")
        self.logger.info(f"Database config: host={self.database_config.get('host')}, port={self.database_config.get('port')}")

        # Log the types and structure of items received
        if items:
            self.logger.info(f"First item type: {type(items[0])}")
            self.logger.info(f"First item keys: {items[0].keys() if isinstance(items[0], dict) else 'Not a dict'}")
            if isinstance(items[0], dict):
                sample = {k: v for k, v in items[0].items() if k in ['track_name', 'artist_name', 'genre']}
                self.logger.info(f"Sample item data: {sample}")

        # Initialize connection pool if not already done
        if not self.connection_pool:
            try:
                self.logger.info("Creating database connection pool...")
                self.connection_pool = await asyncpg.create_pool(
                    **self.database_config,
                    min_size=1,
                    max_size=10,
                    max_queries=50000,
                    max_inactive_connection_lifetime=300,
                    command_timeout=60
                )
                self.logger.info("Database connection pool created successfully")

                # Load target tracks
                await self.load_target_tracks()
                self.logger.info("Target tracks loaded")
            except Exception as e:
                self.logger.error(f"Failed to create connection pool: {e}")
                self.logger.error(f"Database config was: {self.database_config}")
                return

        processed_count = 0
        for item in items:
            try:
                await self.process_item(item, None)
                processed_count += 1
            except Exception as e:
                self.logger.error(f"Error processing item: {e}")
                self.logger.error(f"Item was: {item}")
                continue

        # Flush all batches after processing
        self.logger.info(f"Flushing batches after processing {processed_count} items...")
        await self.flush_all_batches()
        self.logger.info(f"Successfully processed batch of {len(items)} items ({processed_count} succeeded)")

    async def generate_pipeline_statistics(self):
        """Generate and log comprehensive statistics"""
        self.logger.info("\n" + "="*60)
        self.logger.info("ENHANCED SCRAPING PIPELINE STATISTICS")
        self.logger.info("="*60)

        total_items = sum(len(items) for items in self.processed_items.values())
        self.logger.info(f"Total unique items processed: {total_items}")

        for item_type, items in self.processed_items.items():
            self.logger.info(f"  • {item_type}: {len(items)}")

        self.logger.info(f"Target tracks found: {len(self.found_matches)}")

        if self.found_matches:
            self.logger.info("Found target tracks:")
            for key, track in self.found_matches.items():
                self.logger.info(f"  ✓ {track.get('track_name')} - {track.get('primary_artist')}")

        self.logger.info("="*60)

    async def close(self):
        """Close database connection pool"""
        if self.connection_pool:
            await self.connection_pool.close()
            self.logger.info("✓ Database connection pool closed")