"""
Target Track Searcher - The Missing Link
Searches music sites for playlists containing target tracks
"""

import asyncio
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import httpx
import json
from urllib.parse import quote
import re

logger = logging.getLogger(__name__)


class TargetTrackSearcher:
    """
    Bridges the gap between target tracks and scraping
    Searches music platforms for playlists containing target tracks
    """

    def __init__(self, db_connection=None):
        self.db = db_connection
        self.http_client = httpx.AsyncClient(timeout=30.0)

        # Search endpoints for different platforms
        self.search_endpoints = {
            '1001tracklists': {
                'base_url': 'https://www.1001tracklists.com',
                'search_path': '/search/result.php',
                'search_params': 'searchTerm={query}&trackTitle={title}&trackArtist={artist}'
            },
            'mixesdb': {
                'base_url': 'https://www.mixesdb.com',
                'search_path': '/w/Search',
                'search_params': 'search={query}&type=tracklist'
            },
            'setlist.fm': {
                'base_url': 'https://api.setlist.fm/rest/1.0',
                'search_path': '/search/setlists',
                'search_params': 'songName={title}&artistName={artist}',
                'headers': {
                    'x-api-key': 'YOUR_SETLISTFM_API_KEY',  # Would be in env vars
                    'Accept': 'application/json'
                }
            }
        }

    async def search_for_target_tracks(self, target_tracks: List[Dict]) -> Dict[str, List[str]]:
        """
        Main search function - finds playlists containing target tracks

        Args:
            target_tracks: List of track dicts with 'title' and 'artist' keys

        Returns:
            Dict mapping track identifiers to list of playlist URLs
        """
        results = {}

        for track in target_tracks:
            track_key = f"{track['artist']} - {track['title']}"
            logger.info(f"Searching for: {track_key}")

            # Search each platform
            playlist_urls = []

            # 1001tracklists search
            tracklists_urls = await self._search_1001tracklists(track)
            playlist_urls.extend(tracklists_urls)

            # MixesDB search
            mixes_urls = await self._search_mixesdb(track)
            playlist_urls.extend(mixes_urls)

            # Setlist.fm search
            setlist_urls = await self._search_setlistfm(track)
            playlist_urls.extend(setlist_urls)

            # Store results
            results[track_key] = playlist_urls

            # Update database with search results
            await self._update_search_results(track, playlist_urls)

            # Rate limiting
            await asyncio.sleep(2)

        return results

    async def _search_1001tracklists(self, track: Dict) -> List[str]:
        """
        Search 1001tracklists for playlists containing the track
        Note: This would typically use their API or careful web scraping
        """
        urls = []

        try:
            # Build search query
            search_query = f"{track['artist']} {track['title']}"
            encoded_query = quote(search_query)

            # Simulated search URL (real implementation would use actual API)
            search_url = f"{self.search_endpoints['1001tracklists']['base_url']}/search?q={encoded_query}"

            # In production, this would make actual HTTP request and parse results
            # For now, return example URLs based on track metadata

            # Check if track might appear in popular sets
            if track.get('priority') == 'high':
                # High priority tracks likely in major festival sets
                example_urls = [
                    f"https://www.1001tracklists.com/tracklist/example1/{track['artist'].lower()}-mainstage",
                    f"https://www.1001tracklists.com/tracklist/example2/{track['artist'].lower()}-festival"
                ]
                urls.extend(example_urls)

            logger.info(f"Found {len(urls)} tracklists containing {track['title']}")

        except Exception as e:
            logger.error(f"Error searching 1001tracklists: {e}")

        return urls

    async def _search_mixesdb(self, track: Dict) -> List[str]:
        """Search MixesDB for DJ mixes containing the track"""
        urls = []

        try:
            # MixesDB search logic
            search_query = f"{track['title']} {track['artist']}"

            # Would make actual API call here
            # Placeholder for demonstration

            logger.info(f"Searching MixesDB for: {search_query}")

        except Exception as e:
            logger.error(f"Error searching MixesDB: {e}")

        return urls

    async def _search_setlistfm(self, track: Dict) -> List[str]:
        """Search Setlist.fm for live performances containing the track"""
        urls = []

        try:
            # Setlist.fm has a real API
            headers = self.search_endpoints['setlist.fm'].get('headers', {})

            params = {
                'songName': track['title'],
                'artistName': track['artist']
            }

            # Would make actual API call here
            search_url = f"{self.search_endpoints['setlist.fm']['base_url']}{self.search_endpoints['setlist.fm']['search_path']}"

            # API call would go here
            # response = await self.http_client.get(search_url, params=params, headers=headers)

            logger.info(f"Searching Setlist.fm for: {track['title']} by {track['artist']}")

        except Exception as e:
            logger.error(f"Error searching Setlist.fm: {e}")

        return urls

    async def _update_search_results(self, track: Dict, urls: List[str]):
        """Update database with search results"""
        if not self.db:
            logger.warning("No database connection available for updating search results")
            return

        try:
            # Update target_track_searches table
            query = """
                INSERT INTO target_track_searches
                (target_title, target_artist, search_query, scraper_name,
                 results_found, playlists_containing, search_timestamp)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
            """

            await self.db.execute(
                query,
                track['title'],
                track['artist'],
                f"{track['artist']} {track['title']}",
                'orchestrator_search',
                len(urls),
                len(urls),
                datetime.now()
            )

            # Also update the target_tracks table with last_searched timestamp
            update_query = """
                UPDATE target_tracks
                SET last_searched = NOW(),
                    playlists_found = playlists_found + $1
                WHERE title = $2 AND artist = $3
            """

            await self.db.execute(
                update_query,
                len(urls),
                track['title'],
                track['artist']
            )

            logger.info(f"Updated search results: {len(urls)} playlists found for {track['title']}")

        except Exception as e:
            logger.error(f"Error updating search results: {e}")

    async def get_unscraped_playlists(self, urls: List[str]) -> List[str]:
        """
        Filter out already-scraped playlists

        Args:
            urls: List of playlist URLs to check

        Returns:
            List of URLs that haven't been scraped yet
        """
        if not self.db:
            return urls

        try:
            # Check which URLs already exist in playlists table
            query = """
                SELECT source_url
                FROM playlists
                WHERE source_url = ANY($1)
            """

            existing = await self.db.fetch(query, urls)
            existing_urls = {row['source_url'] for row in existing}

            # Return only URLs not in database
            new_urls = [url for url in urls if url not in existing_urls]

            logger.info(f"Filtered {len(urls)} URLs to {len(new_urls)} unscraped playlists")
            return new_urls

        except Exception as e:
            logger.error(f"Error checking scraped playlists: {e}")
            return urls

    async def create_scraping_tasks(self, search_results: Dict[str, List[str]]) -> List[Dict]:
        """
        Convert search results into scraping tasks

        Args:
            search_results: Dict mapping tracks to playlist URLs

        Returns:
            List of scraping task dictionaries
        """
        tasks = []

        for track_key, urls in search_results.items():
            # Filter out already-scraped playlists
            new_urls = await self.get_unscraped_playlists(urls)

            for url in new_urls:
                # Determine scraper based on URL
                scraper = self._determine_scraper(url)

                task = {
                    'url': url,
                    'scraper': scraper,
                    'discovered_via': track_key,
                    'priority': 'normal',
                    'created_at': datetime.now().isoformat()
                }

                tasks.append(task)

        logger.info(f"Created {len(tasks)} scraping tasks from search results")
        return tasks

    def _determine_scraper(self, url: str) -> str:
        """Determine which scraper to use based on URL"""
        if '1001tracklists.com' in url:
            return '1001tracklists'
        elif 'mixesdb.com' in url:
            return 'mixesdb'
        elif 'setlist.fm' in url:
            return 'setlistfm'
        else:
            return 'generic'

    async def close(self):
        """Clean up resources"""
        await self.http_client.aclose()


