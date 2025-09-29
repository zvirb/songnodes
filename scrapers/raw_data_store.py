"""
Raw Data Storage for Scraper Resilience
Stores raw scraped data to disk/database before processing to prevent data loss
"""
import json
import os
import asyncio
import asyncpg
from datetime import datetime
from typing import Dict, List, Any, Optional
import logging
import hashlib

logger = logging.getLogger(__name__)

class RawDataStore:
    """Stores raw scraped data for recovery and reprocessing"""

    def __init__(self, storage_path: str = "/app/raw_data", db_config: Optional[Dict] = None):
        self.storage_path = storage_path
        self.db_config = db_config
        self.connection_pool = None

        # Create storage directory
        os.makedirs(storage_path, exist_ok=True)
        os.makedirs(f"{storage_path}/playlists", exist_ok=True)
        os.makedirs(f"{storage_path}/failed", exist_ok=True)

    async def initialize_db(self):
        """Initialize database connection and create raw data table if needed"""
        if not self.db_config:
            return

        try:
            connection_string = f"postgresql://{self.db_config['user']}:{self.db_config['password']}@{self.db_config['host']}:{self.db_config['port']}/{self.db_config['database']}"
            self.connection_pool = await asyncpg.create_pool(
                connection_string,
                min_size=2,
                max_size=5
            )

            # Create raw data table if it doesn't exist
            async with self.connection_pool.acquire() as conn:
                await conn.execute("""
                    CREATE TABLE IF NOT EXISTS raw_scrape_data (
                        scrape_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
                        source VARCHAR(100),
                        scrape_type VARCHAR(50),
                        raw_data JSONB,
                        processed BOOLEAN DEFAULT FALSE,
                        error_message TEXT,
                        scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        processed_at TIMESTAMP
                    )
                """)

                # Create index for unprocessed items
                await conn.execute("""
                    CREATE INDEX IF NOT EXISTS idx_raw_scrape_unprocessed
                    ON raw_scrape_data(processed, scraped_at)
                    WHERE processed = FALSE
                """)

                logger.info("✓ Raw data storage table initialized")

        except Exception as e:
            logger.error(f"Failed to initialize raw data storage: {e}")

    async def store_playlist(self, playlist_data: Dict[str, Any], source: str = "1001tracklists") -> str:
        """Store raw playlist data and return storage ID"""
        try:
            # Generate unique ID for this scrape
            playlist_id = playlist_data.get('id', '')
            timestamp = datetime.now().isoformat()
            scrape_id = hashlib.md5(f"{playlist_id}_{timestamp}".encode()).hexdigest()

            # Store to file system
            filename = f"{self.storage_path}/playlists/{source}_{scrape_id}.json"
            with open(filename, 'w') as f:
                json.dump({
                    'scrape_id': scrape_id,
                    'source': source,
                    'scraped_at': timestamp,
                    'playlist': playlist_data
                }, f, indent=2)

            # Also store to database if available
            if self.connection_pool:
                async with self.connection_pool.acquire() as conn:
                    await conn.execute("""
                        INSERT INTO raw_scrape_data (source, scrape_type, raw_data)
                        VALUES ($1, $2, $3)
                    """, source, 'playlist', json.dumps(playlist_data))

            logger.debug(f"Stored raw playlist data: {scrape_id}")
            return scrape_id

        except Exception as e:
            logger.error(f"Failed to store raw playlist data: {e}")
            return None

    async def store_failed_processing(self, data: Dict[str, Any], error: str):
        """Store data that failed processing for later retry"""
        try:
            timestamp = datetime.now().isoformat()
            filename = f"{self.storage_path}/failed/failed_{timestamp.replace(':', '-')}.json"

            with open(filename, 'w') as f:
                json.dump({
                    'data': data,
                    'error': error,
                    'failed_at': timestamp
                }, f, indent=2)

            logger.info(f"Stored failed processing data for retry: {filename}")

        except Exception as e:
            logger.error(f"Failed to store error data: {e}")

    async def get_unprocessed_playlists(self, limit: int = 100) -> List[Dict[str, Any]]:
        """Retrieve unprocessed playlist data from storage"""
        unprocessed = []

        # First try database
        if self.connection_pool:
            try:
                async with self.connection_pool.acquire() as conn:
                    rows = await conn.fetch("""
                        SELECT scrape_id, raw_data, source
                        FROM raw_scrape_data
                        WHERE processed = FALSE
                        AND scrape_type = 'playlist'
                        ORDER BY scraped_at
                        LIMIT $1
                    """, limit)

                    for row in rows:
                        unprocessed.append({
                            'scrape_id': str(row['scrape_id']),
                            'source': row['source'],
                            'data': json.loads(row['raw_data'])
                        })

            except Exception as e:
                logger.error(f"Failed to retrieve from database: {e}")

        # Also check filesystem
        playlist_dir = f"{self.storage_path}/playlists"
        for filename in os.listdir(playlist_dir)[:limit - len(unprocessed)]:
            if filename.endswith('.json'):
                filepath = os.path.join(playlist_dir, filename)
                try:
                    with open(filepath, 'r') as f:
                        data = json.load(f)
                        if not data.get('processed', False):
                            unprocessed.append(data)
                except Exception as e:
                    logger.error(f"Failed to read {filepath}: {e}")

        return unprocessed

    async def mark_processed(self, scrape_id: str, success: bool = True, error: str = None):
        """Mark a raw data entry as processed"""
        if self.connection_pool:
            try:
                async with self.connection_pool.acquire() as conn:
                    await conn.execute("""
                        UPDATE raw_scrape_data
                        SET processed = TRUE,
                            processed_at = CURRENT_TIMESTAMP,
                            error_message = $2
                        WHERE scrape_id = $1
                    """, scrape_id, error)

            except Exception as e:
                logger.error(f"Failed to mark as processed: {e}")

    async def get_statistics(self) -> Dict[str, int]:
        """Get statistics about raw data storage"""
        stats = {
            'total_stored': 0,
            'unprocessed': 0,
            'processed': 0,
            'failed': 0
        }

        if self.connection_pool:
            try:
                async with self.connection_pool.acquire() as conn:
                    stats['total_stored'] = await conn.fetchval(
                        "SELECT COUNT(*) FROM raw_scrape_data"
                    )
                    stats['unprocessed'] = await conn.fetchval(
                        "SELECT COUNT(*) FROM raw_scrape_data WHERE processed = FALSE"
                    )
                    stats['processed'] = await conn.fetchval(
                        "SELECT COUNT(*) FROM raw_scrape_data WHERE processed = TRUE AND error_message IS NULL"
                    )
                    stats['failed'] = await conn.fetchval(
                        "SELECT COUNT(*) FROM raw_scrape_data WHERE error_message IS NOT NULL"
                    )

            except Exception as e:
                logger.error(f"Failed to get statistics: {e}")

        # Count filesystem files
        playlist_files = len(os.listdir(f"{self.storage_path}/playlists"))
        failed_files = len(os.listdir(f"{self.storage_path}/failed"))

        stats['filesystem_playlists'] = playlist_files
        stats['filesystem_failed'] = failed_files

        return stats

    async def close(self):
        """Close database connections"""
        if self.connection_pool:
            await self.connection_pool.close()