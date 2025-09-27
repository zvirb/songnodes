"""
Twisted-compatible database operations for Scrapy
This module provides synchronous database methods that work with Twisted's database pool
"""

import psycopg2
from psycopg2.extras import execute_batch
from datetime import datetime
import uuid
from typing import List, Dict, Any
import logging

logger = logging.getLogger(__name__)


def insert_track_adjacencies_batch_sync(txn, batch: List[Dict[str, Any]]):
    """Insert track adjacency batch using Twisted database transaction"""
    if not batch:
        return

    # Step 1: Collect all unique track references
    all_tracks = set()
    for item in batch:
        track1 = (item.get('track1_name', '').strip(), item.get('track1_artist', '').strip())
        track2 = (item.get('track2_name', '').strip(), item.get('track2_artist', '').strip())
        if track1[0] and track1[1]:
            all_tracks.add(track1)
        if track2[0] and track2[1]:
            all_tracks.add(track2)

    # Step 2: Look up song IDs for all tracks with flexible matching
    track_to_id = {}
    for title, artist in all_tracks:
        # Try multiple matching strategies
        queries = [
            # Exact title match first (we can't match by artist text since only artist_id exists)
            ("""
                SELECT song_id FROM songs
                WHERE LOWER(TRIM(title)) = LOWER(%s)
                LIMIT 1
            """, (title,)),
            # Flexible title matching with variations
            ("""
                SELECT song_id FROM songs
                WHERE LOWER(REPLACE(REPLACE(REPLACE(title, ' - ', ' '), ' (', ' '), ')', ''))
                    LIKE LOWER(REPLACE(REPLACE(REPLACE(%s, ' - ', ' '), ' (', ' '), ')', '') || '%%')
                LIMIT 1
            """, (title,)),
            # Partial match for fuzzy matching
            ("""
                SELECT song_id FROM songs
                WHERE LOWER(title) LIKE '%%' || LOWER(%s) || '%%'
                LIMIT 1
            """, (title,))
        ]

        song_id = None
        for query, params in queries:
            txn.execute(query, params)
            result = txn.fetchone()
            if result:
                song_id = result[0]
                break

        if song_id:
            track_to_id[(title, artist)] = song_id
            logger.debug(f"Found song_id for '{title}' by '{artist}': {song_id}")
        else:
            logger.warning(f"Could not find song_id for '{title}' by '{artist}'")

    # Step 3: Prepare adjacency records
    adjacency_records = []
    for item in batch:
        track1 = (item.get('track1_name', '').strip(), item.get('track1_artist', '').strip())
        track2 = (item.get('track2_name', '').strip(), item.get('track2_artist', '').strip())

        song_id_1 = track_to_id.get(track1)
        song_id_2 = track_to_id.get(track2)

        if song_id_1 and song_id_2 and song_id_1 != song_id_2:
            # Ensure consistent ordering (smaller ID first)
            if song_id_1 > song_id_2:
                song_id_1, song_id_2 = song_id_2, song_id_1

            adjacency_records.append((
                song_id_1,
                song_id_2,
                item.get('occurrence_count', 1),
                item.get('distance', 1.0)
            ))

    # Step 4: Batch insert adjacencies
    if adjacency_records:
        insert_query = """
            INSERT INTO song_adjacency (song_id_1, song_id_2, occurrence_count, avg_distance)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (song_id_1, song_id_2) DO UPDATE
            SET occurrence_count = song_adjacency.occurrence_count + EXCLUDED.occurrence_count,
                avg_distance = (song_adjacency.avg_distance * song_adjacency.occurrence_count +
                               EXCLUDED.avg_distance * EXCLUDED.occurrence_count) /
                              (song_adjacency.occurrence_count + EXCLUDED.occurrence_count)
        """

        execute_batch(txn, insert_query, adjacency_records, page_size=100)
        logger.info(f"✓ Inserted/updated {len(adjacency_records)} track adjacency relationships")
    else:
        logger.warning(f"No valid adjacency records to insert from {len(batch)} items")


