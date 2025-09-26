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
        TargetTrackSearchItem
    )
    from .utils import parse_track_string
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
        TargetTrackSearchItem
    )
    from spiders.utils import parse_track_string


class OneThousandOneTracklistsSpider(scrapy.Spider):
    name = '1001tracklists'
    allowed_domains = ['1001tracklists.com']

    # Rate limiting settings for respectful scraping
    download_delay = 2.0
    randomize_download_delay = 0.5

    custom_settings = {
        # Anti-detection settings
        'USER_AGENT': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'ROBOTSTXT_OBEY': False,
        'COOKIES_ENABLED': True,
        # Conservative request settings to avoid rate limiting
        'DOWNLOAD_DELAY': 15.0,
        'RANDOMIZE_DOWNLOAD_DELAY': 0.8,
        'CONCURRENT_REQUESTS': 1,
        'CONCURRENT_REQUESTS_PER_DOMAIN': 1,
        # AutoThrottle for dynamic delay adjustment
        'AUTOTHROTTLE_ENABLED': True,
        'AUTOTHROTTLE_START_DELAY': 20,
        'AUTOTHROTTLE_MAX_DELAY': 120,
        'AUTOTHROTTLE_TARGET_CONCURRENCY': 0.3,
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
            'database_pipeline.EnhancedMusicDatabasePipeline': 300,
        }
    }

    def __init__(self, search_mode='targeted', *args, **kwargs):
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

        # Load target tracks
        self.load_target_tracks()

        # Initialize Redis-backed state for cross-run dedupe
        self.initialize_state_store()
        self.apply_robots_policy()

        # Generate search URLs based on target tracks
        if self.search_mode == 'targeted':
            self.start_urls = self.generate_target_search_urls()
        else:
            self.start_urls = self.get_discovery_urls()

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
            # Fallback list of direct tracklist URLs
            return [
                'https://www.1001tracklists.com/tracklist/2dgqc1y1/tale-of-us-afterlife-presents-tale-of-us-iii-live-from-printworks-london-2024-12-28.html',
                'https://www.1001tracklists.com/tracklist/2d4kx5y1/anyma-artbat-tale-of-us-afterlife-presents-tale-of-us-iii-live-from-printworks-london-2024-12-28.html',
                'https://www.1001tracklists.com/tracklist/2dgqc1y2/fred-again-boiler-room-london-2024-12-20.html',
                # These direct URLs bypass search page rate limiting
            ]

    def start_requests(self):
        """Generate initial requests with enhanced headers"""
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

        for i, url in enumerate(self.start_urls):
            # Add progressive delay for large search lists
            delay = i * 0.5 if i < 20 else 10

            # Determine callback based on URL type
            if '/tracklist/' in url:
                callback = self.parse_tracklist  # Direct tracklist URLs
            else:
                callback = self.parse_search_results  # Search result pages

            yield Request(
                url=url,
                headers=headers,
                callback=callback,
                errback=self.handle_error,
                meta={
                    'download_timeout': 30,
                    'download_delay': delay,
                    'playwright': True,  # Enable Playwright for JavaScript rendering
                    'playwright_page_methods': [
                        {'wait_for_selector': 'div.tlLink, a[href*="/tracklist/"], div.search-results', 'timeout': 10000}
                    ]
                }
            )

    def parse_search_results(self, response):
        """Parse search results and extract tracklist links using intelligent adaptation"""
        self.logger.info(f"Parsing search results: {response.url}")

        # Try traditional selectors first
        from .improved_search_strategies import get_improved_selectors
        selectors = get_improved_selectors()['1001tracklists']['tracklist_links']
        tracklist_links = []

        for selector in selectors:
            links = response.css(selector).getall()
            if links:
                tracklist_links.extend(links)
                self.logger.debug(f"Found {len(links)} links with selector: {selector}")

        # If no links found with traditional selectors, use NLP-powered analysis
        if not tracklist_links:
            self.logger.info("Traditional selectors failed, using Ollama HTML analyzer...")
            try:
                from ..ollama_html_analyzer import get_adaptive_selectors
                adapted_selectors = get_adaptive_selectors('1001tracklists', response.text)

                self.logger.info(f"Ollama analyzer suggested {len(adapted_selectors)} selectors")

                # Try the adapted selectors
                for selector_name, selector in adapted_selectors.items():
                    if 'link' in selector_name.lower() or 'tracklist' in selector_name.lower():
                        links = response.css(selector + ' ::attr(href)').getall()
                        if links:
                            # Filter for actual tracklist URLs
                            tracklist_links.extend([
                                link for link in links
                                if '/tracklist/' in link.lower() or '/setlist/' in link.lower()
                            ])
                            self.logger.info(f"Found {len([link for link in links if '/tracklist/' in link.lower()])} tracklist links with adapted selector: {selector}")

            except Exception as e:
                self.logger.error(f"Ollama HTML analyzer failed: {e}")

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

        try:
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
        """Extract comprehensive setlist metadata"""
        try:
            # Basic setlist information
            setlist_name = self.extract_text_with_selectors(response, [
                'h1.spotlightTitle::text',
                'h1.tracklist-header-title::text',
                '#pageTitle::text',
                'h1::text'
            ])

            # Artist information
            artist_names = response.css('div.spotlight-artists a::text, h1.tracklist-header-title a::text').getall()
            primary_artist = artist_names[0].strip() if artist_names else None

            # Event details
            event_name = self.extract_text_with_selectors(response, [
                'div.spotlight-event a::text',
                'a[href*="/event/"]::text'
            ])

            venue_name = self.extract_text_with_selectors(response, [
                'div.spotlight-venue a::text',
                'a[href*="/venue/"]::text'
            ])

            # Date extraction
            set_date = self.extract_text_with_selectors(response, [
                'div.spotlight-date::text',
                'time::text',
                '[datetime]::attr(datetime)'
            ])

            # Enhanced metadata extraction
            genre_tags = response.css('.genre-tag::text, .tag::text').getall()
            bpm_info = self.extract_bpm_from_page(response)

            # Additional context
            description = response.css('.description::text, .event-description::text').get()
            total_tracks = len(response.css('div.tlpItem, .tracklist-item, .bItm'))

            return {
                'setlist_name': setlist_name,
                'normalized_name': setlist_name.lower().strip() if setlist_name else None,
                'dj_artist_name': primary_artist,
                'supporting_artists': [name.strip() for name in artist_names[1:]] if len(artist_names) > 1 else None,
                'event_name': event_name,
                'venue_name': venue_name,
                'set_date': self.parse_date(set_date),
                'description': description,
                'genre_tags': genre_tags if genre_tags else None,
                'bpm_range': bpm_info,
                'total_tracks': total_tracks,
                'external_urls': json.dumps({'1001tracklists': response.url}),
                'metadata': json.dumps({
                    'source': '1001tracklists',
                    'page_title': response.css('title::text').get(),
                    'scraped_at': datetime.utcnow().isoformat()
                }),
                'data_source': self.name,
                'scrape_timestamp': datetime.utcnow(),
                'created_at': datetime.utcnow()
            }

        except Exception as e:
            self.logger.error(f"Error extracting setlist metadata: {e}")
            return None

    def extract_artist_information(self, response) -> list:
        """Extract comprehensive artist information"""
        artists = []
        artist_links = response.css('div.spotlight-artists a, h1.tracklist-header-title a')

        for link in artist_links:
            artist_name = link.css('::text').get()
            artist_url = link.css('::attr(href)').get()

            if artist_name:
                artist_data = {
                    'artist_name': artist_name.strip(),
                    'normalized_name': artist_name.lower().strip(),
                    'external_urls': json.dumps({
                        '1001tracklists': response.urljoin(artist_url) if artist_url else None
                    }),
                    'metadata': json.dumps({
                        'discovered_in_setlist': response.url,
                        'scraped_at': datetime.utcnow().isoformat()
                    }),
                    'data_source': self.name,
                    'scrape_timestamp': datetime.utcnow(),
                    'created_at': datetime.utcnow()
                }
                artists.append(artist_data)

        return artists

    def extract_tracks_with_metadata(self, response, setlist_data) -> list:
        """Extract tracks with comprehensive metadata and relationships"""
        tracks_data = []

        # Get track elements using multiple selectors
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
            '[data-track]'
        ]

        for selector in selectors:
            elements = response.css(selector)
            if elements:
                return elements

        return []

    def parse_track_element_enhanced(self, track_el, track_order) -> dict:
        """Parse track element with enhanced metadata extraction"""
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

        # Build enhanced track item
        track_item = {
            'track_name': parsed_track['track_name'],
            'normalized_title': parsed_track['track_name'].lower().strip(),
            'is_remix': parsed_track.get('is_remix', False),
            'is_mashup': parsed_track.get('is_mashup', False),
            'mashup_components': parsed_track.get('mashup_components'),
            'remix_type': self.extract_remix_type(parsed_track['track_name']),
            'bpm': bpm,
            'genre': genre,
            'start_time': start_time,
            'track_type': 'Setlist',
            'source_context': track_string,
            'position_in_source': track_order,
            'metadata': json.dumps(metadata),
            'external_urls': json.dumps({'1001tracklists_context': track_string}),
            'data_source': self.name,
            'scrape_timestamp': datetime.utcnow(),
            'created_at': datetime.utcnow()
        }

        # Build artist relationships
        relationships = []
        primary_artist = parsed_track.get('primary_artists', [None])[0]

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
            'track': track_item,
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

    def extract_remix_type(self, track_name):
        """Extract remix type from track name"""
        remix_patterns = {
            r'\(Original Mix\)': 'Original Mix',
            r'\(Radio Edit\)': 'Radio Edit',
            r'\(Extended Mix\)': 'Extended Mix',
            r'\(Club Mix\)': 'Club Mix',
            r'\(VIP Mix\)': 'VIP Mix',
            r'\(Remix\)': 'Remix',
            r'\(Edit\)': 'Edit'
        }

        for pattern, remix_type in remix_patterns.items():
            if re.search(pattern, track_name, re.IGNORECASE):
                return remix_type
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

    def handle_error(self, failure):
        """Enhanced error handling with retry logic"""
        self.logger.error(f"Request failed: {failure.request.url} - {failure.value}")

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
