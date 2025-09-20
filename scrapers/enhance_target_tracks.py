#!/usr/bin/env python3
"""
Enhance target tracks JSON file by converting all_tracks to priority_tracks with complete metadata.
This ensures all tracks have the necessary search variations and metadata for effective scraping.
"""
import json
from datetime import datetime
import re


def generate_remix_variations(title, artist, genre):
    """Generate common remix variations for electronic music tracks."""
    base_title = re.sub(r'\s*\([^)]*\)', '', title).strip()  # Remove parenthetical content

    variations = []

    # Always include the original title as-is
    variations.append(title)

    # Standard electronic music formats
    if "Original Mix" not in title and "Remix" not in title:
        variations.append(f"{base_title} (Original Mix)")
        variations.append(f"{base_title} (Extended Mix)")
        variations.append(f"{base_title} (Radio Edit)")

    # Genre-specific variations
    if genre in ["Progressive House", "Electro House", "House", "Tech House"]:
        if "Extended Mix" not in title:
            variations.append(f"{base_title} (Club Mix)")
        if "VIP" not in title:
            variations.append(f"{base_title} (Festival Mix)")
    elif genre in ["Dubstep", "Drum & Bass"]:
        if "VIP" not in title:
            variations.append(f"{base_title} (VIP Mix)")
    elif genre in ["Melodic Techno", "Techno"]:
        if "Extended" not in title:
            variations.append(f"{base_title} (Extended Version)")
    elif genre == "Trance":
        if "Original Mix" not in title:
            variations.append(f"{base_title} (Original Mix)")
            variations.append(f"{base_title} (Extended Mix)")
            variations.append(f"{base_title} (Radio Edit)")

    # Remove duplicates while preserving order
    seen = set()
    unique_variations = []
    for v in variations:
        if v not in seen:
            seen.add(v)
            unique_variations.append(v)

    return unique_variations


def generate_search_terms(title, primary_artist, featured_artists=None):
    """Generate search terms for better discovery."""
    terms = []

    # Add primary artist
    terms.append(primary_artist)

    # Add title without parenthetical content
    base_title = re.sub(r'\s*\([^)]*\)', '', title).strip()
    terms.append(base_title)

    # Add artist abbreviations if they exist
    artist_words = primary_artist.split()
    if len(artist_words) > 1:
        # Create acronym (e.g., "Swedish House Mafia" -> "SHM")
        acronym = ''.join([word[0].upper() for word in artist_words])
        if len(acronym) >= 2 and len(acronym) <= 4:
            terms.append(acronym)

    # Add featured artists
    if featured_artists:
        for artist in featured_artists[:2]:  # Limit to first 2 featured artists
            terms.append(artist)

    # Remove duplicates
    return list(dict.fromkeys(terms))


def estimate_year(title, artist, genre):
    """Estimate release year based on artist and genre patterns."""
    # Known artist active periods and genre evolution
    artist_years = {
        "Swedish House Mafia": 2012,
        "David Guetta": 2011,
        "Calvin Harris": 2014,
        "Deadmau5": 2010,
        "Skrillex": 2012,
        "Martin Garrix": 2014,
        "Tiësto": 2013,
        "Alesso": 2013,
        "Eric Prydz": 2012,
        "FISHER": 2019,
        "Fred again..": 2022,
        "Anyma": 2023,
        "Alok": 2018,
        "Artbat": 2022,
        "Chris Lake": 2020,
        "John Summit": 2021,
        "Dom Dolla": 2019,
        "Peggy Gou": 2023,
        "Charli xcx": 2024
    }

    # Genre popularity periods
    genre_years = {
        "Progressive House": 2012,
        "Electro House": 2011,
        "Big Room House": 2013,
        "Big Room": 2013,
        "Dubstep": 2011,
        "Tech House": 2020,
        "Melodic Techno": 2022,
        "Melodic House & Techno": 2021,
        "Future Bass": 2016,
        "Deep House": 2014,
        "Trance": 2010,
        "Dance": 2019,
        "Dance Pop": 2015,
        "Electronic": 2020,
        "Hyperpop": 2024,
        "Drum & Bass": 2022,
        "UK Garage": 2022,
        "Garage": 2021
    }

    # Check for specific year indicators in title
    if "2024" in title or "(2024)" in title:
        return 2024
    if "2023" in title:
        return 2023

    # Use artist-specific year if available
    if artist in artist_years:
        return artist_years[artist]

    # Fall back to genre-based estimation
    return genre_years.get(genre, 2020)


