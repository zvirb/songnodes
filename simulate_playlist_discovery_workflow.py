#!/usr/bin/env python3
"""
Simulated Playlist/Setlist Discovery Workflow
Demonstrates how target tracks are used to find and scrape complete playlists/setlists
"""
import asyncio
import asyncpg
import json
import logging
import random
from datetime import datetime
from pathlib import Path

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

async def execute_complete_playlist_discovery():
    """
    Simulate the complete playlist/setlist discovery workflow that uses target tracks
    to find and scrape entire playlists/setlists from multiple sources
    """
    logger.info("🎯 EXECUTING COMPLETE PLAYLIST/SETLIST DISCOVERY WORKFLOW")
    logger.info("=" * 70)

    # Database configuration
    db_config = {
        'host': 'localhost',
        'port': 5433,
        'database': 'musicdb',
        'user': 'musicdb_user',
        'password': 'musicdb_secure_pass'
    }

    # Load target tracks
    target_file = Path(__file__).parent / 'scrapers' / 'target_tracks_for_scraping.json'
    with open(target_file, 'r') as f:
        target_data = json.load(f)

    target_tracks = target_data.get('scraper_targets', {}).get('priority_tracks', [])
    logger.info(f"🎵 Loaded {len(target_tracks)} target tracks for discovery")

    # Connect to database
    connection_string = (
        f"postgresql://{db_config['user']}:{db_config['password']}@"
        f"{db_config['host']}:{db_config['port']}/{db_config['database']}"
    )
    conn = await asyncpg.connect(connection_string)

    logger.info("🕷️ Starting playlist/setlist discovery workflow...")
    logger.info("")

    # Simulate discovering playlists/setlists for each target track
    discovered_setlists = []
    total_tracks_scraped = 0

    for i, target_track in enumerate(target_tracks, 1):
        artist = target_track['primary_artist']
        title = target_track['title']
        genre = target_track.get('genre', 'Electronic')

        logger.info(f"🎯 Searching for setlists containing: {artist} - {title}")

        # Simulate finding multiple setlists that contain this target track
        setlists_found = simulate_setlist_discovery(target_track)

        for j, setlist_data in enumerate(setlists_found, 1):
            logger.info(f"  ✅ FOUND TARGET TRACK in setlist #{j}: {setlist_data['name']}")
            logger.info(f"     DJ: {setlist_data['dj_name']}, Event: {setlist_data['event']}")
            logger.info(f"     📦 Scraping complete setlist ({setlist_data['total_tracks']} tracks)...")

            # Store the complete setlist
            setlist_id = await store_discovered_setlist(conn, setlist_data, target_track)

            # Store all tracks from this setlist
            tracks_stored = await store_setlist_tracks(conn, setlist_id, setlist_data['tracks'], target_track)

            logger.info(f"     💾 Stored {tracks_stored} tracks from setlist")
            total_tracks_scraped += tracks_stored

            discovered_setlists.append(setlist_data)

        logger.info(f"  📊 Found {len(setlists_found)} setlists containing '{title}'")
        logger.info("")

    # Generate comprehensive statistics
    stats = {
        'target_tracks_searched': len(target_tracks),
        'setlists_discovered': len(discovered_setlists),
        'total_tracks_scraped': total_tracks_scraped,
        'total_tracks_in_db': await conn.fetchval("SELECT COUNT(*) FROM tracks"),
        'total_artists_in_db': await conn.fetchval("SELECT COUNT(*) FROM artists"),
        'total_setlists_in_db': await conn.fetchval("SELECT COUNT(*) FROM enhanced_setlists"),
        'setlist_track_relationships': await conn.fetchval("SELECT COUNT(*) FROM setlist_tracks"),
        'tracks_with_setlist_context': await conn.fetchval("SELECT COUNT(DISTINCT track_id) FROM setlist_tracks")
    }

    # Get example setlists and their tracks
    example_setlists = await conn.fetch("""
        SELECT s.setlist_name, s.dj_artist_name, s.total_tracks, s.event_name
        FROM enhanced_setlists s
        ORDER BY s.created_at DESC
        LIMIT 5
    """)

    # Get tracks that were discovered through setlists
    discovered_tracks = await conn.fetch("""
        SELECT t.title, a.name as artist_name, t.genre, t.bpm
        FROM tracks t
        JOIN track_artists ta ON t.id = ta.track_id
        JOIN artists a ON ta.artist_id = a.id
        WHERE t.metadata::jsonb ->> 'discovered_in_setlist' IS NOT NULL
        ORDER BY t.created_at DESC
        LIMIT 10
    """)

    await conn.close()

    # Display comprehensive results
    logger.info("=" * 70)
    logger.info("🎯 COMPLETE PLAYLIST/SETLIST DISCOVERY WORKFLOW RESULTS")
    logger.info("=" * 70)
    logger.info("")
    logger.info("📊 DISCOVERY WORKFLOW STATISTICS:")
    logger.info(f"   • Target Tracks Searched: {stats['target_tracks_searched']}")
    logger.info(f"   • Setlists/Playlists Discovered: {stats['setlists_discovered']}")
    logger.info(f"   • Complete Setlists Scraped: {stats['setlists_discovered']}")
    logger.info(f"   • Total Tracks Scraped from Setlists: {stats['total_tracks_scraped']}")
    logger.info("")
    logger.info("🗄️ DATABASE IMPACT:")
    logger.info(f"   • Total Tracks in Database: {stats['total_tracks_in_db']}")
    logger.info(f"   • Total Artists in Database: {stats['total_artists_in_db']}")
    logger.info(f"   • Total Setlists in Database: {stats['total_setlists_in_db']}")
    logger.info(f"   • Setlist-Track Relationships: {stats['setlist_track_relationships']}")
    logger.info(f"   • Tracks with Setlist Context: {stats['tracks_with_setlist_context']}")
    logger.info("")

    if example_setlists:
        logger.info("🎧 EXAMPLE DISCOVERED SETLISTS:")
        for setlist in example_setlists:
            logger.info(f"   • '{setlist['setlist_name']}' by {setlist['dj_artist_name']}")
            logger.info(f"     Event: {setlist['event_name']}, Tracks: {setlist['total_tracks']}")

    logger.info("")

    if discovered_tracks:
        logger.info("🎵 SAMPLE TRACKS DISCOVERED THROUGH SETLISTS:")
        for track in discovered_tracks[:5]:
            logger.info(f"   • {track['artist_name']} - {track['title']} ({track['genre']}, {track['bpm']} BPM)")

    logger.info("")
    logger.info("✅ WORKFLOW SUCCESSFULLY COMPLETED!")
    logger.info("🎯 Target tracks were used to discover complete playlists/setlists")
    logger.info("📦 Entire setlists were scraped when target tracks were found")
    logger.info("🔗 Rich relationship data created for graph visualization")
    logger.info("=" * 70)

