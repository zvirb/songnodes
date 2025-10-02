"""
Beatport Spider for SongNodes - High Priority for BPM/Key Data
===============================================================

Target: https://www.beatport.com
Priority Score: 2.11 (High Priority)

Focus: Electronic music metadata with detailed BPM, musical key, and genre classification

Data Sources:
- Robots.txt: Fully permissive (Allow: / for all user-agents)
- Sitemap: https://storage.googleapis.com/beatport-production-sitemap/sitemap/index_bp.xml
- Crawl-delay: 10 seconds (only for facebookexternalhit, we use conservative 10s for all)

Key Metadata Extracted:
- BPM (critical for DJ mixing and harmonic analysis)
- Musical key (Camelot notation for harmonic mixing)
- Genre and subgenre (detailed electronic music classification)
- Release date
- Label name
- ISRC (International Standard Recording Code)
- Artist information

Technical Approach:
- JavaScript rendering with Playwright (React/Next.js app)
- JSON-LD structured data extraction
- CSS selectors for fallback
- Conservative rate limiting (10s delay)
- Request interception to block images/CSS for performance

Implementation Date: October 2025
"""
import scrapy
import json
import re
import logging
import os
import hashlib
import psutil
from typing import Dict, Optional, List
from datetime import datetime
from urllib.parse import urljoin, urlparse
from scrapy.http import Request
from scrapy.exceptions import CloseSpider
import redis
import requests
from urllib import robotparser

try:
    from ...items import (
        EnhancedArtistItem,
        EnhancedTrackItem,
        EnhancedTrackArtistItem,
    )
    from ...item_loaders import TrackLoader, ArtistLoader
    from ...track_id_generator import generate_track_id, extract_remix_type
    from ...utils.memory_monitor import MemoryMonitor
except ImportError:
    # Fallback for standalone execution
    import sys
    sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
    from items import (
        EnhancedArtistItem,
        EnhancedTrackItem,
        EnhancedTrackArtistItem,
    )
    from item_loaders import TrackLoader, ArtistLoader
    from track_id_generator import generate_track_id, extract_remix_type
    from utils.memory_monitor import MemoryMonitor


