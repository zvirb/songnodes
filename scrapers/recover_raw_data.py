#!/usr/bin/env python3
"""
Raw Data Recovery Script for SongNodes
Recovers and imports data from raw_scrape_data table (Oct 7-9, 2025)

This script processes raw scrape data that failed to import due to async/await issues.
It reads the JSONB raw_data column and feeds items directly through the modern persistence pipeline.

Usage:
    python recover_raw_data.py [--limit N] [--batch-size N] [--dry-run]
"""
import asyncio
import asyncpg
import json
import logging
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional
from collections import defaultdict
import argparse

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))
sys.path.insert(0, str(Path(__file__).parent.parent / 'services' / 'common'))

# Import secrets manager with fallback
try:
    from secrets_manager import get_database_config, validate_secrets
except ImportError:
    # Fallback for environments without secrets_manager
    import os
    from urllib.parse import urlparse

    def get_database_config(host_override=None, port_override=None):
        # Try to parse DATABASE_URL first
        db_url = os.getenv('DATABASE_URL')
        if db_url:
            parsed = urlparse(db_url)
            # Use host_override if provided, otherwise use 'postgres' (direct connection, not pgbouncer)
            host = host_override if host_override else 'postgres'
            port = port_override if port_override else 5432
            return {
                'host': host,
                'port': port,
                'database': parsed.path.lstrip('/') or 'musicdb',
                'user': parsed.username or 'musicdb_user',
                'password': parsed.password or 'musicdb_secure_pass_2024'
            }

        # Fallback to individual env vars
        return {
            'host': host_override or os.getenv('DATABASE_HOST', 'postgres'),
            'port': port_override or int(os.getenv('DATABASE_PORT', '5432')),
            'database': os.getenv('DATABASE_NAME', 'musicdb'),
            'user': os.getenv('DATABASE_USER', 'musicdb_user'),
            'password': os.getenv('DATABASE_PASSWORD', os.getenv('POSTGRES_PASSWORD', 'musicdb_secure_pass_2024'))
        }

    def validate_secrets():
        return True

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class RawDataRecovery:
    """Recovers data from raw_scrape_data table and feeds through persistence pipeline"""

    def __init__(self, db_config: Optional[Dict] = None, use_localhost: bool = False):
        """
        Initialize raw data recovery.

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
        self.stats = {
            'processed': 0,
            'failed': 0,
            'skipped': 0,
            'by_type': defaultdict(int)
        }

    async def initialize(self):
        """Initialize database connections"""
        connection_string = (
            f"postgresql://{self.db_config['user']}:{self.db_config['password']}"
            f"@{self.db_config['host']}:{self.db_config['port']}/{self.db_config['database']}"
        )

        self.connection_pool = await asyncpg.create_pool(
            connection_string,
            min_size=5,
            max_size=15,
            command_timeout=60
        )

        logger.info("✓ Database connection pool initialized")

    async def fetch_raw_scrapes(
        self,
        start_date: str = '2025-10-07',
        end_date: str = '2025-10-10',
        limit: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """
        Fetch raw scrape data from database.

        Args:
            start_date: Start date string (YYYY-MM-DD)
            end_date: End date string (YYYY-MM-DD)
            limit: Optional limit on number of records

        Returns:
            List of raw scrape records
        """
        # Convert date strings to datetime objects
        from datetime import datetime as dt
        start_dt = dt.strptime(start_date, '%Y-%m-%d')
        end_dt = dt.strptime(end_date, '%Y-%m-%d')

        async with self.connection_pool.acquire() as conn:
            query = """
                SELECT scrape_id, source, scrape_type, raw_data, scraped_at
                FROM raw_scrape_data
                WHERE scraped_at >= $1
                  AND scraped_at < $2
                ORDER BY scraped_at, scrape_type
            """

            if limit:
                query += f" LIMIT {limit}"

            rows = await conn.fetch(query, start_dt, end_dt)
            logger.info(f"Fetched {len(rows)} raw scrape records from {start_date} to {end_date}")

            return [dict(row) for row in rows]

    def _parse_metadata_field(self, raw_data: Dict[str, Any]) -> Dict[str, Any]:
        """Parse metadata field if it's a stringified JSON"""
        metadata = raw_data.get('metadata', {})
        if isinstance(metadata, str):
            try:
                return json.loads(metadata)
            except (json.JSONDecodeError, TypeError):
                return {}
        return metadata if isinstance(metadata, dict) else {}

    def _parse_json_field(self, value: Any, default: Any = {}) -> Any:
        """Parse any field that might be stringified JSON"""
        if isinstance(value, str):
            try:
                return json.loads(value)
            except (json.JSONDecodeError, TypeError):
                return default
        return value if value is not None else default

    def transform_enhanced_artist(self, raw_data: Dict[str, Any]) -> Dict[str, Any]:
        """Transform EnhancedArtist to pipeline format"""
        # Parse metadata and external_urls if stringified
        metadata = self._parse_metadata_field(raw_data)
        external_urls = self._parse_json_field(raw_data.get('external_urls'), {})

        return {
            'item_type': 'artist',
            'artist_name': raw_data.get('artist_name', '').strip(),
            'genre': raw_data.get('primary_genre'),
            'genres': raw_data.get('genre_tags', []),
            'country': raw_data.get('country'),
            'popularity_score': raw_data.get('popularity_score'),
            'spotify_id': external_urls.get('spotify') if isinstance(external_urls, dict) else None,
            'apple_music_id': external_urls.get('apple_music') if isinstance(external_urls, dict) else None,
            'soundcloud_id': external_urls.get('soundcloud') if isinstance(external_urls, dict) else None,
            'data_source': raw_data.get('data_source', 'mixesdb')
        }

    def transform_enhanced_setlist(self, raw_data: Dict[str, Any]) -> Dict[str, Any]:
        """Transform EnhancedSetlist to pipeline format"""
        # Parse metadata and external_urls if stringified
        metadata = self._parse_metadata_field(raw_data)
        external_urls = self._parse_json_field(raw_data.get('external_urls'), {})

        return {
            'item_type': 'playlist',
            'setlist_name': raw_data.get('setlist_name', '').strip(),
            'name': raw_data.get('setlist_name', '').strip(),
            'dj_artist_name': raw_data.get('dj_artist_name', '').strip(),
            'event_name': raw_data.get('event_name'),
            'event_type': raw_data.get('event_type'),
            'event_date': raw_data.get('set_date'),
            'set_date': raw_data.get('set_date'),
            'venue_name': raw_data.get('venue_name'),
            'venue_location': raw_data.get('venue_location'),
            'total_tracks': raw_data.get('total_tracks', 0),
            'tracklist_count': raw_data.get('total_tracks', 0),
            'duration_minutes': raw_data.get('duration_minutes'),
            'genre_tags': raw_data.get('genre_tags', []),
            'mood_tags': raw_data.get('mood_tags', []),
            'audio_quality': raw_data.get('audio_quality'),
            'source_url': external_urls.get('mixesdb') if isinstance(external_urls, dict) else None,
            'external_urls': external_urls,
            'data_source': raw_data.get('data_source', 'mixesdb'),
            'description': raw_data.get('description'),
            'parsing_version': 'recovery_script_v1',
            'created_at': raw_data.get('created_at'),
            'updated_at': raw_data.get('updated_at')
        }

    def transform_enhanced_track(self, raw_data: Dict[str, Any]) -> Dict[str, Any]:
        """Transform EnhancedTrack to pipeline format"""
        # Parse external_urls if stringified
        external_urls = self._parse_json_field(raw_data.get('external_urls'), {})

        return {
            'item_type': 'track',
            'track_id': raw_data.get('track_id'),
            'track_name': raw_data.get('track_name', '').strip(),
            'title': raw_data.get('track_name', '').strip(),
            'normalized_title': raw_data.get('normalized_title', '').strip(),
            'genre': raw_data.get('genre'),
            'bpm': raw_data.get('bpm'),
            'musical_key': raw_data.get('musical_key'),
            'key': raw_data.get('musical_key'),
            'duration_seconds': raw_data.get('duration_seconds'),
            'record_label': raw_data.get('record_label'),
            'label': raw_data.get('record_label'),
            'catalog_number': raw_data.get('catalog_number'),
            'is_remix': raw_data.get('is_remix', False),
            'is_mashup': raw_data.get('is_mashup', False),
            'is_live': raw_data.get('is_live', False),
            'is_cover': raw_data.get('is_cover', False),
            'is_instrumental': raw_data.get('is_instrumental', False),
            'is_explicit': raw_data.get('is_explicit', False),
            'remix_type': raw_data.get('remix_type'),
            'track_type': raw_data.get('track_type'),
            'popularity_score': raw_data.get('popularity_score', 0),
            'position_in_source': raw_data.get('position_in_source'),
            'start_time': raw_data.get('start_time'),
            'source_context': raw_data.get('source_context'),
            'external_urls': external_urls,
            'data_source': raw_data.get('data_source', 'mixesdb'),
            'created_at': raw_data.get('created_at'),
            'updated_at': raw_data.get('updated_at')
        }

    def transform_enhanced_track_artist(self, raw_data: Dict[str, Any]) -> Dict[str, Any]:
        """Transform EnhancedTrackArtist to track-artist relationship"""
        return {
            'item_type': 'track_artist',
            'track_name': raw_data.get('track_name', '').strip(),
            'artist_name': raw_data.get('artist_name', '').strip(),
            'artist_role': raw_data.get('artist_role', 'Primary'),
            'data_source': raw_data.get('data_source', 'mixesdb')
        }

    def transform_enhanced_setlist_track(self, raw_data: Dict[str, Any]) -> Dict[str, Any]:
        """Transform EnhancedSetlistTrack to playlist_track relationship"""
        return {
            'item_type': 'playlist_track',
            'setlist_name': raw_data.get('setlist_name', '').strip(),
            'playlist_name': raw_data.get('setlist_name', '').strip(),
            'track_name': raw_data.get('track_name', '').strip(),
            'position': raw_data.get('position_in_set'),
            'start_time': raw_data.get('start_time'),
            'data_source': raw_data.get('data_source', 'mixesdb')
        }

    def transform_enhanced_track_adjacency(self, raw_data: Dict[str, Any]) -> Dict[str, Any]:
        """Transform EnhancedTrackAdjacency to track_adjacency"""
        # Parse external_urls if stringified
        external_urls = self._parse_json_field(raw_data.get('external_urls'), {})

        return {
            'item_type': 'track_adjacency',
            'track1_name': raw_data.get('track_1_name', '').strip(),
            'track1_artist': raw_data.get('track_1_primary_artist', '').strip(),
            'track2_name': raw_data.get('track_2_name', '').strip(),
            'track2_artist': raw_data.get('track_2_primary_artist', '').strip(),
            'distance': raw_data.get('distance', 1),
            'occurrence_count': 1,
            'source_context': raw_data.get('context_setlist', ''),
            'source_url': external_urls.get('mixesdb_context') if isinstance(external_urls, dict) else None,
            'data_source': raw_data.get('data_source', 'mixesdb')
        }

    def transform_playlist(self, raw_data: Dict[str, Any]) -> Dict[str, Any]:
        """Transform basic Playlist to pipeline format"""
        return {
            'item_type': 'playlist',
            'name': raw_data.get('name', '').strip(),
            'setlist_name': raw_data.get('name', '').strip(),
            'source': raw_data.get('source', 'scraped_data'),
            'source_url': raw_data.get('source_url'),
            'dj_artist_name': raw_data.get('dj_name') or raw_data.get('curator'),
            'event_date': raw_data.get('playlist_date') or raw_data.get('event_date'),
            'total_tracks': raw_data.get('total_tracks', 0),
            'data_source': raw_data.get('platform', 'mixesdb'),
            'parsing_version': 'recovery_script_v1'
        }

    async def transform_raw_data(self, scrape_record: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Transform raw_data JSONB to pipeline-compatible format.

        Args:
            scrape_record: Raw scrape record with raw_data JSONB

        Returns:
            Transformed item or None if transformation fails
        """
        scrape_type = scrape_record['scrape_type']
        raw_data = scrape_record['raw_data']

        # asyncpg returns JSONB as dict directly, but handle string case defensively
        if isinstance(raw_data, str):
            try:
                raw_data = json.loads(raw_data)
            except json.JSONDecodeError as e:
                logger.error(f"Invalid JSON in raw_data for {scrape_type}: {e}")
                return None

        # Validate that raw_data is now a dict
        if not isinstance(raw_data, dict):
            logger.error(f"raw_data is not a dict for {scrape_type}: {type(raw_data)}")
            return None

        try:
            if scrape_type == 'enhancedartist':
                return self.transform_enhanced_artist(raw_data)
            elif scrape_type == 'enhancedsetlist':
                return self.transform_enhanced_setlist(raw_data)
            elif scrape_type == 'enhancedtrack':
                return self.transform_enhanced_track(raw_data)
            elif scrape_type == 'enhancedtrackartist':
                return self.transform_enhanced_track_artist(raw_data)
            elif scrape_type == 'enhancedsetlisttrack':
                return self.transform_enhanced_setlist_track(raw_data)
            elif scrape_type == 'enhancedtrackadjacency':
                return self.transform_enhanced_track_adjacency(raw_data)
            elif scrape_type == 'playlist':
                return self.transform_playlist(raw_data)
            else:
                logger.warning(f"Unknown scrape_type: {scrape_type}")
                return None

        except Exception as e:
            logger.error(f"Error transforming {scrape_type}: {e} | raw_data type: {type(raw_data)} | raw_data: {str(raw_data)[:200]}")
            import traceback
            logger.debug(traceback.format_exc())
            return None

    async def insert_items_directly(self, items: List[Dict[str, Any]], batch_size: int = 100):
        """
        Insert items directly into database using persistence pipeline's SQL logic.

        Args:
            items: List of transformed items
            batch_size: Number of items to process per batch
        """
        # Group items by type for efficient batch processing
        items_by_type = defaultdict(list)
        for item in items:
            item_type = item.get('item_type')
            if item_type:
                items_by_type[item_type].append(item)

        async with self.connection_pool.acquire() as conn:
            # Process in dependency order: artists -> tracks -> playlists -> relationships

            # 1. Insert artists
            if items_by_type['artist']:
                logger.info(f"Inserting {len(items_by_type['artist'])} artists...")
                await self._insert_artists(conn, items_by_type['artist'])

            # 2. Insert tracks
            if items_by_type['track']:
                logger.info(f"Inserting {len(items_by_type['track'])} tracks...")
                await self._insert_tracks(conn, items_by_type['track'])

            # 3. Insert playlists
            if items_by_type['playlist']:
                logger.info(f"Inserting {len(items_by_type['playlist'])} playlists...")
                await self._insert_playlists(conn, items_by_type['playlist'])

            # 4. Insert track_artists (requires artists and tracks to exist)
            if items_by_type['track_artist']:
                logger.info(f"Inserting {len(items_by_type['track_artist'])} track_artists...")
                await self._insert_track_artists(conn, items_by_type['track_artist'])

            # 5. Insert playlists
            if items_by_type['playlist_track']:
                logger.info(f"Inserting {len(items_by_type['playlist_track'])} playlist_tracks...")
                await self._insert_playlist_tracks(conn, items_by_type['playlist_track'])

            # 6. Insert song_adjacency (requires tracks to exist)
            if items_by_type['track_adjacency']:
                logger.info(f"Inserting {len(items_by_type['track_adjacency'])} song_adjacencies...")
                await self._insert_adjacencies(conn, items_by_type['track_adjacency'])

    async def _insert_artists(self, conn, artists: List[Dict[str, Any]]):
        """Insert artists with upsert logic"""
        for artist in artists:
            try:
                await conn.execute("""
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
                """,
                    artist.get('artist_name'),
                    artist.get('genres', []) or [artist.get('genre')] if artist.get('genre') else None,
                    artist.get('country'),
                    artist.get('popularity_score'),
                    artist.get('spotify_id'),
                    artist.get('apple_music_id'),
                    artist.get('soundcloud_id')
                )
                self.stats['by_type']['artist'] += 1
            except Exception as e:
                logger.warning(f"Error inserting artist {artist.get('artist_name')}: {e}")
                self.stats['failed'] += 1

    async def _insert_tracks(self, conn, tracks: List[Dict[str, Any]]):
        """Insert tracks with upsert logic"""
        for track in tracks:
            try:
                title = track.get('track_name') or track.get('title', '').strip()
                if not title:
                    continue

                normalized_title = track.get('normalized_title') or title.lower().strip()

                await conn.execute("""
                    INSERT INTO tracks (
                        title, normalized_title, genre, bpm, key,
                        duration_ms, popularity_score,
                        is_remix, is_mashup, is_live, is_cover, is_instrumental, is_explicit
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                    ON CONFLICT (title, normalized_title) DO UPDATE SET
                        genre = COALESCE(EXCLUDED.genre, tracks.genre),
                        bpm = COALESCE(EXCLUDED.bpm, tracks.bpm),
                        key = COALESCE(EXCLUDED.key, tracks.key),
                        duration_ms = COALESCE(EXCLUDED.duration_ms, tracks.duration_ms),
                        popularity_score = COALESCE(EXCLUDED.popularity_score, tracks.popularity_score),
                        updated_at = CURRENT_TIMESTAMP
                """,
                    title,
                    normalized_title,
                    track.get('genre'),
                    float(track.get('bpm')) if track.get('bpm') else None,
                    track.get('key') or track.get('musical_key'),
                    int(track.get('duration_seconds', 0) * 1000) if track.get('duration_seconds') else None,
                    track.get('popularity_score', 0),
                    track.get('is_remix', False),
                    track.get('is_mashup', False),
                    track.get('is_live', False),
                    track.get('is_cover', False),
                    track.get('is_instrumental', False),
                    track.get('is_explicit', False)
                )
                self.stats['by_type']['track'] += 1
            except Exception as e:
                logger.warning(f"Error inserting track {track.get('track_name')}: {e}")
                self.stats['failed'] += 1

    async def _insert_track_artists(self, conn, track_artists: List[Dict[str, Any]]):
        """Insert track-artist relationships"""
        for ta in track_artists:
            try:
                track_name = ta.get('track_name', '').strip()
                artist_name = ta.get('artist_name', '').strip()
                artist_role = ta.get('artist_role', 'Primary')

                if not track_name or not artist_name:
                    continue

                # Get artist ID (create if doesn't exist)
                artist_id = await conn.fetchval(
                    "SELECT artist_id FROM artists WHERE name = $1 LIMIT 1",
                    artist_name
                )

                if not artist_id:
                    # Artist doesn't exist, create it
                    artist_id = await conn.fetchval("""
                        INSERT INTO artists (name)
                        VALUES ($1)
                        ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
                        RETURNING artist_id
                    """, artist_name)

                # Get track ID
                track_id = await conn.fetchval(
                    "SELECT id FROM tracks WHERE title = $1 LIMIT 1",
                    track_name
                )

                if not track_id:
                    logger.debug(f"Track not found for track_artist: {track_name}")
                    continue

                # Map artist_role to lowercase for database enum
                role_map = {
                    'Primary': 'primary',
                    'Featured': 'featured',
                    'Remixer': 'remixer',
                    'Producer': 'producer'
                }
                db_role = role_map.get(artist_role, 'primary')

                # Insert track_artist relationship
                await conn.execute("""
                    INSERT INTO track_artists (track_id, artist_id, role)
                    VALUES ($1, $2, $3)
                    ON CONFLICT (track_id, artist_id, role) DO NOTHING
                """,
                    track_id,
                    artist_id,
                    db_role
                )
                self.stats['by_type']['track_artist'] += 1

            except Exception as e:
                logger.debug(f"Error inserting track_artist ({ta.get('track_name')} - {ta.get('artist_name')}): {e}")
                self.stats['failed'] += 1

    async def _insert_playlists(self, conn, playlists: List[Dict[str, Any]]):
        """Insert playlists with validation"""
        for playlist in playlists:
            try:
                name = playlist.get('setlist_name') or playlist.get('name', '').strip()
                if not name:
                    continue

                # Convert date string to date object if needed
                event_date = playlist.get('event_date') or playlist.get('set_date')
                if event_date and isinstance(event_date, str):
                    try:
                        if 'T' in event_date:
                            event_date = datetime.fromisoformat(event_date.replace('Z', '+00:00').split('.')[0]).date()
                        else:
                            event_date = datetime.strptime(event_date, '%Y-%m-%d').date()
                    except:
                        event_date = None

                existing = await conn.fetchval(
                    "SELECT playlist_id FROM playlists WHERE name = $1 AND source = $2",
                    name, playlist.get('source') or playlist.get('data_source', 'mixesdb')
                )

                if not existing:
                    await conn.execute("""
                        INSERT INTO playlists (
                            name, source, source_url, playlist_type, event_date,
                            tracklist_count, parsing_version
                        )
                        VALUES ($1, $2, $3, $4, $5, $6, $7)
                    """,
                        name,
                        playlist.get('source') or playlist.get('data_source', 'mixesdb'),
                        playlist.get('source_url'),
                        playlist.get('playlist_type') or playlist.get('event_type'),
                        event_date,
                        playlist.get('tracklist_count', playlist.get('total_tracks', 0)),
                        playlist.get('parsing_version', 'recovery_script_v1')
                    )
                    self.stats['by_type']['playlist'] += 1
                else:
                    self.stats['skipped'] += 1

            except Exception as e:
                logger.warning(f"Error inserting playlist {playlist.get('setlist_name')}: {e}")
                self.stats['failed'] += 1

    async def _insert_playlist_tracks(self, conn, playlist_tracks: List[Dict[str, Any]]):
        """Insert playlist-track relationships"""
        for pt in playlist_tracks:
            try:
                playlist_name = pt.get('playlist_name') or pt.get('setlist_name', '').strip()
                track_name = pt.get('track_name', '').strip()
                position = pt.get('position')

                if not playlist_name or not track_name or position is None:
                    continue

                # Get playlist ID
                playlist_id = await conn.fetchval(
                    "SELECT playlist_id FROM playlists WHERE name = $1 LIMIT 1",
                    playlist_name
                )

                if not playlist_id:
                    logger.debug(f"Playlist not found: {playlist_name}")
                    continue

                # Get track ID
                track_id = await conn.fetchval(
                    "SELECT id FROM tracks WHERE title = $1 LIMIT 1",
                    track_name
                )

                if not track_id:
                    logger.debug(f"Track not found: {track_name}")
                    continue

                await conn.execute("""
                    INSERT INTO playlist_tracks (playlist_id, position, track_id)
                    VALUES ($1, $2, $3)
                    ON CONFLICT (playlist_id, position) DO UPDATE SET
                        track_id = EXCLUDED.track_id
                """,
                    playlist_id,
                    position,
                    track_id
                )
                self.stats['by_type']['playlist_track'] += 1

            except Exception as e:
                logger.debug(f"Error inserting playlist_track: {e}")
                self.stats['failed'] += 1

    async def _insert_adjacencies(self, conn, adjacencies: List[Dict[str, Any]]):
        """Insert track adjacencies"""
        for adj in adjacencies:
            try:
                track1_name = adj.get('track1_name', '').strip()
                track2_name = adj.get('track2_name', '').strip()

                if not track1_name or not track2_name or track1_name == track2_name:
                    continue

                # Get track IDs
                track1_id = await conn.fetchval(
                    "SELECT id FROM tracks WHERE title = $1 LIMIT 1",
                    track1_name
                )
                track2_id = await conn.fetchval(
                    "SELECT id FROM tracks WHERE title = $1 LIMIT 1",
                    track2_name
                )

                if not track1_id or not track2_id:
                    continue

                # Ensure song_id_1 < song_id_2 for CHECK constraint
                if str(track1_id) > str(track2_id):
                    track1_id, track2_id = track2_id, track1_id

                await conn.execute("""
                    INSERT INTO song_adjacency (song_id_1, song_id_2, occurrence_count, avg_distance)
                    VALUES ($1, $2, $3, $4)
                    ON CONFLICT (song_id_1, song_id_2) DO UPDATE SET
                        occurrence_count = song_adjacency.occurrence_count + 1,
                        avg_distance = ((song_adjacency.avg_distance * song_adjacency.occurrence_count) + $4) /
                                       (song_adjacency.occurrence_count + 1)
                """,
                    track1_id,
                    track2_id,
                    1,
                    float(adj.get('distance', 1.0))
                )
                self.stats['by_type']['song_adjacency'] += 1

            except Exception as e:
                logger.debug(f"Error inserting adjacency: {e}")
                self.stats['failed'] += 1

    async def recover_data(
        self,
        start_date: str = '2025-10-07',
        end_date: str = '2025-10-10',
        limit: Optional[int] = None,
        batch_size: int = 500,
        dry_run: bool = False
    ):
        """
        Main recovery function.

        Args:
            start_date: Start date for recovery
            end_date: End date for recovery
            limit: Optional limit on records to process
            batch_size: Batch size for processing
            dry_run: If True, only transform but don't insert
        """
        logger.info("=" * 80)
        logger.info("RAW DATA RECOVERY - STARTING")
        logger.info("=" * 80)
        logger.info(f"Date range: {start_date} to {end_date}")
        logger.info(f"Limit: {limit if limit else 'None'}")
        logger.info(f"Batch size: {batch_size}")
        logger.info(f"Dry run: {dry_run}")
        logger.info("=" * 80)

        # Fetch raw scrape records
        raw_scrapes = await self.fetch_raw_scrapes(start_date, end_date, limit)

        if not raw_scrapes:
            logger.warning("No raw scrape data found in specified date range")
            return

        # Transform all items
        logger.info("Transforming raw data to pipeline format...")
        transformed_items = []
        for record in raw_scrapes:
            item = await self.transform_raw_data(record)
            if item:
                transformed_items.append(item)
                self.stats['processed'] += 1
            else:
                self.stats['failed'] += 1

        logger.info(f"✓ Transformed {len(transformed_items)} items")

        if dry_run:
            logger.info("DRY RUN - Skipping database insertion")
            logger.info(f"Sample transformed item: {json.dumps(transformed_items[0], indent=2, default=str)}")
        else:
            # Insert items in batches
            logger.info("Inserting items into database...")
            for i in range(0, len(transformed_items), batch_size):
                batch = transformed_items[i:i + batch_size]
                logger.info(f"Processing batch {i // batch_size + 1} ({len(batch)} items)...")
                await self.insert_items_directly(batch, batch_size)

        # Print statistics
        logger.info("=" * 80)
        logger.info("RAW DATA RECOVERY - COMPLETE")
        logger.info("=" * 80)
        logger.info(f"Total records fetched: {len(raw_scrapes)}")
        logger.info(f"Successfully transformed: {self.stats['processed']}")
        logger.info(f"Failed to transform: {self.stats['failed']}")
        logger.info(f"Skipped (duplicates): {self.stats['skipped']}")
        logger.info("")
        logger.info("Items inserted by type:")
        for item_type, count in sorted(self.stats['by_type'].items()):
            logger.info(f"  {item_type}: {count}")
        logger.info("=" * 80)

    async def close(self):
        """Close database connections"""
        if self.connection_pool:
            await self.connection_pool.close()
            logger.info("✓ Database connection pool closed")


async def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description='Recover raw scrape data from database')
    parser.add_argument('--start-date', default='2025-10-07', help='Start date (YYYY-MM-DD)')
    parser.add_argument('--end-date', default='2025-10-10', help='End date (YYYY-MM-DD)')
    parser.add_argument('--limit', type=int, help='Limit number of records to process')
    parser.add_argument('--batch-size', type=int, default=500, help='Batch size for processing')
    parser.add_argument('--dry-run', action='store_true', help='Transform only, do not insert')
    parser.add_argument('--use-localhost', action='store_true', help='Connect to localhost:5433 (for host execution)')

    args = parser.parse_args()

    # Validate secrets
    logger.info("Validating secrets...")
    if not validate_secrets():
        logger.error("❌ Required secrets missing - cannot start recovery")
        sys.exit(1)

    recovery = RawDataRecovery(use_localhost=args.use_localhost)

    try:
        await recovery.initialize()
        await recovery.recover_data(
            start_date=args.start_date,
            end_date=args.end_date,
            limit=args.limit,
            batch_size=args.batch_size,
            dry_run=args.dry_run
        )
    except Exception as e:
        logger.error(f"Fatal error during recovery: {e}")
        import traceback
        logger.error(traceback.format_exc())
        sys.exit(1)
    finally:
        await recovery.close()


if __name__ == "__main__":
    asyncio.run(main())
