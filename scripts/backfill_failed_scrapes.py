#!/usr/bin/env python3
"""
Backfill script to re-queue playlists that failed parsing.
Identifies URLs with scrape_error or 0 tracklist_count and re-queues them.
"""
import asyncio
import asyncpg
import redis
import json
import logging
from datetime import datetime, timedelta

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Database connection
DB_CONFIG = {
    'host': 'localhost',
    'port': 5433,
    'user': 'musicdb_user',
    'password': 'musicdb_secure_pass_2024',
    'database': 'musicdb'
}

# Redis connection
REDIS_CONFIG = {
    'host': 'localhost',
    'port': 6380,
    'password': 'redis_secure_pass_2024',
    'db': 0
}

async def find_failed_scrapes(conn, hours=24):
    """Find playlists that failed parsing in the last N hours."""
    query = """
    SELECT playlist_id, source_url, source, scrape_error, tracklist_count, last_scrape_attempt
    FROM playlists
    WHERE (
        (scrape_error IS NOT NULL AND scrape_error != '')
        OR (tracklist_count = 0 OR tracklist_count IS NULL)
    )
    AND (
        last_scrape_attempt > NOW() - INTERVAL '%s hours'
        OR last_scrape_attempt IS NULL
    )
    ORDER BY last_scrape_attempt DESC NULLS FIRST
    LIMIT 1000;
    """ % hours

    results = await conn.fetch(query)
    logger.info(f"Found {len(results)} failed scrapes to backfill")
    return results

async def queue_scrape_task(redis_client, url, source):
    """Queue a scraping task to Redis."""
    task = {
        'url': url,
        'source': source,
        'task_id': f"backfill_{source}_{datetime.now().timestamp()}",
        'priority': 'high',
        'retry_attempt': True
    }

    # Push to pending queue
    redis_client.rpush('scraping_queue:pending', json.dumps(task))
    logger.info(f"Queued {source} task for {url}")
    return True

async def main():
    # Connect to database
    conn = await asyncpg.connect(**DB_CONFIG)
    logger.info("Connected to database")

    # Connect to Redis
    redis_client = redis.Redis(**REDIS_CONFIG, decode_responses=True)
    logger.info("Connected to Redis")

    # Find failed scrapes from last 24 hours
    failed_scrapes = await find_failed_scrapes(conn, hours=24)

    if not failed_scrapes:
        logger.info("No failed scrapes to backfill")
        await conn.close()
        return

    # Group by source
    by_source = {}
    for row in failed_scrapes:
        source = row['source']
        if source not in by_source:
            by_source[source] = []
        by_source[source].append(row)

    # Display summary
    logger.info("=" * 80)
    logger.info("FAILED SCRAPES SUMMARY")
    logger.info("=" * 80)
    for source, items in by_source.items():
        logger.info(f"{source}: {len(items)} failed URLs")
    logger.info("=" * 80)

    # Queue tasks
    queued_count = 0
    for source, items in by_source.items():
        for item in items:
            try:
                await queue_scrape_task(redis_client, item['source_url'], source)
                queued_count += 1
            except Exception as e:
                logger.error(f"Failed to queue {item['source_url']}: {e}")

    logger.info(f"✅ Successfully queued {queued_count} tasks for retry")

    # Close connections
    await conn.close()
    redis_client.close()

if __name__ == "__main__":
    asyncio.run(main())