def determine_priority(artist, genre, title):
    """Determine track priority based on artist popularity and genre relevance."""
    high_priority_artists = [
        "Swedish House Mafia", "David Guetta", "Calvin Harris", "Martin Garrix",
        "Skrillex", "Tiësto", "FISHER", "Fred again..", "Anyma", "Artbat",
        "Chris Lake", "John Summit", "Peggy Gou"
    ]

    medium_priority_genres = [
        "Tech House", "Melodic Techno", "House", "Progressive House"
    ]

    if any(artist_name in artist for artist_name in high_priority_artists):
        return "high"
    elif genre in medium_priority_genres:
        return "medium"
    else:
        return "medium"  # Default to medium for better scraping


def enhance_track(track, is_priority=False):
    """Enhance a track with complete metadata."""
    # If already a priority track with all fields, just ensure consistency
    if is_priority and all(key in track for key in ["remix_variations", "search_terms", "year", "priority"]):
        # Ensure we have enough variations
        if len(track.get("remix_variations", [])) < 2:
            track["remix_variations"] = generate_remix_variations(
                track["title"],
                track["primary_artist"],
                track["genre"]
            )
        return track

    # Create enhanced version
    enhanced = {
        "title": track["title"],
        "artists": track["artists"],
        "primary_artist": track["primary_artist"],
        "genre": track["genre"]
    }

    # Add featured artists if present
    if "featured_artists" in track:
        enhanced["featured_artists"] = track["featured_artists"]
    elif len(track["artists"]) > 1:
        # Derive featured artists from artists list
        enhanced["featured_artists"] = [a for a in track["artists"] if a != track["primary_artist"]]

    # Generate remix variations
    enhanced["remix_variations"] = generate_remix_variations(
        track["title"],
        track["primary_artist"],
        track["genre"]
    )

    # Estimate year if not present
    enhanced["year"] = track.get("year", estimate_year(
        track["title"],
        track["primary_artist"],
        track["genre"]
    ))

    # Determine priority
    enhanced["priority"] = track.get("priority", determine_priority(
        track["primary_artist"],
        track["genre"],
        track["title"]
    ))

    # Generate search terms
    enhanced["search_terms"] = generate_search_terms(
        track["title"],
        track["primary_artist"],
        enhanced.get("featured_artists")
    )

    return enhanced


def main():
    """Main function to enhance the target tracks file."""
    input_file = "target_tracks_for_scraping.json"
    output_file = "enhanced_target_tracks.json"

    # Load existing file
    with open(input_file, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # Extract existing tracks
    priority_tracks = data["scraper_targets"]["priority_tracks"]
    all_tracks = data["scraper_targets"]["all_tracks"]

    print(f"Processing {len(priority_tracks)} priority tracks and {len(all_tracks)} all_tracks...")

    # Enhance all tracks
    enhanced_priority = []

    # First, add enhanced priority tracks
    for track in priority_tracks:
        enhanced_priority.append(enhance_track(track, is_priority=True))

    # Then, convert and enhance all_tracks to priority format
    for track in all_tracks:
        # Check if this track is already in priority (avoid duplicates)
        if not any(t["title"] == track["title"] and t["primary_artist"] == track["primary_artist"]
                  for t in enhanced_priority):
            enhanced_priority.append(enhance_track(track, is_priority=False))

    # Create new data structure with all tracks as priority
    enhanced_data = {
        "metadata": {
            **data["metadata"],
            "total_tracks": len(enhanced_priority),
            "last_updated": datetime.now().strftime("%Y-%m-%d"),
            "enhancement_notes": "All tracks converted to priority format with complete metadata for optimal scraping"
        },
        "scraper_targets": {
            "priority_tracks": enhanced_priority,
            "all_tracks": []  # Empty since all are now priority
        },
        "scraper_instructions": data.get("scraper_instructions", {}),
        "artist_mapping": data.get("artist_mapping", {}),
        "expected_relationships": data.get("expected_relationships", {})
    }

    # Write enhanced file
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(enhanced_data, f, indent=2, ensure_ascii=False)

    print(f"\nEnhancement complete!")
    print(f"Total enhanced tracks: {len(enhanced_priority)}")
    print(f"Output written to: {output_file}")

    # Show statistics
    high_priority = sum(1 for t in enhanced_priority if t["priority"] == "high")
    medium_priority = sum(1 for t in enhanced_priority if t["priority"] == "medium")

    print(f"\nPriority distribution:")
    print(f"  High priority: {high_priority}")
    print(f"  Medium priority: {medium_priority}")

    # Show sample enhanced track
    print(f"\nSample enhanced track:")
    print(json.dumps(enhanced_priority[20], indent=2))


if __name__ == "__main__":
    main()