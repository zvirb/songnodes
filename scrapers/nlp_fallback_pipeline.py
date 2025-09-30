"""
NLP Fallback Pipeline for Scrapy
=================================

Pipeline that enriches low-quality extractions using NLP when structured
extraction yields insufficient results.

This pipeline runs AFTER initial item extraction but BEFORE database storage,
allowing it to enhance items that have low track counts or poor quality data.
"""

import logging
import os
from typing import Optional
from scrapy import Spider
from scrapy.exceptions import DropItem

logger = logging.getLogger(__name__)


class NLPFallbackPipeline:
    """
    Pipeline that adds NLP fallback enrichment when structured extraction fails.

    Checks items for low quality indicators:
    - Low track count (< minimum threshold)
    - Missing critical fields
    - Extraction method marked as 'failed'

    When detected, attempts NLP extraction to enrich the item.
    """

    def __init__(self):
        self.enable_nlp_fallback = os.getenv('ENABLE_NLP_FALLBACK', 'true').lower() in ('true', '1', 'yes')
        self.min_track_threshold = int(os.getenv('NLP_MIN_TRACK_THRESHOLD', '3'))
        self.nlp_processor_url = os.getenv('NLP_PROCESSOR_URL', 'http://nlp-processor:8021')
        self.enrichment_count = 0
        self.total_processed = 0

    @classmethod
    def from_crawler(cls, crawler):
        """Create pipeline from crawler settings."""
        pipeline = cls()
        return pipeline

    def process_item(self, item, spider: Spider):
        """
        Process item and enrich with NLP if needed.

        Args:
            item: Scrapy item to process
            spider: Spider instance

        Returns:
            Enriched item or original item
        """
        self.total_processed += 1

        # Skip if NLP fallback disabled
        if not self.enable_nlp_fallback:
            return item

        # Check if item needs enrichment
        needs_enrichment = self._should_enrich_item(item, spider)

        if not needs_enrichment:
            return item

        # Try to enrich item with NLP
        enriched_item = self._enrich_with_nlp(item, spider)

        if enriched_item:
            self.enrichment_count += 1
            logger.info(
                f"NLP enrichment success [{self.enrichment_count}/{self.total_processed}]: "
                f"{item.get('item_type', 'unknown')} from {spider.name}"
            )
            return enriched_item

        return item

    def _should_enrich_item(self, item, spider: Spider) -> bool:
        """
        Determine if item should be enriched with NLP.

        Args:
            item: Scrapy item
            spider: Spider instance

        Returns:
            True if item needs enrichment
        """
        item_type = item.get('item_type', '')

        # Check playlist/setlist items
        if item_type in ['playlist', 'setlist']:
            tracks = item.get('tracks', [])
            total_tracks = item.get('total_tracks', 0)

            # Enrich if track count is low
            if isinstance(tracks, list) and len(tracks) < self.min_track_threshold:
                logger.debug(f"Low track count detected: {len(tracks)} tracks")
                return True

            if total_tracks < self.min_track_threshold:
                logger.debug(f"Low total_tracks detected: {total_tracks}")
                return True

        # Check extraction method
        extraction_method = item.get('extraction_method', '')
        if extraction_method in ['failed', 'partial', 'incomplete']:
            logger.debug(f"Failed extraction method detected: {extraction_method}")
            return True

        # Check for missing critical fields
        if item_type in ['playlist', 'setlist']:
            if not item.get('name') or not item.get('source_url'):
                logger.debug("Missing critical fields detected")
                return True

        return False

    def _enrich_with_nlp(self, item, spider: Spider) -> Optional[dict]:
        """
        Enrich item using NLP extraction.

        Args:
            item: Original Scrapy item
            spider: Spider instance

        Returns:
            Enriched item or None if enrichment failed
        """
        try:
            source_url = item.get('source_url', '')
            if not source_url:
                logger.warning("Cannot enrich item without source_url")
                return None

            # Check if spider has NLP fallback capability
            if not hasattr(spider, 'extract_via_nlp_sync'):
                logger.debug(f"Spider {spider.name} does not support NLP fallback")
                return None

            # Get cached response if available
            if hasattr(spider, 'last_response') and spider.last_response:
                response = spider.last_response
                html = response.body.decode('utf-8') if isinstance(response.body, bytes) else str(response.body)
            else:
                # Fetch URL if no cached response
                import httpx
                import asyncio

                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)

                try:
                    async def fetch():
                        async with httpx.AsyncClient(timeout=30.0) as client:
                            response = await client.get(source_url, follow_redirects=True)
                            response.raise_for_status()
                            return response.text

                    html = loop.run_until_complete(fetch())
                finally:
                    loop.close()

            # Extract tracks via NLP
            tracks = spider.extract_via_nlp_sync(html, source_url)

            if not tracks or len(tracks) < self.min_track_threshold:
                logger.debug(f"NLP extraction yielded insufficient tracks: {len(tracks) if tracks else 0}")
                return None

            # Enrich item with NLP tracks
            item['tracks'] = tracks
            item['total_tracks'] = len(tracks)
            item['extraction_method'] = 'nlp_enriched'

            logger.info(f"Successfully enriched item with {len(tracks)} NLP-extracted tracks")
            return item

        except Exception as e:
            logger.error(f"Error enriching item with NLP: {e}")
            return None

    def close_spider(self, spider: Spider):
        """Log pipeline statistics when spider closes."""
        logger.info(
            f"NLP Fallback Pipeline Stats for {spider.name}: "
            f"{self.enrichment_count} enriched / {self.total_processed} total items "
            f"({self.enrichment_count / self.total_processed * 100:.1f}% enrichment rate)"
        )