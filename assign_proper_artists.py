#!/usr/bin/env python3
"""
Properly assign artists to songs based on known track-artist mappings.
"""

import asyncio
import asyncpg
import json
import re

def normalize_title(title):
    """Normalize title for matching"""
    # Remove common variations
    title = re.sub(r'\s*\(.*?\)\s*', '', title)  # Remove parentheses
    title = re.sub(r'\s*\[.*?\]\s*', '', title)  # Remove brackets
    title = re.sub(r'\s*-\s*(Original|Radio|Extended|Club).*', '', title, flags=re.I)  # Remove mix types
    title = re.sub(r'[^\w\s]', '', title)  # Remove special characters
    title = title.lower().strip()
    return title

async def assign_proper_artists():
    conn = await asyncpg.connect(
        host='localhost', port=5433, database='musicdb',
        user='musicdb_user', password='musicdb_secure_pass'
    )

    print("=== ASSIGNING PROPER ARTISTS TO TRACKS ===\n")

    # Load the target tracks data
    with open('scrapers/enhanced_target_tracks.json', 'r') as f:
        target_data = json.load(f)

    # Build a mapping of normalized title -> artist
    title_to_artist = {}

    # From priority tracks
    for track in target_data.get('scraper_targets', {}).get('priority_tracks', []):
        title = track.get('title', '')
        norm_title = normalize_title(title)
        primary_artist = track.get('primary_artist')
        artists = track.get('artists', [])

        if primary_artist:
            title_to_artist[norm_title] = primary_artist
        elif artists:
            title_to_artist[norm_title] = artists[0]

        # Also add remix variations
        for variation in track.get('remix_variations', []):
            norm_var = normalize_title(variation)
            if primary_artist:
                title_to_artist[norm_var] = primary_artist
            elif artists:
                title_to_artist[norm_var] = artists[0]

    # From all_tracks list
    for track_info in target_data.get('scraper_targets', {}).get('all_tracks', []):
        if isinstance(track_info, dict):
            title = track_info.get('title', '')
            artist = track_info.get('artist', track_info.get('primary_artist', ''))
            if title and artist:
                norm_title = normalize_title(title)
                title_to_artist[norm_title] = artist
        elif isinstance(track_info, str):
            # Format might be "Artist - Title"
            if ' - ' in track_info:
                parts = track_info.split(' - ', 1)
                artist = parts[0].strip()
                title = parts[1].strip()
                norm_title = normalize_title(title)
                title_to_artist[norm_title] = artist

    print(f"Built mapping for {len(title_to_artist)} known tracks")

    # Add well-known EDM track-artist mappings
    known_tracks = {
        'raise your weapon': 'Deadmau5',
        'bangarang': 'Skrillex',
        'turn down for what': 'DJ Snake',
        'titanium': 'David Guetta',
        'animals': 'Martin Garrix',
        'clarity': 'Zedd',
        'levels': 'Avicii',
        'strobe': 'Deadmau5',
        'ghosts n stuff': 'Deadmau5',
        'scary monsters and nice sprites': 'Skrillex',
        'first of the year': 'Skrillex',
        'language': 'Porter Robinson',
        'dont you worry child': 'Swedish House Mafia',
        'save the world': 'Swedish House Mafia',
        'one': 'Swedish House Mafia',
        'greyhound': 'Swedish House Mafia',
        'lean on': 'Major Lazer',
        'where are u now': 'Skrillex',
        'in the name of love': 'Martin Garrix',
        'scared to be lonely': 'Martin Garrix',
        'summer': 'Calvin Harris',
        'feel so close': 'Calvin Harris',
        'this is what you came for': 'Calvin Harris',
        'how deep is your love': 'Calvin Harris',
        'outside': 'Calvin Harris',
        'wake me up': 'Avicii',
        'hey brother': 'Avicii',
        'the business': 'Tiësto',
        'adagio for strings': 'Tiësto',
        'traffic': 'Tiësto',
        'opus': 'Eric Prydz',
        'pjanoo': 'Eric Prydz',
        'call on me': 'Eric Prydz',
        'generate': 'Eric Prydz',
        'liberate': 'Eric Prydz',
        'every day': 'Eric Prydz',
        'faded': 'Alan Walker',
        'concrete angel': 'Gareth Emery',
        'sun moon': 'Above & Beyond',
        'sun and moon': 'Above & Beyond',
        'memories': 'David Guetta',
        'when love takes over': 'David Guetta',
        'turn me on': 'David Guetta',
        'without you': 'David Guetta',
        'miami 2 ibiza': 'Swedish House Mafia',
        'tremor': 'Dimitri Vegas & Like Mike',
        'wizard': 'Martin Garrix',
        'heroes': 'Alesso',
        'if i lose myself': 'Alesso',
        'years': 'Alesso',
        'calling': 'Alesso',
        'under control': 'Calvin Harris',
        'reload': 'Sebastian Ingrosso',
        'red lights': 'Tiësto',
        'wasted': 'Tiësto',
        'cinema': 'Benny Benassi',
        'some chords': 'Deadmau5',
        'i remember': 'Deadmau5',
        'make it bun dem': 'Skrillex',
        'tsunami': 'DVBBS',
        'epic': 'Sandro Silva'
    }

    # Merge known tracks into mapping
    for title, artist in known_tracks.items():
        if title not in title_to_artist:
            title_to_artist[title] = artist

    print(f"Total mappings after adding known tracks: {len(title_to_artist)}")

    # Get all songs and update them
    songs = await conn.fetch('''
        SELECT s.song_id, s.title, a.name as current_artist
        FROM songs s
        JOIN artists a ON s.primary_artist_id = a.artist_id
    ''')

    updates = 0
    artist_cache = {}  # Cache artist lookups

    for song in songs:
        if song['current_artist'] == 'Various Artists':
            # Try to find the proper artist
            norm_title = normalize_title(song['title'])

            artist_name = title_to_artist.get(norm_title)

            if artist_name:
                # Get or create the artist
                if artist_name not in artist_cache:
                    artist = await conn.fetchrow(
                        'SELECT artist_id FROM artists WHERE LOWER(name) = LOWER($1)',
                        artist_name
                    )

                    if not artist:
                        # Create the artist
                        import uuid
                        artist_id = str(uuid.uuid4())
                        await conn.execute('''
                            INSERT INTO artists (artist_id, name, genres)
                            VALUES ($1, $2, $3)
                        ''', artist_id, artist_name, ['Electronic'])
                        artist_cache[artist_name] = artist_id
                        print(f"  Created artist: {artist_name}")
                    else:
                        artist_cache[artist_name] = artist['artist_id']

                # Update the song
                await conn.execute('''
                    UPDATE songs
                    SET primary_artist_id = $1
                    WHERE song_id = $2
                ''', artist_cache[artist_name], song['song_id'])
                updates += 1
                print(f"  Updated: \"{song['title']}\" -> {artist_name}")

    print(f"\nUpdated {updates} songs with proper artists")

    # Final verification
    various_count = await conn.fetchval('''
        SELECT COUNT(*)
        FROM songs s
        JOIN artists a ON s.primary_artist_id = a.artist_id
        WHERE a.name = 'Various Artists'
    ''')

    total_songs = await conn.fetchval('SELECT COUNT(*) FROM songs')

    print(f"\n=== RESULTS ===")
    print(f"Total songs: {total_songs}")
    print(f"Songs still assigned to Various Artists: {various_count}")
    print(f"Songs with specific artists: {total_songs - various_count}")

    # Show sample of properly assigned tracks
    samples = await conn.fetch('''
        SELECT s.title, a.name as artist_name
        FROM songs s
        JOIN artists a ON s.primary_artist_id = a.artist_id
        WHERE a.name != 'Various Artists'
        LIMIT 10
    ''')

    if samples:
        print("\nSample tracks with proper artists:")
        for sample in samples:
            print(f"  {sample['artist_name']} - {sample['title']}")

    await conn.close()

if __name__ == "__main__":
    asyncio.run(assign_proper_artists())