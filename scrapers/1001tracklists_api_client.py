"""
1001tracklists API Client for fetching music data

This module provides API-based data collection from 1001tracklists,
replacing the web scraping approach with official API endpoints.
"""

import os
import json
import logging
import requests
from typing import List, Dict, Any, Optional
from datetime import datetime
from dotenv import load_dotenv
import asyncio
import asyncpg
from database_pipeline import EnhancedMusicDatabasePipeline

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class OneThousandOneTracklistsAPIClient:
    """API client for 1001tracklists data collection"""

    def __init__(self):
        self.api_key = os.getenv('ONE_THOUSAND_ONE_TRACKLISTS_API_KEY')
        if not self.api_key or self.api_key == 'YOUR_1001TRACKLISTS_API_KEY_HERE':
            logger.warning("No valid 1001tracklists API key found. Please set ONE_THOUSAND_ONE_TRACKLISTS_API_KEY in .env file")
            # For now, we'll use mock data to demonstrate the pipeline works
            self.use_mock_data = True
        else:
            self.use_mock_data = False

        # API endpoints (these are typical patterns - adjust based on actual API documentation)
        self.base_url = "https://api.1001tracklists.com/v1"
        self.headers = {
            'Authorization': f'Bearer {self.api_key}',
            'Accept': 'application/json',
            'User-Agent': 'MusicDB-Scraper/1.0'
        }

        # Initialize database pipeline with configuration
        db_config = {
            'host': os.getenv('DATABASE_HOST', 'musicdb-postgres'),
            'port': int(os.getenv('DATABASE_PORT', 5432)),
            'database': os.getenv('DATABASE_NAME', 'musicdb'),
            'user': os.getenv('DATABASE_USER', 'musicdb_user'),
            'password': os.getenv('DATABASE_PASSWORD', 'musicdb_secure_pass')
        }
        self.pipeline = EnhancedMusicDatabasePipeline(db_config)

    def search_tracklists(self, query: str, limit: int = 20) -> List[Dict[str, Any]]:
        """Search for tracklists by query"""
        if self.use_mock_data:
            return self._get_mock_tracklists(query, limit)

        endpoint = f"{self.base_url}/search/tracklists"
        params = {
            'q': query,
            'limit': limit,
            'format': 'json'
        }

        try:
            response = requests.get(endpoint, headers=self.headers, params=params, timeout=30)
            response.raise_for_status()
            data = response.json()
            return data.get('results', [])
        except requests.exceptions.RequestException as e:
            logger.error(f"API request failed: {e}")
            return []

    def get_tracklist_details(self, tracklist_id: str) -> Optional[Dict[str, Any]]:
        """Get detailed information about a specific tracklist"""
        if self.use_mock_data:
            return self._get_mock_tracklist_details(tracklist_id)

        endpoint = f"{self.base_url}/tracklist/{tracklist_id}"

        try:
            response = requests.get(endpoint, headers=self.headers, timeout=30)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to get tracklist details: {e}")
            return None

    def get_track_info(self, track_id: str) -> Optional[Dict[str, Any]]:
        """Get information about a specific track"""
        if self.use_mock_data:
            return self._get_mock_track_info(track_id)

        endpoint = f"{self.base_url}/track/{track_id}"

        try:
            response = requests.get(endpoint, headers=self.headers, timeout=30)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to get track info: {e}")
            return None

    def _get_mock_tracklists(self, query: str, limit: int) -> List[Dict[str, Any]]:
        """Return mock tracklist data for testing"""
        mock_tracklists = []
        for i in range(min(limit, 5)):
            mock_tracklists.append({
                'id': f'tracklist_{i+1}',
                'name': f'Epic {query} Mix {i+1}',
                'dj': f'DJ {query} Master',
                'date': '2024-01-20',
                'venue': 'Virtual Festival',
                'track_count': 15 + i
            })
        return mock_tracklists

    def _get_mock_tracklist_details(self, tracklist_id: str) -> Dict[str, Any]:
        """Return mock tracklist details for testing"""
        # Generate diverse mock tracks to create a rich graph
        tracks = []
        base_genres = ['Techno', 'House', 'Trance', 'Drum & Bass', 'Dubstep']

        for i in range(12):
            genre = base_genres[i % len(base_genres)]
            tracks.append({
                'position': i + 1,
                'track': {
                    'id': f'track_{tracklist_id}_{i+1}',
                    'name': f'{genre} Track {i+1}',
                    'artist': f'{genre} Artist {(i % 3) + 1}',
                    'label': f'{genre} Records',
                    'genre': genre,
                    'bpm': 120 + (i * 5),
                    'key': ['Am', 'C', 'Dm', 'F', 'G'][i % 5]
                },
                'transition': 'mix' if i > 0 else 'start'
            })

        return {
            'id': tracklist_id,
            'name': f'Tracklist {tracklist_id}',
            'dj': 'Mock DJ',
            'date': '2024-01-20',
            'venue': 'Mock Venue',
            'tracks': tracks
        }

    def _get_mock_track_info(self, track_id: str) -> Dict[str, Any]:
        """Return mock track information for testing"""
        return {
            'id': track_id,
            'name': f'Track {track_id}',
            'artist': 'Mock Artist',
            'remixer': 'Mock Remixer',
            'label': 'Mock Records',
            'genre': 'Electronic',
            'bpm': 128,
            'key': 'Am',
            'release_date': '2024-01-01',
            'similar_tracks': [
                {'id': f'similar_{track_id}_1', 'name': 'Similar Track 1'},
                {'id': f'similar_{track_id}_2', 'name': 'Similar Track 2'}
            ]
        }

    async def process_tracklists_to_db(self, queries: List[str]):
        """Process multiple queries and store results in database"""
        all_items = []

        for query in queries:
            logger.info(f"Searching for: {query}")
            tracklists = self.search_tracklists(query, limit=5)

            for tracklist in tracklists:
                logger.info(f"Processing tracklist: {tracklist.get('name')}")
                details = self.get_tracklist_details(tracklist['id'])

                if details and 'tracks' in details:
                    for track_entry in details['tracks']:
                        track = track_entry.get('track', {})

                        # Create item in format expected by database pipeline
                        item = {
                            'track_name': track.get('name', 'Unknown Track'),
                            'artist_name': track.get('artist', 'Unknown Artist'),
                            'source_url': f"https://www.1001tracklists.com/tracklist/{tracklist['id']}",
                            'discovered_at': datetime.now().isoformat(),
                            'genre': track.get('genre', ''),
                            'bpm': track.get('bpm'),
                            'key': track.get('key', ''),
                            'label': track.get('label', ''),
                            'position': track_entry.get('position'),
                            'tracklist_name': details.get('name', ''),
                            'dj_name': details.get('dj', ''),
                            'venue': details.get('venue', ''),
                            'date_played': details.get('date', '')
                        }
                        all_items.append(item)

        if all_items:
            logger.info(f"Processing {len(all_items)} tracks to database")
            try:
                result = await self.pipeline.process_batch(all_items)
                logger.info(f"Database processing complete, result: {result}")
            except Exception as e:
                logger.error(f"ERROR processing batch: {e}")
                logger.error(f"Exception type: {type(e).__name__}")
                import traceback
                logger.error(f"Traceback: {traceback.format_exc()}")
        else:
            logger.warning("No tracks found to process")

    async def run(self):
        """Main entry point for API data collection"""
        # Use target tracks or default queries
        try:
            with open('target_tracks_for_scraping.json', 'r') as f:
                target_data = json.load(f)
                queries = [track['track_name'] for track in target_data.get('tracks', [])][:10]
        except FileNotFoundError:
            queries = [
                "Carl Cox",
                "Charlotte de Witte",
                "Amelie Lens",
                "Tale of Us",
                "Solomun",
                "Adam Beyer",
                "Nina Kraviz",
                "Richie Hawtin",
                "Dixon",
                "Maceo Plex"
            ]

        logger.info(f"Starting API data collection for {len(queries)} queries")

        if self.use_mock_data:
            logger.info("Using MOCK DATA - Please add your API key to .env file for real data")

        await self.process_tracklists_to_db(queries)

        # Close database connection
        await self.pipeline.close()

        logger.info("API data collection completed")


if __name__ == "__main__":
    client = OneThousandOneTracklistsAPIClient()
    asyncio.run(client.run())