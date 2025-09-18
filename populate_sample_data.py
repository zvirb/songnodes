#!/usr/bin/env python3
"""
Populate database with sample electronic music setlist data
for testing the song adjacency graph visualization
"""

import psycopg2
import uuid
import logging
from datetime import datetime, timedelta
import random
import json

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Sample electronic music tracks and artists
ELECTRONIC_ARTISTS = [
    "Swedish House Mafia", "David Guetta", "Calvin Harris", "Deadmau5",
    "Skrillex", "Marshmello", "Martin Garrix", "Tiësto", "Armin van Buuren",
    "Above & Beyond", "Eric Prydz", "Alesso", "Hardwell", "Afrojack"
]

ELECTRONIC_TRACKS = [
    # Swedish House Mafia
    ("Don't You Worry Child", ["Swedish House Mafia"]),
    ("Save The World", ["Swedish House Mafia"]),
    ("One", ["Swedish House Mafia"]),
    ("Greyhound", ["Swedish House Mafia"]),
    ("Miami 2 Ibiza", ["Swedish House Mafia", "Tinie Tempah"]),

    # David Guetta
    ("Titanium", ["David Guetta", "Sia"]),
    ("When Love Takes Over", ["David Guetta", "Kelly Rowland"]),
    ("Memories", ["David Guetta", "Kid Cudi"]),
    ("Without You", ["David Guetta", "Usher"]),
    ("Turn Me On", ["David Guetta", "Nicki Minaj"]),

    # Calvin Harris
    ("Feel So Close", ["Calvin Harris"]),
    ("Summer", ["Calvin Harris"]),
    ("This Is What You Came For", ["Calvin Harris", "Rihanna"]),
    ("How Deep Is Your Love", ["Calvin Harris", "Disciples"]),
    ("Outside", ["Calvin Harris", "Ellie Goulding"]),

    # Deadmau5
    ("Ghosts 'n' Stuff", ["Deadmau5"]),
    ("Strobe", ["Deadmau5"]),
    ("I Remember", ["Deadmau5", "Kaskade"]),
    ("Raise Your Weapon", ["Deadmau5"]),
    ("Some Chords", ["Deadmau5"]),

    # Skrillex
    ("Bangarang", ["Skrillex"]),
    ("Scary Monsters and Nice Sprites", ["Skrillex"]),
    ("First of the Year", ["Skrillex"]),
    ("Cinema", ["Skrillex"]),
    ("Make It Bun Dem", ["Skrillex", "Damian Marley"]),

    # Martin Garrix
    ("Animals", ["Martin Garrix"]),
    ("Scared to Be Lonely", ["Martin Garrix", "Dua Lipa"]),
    ("In the Name of Love", ["Martin Garrix", "Bebe Rexha"]),
    ("Tremor", ["Martin Garrix", "Dimitri Vegas & Like Mike"]),
    ("Wizard", ["Martin Garrix", "Jay Hardway"]),

    # Tiësto
    ("Adagio for Strings", ["Tiësto"]),
    ("Traffic", ["Tiësto"]),
    ("Red Lights", ["Tiësto"]),
    ("Wasted", ["Tiësto", "Matthew Koma"]),
    ("The Business", ["Tiësto"]),

    # Alesso
    ("Heroes", ["Alesso", "Tove Lo"]),
    ("Calling", ["Alesso", "Ryan Tedder"]),
    ("Under Control", ["Alesso", "Calvin Harris", "Hurts"]),
    ("If I Lose Myself", ["Alesso vs OneRepublic"]),
    ("Years", ["Alesso", "Matthew Koma"]),

    # Eric Prydz
    ("Call on Me", ["Eric Prydz"]),
    ("Pjanoo", ["Eric Prydz"]),
    ("Liberate", ["Eric Prydz"]),
    ("Every Day", ["Eric Prydz"]),
    ("Generate", ["Eric Prydz"]),
]

