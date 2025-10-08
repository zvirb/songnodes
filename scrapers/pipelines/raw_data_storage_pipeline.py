"""
Raw Data Storage Pipeline - Data Validation Archive

Stores raw scraped items to raw_scrape_data table for manual validation.
Runs FIRST in the pipeline chain (priority 50) and passes items unchanged.

This is a NON-INVASIVE logging pipeline that does NOT modify or block items.
"""
import json
import logging
from datetime import datetime
from typing import Any
from twisted.internet import defer
from twisted.enterprise import adbapi
import psycopg2
import psycopg2.extras

logger = logging.getLogger(__name__)


class RawDataStoragePipeline:
    """
    Archive raw scraped data for manual validation.

    Features:
    - Stores ALL items to raw_scrape_data table
    - Does NOT modify items (pass-through)
    - Does NOT block processing on errors
    - Runs before validation/enrichment/persistence
    """

    @classmethod
    def from_crawler(cls, crawler):
        """Load database config from environment"""
        import os

        # Use centralized secrets manager if available
        try:
            from common.secrets_manager import get_database_config
            db_config = get_database_config()
            # Allow environment variable overrides
            if os.getenv('DATABASE_HOST'):
                db_config['host'] = os.getenv('DATABASE_HOST')
            if os.getenv('DATABASE_PORT'):
                db_config['port'] = int(os.getenv('DATABASE_PORT'))
            logger.info(f"✓ Raw data storage using: {db_config['host']}:{db_config['port']}")
        except ImportError:
            # Fallback to environment variables
            db_config = {
                'host': os.getenv('DATABASE_HOST', 'postgres'),
                'port': int(os.getenv('DATABASE_PORT', '5432')),
                'database': os.getenv('DATABASE_NAME', 'musicdb'),
                'user': os.getenv('DATABASE_USER', 'musicdb_user'),
                'password': os.getenv('DATABASE_PASSWORD', 'musicdb_secure_pass_2024')
            }
            logger.info(f"✓ Raw data storage using env vars: {db_config['host']}:{db_config['port']}")

        return cls(db_config, crawler.spider.name if hasattr(crawler, 'spider') else 'unknown')

    def __init__(self, database_config: dict, spider_name: str):
        self.spider_name = spider_name
        self.config = database_config
        self.dbpool = None
        self.items_logged = 0
        self.errors = 0

    def open_spider(self, spider):
        """Initialize database connection pool"""
        try:
            self.dbpool = adbapi.ConnectionPool(
                'psycopg2',
                host=self.config['host'],
                port=self.config['port'],
                database=self.config['database'],
                user=self.config['user'],
                password=self.config['password'],
                cp_min=1,
                cp_max=3,
                cp_noisy=False
            )
            logger.info(f"✓ Raw data storage pipeline initialized for {spider.name}")
        except Exception as e:
            logger.error(f"❌ Failed to initialize raw data storage: {e}")
            self.dbpool = None

    def close_spider(self, spider):
        """Close database connections and log statistics"""
        if self.dbpool:
            self.dbpool.close()

        logger.info(
            f"Raw data storage stats - Items logged: {self.items_logged}, "
            f"Errors: {self.errors}"
        )

    def process_item(self, item, spider):
        """
        Store raw item data to database (non-blocking).
        ALWAYS returns item unchanged.
        """
        if not self.dbpool:
            # If database unavailable, just pass item through
            return item

        # Store to database asynchronously (don't wait for result)
        deferred = self.dbpool.runInteraction(self._store_raw_item, item, spider.name)
        deferred.addErrback(self._handle_error, item)

        # CRITICAL: Return item immediately to continue pipeline
        return item

    def _store_raw_item(self, tx, item, source):
        """Store raw item to database (runs in thread pool)"""
        try:
            # Convert item to JSON-serializable dict
            item_dict = dict(item)

            # Determine scrape type from item class name
            scrape_type = item.__class__.__name__.replace('Item', '').lower()

            # Insert into raw_scrape_data table
            tx.execute("""
                INSERT INTO raw_scrape_data (source, scrape_type, source_url, raw_data, scraped_at)
                VALUES (%s, %s, %s, %s, %s)
            """, (
                source,
                scrape_type,
                item_dict.get('source_url', item_dict.get('url', '')),
                json.dumps(item_dict, default=str),  # Handle datetime/UUID serialization
                datetime.now()
            ))

            self.items_logged += 1

        except Exception as e:
            logger.error(f"Failed to store raw item: {e}")
            self.errors += 1

    def _handle_error(self, failure, item):
        """Handle storage errors (log but don't block pipeline)"""
        logger.error(f"Raw data storage error: {failure.getErrorMessage()}")
        self.errors += 1
        # Item continues through pipeline despite storage error
