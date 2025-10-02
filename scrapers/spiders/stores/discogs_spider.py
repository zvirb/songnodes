"""
Discogs API Integration Spider for SongNodes
=============================================

Priority Score: 2.65 (High Priority)
Focus: Electronic music, vinyl releases, label metadata

Official API: https://api.discogs.com/
Authentication: Personal Access Token (from DISCOGS_TOKEN env var or database)
Rate Limit: 60 requests/min (authenticated), 25/min (unauthenticated)

Best Use Cases:
- Electronic music releases (techno, house, drum & bass, etc.)
- Vinyl releases and catalog numbers
- Label metadata and discographies
- Detailed genre/style classification
- Producer/remixer credits
- Release dates and countries

API Endpoints:
- GET /database/search - Search for releases, artists, labels
- GET /releases/{id} - Get detailed release information
- GET /artists/{id} - Get artist information
- GET /labels/{id} - Get label information

Key Features:
- Rich genre/style taxonomy (detailed electronic subgenres)
- Label and catalog number tracking
- Credits (producers, remixers, engineers)
- Release country and pressing information
- Format details (vinyl, CD, digital)
- Canonical Discogs IDs for cross-source matching
"""

import scrapy
import json
import time
import logging
import os
import asyncpg
import asyncio
from datetime import datetime
from typing import Optional, Dict, List, Any
from urllib.parse import quote, urlencode

try:
    from ..item_loaders import TrackLoader, ArtistLoader
    from ..items import EnhancedTrackItem, EnhancedArtistItem
except ImportError:
    # Fallback for standalone execution
    import sys
    sys.path.append(os.path.dirname(os.path.dirname(__file__)))
    from item_loaders import TrackLoader, ArtistLoader
    from items import EnhancedTrackItem, EnhancedArtistItem


