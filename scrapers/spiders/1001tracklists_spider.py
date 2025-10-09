"""
Enhanced 1001tracklists Spider for Comprehensive Music Data Collection
Targets specific tracks from our curated list and collects complete metadata
"""
import scrapy
import time
import logging
import json
import re
import os
import hashlib
import random
import psutil
from typing import Dict
from urllib.parse import quote
from scrapy.exceptions import DropItem, CloseSpider
from scrapy.http import Request
from datetime import datetime
import redis
import requests
from urllib import robotparser

try:
    from ..items import (
        EnhancedArtistItem,
        EnhancedTrackItem,
        EnhancedSetlistItem,
        EnhancedTrackArtistItem,
        EnhancedSetlistTrackItem,
        EnhancedTrackAdjacencyItem,
        TargetTrackSearchItem,
        PlaylistItem
    )
    from ..item_loaders import (
        ArtistLoader,
        TrackLoader,
        SetlistLoader,
        PlaylistLoader
    )
    from .utils import parse_track_string
    from ..track_id_generator import generate_track_id, generate_track_id_from_parsed
    from ..utils.memory_monitor import MemoryMonitor
except ImportError:
    # Fallback for standalone execution
    import sys
    import os
    sys.path.append(os.path.dirname(os.path.dirname(__file__)))
    from items import (
        EnhancedArtistItem,
        EnhancedTrackItem,
        EnhancedSetlistItem,
        EnhancedTrackArtistItem,
        EnhancedSetlistTrackItem,
        EnhancedTrackAdjacencyItem,
        TargetTrackSearchItem,
        PlaylistItem
    )
    from item_loaders import (
        ArtistLoader,
        TrackLoader,
        SetlistLoader,
        PlaylistLoader
    )
    from spiders.utils import parse_track_string
    from track_id_generator import generate_track_id, generate_track_id_from_parsed
    from utils.memory_monitor import MemoryMonitor


