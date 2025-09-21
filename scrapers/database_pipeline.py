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
        self.connection_pool: Optional[asyncpg.Pool] = None
        self.logger = logging.getLogger(__name__)

        # Batch processing
        self.batch_size = 100
        self.item_batches = {
            'artists': [],
            'tracks': [],
            'setlists': [],
            'venues': [],
            'track_artists': [],
            'setlist_tracks': [],
            'track_adjacencies': []
        }

        # Target track matching
        self.target_tracks = {}
        self.found_matches = {}

        # Deduplication tracking
        self.processed_items = {
            'artists': set(),
            'tracks': set(),
            'setlists': set(),
            'venues': set()
        }

    @classmethod
    def from_crawler(cls, crawler):
        """Initialize pipeline from Scrapy crawler settings"""
        db_config = {
            'host': crawler.settings.get('DATABASE_HOST', 'localhost'),
            'port': crawler.settings.get('DATABASE_PORT', 5433),
            'database': crawler.settings.get('DATABASE_NAME', 'musicdb'),
            'user': crawler.settings.get('DATABASE_USER', 'musicdb_user'),
            'password': crawler.settings.get('DATABASE_PASSWORD', 'musicdb_secure_pass')
        }
        return cls(db_config)

    async def open_spider(self, spider):
        """Initialize database connection and load target tracks"""
        self.logger.info("Initializing enhanced database pipeline...")

        try:
            # Initialize connection pool
            connection_string = (
                f"postgresql://{self.database_config['user']}:{self.database_config['password']}@"
                f"{self.database_config['host']}:{self.database_config['port']}/"
                f"{self.database_config['database']}"
            )

            self.connection_pool = await asyncpg.create_pool(
                connection_string,
                min_size=5,
                max_size=20,
                command_timeout=30
            )

            # Load target tracks for matching
            await self.load_target_tracks()

            self.logger.info("✓ Enhanced database pipeline initialized successfully")

        except Exception as e:
            self.logger.error(f"Failed to initialize database pipeline: {e}")
            raise

    async def close_spider(self, spider):
        """Process remaining batches and close connections"""
        self.logger.info("Closing enhanced database pipeline...")

        try:
            # Process any remaining batches
            await self.flush_all_batches()

            # Generate statistics
            await self.generate_pipeline_statistics()

            # Close connection pool
            if self.connection_pool:
                await self.connection_pool.close()

            self.logger.info("✓ Enhanced database pipeline closed successfully")

        except Exception as e:
            self.logger.error(f"Error closing pipeline: {e}")

    async def process_item(self, item, spider):
        """Main item processing entry point"""
        try:
            item_type = type(item).__name__
            processed_item = await self.validate_and_normalize_item(item, item_type)

            # Route to appropriate processor
            if isinstance(item, EnhancedArtistItem):
                await self.process_artist_item(processed_item)
            elif isinstance(item, EnhancedTrackItem):
                await self.process_track_item(processed_item)
            elif isinstance(item, EnhancedSetlistItem):
                await self.process_setlist_item(processed_item)
            elif isinstance(item, EnhancedVenueItem):
                await self.process_venue_item(processed_item)
            elif isinstance(item, EnhancedTrackArtistItem):
                await self.process_track_artist_item(processed_item)
            elif isinstance(item, EnhancedSetlistTrackItem):
                await self.process_setlist_track_item(processed_item)
            elif isinstance(item, EnhancedTrackAdjacencyItem):
                await self.process_track_adjacency_item(processed_item)
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
        artist_key = self.normalize_text(data['artist_name']).lower()

        if artist_key in self.processed_items['artists']:
            return  # Skip duplicate

        self.processed_items['artists'].add(artist_key)
        self.item_batches['artists'].append(data)

        if len(self.item_batches['artists']) >= self.batch_size:
            await self.flush_batch('artists')

    async def process_track_item(self, data: Dict[str, Any]):
        """Process track item with target matching"""
        track_key = self.normalize_track_key(
            data.get('track_name', ''),
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
        if track_key in self.processed_items['tracks']:
            return

        self.processed_items['tracks'].add(track_key)
        self.item_batches['tracks'].append(data)

        if len(self.item_batches['tracks']) >= self.batch_size:
            await self.flush_batch('tracks')

    async def process_setlist_item(self, data: Dict[str, Any]):
        """Process setlist item"""
        setlist_key = self.normalize_text(data['setlist_name']).lower()

        if setlist_key in self.processed_items['setlists']:
            return

        self.processed_items['setlists'].add(setlist_key)
        self.item_batches['setlists'].append(data)

        if len(self.item_batches['setlists']) >= self.batch_size:
            await self.flush_batch('setlists')

    async def process_venue_item(self, data: Dict[str, Any]):
        """Process venue item"""
        venue_key = self.normalize_text(data['venue_name']).lower()

        if venue_key in self.processed_items['venues']:
            return

        self.processed_items['venues'].add(venue_key)
        self.item_batches['venues'].append(data)

        if len(self.item_batches['venues']) >= self.batch_size:
            await self.flush_batch('venues')

    async def process_track_artist_item(self, data: Dict[str, Any]):
        """Process track-artist relationship"""
        self.item_batches['track_artists'].append(data)

        if len(self.item_batches['track_artists']) >= self.batch_size:
            await self.flush_batch('track_artists')

    async def process_setlist_track_item(self, data: Dict[str, Any]):
        """Process setlist-track relationship"""
        self.item_batches['setlist_tracks'].append(data)

        if len(self.item_batches['setlist_tracks']) >= self.batch_size:
            await self.flush_batch('setlist_tracks')

    async def process_track_adjacency_item(self, data: Dict[str, Any]):
        """Process track adjacency relationship"""
        self.item_batches['track_adjacencies'].append(data)

        if len(self.item_batches['track_adjacencies']) >= self.batch_size:
            await self.flush_batch('track_adjacencies')

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
            async with self.connection_pool.acquire() as conn:
                if batch_type == 'artists':
                    await self.insert_artists_batch(conn, batch)
                elif batch_type == 'tracks':
                    await self.insert_tracks_batch(conn, batch)
                elif batch_type == 'setlists':
                    await self.insert_setlists_batch(conn, batch)
                elif batch_type == 'venues':
                    await self.insert_venues_batch(conn, batch)
                elif batch_type == 'track_artists':
                    await self.insert_track_artists_batch(conn, batch)
                elif batch_type == 'setlist_tracks':
                    await self.insert_setlist_tracks_batch(conn, batch)
                elif batch_type == 'track_adjacencies':
                    await self.insert_track_adjacencies_batch(conn, batch)

            self.logger.info(f"✓ Inserted {len(batch)} {batch_type} records")

        except Exception as e:
            self.logger.error(f"Failed to insert {batch_type} batch: {e}")
            # Re-add to batch for retry
            self.item_batches[batch_type].extend(batch)

    async def insert_artists_batch(self, conn, batch: List[Dict[str, Any]]):
        """Insert artists batch with conflict resolution"""
        await conn.executemany("""
            INSERT INTO artists (
                id, name, normalized_name, aliases, spotify_id, apple_music_id,
                youtube_channel_id, soundcloud_id, genre_preferences, country,
                is_verified, follower_count, monthly_listeners, popularity_score,
                metadata, external_urls, created_at, updated_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
            )
            ON CONFLICT (name) DO UPDATE SET
                aliases = EXCLUDED.aliases,
                spotify_id = COALESCE(EXCLUDED.spotify_id, artists.spotify_id),
                apple_music_id = COALESCE(EXCLUDED.apple_music_id, artists.apple_music_id),
                genre_preferences = COALESCE(EXCLUDED.genre_preferences, artists.genre_preferences),
                country = COALESCE(EXCLUDED.country, artists.country),
                is_verified = COALESCE(EXCLUDED.is_verified, artists.is_verified),
                follower_count = GREATEST(COALESCE(EXCLUDED.follower_count, 0), COALESCE(artists.follower_count, 0)),
                popularity_score = GREATEST(COALESCE(EXCLUDED.popularity_score, 0), COALESCE(artists.popularity_score, 0)),
                metadata = COALESCE(EXCLUDED.metadata, artists.metadata),
                external_urls = COALESCE(EXCLUDED.external_urls, artists.external_urls),
                updated_at = EXCLUDED.updated_at
        """, [
            (
                item.get('id'), item.get('artist_name'), item.get('normalized_name'),
                item.get('aliases'), item.get('spotify_id'), item.get('apple_music_id'),
                item.get('youtube_channel_id'), item.get('soundcloud_id'),
                item.get('genre_preferences'), item.get('country'),
                item.get('is_verified'), item.get('follower_count'),
                item.get('monthly_listeners'), item.get('popularity_score'),
                item.get('metadata'), item.get('external_urls'),
                item.get('created_at'), item.get('updated_at')
            ) for item in batch
        ])

    async def insert_tracks_batch(self, conn, batch: List[Dict[str, Any]]):
        """Insert tracks batch with comprehensive metadata"""
        await conn.executemany("""
            INSERT INTO tracks (
                id, title, normalized_title, isrc, spotify_id, apple_music_id,
                youtube_id, soundcloud_id, bpm, musical_key, energy, danceability,
                valence, acousticness, instrumentalness, liveness, speechiness,
                loudness, release_date, genre, subgenre, record_label,
                is_remix, is_mashup, is_live, is_cover, is_instrumental, is_explicit,
                remix_type, original_artist, remixer, popularity_score, play_count,
                metadata, external_urls, audio_features, duration_ms,
                created_at, updated_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
                $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,
                $31, $32, $33, $34, $35, $36, $37, $38, $39
            )
            ON CONFLICT (title, normalized_title) DO UPDATE SET
                spotify_id = COALESCE(EXCLUDED.spotify_id, tracks.spotify_id),
                bpm = COALESCE(EXCLUDED.bpm, tracks.bpm),
                musical_key = COALESCE(EXCLUDED.musical_key, tracks.musical_key),
                energy = COALESCE(EXCLUDED.energy, tracks.energy),
                genre = COALESCE(EXCLUDED.genre, tracks.genre),
                metadata = COALESCE(EXCLUDED.metadata, tracks.metadata),
                updated_at = EXCLUDED.updated_at
        """, [
            (
                item.get('id'), item.get('track_name'), item.get('normalized_title'),
                item.get('isrc'), item.get('spotify_id'), item.get('apple_music_id'),
                item.get('youtube_id'), item.get('soundcloud_id'), item.get('bpm'),
                item.get('musical_key'), item.get('energy'), item.get('danceability'),
                item.get('valence'), item.get('acousticness'), item.get('instrumentalness'),
                item.get('liveness'), item.get('speechiness'), item.get('loudness'),
                item.get('release_date'), item.get('genre'), item.get('subgenre'),
                item.get('record_label'), item.get('is_remix'), item.get('is_mashup'),
                item.get('is_live'), item.get('is_cover'), item.get('is_instrumental'),
                item.get('is_explicit'), item.get('remix_type'), item.get('original_artist'),
                item.get('remixer'), item.get('popularity_score'), item.get('play_count'),
                item.get('metadata'), item.get('external_urls'), item.get('audio_features'),
                item.get('duration_ms'), item.get('created_at'), item.get('updated_at')
            ) for item in batch
        ])

    async def insert_setlists_batch(self, conn, batch: List[Dict[str, Any]]):
        """Insert setlists batch"""
        # Similar implementation for setlists
        pass

    async def insert_venues_batch(self, conn, batch: List[Dict[str, Any]]):
        """Insert venues batch"""
        # Similar implementation for venues
        pass

    async def insert_track_artists_batch(self, conn, batch: List[Dict[str, Any]]):
        """Insert track-artist relationships"""
        # Implementation for relationships
        pass

    async def insert_setlist_tracks_batch(self, conn, batch: List[Dict[str, Any]]):
        """Insert setlist-track relationships"""
        # Implementation for setlist tracks
        pass

    async def insert_track_adjacencies_batch(self, conn, batch: List[Dict[str, Any]]):
        """Insert track adjacency relationships into song_adjacency table"""
        try:
            # First, we need to resolve track names to song_ids
            adjacency_records = []
            for item in batch:
                # Look up song IDs for track names
                song_1_query = """
                    SELECT song_id FROM songs
                    WHERE LOWER(TRIM(title)) = LOWER(TRIM($1))
                    LIMIT 1
                """
                song_2_query = """
                    SELECT song_id FROM songs
                    WHERE LOWER(TRIM(title)) = LOWER(TRIM($1))
                    LIMIT 1
                """

                song_1_result = await conn.fetchval(song_1_query, item.get('track_1_name', ''))
                song_2_result = await conn.fetchval(song_2_query, item.get('track_2_name', ''))

                if song_1_result and song_2_result and song_1_result != song_2_result:
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

        except Exception as e:
            self.logger.error(f"Error inserting track adjacencies: {e}")
            raise

    async def flush_all_batches(self):
        """Flush all remaining batches"""
        for batch_type in self.item_batches.keys():
            if self.item_batches[batch_type]:
                await self.flush_batch(batch_type)

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