def insert_songs_batch_sync(txn, batch: List[Dict[str, Any]]):
    """Insert songs batch using Twisted database transaction"""
    if not batch:
        return

    song_records = []
    for item in batch:
        song_id = item.get('song_id') or item.get('id') or str(uuid.uuid4())

        # Convert duration
        duration_seconds = None
        if item.get('duration_ms'):
            duration_seconds = int(item.get('duration_ms', 0) / 1000)
        elif item.get('duration_seconds'):
            duration_seconds = item.get('duration_seconds')

        # Convert release date to year
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
            item.get('primary_artist_id'),  # Only the ID, not the text
            duration_seconds,
            item.get('spotify_id'),
            item.get('musicbrainz_id'),
            item.get('genre', ''),
            item.get('bpm'),
            item.get('key', ''),
            item.get('label', ''),
            release_year,
            item.get('isrc'),
            datetime.now(),
            datetime.now()
        ))

    # Insert with only the columns that actually exist in the database
    insert_query = """
        INSERT INTO songs (
            song_id, title, primary_artist_id,
            duration_seconds, spotify_id, musicbrainz_id,
            genre, bpm, key, label, release_year, isrc,
            created_at, updated_at
        ) VALUES (
            %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
        )
        ON CONFLICT (song_id) DO UPDATE SET
            spotify_id = COALESCE(EXCLUDED.spotify_id, songs.spotify_id),
            bpm = COALESCE(EXCLUDED.bpm, songs.bpm),
            key = COALESCE(EXCLUDED.key, songs.key),
            genre = COALESCE(NULLIF(EXCLUDED.genre, ''), songs.genre),
            updated_at = EXCLUDED.updated_at
    """

    execute_batch(txn, insert_query, song_records, page_size=100)
    logger.info(f"✓ Inserted/updated {len(song_records)} songs")


def insert_artists_batch_sync(txn, batch: List[Dict[str, Any]]):
    """Insert artists batch using Twisted database transaction"""
    if not batch:
        return

    records = []
    for item in batch:
        record = (
            item.get('artist_id', str(uuid.uuid4())),
            item.get('name', item.get('artist_name', 'Unknown')),
            item.get('spotify_id'),
            item.get('musicbrainz_id'),
            item.get('genres', []),
            item.get('country'),
            item.get('aliases', []),
            datetime.now(),
            datetime.now()
        )
        records.append(record)

    insert_query = """
        INSERT INTO artists (
            artist_id, name, spotify_id, musicbrainz_id,
            genres, country, aliases, created_at, updated_at
        ) VALUES (
            %s, %s, %s, %s, %s, %s, %s, %s, %s
        )
        ON CONFLICT (artist_id) DO UPDATE SET
            spotify_id = COALESCE(EXCLUDED.spotify_id, artists.spotify_id),
            genres = COALESCE(EXCLUDED.genres, artists.genres),
            updated_at = EXCLUDED.updated_at
    """

    execute_batch(txn, insert_query, records, page_size=100)
    logger.info(f"✓ Inserted/updated {len(records)} artists")


def insert_playlists_batch_sync(txn, batch: List[Dict[str, Any]]):
    """Insert playlists batch using Twisted database transaction"""
    if not batch:
        return

    records = []
    for item in batch:
        # Parse event_date if provided
        event_date = None
        if item.get('event_date'):
            try:
                if isinstance(item['event_date'], str):
                    from dateutil import parser
                    event_date = parser.parse(item['event_date']).date()
                else:
                    event_date = item['event_date']
            except:
                pass

        record = (
            item.get('playlist_id', str(uuid.uuid4())),
            item.get('name', 'Unknown Playlist'),
            item.get('source', 'unknown'),
            item.get('source_url'),
            item.get('playlist_type'),
            item.get('dj_artist_id'),
            item.get('event_name'),
            item.get('venue_id'),
            event_date,
            item.get('duration_minutes'),
            item.get('tracklist_count', 0),
            item.get('play_count'),
            item.get('like_count'),
            datetime.now(),
            datetime.now()
        )
        records.append(record)

    insert_query = """
        INSERT INTO playlists (
            playlist_id, name, source, source_url, playlist_type,
            dj_artist_id, event_name, venue_id, event_date,
            duration_minutes, tracklist_count, play_count, like_count,
            created_at, updated_at
        ) VALUES (
            %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
        )
        ON CONFLICT (playlist_id) DO UPDATE SET
            tracklist_count = EXCLUDED.tracklist_count,
            updated_at = EXCLUDED.updated_at
    """

    execute_batch(txn, insert_query, records, page_size=100)
    logger.info(f"✓ Inserted/updated {len(records)} playlists")


