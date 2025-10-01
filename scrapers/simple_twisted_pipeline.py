"""
Simple Twisted-compatible Database Pipeline for SongNodes Scrapers
Basic pipeline to get scrapers working without asyncio conflicts
"""
import os
import json
import logging
import re
from typing import Dict, List, Any
from urllib.parse import urlparse
from scrapy.exceptions import DropItem
from twisted.internet import defer
from twisted.internet.defer import inlineCallbacks
from twisted.enterprise import adbapi
import psycopg2
import psycopg2.extras


class SimpleMusicDatabasePipeline:
    """Simple Twisted-compatible pipeline for testing"""

    def __init__(self, database_config: Dict[str, Any]):
        self.database_config = database_config
        self.dbpool = None
        self.logger = logging.getLogger(__name__)
        self.items_processed = 0

    def _detect_remix_mashup(self, title: str) -> Dict[str, Any]:
        """
        Detect remix and mashup characteristics from track title.

        Returns dict with: is_remix, is_mashup, remix_type, remixer
        """
        is_remix = bool(re.search(r'\b(remix|edit|mix|rework|bootleg|vip|radio edit)\b', title, re.IGNORECASE))
        is_mashup = bool(re.search(r'\b(vs\.?|mashup|mash-up)\b', title, re.IGNORECASE))

        remix_type = None
        remixer = None

        if is_remix:
            # Extract remix type: "Track Name (Artist Remix)"
            remix_match = re.search(r'\(([^)]*?(remix|edit|mix|rework))\)', title, re.IGNORECASE)
            if remix_match:
                remix_type = remix_match.group(1).strip()
                # Extract remixer name (text before "Remix")
                remixer_match = re.search(r'([^(]+?)\s+(remix|edit|mix)', remix_match.group(1), re.IGNORECASE)
                if remixer_match:
                    remixer = remixer_match.group(1).strip()

        return {
            'is_remix': is_remix,
            'is_mashup': is_mashup,
            'remix_type': remix_type,
            'remixer': remixer
        }

    @classmethod
    def from_crawler(cls, crawler):
        """Initialize pipeline from Scrapy crawler settings"""
        # Try to get database URL from environment first
        DATABASE_URL = os.environ.get('DATABASE_URL')

        if DATABASE_URL:
            # Parse DATABASE_URL for connection parameters
            parsed_url = urlparse(DATABASE_URL)
            db_config = {
                'host': parsed_url.hostname,
                'port': parsed_url.port or 5432,
                'database': parsed_url.path.lstrip('/'),
                'user': parsed_url.username,
                'password': parsed_url.password
            }
        else:
            # Fallback to individual settings
            db_config = {
                'host': crawler.settings.get('DATABASE_HOST', 'localhost'),
                'port': crawler.settings.get('DATABASE_PORT', 5433),
                'database': crawler.settings.get('DATABASE_NAME', 'musicdb'),
                'user': crawler.settings.get('DATABASE_USER', 'musicdb_user'),
                'password': crawler.settings.get('DATABASE_PASSWORD', 'musicdb_secure_pass')
            }

        return cls(db_config)

    @inlineCallbacks
    def open_spider(self, spider):
        """Initialize database connection"""
        self.logger.info("Initializing simple database pipeline...")

        try:
            # Initialize Twisted database connection pool
            self.dbpool = adbapi.ConnectionPool(
                'psycopg2',
                host=self.database_config['host'],
                port=self.database_config['port'],
                database=self.database_config['database'],
                user=self.database_config['user'],
                password=self.database_config['password'],
                cp_min=2,
                cp_max=10,
                cp_noisy=False
            )

            # Test connection
            yield self.dbpool.runQuery("SELECT 1")
            self.logger.info("✓ Database connection successful")

        except Exception as e:
            self.logger.error(f"Failed to initialize database: {e}")
            raise

    @inlineCallbacks
    def close_spider(self, spider):
        """Close database connections"""
        self.logger.info(f"Closing pipeline. Items processed: {self.items_processed}")
        if self.dbpool:
            self.dbpool.close()

    @inlineCallbacks
    def process_item(self, item, spider):
        """Process items - store basic data in database"""
        self.items_processed += 1

        # Convert Scrapy Item to dict if needed
        if hasattr(item, '__class__'):
            item_class_name = item.__class__.__name__
        else:
            item_class_name = 'unknown'

        # Convert Scrapy Item to dict for easier processing
        if not isinstance(item, dict):
            item_dict = dict(item)
        else:
            item_dict = item

        # Determine item type
        if item_class_name == 'TrackItem' or 'track_name' in item_dict:
            item_type = 'track'
        elif item_class_name == 'PlaylistItem' or 'playlist_id' in item_dict:
            item_type = 'playlist'
        else:
            item_type = item_dict.get('item_type', 'unknown')

        self.logger.info(f"Processing item #{self.items_processed}: {item_class_name}")

        try:
            # Handle track items
            if item_type == 'track':
                track_name = item_dict.get('track_name', 'Unknown')

                # Extract artist name from track_name if it's in "Artist - Title" format
                if ' - ' in track_name and 'artist_name' not in item_dict:
                    parts = track_name.split(' - ', 1)
                    artist_name = parts[0].strip()
                    actual_track_name = parts[1].strip() if len(parts) > 1 else track_name
                else:
                    artist_name = item_dict.get('artist_name', 'Unknown')
                    actual_track_name = track_name

                # Detect remix/mashup characteristics from title
                remix_info = self._detect_remix_mashup(actual_track_name)

                self.logger.info(
                    f"  Track: {artist_name} - {actual_track_name} "
                    f"(remix={remix_info['is_remix']}, mashup={remix_info['is_mashup']})"
                )

                # Insert artist if not exists and get artist_id
                result = yield self.dbpool.runQuery("""
                    INSERT INTO artists (name)
                    VALUES (%s)
                    ON CONFLICT (name) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
                    RETURNING artist_id
                """, (artist_name,))

                if result and result[0]:
                    artist_id = result[0][0]

                    # Insert song with remix/mashup metadata
                    # Note: songs table only has is_remix/is_mashup boolean flags
                    # remix_type and remixer are stored in the tracks view
                    song_result = yield self.dbpool.runQuery("""
                        INSERT INTO songs (
                            title, primary_artist_id, genre, bpm, key,
                            is_remix, is_mashup
                        )
                        VALUES (%s, %s, %s, %s, %s, %s, %s)
                        RETURNING song_id
                    """, (
                        actual_track_name,
                        artist_id,
                        item_dict.get('genre', 'Electronic'),
                        item_dict.get('bpm'),
                        item_dict.get('key'),
                        remix_info['is_remix'],
                        remix_info['is_mashup']
                    ))

                    if song_result and song_result[0]:
                        self.logger.info(f"  ✓ Stored track in database: {artist_name} - {actual_track_name}")
                    else:
                        self.logger.warning(f"  No song_id returned for: {artist_name} - {actual_track_name}")

            # Handle playlist items
            elif item_type == 'playlist':
                playlist_name = item_dict.get('name', 'Unknown Playlist')
                dj_name = item_dict.get('dj_name', 'Unknown DJ')
                venue = item_dict.get('venue', '')

                self.logger.info(f"  Playlist: {playlist_name} by {dj_name}")

                # Get or create DJ as artist
                dj_result = yield self.dbpool.runQuery("""
                    INSERT INTO artists (name)
                    VALUES (%s)
                    ON CONFLICT (name) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
                    RETURNING artist_id
                """, (dj_name,))

                if dj_result and dj_result[0]:
                    dj_artist_id = dj_result[0][0]

                    # Insert playlist with correct schema
                    playlist_result = yield self.dbpool.runQuery("""
                        INSERT INTO playlists (name, source, dj_artist_id, event_name, source_url)
                        VALUES (%s, %s, %s, %s, %s)
                        RETURNING playlist_id
                    """, (
                        playlist_name,
                        spider.name,  # Use spider name as source
                        dj_artist_id,
                        venue,  # Use venue as event_name for now
                        item_dict.get('source_url', '')
                    ))

                    if playlist_result and playlist_result[0]:
                        self.logger.info(f"  ✓ Stored playlist: {playlist_name}")

            # Handle adjacency items
            elif item_type == 'adjacency':
                track_1_name = item_dict.get('track_1_name')
                track_2_name = item_dict.get('track_2_name')
                distance = item_dict.get('distance', 1)

                self.logger.info(f"  Adjacency: {track_1_name} -> {track_2_name} (distance={distance})")

                # Look up song IDs by track name
                try:
                    # Query for both song IDs
                    query = """
                        SELECT song_id, title FROM songs
                        WHERE title = %s OR title = %s
                        ORDER BY created_at DESC
                        LIMIT 2
                    """
                    result = yield self.dbpool.runQuery(query, (track_1_name, track_2_name))

                    if result and len(result) == 2:
                        # Map song IDs
                        song_ids = {}
                        for row in result:
                            song_id, title = row
                            song_ids[title] = song_id

                        song_id_1 = song_ids.get(track_1_name)
                        song_id_2 = song_ids.get(track_2_name)

                        if song_id_1 and song_id_2:
                            # Ensure song_id_1 < song_id_2 (table constraint)
                            if song_id_1 > song_id_2:
                                song_id_1, song_id_2 = song_id_2, song_id_1

                            # Insert or update adjacency
                            adj_result = yield self.dbpool.runQuery("""
                                INSERT INTO song_adjacency (song_id_1, song_id_2, occurrence_count, avg_distance)
                                VALUES (%s, %s, 1, %s)
                                ON CONFLICT (song_id_1, song_id_2) DO UPDATE
                                SET occurrence_count = song_adjacency.occurrence_count + 1,
                                    avg_distance = (COALESCE(song_adjacency.avg_distance, 0) * song_adjacency.occurrence_count + %s)
                                                   / (song_adjacency.occurrence_count + 1)
                            """, (song_id_1, song_id_2, float(distance), float(distance)))

                            self.logger.info(f"  ✓ Stored adjacency edge in database")
                        else:
                            self.logger.warning(f"  ⚠️ Could not find song IDs for adjacency")
                    else:
                        self.logger.warning(f"  ⚠️ Could not find both songs for adjacency")

                except Exception as adj_error:
                    self.logger.error(f"  Failed to store adjacency: {adj_error}")

        except Exception as e:
            self.logger.error(f"  Failed to store {item_type}: {e}")

        # Return the item to pass it through
        defer.returnValue(item)