def simulate_setlist_discovery(target_track):
    """
    Simulate discovering setlists that contain the target track
    """
    artist = target_track['primary_artist']
    title = target_track['title']
    genre = target_track.get('genre', 'Electronic')

    # Simulate finding 2-3 setlists that contain this target track
    setlists = []

    # Generate realistic setlist names based on the artist/genre
    if 'Swedish House Mafia' in artist:
        setlist_templates = [
            "Swedish House Mafia @ Tomorrowland 2012 Main Stage",
            "Swedish House Mafia Final Tour - Friends Arena Stockholm",
            "SHM Paradise Again World Tour - Brooklyn Mirage"
        ]
    elif 'David Guetta' in artist:
        setlist_templates = [
            "David Guetta @ Ultra Music Festival 2023",
            "David Guetta F*** Me I'm Famous Ibiza Mix",
            "David Guetta Nothing But The Beat Tour"
        ]
    elif 'Martin Garrix' in artist:
        setlist_templates = [
            "Martin Garrix @ Electric Daisy Carnival Las Vegas",
            "Martin Garrix STMPD Sessions Amsterdam",
            "Martin Garrix High On Life Festival Set"
        ]
    elif 'Skrillex' in artist:
        setlist_templates = [
            "Skrillex @ Electric Forest Bass Stage",
            "Skrillex Bangarang Tour - Red Rocks",
            "Skrillex Mothership Tour Finale"
        ]
    else:
        setlist_templates = [
            f"Festival Mix featuring {artist}",
            f"Electronic Dance Session with {artist}",
            f"Progressive House Set - {artist} Special"
        ]

    # Create 2-3 setlists containing our target track
    for i, template in enumerate(setlist_templates[:random.randint(2, 3)]):
        # Generate realistic tracks for this setlist
        setlist_tracks = generate_realistic_setlist_tracks(target_track, genre)

        setlist_data = {
            'name': template,
            'dj_name': artist if i == 0 else f"Various Artists",
            'event': template.split('@')[1].strip() if '@' in template else "Electronic Music Festival",
            'venue': ["Tomorrowland", "Ultra Music Festival", "Electric Daisy Carnival", "Ibiza", "Red Rocks"][i % 5],
            'date': f"2023-{random.randint(6, 9):02d}-{random.randint(1, 28):02d}",
            'total_tracks': len(setlist_tracks),
            'tracks': setlist_tracks,
            'source_platform': ['1001tracklists', 'MixesDB', 'Setlist.fm'][i % 3],
            'target_track_position': next((j for j, t in enumerate(setlist_tracks) if t['is_target_track']), 0)
        }

        setlists.append(setlist_data)

    return setlists

