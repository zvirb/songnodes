"""
NLP Fallback Spider Mixin for Scrapy Spiders
==============================================

Provides synchronous wrappers for NLP fallback functionality that can be
integrated into Scrapy spiders (which run in Twisted's event loop).

Usage:
    from nlp_spider_mixin import NLPFallbackSpiderMixin

    class MySpider(NLPFallbackSpiderMixin, scrapy.Spider):
        name = 'my_spider'
        enable_nlp_fallback = True

        def parse(self, response):
            # Try structured extraction
            tracks = self.parse_structured(response)

            # If failed, try NLP fallback
            if not tracks and self.enable_nlp_fallback:
                tracks = self.extract_via_nlp_sync(response.body, response.url)
                extraction_method = 'nlp'
"""

import asyncio
import logging
import os
from typing import List, Dict, Optional
from bs4 import BeautifulSoup
import re
from concurrent.futures import ThreadPoolExecutor
import threading

logger = logging.getLogger(__name__)


class NLPFallbackSpiderMixin:
    """
    Mixin to add NLP fallback capabilities to Scrapy spiders.

    Provides synchronous wrappers around async NLP extraction functions
    that work within Scrapy's Twisted reactor environment.
    """

    # Configuration
    enable_nlp_fallback = os.getenv('ENABLE_NLP_FALLBACK', 'true').lower() in ('true', '1', 'yes')
    nlp_processor_url = os.getenv('NLP_PROCESSOR_URL', 'http://nlp-processor:8021')
    nlp_timeout = int(os.getenv('NLP_FALLBACK_TIMEOUT', '60'))

    # Thread pool for running async code (created once, reused)
    _executor = ThreadPoolExecutor(max_workers=4, thread_name_prefix="nlp_async")

    def _run_async_in_thread(self, coro):
        """
        Run an async coroutine in a separate thread with its own event loop.

        This is necessary because Scrapy runs in Twisted's reactor, which conflicts
        with asyncio. By running async code in a thread pool, we avoid event loop conflicts.
        """
        def run_in_new_loop():
            # Create new event loop for this thread
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                return loop.run_until_complete(coro)
            finally:
                loop.close()

        # Submit to thread pool and wait for result
        future = self._executor.submit(run_in_new_loop)
        return future.result(timeout=self.nlp_timeout)

    def extract_via_nlp_sync(
        self,
        html_or_text: str,
        url: str,
        extract_timestamps: bool = True
    ) -> List[Dict]:
        """
        Synchronous wrapper for NLP extraction.

        Extracts clean text from HTML and sends to NLP processor for tracklist extraction.
        Works in Scrapy's Twisted reactor by running async code in separate thread.

        Args:
            html_or_text: Raw HTML or plain text content
            url: Source URL for context
            extract_timestamps: Whether to attempt timestamp extraction

        Returns:
            List of extracted tracks with artist/title information
        """
        if not self.enable_nlp_fallback:
            logger.debug("NLP fallback disabled")
            return []

        try:
            # Extract clean text from HTML if needed
            if '<html' in html_or_text.lower() or '<body' in html_or_text.lower():
                text = self._run_async_in_thread(
                    self._extract_text_async(html_or_text)
                )
            else:
                text = html_or_text

            if not text or len(text.strip()) < 50:
                logger.warning(f"Text too short for NLP processing: {len(text)} chars")
                return []

            # Send to NLP processor (run in separate thread to avoid event loop conflicts)
            tracks = self._run_async_in_thread(
                self._call_nlp_processor_async(text, url, extract_timestamps)
            )

            logger.info(f"NLP extracted {len(tracks)} tracks from {url}")
            return tracks

        except Exception as e:
            logger.error(f"NLP fallback error for {url}: {e}")
            return []

    async def _extract_text_async(self, html: str) -> str:
        """
        Extract clean text from HTML asynchronously.

        Args:
            html: Raw HTML content

        Returns:
            Clean text suitable for NLP processing
        """
        try:
            soup = BeautifulSoup(html, 'html.parser')

            # Remove unwanted elements
            for element in soup(['script', 'style', 'nav', 'footer', 'header', 'iframe', 'noscript']):
                element.decompose()

            # Extract text with line breaks
            text = soup.get_text(separator='\n', strip=True)

            # Clean up excessive whitespace
            text = re.sub(r'\n\s*\n', '\n\n', text)
            text = re.sub(r'[ \t]+', ' ', text)

            return text

        except Exception as e:
            logger.error(f"Error extracting text from HTML: {e}")
            return html  # Return raw HTML as fallback

    async def _call_nlp_processor_async(
        self,
        text: str,
        source_url: str,
        extract_timestamps: bool
    ) -> List[Dict]:
        """
        Call NLP processor API asynchronously.

        Args:
            text: Text content to analyze
            source_url: Original source URL for context
            extract_timestamps: Whether to extract timestamps

        Returns:
            List of extracted tracks
        """
        import httpx

        try:
            async with httpx.AsyncClient(timeout=self.nlp_timeout) as client:
                response = await client.post(
                    f"{self.nlp_processor_url}/extract_tracklist",
                    json={
                        "text": text,
                        "source_url": source_url,
                        "extract_timestamps": extract_timestamps
                    }
                )
                response.raise_for_status()

                data = response.json()
                tracks = data.get('tracks', [])

                return tracks

        except httpx.HTTPError as e:
            logger.error(f"NLP processor HTTP error: {e}")
            return []
        except Exception as e:
            logger.error(f"NLP processor error: {e}")
            return []

    def try_nlp_fallback(self, response, primary_tracks: Optional[List] = None) -> Dict:
        """
        Convenience method to try NLP fallback if primary extraction failed.

        Args:
            response: Scrapy Response object
            primary_tracks: Tracks from primary extraction method (if any)

        Returns:
            Dict with 'tracks' and 'extraction_method' keys
        """
        if primary_tracks and len(primary_tracks) > 0:
            return {
                'tracks': primary_tracks,
                'extraction_method': 'structured'
            }

        if not self.enable_nlp_fallback:
            logger.info(f"Primary extraction failed and NLP disabled for {response.url}")
            return {
                'tracks': [],
                'extraction_method': 'failed'
            }

        logger.info(f"Primary extraction failed, trying NLP fallback for {response.url}")

        try:
            html = response.body.decode('utf-8') if isinstance(response.body, bytes) else response.body
            tracks = self.extract_via_nlp_sync(html, response.url)

            if tracks and len(tracks) > 0:
                return {
                    'tracks': tracks,
                    'extraction_method': 'nlp'
                }
        except Exception as e:
            logger.error(f"NLP fallback failed for {response.url}: {e}")

        return {
            'tracks': [],
            'extraction_method': 'failed'
        }

    def enhance_tracks_with_source_info(
        self,
        tracks: List[Dict],
        source_platform: str,
        source_url: str
    ) -> List[Dict]:
        """
        Add source metadata to extracted tracks.

        Args:
            tracks: List of track dictionaries
            source_platform: Platform name (e.g., 'mixesdb', 'reddit')
            source_url: Original source URL

        Returns:
            Enhanced track list with metadata
        """
        for track in tracks:
            # Add source information
            track.setdefault('source', source_platform)
            track.setdefault('source_url', source_url)

            # Ensure required fields exist
            track.setdefault('item_type', 'playlist_track')
            track.setdefault('position', tracks.index(track) + 1)

            # Clean up artist and track names
            if 'artist_name' in track:
                track['artist_name'] = track['artist_name'].strip()
            if 'track_name' in track:
                track['track_name'] = track['track_name'].strip()

        return tracks