#!/usr/bin/env python3
"""
Load target tracks from JSON file into database
"""
import json

# Read the JSON file
with open('target_tracks_master.json', 'r') as f:
    data = json.load(f)

tracks = data['scraper_targets']['all_tracks']

print(f"-- Loading {len(tracks)} target tracks into database")
print()

# Generate INSERT statements
for track in tracks:
    title = track['title'].replace("'", "''")  # Escape single quotes
    primary_artist = track['primary_artist'].replace("'", "''")

    # Create search query
    search_query = f"{primary_artist} - {title}".replace("'", "''")

    # Default scraper
    scraper_name = 'mixesdb'

    print(f"INSERT INTO musicdb.target_track_searches (search_id, target_artist, target_title, search_query, scraper_name, search_timestamp)")
    print(f"VALUES (uuid_generate_v4(), '{primary_artist}', '{title}', '{search_query}', '{scraper_name}', CURRENT_TIMESTAMP);")
    print()
