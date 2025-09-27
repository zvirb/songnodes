#!/usr/bin/env python3
"""
SongNodes Scraper Runner - Python version for orchestrated scraping
Integrates with the scraper-orchestrator service and target tracks system
"""

import asyncio
import asyncpg
import logging
import os
import sys
from pathlib import Path
import json
import httpx
from datetime import datetime
from typing import List, Dict, Any

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class ScraperRunner:
    """Main scraper runner that coordinates with the orchestrator service"""

    def __init__(self):
        self.db_host = os.getenv('DB_HOST', 'localhost')
        self.db_port = int(os.getenv('DB_PORT', 5433))
        self.db_name = os.getenv('DB_NAME', 'musicdb')
        self.db_user = os.getenv('DB_USER', 'musicdb_user')
        self.db_password = os.getenv('DB_PASSWORD', '7D82_xqNs55tGyk')

        self.orchestrator_url = os.getenv('ORCHESTRATOR_URL', 'http://localhost:8001')
        self.pool = None

    async def init_db(self):
        """Initialize database connection pool"""
        self.pool = await asyncpg.create_pool(
            host=self.db_host,
            port=self.db_port,
            database=self.db_name,
            user=self.db_user,
            password=self.db_password,
            min_size=2,
            max_size=10
        )
        logger.info("Database pool initialized")

    async def close_db(self):
        """Close database connection pool"""
        if self.pool:
            await self.pool.close()
            logger.info("Database pool closed")

    async def trigger_orchestrator(self):
        """Trigger the orchestrator to start scraping"""
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    f"{self.orchestrator_url}/trigger-scrapers",
                    json={"source": "manual", "timestamp": datetime.now().isoformat()}
                )
                if response.status_code == 200:
                    logger.info("Orchestrator triggered successfully")
                    return response.json()
                else:
                    logger.error(f"Orchestrator trigger failed: {response.status_code}")
                    return None
            except Exception as e:
                logger.error(f"Error triggering orchestrator: {e}")
                return None

    async def check_target_tracks(self):
        """Check and display target tracks status"""
        async with self.pool.acquire() as conn:
            # Get target track stats
            stats = await conn.fetchrow("""
                SELECT
                    COUNT(*) as total_tracks,
                    COUNT(CASE WHEN priority = 'high' THEN 1 END) as high_priority,
                    COUNT(CASE WHEN priority = 'medium' THEN 1 END) as medium_priority,
                    COUNT(CASE WHEN priority = 'low' THEN 1 END) as low_priority,
                    COUNT(CASE WHEN last_searched IS NOT NULL THEN 1 END) as searched_tracks,
                    SUM(playlists_found) as total_playlists_found
                FROM target_tracks
                WHERE is_active = true
            """)

            logger.info("=== Target Tracks Status ===")
            logger.info(f"Total active tracks: {stats['total_tracks']}")
            logger.info(f"High priority: {stats['high_priority']}")
            logger.info(f"Medium priority: {stats['medium_priority']}")
            logger.info(f"Low priority: {stats['low_priority']}")
            logger.info(f"Searched tracks: {stats['searched_tracks']}")
            logger.info(f"Total playlists found: {stats['total_playlists_found'] or 0}")

            # Get top unscraped tracks
            unscraped = await conn.fetch("""
                SELECT title, artist, priority
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
                LIMIT 5
            """)

            if unscraped:
                logger.info("\n=== Next tracks to search ===")
                for track in unscraped:
                    logger.info(f"[{track['priority']}] {track['artist']} - {track['title']}")

    async def check_scraping_status(self):
        """Check the status of current scraping operations"""
        async with self.pool.acquire() as conn:
            # Check recent scraping activity
            recent = await conn.fetchrow("""
                SELECT
                    COUNT(*) as playlists_24h,
                    COUNT(DISTINCT source) as sources_active,
                    MAX(created_at) as last_playlist_added
                FROM playlists
                WHERE created_at > NOW() - INTERVAL '24 hours'
            """)

            logger.info("\n=== Recent Scraping Activity ===")
            logger.info(f"Playlists added (24h): {recent['playlists_24h']}")
            logger.info(f"Active sources: {recent['sources_active']}")
            if recent['last_playlist_added']:
                logger.info(f"Last playlist added: {recent['last_playlist_added']}")

            # Check adjacency relationships
            adjacencies = await conn.fetchrow("""
                SELECT
                    COUNT(*) as total_adjacencies,
                    COUNT(DISTINCT track1_id) as unique_tracks
                FROM song_adjacency
                WHERE created_at > NOW() - INTERVAL '24 hours'
            """)

            logger.info(f"\n=== Track Adjacencies (24h) ===")
            logger.info(f"New adjacencies: {adjacencies['total_adjacencies']}")
            logger.info(f"Unique tracks involved: {adjacencies['unique_tracks']}")

    async def run_search_pipeline(self):
        """Execute the target track search pipeline"""
        logger.info("Starting target track search pipeline...")

        # Import the search orchestrator
        sys.path.append(str(Path(__file__).parent.parent / 'services' / 'scraper-orchestrator'))
        from target_track_searcher import SearchOrchestrator

        # Note: In production, this would use proper Redis and queue connections
        orchestrator = SearchOrchestrator(
            db_connection=self.pool,
            redis_client=None,  # Would connect to Redis
            message_queue=None   # Would connect to RabbitMQ
        )

        try:
            await orchestrator.execute_search_pipeline()
            logger.info("Search pipeline completed successfully")
        except Exception as e:
            logger.error(f"Search pipeline failed: {e}")

    async def run(self, mode='status'):
        """Main run method"""
        await self.init_db()

        try:
            if mode == 'status':
                await self.check_target_tracks()
                await self.check_scraping_status()

            elif mode == 'trigger':
                logger.info("Triggering orchestrator...")
                result = await self.trigger_orchestrator()
                if result:
                    logger.info(f"Orchestrator response: {result}")

            elif mode == 'search':
                await self.run_search_pipeline()

            elif mode == 'full':
                # Full pipeline: search then scrape
                await self.check_target_tracks()
                await self.run_search_pipeline()
                await self.trigger_orchestrator()
                await self.check_scraping_status()

        finally:
            await self.close_db()


async def main():
    """Main entry point"""
    import argparse

    parser = argparse.ArgumentParser(description='SongNodes Scraper Runner')
    parser.add_argument('--mode', choices=['status', 'trigger', 'search', 'full'],
                      default='status', help='Run mode')
    parser.add_argument('--verbose', action='store_true', help='Enable verbose logging')

    args = parser.parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    runner = ScraperRunner()
    await runner.run(args.mode)


if __name__ == "__main__":
    asyncio.run(main())