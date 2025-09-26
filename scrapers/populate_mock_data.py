#!/usr/bin/env python3
"""
Direct database population script with mock data including complete playlists and adjacency information.
"""

import psycopg2
import random
from datetime import datetime, timedelta
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Database connection
DB_CONFIG = {
    'host': 'localhost',
    'port': 5433,
    'database': 'musicdb',
    'user': 'musicdb_user',
    'password': 'musicdb_secure_pass'
}

def get_connection():
    """Create a database connection."""
    return psycopg2.connect(**DB_CONFIG)

def clear_all_data(conn):
    """Clear all existing data from database."""
    cur = conn.cursor()
    tables = [
        'song_adjacency',
        'playlist_songs',
        'playlists',
        'songs',
        'artists',
        'labels'
    ]

    for table in tables:
        cur.execute(f"DELETE FROM {table}")
        logger.info(f"Cleared table: {table}")

    conn.commit()
    cur.close()

def create_mock_data(conn):
    """Create comprehensive mock data with playlists and adjacency."""
    cur = conn.cursor()

    # Create artists
    artists = [
        'Carl Cox', 'Charlotte de Witte', 'Amelie Lens', 'Tale of Us', 'Solomun',
        'Adam Beyer', 'Nina Kraviz', 'Richie Hawtin', 'Dixon', 'Maceo Plex',
        'Anyma', 'Mathame', 'Kevin de Vries', 'Massano', 'Colyn',
        'Innellea', 'Adriatique', 'Boris Brejcha', 'Stephan Bodzin', 'ARTBAT'
    ]

    artist_ids = {}
    for artist in artists:
        cur.execute(
            "INSERT INTO artists (name, created_at, updated_at) VALUES (%s, %s, %s) RETURNING id",
            (artist, datetime.now(), datetime.now())
        )
        artist_ids[artist] = cur.fetchone()[0]
    logger.info(f"Created {len(artists)} artists")

    # Create labels
    labels = ['Afterlife', 'Drumcode', 'Diynamic', 'Kompakt', 'Innervisions']
    label_ids = {}
    for label in labels:
        cur.execute(
            "INSERT INTO labels (name, created_at, updated_at) VALUES (%s, %s, %s) RETURNING id",
            (label, datetime.now(), datetime.now())
        )
        label_ids[label] = cur.fetchone()[0]
    logger.info(f"Created {len(labels)} labels")

    # Create songs (each artist gets 10-15 tracks)
    song_ids = []
    song_artist_map = {}

    for artist, artist_id in artist_ids.items():
        num_tracks = random.randint(10, 15)
        for i in range(num_tracks):
            track_name = f"{artist} - Track {i+1}"
            genre = random.choice(['Techno', 'Melodic Techno', 'Progressive House', 'Tech House'])
            bpm = random.randint(120, 135)
            key = random.choice(['Am', 'C', 'Dm', 'F', 'G', 'Em'])
            label_id = random.choice(list(label_ids.values()))

            cur.execute("""
                INSERT INTO songs (title, artist_id, genre, bpm, key, label_id, source, created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id
            """, (track_name, artist_id, genre, bpm, key, label_id, '1001tracklists', datetime.now(), datetime.now()))

            song_id = cur.fetchone()[0]
            song_ids.append(song_id)
            song_artist_map[song_id] = artist

    logger.info(f"Created {len(song_ids)} songs")

    # Create playlists/setlists (50 DJ sets)
    playlist_ids = []
    for dj in random.sample(artists, min(15, len(artists))):  # 15 DJs create sets
        for set_num in range(3):  # Each DJ has 3 sets
            venue = random.choice([
                'Printworks London', 'Berghain', 'Fabric', 'DC-10 Ibiza',
                'Watergate Berlin', 'Rex Club Paris', 'Output NYC'
            ])
            event = random.choice(['Awakenings', 'Time Warp', 'Movement', 'Sonar', 'ADE'])

            playlist_name = f"{dj} @ {event} {venue} Set {set_num+1}"
            date_played = datetime.now() - timedelta(days=random.randint(1, 365))

            cur.execute("""
                INSERT INTO playlists (name, dj_name, venue, date_played, source_url, created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id
            """, (
                playlist_name, dj, venue, date_played,
                f'https://example.com/set/{dj.lower().replace(" ", "-")}-{set_num}',
                datetime.now(), datetime.now()
            ))

            playlist_id = cur.fetchone()[0]
            playlist_ids.append(playlist_id)

            # Add 15-25 tracks to each playlist
            num_tracks = random.randint(15, 25)
            selected_songs = random.sample(song_ids, min(num_tracks, len(song_ids)))

            # Create playlist_songs entries with position
            for position, song_id in enumerate(selected_songs, 1):
                cur.execute("""
                    INSERT INTO playlist_songs (playlist_id, song_id, position, created_at, updated_at)
                    VALUES (%s, %s, %s, %s, %s)
                """, (playlist_id, song_id, position, datetime.now(), datetime.now()))

            # Create adjacency relationships for this playlist
            for i in range(len(selected_songs)):
                for j in range(i + 1, min(i + 4, len(selected_songs))):  # Connect tracks within 3 positions
                    song1 = selected_songs[i]
                    song2 = selected_songs[j]
                    distance = j - i

                    # Ensure song1 < song2 for consistency
                    if song1 > song2:
                        song1, song2 = song2, song1

                    transition_type = 'sequential' if distance == 1 else 'close_proximity'

                    # Check if adjacency already exists
                    cur.execute("""
                        SELECT id, occurrence_count FROM song_adjacency
                        WHERE song_id_1 = %s AND song_id_2 = %s
                    """, (song1, song2))

                    existing = cur.fetchone()
                    if existing:
                        # Update occurrence count
                        cur.execute("""
                            UPDATE song_adjacency
                            SET occurrence_count = occurrence_count + 1,
                                avg_distance = (avg_distance * occurrence_count + %s) / (occurrence_count + 1),
                                updated_at = %s
                            WHERE id = %s
                        """, (distance, datetime.now(), existing[0]))
                    else:
                        # Insert new adjacency
                        cur.execute("""
                            INSERT INTO song_adjacency
                            (song_id_1, song_id_2, occurrence_count, avg_distance, transition_type, source_context, created_at, updated_at)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                        """, (song1, song2, 1, distance, transition_type, f'1001tracklists:{playlist_name}',
                              datetime.now(), datetime.now()))

    logger.info(f"Created {len(playlist_ids)} playlists with adjacency data")

    # Commit all changes
    conn.commit()
    cur.close()

    # Get statistics
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM songs")
    song_count = cur.fetchone()[0]

    cur.execute("SELECT COUNT(*) FROM playlists")
    playlist_count = cur.fetchone()[0]

    cur.execute("SELECT COUNT(*) FROM playlist_songs")
    playlist_songs_count = cur.fetchone()[0]

    cur.execute("SELECT COUNT(*) FROM song_adjacency")
    adjacency_count = cur.fetchone()[0]

    cur.execute("""
        SELECT COUNT(DISTINCT song_id)
        FROM (
            SELECT song_id_1 as song_id FROM song_adjacency
            UNION
            SELECT song_id_2 as song_id FROM song_adjacency
        ) AS songs_with_adjacency
    """)
    songs_with_adjacency = cur.fetchone()[0]

    cur.close()

    return {
        'songs': song_count,
        'playlists': playlist_count,
        'playlist_songs': playlist_songs_count,
        'adjacencies': adjacency_count,
        'songs_with_adjacency': songs_with_adjacency
    }

def main():
    """Main function."""
    try:
        conn = get_connection()
        logger.info("Connected to database")

        # Clear existing data
        logger.info("Clearing existing data...")
        clear_all_data(conn)

        # Create mock data
        logger.info("Creating mock data...")
        stats = create_mock_data(conn)

        logger.info("=" * 60)
        logger.info("Data population complete!")
        logger.info(f"Songs created: {stats['songs']}")
        logger.info(f"Playlists created: {stats['playlists']}")
        logger.info(f"Playlist-song relationships: {stats['playlist_songs']}")
        logger.info(f"Adjacency relationships: {stats['adjacencies']}")
        logger.info(f"Songs with adjacency data: {stats['songs_with_adjacency']} / {stats['songs']}")
        logger.info("=" * 60)

        conn.close()

    except Exception as e:
        logger.error(f"Error: {e}")
        raise

if __name__ == "__main__":
    main()