class DiscogsAPISpider(scrapy.Spider):
    """
    Discogs API spider for comprehensive music metadata enrichment.

    Usage:
        # Search for specific track
        scrapy crawl discogs -a query="Artist Name - Track Title"

        # Search with filters
        scrapy crawl discogs -a artist="Amelie Lens" -a title="Feel It"

        # Get specific release by ID
        scrapy crawl discogs -a release_id="12345678"
    """

    name = 'discogs'
    allowed_domains = ['api.discogs.com', 'discogs.com']

    # API Configuration
    api_base_url = 'https://api.discogs.com'

    # Rate limiting: 60 req/min authenticated = 1 req/sec
    # Conservative approach: 1.2 seconds between requests
    download_delay = 1.2

    custom_settings = {
        'ROBOTSTXT_OBEY': False,  # API doesn't use robots.txt
        'DOWNLOAD_DELAY': 1.2,  # Conservative rate limiting
        'RANDOMIZE_DOWNLOAD_DELAY': 0.2,  # Slight randomization (1.0-1.4s)
        'CONCURRENT_REQUESTS': 1,
        'CONCURRENT_REQUESTS_PER_DOMAIN': 1,

        # AutoThrottle for dynamic rate limiting
        'AUTOTHROTTLE_ENABLED': True,
        'AUTOTHROTTLE_START_DELAY': 1.2,
        'AUTOTHROTTLE_MAX_DELAY': 10.0,
        'AUTOTHROTTLE_TARGET_CONCURRENCY': 0.5,
        'AUTOTHROTTLE_DEBUG': True,

        # Retry settings
        'RETRY_TIMES': 3,
        'RETRY_HTTP_CODES': [429, 500, 502, 503, 504, 522, 524, 408],

        # User-Agent (required by Discogs API)
        'USER_AGENT': 'SongNodes/1.0 +https://github.com/songnodes/songnodes',

        # Pipeline
        'ITEM_PIPELINES': {
            'database_pipeline.DatabasePipeline': 300,
        },

        # Logging
        'LOG_LEVEL': 'INFO',
    }

    def __init__(self, query=None, artist=None, title=None, release_id=None,
                 artist_id=None, label_id=None, *args, **kwargs):
        """
        Initialize spider with search parameters.

        Args:
            query: Free-form search query
            artist: Artist name for targeted search
            title: Track/release title for targeted search
            release_id: Specific Discogs release ID
            artist_id: Specific Discogs artist ID
            label_id: Specific Discogs label ID
        """
        super(DiscogsAPISpider, self).__init__(*args, **kwargs)

        self.query = query
        self.artist = artist
        self.title = title
        self.release_id = release_id
        self.artist_id = artist_id
        self.label_id = label_id

        # Authentication token
        self.token = None
        self.authenticated = False

        # Statistics
        self.stats = {
            'requests_made': 0,
            'releases_found': 0,
            'tracks_extracted': 0,
            'artists_extracted': 0,
            'api_errors': 0,
            'rate_limit_hits': 0
        }

        # Load token from database or environment
        self._load_discogs_token()

    def _load_discogs_token(self):
        """Load Discogs Personal Access Token from database or environment"""
        try:
            # Try loading from database using async API key system
            token = self._load_token_from_db()
            if token:
                self.token = token
                self.authenticated = True
                self.logger.info("Discogs token loaded from database")
                return
        except Exception as e:
            self.logger.debug(f"Database token load failed (will try environment): {e}")

        # Fallback to environment variable
        self.token = os.getenv('DISCOGS_TOKEN')
        if self.token:
            self.authenticated = True
            self.logger.info("Discogs token loaded from environment")
        else:
            self.logger.warning(
                "No Discogs token found. Rate limit: 25 req/min (unauthenticated). "
                "Configure via Frontend Settings or set DISCOGS_TOKEN environment variable."
            )

    def _load_token_from_db(self) -> Optional[str]:
        """Load Discogs token from encrypted database storage"""
        try:
            # Get database connection details
            db_host = os.getenv('DB_HOST', 'db-connection-pool')
            db_port = int(os.getenv('DB_PORT', '6432'))
            db_name = os.getenv('DB_NAME', 'musicdb')
            db_user = os.getenv('DB_USER', 'musicdb_user')
            db_password = os.getenv('POSTGRES_PASSWORD', 'musicdb_secure_pass_2024')
            encryption_secret = os.getenv('API_KEY_ENCRYPTION_SECRET',
                                         'songnodes_change_in_production_2024')

            # Create connection and fetch token
            async def fetch_token():
                conn = await asyncpg.connect(
                    host=db_host,
                    port=db_port,
                    database=db_name,
                    user=db_user,
                    password=db_password,
                    timeout=5.0
                )
                try:
                    # Fetch token (pass encryption secret explicitly)
                    token = await conn.fetchval(
                        "SELECT get_api_key($1, $2, $3)",
                        'discogs', 'token', encryption_secret
                    )
                    return token
                finally:
                    await conn.close()

            # Run async function in event loop
            loop = asyncio.new_event_loop()
            try:
                token = loop.run_until_complete(fetch_token())
                return token
            finally:
                loop.close()

        except Exception as e:
            self.logger.debug(f"Database token load failed: {e}")
            raise

    def start(self):
        """Generate initial API requests based on spider arguments"""
        headers = self._get_api_headers()

        # Priority 1: Specific resource IDs (most efficient)
        if self.release_id:
            url = f"{self.api_base_url}/releases/{self.release_id}"
            yield scrapy.Request(
                url,
                headers=headers,
                callback=self.parse_release,
                errback=self.handle_api_error,
                meta={'resource_type': 'release'}
            )
            return

        if self.artist_id:
            url = f"{self.api_base_url}/artists/{self.artist_id}"
            yield scrapy.Request(
                url,
                headers=headers,
                callback=self.parse_artist,
                errback=self.handle_api_error,
                meta={'resource_type': 'artist'}
            )
            return

        if self.label_id:
            url = f"{self.api_base_url}/labels/{self.label_id}"
            yield scrapy.Request(
                url,
                headers=headers,
                callback=self.parse_label,
                errback=self.handle_api_error,
                meta={'resource_type': 'label'}
            )
            return

        # Priority 2: Targeted artist + title search
        if self.artist and self.title:
            search_query = f"{self.artist} {self.title}"
            url = self._build_search_url(search_query, type='release')
            yield scrapy.Request(
                url,
                headers=headers,
                callback=self.parse_search_results,
                errback=self.handle_api_error,
                meta={'search_query': search_query, 'search_type': 'release'}
            )
            return

        # Priority 3: Free-form query search
        if self.query:
            url = self._build_search_url(self.query, type='release')
            yield scrapy.Request(
                url,
                headers=headers,
                callback=self.parse_search_results,
                errback=self.handle_api_error,
                meta={'search_query': self.query, 'search_type': 'release'}
            )
            return

        # No search parameters provided
        self.logger.error(
            "No search parameters provided. Use -a query='...', "
            "-a artist='...' -a title='...', or -a release_id='...'"
        )

    def _get_api_headers(self) -> Dict[str, str]:
        """Generate API request headers with authentication"""
        headers = {
            'User-Agent': self.custom_settings['USER_AGENT'],
            'Accept': 'application/json',
        }

        if self.authenticated and self.token:
            headers['Authorization'] = f'Discogs token={self.token}'

        return headers

    def _build_search_url(self, query: str, type: str = 'release',
                         per_page: int = 50, page: int = 1) -> str:
        """
        Build Discogs search API URL.

        Args:
            query: Search query string
            type: Search type ('release', 'artist', 'label', 'master')
            per_page: Results per page (max 100)
            page: Page number

        Returns:
            Complete API URL
        """
        params = {
            'q': query,
            'type': type,
            'per_page': min(per_page, 100),
            'page': page
        }

        # Add format filter for electronic music (optional)
        # params['format'] = 'Vinyl'

        return f"{self.api_base_url}/database/search?{urlencode(params)}"

    def parse_search_results(self, response):
        """Parse search results and extract relevant releases"""
        self.stats['requests_made'] += 1

        try:
            data = json.loads(response.text)
        except json.JSONDecodeError:
            self.logger.error(f"Failed to parse JSON response: {response.url}")
            return

        results = data.get('results', [])
        pagination = data.get('pagination', {})

        self.logger.info(
            f"Search returned {len(results)} results "
            f"(page {pagination.get('page', 1)} of {pagination.get('pages', 1)})"
        )

        self.stats['releases_found'] += len(results)

        # Process each search result
        for result in results[:20]:  # Limit to top 20 results per search
            resource_url = result.get('resource_url')
            if not resource_url:
                continue

            # Follow link to get full release details
            yield scrapy.Request(
                resource_url,
                headers=self._get_api_headers(),
                callback=self.parse_release,
                errback=self.handle_api_error,
                meta={
                    'search_query': response.meta.get('search_query'),
                    'resource_type': result.get('type')
                }
            )

        # Optional: Handle pagination (be mindful of rate limits)
        # next_page = pagination.get('page', 1) + 1
        # if next_page <= min(pagination.get('pages', 1), 3):  # Limit to 3 pages
        #     yield scrapy.Request(...)

    def parse_release(self, response):
        """Parse detailed release information"""
        self.stats['requests_made'] += 1

        try:
            release = json.loads(response.text)
        except json.JSONDecodeError:
            self.logger.error(f"Failed to parse release JSON: {response.url}")
            return

        # Extract release metadata
        release_id = release.get('id')
        title = release.get('title')
        year = release.get('year')
        released = release.get('released')  # Full date (YYYY-MM-DD)
        country = release.get('country')

        # Label information
        labels = release.get('labels', [])
        label_name = labels[0].get('name') if labels else None
        catalog_number = labels[0].get('catno') if labels else None

        # Genre and styles (detailed classification)
        genres = release.get('genres', [])
        styles = release.get('styles', [])

        # Artists
        artists = release.get('artists', [])
        primary_artist = artists[0].get('name') if artists else 'Unknown Artist'

        # Tracklist
        tracklist = release.get('tracklist', [])

        self.logger.info(
            f"Processing release: {primary_artist} - {title} "
            f"({year}) [{label_name} {catalog_number}]"
        )

        # Process each track in the release
        for track_data in tracklist:
            yield from self._process_track(
                track_data=track_data,
                release_id=release_id,
                release_title=title,
                release_year=year,
                release_date=released,
                release_country=country,
                label_name=label_name,
                catalog_number=catalog_number,
                genres=genres,
                styles=styles,
                artists=artists
            )

        # Extract artist information
        for artist_data in artists:
            yield from self._process_artist(artist_data, release_id=release_id)

    def _process_track(self, track_data: Dict, release_id: str, release_title: str,
                      release_year: Optional[int], release_date: Optional[str],
                      release_country: Optional[str], label_name: Optional[str],
                      catalog_number: Optional[str], genres: List[str],
                      styles: List[str], artists: List[Dict]) -> Any:
        """
        Process individual track from release tracklist.

        Args:
            track_data: Track information from Discogs API
            release_id: Discogs release ID
            release_title: Release title
            release_year: Release year
            release_date: Full release date (YYYY-MM-DD)
            release_country: Release country
            label_name: Record label name
            catalog_number: Catalog number
            genres: List of genres
            styles: List of styles (subgenres)
            artists: List of artist dictionaries

        Yields:
            EnhancedTrackItem
        """
        # Create ItemLoader for structured data extraction
        loader = TrackLoader(item=EnhancedTrackItem())

        # Basic track information
        track_position = track_data.get('position', '')
        track_title = track_data.get('title', '')
        duration = track_data.get('duration', '')  # Format: "MM:SS"

        # Combine artist + title for track_name
        primary_artist = artists[0].get('name') if artists else 'Unknown Artist'
        track_name = f"{primary_artist} - {track_title}"

        loader.add_value('track_name', track_name)
        loader.add_value('normalized_title', track_title)

        # Duration (convert MM:SS to milliseconds)
        if duration:
            duration_ms = self._parse_duration_to_ms(duration)
            if duration_ms:
                loader.add_value('duration_ms', duration_ms)

        # Discogs ID (for canonical reference)
        loader.add_value('discogs_id', str(release_id))

        # Release information
        if release_date:
            loader.add_value('release_date', release_date)
        elif release_year:
            loader.add_value('release_date', f"{release_year}-01-01")

        # Label and catalog
        if label_name:
            loader.add_value('record_label', label_name)

        # Genre classification
        if genres:
            loader.add_value('genre', genres[0].lower())  # Primary genre

        if styles:
            loader.add_value('subgenre', styles[0].lower())  # Primary style/subgenre

        # Track characteristics
        loader.add_value('is_remix', self._is_remix(track_title))
        loader.add_value('is_live', self._is_live(track_title))

        # Remix detection
        if self._is_remix(track_title):
            remix_type = self._extract_remix_type(track_title)
            if remix_type:
                loader.add_value('remix_type', remix_type)

        # Metadata (rich context for future analysis)
        metadata = {
            'discogs_release_id': release_id,
            'discogs_url': f"https://www.discogs.com/release/{release_id}",
            'release_title': release_title,
            'catalog_number': catalog_number,
            'release_country': release_country,
            'track_position': track_position,
            'genres': genres,
            'styles': styles,
            'source': 'discogs_api',
            'scraped_at': datetime.utcnow().isoformat()
        }
        loader.add_value('metadata', json.dumps(metadata))

        # External URLs
        external_urls = {
            'discogs': f"https://www.discogs.com/release/{release_id}"
        }
        loader.add_value('external_urls', json.dumps(external_urls))

        # System fields
        loader.add_value('data_source', self.name)
        loader.add_value('scrape_timestamp', datetime.utcnow().isoformat())
        loader.add_value('created_at', datetime.utcnow().isoformat())

        self.stats['tracks_extracted'] += 1

        yield loader.load_item()

    def _process_artist(self, artist_data: Dict, release_id: str) -> Any:
        """
        Process artist information.

        Args:
            artist_data: Artist information from Discogs API
            release_id: Associated release ID

        Yields:
            EnhancedArtistItem
        """
        artist_name = artist_data.get('name')
        artist_id = artist_data.get('id')
        artist_resource_url = artist_data.get('resource_url')

        if not artist_name:
            return

        # Create ItemLoader
        loader = ArtistLoader(item=EnhancedArtistItem())

        loader.add_value('artist_name', artist_name)
        loader.add_value('normalized_name', artist_name.lower())

        # Discogs ID
        if artist_id:
            loader.add_value('discogs_id', str(artist_id))

        # Metadata
        metadata = {
            'discogs_artist_id': artist_id,
            'discogs_url': f"https://www.discogs.com/artist/{artist_id}" if artist_id else None,
            'discovered_in_release': release_id,
            'source': 'discogs_api',
            'scraped_at': datetime.utcnow().isoformat()
        }
        loader.add_value('metadata', json.dumps(metadata))

        # External URLs
        if artist_id:
            external_urls = {
                'discogs': f"https://www.discogs.com/artist/{artist_id}"
            }
            loader.add_value('external_urls', json.dumps(external_urls))

        # System fields
        loader.add_value('data_source', self.name)
        loader.add_value('scrape_timestamp', datetime.utcnow().isoformat())
        loader.add_value('created_at', datetime.utcnow().isoformat())

        self.stats['artists_extracted'] += 1

        yield loader.load_item()

    def parse_artist(self, response):
        """Parse detailed artist information (when querying artist endpoint)"""
        self.stats['requests_made'] += 1

        try:
            artist = json.loads(response.text)
        except json.JSONDecodeError:
            self.logger.error(f"Failed to parse artist JSON: {response.url}")
            return

        artist_id = artist.get('id')
        artist_name = artist.get('name')
        profile = artist.get('profile')
        urls = artist.get('urls', [])

        # Create ItemLoader
        loader = ArtistLoader(item=EnhancedArtistItem())

        loader.add_value('artist_name', artist_name)
        loader.add_value('normalized_name', artist_name.lower())
        loader.add_value('discogs_id', str(artist_id))

        # Bio (profile text)
        if profile:
            loader.add_value('bio', profile)

        # External URLs (social media, websites)
        if urls:
            external_urls = {'discogs': f"https://www.discogs.com/artist/{artist_id}"}
            for url in urls[:5]:  # Limit to first 5 URLs
                external_urls[f"url_{urls.index(url)}"] = url
            loader.add_value('external_urls', json.dumps(external_urls))

        # Metadata
        metadata = {
            'discogs_artist_id': artist_id,
            'discogs_url': f"https://www.discogs.com/artist/{artist_id}",
            'source': 'discogs_api',
            'scraped_at': datetime.utcnow().isoformat()
        }
        loader.add_value('metadata', json.dumps(metadata))

        # System fields
        loader.add_value('data_source', self.name)
        loader.add_value('scrape_timestamp', datetime.utcnow().isoformat())
        loader.add_value('created_at', datetime.utcnow().isoformat())

        self.stats['artists_extracted'] += 1

        yield loader.load_item()

    def parse_label(self, response):
        """Parse label information (for future label metadata tracking)"""
        self.stats['requests_made'] += 1

        try:
            label = json.loads(response.text)
        except json.JSONDecodeError:
            self.logger.error(f"Failed to parse label JSON: {response.url}")
            return

        label_id = label.get('id')
        label_name = label.get('name')
        profile = label.get('profile')

        self.logger.info(f"Label: {label_name} (ID: {label_id})")
        self.logger.info(f"Profile: {profile[:200]}..." if profile else "No profile")

        # TODO: Create LabelItem if needed for label tracking
        # For now, just log the information

    def _parse_duration_to_ms(self, duration_str: str) -> Optional[int]:
        """
        Convert duration string (MM:SS) to milliseconds.

        Args:
            duration_str: Duration in format "MM:SS" or "HH:MM:SS"

        Returns:
            Duration in milliseconds, or None if invalid
        """
        try:
            parts = duration_str.split(':')
            if len(parts) == 2:  # MM:SS
                minutes, seconds = map(int, parts)
                return (minutes * 60 + seconds) * 1000
            elif len(parts) == 3:  # HH:MM:SS
                hours, minutes, seconds = map(int, parts)
                return (hours * 3600 + minutes * 60 + seconds) * 1000
        except (ValueError, AttributeError):
            pass
        return None

    def _is_remix(self, track_title: str) -> bool:
        """Detect if track is a remix"""
        remix_indicators = [
            'remix', 'mix', 'edit', 'rework', 'bootleg', 'vip',
            'dub', 'version', 'refix', 'flip'
        ]
        title_lower = track_title.lower()
        return any(indicator in title_lower for indicator in remix_indicators)

    def _is_live(self, track_title: str) -> bool:
        """Detect if track is a live recording"""
        live_indicators = ['live', 'live at', 'recorded live', 'concert']
        title_lower = track_title.lower()
        return any(indicator in title_lower for indicator in live_indicators)

    def _extract_remix_type(self, track_title: str) -> Optional[str]:
        """
        Extract remix type from track title.

        Args:
            track_title: Track title string

        Returns:
            Remix type (e.g., "Original Mix", "Radio Edit") or None
        """
        import re

        remix_patterns = {
            r'\(Original Mix\)': 'Original Mix',
            r'\(Radio Edit\)': 'Radio Edit',
            r'\(Extended Mix\)': 'Extended Mix',
            r'\(Club Mix\)': 'Club Mix',
            r'\(VIP Mix\)': 'VIP Mix',
            r'\(Remix\)': 'Remix',
            r'\(Edit\)': 'Edit',
            r'\(Dub Mix\)': 'Dub Mix',
            r'\((\w+)\s+Remix\)': lambda m: f"{m.group(1)} Remix"
        }

        for pattern, remix_type in remix_patterns.items():
            match = re.search(pattern, track_title, re.IGNORECASE)
            if match:
                if callable(remix_type):
                    return remix_type(match)
                return remix_type

        return None

    def handle_api_error(self, failure):
        """Handle API errors with comprehensive logging"""
        self.stats['api_errors'] += 1

        if hasattr(failure, 'value') and hasattr(failure.value, 'response'):
            response = failure.value.response
            if response is not None:
                status = response.status

                # Handle rate limiting (429 Too Many Requests)
                if status == 429:
                    self.stats['rate_limit_hits'] += 1
                    self.logger.warning(
                        f"Rate limit hit (429). Consider increasing download_delay. "
                        f"Current: {self.download_delay}s"
                    )
                    # Scrapy will automatically retry with exponential backoff
                    return

                # Handle not found (404)
                elif status == 404:
                    self.logger.warning(f"Resource not found (404): {failure.request.url}")
                    return

                # Handle authentication errors (401)
                elif status == 401:
                    self.logger.error(
                        "Authentication failed (401). Check DISCOGS_TOKEN validity. "
                        "Get a new token at: https://www.discogs.com/settings/developers"
                    )
                    return

                # Other HTTP errors
                else:
                    self.logger.error(
                        f"API request failed (status {status}): {failure.request.url}"
                    )
        else:
            self.logger.error(f"Request failed: {failure.request.url} - {failure.value}")

    def closed(self, reason):
        """Log comprehensive spider statistics"""
        self.logger.info(f"\n{'='*60}")
        self.logger.info(f"DISCOGS API SPIDER COMPLETED")
        self.logger.info(f"{'='*60}")
        self.logger.info(f"Spider closed: {reason}")
        self.logger.info(f"Authentication: {'Yes (60 req/min)' if self.authenticated else 'No (25 req/min)'}")
        self.logger.info(f"\nStatistics:")
        self.logger.info(f"  API Requests: {self.stats['requests_made']}")
        self.logger.info(f"  Releases Found: {self.stats['releases_found']}")
        self.logger.info(f"  Tracks Extracted: {self.stats['tracks_extracted']}")
        self.logger.info(f"  Artists Extracted: {self.stats['artists_extracted']}")
        self.logger.info(f"  API Errors: {self.stats['api_errors']}")
        self.logger.info(f"  Rate Limit Hits: {self.stats['rate_limit_hits']}")

        if self.stats['rate_limit_hits'] > 0:
            self.logger.warning(
                f"\nRate limiting detected! Consider increasing download_delay "
                f"(current: {self.download_delay}s)"
            )

        if not self.authenticated:
            self.logger.warning(
                "\nRunning without authentication limits to 25 requests/min. "
                "Configure DISCOGS_TOKEN for 60 requests/min. "
                "Get token at: https://www.discogs.com/settings/developers"
            )

        self.logger.info(f"{'='*60}")
