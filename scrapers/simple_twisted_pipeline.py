"""
Simple Twisted-compatible Database Pipeline for SongNodes Scrapers
Basic pipeline to get scrapers working without asyncio conflicts
"""
import os
import json
import logging
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

        # Log the item type and basic info
        if isinstance(item, dict):
            item_type = item.get('item_type', 'unknown')
            self.logger.info(f"Processing item #{self.items_processed}: {item_type}")

            try:
                # Handle track items
                if item_type == 'track' or 'track_name' in item:
                    track_name = item.get('track_name', 'Unknown')
                    artist_name = item.get('artist_name', 'Unknown')
                    self.logger.info(f"  Track: {artist_name} - {track_name}")

                    # Insert artist if not exists and get artist_id
                    result = yield self.dbpool.runQuery("""
                        INSERT INTO artists (name)
                        VALUES (%s)
                        ON CONFLICT (name) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
                        RETURNING artist_id
                    """, (artist_name,))

                    if result and result[0]:
                        artist_id = result[0][0]

                        # Insert song (songs table doesn't have unique constraint on title, so we can insert directly)
                        song_result = yield self.dbpool.runQuery("""
                            INSERT INTO songs (title, primary_artist_id, genre, bpm, key)
                            VALUES (%s, %s, %s, %s, %s)
                            RETURNING song_id
                        """, (
                            track_name,
                            artist_id,
                            item.get('genre', 'Electronic'),
                            item.get('bpm'),
                            item.get('key')
                        ))

                        if song_result and song_result[0]:
                            self.logger.info(f"  ✓ Stored track in database: {artist_name} - {track_name}")
                        else:
                            self.logger.warning(f"  No song_id returned for: {artist_name} - {track_name}")

                # Handle playlist items
                elif item_type == 'playlist':
                    playlist_name = item.get('name', 'Unknown Playlist')
                    dj_name = item.get('dj_name', 'Unknown DJ')
                    venue = item.get('venue', '')

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
                            item.get('source_url', '')
                        ))

                        if playlist_result and playlist_result[0]:
                            self.logger.info(f"  ✓ Stored playlist: {playlist_name}")

                # Handle adjacency items
                elif item_type == 'adjacency':
                    self.logger.info(f"  Adjacency: {item.get('track1_name')} -> {item.get('track2_name')}")
                    # Note: Adjacency requires song IDs which we'd need to look up
                    # For now, just log it

            except Exception as e:
                self.logger.error(f"  Failed to store {item_type}: {e}")
        else:
            self.logger.info(f"Processing item #{self.items_processed}: {type(item).__name__}")

        # Return the item to pass it through
        defer.returnValue(item)