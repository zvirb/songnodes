#!/usr/bin/env python3
# DEPRECATED: This file uses the removed database_pipeline. Use modern pipelines instead.
"""
Setlist Data Importer
Imports festival setlist data directly into the database pipeline for processing

⚠️  WARNING: This file imports the deprecated database_pipeline.EnhancedMusicDatabasePipeline
    which has been replaced by pipelines.persistence_pipeline.PersistencePipeline.
    This import script may require refactoring to use the modern pipeline architecture.
"""

import asyncio
import json
import logging
import sys
import uuid
from datetime import datetime
from typing import Dict, List, Any
from database_pipeline import EnhancedMusicDatabasePipeline

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Setlist data to import
SETLIST_DATA = {
  "setlists": [
    {
      "setlist_name": "FISHER - Tomorrowland 2025 Weekend 1 Mainstage",
      "dj_artist": "FISHER",
      "event_name": "Tomorrowland 2025",
      "event_date": "2025-07-20",
      "source": "1001tracklists",
      "source_url": "https://www.1001tracklists.com/tracklist/2q7ccgz1/fisher-mainstage-tomorrowland-weekend-1-belgium-2025-07-20.html",
      "venue_name": "Tomorrowland Mainstage",
      "venue_city": "Boom",
      "venue_country": "Belgium",
      "tracks": [
        {
          "position": 1,
          "title": "ID",
          "artist": "FISHER",
          "remix_info": "Unreleased",
          "genre": "Tech House",
          "bpm": 126,
          "key": ""
        },
        {
          "position": 2,
          "title": "Pump The Brakes",
          "artist": "Dom Dolla",
          "remix_info": "Original Mix",
          "genre": "Tech House",
          "bpm": 126,
          "key": "G min"
        },
        {
          "position": 3,
          "title": "Miracle Maker",
          "artist": "Dom Dolla",
          "remix_info": "Original Mix",
          "genre": "House",
          "bpm": 125,
          "key": "Bb min"
        },
        {
          "position": 4,
          "title": "San Francisco",
          "artist": "Dom Dolla",
          "remix_info": "Original Mix",
          "genre": "Tech House",
          "bpm": 126,
          "key": "F min"
        },
        {
          "position": 5,
          "title": "Stay",
          "artist": "FISHER",
          "remix_info": "Original Mix",
          "genre": "Tech House",
          "bpm": 127,
          "key": "Bb min",
          "target_track": True
        },
        {
          "position": 6,
          "title": "Get Hype",
          "artist": "Chris Lake",
          "remix_info": "Original Mix",
          "genre": "Tech House",
          "bpm": 126,
          "key": "D min"
        },
        {
          "position": 7,
          "title": "Freak",
          "artist": "FISHER",
          "remix_info": "Original Mix",
          "genre": "Tech House",
          "bpm": 126,
          "key": "G min"
        },
        {
          "position": 8,
          "title": "Atmosphere",
          "artist": "FISHER",
          "remix_info": "feat. Kita Alexander",
          "genre": "Tech House",
          "bpm": 126,
          "key": "G min",
          "target_track": True
        },
        {
          "position": 9,
          "title": "Tidal Wave",
          "artist": "Chris Lake",
          "remix_info": "Original Mix",
          "genre": "Tech House",
          "bpm": 126,
          "key": "A min"
        },
        {
          "position": 10,
          "title": "A Drug From God",
          "artist": "Chris Lake & NPC",
          "remix_info": "Original Mix",
          "genre": "Tech House",
          "bpm": 127,
          "key": "F# min"
        },
        {
          "position": 11,
          "title": "Goosebumps",
          "artist": "HVDES",
          "remix_info": "Original Mix",
          "genre": "Tech House",
          "bpm": 126,
          "key": "C min"
        },
        {
          "position": 12,
          "title": "Jungle",
          "artist": "X Ambassadors & Jamie N Commons",
          "remix_info": "Sofi Tukker Remix",
          "genre": "House",
          "bpm": 125,
          "key": "E min"
        },
        {
          "position": 13,
          "title": "Push To Start",
          "artist": "Noizu",
          "remix_info": "Tita Lau Remix",
          "genre": "Tech House",
          "bpm": 127,
          "key": "D min"
        },
        {
          "position": 14,
          "title": "ID",
          "artist": "Unknown",
          "remix_info": "Unreleased",
          "genre": "Tech House",
          "bpm": 127,
          "key": ""
        },
        {
          "position": 15,
          "title": "Somebody (2024)",
          "artist": "Gotye, Kimbra, FISHER, Chris Lake, Sante Sansone",
          "remix_info": "FISHER & Chris Lake Rework",
          "genre": "Tech House",
          "bpm": 128,
          "key": "A min",
          "target_track": True
        },
        {
          "position": 16,
          "title": "Baby Baby",
          "artist": "Mau P",
          "remix_info": "Original Mix",
          "genre": "Tech House",
          "bpm": 126,
          "key": "F min"
        },
        {
          "position": 17,
          "title": "Drugs From Amsterdam",
          "artist": "Mau P",
          "remix_info": "Original Mix",
          "genre": "Tech House",
          "bpm": 128,
          "key": "G min"
        },
        {
          "position": 18,
          "title": "Gimme! Gimme! Gimme!",
          "artist": "Mau P",
          "remix_info": "Original Mix",
          "genre": "Tech House",
          "bpm": 126,
          "key": "D min"
        },
        {
          "position": 19,
          "title": "Metro",
          "artist": "Mau P",
          "remix_info": "Original Mix",
          "genre": "Tech House",
          "bpm": 127,
          "key": "Bb min"
        },
        {
          "position": 20,
          "title": "Shake The Bottle",
          "artist": "Mau P",
          "remix_info": "Original Mix",
          "genre": "Tech House",
          "bpm": 126,
          "key": "G min"
        },
        {
          "position": 21,
          "title": "Take It Off",
          "artist": "FISHER",
          "remix_info": "feat. AATIG",
          "genre": "Tech House",
          "bpm": 127,
          "key": "F min",
          "target_track": True
        },
        {
          "position": 22,
          "title": "Crazy",
          "artist": "Patrick Topping",
          "remix_info": "Original Mix",
          "genre": "Tech House",
          "bpm": 127,
          "key": "A min"
        },
        {
          "position": 23,
          "title": "World, Hold On",
          "artist": "Bob Sinclar",
          "remix_info": "FISHER Rework",
          "genre": "House",
          "bpm": 126,
          "key": "Eb maj",
          "target_track": True
        },
        {
          "position": 24,
          "title": "ID",
          "artist": "FISHER",
          "remix_info": "Unreleased",
          "genre": "Tech House",
          "bpm": 126,
          "key": ""
        },
        {
          "position": 25,
          "title": "Losing It",
          "artist": "FISHER",
          "remix_info": "Original Mix",
          "genre": "Tech House",
          "bpm": 125,
          "key": "Ab min",
          "target_track": True
        }
      ]
    },
    {
      "setlist_name": "Fred again.. - EDC Las Vegas 2024",
      "dj_artist": "Fred again..",
      "event_name": "EDC Las Vegas 2024",
      "event_date": "2024-05-18",
      "source": "1001tracklists",
      "source_url": "https://www.1001tracklists.com/tracklist/13vmclp1/fred-again..-circuitground-edc-las-vegas-united-states-2024-05-18.html",
      "venue_name": "circuitGROUND",
      "venue_city": "Las Vegas",
      "venue_country": "United States",
      "tracks": [
        {
          "position": 1,
          "title": "Marea (We've Lost Dancing)",
          "artist": "Fred again..",
          "remix_info": "feat. The Blessed Madonna",
          "genre": "Electronic",
          "bpm": 138,
          "key": "A maj",
          "target_track": True
        },
        {
          "position": 2,
          "title": "Kyle (I Found You)",
          "artist": "Fred again..",
          "remix_info": "Original Mix",
          "genre": "Electronic",
          "bpm": 130,
          "key": "C maj"
        },
        {
          "position": 3,
          "title": "Danielle (smile on my face)",
          "artist": "Fred again..",
          "remix_info": "Original Mix",
          "genre": "Electronic",
          "bpm": 137,
          "key": "F# maj",
          "target_track": True
        },
        {
          "position": 4,
          "title": "Angie (I've Been Lost)",
          "artist": "Fred again..",
          "remix_info": "Original Mix",
          "genre": "Electronic",
          "bpm": 135,
          "key": "D maj"
        },
        {
          "position": 5,
          "title": "Turn On The Lights again..",
          "artist": "Fred again.., Swedish House Mafia",
          "remix_info": "feat. Future",
          "genre": "Electronic",
          "bpm": 128,
          "key": "G min",
          "target_track": True
        },
        {
          "position": 6,
          "title": "Rumble",
          "artist": "Skrillex, Fred again.., Flowdan",
          "remix_info": "Original Mix",
          "genre": "Dubstep/Electronic",
          "bpm": 140,
          "key": "F min",
          "target_track": True
        },
        {
          "position": 7,
          "title": "Baby again..",
          "artist": "Fred again.., Skrillex",
          "remix_info": "Original Mix",
          "genre": "Electronic",
          "bpm": 133,
          "key": "A min"
        },
        {
          "position": 8,
          "title": "Clara (the night is dark)",
          "artist": "Fred again..",
          "remix_info": "Original Mix",
          "genre": "Electronic",
          "bpm": 134,
          "key": "E min"
        },
        {
          "position": 9,
          "title": "adore u",
          "artist": "Fred again.., Obongjayar",
          "remix_info": "Original Mix",
          "genre": "Electronic",
          "bpm": 125,
          "key": "Bb maj",
          "target_track": True
        },
        {
          "position": 10,
          "title": "places to be",
          "artist": "Fred again.., Anderson .Paak, CHIKA",
          "remix_info": "Original Mix",
          "genre": "Electronic",
          "bpm": 130,
          "key": "C maj"
        },
        {
          "position": 11,
          "title": "Jungle",
          "artist": "Fred again..",
          "remix_info": "Original Mix",
          "genre": "Electronic",
          "bpm": 150,
          "key": "D min",
          "target_track": True
        },
        {
          "position": 12,
          "title": "Lights Out",
          "artist": "Fred again..",
          "remix_info": "Original Mix",
          "genre": "Electronic",
          "bpm": 128,
          "key": "F maj"
        },
        {
          "position": 13,
          "title": "leavemealone",
          "artist": "Fred again.., Baby Keem",
          "remix_info": "Original Mix",
          "genre": "Electronic",
          "bpm": 172,
          "key": "G# min",
          "target_track": True
        },
        {
          "position": 14,
          "title": "Bleu (better with time)",
          "artist": "Fred again..",
          "remix_info": "Original Mix",
          "genre": "Electronic",
          "bpm": 126,
          "key": "D maj"
        },
        {
          "position": 15,
          "title": "fear less",
          "artist": "Fred again.., Sampha",
          "remix_info": "Original Mix",
          "genre": "Electronic",
          "bpm": 134,
          "key": "A min"
        },
        {
          "position": 16,
          "title": "Strong",
          "artist": "Romy, Fred again..",
          "remix_info": "Original Mix",
          "genre": "Electronic",
          "bpm": 127,
          "key": "C maj",
          "target_track": True
        },
        {
          "position": 17,
          "title": "Billie (loving arms)",
          "artist": "Fred again..",
          "remix_info": "Original Mix",
          "genre": "Electronic",
          "bpm": 135,
          "key": "E maj",
          "target_track": True
        },
        {
          "position": 18,
          "title": "ten",
          "artist": "Fred again.., Jozzy",
          "remix_info": "Original Mix",
          "genre": "Electronic",
          "bpm": 130,
          "key": "F# min",
          "target_track": True
        },
        {
          "position": 19,
          "title": "Delilah (pull me out of this)",
          "artist": "Fred again..",
          "remix_info": "Original Mix",
          "genre": "Electronic",
          "bpm": 174,
          "key": "G maj",
          "target_track": True
        }
      ]
    }
  ]
}


