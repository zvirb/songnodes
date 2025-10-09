"""
Observability Wrapper Pipeline for SongNodes Scrapers

Wraps existing pipelines with comprehensive observability tracking.
Creates scraping run records and tracks all metrics.

Priority: 50 (runs before validation and persistence)
"""
import logging
import asyncio
from typing import Dict, Any
from scrapy import Spider
from scrapy.exceptions import DropItem
import sys
import os

# Add parent directory to path for imports
parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

from pipeline_observability import (
    PipelineObservabilityTracker,
    SourceExtractionLog,
    PipelineMetric
)

logger = logging.getLogger(__name__)


class ObservabilityWrapperPipeline:
    """
    Wrapper pipeline that adds observability tracking to scraping runs.

    Features:
    - Creates scraping_run records
    - Tracks source extractions
    - Monitors pipeline metrics
    - Detects anomalies

    Priority: 50 (before validation and persistence)
    """

    @classmethod
    def from_crawler(cls, crawler):
        """Initialize from crawler with database config"""
        import os

        # Get database config from secrets manager
        try:
            from secrets_manager import get_database_config
            db_config = get_database_config()
            logger.info("✅ Using centralized secrets manager for observability")
        except ImportError:
            db_config = {
                'host': os.getenv('DATABASE_HOST', 'postgres'),
                'port': int(os.getenv('DATABASE_PORT', '5432')),
                'database': os.getenv('DATABASE_NAME', 'musicdb'),
                'user': os.getenv('DATABASE_USER', 'musicdb_user'),
                'password': os.getenv('DATABASE_PASSWORD', 'musicdb_secure_pass_2024')
            }
            logger.info("⚠️ Using environment variables for observability")

        return cls(db_config, crawler.spider.name if crawler.spider else 'unknown')

    def __init__(self, database_config: Dict[str, Any], spider_name: str):
        """Initialize observability tracker"""
        self.database_config = database_config
        self.spider_name = spider_name
        self.tracker = None
        self.run_id = None

        # Track metrics for this run
        self.run_stats = {
            'items_processed': 0,
            'playlists_found': 0,
            'songs_added': 0,
            'artists_added': 0,
            'errors': []
        }

    def open_spider(self, spider: Spider):
        """Initialize tracker and start run tracking"""
        # Initialize tracker in separate thread to avoid Twisted conflicts
        import threading

        def init_tracker():
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                self.tracker = PipelineObservabilityTracker(self.database_config)
                loop.run_until_complete(self.tracker.initialize())

                # Start run tracking
                self.run_id = loop.run_until_complete(
                    self.tracker.start_run_tracking(spider.name)
                )
                logger.info(f"✅ Started observability tracking for run {self.run_id}")
            except Exception as e:
                logger.error(f"Failed to initialize observability tracker: {e}")
                raise

        init_thread = threading.Thread(target=init_tracker)
        init_thread.start()
        init_thread.join()

    def process_item(self, item: Dict[str, Any], spider: Spider) -> Dict[str, Any]:
        """Process item and track metrics"""
        if not self.tracker or not self.run_id:
            logger.warning("Observability tracker not initialized, skipping tracking")
            return item

        try:
            self.run_stats['items_processed'] += 1

            # Track based on item type
            item_type = item.get('item_type')

            if item_type == 'playlist' or item_type == 'setlist':
                self.run_stats['playlists_found'] += 1

                # Track source extraction if URL present
                if item.get('source_url'):
                    self._track_source_extraction(item)

            elif item_type == 'track':
                self.run_stats['songs_added'] += 1

            elif item_type == 'artist':
                self.run_stats['artists_added'] += 1

            return item

        except Exception as e:
            logger.error(f"Error in observability tracking: {e}")
            self.run_stats['errors'].append(str(e))
            return item

    def _track_source_extraction(self, item: Dict[str, Any]):
        """Track source extraction metrics"""
        if not self.tracker or not self.run_id:
            return

        import threading

        def track():
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                from urllib.parse import urlparse

                source_url = item.get('source_url', '')
                domain = urlparse(source_url).netloc if source_url else 'unknown'

                extraction_log = SourceExtractionLog(
                    source_url=source_url,
                    website_domain=domain,
                    scraper_used=self.spider_name,
                    success=not bool(item.get('scrape_error')),
                    error_message=item.get('scrape_error'),
                    extracted_elements={
                        'tracklist_count': item.get('tracklist_count', 0),
                        'parsing_version': item.get('parsing_version')
                    }
                )

                loop.run_until_complete(
                    self.tracker.track_source_extraction(self.run_id, extraction_log)
                )
            except Exception as e:
                logger.error(f"Error tracking source extraction: {e}")

        # Track in background thread
        track_thread = threading.Thread(target=track, daemon=True)
        track_thread.start()

    def close_spider(self, spider: Spider):
        """End run tracking and flush metrics"""
        if not self.tracker or not self.run_id:
            logger.warning("No observability tracker to close")
            return

        import threading

        def end_tracking():
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                # Determine run status
                status = 'failed' if self.run_stats['errors'] else 'completed'

                # End run tracking
                loop.run_until_complete(
                    self.tracker.end_run_tracking(
                        self.run_id,
                        status=status,
                        playlists_found=self.run_stats['playlists_found'],
                        songs_added=self.run_stats['songs_added'],
                        artists_added=self.run_stats['artists_added'],
                        errors_count=len(self.run_stats['errors']),
                        error_details={'errors': self.run_stats['errors'][:10]}  # Limit to first 10
                    )
                )

                logger.info(f"✅ Observability tracking completed for run {self.run_id}")
                logger.info(f"   Status: {status}")
                logger.info(f"   Playlists: {self.run_stats['playlists_found']}")
                logger.info(f"   Songs: {self.run_stats['songs_added']}")
                logger.info(f"   Artists: {self.run_stats['artists_added']}")

                # Close tracker
                loop.run_until_complete(self.tracker.close())

            except Exception as e:
                logger.error(f"Error ending observability tracking: {e}")
            finally:
                loop.close()

        end_thread = threading.Thread(target=end_tracking)
        end_thread.start()
        end_thread.join(timeout=10)