class OneThousandOneTracklistsSpider(scrapy.Spider):
    name = '1001tracklists'
    allowed_domains = ['1001tracklists.com']

    # Rate limiting settings for respectful scraping - VERY CONSERVATIVE to avoid CAPTCHA
    download_delay = 90.0
    randomize_download_delay = 0.3

    custom_settings = {
        # Anti-detection settings
        'USER_AGENT': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'ROBOTSTXT_OBEY': False,
        'COOKIES_ENABLED': True,
        # Conservative request settings to avoid rate limiting and CAPTCHA blocking
        'DOWNLOAD_DELAY': 90.0,  # 90 seconds between requests
        'RANDOMIZE_DOWNLOAD_DELAY': 0.3,  # Range: 63-135 seconds
        'CONCURRENT_REQUESTS': 1,
        'CONCURRENT_REQUESTS_PER_DOMAIN': 1,
        # AutoThrottle for dynamic delay adjustment
        'AUTOTHROTTLE_ENABLED': True,
        'AUTOTHROTTLE_START_DELAY': 90,  # Match DOWNLOAD_DELAY
        'AUTOTHROTTLE_MAX_DELAY': 300,  # Up to 5 minutes if needed
        'AUTOTHROTTLE_TARGET_CONCURRENCY': 0.2,  # Very low concurrency
        'AUTOTHROTTLE_DEBUG': True,
        # Retry settings with rate limiting codes
        'RETRY_TIMES': 5,
        'RETRY_HTTP_CODES': [500, 502, 503, 504, 522, 524, 408, 429, 403],
        # Realistic headers
        'DEFAULT_REQUEST_HEADERS': {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Linux"'
        },
        'ITEM_PIPELINES': {
            'pipelines.raw_data_storage_pipeline.RawDataStoragePipeline': 50,  # Raw data archive
            'pipelines.validation_pipeline.ValidationPipeline': 100,  # Validation
            'pipelines.enrichment_pipeline.EnrichmentPipeline': 200,  # Enrichment
            'pipelines.persistence_pipeline.PersistencePipeline': 300,  # Modern async persistence
        }
        # NOTE: Playwright launch options are defined globally in settings.py
        # to ensure headless mode works in Docker containers without X server
    }

    def __init__(self, search_mode='targeted', start_urls=None, search_query=None, *args, **kwargs):
        force_run_arg = kwargs.pop('force_run', None)
        super(OneThousandOneTracklistsSpider, self).__init__(*args, **kwargs)
        self.force_run = (
            force_run_arg
            if force_run_arg is not None
            else os.getenv('SCRAPER_FORCE_RUN', '0').lower() in ('1', 'true', 'yes')
        )
        self.search_mode = search_mode  # 'targeted' or 'discovery'
        self.target_tracks = {}
        self.found_target_tracks = set()
        self.processed_setlists = set()
        self.redis_client = None
        self.redis_prefix = os.getenv('SCRAPER_STATE_PREFIX', 'scraped:setlists:1001tracklists')
        self.source_ttl_seconds = int(os.getenv('SCRAPER_SOURCE_TTL_DAYS', '30')) * 86400
        self.run_ttl_seconds = int(os.getenv('SCRAPER_RUN_TTL_HOURS', '24')) * 3600
        self.last_run_key = None

        # Load login credentials from database first, then fall back to environment
        self.username = None
        self.password = None
        self.logged_in = False  # Track login state

        # Try loading from database
        try:
            self._load_credentials_from_db()
        except Exception as e:
            self.logger.warning(f"Failed to load credentials from database: {e}")

        # Fall back to environment variables if database load failed
        if not self.username:
            self.username = os.getenv('TRACKLISTS_1001_USERNAME')
        if not self.password:
            self.password = os.getenv('TRACKLISTS_1001_PASSWORD')

        self.use_login = bool(self.username and self.password)

        if self.use_login:
            self.logger.info(f"Login credentials found for user: {self.username}")
        else:
            self.logger.warning("No login credentials found. Scraping without authentication (may trigger CAPTCHA)")

        # Initialize memory monitor for Playwright page leak detection
        self.memory_monitor = MemoryMonitor(spider_name=self.name, logger=self.logger)

        # Load target tracks
        self.load_target_tracks()

        # Initialize Redis-backed state for cross-run dedupe
        self.initialize_state_store()
        self.apply_robots_policy()

        # Support for custom start URLs (from orchestrator)
        if start_urls:
            # Parse comma-separated URLs if provided as string
            if isinstance(start_urls, str):
                self.start_urls = [url.strip() for url in start_urls.split(',')]
            else:
                self.start_urls = start_urls
            self.logger.info(f"Using provided start_urls: {self.start_urls}")
        # Support for search query (from orchestrator)
        elif search_query:
            search_url = f"https://www.1001tracklists.com/search/result.php?main_search={quote(search_query)}"
            self.start_urls = [search_url]
            self.logger.info(f"Using search query: {search_query} -> {search_url}")
        # Generate search URLs based on target tracks
        elif self.search_mode == 'targeted':
            self.start_urls = self.generate_target_search_urls()
        else:
            self.start_urls = self.get_discovery_urls()

    def _load_credentials_from_db(self):
        """Load 1001tracklists credentials from encrypted database storage"""
        try:
            import asyncpg
            import asyncio

            # Get database connection details
            db_host = os.getenv('DB_HOST', 'db-connection-pool')
            db_port = int(os.getenv('DB_PORT', '6432'))
            db_name = os.getenv('DB_NAME', 'musicdb')
            db_user = os.getenv('DB_USER', 'musicdb_user')
            db_password = os.getenv('POSTGRES_PASSWORD', 'musicdb_secure_pass_change_me')
            encryption_secret = os.getenv('API_KEY_ENCRYPTION_SECRET', 'songnodes_change_in_production_2024')

            # Create connection and fetch credentials
            async def fetch_credentials():
                conn = await asyncpg.connect(
                    host=db_host,
                    port=db_port,
                    database=db_name,
                    user=db_user,
                    password=db_password,
                    timeout=5.0
                )
                try:
                    # Fetch username (pass encryption secret explicitly)
                    username = await conn.fetchval(
                        "SELECT get_api_key($1, $2, $3)",
                        '1001tracklists', 'username', encryption_secret
                    )
                    # Fetch password (pass encryption secret explicitly)
                    password = await conn.fetchval(
                        "SELECT get_api_key($1, $2, $3)",
                        '1001tracklists', 'password', encryption_secret
                    )
                    return username, password
                finally:
                    await conn.close()

            # Run async function in event loop
            loop = asyncio.new_event_loop()
            try:
                username, password = loop.run_until_complete(fetch_credentials())
                if username and password:
                    self.username = username
                    self.password = password
                    self.logger.info("✓ Loaded credentials from database")
            finally:
                loop.close()

        except Exception as e:
            self.logger.debug(f"Database credential load failed (will try environment): {e}")
            raise

    def load_target_tracks(self):
        """Load target tracks from JSON file"""
        try:
            target_file = os.path.join(
                os.path.dirname(os.path.dirname(__file__)),
                'target_tracks_for_scraping.json'
            )

            if os.path.exists(target_file):
                with open(target_file, 'r') as f:
                    target_data = json.load(f)

                # Load priority tracks for focused searching
                priority_tracks = target_data.get('scraper_targets', {}).get('priority_tracks', [])
                for track in priority_tracks:
                    key = self.normalize_track_key(track['title'], track['primary_artist'])
                    self.target_tracks[key] = track

                # Load all tracks for broader matching
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
        """Set up Redis connection for persistent source tracking."""
        host = os.getenv('SCRAPER_STATE_REDIS_HOST', os.getenv('REDIS_HOST', 'localhost'))
        port = int(os.getenv('SCRAPER_STATE_REDIS_PORT', os.getenv('REDIS_PORT', 6379)))
        db = int(os.getenv('SCRAPER_STATE_REDIS_DB', os.getenv('REDIS_DB', 0)))

        try:
            client = redis.Redis(host=host, port=port, db=db, decode_responses=True, socket_timeout=2)
            # Sanity check connection
            client.ping()
            self.redis_client = client
            self.logger.info(
                "Using Redis state store at %s:%s db %s for setlist dedupe",
                host,
                port,
                db
            )
            self.enforce_run_quota()
        except Exception as exc:
            self.redis_client = None
            self.logger.warning("Redis state store unavailable (%s); continuing without cross-run dedupe", exc)

    def enforce_run_quota(self):
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
        """Create normalized key for track matching"""
        normalized_title = re.sub(r'[^\w\s]', '', title.lower()).strip()
        normalized_artist = re.sub(r'[^\w\s]', '', artist.lower()).strip()
        return f"{normalized_artist}::{normalized_title}"

    def apply_robots_policy(self):
        robots_url = os.getenv('TRACKLISTS_ROBOTS_URL', 'https://www.1001tracklists.com/robots.txt')
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

    def generate_target_search_urls(self) -> list:
        """Generate search URLs for target tracks using improved strategies"""
        from .improved_search_strategies import get_1001tracklists_searches

        # Get improved search URLs
        search_items = get_1001tracklists_searches()

        # Convert to URL list with metadata
        self.search_metadata = {}
        search_urls = []

        for item in search_items:
            url = item['url']
            search_urls.append(url)
            self.search_metadata[url] = item

        # Also add artist-focused searches for our collection
        base_search_url = "https://www.1001tracklists.com/search/result/"

        # Group tracks by artist and search for artists with multiple tracks
        artist_tracks = {}
        for track_key, track_info in self.target_tracks.items():
            artist = track_info['primary_artist']
            if artist not in artist_tracks:
                artist_tracks[artist] = []
            artist_tracks[artist].append(track_info['title'])

        # Prioritize artists with multiple tracks (more likely to appear in DJ sets)
        for artist, tracks in sorted(artist_tracks.items(), key=lambda x: len(x[1]), reverse=True):
            if len(tracks) >= 2:  # Artists with 2+ tracks
                # Search by artist name (more effective for DJ tracklists)
                artist_query = quote(artist)
                url = f"{base_search_url}?searchstring={artist_query}"
                search_urls.append(url)
                self.search_metadata[url] = {'type': 'artist', 'target': artist}

        # Remove duplicates while preserving order
        seen = set()
        unique_urls = []
        for url in search_urls:
            if url not in seen:
                seen.add(url)
                unique_urls.append(url)

        total_urls = len(unique_urls)
        if total_urls == 0:
            self.logger.warning("No search URLs generated from target tracks")
            return []

        batch_size = int(os.getenv('TRACKLISTS_SEARCH_BATCH_SIZE', 50))
        rotation_seed_raw = os.getenv('TRACKLISTS_SEARCH_ROTATION')
        rotation_seed: int

        if rotation_seed_raw is not None:
            try:
                rotation_seed = int(rotation_seed_raw)
            except ValueError:
                self.logger.warning(
                    "Invalid TRACKLISTS_SEARCH_ROTATION value '%s'; defaulting to date-based rotation",
                    rotation_seed_raw
                )
                rotation_seed = datetime.utcnow().toordinal()
        else:
            rotation_seed = datetime.utcnow().toordinal()

        start_index = (rotation_seed * batch_size) % total_urls
        window = min(batch_size, total_urls)
        selected_urls = []

        for i in range(window):
            idx = (start_index + i) % total_urls
            selected_urls.append(unique_urls[idx])

        # Keep metadata only for the selected URLs
        self.search_metadata = {
            url: self.search_metadata.get(url, {})
            for url in selected_urls
        }

        self.logger.info(
            "Selected %s search URLs (offset %s of %s total) for this run",
            len(selected_urls),
            start_index,
            total_urls
        )
        return selected_urls

    def get_discovery_urls(self) -> list:
        """Get URLs for discovery mode - using direct tracklist URLs to bypass rate limiting"""
        # Import the direct URL function
        try:
            from .improved_search_strategies import get_direct_tracklist_urls
            direct_urls = get_direct_tracklist_urls()
            return [item['url'] for item in direct_urls]
        except ImportError:
            # Fallback list of direct tracklist URLs (UPDATED: September 2025)
            return [
                'https://www.1001tracklists.com/tracklist/xfux16t/dj-elax-mix-time-hash754-media-fm-105.5-2025-09-30.html',
                'https://www.1001tracklists.com/tracklist/19k8pgt1/walter-pizzulli-m2o-morning-show-2025-09-29.html',
                'https://www.1001tracklists.com/tracklist/27by7wuk/hillmer-brave-factory-festival-ukraine-2025-08-23.html',
                # These direct URLs bypass search page rate limiting
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

    async def perform_login(self, page):
        """
        Perform login using Playwright page methods
        This method is called as a coroutine via playwright_page_coroutines
        """
        try:
            self.logger.info("Starting login process...")

            # Wait for login form to load
            await page.wait_for_selector('input[name="username"], input[name="email"], input#username', timeout=10000)

            # Find and fill username field (try multiple selectors)
            username_selectors = ['input[name="username"]', 'input[name="email"]', 'input#username', 'input[type="text"]']
            for selector in username_selectors:
                try:
                    username_field = await page.query_selector(selector)
                    if username_field:
                        await username_field.fill(self.username)
                        self.logger.info(f"Username filled using selector: {selector}")
                        break
                except Exception as e:
                    continue

            # Find and fill password field
            password_selectors = ['input[name="password"]', 'input#password', 'input[type="password"]']
            for selector in password_selectors:
                try:
                    password_field = await page.query_selector(selector)
                    if password_field:
                        await password_field.fill(self.password)
                        self.logger.info(f"Password filled using selector: {selector}")
                        break
                except Exception as e:
                    continue

            # Find and click submit button
            submit_selectors = [
                'button[type="submit"]',
                'input[type="submit"]',
                'button:has-text("Login")',
                'button:has-text("Sign in")',
                'input[value="Login"]'
            ]
            for selector in submit_selectors:
                try:
                    submit_button = await page.query_selector(selector)
                    if submit_button:
                        await submit_button.click()
                        self.logger.info(f"Submit button clicked using selector: {selector}")
                        break
                except Exception as e:
                    continue

            # Wait for navigation after login (wait for profile/dashboard element)
            await page.wait_for_load_state('networkidle', timeout=15000)

            # Verify login success by checking for logged-in indicator
            # Common indicators: user profile link, logout button, username display
            logged_in = False
            login_indicators = [
                'a[href*="logout"]',
                'a[href*="profile"]',
                '.user-menu',
                '.logged-in'
            ]
            for indicator in login_indicators:
                try:
                    element = await page.query_selector(indicator)
                    if element:
                        logged_in = True
                        self.logger.info(f"Login verified with indicator: {indicator}")
                        break
                except:
                    continue

            if logged_in:
                self.logged_in = True
                self.logger.info("✓ Login successful!")
            else:
                self.logger.warning("Login submitted but verification unclear - proceeding anyway")

        except Exception as e:
            self.logger.error(f"Login failed: {e}")
            raise

    def _extract_search_query_from_url(self, url: str) -> str:
        """Extract search query from URL parameters"""
        from urllib.parse import urlparse, parse_qs, unquote

        parsed = urlparse(url)
        query_params = parse_qs(parsed.query)

        # Try different parameter names used by 1001tracklists
        for param in ['main_search', 'searchstring', 'q', 'search']:
            if param in query_params and query_params[param]:
                return unquote(query_params[param][0])

        # If no query parameter found, log warning and return empty
        self.logger.warning(f"Could not extract search query from URL: {url}")
        return ""

    def _submit_search_form(self, search_query: str):
        """Coroutine to submit search form using Playwright"""
        async def submit_form(page):
            try:
                self.logger.info(f"Submitting search form with query: {search_query}")

                # Wait for page to load
                await page.wait_for_load_state('networkidle', timeout=10000)

                # Find and fill the search input (try multiple selectors)
                search_selectors = [
                    'input[name="main_search"]',
                    'input#main_search',
                    'input[type="search"]',
                    'input.search-input',
                    'input[placeholder*="Search"]'
                ]

                search_input = None
                for selector in search_selectors:
                    try:
                        search_input = await page.wait_for_selector(selector, timeout=3000)
                        if search_input:
                            self.logger.info(f"Found search input with selector: {selector}")
                            break
                    except Exception:
                        continue

                if not search_input:
                    self.logger.error("Could not find search input field")
                    return

                # Fill in the search query
                await search_input.fill(search_query)
                await page.wait_for_timeout(500)  # Small delay for human-like behavior

                # Submit the form (try clicking submit button or pressing Enter)
                try:
                    # Try to find and click submit button
                    submit_button = await page.wait_for_selector('button[type="submit"], input[type="submit"], button.search-submit', timeout=2000)
                    await submit_button.click()
                    self.logger.info("Clicked search submit button")
                except Exception:
                    # Fallback: press Enter key
                    await search_input.press('Enter')
                    self.logger.info("Pressed Enter to submit search")

                # Wait for search results to load
                await page.wait_for_load_state('networkidle', timeout=15000)
                self.logger.info("Search results loaded successfully")

            except Exception as e:
                self.logger.error(f"Error submitting search form: {e}")
                raise

        return submit_form

    def start(self):
        """Generate initial requests with enhanced headers and login support"""
        headers = {
            'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none'
        }

        # DISABLED: 1001tracklists login requires account page navigation, not login.php
        # For now, proceed without login (may trigger CAPTCHA - solve manually)
        if False:  # self.use_login and not self.logged_in:
            self.logger.info("Login enabled - redirecting first request to login page")
            login_url = 'https://www.1001tracklists.com/login.php'

            yield Request(
                url=login_url,
                headers=headers,
                callback=self.after_login,
                errback=self.handle_error,
                dont_filter=True,  # Don't filter duplicate requests
                meta={
                    'download_timeout': 60,
                    'playwright': True,
                    'playwright_page_coroutines': [
                        self.perform_login
                    ]
                }
            )
        else:
            if self.use_login:
                self.logger.warning("Login credentials found but login flow disabled - proceeding without authentication")
            # No login required or already logged in - proceed with normal scraping
            for i, url in enumerate(self.start_urls):
                # Add progressive delay for large search lists
                delay = i * 0.5 if i < 20 else 10

                # Determine callback based on URL type
                if '/tracklist/' in url:
                    callback = self.parse_tracklist  # Direct tracklist URLs
                    from scrapy_playwright.page import PageMethod

                    yield Request(
                        url=url,
                        headers=headers,
                        callback=callback,
                        errback=self.errback_close_page,
                        meta={
                            'download_timeout': 30,
                            'download_delay': delay,
                            'playwright': True,
                            'playwright_page_methods': [
                                PageMethod('route', '**/*', self.abort_non_essential_requests),
                                PageMethod('wait_for_selector', 'div.tlLink, a[href*="/tracklist/"], div.search-results, body', timeout=10000)
                            ]
                        }
                    )
                else:
                    # Search URLs require form submission (1001tracklists changed to POST-only)
                    # Extract search query from URL
                    search_query = self._extract_search_query_from_url(url)
                    callback = self.parse_search_results

                    from scrapy_playwright.page import PageMethod

                    yield Request(
                        url='https://www.1001tracklists.com/',  # Navigate to homepage
                        headers=headers,
                        callback=callback,
                        errback=self.errback_close_page,
                        meta={
                            'download_timeout': 30,
                            'download_delay': delay,
                            'playwright': True,
                            'playwright_page_methods': [
                                PageMethod('route', '**/*', self.abort_non_essential_requests),
                            ],
                            'playwright_page_coroutines': [
                                self._submit_search_form(search_query)
                            ],
                            'search_query': search_query,  # Pass search query to callback
                            'original_url': url  # For logging purposes
                        }
                    )

    def after_login(self, response):
        """
        Callback after login is complete
        Proceeds with normal scraping flow
        """
        self.logger.info(f"After login callback - logged_in status: {self.logged_in}")

        # Now generate requests for actual scraping
        headers = {
            'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
        }

        for i, url in enumerate(self.start_urls):
            delay = i * 0.5 if i < 20 else 10

            if '/tracklist/' in url:
                callback = self.parse_tracklist
            else:
                callback = self.parse_search_results

            from scrapy_playwright.page import PageMethod

            yield Request(
                url=url,
                headers=headers,
                callback=callback,
                errback=self.errback_close_page,
                meta={
                    'download_timeout': 30,
                    'download_delay': delay,
                    'playwright': True,
                    'playwright_page_methods': [
                        PageMethod('route', '**/*', self.abort_non_essential_requests),
                        PageMethod('wait_for_selector', 'div.tlLink, a[href*="/tracklist/"], div.search-results, body', timeout=10000)
                    ]
                }
            )

    def parse_search_results(self, response):
        """Parse search results and extract tracklist links using intelligent adaptation"""
        self.logger.info(f"Parsing search results: {response.url}")

        # Track Playwright page for memory monitoring
        page = response.meta.get("playwright_page")
        if page:
            self.memory_monitor.page_opened()

        try:
            # Initialize LLM scraper engine
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
        # Initialize LLM scraper engine
        try:
            import sys
            import os
            sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            from llm_scraper_engine import ScrapyLLMExtractor

            # Use LLM-powered extraction
            llm_extractor = ScrapyLLMExtractor("1001tracklists")
            tracklist_links = llm_extractor.extract_tracklists(response)

            if tracklist_links:
                self.logger.info(f"LLM extraction found {len(tracklist_links)} tracklist links")

        except Exception as e:
            self.logger.warning(f"LLM extraction failed: {e}, falling back to traditional selectors")
            tracklist_links = []

        # Fallback to traditional selectors if LLM fails
        if not tracklist_links:
            from .improved_search_strategies import get_improved_selectors
            selectors = get_improved_selectors()['1001tracklists']['tracklist_links']

            for selector in selectors:
                links = response.css(selector).getall()
                if links:
                    tracklist_links.extend(links)
                    self.logger.debug(f"Found {len(links)} links with selector: {selector}")

        # Additional fallback - try regex extraction directly
        if not tracklist_links:
            self.logger.info("Attempting regex extraction as final fallback...")
            import re
            # Look for tracklist URLs in the HTML
            pattern = r'href=["\']([^"\']*\/tracklist\/[^"\']*)["\']'
            matches = re.findall(pattern, response.text, re.IGNORECASE)
            if matches:
                tracklist_links = matches
                self.logger.info(f"Regex extraction found {len(matches)} tracklist links")

        # Also try XPath selectors for better coverage
        xpath_links = response.xpath('//a[contains(@href, "/tracklist/")]/@href').getall()
        if xpath_links:
            tracklist_links.extend(xpath_links)
            self.logger.debug(f"Found {len(xpath_links)} links with XPath")

        # Deduplicate
        tracklist_links = list(set(tracklist_links))

        if not tracklist_links:
            self.logger.warning(f"No tracklist links found even with intelligent adaptation: {response.url}")
            # Debug: Save HTML sample for manual inspection
            with open(f'/tmp/failed_search_{int(time.time())}.html', 'w', encoding='utf-8') as f:
                f.write(response.text[:10000])
            return

        # Process up to 20 tracklists per search to manage load
        seen_links = set()
        for link in tracklist_links[:20]:
            full_url = response.urljoin(link)
            if full_url in seen_links or full_url in self.processed_setlists:
                continue

            if self.is_source_processed(full_url):
                continue

            seen_links.add(full_url)
            self.processed_setlists.add(full_url)

            yield Request(
                url=full_url,
                callback=self.parse_tracklist,
                errback=self.handle_error,
                meta={'search_query': response.meta.get('search_query')}
            )

    def parse_tracklist(self, response):
        """Parse individual tracklist page with comprehensive data extraction"""
        self.logger.info(f"Parsing tracklist: {response.url}")

        # Track Playwright page for memory monitoring
        page = response.meta.get("playwright_page")
        if page:
            self.memory_monitor.page_opened()

        try:
            self._parse_tracklist_impl(response)
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

    def _parse_tracklist_impl(self, response):
        """Implementation of parse_tracklist (separated for try/finally pattern)"""
        try:
            # Check if this is an HTML page (not JSON/structured response)
            content_type = response.headers.get('Content-Type', b'').decode('utf-8').lower()
            if 'text/html' in content_type or not self._is_json_response(response):
                self.logger.info(f"📄 Detected HTML page. Using NLP fallback for extraction. URL: {response.url}")

                if self.enable_nlp_fallback:
                    tracks_data = self.extract_via_nlp_sync(
                        html_or_text=response.text,
                        url=response.url,
                        extract_timestamps=True
                    )

                    if tracks_data:
                        self.logger.info(f"✅ NLP extraction: {len(tracks_data)} tracks found")
                        for track_data in tracks_data:
                            yield self._create_track_item_from_nlp(track_data, response.url)
                    else:
                        self.logger.warning(f"⚠️ NLP extraction returned no tracks: {response.url}")
                return

            # Extract comprehensive setlist metadata
            setlist_data = self.extract_setlist_metadata(response)
            if setlist_data:
                yield EnhancedSetlistItem(**setlist_data)

            # Extract artist information
            artists = self.extract_artist_information(response)
            for artist_data in artists:
                yield EnhancedArtistItem(**artist_data)

            # Extract tracks and relationships
            tracks_data = self.extract_tracks_with_metadata(response, setlist_data)

            # CRITICAL: Validate track extraction
            if not tracks_data or len(tracks_data) == 0:
                self.logger.warning(
                    f"⚠️ No tracks extracted from {response.url}",
                    extra={
                        'url': response.url,
                        'setlist_name': setlist_data.get('setlist_name') if setlist_data else None,
                        'parsing_version': '1001tracklists_v2.0'
                    }
                )

                # Create failure playlist item
                if setlist_data:
                    failure_item = PlaylistItem(
                        name=setlist_data.get('setlist_name', 'Unknown Setlist'),
                        source='1001tracklists',
                        source_url=response.url,
                        tracklist_count=0,
                        scrape_error=f"Track extraction failed - 0 tracks found",
                        last_scrape_attempt=datetime.utcnow(),
                        parsing_version='1001tracklists_v2.0'
                    )
                    self.logger.info(f"Yielding failure playlist item: {failure_item.get('name')}")
                    yield failure_item
                return

            # Success path - log track count
            self.logger.info(f"✅ Extracted {len(tracks_data)} tracks from {response.url}")

            # CRITICAL: Create and yield playlist item FIRST, before processing tracks
            if setlist_data and tracks_data:
                track_names = [track_info['track']['track_name'] for track_info in tracks_data if track_info.get('track', {}).get('track_name')]
                playlist_item = self.create_playlist_item_from_setlist(setlist_data, response.url, track_names)
                if playlist_item:
                    self.logger.info(f"Yielding playlist item: {playlist_item.get('name')} with {len(track_names)} tracks")
                    yield playlist_item

            for track_info in tracks_data:
                # Check if this matches a target track
                track_key = self.normalize_track_key(
                    track_info['track']['track_name'],
                    track_info['primary_artist']
                )

                if track_key in self.target_tracks:
                    self.found_target_tracks.add(track_key)
                    self.logger.info(f"✓ FOUND TARGET TRACK: {track_info['track']['track_name']} by {track_info['primary_artist']}")

                    # Enhance with target track information
                    target_info = self.target_tracks[track_key]
                    track_info['track'].update({
                        'genre': target_info.get('genre'),
                        'is_priority_track': True,
                        'target_track_metadata': json.dumps(target_info)
                    })

                # Yield track item
                yield EnhancedTrackItem(**track_info['track'])

                # Yield artist relationships
                for relationship in track_info['relationships']:
                    yield EnhancedTrackArtistItem(**relationship)

                # Yield setlist-track relationship
                if setlist_data:
                    yield EnhancedSetlistTrackItem(
                        setlist_name=setlist_data['setlist_name'],
                        track_name=track_info['track']['track_name'],
                        track_order=track_info['track_order'],
                        start_time=track_info['track'].get('start_time'),
                        data_source=self.name,
                        scrape_timestamp=datetime.utcnow()
                    )

            # Generate track adjacency relationships within THIS setlist only
            if setlist_data and len(tracks_data) > 1:
                yield from self.generate_track_adjacencies(tracks_data, setlist_data)

        except Exception as e:
            self.logger.error(f"Error parsing tracklist {response.url}: {e}")
        finally:
            self.mark_source_processed(response.url)

    def is_source_processed(self, url: str) -> bool:
        """Check Redis (if available) to see if a tracklist was already scraped."""
        if url in self.processed_setlists:
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
        """Persistently mark a tracklist as processed."""
        if not url:
            return
        self.processed_setlists.add(url)
        if not self.redis_client:
            return
        digest = hashlib.sha1(url.encode('utf-8')).hexdigest()
        key = f"{self.redis_prefix}:{digest}"
        try:
            self.redis_client.setex(key, self.source_ttl_seconds, datetime.utcnow().isoformat())
        except Exception as exc:
            self.logger.debug("Redis setex failed: %s", exc)

    def closed(self, reason):
        self.record_run_timestamp()

    def record_run_timestamp(self):
        if not self.redis_client or not self.last_run_key:
            return
        try:
            self.redis_client.setex(self.last_run_key, self.run_ttl_seconds, datetime.utcnow().isoformat())
        except Exception as exc:
            self.logger.debug("Redis setex failed for last run tracking: %s", exc)

    def extract_setlist_metadata(self, response) -> dict:
        """Extract comprehensive setlist metadata using SetlistLoader"""
        try:
            # Use SetlistLoader for data cleaning
            loader = SetlistLoader(item=EnhancedSetlistItem(), response=response)

            # Basic setlist information - use add_css for direct CSS extraction
            loader.add_css('setlist_name', 'h1.spotlightTitle::text, h1.tracklist-header-title::text, #pageTitle::text, h1::text')
            loader.add_css('setlist_name', 'h1::text')  # Fallback

            # Extract setlist name for normalized_name (loader will auto-lowercase)
            setlist_name = self.extract_text_with_selectors(response, [
                'h1.spotlightTitle::text',
                'h1.tracklist-header-title::text',
                '#pageTitle::text',
                'h1::text'
            ])
            if setlist_name:
                loader.add_value('normalized_name', setlist_name)

            # Artist information
            artist_names = response.css('div.spotlight-artists a::text, h1.tracklist-header-title a::text').getall()
            if artist_names:
                loader.add_value('dj_artist_name', artist_names[0])
                # Supporting artists (skip first, which is primary)
                if len(artist_names) > 1:
                    for artist in artist_names[1:]:
                        loader.add_value('supporting_artists', artist)

            # Event details
            loader.add_css('event_name', 'div.spotlight-event a::text, a[href*="/event/"]::text')
            loader.add_css('venue_name', 'div.spotlight-venue a::text, a[href*="/venue/"]::text')

            # Date extraction
            loader.add_css('set_date', 'div.spotlight-date::text, time::text, [datetime]::attr(datetime)')

            # Description
            loader.add_css('description', '.description::text, .event-description::text')

            # Genre tags (list)
            loader.add_css('genre_tags', '.genre-tag::text, .tag::text')

            # BPM range (keep as dict)
            bpm_info = self.extract_bpm_from_page(response)
            if bpm_info:
                loader.add_value('bpm_range', bpm_info)

            # Total tracks
            total_tracks = len(response.css('div.tlpItem, .tracklist-item, .bItm'))
            loader.add_value('total_tracks', total_tracks)

            # External URLs and metadata (keep as JSON)
            loader.add_value('external_urls', json.dumps({'1001tracklists': response.url}))
            loader.add_value('metadata', json.dumps({
                'source': '1001tracklists',
                'page_title': response.css('title::text').get(),
                'scraped_at': datetime.utcnow().isoformat()
            }))

            # System fields
            loader.add_value('data_source', self.name)
            loader.add_value('scrape_timestamp', datetime.utcnow())
            loader.add_value('created_at', datetime.utcnow())

            setlist_item = loader.load_item()
            return dict(setlist_item)  # Return as dict for compatibility

        except Exception as e:
            self.logger.error(f"Error extracting setlist metadata: {e}")
            return None

    def create_playlist_item_from_setlist(self, setlist_data, source_url, track_names=None):
        """Create a PlaylistItem from setlist metadata using PlaylistLoader"""
        try:
            # Use PlaylistLoader for data cleaning
            loader = PlaylistLoader(item=PlaylistItem())

            # Basic playlist info
            loader.add_value('item_type', 'playlist')
            loader.add_value('name', setlist_data.get('setlist_name'))
            loader.add_value('source', '1001tracklists')
            loader.add_value('source_url', source_url)

            # DJ/Artist info
            dj_name = setlist_data.get('dj_artist_name')
            if dj_name:
                loader.add_value('dj_name', dj_name)
                loader.add_value('artist_name', dj_name)
                loader.add_value('curator', dj_name)

            # Event info
            if setlist_data.get('event_name'):
                loader.add_value('event_name', setlist_data.get('event_name'))
            if setlist_data.get('set_date'):
                loader.add_value('event_date', setlist_data.get('set_date'))
            if setlist_data.get('venue_name'):
                loader.add_value('venue_name', setlist_data.get('venue_name'))

            # Tracks (list)
            if track_names:
                for track_name in track_names:
                    loader.add_value('tracks', track_name)
                loader.add_value('total_tracks', len(track_names))
            else:
                loader.add_value('total_tracks', setlist_data.get('total_tracks', 0))

            # Description
            if setlist_data.get('description'):
                loader.add_value('description', setlist_data.get('description'))

            # Genre tags (list)
            if setlist_data.get('genre_tags'):
                for tag in setlist_data.get('genre_tags'):
                    loader.add_value('genre_tags', tag)

            # Duration and BPM range
            loader.add_value('duration_minutes', None)  # Could be calculated
            if setlist_data.get('bpm_range'):
                loader.add_value('bpm_range', setlist_data.get('bpm_range'))

            # System fields
            loader.add_value('data_source', self.name)
            loader.add_value('scrape_timestamp', datetime.utcnow())
            loader.add_value('created_at', datetime.utcnow())

            playlist_item = loader.load_item()
            self.logger.debug(f"Created playlist item: {setlist_data.get('setlist_name')}")
            return playlist_item

        except Exception as e:
            self.logger.error(f"Error creating playlist item: {e}")
            return None

    def extract_artist_information(self, response) -> list:
        """Extract comprehensive artist information using ArtistLoader"""
        artists = []
        artist_links = response.css('div.spotlight-artists a, h1.tracklist-header-title a')

        for link in artist_links:
            artist_name = link.css('::text').get()
            artist_url = link.css('::attr(href)').get()

            if artist_name:
                # Use ArtistLoader for data cleaning
                loader = ArtistLoader(item=EnhancedArtistItem(), response=response)
                loader.add_value('artist_name', artist_name)
                loader.add_value('normalized_name', artist_name)
                loader.add_value('external_urls', json.dumps({
                    '1001tracklists': response.urljoin(artist_url) if artist_url else None
                }))
                loader.add_value('metadata', json.dumps({
                    'discovered_in_setlist': response.url,
                    'scraped_at': datetime.utcnow().isoformat()
                }))
                loader.add_value('data_source', self.name)
                loader.add_value('scrape_timestamp', datetime.utcnow())
                loader.add_value('created_at', datetime.utcnow())

                artist_item = loader.load_item()
                artists.append(artist_item)

        return artists

    def extract_tracks_with_metadata(self, response, setlist_data) -> list:
        """Extract tracks with comprehensive metadata and relationships using LLM"""
        tracks_data = []

        # Try LLM extraction first
        try:
            import sys
            import os
            sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            from llm_scraper_engine import ScrapyLLMExtractor

            llm_extractor = ScrapyLLMExtractor("1001tracklists")
            llm_tracks = llm_extractor.extract_tracks(response)

            if llm_tracks:
                self.logger.info(f"LLM extraction found {len(llm_tracks)} tracks")

                # Convert LLM results to our format
                for i, track in enumerate(llm_tracks):
                    track_info = {
                        'track': {
                            'track_name': track.get('name', ''),
                            'track_id': None,
                            'duration': None,
                            'start_time': None,
                            'track_type': 'DJ Mix',
                            'is_remix': self.is_remix_track(track.get('name', '')),
                            'is_mashup': self.is_mashup_track(track.get('name', '')),
                            'data_source': self.name,
                            'scrape_timestamp': datetime.utcnow()
                        },
                        'primary_artist': track.get('artist', ''),
                        'track_order': track.get('position', i + 1),
                        'relationships': []
                    }

                    # Add artist relationship
                    if track.get('artist'):
                        track_info['relationships'].append({
                            'track_name': track.get('name', ''),
                            'artist_name': track.get('artist', ''),
                            'artist_role': 'primary',
                            'data_source': self.name,
                            'scrape_timestamp': datetime.utcnow()
                        })

                    tracks_data.append(track_info)

                return tracks_data

        except Exception as e:
            self.logger.warning(f"LLM track extraction failed: {e}, falling back to traditional parsing")

        # Fallback to traditional extraction
        track_elements = self.extract_track_elements(response)

        for i, track_el in enumerate(track_elements):
            try:
                track_info = self.parse_track_element_enhanced(track_el, i + 1)
                if track_info:
                    tracks_data.append(track_info)
            except Exception as e:
                self.logger.error(f"Error parsing track {i+1}: {e}")
                continue

        return tracks_data

    def extract_track_elements(self, response):
        """Extract track elements using multiple selectors"""
        selectors = [
            'div.tlpItem',
            'li.tracklist-item',
            '.bItm',
            'div.bItm',
            '.mediaRow',
            '[data-track]',
            'div.list-track'  # MixesDB-style track divs
        ]

        for selector in selectors:
            elements = response.css(selector)
            if elements:
                return elements

        return []

    def parse_track_element_enhanced(self, track_el, track_order) -> dict:
        """Parse track element with enhanced metadata extraction using TrackLoader"""
        # Extract basic track string
        track_string = self.extract_track_string(track_el)
        if not track_string:
            return None

        # Parse track string for artist and title
        parsed_track = parse_track_string(track_string)
        if not parsed_track.get('track_name'):
            return None

        # Extract timing information
        start_time = self.extract_start_time(track_el, track_string)

        # Extract BPM if available
        bpm = self.extract_bpm_from_element(track_el)

        # Extract genre information
        genre = self.extract_genre_from_element(track_el)

        # Extract additional metadata
        metadata = {
            'original_string': track_string,
            'track_order': track_order,
            'extraction_confidence': self.calculate_extraction_confidence(parsed_track),
            'source_element_html': str(track_el.get())[:500]  # First 500 chars for debugging
        }

        # Extract primary artist BEFORE using it
        primary_artist = parsed_track.get('primary_artists', [None])[0]

        # Generate deterministic track_id for cross-source deduplication
        track_id = generate_track_id_from_parsed(parsed_track)

        # Use TrackLoader for data cleaning
        loader = TrackLoader(item=EnhancedTrackItem())

        # Build enhanced track item using loader
        loader.add_value('track_id', track_id)  # Deterministic ID
        loader.add_value('track_name', parsed_track['track_name'])
        loader.add_value('normalized_title', parsed_track['track_name'])
        loader.add_value('is_remix', parsed_track.get('is_remix', False))
        loader.add_value('is_mashup', parsed_track.get('is_mashup', False))

        # Mashup components (list)
        if parsed_track.get('mashup_components'):
            for component in parsed_track.get('mashup_components'):
                loader.add_value('mashup_components', component)

        # NOTE: Remix parsing is now handled by enrichment_pipeline._parse_remix_info()
        # which uses the sophisticated TrackTitleParser (2025 Best Practice)

        # Audio features
        if bpm:
            loader.add_value('bpm', bpm)
        if genre:
            loader.add_value('genre', genre)
        if start_time:
            loader.add_value('start_time', start_time)

        # Track context
        loader.add_value('track_type', 'Setlist')
        loader.add_value('source_context', track_string)
        loader.add_value('position_in_source', track_order)

        # Metadata and URLs
        loader.add_value('metadata', json.dumps(metadata))
        loader.add_value('external_urls', json.dumps({'1001tracklists_context': track_string}))

        # System fields
        loader.add_value('data_source', self.name)
        loader.add_value('scrape_timestamp', datetime.utcnow())
        loader.add_value('created_at', datetime.utcnow())

        track_item = loader.load_item()
        self.logger.debug(f"Generated track_id {track_id} for: {primary_artist} - {parsed_track['track_name']}")

        # Build artist relationships (not using loader for relationship items)
        relationships = []

        # Primary artists
        for artist in parsed_track.get('primary_artists', []):
            relationships.append({
                'track_name': parsed_track['track_name'],
                'artist_name': artist,
                'artist_role': 'primary',
                'position': 0,
                'data_source': self.name,
                'scrape_timestamp': datetime.utcnow(),
                'created_at': datetime.utcnow()
            })

        # Featured artists
        for i, artist in enumerate(parsed_track.get('featured_artists', [])):
            relationships.append({
                'track_name': parsed_track['track_name'],
                'artist_name': artist,
                'artist_role': 'featured',
                'position': i + 1,
                'data_source': self.name,
                'scrape_timestamp': datetime.utcnow(),
                'created_at': datetime.utcnow()
            })

        # Remixer artists
        for i, artist in enumerate(parsed_track.get('remixer_artists', [])):
            relationships.append({
                'track_name': parsed_track['track_name'],
                'artist_name': artist,
                'artist_role': 'remixer',
                'position': i + 1,
                'contribution_type': 'remix',
                'data_source': self.name,
                'scrape_timestamp': datetime.utcnow(),
                'created_at': datetime.utcnow()
            })

        return {
            'track': dict(track_item),  # Convert to dict for compatibility
            'relationships': relationships,
            'track_order': track_order,
            'primary_artist': primary_artist
        }

    def extract_track_string(self, track_el):
        """Extract track string using multiple selectors"""
        selectors = [
            'span.trackValue::text',
            'div.track-name::text',
            '.bTitle::text',
            '.bCont .bTitle::text',
            'a::text'
        ]

        for selector in selectors:
            track_string = track_el.css(selector).get()
            if track_string and track_string.strip():
                return track_string.strip()

        # Fallback to all text
        all_text = ' '.join(track_el.css('::text').getall())
        return all_text.strip() if all_text.strip() else None

    def extract_start_time(self, track_el, track_string):
        """Extract start time from element or track string"""
        selectors = [
            'span.tracklist-time::text',
            '.bRank::text',
            '[data-time]::attr(data-time)',
            '.time::text'
        ]

        for selector in selectors:
            start_time = track_el.css(selector).get()
            if start_time:
                return start_time.strip()

        # Look for time in track string
        time_match = re.search(r'\[(\d{1,2}:\d{2}(?::\d{2})?)\]', track_string)
        return time_match.group(1) if time_match else None

    def extract_bpm_from_element(self, track_el):
        """Extract BPM information from track element"""
        bpm_text = track_el.css('.bpm::text, [data-bpm]::attr(data-bpm)').get()
        if bpm_text:
            bpm_match = re.search(r'(\d{2,3})', bpm_text)
            if bpm_match:
                try:
                    return float(bpm_match.group(1))
                except ValueError:
                    pass
        return None

    def extract_bpm_from_page(self, response):
        """Extract BPM range information from entire page"""
        bpm_values = []
        bpm_elements = response.css('.bpm::text, [data-bpm]::attr(data-bpm)').getall()

        for bpm_text in bpm_elements:
            bpm_match = re.search(r'(\d{2,3})', bpm_text)
            if bpm_match:
                try:
                    bpm_values.append(float(bpm_match.group(1)))
                except ValueError:
                    continue

        if bpm_values:
            return {
                'min_bpm': min(bpm_values),
                'max_bpm': max(bpm_values),
                'avg_bpm': sum(bpm_values) / len(bpm_values)
            }
        return None

    def extract_genre_from_element(self, track_el):
        """Extract genre information from track element"""
        genre_text = track_el.css('.genre::text, [data-genre]::attr(data-genre)').get()
        if genre_text:
            return genre_text.strip()
        return None

    def calculate_extraction_confidence(self, parsed_track):
        """Calculate confidence score for track extraction"""
        confidence = 0.5  # Base confidence

        if parsed_track.get('track_name'):
            confidence += 0.3

        if parsed_track.get('primary_artists'):
            confidence += 0.2

        if len(parsed_track.get('primary_artists', [])) > 0:
            confidence += 0.1

        return min(confidence, 1.0)

    def generate_track_adjacencies(self, tracks_data, setlist_data):
        """
        Generate track adjacency relationships within a single setlist.
        Creates adjacency items for tracks within 3 positions of each other.
        """
        if not tracks_data or len(tracks_data) < 2:
            return

        setlist_name = setlist_data.get('setlist_name', 'Unknown Setlist')
        setlist_id = setlist_data.get('setlist_id', f"setlist_{hash(setlist_name)}")

        # Sort tracks by their order to ensure proper adjacency
        sorted_tracks = sorted(tracks_data, key=lambda x: x.get('track_order', 0))

        adjacency_count = 0
        for i in range(len(sorted_tracks)):
            for j in range(i + 1, min(i + 4, len(sorted_tracks))):  # Within 3 positions
                track_1 = sorted_tracks[i]
                track_2 = sorted_tracks[j]

                # Calculate distance between tracks
                distance = abs(track_1.get('track_order', 0) - track_2.get('track_order', 0))

                # Determine transition type based on distance
                if distance == 1:
                    transition_type = "sequential"
                elif distance <= 3:
                    transition_type = "close_proximity"
                else:
                    continue  # Skip if too far apart

                # Create adjacency item
                adjacency_item = EnhancedTrackAdjacencyItem(
                    track_1_name=track_1['track']['track_name'],
                    track_1_id=track_1['track'].get('track_id'),
                    track_2_name=track_2['track']['track_name'],
                    track_2_id=track_2['track'].get('track_id'),
                    track_1_position=track_1.get('track_order'),
                    track_2_position=track_2.get('track_order'),
                    distance=distance,
                    setlist_name=setlist_name,
                    setlist_id=setlist_id,
                    source_context=f"1001tracklists:{setlist_name}",
                    transition_type=transition_type,
                    occurrence_count=1,
                    created_at=datetime.utcnow(),
                    data_source=self.name,
                    scrape_timestamp=datetime.utcnow()
                )

                yield adjacency_item
                adjacency_count += 1

        if adjacency_count > 0:
            self.logger.info(f"Generated {adjacency_count} track adjacency relationships for setlist: {setlist_name}")

    def extract_text_with_selectors(self, response, selectors):
        """Extract text using multiple fallback selectors"""
        for selector in selectors:
            text = response.css(selector).get()
            if text and text.strip():
                return text.strip()
        return None

    def parse_date(self, date_string):
        """Parse date string to date object"""
        if not date_string:
            return None

        # Try different date formats
        date_formats = [
            '%Y-%m-%d',
            '%m/%d/%Y',
            '%d.%m.%Y',
            '%B %d, %Y'
        ]

        for fmt in date_formats:
            try:
                return datetime.strptime(date_string[:10], fmt).date()
            except ValueError:
                continue

        return None

    def _create_track_item_from_nlp(self, nlp_track: Dict, source_url: str):
        """
        Convert NLP-extracted track data to Scrapy TrackItem using TrackLoader

        Args:
            nlp_track: Dict with 'artist', 'title', 'timestamp' keys from NLP processor
            source_url: URL where track was extracted from

        Returns:
            TrackItem ready for pipeline processing
        """
        try:
            artist_name = nlp_track.get('artist', 'Unknown Artist')
            title = nlp_track.get('title', 'Unknown Track')

            # Generate deterministic track_id
            track_id = generate_track_id(
                title=title,
                primary_artist=artist_name,
                is_remix=False,
                is_mashup=False,
                remix_type=None
            )

            # Use TrackLoader for data cleaning
            loader = TrackLoader(item=EnhancedTrackItem())
            loader.add_value('track_id', track_id)
            loader.add_value('track_name', f"{artist_name} - {title}")  # Combined format
            loader.add_value('track_url', source_url)
            loader.add_value('source_platform', '1001tracklists_html_nlp')
            loader.add_value('data_source', self.name)
            loader.add_value('scrape_timestamp', datetime.utcnow())

            track_item = loader.load_item()

            self.logger.debug(
                f"Created track item from NLP: {artist_name} - {title}"
            )

            return track_item

        except Exception as e:
            self.logger.error(f"Error creating track item from NLP data: {e}", exc_info=True)
            return None

    def handle_error(self, failure):
        """Enhanced error handling with retry logic"""
        from twisted.python.failure import Failure

        # Check if it's a response error (e.g., 404)
        if hasattr(failure, 'value') and hasattr(failure.value, 'response'):
            response = failure.value.response
            if response is not None:
                status = response.status
                self.logger.error(f"Request failed with status {status}: {failure.request.url}")

                # Don't retry 404s - the URL is invalid
                if status == 404:
                    self.logger.warning(f"Skipping 404 URL: {failure.request.url}")
                    return
        else:
            self.logger.error(f"Request failed: {failure.request.url} - {failure.value if hasattr(failure, 'value') else failure}")

        # Don't retry search pages, focus on tracklists
        if '/search/' in failure.request.url:
            return

        # Retry tracklist pages
        retry_count = failure.request.meta.get('retry_count', 0)
        if retry_count < 2:
            delay = (retry_count + 1) * 5 + random.uniform(0, 3)
            self.logger.info(f"Retrying {failure.request.url} in {delay:.1f} seconds")

            yield Request(
                url=failure.request.url,
                callback=self.parse_tracklist,
                errback=self.handle_error,
                dont_filter=True,
                meta={
                    **failure.request.meta,
                    'retry_count': retry_count + 1,
                    'download_delay': delay
                }
            )

    def closed(self, reason):
        """Log comprehensive spider statistics"""
        self.logger.info(f"\n{'='*60}")
        self.logger.info(f"ENHANCED 1001TRACKLISTS SPIDER COMPLETED")
        self.logger.info(f"{'='*60}")
        self.logger.info(f"Spider closed: {reason}")
        self.logger.info(f"Search mode: {self.search_mode}")
        self.logger.info(f"Target tracks loaded: {len(self.target_tracks)}")
        self.logger.info(f"Target tracks found: {len(self.found_target_tracks)}")
        self.logger.info(f"Setlists processed: {len(self.processed_setlists)}")

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
        self.record_run_timestamp()