VENUES = [
    ("Ultra Music Festival", "Miami", "FL", "USA"),
    ("Tomorrowland", "Boom", None, "Belgium"),
    ("EDC Las Vegas", "Las Vegas", "NV", "USA"),
    ("Creamfields", "Daresbury", None, "UK"),
    ("Electric Zoo", "New York", "NY", "USA"),
]

def create_tables(conn):
    """Create necessary tables if they don't exist"""
    cursor = conn.cursor()

    # Create tables
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS performers (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name VARCHAR(255) NOT NULL,
            type VARCHAR(50),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(name)
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS artists (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name VARCHAR(255) NOT NULL,
            normalized_name VARCHAR(255),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(name)
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS tracks (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            title VARCHAR(500) NOT NULL,
            normalized_title VARCHAR(500),
            duration_ms INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS track_artists (
            track_id UUID REFERENCES tracks(id),
            artist_id UUID REFERENCES artists(id),
            PRIMARY KEY (track_id, artist_id)
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS venues (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name VARCHAR(255) NOT NULL,
            city VARCHAR(255),
            state VARCHAR(50),
            country VARCHAR(100),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(name, city)
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS setlists (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            source_id VARCHAR(255) UNIQUE,
            performer_id UUID REFERENCES performers(id),
            venue_id UUID REFERENCES venues(id),
            event_date DATE,
            metadata JSONB,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS setlist_tracks (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            setlist_id UUID REFERENCES setlists(id),
            track_id UUID REFERENCES tracks(id),
            track_order INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    conn.commit()
    logger.info("Tables created successfully")

def populate_sample_data(conn):
    """Populate database with sample electronic music setlists"""
    cursor = conn.cursor()

    # Insert artists
    artist_ids = {}
    for artist_name in ELECTRONIC_ARTISTS:
        cursor.execute("""
            INSERT INTO artists (name, normalized_name)
            VALUES (%s, %s)
            ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
            RETURNING id
        """, (artist_name, artist_name.lower()))
        artist_ids[artist_name] = cursor.fetchone()[0]

    # Insert additional featured artists
    for track_title, artists in ELECTRONIC_TRACKS:
        for artist_name in artists:
            if artist_name not in artist_ids:
                cursor.execute("""
                    INSERT INTO artists (name, normalized_name)
                    VALUES (%s, %s)
                    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
                    RETURNING id
                """, (artist_name, artist_name.lower()))
                artist_ids[artist_name] = cursor.fetchone()[0]

    # Insert performers (DJs)
    performer_ids = {}
    for performer_name in ELECTRONIC_ARTISTS[:10]:  # Use first 10 as performers
        cursor.execute("""
            INSERT INTO performers (name, type)
            VALUES (%s, %s)
            ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
            RETURNING id
        """, (performer_name, 'DJ'))
        performer_ids[performer_name] = cursor.fetchone()[0]

    # Insert venues
    venue_ids = {}
    for venue_name, city, state, country in VENUES:
        cursor.execute("""
            INSERT INTO venues (name, city, state, country)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (name, city) DO UPDATE SET name = EXCLUDED.name
            RETURNING id
        """, (venue_name, city, state, country))
        venue_ids[venue_name] = cursor.fetchone()[0]

    # Insert tracks with artists
    track_ids = {}
    for track_title, artists in ELECTRONIC_TRACKS:
        # Insert track
        cursor.execute("""
            INSERT INTO tracks (title, normalized_title, duration_ms)
            VALUES (%s, %s, %s)
            RETURNING id
        """, (track_title, track_title.lower(), random.randint(180000, 420000)))
        track_id = cursor.fetchone()[0]
        track_ids[track_title] = track_id

        # Link track to artists
        for artist_name in artists:
            cursor.execute("""
                INSERT INTO track_artists (track_id, artist_id)
                VALUES (%s, %s)
                ON CONFLICT DO NOTHING
            """, (track_id, artist_ids[artist_name]))

    # Create setlists with track sequences
    setlist_count = 0
    for performer_name in list(performer_ids.keys())[:8]:  # Create setlists for 8 DJs
        performer_id = performer_ids[performer_name]

        # Create 3-5 setlists per performer at different venues
        num_setlists = random.randint(3, 5)
        for i in range(num_setlists):
            venue_name = random.choice(list(venue_ids.keys()))
            venue_id = venue_ids[venue_name]

            # Random date in the last year
            event_date = datetime.now() - timedelta(days=random.randint(1, 365))

            # Create setlist
            source_id = f"{performer_name.replace(' ', '_')}_{venue_name.replace(' ', '_')}_{event_date.strftime('%Y%m%d')}"
            metadata = {
                "festival": venue_name,
                "year": event_date.year,
                "genre": "electronic",
                "stage": random.choice(["Main Stage", "Circuit Grounds", "Neon Garden"])
            }

            cursor.execute("""
                INSERT INTO setlists (source_id, performer_id, venue_id, event_date, metadata)
                VALUES (%s, %s, %s, %s, %s)
                RETURNING id
            """, (source_id, performer_id, venue_id, event_date, json.dumps(metadata)))
            setlist_id = cursor.fetchone()[0]
            setlist_count += 1

            # Add 8-15 tracks to the setlist
            num_tracks = random.randint(8, 15)
            available_tracks = list(track_ids.keys())
            random.shuffle(available_tracks)

            # Create a setlist with some popular tracks appearing more frequently
            popular_tracks = ["Titanium", "Animals", "Don't You Worry Child", "Feel So Close",
                            "Bangarang", "Heroes", "One", "Summer", "Strobe", "Call on Me"]

            setlist_tracks = []
            # Start with 2-3 popular tracks
            for track in random.sample([t for t in popular_tracks if t in available_tracks],
                                      min(3, len([t for t in popular_tracks if t in available_tracks]))):
                setlist_tracks.append(track)

            # Fill with other tracks
            for track in available_tracks:
                if track not in setlist_tracks and len(setlist_tracks) < num_tracks:
                    setlist_tracks.append(track)

            # Shuffle but keep some structure (popular tracks tend to be in certain positions)
            random.shuffle(setlist_tracks[3:])  # Shuffle non-opener tracks

            # Insert tracks into setlist with order
            for order, track_title in enumerate(setlist_tracks[:num_tracks], 1):
                cursor.execute("""
                    INSERT INTO setlist_tracks (setlist_id, track_id, track_order)
                    VALUES (%s, %s, %s)
                """, (setlist_id, track_ids[track_title], order))

    conn.commit()
    logger.info(f"Populated {setlist_count} electronic music setlists with track sequences")

    # Show some statistics
    cursor.execute("SELECT COUNT(*) FROM tracks")
    track_count = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM setlist_tracks")
    setlist_track_count = cursor.fetchone()[0]

    cursor.execute("""
        SELECT st1.track_id, st2.track_id, COUNT(*) as frequency
        FROM setlist_tracks st1
        JOIN setlist_tracks st2 ON st1.setlist_id = st2.setlist_id
            AND st2.track_order = st1.track_order + 1
        GROUP BY st1.track_id, st2.track_id
        ORDER BY frequency DESC
        LIMIT 5
    """)
    top_adjacencies = cursor.fetchall()

    logger.info(f"Database now contains:")
    logger.info(f"  - {track_count} tracks")
    logger.info(f"  - {setlist_count} setlists")
    logger.info(f"  - {setlist_track_count} track entries in setlists")
    logger.info(f"  - Top adjacencies: {top_adjacencies}")

def main():
    """Main entry point"""
    # Connect to database
    conn = psycopg2.connect(
        host='localhost',
        port=5433,
        database='musicdb',
        user='musicdb_user',
        password='musicdb_secure_pass'
    )

    try:
        # Create tables
        create_tables(conn)

        # Populate sample data
        populate_sample_data(conn)

        logger.info("✅ Sample data population complete!")

    except Exception as e:
        logger.error(f"Error: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    main()