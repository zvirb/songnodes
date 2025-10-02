"""
Enhanced MixesDB Spider for Comprehensive Music Data Collection
Focuses on underground electronic music with complete metadata extraction
"""
import scrapy
import re
import json
import logging
import os
import hashlib
from typing import Dict
from datetime import datetime
from urllib.parse import quote
import redis
import requests
from urllib import robotparser
from scrapy.exceptions import CloseSpider

try:
    from ..items import (
        EnhancedArtistItem,
        EnhancedTrackItem,
        EnhancedSetlistItem,
        EnhancedTrackArtistItem,
        EnhancedSetlistTrackItem,
        EnhancedTrackAdjacencyItem,
        PlaylistItem
    )
    from .utils import parse_track_string
    from ..nlp_spider_mixin import NLPFallbackSpiderMixin
    from ..track_id_generator import generate_track_id, generate_track_id_from_parsed, extract_remix_type
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
        PlaylistItem
    )
    from spiders.utils import parse_track_string
    from nlp_spider_mixin import NLPFallbackSpiderMixin
    from track_id_generator import generate_track_id, generate_track_id_from_parsed, extract_remix_type


class MixesdbSpider(NLPFallbackSpiderMixin, scrapy.Spider):
    name = 'mixesdb'
    allowed_domains = ['mixesdb.com']

    download_delay = 15.0
    randomize_download_delay = 0.3

    custom_settings = {
        'DOWNLOAD_DELAY': 15.0,  # 15 seconds between requests - balanced for performance and politeness
        'RANDOMIZE_DOWNLOAD_DELAY': 0.3,  # Range: 10.5-19.5 seconds
        'CONCURRENT_REQUESTS': 1,
        'CONCURRENT_REQUESTS_PER_DOMAIN': 1,
        'AUTOTHROTTLE_ENABLED': True,
        'AUTOTHROTTLE_START_DELAY': 15,  # Match DOWNLOAD_DELAY
        'AUTOTHROTTLE_MAX_DELAY': 60,  # Up to 1 minute if needed
        'AUTOTHROTTLE_TARGET_CONCURRENCY': 0.2,
        'RETRY_TIMES': 3,
        'DOWNLOAD_TIMEOUT': 30,  # 30 second timeout per request
        'ITEM_PIPELINES': {
            'database_pipeline.DatabasePipeline': 300,
        }
    }

    def __init__(self, search_artists=None, start_urls=None, search_query=None, *args, **kwargs):
        force_run_arg = kwargs.pop('force_run', None)
        super().__init__(*args, **kwargs)
        # Use Scrapy's built-in logger instead of reassigning
        # self.logger is already provided by Scrapy Spider base class

        # Target artists for contemporary electronic music (2023-2025)
        self.target_artists = search_artists or self.load_target_artists()
        self.redis_client = None
        self.redis_prefix = os.getenv('SCRAPER_STATE_PREFIX_MIXESDB', 'scraped:setlists:mixesdb')
        self.source_ttl_seconds = int(os.getenv('SCRAPER_SOURCE_TTL_DAYS', '30')) * 86400
        self.processed_mix_urls = set()
        self.run_ttl_seconds = int(os.getenv('SCRAPER_RUN_TTL_HOURS', '24')) * 3600
        self.last_run_key = None
        self.force_run = (
            force_run_arg
            if force_run_arg is not None
            else os.getenv('SCRAPER_FORCE_RUN', '0').lower() in ('1', 'true', 'yes')
        )

        self.initialize_state_store()
        self.apply_robots_policy()

        # Support for custom start URLs (from orchestrator)
        if start_urls:
            # Parse comma-separated URLs if provided as string
            # BUT: Only split on comma if we detect multiple URLs (contains "http" after a comma)
            if isinstance(start_urls, str):
                # Check if it's truly multiple URLs or just one URL with commas in it
                if ', http' in start_urls or ',http' in start_urls:
                    # Multiple URLs separated by commas
                    self.start_urls = [url.strip() for url in start_urls.split(',')]
                else:
                    # Single URL that may contain commas (e.g., city names)
                    self.start_urls = [start_urls.strip()]
            else:
                self.start_urls = start_urls
            self.logger.info(f"Using provided start_urls: {self.start_urls}")
        # Support for search query (from orchestrator)
        elif search_query:
            from urllib.parse import quote
            # Fixed URL format: MixesDB uses MediaWiki Special:Search syntax
            search_url = f"https://www.mixesdb.com/w/index.php?title=Special:Search&search={quote(search_query)}"
            self.start_urls = [search_url]
            self.logger.info(f"Using search query: {search_query} -> {search_url}")
        else:
            self.start_urls = self.generate_search_urls()

    def load_target_artists(self):
        """Load prioritized artists from the shared target track list."""
        target_file = os.path.join(
            os.path.dirname(os.path.dirname(__file__)),
            'target_tracks_for_scraping.json'
        )

        artist_set = set()

        try:
            if os.path.exists(target_file):
                with open(target_file, 'r') as f:
                    target_data = json.load(f)

                for section in ('priority_tracks', 'all_tracks'):
                    for track in target_data.get('scraper_targets', {}).get(section, []):
                        primary = track.get('primary_artist')
                        if primary:
                            artist_set.add(primary)
                        for artist in track.get('artists', []) or []:
                            artist_set.add(artist)

            if not artist_set:
                raise ValueError("No artists loaded from target list")

            return sorted(artist_set)

        except Exception as exc:
            self.logger.warning(
                "Falling back to default MixesDB artist list: %s",
                exc
            )
            return [
                'FISHER', 'Chris Lake', 'Dom Dolla', 'John Summit', 'James Hype',
                'Patrick Topping', 'Michael Bibi', 'Cloonee', 'Wade',
                'Anyma', 'Artbat', 'Tale of Us', 'Adriatique', 'Kevin de Vries',
                'Massano', 'Mathame', 'Innellea', 'Stephan Bodzin',
                'Fred again..', 'Four Tet', 'Bicep', 'Overmono', 'Ross From Friends',
                'Alok', 'Vintage Culture', 'Meduza', 'Tiësto', 'David Guetta',
                'Swedish House Mafia', 'Calvin Harris', 'Martin Garrix', 'Skrillex'
            ]

    def initialize_state_store(self):
        host = os.getenv('SCRAPER_STATE_REDIS_HOST', os.getenv('REDIS_HOST', 'localhost'))
        port = int(os.getenv('SCRAPER_STATE_REDIS_PORT', os.getenv('REDIS_PORT', 6379)))
        db = int(os.getenv('SCRAPER_STATE_REDIS_DB', os.getenv('REDIS_DB', 0)))

        try:
            client = redis.Redis(host=host, port=port, db=db, decode_responses=True, socket_timeout=2)
            client.ping()
            self.redis_client = client
            self.logger.info(
                "Using Redis state store at %s:%s db %s for MixesDB dedupe",
                host,
                port,
                db
            )
            self.enforce_run_quota()
        except Exception as exc:
            self.redis_client = None
            self.logger.warning("Redis state store unavailable for MixesDB (%s)", exc)

    def enforce_run_quota(self):
        if not self.redis_client:
            return
        self.last_run_key = f"{self.redis_prefix}:last_run"
        if self.force_run:
            return
        last_run = self.redis_client.get(self.last_run_key)
        if last_run:
            self.logger.warning("Daily quota already used for MixesDB (last run at %s)", last_run)
            raise CloseSpider('daily_quota_reached')

    def apply_robots_policy(self):
        robots_url = os.getenv('MIXESDB_ROBOTS_URL', 'https://www.mixesdb.com/robots.txt')
        user_agent = self.custom_settings.get('USER_AGENT', 'Mozilla/5.0')
        parser = robotparser.RobotFileParser()

        try:
            response = requests.get(robots_url, timeout=5)
            if response.status_code != 200:
                self.logger.debug("MixesDB robots.txt returned status %s", response.status_code)
                return
            parser.parse(response.text.splitlines())
            delay = parser.crawl_delay(user_agent) or parser.crawl_delay('*')
            if delay:
                delay = float(delay)
                current_delay = self.custom_settings.get('DOWNLOAD_DELAY', self.download_delay)
                if delay > current_delay:
                    self.download_delay = delay
                    self.custom_settings['DOWNLOAD_DELAY'] = delay
                    self.logger.info("Applied MixesDB robots.txt crawl-delay of %s seconds", delay)
        except Exception as exc:
            self.logger.debug("Failed to apply MixesDB robots policy: %s", exc)

    def generate_search_urls(self):
        """Generate search URLs using improved strategies"""
        search_urls = []
        base_url = "https://www.mixesdb.com/db/index.php"

        # Get improved searches from strategy module
        from .improved_search_strategies import get_mixesdb_searches
        search_items = get_mixesdb_searches()

        for item in search_items:
            search_urls.append(item['url'])

        # Also search for our specific target artists
        rotation_batch = self._select_artist_batch()

        for artist in rotation_batch:
            # Search for artist mixes
            search_query = quote(artist)
            search_urls.append(f"{base_url}?title=Special%3ASearch&search={search_query}")

        # Add year-specific categories for contemporary content
        search_urls.extend([
            'https://www.mixesdb.com/db/index.php/Category:2023',
            'https://www.mixesdb.com/db/index.php/Category:2024',
            'https://www.mixesdb.com/db/index.php/Category:2025',
            'https://www.mixesdb.com/db/index.php/Category:Tech_House',
            'https://www.mixesdb.com/db/index.php/Category:Melodic_Techno',
            'https://www.mixesdb.com/db/index.php/Special:RecentChanges',
        ])

        # Remove duplicates
        search_urls = list(dict.fromkeys(search_urls))

        total_urls = len(search_urls)
        if total_urls == 0:
            return []

        batch_size = int(os.getenv('MIXESDB_URL_BATCH_SIZE', 50))
        rotation_seed_raw = os.getenv('MIXESDB_URL_ROTATION')

        if rotation_seed_raw is not None:
            try:
                rotation_seed = int(rotation_seed_raw)
            except ValueError:
                self.logger.warning(
                    "Invalid MIXESDB_URL_ROTATION value '%s'; defaulting to date-based rotation",
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
            selected_urls.append(search_urls[idx])

        self.logger.info(
            "Selected %s MixesDB search URLs (offset %s of %s total)",
            len(selected_urls),
            start_index,
            total_urls
        )

        return selected_urls

    def _select_artist_batch(self):
        """Return a rotating subset of target artists for focused searches."""
        total_artists = len(self.target_artists)
        if total_artists == 0:
            return []

        batch_size = int(os.getenv('MIXESDB_ARTIST_BATCH_SIZE', 20))
        rotation_seed_raw = os.getenv('MIXESDB_ARTIST_ROTATION')

        if rotation_seed_raw is not None:
            try:
                rotation_seed = int(rotation_seed_raw)
            except ValueError:
                self.logger.warning(
                    "Invalid MIXESDB_ARTIST_ROTATION value '%s'; defaulting to date-based rotation",
                    rotation_seed_raw
                )
                rotation_seed = datetime.utcnow().toordinal()
        else:
            rotation_seed = datetime.utcnow().toordinal()

        start_index = (rotation_seed * batch_size) % total_artists
        window = min(batch_size, total_artists)
        selected = []

        for i in range(window):
            idx = (start_index + i) % total_artists
            selected.append(self.target_artists[idx])

        return selected

    def parse(self, response):
        """Parse MixesDB pages with enhanced data extraction"""
        # Check if response is text (guard against brotli decompression failures)
        try:
            _ = response.text
        except Exception as e:
            self.logger.warning(f"Response encoding error for {response.url}: {e}")
            self.logger.warning(f"Content-Encoding: {response.headers.get('Content-Encoding', b'none').decode()}")
            return

        # Handle search results
        if 'Special:Search' in response.url:
            yield from self.parse_search_results(response)
            return

        # Handle category pages
        if 'Category:' in response.url:
            yield from self.parse_category_page(response)
            return

        # Handle individual mix pages
        if self.is_mix_page(response):
            yield from self.parse_mix_page(response)
            return

        # Handle recent changes
        if 'RecentChanges' in response.url:
            yield from self.parse_recent_changes(response)

    def parse_search_results(self, response):
        """Parse search results and follow mix links"""
        mix_links = response.css('div.mw-search-result-heading a::attr(href), ul.mw-search-results li a::attr(href)').getall()

        # Limit to 5 results per search to prevent timeouts
        # With 15s delay, 5 results = ~75s + processing time
        max_results = int(os.getenv('MIXESDB_MAX_RESULTS_PER_SEARCH', '5'))

        for link in mix_links[:max_results]:
            full_url = response.urljoin(link)
            if self.is_mix_url(full_url):
                if self.is_source_processed(full_url):
                    self.logger.debug(f"Skipping already processed URL: {full_url}")
                    continue
                yield scrapy.Request(
                    url=full_url,
                    callback=self.parse_mix_page,
                    errback=self.handle_error,
                    dont_filter=False,
                    meta={'download_timeout': 30}
                )

    def parse_category_page(self, response):
        """Parse category pages for mix links using LLM"""
        mix_links = []

        # Try LLM extraction first
        try:
            import sys
            import os
            sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            from llm_scraper_engine import ScrapyLLMExtractor

            llm_extractor = ScrapyLLMExtractor("mixesdb")
            llm_links = llm_extractor.extract_tracklists(response)

            if llm_links:
                self.logger.info(f"LLM extraction found {len(llm_links)} mix links")
                mix_links = llm_links[:10]  # Reduced limit to prevent timeouts

        except Exception as e:
            self.logger.warning(f"LLM extraction failed for MixesDB: {e}, falling back to CSS")

        # Fallback to traditional CSS selectors
        if not mix_links:
            mix_links = response.css('div.mw-category a::attr(href), li a::attr(href)').getall()

        # Limit to 5 results per category page to prevent timeouts
        max_results = int(os.getenv('MIXESDB_MAX_RESULTS_PER_CATEGORY', '5'))

        for link in mix_links[:max_results]:
            full_url = response.urljoin(link)
            if self.is_mix_url(full_url):
                if self.is_source_processed(full_url):
                    self.logger.debug(f"Skipping already processed URL: {full_url}")
                    continue
                yield scrapy.Request(
                    url=full_url,
                    callback=self.parse_mix_page,
                    errback=self.handle_error,
                    meta={'download_timeout': 30}
                )

    def parse_recent_changes(self, response):
        """Parse recent changes for new mix links"""
        recent_links = response.css('ul.special li a::attr(href)').getall()

        # Limit to 5 results from recent changes
        max_results = int(os.getenv('MIXESDB_MAX_RESULTS_PER_RECENT', '5'))

        for link in recent_links[:max_results]:
            full_url = response.urljoin(link)
            if self.is_mix_url(full_url):
                if self.is_source_processed(full_url):
                    self.logger.debug(f"Skipping already processed URL: {full_url}")
                    continue
                yield scrapy.Request(
                    url=full_url,
                    callback=self.parse_mix_page,
                    errback=self.handle_error,
                    meta={'download_timeout': 30}
                )

    def is_mix_page(self, response):
        """Check if current page is a mix page"""
        return bool(response.css('ol.tracklist, div.tracklist-section, h1#firstHeading'))

    def is_mix_url(self, url):
        """Check if URL is likely a mix page"""
        exclude_patterns = [
            'Special:', 'Category:', 'User:', 'Talk:', 'File:', 'Template:',
            'Help:', 'MediaWiki:', 'Main_Page'
        ]
        return not any(pattern in url for pattern in exclude_patterns)

    def parse_mix_page(self, response):
        """Parse individual mix page with CSS selector-based extraction"""
        try:
            # Store response for debugging
            self.last_response = response

            # Extract comprehensive setlist metadata
            setlist_data = self.extract_enhanced_setlist_data(response)
            if setlist_data:
                yield EnhancedSetlistItem(**setlist_data)

            # Extract artist information
            artist_data = self.extract_artist_data(response)
            if artist_data:
                yield EnhancedArtistItem(**artist_data)

            # Extract tracks with full metadata using CSS selectors
            tracks_data = self.extract_enhanced_tracks(response, setlist_data)

            if not tracks_data:
                self.logger.warning(
                    f"No tracks extracted from {response.url} using CSS selectors"
                )
                return

            self.logger.info(f"✅ CSS extraction: {len(tracks_data)} tracks found from {response.url}")

            # CRITICAL: Create and yield playlist item FIRST, before processing tracks
            if setlist_data and tracks_data:
                track_names = [track_info['track']['track_name'] for track_info in tracks_data if track_info.get('track', {}).get('track_name')]
                playlist_item = self.create_playlist_item_from_setlist(setlist_data, response.url, track_names)
                if playlist_item:
                    self.logger.info(f"Yielding playlist item: {playlist_item.get('name')} with {len(track_names)} tracks")
                    yield playlist_item

            for track_info in tracks_data:
                yield EnhancedTrackItem(**track_info['track'])

                # Yield relationships
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

            # Generate track adjacency relationships within THIS mix only
            if setlist_data and len(tracks_data) > 1:
                yield from self.generate_track_adjacencies(tracks_data, setlist_data)

        except Exception as e:
            self.logger.error(f"Error parsing mix page {response.url}: {e}")
        finally:
            self.mark_source_processed(response.url)

    def is_source_processed(self, url: str) -> bool:
        if not url:
            return False
        if url in self.processed_mix_urls:
            return True
        if not self.redis_client:
            return False
        digest = hashlib.sha1(url.encode('utf-8')).hexdigest()
        key = f"{self.redis_prefix}:{digest}"
        try:
            return bool(self.redis_client.exists(key))
        except Exception as exc:
            self.logger.debug("Redis exists check failed for MixesDB: %s", exc)
            return False

    def mark_source_processed(self, url: str) -> None:
        if not url:
            return
        self.processed_mix_urls.add(url)
        if not self.redis_client:
            return
        digest = hashlib.sha1(url.encode('utf-8')).hexdigest()
        key = f"{self.redis_prefix}:{digest}"
        try:
            self.redis_client.setex(key, self.source_ttl_seconds, datetime.utcnow().isoformat())
        except Exception as exc:
            self.logger.debug("Redis setex failed for MixesDB: %s", exc)

    def closed(self, reason):
        self.record_run_timestamp()

    def record_run_timestamp(self):
        if not self.redis_client or not self.last_run_key:
            return
        try:
            self.redis_client.setex(self.last_run_key, self.run_ttl_seconds, datetime.utcnow().isoformat())
        except Exception as exc:
            self.logger.debug("Redis setex failed for MixesDB last run tracking: %s", exc)

    def extract_enhanced_setlist_data(self, response):
        """Extract comprehensive setlist metadata"""
        try:
            # Parse title for DJ, event, and date information
            page_title = response.css('h1#firstHeading span.mw-page-title-main::text').get()
            if not page_title:
                return None

            # Parse title format: "YYYY-MM-DD - Artist Name - Event/Show Name"
            title_match = re.match(r'(\d{4}-\d{2}-\d{2})\s*-\s*(.*?)\s*-\s*(.*)', page_title)

            if title_match:
                set_date_str, dj_name, event_name = title_match.groups()
                set_date = datetime.strptime(set_date_str, '%Y-%m-%d').date()
            else:
                # Fallback parsing
                dj_name = page_title.strip()
                event_name = None
                set_date = None

            # Extract additional metadata
            venue_info = self.extract_venue_info(response)
            duration = self.extract_duration(response)
            genre_tags = self.extract_genre_tags(response)

            # Extract quality and format information
            audio_quality = self.extract_audio_quality(response)

            # Count tracks
            track_elements = response.css('ol.tracklist li, div.tracklist-section ul li')
            total_tracks = len(track_elements)

            return {
                'setlist_name': page_title,
                'normalized_name': page_title.lower().strip(),
                'dj_artist_name': dj_name.strip() if dj_name else None,
                'event_name': event_name.strip() if event_name else None,
                'venue_name': venue_info.get('name'),
                'venue_location': venue_info.get('location'),
                'set_date': set_date,
                'duration_minutes': duration,
                'event_type': self.classify_event_type(event_name),
                'audio_quality': audio_quality,
                'genre_tags': genre_tags,
                'total_tracks': total_tracks,
                'description': self.extract_description(response),
                'external_urls': json.dumps({'mixesdb': response.url}),
                'metadata': json.dumps({
                    'source': 'mixesdb',
                    'page_title': page_title,
                    'last_updated': self.extract_last_updated(response),
                    'scraped_at': datetime.utcnow().isoformat()
                }),
                'data_source': self.name,
                'scrape_timestamp': datetime.utcnow(),
                'created_at': datetime.utcnow()
            }

        except Exception as e:
            self.logger.error(f"Error extracting setlist data: {e}")
            return None

    def extract_artist_data(self, response):
        """Extract comprehensive artist information"""
        page_title = response.css('h1#firstHeading span.mw-page-title-main::text').get()
        if not page_title:
            return None

        # Parse artist name from title
        title_match = re.match(r'\d{4}-\d{2}-\d{2}\s*-\s*(.*?)\s*-\s*.*', page_title)
        artist_name = title_match.group(1).strip() if title_match else page_title.strip()

        if not artist_name:
            return None

        # Extract additional artist information
        genre_preferences = self.extract_genre_tags(response)

        return {
            'artist_name': artist_name,
            'normalized_name': artist_name.lower().strip(),
            'genre_preferences': genre_preferences,
            'external_urls': json.dumps({
                'mixesdb_context': response.url
            }),
            'metadata': json.dumps({
                'discovered_in_mix': page_title,
                'mix_url': response.url,
                'scraped_at': datetime.utcnow().isoformat()
            }),
            'data_source': self.name,
            'scrape_timestamp': datetime.utcnow(),
            'created_at': datetime.utcnow()
        }

    def create_playlist_item_from_setlist(self, setlist_data, source_url, track_names=None):
        """Create a PlaylistItem from setlist metadata for database storage"""
        try:
            playlist_item = PlaylistItem(
                item_type='playlist',
                name=setlist_data.get('setlist_name'),
                source='mixesdb',
                source_url=source_url,
                dj_name=setlist_data.get('dj_artist_name'),
                artist_name=setlist_data.get('dj_artist_name'),
                curator=setlist_data.get('dj_artist_name'),
                event_name=setlist_data.get('event_name'),
                event_date=setlist_data.get('set_date'),
                venue_name=setlist_data.get('venue_name'),
                tracks=track_names,  # List of track names
                total_tracks=len(track_names) if track_names else setlist_data.get('total_tracks', 0),
                description=setlist_data.get('description'),
                genre_tags=setlist_data.get('genre_tags'),
                duration_minutes=None,  # Could be calculated from track durations if available
                bpm_range=setlist_data.get('bpm_range'),
                data_source=self.name,
                scrape_timestamp=datetime.utcnow(),
                created_at=datetime.utcnow()
            )

            self.logger.debug(f"Created playlist item: {setlist_data.get('setlist_name')}")
            return playlist_item

        except Exception as e:
            self.logger.error(f"Error creating playlist item: {e}")
            return None

    def extract_enhanced_tracks(self, response, setlist_data):
        """Extract tracks with comprehensive metadata using CSS selectors"""
        tracks_data = []

        # MixesDB structure: <h2>Tracklist</h2> followed by <ol><li>...</li></ol>
        # Find the tracklist <ol> that comes after the "Tracklist" heading
        tracklist_heading = response.xpath('//h2[contains(., "Tracklist")]').get()
        if tracklist_heading:
            # Get the <ol> element that immediately follows the tracklist heading
            track_elements = response.xpath('//h2[contains(., "Tracklist")]/following-sibling::ol[1]/li')
        else:
            # Fallback: try finding any <ol> or <ul> with tracks
            track_elements = response.css('ol li, ul.tracklist li, div.tracklist-section ul li')

        for i, track_el in enumerate(track_elements):
            try:
                # Get raw track string
                track_text_parts = track_el.css('::text').getall()
                track_string = " ".join([t.strip() for t in track_text_parts if t.strip()])

                if not track_string:
                    continue

                # FRAMEWORK SECTION 2.2: Extract Label and Catalog Number FIRST
                # Pattern: \[([^\]]+?)\s+-\s+([^\]]+?)\]
                # Format: "Artist - Track [Label - CatNum]"
                label_pattern = r'\[([^\]]+?)\s+-\s+([^\]]+?)\]'
                label_match = re.search(label_pattern, track_string)

                label_name = None
                catalog_number = None

                if label_match:
                    label_name = label_match.group(1).strip()
                    catalog_number = label_match.group(2).strip()
                    # Remove label/catalog from track string before parsing
                    track_string = track_string[:label_match.start()].strip()
                    self.logger.debug(f"Extracted label: {label_name}, catalog: {catalog_number}")

                # Parse track information
                parsed_track = parse_track_string(track_string)

                # Skip unknown tracks instead of creating "Unknown Artist" entries
                if parsed_track is None or parsed_track['track_name'].lower() in ['id', '?', 'unknown'] or not parsed_track['primary_artists']:
                    continue

                # Extract timing information
                start_time = self.extract_start_time_from_string(track_string)

                # Extract BPM if available
                bpm = self.extract_bpm_from_string(track_string)

                # Extract key information
                musical_key = self.extract_key_from_string(track_string)

                # Determine genre from context
                genre = self.infer_genre_from_context(response, parsed_track)

                # Extract primary artist list BEFORE using it
                primary_artists = parsed_track.get('primary_artists', [])

                # Generate deterministic track_id for cross-source deduplication
                track_id = generate_track_id_from_parsed(parsed_track)

                # Build comprehensive track data (with label/catalog for Discogs linking)
                is_remix = parsed_track.get('is_remix', False)
                remix_type = self.extract_remix_type(parsed_track['track_name'])

                # Pydantic validation requires remix_type when is_remix=True
                if is_remix and not remix_type:
                    remix_type = "Unknown Remix"

                track_item = {
                    'track_id': track_id,  # Deterministic ID for matching across sources
                    'track_name': parsed_track['track_name'],
                    'normalized_title': parsed_track['track_name'].lower().strip(),
                    'is_remix': is_remix,
                    'is_mashup': parsed_track.get('is_mashup', False),
                    'mashup_components': parsed_track.get('mashup_components'),
                    'bpm': bpm,
                    'musical_key': musical_key,
                    'genre': genre,
                    'record_label': label_name,  # For Discogs linking
                    'catalog_number': catalog_number,  # For Discogs linking
                    'start_time': start_time,
                    'track_type': 'Mix',
                    'source_context': track_string,
                    'position_in_source': i + 1,
                    'remix_type': remix_type,
                    'metadata': json.dumps({
                        'original_string': track_string,
                        'extraction_source': 'mixesdb',
                        'mix_context': setlist_data.get('setlist_name') if setlist_data else None,
                        'is_identified': parsed_track['track_name'] != "Unknown Track",
                        'label': label_name,
                        'catalog': catalog_number
                    }),
                    'external_urls': json.dumps({'mixesdb_context': response.url}),
                    'data_source': self.name,
                    'scrape_timestamp': datetime.utcnow(),
                    'created_at': datetime.utcnow()
                }

                self.logger.debug(f"Generated track_id {track_id} for: {primary_artists[0] if primary_artists else 'Unknown'} - {parsed_track['track_name']}")

                # Build artist relationships
                relationships = []

                # Primary artists
                for j, artist in enumerate(primary_artists):
                    relationships.append({
                        'track_name': parsed_track['track_name'],
                        'artist_name': artist,
                        'artist_role': 'primary',
                        'position': j,
                        'data_source': self.name,
                        'scrape_timestamp': datetime.utcnow(),
                        'created_at': datetime.utcnow()
                    })

                # Featured artists
                for j, artist in enumerate(parsed_track.get('featured_artists', [])):
                    relationships.append({
                        'track_name': parsed_track['track_name'],
                        'artist_name': artist,
                        'artist_role': 'featured',
                        'position': j + 1,
                        'data_source': self.name,
                        'scrape_timestamp': datetime.utcnow(),
                        'created_at': datetime.utcnow()
                    })

                # Remixer artists
                for j, artist in enumerate(parsed_track.get('remixer_artists', [])):
                    relationships.append({
                        'track_name': parsed_track['track_name'],
                        'artist_name': artist,
                        'artist_role': 'remixer',
                        'position': j + 1,
                        'contribution_type': 'remix',
                        'data_source': self.name,
                        'scrape_timestamp': datetime.utcnow(),
                        'created_at': datetime.utcnow()
                    })

                tracks_data.append({
                    'track': track_item,
                    'relationships': relationships,
                    'track_order': i + 1
                })

            except Exception as e:
                self.logger.error(f"Error parsing track {i+1}: {e}")
                continue

        return tracks_data

    def extract_venue_info(self, response):
        """Extract venue information from page"""
        venue_text = response.css('li:contains("Venue:") a::text').get()
        if venue_text:
            return {'name': venue_text.strip(), 'location': None}

        # Try to extract from event name
        page_title = response.css('h1#firstHeading span.mw-page-title-main::text').get()
        if page_title:
            venue_match = re.search(r'@\s*(.*?)(?:,|\s*\||$)', page_title)
            if venue_match:
                venue_name = venue_match.group(1).strip()
                location_match = re.search(r'@.*?,\s*(.*?)(?:\s*\||$)', page_title)
                location = location_match.group(1).strip() if location_match else None
                return {'name': venue_name, 'location': location}

        return {'name': None, 'location': None}

    def extract_duration(self, response):
        """Extract mix duration in minutes"""
        duration_text = response.css('li:contains("Duration:"), li:contains("Length:")').re_first(r'(\d+):(\d+)')
        if duration_text:
            try:
                hours, minutes = map(int, duration_text.split(':'))
                return hours * 60 + minutes
            except (ValueError, AttributeError):
                pass
        return None

    def extract_genre_tags(self, response):
        """Extract genre tags from page"""
        # Look for genre categories or tags
        genre_links = response.css('div.mw-normal-catlinks a::text').getall()
        genres = []

        electronic_genres = [
            'techno', 'house', 'trance', 'progressive', 'electro', 'dubstep',
            'drum and bass', 'breakbeat', 'ambient', 'minimal', 'deep house',
            'tech house', 'progressive house', 'big room', 'future bass'
        ]

        for link_text in genre_links:
            for genre in electronic_genres:
                if genre.lower() in link_text.lower():
                    genres.append(genre.title())

        return list(set(genres)) if genres else None

    def extract_audio_quality(self, response):
        """Extract audio quality information"""
        quality_indicators = ['320kbps', '256kbps', '192kbps', 'FLAC', 'WAV', 'MP3', 'Lossless']
        page_text = response.css('body').get() or ""

        for quality in quality_indicators:
            if quality.lower() in page_text.lower():
                return quality

        return 'Unknown'

    def extract_description(self, response):
        """Extract mix description or notes"""
        description_selectors = [
            'div.description::text',
            'p:contains("Notes:")::text',
            'div.notes::text'
        ]

        for selector in description_selectors:
            description = response.css(selector).get()
            if description:
                return description.strip()

        return None

    def extract_last_updated(self, response):
        """Extract last updated date"""
        last_updated = response.css('li:contains("Article Last Updated Date:")::text').get()
        if last_updated:
            date_match = re.search(r'Date:\s*(.*)', last_updated)
            if date_match:
                return date_match.group(1).strip()
        return None

    def classify_event_type(self, event_name):
        """Classify the type of event based on name"""
        if not event_name:
            return None

        event_name_lower = event_name.lower()

        if any(word in event_name_lower for word in ['essential mix', 'radio', 'podcast', 'show']):
            return 'Radio Show'
        elif any(word in event_name_lower for word in ['festival', 'ultra', 'tomorrowland', 'edc']):
            return 'Festival'
        elif any(word in event_name_lower for word in ['club', 'night', 'residency']):
            return 'Club Night'
        elif 'live' in event_name_lower:
            return 'Live Performance'
        else:
            return 'DJ Set'

    def extract_start_time_from_string(self, track_string):
        """Extract start time from track string"""
        time_patterns = [
            r'\[(\d{1,2}:\d{2}(?::\d{2})?)\]',
            r'(\d{1,2}:\d{2}(?::\d{2})?)\s*-',
            r'^(\d{1,2}:\d{2}(?::\d{2})?)'
        ]

        for pattern in time_patterns:
            match = re.search(pattern, track_string)
            if match:
                return match.group(1)
        return None

    def extract_bpm_from_string(self, track_string):
        """Extract BPM from track string"""
        bpm_match = re.search(r'(\d{2,3})\s*bpm', track_string, re.IGNORECASE)
        if bpm_match:
            try:
                bpm = float(bpm_match.group(1))
                return bpm if 60 <= bpm <= 200 else None
            except ValueError:
                pass
        return None

    def extract_key_from_string(self, track_string):
        """Extract musical key from track string"""
        key_pattern = r'\b([A-G][#b]?(?:maj|min|m)?)\b'
        key_match = re.search(key_pattern, track_string)
        if key_match:
            return key_match.group(1)
        return None

    def extract_remix_type(self, track_name):
        """Extract remix type from track name"""
        remix_patterns = {
            r'\(Original Mix\)': 'Original Mix',
            r'\(Extended Mix\)': 'Extended Mix',
            r'\(Radio Edit\)': 'Radio Edit',
            r'\(Club Mix\)': 'Club Mix',
            r'\(Dub Mix\)': 'Dub Mix',
            r'\(Vocal Mix\)': 'Vocal Mix',
            r'\(Instrumental\)': 'Instrumental'
        }

        for pattern, remix_type in remix_patterns.items():
            if re.search(pattern, track_name, re.IGNORECASE):
                return remix_type
        return None

    def generate_track_adjacencies(self, tracks_data, setlist_data):
        """
        Generate track adjacency relationships within a single mix.
        Creates adjacency items for tracks within 3 positions of each other.
        """
        if not tracks_data or len(tracks_data) < 2:
            return

        setlist_name = setlist_data.get('setlist_name', 'Unknown Mix')
        setlist_id = setlist_data.get('setlist_id', f"mix_{hash(setlist_name)}")

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
                    source_context=f"mixesdb:{setlist_name}",
                    transition_type=transition_type,
                    occurrence_count=1,
                    created_at=datetime.utcnow(),
                    data_source=self.name,
                    scrape_timestamp=datetime.utcnow()
                )

                yield adjacency_item
                adjacency_count += 1

        if adjacency_count > 0:
            self.logger.info(f"Generated {adjacency_count} track adjacency relationships for mix: {setlist_name}")

    def infer_genre_from_context(self, response, parsed_track):
        """Infer genre from page context and track characteristics"""
        # Get page title and content for context
        page_title = response.css('h1#firstHeading span.mw-page-title-main::text').get() or ""

        # Genre inference rules
        if any(word in page_title.lower() for word in ['essential mix', 'radio 1']):
            return 'Electronic'
        elif 'progressive' in page_title.lower():
            return 'Progressive House'
        elif any(word in page_title.lower() for word in ['techno', 'tech']):
            return 'Techno'
        elif 'trance' in page_title.lower():
            return 'Trance'

        # Infer from track characteristics
        track_name = parsed_track.get('track_name', '').lower()
        if any(word in track_name for word in ['remix', 'edit', 'mix']):
            return 'Electronic'

        return None

    def _create_track_item_from_nlp(self, nlp_track: Dict, source_url: str):
        """
        Convert NLP-extracted track data to Scrapy TrackItem

        Args:
            nlp_track: Dict with 'artist', 'title', 'timestamp' keys from NLP processor
            source_url: URL where track was extracted from

        Returns:
            TrackItem ready for pipeline processing (legacy format with 4 fields only)
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

            # Create track item (legacy TrackItem only supports: track_id, track_name, track_url, source_platform)
            track_item = EnhancedTrackItem()
            track_item['track_id'] = track_id
            track_item['track_name'] = f"{artist_name} - {title}"  # Combined format
            track_item['track_url'] = source_url
            track_item['source_platform'] = 'mixesdb_html_nlp'

            self.logger.debug(
                f"Created track item from NLP: {artist_name} - {title}"
            )

            return track_item

        except Exception as e:
            self.logger.error(f"Error creating track item from NLP data: {e}", exc_info=True)
            return None

    def handle_error(self, failure):
        """Handle request failures"""
        self.logger.error(f"Request failed: {failure.request.url} - {failure.value}")

    def closed(self, reason):
        """Log spider completion statistics"""
        self.logger.info(f"Enhanced MixesDB spider closed: {reason}")
