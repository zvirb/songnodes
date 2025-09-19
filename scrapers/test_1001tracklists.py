#!/usr/bin/env python3
"""
Test script for 1001tracklists spider
Tests the scraper functionality with real data and validates output
"""

import sys
import os
import logging
from scrapy.crawler import CrawlerProcess
from scrapy.utils.project import get_project_settings

# Add the scrapers directory to Python path
sys.path.insert(0, '/mnt/7ac3bfed-9d8e-4829-b134-b5e98ff7c013/programming/songnodes/scrapers')

import importlib.util
spec = importlib.util.spec_from_file_location("spider_module", "/mnt/7ac3bfed-9d8e-4829-b134-b5e98ff7c013/programming/songnodes/scrapers/spiders/1001tracklists_spider.py")
spider_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(spider_module)
OneThousandOneTracklistsSpider = spider_module.OneThousandOneTracklistsSpider

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(name)s] %(levelname)s: %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('/mnt/7ac3bfed-9d8e-4829-b134-b5e98ff7c013/programming/songnodes/scrapers/test_results.log')
    ]
)

logger = logging.getLogger(__name__)

class TestPipeline:
    """Pipeline to collect and validate scraped items"""

    def __init__(self):
        self.items = []
        self.setlist_items = []
        self.track_items = []
        self.track_artist_items = []
        self.setlist_track_items = []

    def process_item(self, item, spider):
        self.items.append(item)

        if item.__class__.__name__ == 'SetlistItem':
            self.setlist_items.append(item)
        elif item.__class__.__name__ == 'TrackItem':
            self.track_items.append(item)
        elif item.__class__.__name__ == 'TrackArtistItem':
            self.track_artist_items.append(item)
        elif item.__class__.__name__ == 'SetlistTrackItem':
            self.setlist_track_items.append(item)

        logger.info(f"Processed {item.__class__.__name__}: {dict(item)}")
        return item

    def close_spider(self, spider):
        logger.info(f"Spider closed. Total items: {len(self.items)}")
        logger.info(f"Setlist items: {len(self.setlist_items)}")
        logger.info(f"Track items: {len(self.track_items)}")
        logger.info(f"Track artist items: {len(self.track_artist_items)}")
        logger.info(f"Setlist track items: {len(self.setlist_track_items)}")

        # Validate data
        self.validate_data()

    def validate_data(self):
        """Validate the scraped data"""
        logger.info("Validating scraped data...")

        # Check if we have setlist items
        if not self.setlist_items:
            logger.error("No setlist items found!")
            return False

        # Check if we have track items
        if not self.track_items:
            logger.error("No track items found!")
            return False

        # Validate setlist data
        for setlist in self.setlist_items:
            if not setlist.get('setlist_name'):
                logger.warning(f"Setlist missing name: {setlist}")
            if not setlist.get('dj_artist_name'):
                logger.warning(f"Setlist missing DJ artist: {setlist}")

        # Validate track data
        for track in self.track_items:
            if not track.get('track_name'):
                logger.warning(f"Track missing name: {track}")
            if track.get('track_type') != 'Setlist':
                logger.warning(f"Track has wrong type: {track}")

        logger.info("Data validation completed")
        return True

def test_scraper():
    """Test the 1001tracklists scraper"""
    logger.info("Starting 1001tracklists scraper test...")

    # Configure settings
    settings = get_project_settings()
    settings.update({
        'ITEM_PIPELINES': {
            '__main__.TestPipeline': 300,
        },
        'LOG_LEVEL': 'INFO',
        'ROBOTSTXT_OBEY': False,  # Disable for testing
        'DOWNLOAD_DELAY': 2,      # Be extra polite during testing
        'CONCURRENT_REQUESTS': 1,
        'FEEDS': {
            '/mnt/7ac3bfed-9d8e-4829-b134-b5e98ff7c013/programming/songnodes/scrapers/test_output.json': {
                'format': 'json',
                'overwrite': True,
            },
        }
    })

    # Create and configure the crawler
    process = CrawlerProcess(settings)

    # Use only one URL for testing
    test_urls = [
        'https://www.1001tracklists.com/tracklist/1rcyn73t/claptone-purple-disco-machine-the-masquerade-pacha-ibiza-spain-2023-08-12.html'
    ]

    # Override the spider's start_urls for testing
    OneThousandOneTracklistsSpider.start_urls = test_urls

    # Run the spider
    try:
        process.crawl(OneThousandOneTracklistsSpider)
        process.start()
        logger.info("Spider test completed successfully")
        return True
    except Exception as e:
        logger.error(f"Spider test failed: {e}")
        return False

def check_requirements():
    """Check if all required modules are available"""
    try:
        import scrapy
        from scrapy.crawler import CrawlerProcess
        logger.info("All required modules are available")
        return True
    except ImportError as e:
        logger.error(f"Missing required module: {e}")
        return False

if __name__ == "__main__":
    logger.info("=" * 50)
    logger.info("1001tracklists Spider Test")
    logger.info("=" * 50)

    if not check_requirements():
        sys.exit(1)

    success = test_scraper()

    if success:
        logger.info("Test completed successfully!")
        print("\nTest Results:")
        print("- Check test_results.log for detailed logs")
        print("- Check test_output.json for scraped data")
    else:
        logger.error("Test failed!")
        sys.exit(1)