#!/usr/bin/env python3
"""
Target Track Scraper CronJob
Automatically scrapes playlists/setlists containing target tracks from the database
"""
import asyncio
import os
import sys
import httpx
import structlog
import logging
from datetime import datetime
from typing import List, Dict, Any
import asyncpg

# Configure Python's logging module to output to stdout
logging.basicConfig(
    format="%(message)s",
    stream=sys.stdout,
    level=logging.INFO,
)

# Configure structured logging
structlog.configure(
    processors=[
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.dev.ConsoleRenderer()
    ],
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger()

# Configuration from environment
POSTGRES_HOST = os.getenv('POSTGRES_HOST', 'postgres')
POSTGRES_PORT = int(os.getenv('POSTGRES_PORT', 5432))
POSTGRES_DB = os.getenv('POSTGRES_DB', 'musicdb')
POSTGRES_USER = os.getenv('POSTGRES_USER', 'musicdb_user')
POSTGRES_PASSWORD = os.getenv('POSTGRES_PASSWORD')
UNIFIED_SCRAPER_URL = os.getenv('UNIFIED_SCRAPER_URL', 'http://unified-scraper:8000')
BATCH_SIZE = int(os.getenv('BATCH_SIZE', 10))
DELAY_BETWEEN_BATCHES = int(os.getenv('DELAY_BETWEEN_BATCHES', 60))

class TargetTrackScraperJob:
    """Scrapes playlists/setlists for target tracks"""

    def __init__(self):
        self.db_pool = None
        self.http_client = httpx.AsyncClient(timeout=900.0)  # 15 minute timeout
        self.tracks_processed = 0
        self.tracks_failed = 0
        self.playlists_found = 0

    async def connect_db(self):
        """Connect to PostgreSQL"""
        try:
            self.db_pool = await asyncpg.create_pool(
                host=POSTGRES_HOST,
                port=POSTGRES_PORT,
                database=POSTGRES_DB,
                user=POSTGRES_USER,
                password=POSTGRES_PASSWORD,
                min_size=2,
                max_size=10
            )
            logger.info("Database connection established")
        except Exception as e:
            logger.error("Failed to connect to database", error=str(e))
            raise

    async def get_pending_searches(self, limit: int) -> List[Dict[str, Any]]:
        """Get target tracks to search for"""
        query = """
            SELECT
                search_id,
                search_query,
                target_artist,
                target_title,
                scraper_name
            FROM musicdb.target_track_searches
            ORDER BY search_timestamp ASC
            LIMIT $1
        """

        async with self.db_pool.acquire() as conn:
            rows = await conn.fetch(query, limit)
            return [dict(row) for row in rows]

    async def scrape_track(self, search: Dict[str, Any]) -> bool:
        """
        Scrape playlists/setlists containing the target track
        Returns True if successful, False otherwise
        """
        search_query = search['search_query']
        scraper_name = search.get('scraper_name', 'mixesdb')

        logger.info(
            "Scraping target track",
            search_query=search_query,
            artist=search['target_artist'],
            title=search['target_title'],
            scraper=scraper_name
        )

        try:
            # Call unified scraper API with search query
            # The scraper will search for playlists containing this track
            response = await self.http_client.post(
                f"{UNIFIED_SCRAPER_URL}/scrape",
                json={
                    'source': scraper_name,  # Fixed: API expects 'source', not 'scraper'
                    'search_query': search_query
                }
            )

            if response.status_code == 200:
                result = response.json()
                items_found = result.get('items_processed', result.get('tracks_count', 0))

                logger.info(
                    "Track scraping completed",
                    search_query=search_query,
                    items_found=items_found,
                    status=result.get('status')
                )

                # Update database with success
                await self.update_search_status(
                    search['search_id'],
                    success=True,
                    items_found=items_found
                )

                if items_found > 0:
                    self.playlists_found += items_found

                return True

            else:
                logger.error(
                    "Scraper API error",
                    search_query=search_query,
                    status=response.status_code,
                    response=response.text[:200]
                )

                # Update database with failure
                await self.update_search_status(
                    search['search_id'],
                    success=False,
                    error=f"API error: {response.status_code}"
                )

                return False

        except httpx.RequestError as e:
            logger.error(
                "HTTP request failed",
                search_query=search_query,
                error=str(e)
            )

            await self.update_search_status(
                search['search_id'],
                success=False,
                error=f"Request error: {str(e)}"
            )

            return False

        except Exception as e:
            logger.error(
                "Scraping error",
                search_query=search_query,
                error=str(e),
                error_type=type(e).__name__
            )

            await self.update_search_status(
                search['search_id'],
                success=False,
                error=f"Error: {str(e)}"
            )

            return False

    async def update_search_status(
        self,
        search_id: str,
        success: bool,
        items_found: int = 0,
        error: str = None
    ):
        """Update the search results in the database"""
        if success:
            query = """
                UPDATE musicdb.target_track_searches
                SET
                    results_found = $2,
                    playlists_containing = $2
                WHERE search_id = $1
            """
            async with self.db_pool.acquire() as conn:
                await conn.execute(query, search_id, items_found)
        else:
            logger.warning("Search failed but not updating error tracking", search_id=search_id, error=error)

    async def run(self):
        """Main execution loop"""
        logger.info(
            "Starting target track scraper job",
            batch_size=BATCH_SIZE,
            delay_between_batches=DELAY_BETWEEN_BATCHES
        )

        try:
            # Connect to database
            await self.connect_db()

            batch_number = 0
            total_processed = 0

            while True:
                batch_number += 1

                # Get next batch of tracks to scrape
                searches = await self.get_pending_searches(BATCH_SIZE)

                if not searches:
                    logger.info("No more tracks to scrape")
                    break

                logger.info(
                    f"Processing batch {batch_number}",
                    batch_size=len(searches),
                    total_processed=total_processed
                )

                # Process each track in the batch
                for search in searches:
                    success = await self.scrape_track(search)

                    if success:
                        self.tracks_processed += 1
                    else:
                        self.tracks_failed += 1

                    total_processed += 1

                    # Small delay between individual tracks
                    await asyncio.sleep(5)

                # Delay between batches to respect rate limits
                if len(searches) == BATCH_SIZE:
                    logger.info(
                        f"Batch {batch_number} complete, waiting {DELAY_BETWEEN_BATCHES}s before next batch",
                        tracks_processed=self.tracks_processed,
                        tracks_failed=self.tracks_failed,
                        playlists_found=self.playlists_found
                    )
                    await asyncio.sleep(DELAY_BETWEEN_BATCHES)

            # Final summary
            logger.info(
                "Target track scraper job completed",
                batches_processed=batch_number,
                tracks_processed=self.tracks_processed,
                tracks_failed=self.tracks_failed,
                playlists_found=self.playlists_found,
                success_rate=f"{(self.tracks_processed / total_processed * 100):.1f}%" if total_processed > 0 else "0%"
            )

        except Exception as e:
            logger.error(
                "Job failed",
                error=str(e),
                error_type=type(e).__name__
            )
            sys.exit(1)

        finally:
            # Cleanup
            if self.http_client:
                await self.http_client.aclose()

            if self.db_pool:
                await self.db_pool.close()

async def main():
    """Entry point"""
    job = TargetTrackScraperJob()
    await job.run()

if __name__ == "__main__":
    asyncio.run(main())
