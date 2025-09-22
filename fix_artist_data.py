#!/usr/bin/env python3
"""
Fix artist data in the database:
1. Extract artists from song titles/metadata
2. Create artist records
3. Link songs to artists
4. Remove any songs without artists
"""

import asyncio
import asyncpg
import json
import re
import uuid

async def fix_artist_data():
    conn = await asyncpg.connect(
        host='localhost', port=5433, database='musicdb',
        user='musicdb_user', password='musicdb_secure_pass'
    )

    print("=== FIXING ARTIST DATA ===\n")

    # Load the enhanced target tracks to get artist mappings
    with open('scrapers/enhanced_target_tracks.json', 'r') as f:
        target_data = json.load(f)

    # Build artist name to info mapping
    artist_info_map = {}

    # From artist_mapping section
    for artist_name, info in target_data.get('artist_mapping', {}).items():
        artist_info_map[artist_name.lower()] = {
            'name': artist_name,
            'info': info
        }

    # From scraper_targets priority tracks
    for track in target_data.get('scraper_targets', {}).get('priority_tracks', []):
        if 'primary_artist' in track:
            artist = track['primary_artist']
            artist_info_map[artist.lower()] = {
                'name': artist,
                'genre': track.get('genre')
            }

        for artist in track.get('artists', []):
            artist_info_map[artist.lower()] = {
                'name': artist,
                'genre': track.get('genre')
            }

    print(f"Found {len(artist_info_map)} known artists from target data")

    # Step 1: Create artist records for known artists
    print("\n1. Creating artist records...")
    artists_created = 0

    for artist_key, artist_data in artist_info_map.items():
        artist_name = artist_data['name']

        # Check if artist already exists
        existing = await conn.fetchrow(
            'SELECT artist_id FROM artists WHERE LOWER(name) = LOWER($1)',
            artist_name
        )

        if not existing:
            # Parse the info if it's a string representation of a dict
            info = artist_data.get('info', {})
            if isinstance(info, str):
                try:
                    info = eval(info)  # Safe here as it's our own data
                except:
                    info = {}

            genres = info.get('genre', artist_data.get('genre', 'Electronic'))
            if isinstance(genres, str):
                genres = [genres]

            artist_id = str(uuid.uuid4())

            await conn.execute('''
                INSERT INTO artists (artist_id, name, genres, country, aliases)
                VALUES ($1, $2, $3, $4, $5)
            ''',
                artist_id,
                artist_name,
                genres[:1] if genres else ['Electronic'],  # Take first genre
                info.get('country'),
                info.get('aliases', [])[:5] if isinstance(info.get('aliases'), list) else []
            )
            artists_created += 1
            print(f"  Created artist: {artist_name}")

    print(f"  -> Created {artists_created} new artist records")

    # Step 2: Try to match songs with artists based on title patterns
    print("\n2. Matching songs with artists...")

    # Get all songs
    songs = await conn.fetch('SELECT song_id, title, label FROM songs')
    songs_updated = 0
    songs_to_delete = []

    for song in songs:
        song_id = song['song_id']
        title = song['title']
        label = song['label']

        artist_found = False

        # Strategy 1: Check if title contains " - " (common format: "Artist - Title")
        if ' - ' in title:
            parts = title.split(' - ', 1)
            potential_artist = parts[0].strip()

            # Look for this artist
            artist = await conn.fetchrow(
                'SELECT artist_id FROM artists WHERE LOWER(name) = LOWER($1)',
                potential_artist
            )

            if artist:
                # Update the song with the artist and clean title
                clean_title = parts[1].strip()
                await conn.execute('''
                    UPDATE songs
                    SET primary_artist_id = $1, title = $2
                    WHERE song_id = $3
                ''', artist['artist_id'], clean_title, song_id)
                songs_updated += 1
                artist_found = True
                print(f"  Matched: \"{title}\" -> Artist: {potential_artist}, Title: {clean_title}")

        # Strategy 2: Check against known artist names
        if not artist_found:
            title_lower = title.lower()
            for artist_key, artist_data in artist_info_map.items():
                artist_name = artist_data['name']
                if artist_name.lower() in title_lower or artist_key in title_lower:
                    # Found artist in title
                    artist = await conn.fetchrow(
                        'SELECT artist_id FROM artists WHERE LOWER(name) = LOWER($1)',
                        artist_name
                    )

                    if artist:
                        # Clean the title by removing artist name
                        clean_title = title
                        for pattern in [artist_name, artist_name.lower(), artist_name.upper()]:
                            clean_title = clean_title.replace(pattern + ' - ', '')
                            clean_title = clean_title.replace(' - ' + pattern, '')
                            clean_title = clean_title.replace(pattern + ': ', '')
                            clean_title = clean_title.replace(' by ' + pattern, '')

                        clean_title = clean_title.strip()
                        if clean_title and clean_title != title:
                            await conn.execute('''
                                UPDATE songs
                                SET primary_artist_id = $1, title = $2
                                WHERE song_id = $3
                            ''', artist['artist_id'], clean_title, song_id)
                        else:
                            await conn.execute('''
                                UPDATE songs
                                SET primary_artist_id = $1
                                WHERE song_id = $2
                            ''', artist['artist_id'], song_id)
                        songs_updated += 1
                        artist_found = True
                        print(f"  Matched by search: \"{title}\" -> Artist: {artist_name}")
                        break

        # Strategy 3: For common tracks, assign a default/various artist
        if not artist_found:
            # Check if this might be a valid track that just needs an artist
            if title and not any(skip in title.lower() for skip in ['test', 'track', 'unknown']):
                # Create or get "Various Artists" for compilation tracks
                various = await conn.fetchrow(
                    'SELECT artist_id FROM artists WHERE name = $1',
                    'Various Artists'
                )

                if not various:
                    various_id = str(uuid.uuid4())
                    await conn.execute('''
                        INSERT INTO artists (artist_id, name, genres)
                        VALUES ($1, $2, $3)
                    ''', various_id, 'Various Artists', ['Electronic'])
                else:
                    various_id = various['artist_id']

                await conn.execute('''
                    UPDATE songs
                    SET primary_artist_id = $1
                    WHERE song_id = $2
                ''', various_id, song_id)
                songs_updated += 1
                artist_found = True
                print(f"  Assigned to Various Artists: \"{title}\"")

        # If still no artist found, mark for deletion
        if not artist_found:
            songs_to_delete.append((song_id, title))

    print(f"  -> Updated {songs_updated} songs with artists")

    # Step 3: Delete songs without artists (invalid data)
    print(f"\n3. Removing {len(songs_to_delete)} invalid songs without artists...")

    for song_id, title in songs_to_delete:
        print(f"  Deleting: \"{title}\"")
        # Delete adjacencies first
        await conn.execute('DELETE FROM song_adjacency WHERE song_id_1 = $1 OR song_id_2 = $1', song_id)
        # Delete playlist relationships
        await conn.execute('DELETE FROM playlist_songs WHERE song_id = $1', song_id)
        # Delete the song
        await conn.execute('DELETE FROM songs WHERE song_id = $1', song_id)

    # Step 4: Verify results
    print("\n4. Verification:")

    songs_with_artist = await conn.fetchval('''
        SELECT COUNT(*) FROM songs WHERE primary_artist_id IS NOT NULL
    ''')
    total_songs = await conn.fetchval('SELECT COUNT(*) FROM songs')
    total_artists = await conn.fetchval('SELECT COUNT(*) FROM artists')

    print(f"  Total songs: {total_songs}")
    print(f"  Songs with artists: {songs_with_artist}")
    print(f"  Total artists: {total_artists}")

    # Sample the updated data
    samples = await conn.fetch('''
        SELECT s.title, a.name as artist_name
        FROM songs s
        JOIN artists a ON s.primary_artist_id = a.artist_id
        LIMIT 5
    ''')

    print("\n  Sample songs with artists:")
    for sample in samples:
        print(f"    {sample['artist_name']} - {sample['title']}")

    await conn.close()

    print("\n=== ARTIST DATA FIXED ===")
    print(f"All {total_songs} remaining songs now have artists!")

if __name__ == "__main__":
    asyncio.run(fix_artist_data())