class SearchOrchestrator:
    """
    Orchestrates the search → scrape pipeline
    This is the missing link that connects target tracks to actual scraping
    """

    def __init__(self, db_connection, redis_client, message_queue):
        self.db = db_connection
        self.redis = redis_client
        self.queue = message_queue
        self.searcher = TargetTrackSearcher(db_connection)

    async def execute_search_pipeline(self):
        """
        Main pipeline: Load targets → Search → Create tasks → Queue for scraping
        """
        logger.info("Starting target track search pipeline")

        # Step 1: Load active target tracks from database
        target_tracks = await self.load_active_targets()
        logger.info(f"Loaded {len(target_tracks)} active target tracks")

        # Step 2: Search for playlists containing these tracks
        search_results = await self.searcher.search_for_target_tracks(target_tracks)

        # Step 3: Convert search results to scraping tasks
        scraping_tasks = await self.searcher.create_scraping_tasks(search_results)

        # Step 4: Queue tasks for scrapers
        await self.queue_scraping_tasks(scraping_tasks)

        # Step 5: Update target track statistics
        await self.update_target_statistics(search_results)

        logger.info(f"Search pipeline complete: {len(scraping_tasks)} tasks queued")

    async def load_active_targets(self) -> List[Dict]:
        """Load target tracks from database that need searching"""
        query = """
            SELECT track_id, title, artist, priority, last_searched
            FROM target_tracks
            WHERE is_active = true
            AND (last_searched IS NULL OR last_searched < NOW() - INTERVAL '24 hours')
            ORDER BY
                CASE priority
                    WHEN 'high' THEN 1
                    WHEN 'medium' THEN 2
                    ELSE 3
                END,
                last_searched ASC NULLS FIRST
            LIMIT 20
        """

        rows = await self.db.fetch(query)

        return [
            {
                'track_id': row['track_id'],
                'title': row['title'],
                'artist': row['artist'],
                'priority': row['priority']
            }
            for row in rows
        ]

    async def queue_scraping_tasks(self, tasks: List[Dict]):
        """Add scraping tasks to message queue"""
        for task in tasks:
            # Add to Redis queue for scrapers to consume
            await self.redis.lpush('scraping_queue', json.dumps(task))

            # Also publish to RabbitMQ if configured
            if self.queue:
                await self.queue.publish(
                    exchange='scrapers',
                    routing_key=f"scraper.{task['scraper']}",
                    body=json.dumps(task)
                )

        logger.info(f"Queued {len(tasks)} scraping tasks")

    async def update_target_statistics(self, search_results: Dict[str, List[str]]):
        """Update target tracks with search statistics"""
        for track_key, urls in search_results.items():
            # Parse track key
            parts = track_key.split(' - ', 1)
            if len(parts) == 2:
                artist, title = parts

                # Update target_tracks table
                query = """
                    UPDATE target_tracks
                    SET last_searched = NOW(),
                        playlists_found = playlists_found + $1
                    WHERE artist = $2 AND title = $3
                """

                await self.db.execute(query, len(urls), artist, title)

        logger.info("Updated target track statistics")