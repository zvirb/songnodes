"""
Database Pipeline for SongNodes Scrapers
Writes music data directly to PostgreSQL with schema that matches actual database
"""
import asyncio
import asyncpg
import logging
import uuid
from datetime import datetime, date
from typing import Dict, List, Any, Optional


class DatabasePipeline:
    """
    Database pipeline that matches the ACTUAL database schema:
    - artists (artist_id UUID, name, genres[], country)
    - songs (song_id UUID, title, primary_artist_id, genre, bpm, etc.)
    - playlists (playlist_id UUID, name, source, source_url, etc.)
    """

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

    async def open_spider(self, spider):
        """Initialize connection pool when spider starts"""
        try:
            connection_string = f"postgresql://{self.config['user']}:{self.config['password']}@{self.config['host']}:{self.config['port']}/{self.config['database']}"
            self.connection_pool = await asyncpg.create_pool(
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
            )
            self.logger.info("✓ Database connection pool initialized")
        except Exception as e:
            self.logger.error(f"Failed to initialize database connection pool: {e}")
            raise

    async def process_item(self, item, spider):
        """Process a single item and add to appropriate batch"""
        try:
            # Ensure connection pool is initialized (for non-Scrapy usage)
            if not self.connection_pool:
                self.logger.warning("Connection pool not initialized, initializing now...")
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

            return item

        except Exception as e:
            self.logger.error(f"Error processing item: {e}")
            raise

    async def _process_artist_item(self, item):
        """Process artist item"""
        artist_name = item.get('artist_name', '').strip()
        if not artist_name or artist_name in self.processed_items['artists']:
            return

        self.processed_items['artists'].add(artist_name)
        self.item_batches['artists'].append({
            'name': artist_name,
            'genre': item.get('genre'),
            'country': item.get('country')
        })

        if len(self.item_batches['artists']) >= self.batch_size:
            await self._flush_batch('artists')

    async def _process_track_item(self, item):
        """Process track/song item"""
        track_name = item.get('track_name', '').strip()
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
            'title': track_name,
            'artist_name': artist_name,
            'genre': item.get('genre'),
            'bpm': item.get('bpm'),
            'key': item.get('key'),
            'duration_seconds': item.get('duration_seconds'),
            'release_year': item.get('release_year'),
            'label': item.get('label')
        })

        if len(self.item_batches['songs']) >= self.batch_size:
            await self._flush_batch('songs')

    async def _process_playlist_item(self, item):
        """Process playlist item"""
        playlist_name = item.get('name', '').strip()
        if not playlist_name or playlist_name in self.processed_items['playlists']:
            return

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
            'source': item.get('platform', 'unknown') or item.get('source', 'unknown'),
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
        """Process track adjacency item"""
        track1 = item.get('track1_name', '').strip()
        track2 = item.get('track2_name', '').strip()

        if not track1 or not track2 or track1 == track2:
            return

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
            INSERT INTO songs (title, primary_artist_id, genre, bpm, key,
                             duration_seconds, release_year, label)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        """, [
            (
                item['title'],
                item.get('primary_artist_id'),
                item.get('genre'),
                item.get('bpm'),
                item.get('key'),
                item.get('duration_seconds', 0),
                item.get('release_year'),
                item.get('label')
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
        """Flush all batches"""
        for batch_type in self.item_batches:
            await self._flush_batch(batch_type)

    async def close_spider(self, spider):
        """Clean up when spider closes"""
        try:
            await self.flush_all_batches()
            if self.connection_pool:
                await self.connection_pool.close()
            self.logger.info("✓ Database pipeline closed successfully")
        except Exception as e:
            self.logger.error(f"Error closing database pipeline: {e}")