def insert_venues_batch_sync(txn, batch: List[Dict[str, Any]]):
    """Insert venues batch using Twisted database transaction"""
    if not batch:
        return

    records = []
    for item in batch:
        record = (
            item.get('venue_id', str(uuid.uuid4())),
            item.get('name', 'Unknown Venue'),
            item.get('city'),
            item.get('state'),
            item.get('country'),
            item.get('latitude'),
            item.get('longitude'),
            item.get('capacity'),
            item.get('venue_type'),
            datetime.now(),
            datetime.now()
        )
        records.append(record)

    insert_query = """
        INSERT INTO venues (
            venue_id, name, city, state, country,
            latitude, longitude, capacity, venue_type,
            created_at, updated_at
        ) VALUES (
            %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
        )
        ON CONFLICT (venue_id) DO UPDATE SET
            capacity = COALESCE(EXCLUDED.capacity, venues.capacity),
            updated_at = EXCLUDED.updated_at
    """

    execute_batch(txn, insert_query, records, page_size=100)
    logger.info(f"✓ Inserted/updated {len(records)} venues")


def insert_song_artists_batch_sync(txn, batch: List[Dict[str, Any]]):
    """Insert song-artist relationships using Twisted database transaction"""
    if not batch:
        return

    records = []
    for item in batch:
        records.append((
            item.get('song_id'),
            item.get('artist_id'),
            item.get('role', 'primary'),
            item.get('position', 0)
        ))

    insert_query = """
        INSERT INTO song_artists (song_id, artist_id, role, position)
        VALUES (%s, %s, %s, %s)
        ON CONFLICT (song_id, artist_id) DO NOTHING
    """

    execute_batch(txn, insert_query, records, page_size=100)
    logger.info(f"✓ Inserted {len(records)} song-artist relationships")


def insert_playlist_songs_batch_sync(txn, batch: List[Dict[str, Any]]):
    """Insert playlist-song relationships using Twisted database transaction"""
    if not batch:
        return

    # First, look up song IDs
    song_lookup = {}
    for item in batch:
        title = item.get('track_name', '').strip()
        artist = item.get('artist_name', '').strip()

        if title:
            # Flexible matching for songs (simplified since we can't match by artist)
            txn.execute("""
                SELECT song_id FROM songs
                WHERE LOWER(TRIM(title)) = LOWER(%s)
                   OR LOWER(REPLACE(REPLACE(REPLACE(title, ' - ', ' '), ' (', ' '), ')', ''))
                      LIKE LOWER(REPLACE(REPLACE(REPLACE(%s, ' - ', ' '), ' (', ' '), ')', '') || '%%')
                   OR LOWER(title) LIKE '%%' || LOWER(TRIM(%s)) || '%%'
                ORDER BY
                    CASE
                        WHEN LOWER(TRIM(title)) = LOWER(TRIM(%s)) THEN 1
                        WHEN LOWER(title) LIKE LOWER(TRIM(%s)) || '%%' THEN 2
                        ELSE 3
                    END
                LIMIT 1
            """, (title, title, title, title, title))

            result = txn.fetchone()
            if result:
                song_lookup[(title, artist)] = result[0]

    # Insert playlist-song relationships
    records = []
    for item in batch:
        title = item.get('track_name', '').strip()
        artist = item.get('artist_name', '').strip()
        song_id = song_lookup.get((title, artist)) or item.get('song_id')

        if song_id and item.get('playlist_id'):
            records.append((
                item.get('playlist_id'),
                song_id,
                item.get('position', 0),
                datetime.now()
            ))

    if records:
        insert_query = """
            INSERT INTO playlist_songs (playlist_id, song_id, position, added_at)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (playlist_id, song_id) DO UPDATE
            SET position = EXCLUDED.position
        """

        execute_batch(txn, insert_query, records, page_size=100)
        logger.info(f"✓ Inserted {len(records)} playlist-song relationships")