class SetlistDataImporter:
    """Processes setlist data and imports it into the database pipeline"""

    def __init__(self):
        # Database configuration
        self.db_config = {
            'host': 'postgres',  # Use service name from docker-compose
            'port': 5432,
            'database': 'musicdb',
            'user': 'musicdb_user',
            'password': '7D82_xqNs55tGyk'
        }

        # Initialize the database pipeline
        self.db_pipeline = EnhancedMusicDatabasePipeline(self.db_config)

    def convert_setlist_to_pipeline_items(self, setlist: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Convert a setlist to database pipeline items"""
        items = []

        # Create playlist item
        playlist_item = {
            'item_type': 'playlist',
            'name': setlist['setlist_name'],
            'source_url': setlist['source_url'],
            'playlist_date': setlist['event_date'],
            'curator': setlist['dj_artist'],
            'platform': setlist['source'],
            'total_tracks': len(setlist['tracks']),
            'event_name': setlist['event_name'],
            'venue': setlist['venue_name'],
            'venue_city': setlist['venue_city'],
            'venue_country': setlist['venue_country']
        }
        items.append(playlist_item)

        # Process tracks and create adjacencies
        for i, track in enumerate(setlist['tracks']):
            # Create artist item
            artist_item = {
                'item_type': 'artist',
                'artist_name': track['artist'],
                'name': track['artist']
            }
            items.append(artist_item)

            # Create track item
            track_item = {
                'item_type': 'track',
                'track_name': track['title'],
                'artist_name': track['artist'],
                'genre': track['genre'],
                'bpm': track['bpm'] if track['bpm'] else None,
                'key': track['key'] if track['key'] else None,
                'source_url': setlist['source_url'],
                'position_in_set': track['position'],
                'remix_info': track.get('remix_info', ''),
                'is_target_track': track.get('target_track', False)
            }
            items.append(track_item)

            # Create adjacency for consecutive tracks (n tracks = n-1 edges)
            if i < len(setlist['tracks']) - 1:
                next_track = setlist['tracks'][i + 1]

                # Create adjacency for ALL consecutive tracks (removed same-artist filter)
                adjacency_item = {
                    'item_type': 'track_adjacency',
                    'track1_name': track['title'],
                    'track1_artist': track['artist'],
                    'track2_name': next_track['title'],
                    'track2_artist': next_track['artist'],
                    'distance': 1,  # Always 1 for consecutive tracks
                    'occurrence_count': 1,
                    'source_context': f"{setlist['event_name']}:{setlist['setlist_name']}",
                    'source_url': setlist['source_url'],
                    'discovered_at': datetime.now().isoformat()
                }
                items.append(adjacency_item)

        return items

    async def import_setlists(self, setlist_data: Dict[str, Any]):
        """Import all setlists from the provided data"""
        total_items = 0
        total_adjacencies = 0

        logger.info(f"Starting import of {len(setlist_data['setlists'])} setlists")

        # Process each setlist
        for setlist in setlist_data['setlists']:
            logger.info(f"Processing setlist: {setlist['setlist_name']}")

            # Convert to pipeline items
            items = self.convert_setlist_to_pipeline_items(setlist)

            # Count adjacencies
            adjacency_count = len([item for item in items if item.get('item_type') == 'track_adjacency'])
            track_count = len([item for item in items if item.get('item_type') == 'track'])

            logger.info(f"  - {track_count} tracks, {adjacency_count} adjacencies (should be {track_count-1})")

            # Create mock spider for pipeline
            class MockSpider:
                name = "setlist_data_importer"

            mock_spider = MockSpider()

            # Process items through pipeline
            for item in items:
                await self.db_pipeline.process_item(item, mock_spider)

            total_items += len(items)
            total_adjacencies += adjacency_count

        # Flush all remaining batches
        await self.db_pipeline.flush_all_batches()

        logger.info(f"✓ Import complete: {total_items} total items, {total_adjacencies} adjacencies")

        # Show final statistics
        await self.db_pipeline.show_statistics()

    async def close(self):
        """Close the pipeline"""
        await self.db_pipeline.close()


async def main():
    """Main import function"""
    importer = SetlistDataImporter()

    try:
        await importer.import_setlists(SETLIST_DATA)
        logger.info("✅ Setlist data import completed successfully!")

    except Exception as e:
        logger.error(f"❌ Import failed: {e}")
        raise
    finally:
        await importer.close()


if __name__ == "__main__":
    # This should only be called through the orchestrator
    logger.error("❌ This script should only be executed through the orchestrator service!")
    logger.info("💡 Use the orchestrator API to submit scraping tasks instead.")
    sys.exit(1)