class BeatportSpider(scrapy.Spider):
    """
    Beatport scraper for electronic music metadata with BPM/key data.

    Usage:
        scrapy crawl beatport -a search_mode=targeted
        scrapy crawl beatport -a search_query="Chris Lake"
        scrapy crawl beatport -a start_urls="https://www.beatport.com/track/..."
    """
    name = 'beatport'
    allowed_domains = ['beatport.com']

    # Conservative rate limiting (respect robots.txt spirit)
    download_delay = 10.0  # 10 seconds between requests
    randomize_download_delay = 0.3  # Range: 7-13 seconds

    custom_settings = {
        'USER_AGENT': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'ROBOTSTXT_OBEY': True,
        'COOKIES_ENABLED': True,

        # Conservative request settings
        'DOWNLOAD_DELAY': 10.0,
        'RANDOMIZE_DOWNLOAD_DELAY': 0.3,
        'CONCURRENT_REQUESTS': 1,
        'CONCURRENT_REQUESTS_PER_DOMAIN': 1,

        # AutoThrottle for dynamic adjustment
        'AUTOTHROTTLE_ENABLED': True,
        'AUTOTHROTTLE_START_DELAY': 10,
        'AUTOTHROTTLE_MAX_DELAY': 60,
        'AUTOTHROTTLE_TARGET_CONCURRENCY': 0.2,
        'AUTOTHROTTLE_DEBUG': True,

        # Retry settings
        'RETRY_TIMES': 3,
        'RETRY_HTTP_CODES': [500, 502, 503, 504, 522, 524, 408, 429, 403],
        'DOWNLOAD_TIMEOUT': 30,

        # Headers
        'DEFAULT_REQUEST_HEADERS': {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
        },

        # Pipeline
        'ITEM_PIPELINES': {
            'database_pipeline.DatabasePipeline': 300,
        },

        # Playwright for JavaScript rendering
        'DOWNLOAD_HANDLERS': {
            'http': 'scrapy_playwright.handler.ScrapyPlaywrightDownloadHandler',
            'https': 'scrapy_playwright.handler.ScrapyPlaywrightDownloadHandler',
        },
        'TWISTED_REACTOR': 'twisted.internet.asyncioreactor.AsyncioSelectorReactor',
    }

    def __init__(self, search_mode='targeted', start_urls=None, search_query=None, *args, **kwargs):
        """
        Initialize Beatport spider.

        Args:
            search_mode: 'targeted' (search for target tracks) or 'discovery' (browse)
            start_urls: Comma-separated URLs to scrape
            search_query: Search query string (artist or track name)
        """
        force_run_arg = kwargs.pop('force_run', None)
        super(BeatportSpider, self).__init__(*args, **kwargs)

        self.force_run = (
            force_run_arg
            if force_run_arg is not None
            else os.getenv('SCRAPER_FORCE_RUN', '0').lower() in ('1', 'true', 'yes')
        )

        self.search_mode = search_mode
        self.target_tracks = {}
        self.found_target_tracks = set()
        self.processed_urls = set()

        # Redis state store for deduplication
        self.redis_client = None
        self.redis_prefix = os.getenv('SCRAPER_STATE_PREFIX', 'scraped:tracks:beatport')
        self.source_ttl_seconds = int(os.getenv('SCRAPER_SOURCE_TTL_DAYS', '30')) * 86400
        self.run_ttl_seconds = int(os.getenv('SCRAPER_RUN_TTL_HOURS', '24')) * 3600
        self.last_run_key = None

        # Initialize memory monitor for Playwright page leak detection
        self.memory_monitor = MemoryMonitor(spider_name=self.name, logger=self.logger)

        # Load target tracks
        self.load_target_tracks()

        # Initialize Redis-backed state for cross-run dedupe
        self.initialize_state_store()
        self.apply_robots_policy()

        # Support for custom start URLs (from orchestrator)
        if start_urls:
            if isinstance(start_urls, str):
                self.start_urls = [url.strip() for url in start_urls.split(',')]
            else:
                self.start_urls = start_urls
            self.logger.info(f"Using provided start_urls: {self.start_urls}")
        # Support for search query (from orchestrator)
        elif search_query:
            search_url = f"https://www.beatport.com/search?q={search_query}"
            self.start_urls = [search_url]
            self.logger.info(f"Using search query: {search_query} -> {search_url}")
        # Generate search URLs based on target tracks
        elif self.search_mode == 'targeted':
            self.start_urls = self.generate_target_search_urls()
        else:
            self.start_urls = self.get_discovery_urls()

    def load_target_tracks(self):
        """Load target tracks from JSON file for focused scraping."""
        try:
            target_file = os.path.join(
                os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
                'target_tracks_for_scraping.json'
            )

            if os.path.exists(target_file):
                with open(target_file, 'r') as f:
                    target_data = json.load(f)

                # Load priority tracks
                priority_tracks = target_data.get('scraper_targets', {}).get('priority_tracks', [])
                for track in priority_tracks:
                    key = self.normalize_track_key(track['title'], track['primary_artist'])
                    self.target_tracks[key] = track

                # Load all tracks
                all_tracks = target_data.get('scraper_targets', {}).get('all_tracks', [])
                for track in all_tracks:
                    key = self.normalize_track_key(track['title'], track['primary_artist'])
                    if key not in self.target_tracks:
                        self.target_tracks[key] = track

                self.logger.info(f"Loaded {len(self.target_tracks)} target tracks for searching")
            else:
                self.logger.warning("Target tracks file not found, using discovery mode")
                self.search_mode = 'discovery'

        except Exception as e:
            self.logger.error(f"Error loading target tracks: {e}")
            self.search_mode = 'discovery'

    def initialize_state_store(self):
        """Set up Redis connection for persistent track tracking."""
        host = os.getenv('SCRAPER_STATE_REDIS_HOST', os.getenv('REDIS_HOST', 'localhost'))
        port = int(os.getenv('SCRAPER_STATE_REDIS_PORT', os.getenv('REDIS_PORT', 6379)))
        db = int(os.getenv('SCRAPER_STATE_REDIS_DB', os.getenv('REDIS_DB', 0)))

        try:
            client = redis.Redis(host=host, port=port, db=db, decode_responses=True, socket_timeout=2)
            client.ping()
            self.redis_client = client
            self.logger.info(
                "Using Redis state store at %s:%s db %s for track dedupe",
                host, port, db
            )
            self.enforce_run_quota()
        except Exception as exc:
            self.redis_client = None
            self.logger.warning("Redis state store unavailable (%s); continuing without cross-run dedupe", exc)

    def enforce_run_quota(self):
        """Enforce daily run quota to prevent over-scraping."""
        if not self.redis_client:
            return
        self.last_run_key = f"{self.redis_prefix}:last_run"
        if self.force_run:
            return
        last_run = self.redis_client.get(self.last_run_key)
        if last_run:
            self.logger.warning("Daily quota already used (last run at %s)", last_run)
            raise CloseSpider('daily_quota_reached')

    def normalize_track_key(self, title: str, artist: str) -> str:
        """Create normalized key for track matching."""
        normalized_title = re.sub(r'[^\w\s]', '', title.lower()).strip()
        normalized_artist = re.sub(r'[^\w\s]', '', artist.lower()).strip()
        return f"{normalized_artist}::{normalized_title}"

    def apply_robots_policy(self):
        """Apply robots.txt crawl-delay if specified."""
        robots_url = 'https://www.beatport.com/robots.txt'
        user_agent = self.custom_settings.get('USER_AGENT', 'Mozilla/5.0')
        parser = robotparser.RobotFileParser()

        try:
            response = requests.get(robots_url, timeout=5)
            if response.status_code != 200:
                self.logger.debug("Robots.txt fetch returned status %s", response.status_code)
                return
            parser.parse(response.text.splitlines())
            delay = parser.crawl_delay(user_agent) or parser.crawl_delay('*')
            if delay:
                delay = float(delay)
                current_delay = self.custom_settings.get('DOWNLOAD_DELAY', self.download_delay)
                if delay > current_delay:
                    self.download_delay = delay
                    self.custom_settings['DOWNLOAD_DELAY'] = delay
                    self.logger.info("Applied robots.txt crawl-delay of %s seconds", delay)
        except Exception as exc:
            self.logger.debug("Failed to apply robots policy: %s", exc)

    def generate_target_search_urls(self) -> List[str]:
        """Generate search URLs for target tracks."""
        search_urls = []

        # Group tracks by artist for efficient searching
        artist_tracks = {}
        for track_key, track_info in self.target_tracks.items():
            artist = track_info['primary_artist']
            if artist not in artist_tracks:
                artist_tracks[artist] = []
            artist_tracks[artist].append(track_info['title'])

        # Create search URLs for artists with multiple tracks
        for artist, tracks in sorted(artist_tracks.items(), key=lambda x: len(x[1]), reverse=True):
            if len(tracks) >= 2:  # Prioritize artists with multiple tracks
                search_url = f"https://www.beatport.com/search?q={artist}"
                search_urls.append(search_url)

        # Limit to reasonable batch size
        batch_size = int(os.getenv('BEATPORT_SEARCH_BATCH_SIZE', 30))
        return search_urls[:batch_size]

    def get_discovery_urls(self) -> List[str]:
        """Get URLs for discovery mode - popular genres and charts."""
        return [
            'https://www.beatport.com/genre/techno/6/tracks',
            'https://www.beatport.com/genre/tech-house/11/tracks',
            'https://www.beatport.com/genre/house/5/tracks',
            'https://www.beatport.com/genre/melodic-house-techno/90/tracks',
            'https://www.beatport.com/genre/progressive-house/15/tracks',
        ]

    async def abort_non_essential_requests(self, route):
        """
        Block non-essential resources (images, CSS, fonts) to improve performance.
        This reduces memory usage and speeds up page loads.
        """
        resource_type = route.request.resource_type
        if resource_type in ["image", "stylesheet", "font", "media"]:
            await route.abort()
        else:
            await route.continue_()

    def errback_close_page(self, failure):
        """
        Error callback to ensure Playwright pages are closed even on failure.
        This prevents memory leaks when requests fail.
        """
        page = failure.request.meta.get("playwright_page")
        if page:
            try:
                # Close page asynchronously - Scrapy will handle the coroutine
                import asyncio
                asyncio.create_task(page.close())
                self.memory_monitor.page_closed()
                self.logger.debug(f"Closed page on error: {failure.request.url}")
            except Exception as e:
                self.logger.error(f"Error closing page in errback: {e}")
                self.memory_monitor.page_errored()

        # Call original error handler
        return self.handle_error(failure)

    def start(self):
        """Generate initial requests with Playwright for JavaScript rendering."""
        from scrapy_playwright.page import PageMethod

        headers = {
            'User-Agent': self.custom_settings['USER_AGENT'],
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
        }

        for i, url in enumerate(self.start_urls):
            delay = i * 1.0 if i < 10 else 5

            # Determine callback based on URL type
            if '/track/' in url:
                callback = self.parse_track
            elif '/search' in url or '/genre/' in url:
                callback = self.parse_search_results
            else:
                callback = self.parse_search_results

            yield Request(
                url=url,
                headers=headers,
                callback=callback,
                errback=self.errback_close_page,
                meta={
                    'playwright': True,
                    'playwright_page_methods': [
                        PageMethod('route', '**/*', self.abort_non_essential_requests),
                        PageMethod('wait_for_load_state', 'networkidle', timeout=15000),
                    ],
                    'download_timeout': 30,
                    'download_delay': delay,
                }
            )

    def parse_search_results(self, response):
        """Parse search results and extract track links."""
        self.logger.info(f"Parsing search results: {response.url}")

        # Track Playwright page for memory monitoring
        page = response.meta.get("playwright_page")
        if page:
            self.memory_monitor.page_opened()

        try:
            self._parse_search_results_impl(response)
        finally:
            # Ensure Playwright page is always closed
            if page:
                try:
                    import asyncio
                    asyncio.create_task(page.close())
                    self.memory_monitor.page_closed()
                    self.logger.debug(f"Closed Playwright page: {response.url}")
                except Exception as e:
                    self.logger.error(f"Error closing Playwright page: {e}")
                    self.memory_monitor.page_errored()

    def _parse_search_results_impl(self, response):
        """Implementation of parse_search_results (separated for try/finally pattern)"""
        # Extract track links from search results
        track_links = []

        # Try multiple selectors for track links
        selectors = [
            'a[href*="/track/"]::attr(href)',
            '.track-link::attr(href)',
            '.playable-track a::attr(href)',
        ]

        for selector in selectors:
            links = response.css(selector).getall()
            if links:
                track_links.extend(links)
                self.logger.debug(f"Found {len(links)} track links with selector: {selector}")

        # Fallback: regex extraction
        if not track_links:
            pattern = r'href="(/track/[^"]+)"'
            matches = re.findall(pattern, response.text)
            if matches:
                track_links = matches
                self.logger.info(f"Regex extraction found {len(matches)} track links")

        # Deduplicate
        track_links = list(set(track_links))

        if not track_links:
            self.logger.warning(f"No track links found in search results: {response.url}")
            return

        # Process up to 20 tracks per search page
        for link in track_links[:20]:
            full_url = response.urljoin(link)

            if full_url in self.processed_urls or self.is_source_processed(full_url):
                continue

            self.processed_urls.add(full_url)

            from scrapy_playwright.page import PageMethod

            yield Request(
                url=full_url,
                callback=self.parse_track,
                errback=self.errback_close_page,
                meta={
                    'playwright': True,
                    'playwright_page_methods': [
                        PageMethod('route', '**/*', self.abort_non_essential_requests),
                        PageMethod('wait_for_load_state', 'networkidle', timeout=15000),
                    ],
                }
            )

    def parse_track(self, response):
        """
        Parse individual track page and extract comprehensive metadata.

        Extracts:
        - Track title and artists
        - BPM (critical!)
        - Musical key (Camelot notation)
        - Genre and subgenre
        - Release date
        - Label name
        - ISRC
        """
        self.logger.info(f"Parsing track: {response.url}")

        # Track Playwright page for memory monitoring
        page = response.meta.get("playwright_page")
        if page:
            self.memory_monitor.page_opened()

        try:
            self._parse_track_impl(response)
        finally:
            # Ensure Playwright page is always closed
            if page:
                try:
                    import asyncio
                    asyncio.create_task(page.close())
                    self.memory_monitor.page_closed()
                    self.logger.debug(f"Closed Playwright page: {response.url}")
                except Exception as e:
                    self.logger.error(f"Error closing Playwright page: {e}")
                    self.memory_monitor.page_errored()

    def _parse_track_impl(self, response):
        """Implementation of parse_track (separated for try/finally pattern)"""
        try:
            # Try JSON-LD structured data first (most reliable)
            json_ld_data = self.extract_json_ld(response)
            if json_ld_data:
                yield from self.process_json_ld_track(json_ld_data, response.url)
                self.mark_source_processed(response.url)
                return

            # Fallback: Parse from page structure
            track_data = self.extract_track_from_page(response)
            if track_data:
                yield from self.process_track_data(track_data, response.url)
                self.mark_source_processed(response.url)
            else:
                self.logger.warning(f"Could not extract track data: {response.url}")

        except Exception as e:
            self.logger.error(f"Error parsing track {response.url}: {e}", exc_info=True)
        finally:
            self.mark_source_processed(response.url)

    def extract_json_ld(self, response) -> Optional[Dict]:
        """Extract JSON-LD structured data from page."""
        try:
            json_ld_scripts = response.css('script[type="application/ld+json"]::text').getall()

            for script in json_ld_scripts:
                try:
                    data = json.loads(script)
                    # Look for MusicRecording type
                    if isinstance(data, dict) and data.get('@type') == 'MusicRecording':
                        return data
                    # Handle list of entities
                    elif isinstance(data, list):
                        for item in data:
                            if isinstance(item, dict) and item.get('@type') == 'MusicRecording':
                                return item
                except json.JSONDecodeError:
                    continue

            return None

        except Exception as e:
            self.logger.debug(f"JSON-LD extraction failed: {e}")
            return None

    def extract_track_from_page(self, response) -> Optional[Dict]:
        """Extract track data from page HTML structure."""
        try:
            # Extract track name
            track_name = (
                response.css('h1.track-title::text').get() or
                response.css('h1[class*="Title"]::text').get() or
                response.css('h1::text').get()
            )

            if not track_name:
                return None

            # Extract artists
            artists = (
                response.css('a[href*="/artist/"]::text').getall() or
                response.css('.track-artists a::text').getall() or
                []
            )

            # Extract BPM
            bpm_text = (
                response.css('.bpm-value::text').get() or
                response.css('[class*="Bpm"]::text').get()
            )
            bpm = self.extract_bpm(bpm_text) if bpm_text else None

            # Extract musical key
            key_text = (
                response.css('.key-value::text').get() or
                response.css('[class*="Key"]::text').get()
            )
            musical_key, camelot = self.parse_musical_key(key_text) if key_text else (None, None)

            # Extract genre
            genre = (
                response.css('a[href*="/genre/"]::text').get() or
                response.css('.track-genre::text').get()
            )

            # Extract release date
            release_date = (
                response.css('.release-date::text').get() or
                response.css('time::attr(datetime)').get()
            )

            # Extract label
            label = (
                response.css('a[href*="/label/"]::text').get() or
                response.css('.track-label::text').get()
            )

            # Extract ISRC (if visible)
            isrc = response.css('[class*="Isrc"]::text').get()

            return {
                'track_name': track_name.strip() if track_name else None,
                'artists': [a.strip() for a in artists if a.strip()],
                'bpm': bpm,
                'musical_key': musical_key,
                'camelot': camelot,
                'genre': genre.strip() if genre else None,
                'release_date': release_date.strip() if release_date else None,
                'label': label.strip() if label else None,
                'isrc': isrc.strip() if isrc else None,
            }

        except Exception as e:
            self.logger.error(f"Error extracting track from page: {e}")
            return None

    def process_json_ld_track(self, json_ld_data: Dict, source_url: str):
        """Process JSON-LD structured data and create Scrapy items."""
        try:
            # Extract basic info
            track_name = json_ld_data.get('name')
            if not track_name:
                return

            # Extract artists
            by_artist = json_ld_data.get('byArtist', [])
            if isinstance(by_artist, dict):
                by_artist = [by_artist]

            artists = [artist.get('name') for artist in by_artist if artist.get('name')]
            primary_artist = artists[0] if artists else 'Unknown Artist'

            # Extract audio features
            duration_iso = json_ld_data.get('duration')  # ISO 8601 duration
            duration_ms = self.parse_iso_duration(duration_iso) if duration_iso else None

            # Extract additional properties
            properties = json_ld_data.get('additionalProperty', [])
            bpm = None
            musical_key = None
            camelot = None
            genre = None
            isrc = None

            for prop in properties:
                if isinstance(prop, dict):
                    prop_name = prop.get('name', '').lower()
                    prop_value = prop.get('value')

                    if 'bpm' in prop_name:
                        bpm = self.extract_bpm(str(prop_value))
                    elif 'key' in prop_name:
                        musical_key, camelot = self.parse_musical_key(str(prop_value))
                    elif 'genre' in prop_name:
                        genre = prop_value
                    elif 'isrc' in prop_name:
                        isrc = prop_value

            # Extract release date
            release_date = json_ld_data.get('datePublished')

            # Extract label
            record_label = json_ld_data.get('recordLabel', {})
            label = record_label.get('name') if isinstance(record_label, dict) else None

            track_data = {
                'track_name': track_name,
                'artists': artists,
                'bpm': bpm,
                'musical_key': musical_key,
                'camelot': camelot,
                'genre': genre,
                'release_date': release_date,
                'label': label,
                'isrc': isrc,
                'duration_ms': duration_ms,
            }

            yield from self.process_track_data(track_data, source_url)

        except Exception as e:
            self.logger.error(f"Error processing JSON-LD track: {e}")

    def process_track_data(self, track_data: Dict, source_url: str):
        """Process extracted track data and create Scrapy items with ItemLoaders."""
        try:
            track_name = track_data.get('track_name')
            artists = track_data.get('artists', [])
            primary_artist = artists[0] if artists else 'Unknown Artist'

            if not track_name:
                return

            # Check if this matches a target track
            track_key = self.normalize_track_key(track_name, primary_artist)
            is_target = track_key in self.target_tracks

            if is_target:
                self.found_target_tracks.add(track_key)
                self.logger.info(f"✓ FOUND TARGET TRACK: {track_name} by {primary_artist}")

            # Determine remix info
            is_remix = 'remix' in track_name.lower() or 'edit' in track_name.lower()
            remix_type = extract_remix_type(track_name) if is_remix else None

            # Generate deterministic track_id
            track_id = generate_track_id(
                title=track_name,
                primary_artist=primary_artist,
                is_remix=is_remix,
                remix_type=remix_type
            )

            # Use ItemLoader for track
            loader = TrackLoader(item=EnhancedTrackItem(), response=None)

            # Basic track info
            loader.add_value('track_name', track_name)
            loader.add_value('normalized_title', track_name.lower())

            # Audio features
            if track_data.get('bpm'):
                loader.add_value('bpm', track_data['bpm'])
            if track_data.get('musical_key'):
                loader.add_value('musical_key', track_data['musical_key'])
            if track_data.get('duration_ms'):
                loader.add_value('duration_ms', track_data['duration_ms'])

            # Music metadata
            if track_data.get('genre'):
                loader.add_value('genre', track_data['genre'])
            if track_data.get('release_date'):
                loader.add_value('release_date', track_data['release_date'])
            if track_data.get('label'):
                loader.add_value('record_label', track_data['label'])
            if track_data.get('isrc'):
                loader.add_value('isrc', track_data['isrc'])

            # Track characteristics
            loader.add_value('is_remix', is_remix)
            if remix_type:
                loader.add_value('remix_type', remix_type)

            # Metadata
            metadata = {
                'source': 'beatport',
                'source_url': source_url,
                'camelot_key': track_data.get('camelot'),
                'scraped_at': datetime.utcnow().isoformat(),
                'is_target_track': is_target,
            }
            loader.add_value('metadata', json.dumps(metadata))

            # External URLs
            external_urls = {'beatport': source_url}
            loader.add_value('external_urls', json.dumps(external_urls))

            # System fields
            loader.add_value('track_type', 'Release')
            loader.add_value('data_source', self.name)
            loader.add_value('scrape_timestamp', datetime.utcnow())
            loader.add_value('created_at', datetime.utcnow())

            track_item = loader.load_item()
            yield track_item

            # Create artist items and relationships
            for i, artist_name in enumerate(artists):
                # Artist item
                artist_loader = ArtistLoader(item=EnhancedArtistItem(), response=None)
                artist_loader.add_value('artist_name', artist_name)
                artist_loader.add_value('normalized_name', artist_name.lower())
                artist_loader.add_value('data_source', self.name)
                artist_loader.add_value('scrape_timestamp', datetime.utcnow())
                artist_loader.add_value('created_at', datetime.utcnow())

                artist_item = artist_loader.load_item()
                yield artist_item

                # Track-Artist relationship
                relationship = EnhancedTrackArtistItem(
                    track_name=track_name,
                    artist_name=artist_name,
                    artist_role='primary' if i == 0 else 'featured',
                    position=i,
                    data_source=self.name,
                    scrape_timestamp=datetime.utcnow(),
                    created_at=datetime.utcnow()
                )
                yield relationship

        except Exception as e:
            self.logger.error(f"Error processing track data: {e}", exc_info=True)

    def extract_bpm(self, text: str) -> Optional[int]:
        """Extract BPM value from text."""
        if not text:
            return None

        # Remove "BPM" text and extract number
        match = re.search(r'(\d+)', str(text))
        if match:
            bpm = int(match.group(1))
            # Validate reasonable BPM range (60-200 for electronic music)
            if 60 <= bpm <= 200:
                return bpm

        return None

    def parse_musical_key(self, text: str) -> tuple:
        """
        Parse musical key and return both standard and Camelot notation.

        Returns:
            (standard_key, camelot_key) tuple
            e.g., ("Dbm", "12A")
        """
        if not text:
            return None, None

        text_upper = str(text).upper()

        # Extract Camelot notation (e.g., "12A")
        camelot_match = re.search(r'(\d{1,2}[AB])', text_upper)
        camelot = camelot_match.group(1) if camelot_match else None

        # Extract standard notation (e.g., "Db Minor")
        # Look for note (C, D, E, F, G, A, B) with optional sharp/flat
        key_match = re.search(r'([A-G][#b]?)\s*(MAJOR|MINOR|MAJ|MIN)?', text_upper)
        if key_match:
            note = key_match.group(1)
            mode = key_match.group(2)

            # Normalize to standard format
            if mode and 'MIN' in mode:
                standard_key = f"{note}m"
            else:
                standard_key = note
        else:
            standard_key = None

        return standard_key, camelot

    def parse_iso_duration(self, duration: str) -> Optional[int]:
        """
        Parse ISO 8601 duration to milliseconds.

        Example: "PT5M23S" -> 323000
        """
        if not duration:
            return None

        try:
            # Simple parser for PT format (PT5M23S = 5 minutes 23 seconds)
            match = re.match(r'PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?', duration)
            if match:
                hours = int(match.group(1) or 0)
                minutes = int(match.group(2) or 0)
                seconds = float(match.group(3) or 0)

                total_seconds = hours * 3600 + minutes * 60 + seconds
                return int(total_seconds * 1000)  # Convert to milliseconds
        except Exception as e:
            self.logger.debug(f"Error parsing ISO duration '{duration}': {e}")

        return None

    def is_source_processed(self, url: str) -> bool:
        """Check Redis to see if a track URL was already scraped."""
        if url in self.processed_urls:
            return True
        if not self.redis_client:
            return False
        digest = hashlib.sha1(url.encode('utf-8')).hexdigest()
        key = f"{self.redis_prefix}:{digest}"
        try:
            return bool(self.redis_client.exists(key))
        except Exception as exc:
            self.logger.debug("Redis exists check failed: %s", exc)
            return False

    def mark_source_processed(self, url: str) -> None:
        """Persistently mark a track URL as processed."""
        if not url:
            return
        self.processed_urls.add(url)
        if not self.redis_client:
            return
        digest = hashlib.sha1(url.encode('utf-8')).hexdigest()
        key = f"{self.redis_prefix}:{digest}"
        try:
            self.redis_client.setex(key, self.source_ttl_seconds, datetime.utcnow().isoformat())
        except Exception as exc:
            self.logger.debug("Redis setex failed: %s", exc)

    def handle_error(self, failure):
        """Enhanced error handling with retry logic."""
        # Check if it's a response error
        if hasattr(failure, 'value') and hasattr(failure.value, 'response'):
            response = failure.value.response
            if response is not None:
                status = response.status
                self.logger.error(f"Request failed with status {status}: {failure.request.url}")

                # Don't retry 404s
                if status == 404:
                    self.logger.warning(f"Skipping 404 URL: {failure.request.url}")
                    return
        else:
            self.logger.error(f"Request failed: {failure.request.url} - {failure.value if hasattr(failure, 'value') else failure}")

    def closed(self, reason):
        """Log spider statistics and record run timestamp."""
        self.logger.info(f"\n{'='*60}")
        self.logger.info(f"BEATPORT SPIDER COMPLETED")
        self.logger.info(f"{'='*60}")
        self.logger.info(f"Spider closed: {reason}")
        self.logger.info(f"Search mode: {self.search_mode}")
        self.logger.info(f"Target tracks loaded: {len(self.target_tracks)}")
        self.logger.info(f"Target tracks found: {len(self.found_target_tracks)}")
        self.logger.info(f"URLs processed: {len(self.processed_urls)}")

        if self.found_target_tracks:
            self.logger.info(f"\n✓ FOUND TARGET TRACKS:")
            for track_key in self.found_target_tracks:
                track_info = self.target_tracks.get(track_key, {})
                self.logger.info(f"  • {track_info.get('title', 'Unknown')} - {track_info.get('primary_artist', 'Unknown')}")

        completion_rate = (len(self.found_target_tracks) / len(self.target_tracks)) * 100 if self.target_tracks else 0
        self.logger.info(f"\nTarget track completion rate: {completion_rate:.1f}%")
        self.logger.info(f"{'='*60}")

        # Log final memory statistics
        self.memory_monitor.log_final_stats()

        # Record run timestamp
        if self.redis_client and self.last_run_key:
            try:
                self.redis_client.setex(self.last_run_key, self.run_ttl_seconds, datetime.utcnow().isoformat())
            except Exception as exc:
                self.logger.debug("Redis setex failed for last run tracking: %s", exc)
