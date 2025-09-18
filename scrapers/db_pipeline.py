"""
PostgreSQL Database Pipeline for Scraped Music Data
Stores scraped data directly into the PostgreSQL database using the schema
"""

import logging
import psycopg2
import psycopg2.extras
from urllib.parse import urlparse
import os
import uuid
from datetime import datetime
import json
from scrapy.exceptions import DropItem


class PostgreSQLPipeline:
    """Pipeline to store scraped items in PostgreSQL database"""

    def __init__(self):
        self.connection = None
        self.cursor = None
        self.logger = logging.getLogger(__name__)

    def open_spider(self, spider):
        """Initialize database connection when spider opens"""
        try:
            # Database connection parameters
            db_params = {
                'host': os.getenv('POSTGRES_HOST', 'localhost'),
                'port': int(os.getenv('POSTGRES_PORT', 5432)),
                'database': os.getenv('POSTGRES_DB', 'musicdb'),
                'user': os.getenv('POSTGRES_USER', 'musicdb_app'),
                'password': os.getenv('POSTGRES_PASSWORD', 'musicdb_pass'),
            }

            self.connection = psycopg2.connect(**db_params)
            self.connection.autocommit = False
            self.cursor = self.connection.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

            # Set search path to musicdb schema
            self.cursor.execute("SET search_path TO musicdb, public;")
            self.connection.commit()

            self.logger.info("PostgreSQL pipeline connected successfully")

        except Exception as e:
            self.logger.error(f"Failed to connect to PostgreSQL: {e}")
            raise

    def close_spider(self, spider):
        """Close database connection when spider closes"""
        if self.cursor:
            self.cursor.close()
        if self.connection:
            self.connection.close()
        self.logger.info("PostgreSQL pipeline closed")

    def process_item(self, item, spider):
        """Process and store item in database"""
        try:
            item_type = type(item).__name__

            if item_type == 'SetlistItem':
                self._insert_setlist(item)
            elif item_type == 'TrackItem':
                self._insert_track(item)
            elif item_type == 'TrackArtistItem':
                self._insert_track_artist(item)
            elif item_type == 'SetlistTrackItem':
                self._insert_setlist_track(item)
            else:
                self.logger.warning(f"Unknown item type: {item_type}")

            self.connection.commit()
            return item

        except Exception as e:
            self.logger.error(f"Error processing {type(item).__name__}: {e}")
            self.connection.rollback()
            raise DropItem(f"Error inserting item: {e}")

    def _insert_setlist(self, item):
        """Insert setlist data"""
        # First, get or create performer
        performer_id = self._get_or_create_performer(item.get('dj_artist_name'))

        # Get or create venue
        venue_id = self._get_or_create_venue(item.get('venue_name')) if item.get('venue_name') else None

        # Get or create event
        event_id = self._get_or_create_event(
            item.get('event_name'),
            venue_id,
            item.get('set_date')
        ) if item.get('event_name') else None

        # Insert setlist
        setlist_query = """
            INSERT INTO setlists (
                performer_id, event_id, set_date, source, source_url,
                source_id, metadata, created_at
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s
            ) ON CONFLICT (source, source_id)
            DO UPDATE SET
                updated_at = CURRENT_TIMESTAMP,
                metadata = EXCLUDED.metadata
            RETURNING id;
        """

        # Extract source from spider name
        source = item.get('source', 'unknown')
        source_id = item.get('setlist_name', str(uuid.uuid4()))

        metadata = {
            'setlist_name': item.get('setlist_name'),
            'last_updated_date': item.get('last_updated_date')
        }

        self.cursor.execute(setlist_query, (
            performer_id,
            event_id,
            item.get('set_date'),
            source,
            item.get('source_url'),
            source_id,
            json.dumps(metadata),
            datetime.now()
        ))

    def _insert_track(self, item):
        """Insert track data"""
        # Normalize track title
        normalized_title = self._normalize_text(item.get('track_name', ''))

        track_query = """
            INSERT INTO tracks (
                title, normalized_title, is_remix, is_mashup,
                mashup_components, metadata, created_at
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s
            ) ON CONFLICT (normalized_title)
            DO UPDATE SET
                updated_at = CURRENT_TIMESTAMP,
                metadata = tracks.metadata || EXCLUDED.metadata
            RETURNING id;
        """

        mashup_components = item.get('mashup_components', [])
        if mashup_components:
            mashup_components = json.dumps(mashup_components)
        else:
            mashup_components = None

        metadata = {
            'track_type': item.get('track_type'),
            'start_time': item.get('start_time'),
            'scraped_at': datetime.now().isoformat()
        }

        self.cursor.execute(track_query, (
            item.get('track_name'),
            normalized_title,
            item.get('is_remix', False),
            item.get('is_mashup', False),
            mashup_components,
            json.dumps(metadata),
            datetime.now()
        ))

    def _insert_track_artist(self, item):
        """Insert track-artist relationship"""
        # Get or create artist
        artist_id = self._get_or_create_artist(item.get('artist_name'))

        # Get track ID
        track_id = self._get_track_id(item.get('track_name'))

        if not track_id:
            self.logger.warning(f"Track not found: {item.get('track_name')}")
            return

        track_artist_query = """
            INSERT INTO track_artists (track_id, artist_id, role, created_at)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (track_id, artist_id, role) DO NOTHING;
        """

        self.cursor.execute(track_artist_query, (
            track_id,
            artist_id,
            item.get('artist_role'),
            datetime.now()
        ))

    def _insert_setlist_track(self, item):
        """Insert setlist-track relationship"""
        # Get setlist ID
        setlist_id = self._get_setlist_id(item.get('setlist_name'))

        # Get track ID
        track_id = self._get_track_id(item.get('track_name'))

        if not setlist_id or not track_id:
            self.logger.warning(f"Setlist or track not found: {item.get('setlist_name')}, {item.get('track_name')}")
            return

        setlist_track_query = """
            INSERT INTO setlist_tracks (
                setlist_id, track_id, position, notes, created_at
            ) VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (setlist_id, position)
            DO UPDATE SET track_id = EXCLUDED.track_id;
        """

        notes = {
            'start_time': item.get('start_time'),
            'track_order': item.get('track_order')
        }

        self.cursor.execute(setlist_track_query, (
            setlist_id,
            track_id,
            item.get('track_order'),
            json.dumps(notes),
            datetime.now()
        ))

    def _get_or_create_artist(self, artist_name):
        """Get existing artist or create new one"""
        if not artist_name:
            return None

        normalized_name = self._normalize_text(artist_name)

        # Check if artist exists
        self.cursor.execute(
            "SELECT id FROM artists WHERE normalized_name = %s;",
            (normalized_name,)
        )
        result = self.cursor.fetchone()

        if result:
            return result['id']

        # Create new artist
        artist_query = """
            INSERT INTO artists (name, normalized_name, created_at)
            VALUES (%s, %s, %s) RETURNING id;
        """

        self.cursor.execute(artist_query, (
            artist_name,
            normalized_name,
            datetime.now()
        ))

        return self.cursor.fetchone()['id']

    def _get_or_create_performer(self, performer_name):
        """Get existing performer or create new one"""
        if not performer_name:
            return None

        normalized_name = self._normalize_text(performer_name)

        # Check if performer exists
        self.cursor.execute(
            "SELECT id FROM performers WHERE normalized_name = %s;",
            (normalized_name,)
        )
        result = self.cursor.fetchone()

        if result:
            return result['id']

        # Create new performer
        performer_query = """
            INSERT INTO performers (name, normalized_name, created_at)
            VALUES (%s, %s, %s) RETURNING id;
        """

        self.cursor.execute(performer_query, (
            performer_name,
            normalized_name,
            datetime.now()
        ))

        return self.cursor.fetchone()['id']

    def _get_or_create_venue(self, venue_name):
        """Get existing venue or create new one"""
        if not venue_name:
            return None

        # Check if venue exists
        self.cursor.execute(
            "SELECT id FROM venues WHERE name ILIKE %s;",
            (venue_name,)
        )
        result = self.cursor.fetchone()

        if result:
            return result['id']

        # Create new venue
        venue_query = """
            INSERT INTO venues (name, created_at)
            VALUES (%s, %s) RETURNING id;
        """

        self.cursor.execute(venue_query, (
            venue_name,
            datetime.now()
        ))

        return self.cursor.fetchone()['id']

    def _get_or_create_event(self, event_name, venue_id, event_date):
        """Get existing event or create new one"""
        if not event_name:
            return None

        # Check if event exists
        self.cursor.execute(
            "SELECT id FROM events WHERE name ILIKE %s AND venue_id = %s;",
            (event_name, venue_id)
        )
        result = self.cursor.fetchone()

        if result:
            return result['id']

        # Create new event
        event_query = """
            INSERT INTO events (name, venue_id, event_date, created_at)
            VALUES (%s, %s, %s, %s) RETURNING id;
        """

        self.cursor.execute(event_query, (
            event_name,
            venue_id,
            event_date,
            datetime.now()
        ))

        return self.cursor.fetchone()['id']

    def _get_track_id(self, track_name):
        """Get track ID by name"""
        if not track_name:
            return None

        normalized_title = self._normalize_text(track_name)

        self.cursor.execute(
            "SELECT id FROM tracks WHERE normalized_title = %s;",
            (normalized_title,)
        )
        result = self.cursor.fetchone()

        return result['id'] if result else None

    def _get_setlist_id(self, setlist_name):
        """Get setlist ID by source_id (setlist_name)"""
        if not setlist_name:
            return None

        self.cursor.execute(
            "SELECT id FROM setlists WHERE source_id = %s;",
            (setlist_name,)
        )
        result = self.cursor.fetchone()

        return result['id'] if result else None

    def _normalize_text(self, text):
        """Normalize text for consistent storage"""
        if not text:
            return ''
        return text.lower().strip()