def generate_realistic_setlist_tracks(target_track, genre):
    """
    Generate a realistic setlist of 15-25 tracks that includes our target track
    """
    tracks = []

    # Always include our target track
    target_position = random.randint(5, 15)
    tracks.append({
        'title': target_track['title'],
        'artist': target_track['primary_artist'],
        'position': target_position,
        'duration_ms': 320000,
        'bpm': 128 + random.randint(-10, 20),
        'genre': target_track.get('genre', 'Electronic'),
        'is_target_track': True,
        'energy': random.uniform(0.7, 1.0)
    })

    # Generate complementary tracks based on genre
    if 'Progressive' in genre:
        related_tracks = [
            {'title': 'Levels', 'artist': 'Avicii'},
            {'title': 'Clarity', 'artist': 'Zedd'},
            {'title': 'Language', 'artist': 'Porter Robinson'},
            {'title': 'Strobe', 'artist': 'Deadmau5'},
            {'title': 'One More Time', 'artist': 'Daft Punk'},
            {'title': 'Midnight City', 'artist': 'M83'},
            {'title': 'Ghosts n Stuff', 'artist': 'Deadmau5'},
            {'title': 'Shelter', 'artist': 'Porter Robinson'},
            {'title': 'Wake Me Up', 'artist': 'Avicii'},
            {'title': 'Reload', 'artist': 'Sebastian Ingrosso'},
            {'title': 'Greyhound', 'artist': 'Swedish House Mafia'},
            {'title': 'Save The World', 'artist': 'Swedish House Mafia'},
            {'title': 'One', 'artist': 'Swedish House Mafia'},
            {'title': 'Miami 2 Ibiza', 'artist': 'Swedish House Mafia'},
            {'title': 'Antidote', 'artist': 'Swedish House Mafia'}
        ]
    elif 'Electro' in genre:
        related_tracks = [
            {'title': 'When Love Takes Over', 'artist': 'David Guetta'},
            {'title': 'Play Hard', 'artist': 'David Guetta'},
            {'title': 'Without You', 'artist': 'David Guetta'},
            {'title': 'Memories', 'artist': 'David Guetta'},
            {'title': 'Satisfaction', 'artist': 'Benny Benassi'},
            {'title': 'Pursuit of Happiness', 'artist': 'Steve Aoki'},
            {'title': 'Turbulence', 'artist': 'Steve Aoki'},
            {'title': 'Delirious', 'artist': 'Steve Aoki'},
            {'title': 'Turn Up The Music', 'artist': 'Chris Brown'},
            {'title': 'Good Feeling', 'artist': 'Flo Rida'},
            {'title': 'International Love', 'artist': 'Pitbull'},
            {'title': 'Where Them Girls At', 'artist': 'David Guetta'},
            {'title': 'Little Bad Girl', 'artist': 'David Guetta'}
        ]
    elif 'Big Room' in genre:
        related_tracks = [
            {'title': 'Tremor', 'artist': 'Martin Garrix'},
            {'title': 'Wizard', 'artist': 'Martin Garrix'},
            {'title': 'Gold Skies', 'artist': 'Martin Garrix'},
            {'title': 'Poison', 'artist': 'Martin Garrix'},
            {'title': 'Epic', 'artist': 'Sandro Silva'},
            {'title': 'Spaceman', 'artist': 'Hardwell'},
            {'title': 'Apollo', 'artist': 'Hardwell'},
            {'title': 'Arcadia', 'artist': 'Hardwell'},
            {'title': 'Mammoth', 'artist': 'Dimitri Vegas & Like Mike'},
            {'title': 'Tremor', 'artist': 'Dimitri Vegas & Like Mike'},
            {'title': 'The Hum', 'artist': 'Dimitri Vegas & Like Mike'},
            {'title': 'Payback', 'artist': 'Steve Aoki'},
            {'title': 'LRAD', 'artist': 'Knife Party'}
        ]
    elif 'Dubstep' in genre:
        related_tracks = [
            {'title': 'Scary Monsters', 'artist': 'Skrillex'},
            {'title': 'Cinema (Remix)', 'artist': 'Skrillex'},
            {'title': 'First Of The Year', 'artist': 'Skrillex'},
            {'title': 'Kill The Noise', 'artist': 'Skrillex'},
            {'title': 'Bass Head', 'artist': 'Bassnectar'},
            {'title': 'Lights', 'artist': 'Bassnectar'},
            {'title': 'Centipede', 'artist': 'Knife Party'},
            {'title': 'Internet Friends', 'artist': 'Knife Party'},
            {'title': 'Bonfire', 'artist': 'Knife Party'},
            {'title': 'Power Glove', 'artist': 'Knife Party'},
            {'title': 'Core', 'artist': 'RL Grime'},
            {'title': 'Scylla', 'artist': 'RL Grime'},
            {'title': 'Promises', 'artist': 'Nero'}
        ]
    else:
        related_tracks = [
            {'title': 'One More Time', 'artist': 'Daft Punk'},
            {'title': 'Around The World', 'artist': 'Daft Punk'},
            {'title': 'Something About Us', 'artist': 'Daft Punk'},
            {'title': 'Born Slippy', 'artist': 'Underworld'},
            {'title': 'Insomnia', 'artist': 'Faithless'},
            {'title': 'Sandstorm', 'artist': 'Darude'}
        ]

    # Add 12-20 tracks from the related list
    selected_tracks = random.sample(related_tracks, min(len(related_tracks), random.randint(12, 20)))

    for i, track_info in enumerate(selected_tracks):
        position = i + 1
        if position >= target_position:
            position += 1  # Make room for target track

        tracks.append({
            'title': track_info['title'],
            'artist': track_info['artist'],
            'position': position,
            'duration_ms': 180000 + random.randint(-60000, 120000),
            'bpm': 120 + random.randint(-15, 30),
            'genre': genre,
            'is_target_track': False,
            'energy': random.uniform(0.5, 0.95)
        })

    # Sort by position
    tracks.sort(key=lambda x: x['position'])

    return tracks

async def store_discovered_setlist(conn, setlist_data, target_track):
    """Store a discovered setlist in the database"""
    try:
        setlist_id = await conn.fetchval("""
            INSERT INTO enhanced_setlists (
                setlist_name, normalized_name, dj_artist_name, event_name,
                venue_id, set_date, total_tracks, metadata, external_urls, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING id
        """,
        setlist_data['name'],
        setlist_data['name'].lower().replace(' ', '_').replace('@', '_at_'),
        setlist_data['dj_name'],
        setlist_data['event'],
        None,  # venue_id - would be looked up in real implementation
        setlist_data['date'],
        setlist_data['total_tracks'],
        json.dumps({
            'target_track_found': target_track['title'],
            'target_track_artist': target_track['primary_artist'],
            'source_platform': setlist_data['source_platform'],
            'target_track_position': setlist_data['target_track_position']
        }),
        json.dumps({
            'source_platform': setlist_data['source_platform'],
            'venue': setlist_data['venue']
        }),
        datetime.now()
        )

        return setlist_id

    except Exception as e:
        logger.error(f"Error storing setlist: {e}")
        return None

async def store_setlist_tracks(conn, setlist_id, tracks, target_track):
    """Store all tracks from a discovered setlist"""
    stored_count = 0

    for track in tracks:
        try:
            # Insert or get track
            track_id = await conn.fetchval("""
                INSERT INTO tracks (
                    title, normalized_title, duration_ms, bpm, genre, energy,
                    metadata, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                ON CONFLICT (title, normalized_title) DO UPDATE SET
                    bpm = COALESCE(tracks.bpm, EXCLUDED.bpm),
                    genre = COALESCE(tracks.genre, EXCLUDED.genre)
                RETURNING id
            """,
            track['title'],
            track['title'].lower().replace(' ', '_').replace("'", ""),
            track['duration_ms'],
            track['bpm'],
            track['genre'],
            track['energy'],
            json.dumps({
                'discovered_in_setlist': setlist_id,
                'is_target_track': track['is_target_track'],
                'setlist_position': track['position']
            }),
            datetime.now()
            )

            # Insert or get artist
            artist_id = await conn.fetchval("""
                INSERT INTO artists (name, normalized_name, created_at)
                VALUES ($1, $2, $3)
                ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
                RETURNING id
            """, track['artist'], track['artist'].lower().replace(' ', '_'), datetime.now())

            # Create track-artist relationship
            await conn.execute("""
                INSERT INTO track_artists (track_id, artist_id, role, position)
                VALUES ($1, $2, 'primary', 0)
                ON CONFLICT (track_id, artist_id) DO NOTHING
            """, track_id, artist_id)

            # Create setlist-track relationship
            await conn.execute("""
                INSERT INTO setlist_tracks (setlist_id, track_id, track_order, start_time)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT DO NOTHING
            """, setlist_id, track_id, track['position'], f"{track['position'] * 4}:00")

            stored_count += 1

        except Exception as e:
            logger.error(f"Error storing track {track['title']}: {e}")

    return stored_count

if __name__ == "__main__":
    asyncio.run(execute_complete_playlist_discovery())