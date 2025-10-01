"""
Base Spider Classes for SongNodes Scrapy Project
=================================================

Provides reusable base spider classes following Scrapy specification Section II.2.3.
These base classes handle common scraping patterns including pagination, JSON API interaction,
and OAuth/API key authentication.

Architecture:
- All base spiders inherit from scrapy.Spider
- Highly configurable via class attributes (not __init__)
- Compatible with NLPFallbackSpiderMixin
- Follow imperative pattern with explicit yield statements
- Include comprehensive error handling and logging

Usage Examples:

    # 1. BaseNextPageSpider - Automatic pagination
    class MyPaginatedSpider(BaseNextPageSpider):
        name = 'my_spider'
        start_urls = ['https://example.com/page/1']
        next_link_selector = 'a.next-page::attr(href)'

        def parse_page_content(self, response):
            for item in response.css('.item'):
                yield {'title': item.css('.title::text').get()}

    # 2. BaseJsonApiSpider - JSON API pagination
    class MyApiSpider(BaseJsonApiSpider):
        name = 'my_api_spider'
        api_base_url = 'https://api.example.com/tracks'
        api_params = {'limit': 50}
        pagination_style = 'offset'  # or 'next_url'

        def parse_api_response(self, response):
            data = response.json()
            for item in data['results']:
                yield {'title': item['name']}

    # 3. BaseOfficialApiSpider - OAuth/API key authentication
    class MyOAuthSpider(BaseOfficialApiSpider):
        name = 'my_oauth_spider'
        api_base_url = 'https://api.example.com/v1'
        auth_type = 'bearer'  # or 'api_key', 'oauth2'
        auth_token_env_var = 'MY_API_TOKEN'

        def start_requests(self):
            yield self.create_authenticated_request(
                url=f'{self.api_base_url}/tracks',
                callback=self.parse_tracks
            )
"""

import scrapy
import logging
import json
import os
import time
from typing import Optional, Dict, Any, List, Generator
from urllib.parse import urljoin, urlencode, parse_qs, urlparse
from datetime import datetime


logger = logging.getLogger(__name__)


class BaseNextPageSpider(scrapy.Spider):
    """
    Generic pagination spider with automatic "next" link following.

    Handles common pagination patterns where a "next page" link is present.
    Subclasses must implement parse_page_content() to extract data from each page.

    Class Attributes:
        next_link_selector (str): CSS selector for next page link
            Examples:
                'a.next-page::attr(href)'
                'link[rel="next"]::attr(href)'
                'a[aria-label="Next"]::attr(href)'

        next_link_xpath (str): Alternative XPath selector (if CSS fails)
            Example: '//a[@class="next-page"]/@href'

        max_pages (int): Maximum number of pages to scrape (None = unlimited)

        pagination_delay (float): Additional delay between page requests (seconds)

        stop_on_duplicate (bool): Stop pagination if duplicate content detected

    Methods to Override:
        parse_page_content(response): Extract items from current page

    Example:
        class MySpider(BaseNextPageSpider):
            name = 'paginated_spider'
            start_urls = ['https://example.com/tracks/page/1']
            next_link_selector = 'a.pagination-next::attr(href)'
            max_pages = 10

            def parse_page_content(self, response):
                for track in response.css('.track-item'):
                    yield {
                        'title': track.css('.title::text').get(),
                        'artist': track.css('.artist::text').get()
                    }
    """

    # Configuration attributes (override in subclasses)
    next_link_selector: Optional[str] = None
    next_link_xpath: Optional[str] = None
    max_pages: Optional[int] = None
    pagination_delay: float = 0.0
    stop_on_duplicate: bool = False

    def __init__(self, *args, **kwargs):
        """Initialize pagination tracking."""
        super().__init__(*args, **kwargs)
        self.pages_scraped = 0
        self.seen_urls = set()
        self.page_content_hashes = set()  # For duplicate detection

        # Validate configuration
        if not self.next_link_selector and not self.next_link_xpath:
            self.logger.warning(
                f"{self.__class__.__name__}: No next_link_selector or next_link_xpath configured. "
                "Pagination will not work automatically."
            )

    def parse(self, response):
        """
        Main parse method that handles both content extraction and pagination.

        Args:
            response: Scrapy Response object

        Yields:
            Items from parse_page_content() and next page requests
        """
        self.pages_scraped += 1
        current_page = self.pages_scraped

        self.logger.info(f"Parsing page {current_page}: {response.url}")

        # Check for duplicate content if enabled
        if self.stop_on_duplicate:
            content_hash = hash(response.text)
            if content_hash in self.page_content_hashes:
                self.logger.warning(
                    f"Duplicate content detected on page {current_page}. Stopping pagination."
                )
                return
            self.page_content_hashes.add(content_hash)

        # Extract content from current page
        try:
            yield from self.parse_page_content(response)
        except Exception as e:
            self.logger.error(f"Error parsing page content on {response.url}: {e}", exc_info=True)

        # Check if we've reached max pages
        if self.max_pages and current_page >= self.max_pages:
            self.logger.info(f"Reached max_pages limit ({self.max_pages}). Stopping pagination.")
            return

        # Find and follow next page link
        next_url = self._extract_next_page_url(response)

        if next_url:
            # Make URL absolute
            next_url = urljoin(response.url, next_url)

            # Check for duplicate URLs (circular pagination)
            if next_url in self.seen_urls:
                self.logger.warning(f"Circular pagination detected: {next_url}. Stopping.")
                return

            self.seen_urls.add(next_url)

            self.logger.info(f"Following next page: {next_url}")

            # Create next page request
            yield scrapy.Request(
                url=next_url,
                callback=self.parse,
                meta={
                    'page_number': current_page + 1,
                    'download_delay': self.pagination_delay,
                    **response.meta
                },
                dont_filter=False,
                errback=self.handle_pagination_error
            )
        else:
            self.logger.info(f"No next page found. Pagination complete after {current_page} pages.")

    def _extract_next_page_url(self, response) -> Optional[str]:
        """
        Extract next page URL using configured selectors.

        Args:
            response: Scrapy Response object

        Returns:
            Next page URL or None if not found
        """
        next_url = None

        # Try CSS selector first
        if self.next_link_selector:
            try:
                next_url = response.css(self.next_link_selector).get()
                if next_url:
                    self.logger.debug(f"Found next page URL via CSS selector: {next_url}")
                    return next_url.strip()
            except Exception as e:
                self.logger.debug(f"CSS selector failed: {e}")

        # Fallback to XPath
        if self.next_link_xpath:
            try:
                next_url = response.xpath(self.next_link_xpath).get()
                if next_url:
                    self.logger.debug(f"Found next page URL via XPath: {next_url}")
                    return next_url.strip()
            except Exception as e:
                self.logger.debug(f"XPath selector failed: {e}")

        return None

    def parse_page_content(self, response):
        """
        Extract items from current page.

        MUST be overridden by subclasses.

        Args:
            response: Scrapy Response object

        Yields:
            Scrapy Items or dicts
        """
        raise NotImplementedError(
            f"{self.__class__.__name__} must implement parse_page_content() method"
        )

    def handle_pagination_error(self, failure):
        """
        Handle errors during pagination.

        Args:
            failure: Twisted Failure object
        """
        self.logger.error(f"Pagination request failed: {failure.request.url} - {failure.value}")


class BaseJsonApiSpider(scrapy.Spider):
    """
    JSON API pagination handler for REST APIs with offset/limit or cursor-based pagination.

    Handles common JSON API pagination patterns including:
    - Offset/limit (e.g., ?offset=0&limit=50)
    - Cursor/next_url (e.g., response contains "next": "https://...")
    - Page number (e.g., ?page=1&per_page=50)

    Class Attributes:
        api_base_url (str): Base URL for API endpoint
            Example: 'https://api.example.com/v1/tracks'

        api_params (dict): Default query parameters
            Example: {'limit': 50, 'sort': 'created_at'}

        pagination_style (str): Type of pagination
            Options: 'offset', 'next_url', 'page_number'

        offset_param (str): Query parameter name for offset (default: 'offset')
        limit_param (str): Query parameter name for limit (default: 'limit')
        page_param (str): Query parameter name for page number (default: 'page')

        next_url_key (str): JSON key containing next page URL (default: 'next')
        results_key (str): JSON key containing results array (default: 'results')

        max_requests (int): Maximum number of API requests (None = unlimited)

        api_headers (dict): Additional HTTP headers for API requests

    Methods to Override:
        parse_api_response(response): Extract items from API response

    Example:
        class SpotifyApiSpider(BaseJsonApiSpider):
            name = 'spotify_api'
            api_base_url = 'https://api.spotify.com/v1/playlists/123/tracks'
            api_params = {'limit': 100}
            pagination_style = 'next_url'
            next_url_key = 'next'

            def parse_api_response(self, response):
                data = response.json()
                for item in data['items']:
                    yield {
                        'track_name': item['track']['name'],
                        'artist': item['track']['artists'][0]['name']
                    }
    """

    # Configuration attributes
    api_base_url: Optional[str] = None
    api_params: Dict[str, Any] = {}
    pagination_style: str = 'offset'  # 'offset', 'next_url', 'page_number'

    # Parameter names
    offset_param: str = 'offset'
    limit_param: str = 'limit'
    page_param: str = 'page'

    # Response keys
    next_url_key: str = 'next'
    results_key: str = 'results'

    max_requests: Optional[int] = None
    api_headers: Dict[str, str] = {}

    def __init__(self, *args, **kwargs):
        """Initialize API pagination tracking."""
        super().__init__(*args, **kwargs)
        self.api_requests_made = 0
        self.current_offset = 0
        self.current_page = 1

        # Validate configuration
        if not self.api_base_url:
            raise ValueError(
                f"{self.__class__.__name__}: api_base_url must be configured"
            )

        if self.pagination_style not in ['offset', 'next_url', 'page_number']:
            raise ValueError(
                f"Invalid pagination_style: {self.pagination_style}. "
                "Must be 'offset', 'next_url', or 'page_number'"
            )

    def start_requests(self):
        """
        Generate initial API request.

        Yields:
            First API request with configured parameters
        """
        # Build initial URL with parameters
        url = self._build_api_url(self.api_base_url, self.api_params)

        self.logger.info(f"Starting API requests with URL: {url}")

        yield scrapy.Request(
            url=url,
            callback=self.parse,
            headers=self.api_headers,
            meta={'api_request_number': 1},
            errback=self.handle_api_error
        )

    def parse(self, response):
        """
        Parse JSON API response and handle pagination.

        Args:
            response: Scrapy Response object

        Yields:
            Items from parse_api_response() and next API requests
        """
        self.api_requests_made += 1
        request_number = self.api_requests_made

        self.logger.info(f"Processing API request {request_number}: {response.url}")

        # Parse JSON response
        try:
            data = response.json()
        except json.JSONDecodeError as e:
            self.logger.error(f"Invalid JSON response from {response.url}: {e}")
            self.logger.debug(f"Response body: {response.text[:500]}")
            return

        # Extract items from response
        try:
            yield from self.parse_api_response(response)
        except Exception as e:
            self.logger.error(f"Error parsing API response: {e}", exc_info=True)

        # Check if we've reached max requests
        if self.max_requests and request_number >= self.max_requests:
            self.logger.info(f"Reached max_requests limit ({self.max_requests}). Stopping.")
            return

        # Determine next request based on pagination style
        next_request = self._create_next_api_request(response, data)

        if next_request:
            yield next_request
        else:
            self.logger.info(f"No more pages. API scraping complete after {request_number} requests.")

    def _build_api_url(self, base_url: str, params: Dict[str, Any]) -> str:
        """
        Build API URL with query parameters.

        Args:
            base_url: Base API endpoint URL
            params: Query parameters dict

        Returns:
            Complete URL with encoded parameters
        """
        if not params:
            return base_url

        query_string = urlencode(params)
        separator = '&' if '?' in base_url else '?'
        return f"{base_url}{separator}{query_string}"

    def _create_next_api_request(self, response, data: Dict) -> Optional[scrapy.Request]:
        """
        Create next API request based on pagination style.

        Args:
            response: Current Scrapy Response
            data: Parsed JSON data

        Returns:
            Next Scrapy Request or None if no more pages
        """
        if self.pagination_style == 'next_url':
            return self._handle_next_url_pagination(response, data)
        elif self.pagination_style == 'offset':
            return self._handle_offset_pagination(response, data)
        elif self.pagination_style == 'page_number':
            return self._handle_page_number_pagination(response, data)

        return None

    def _handle_next_url_pagination(self, response, data: Dict) -> Optional[scrapy.Request]:
        """Handle next_url style pagination."""
        next_url = data.get(self.next_url_key)

        if not next_url:
            return None

        self.logger.info(f"Following next_url: {next_url}")

        return scrapy.Request(
            url=next_url,
            callback=self.parse,
            headers=self.api_headers,
            meta={'api_request_number': self.api_requests_made + 1},
            errback=self.handle_api_error
        )

    def _handle_offset_pagination(self, response, data: Dict) -> Optional[scrapy.Request]:
        """Handle offset/limit style pagination."""
        # Extract results to check if there are more items
        results = data.get(self.results_key, [])

        if not results:
            self.logger.info("No results in response. Stopping pagination.")
            return None

        # Get limit from current request params
        current_params = parse_qs(urlparse(response.url).query)
        limit = int(current_params.get(self.limit_param, [50])[0])

        # If results count is less than limit, we've reached the end
        if len(results) < limit:
            self.logger.info(f"Received {len(results)} results (less than limit {limit}). No more pages.")
            return None

        # Increment offset
        self.current_offset += limit

        # Build next request with updated offset
        next_params = {**self.api_params, self.offset_param: self.current_offset}
        next_url = self._build_api_url(self.api_base_url, next_params)

        self.logger.info(f"Next offset: {self.current_offset}, URL: {next_url}")

        return scrapy.Request(
            url=next_url,
            callback=self.parse,
            headers=self.api_headers,
            meta={'api_request_number': self.api_requests_made + 1},
            errback=self.handle_api_error
        )

    def _handle_page_number_pagination(self, response, data: Dict) -> Optional[scrapy.Request]:
        """Handle page number style pagination."""
        # Extract results to check if there are more items
        results = data.get(self.results_key, [])

        if not results:
            return None

        # Increment page number
        self.current_page += 1

        # Build next request with updated page
        next_params = {**self.api_params, self.page_param: self.current_page}
        next_url = self._build_api_url(self.api_base_url, next_params)

        self.logger.info(f"Next page: {self.current_page}, URL: {next_url}")

        return scrapy.Request(
            url=next_url,
            callback=self.parse,
            headers=self.api_headers,
            meta={'api_request_number': self.api_requests_made + 1},
            errback=self.handle_api_error
        )

    def parse_api_response(self, response):
        """
        Extract items from API response.

        MUST be overridden by subclasses.

        Args:
            response: Scrapy Response object (call response.json() to get data)

        Yields:
            Scrapy Items or dicts
        """
        raise NotImplementedError(
            f"{self.__class__.__name__} must implement parse_api_response() method"
        )

    def handle_api_error(self, failure):
        """
        Handle API request errors.

        Args:
            failure: Twisted Failure object
        """
        self.logger.error(f"API request failed: {failure.request.url} - {failure.value}")


class BaseOfficialApiSpider(scrapy.Spider):
    """
    OAuth/API key authentication handler for official platform APIs.

    Manages API authentication including:
    - Bearer tokens (OAuth 2.0)
    - API keys (in headers or query params)
    - Basic authentication
    - Rate limiting awareness with automatic backoff
    - Token refresh (if refresh_callback implemented)

    Class Attributes:
        api_base_url (str): Base API URL
            Example: 'https://api.spotify.com/v1'

        auth_type (str): Authentication method
            Options: 'bearer', 'api_key', 'basic', 'oauth2'

        auth_token_env_var (str): Environment variable containing auth token
            Example: 'SPOTIFY_API_TOKEN'

        api_key_env_var (str): Environment variable containing API key
            Example: 'DISCOGS_API_KEY'

        api_key_header_name (str): Header name for API key (default: 'X-API-Key')
        api_key_query_param (str): Query param name for API key (default: 'api_key')

        use_api_key_in_header (bool): Place API key in header vs query param

        rate_limit_requests_per_second (float): Max requests per second
        rate_limit_requests_per_minute (float): Max requests per minute

        retry_on_rate_limit (bool): Automatically retry when rate limited
        max_rate_limit_retries (int): Max retry attempts for rate limits

    Methods to Override:
        parse_authenticated_response(response): Parse API response
        refresh_token() (optional): Refresh expired access token

    Example:
        class SpotifyOfficialSpider(BaseOfficialApiSpider):
            name = 'spotify_official'
            api_base_url = 'https://api.spotify.com/v1'
            auth_type = 'bearer'
            auth_token_env_var = 'SPOTIFY_ACCESS_TOKEN'
            rate_limit_requests_per_second = 10

            def start_requests(self):
                yield self.create_authenticated_request(
                    url=f'{self.api_base_url}/me/playlists',
                    callback=self.parse_playlists
                )

            def parse_playlists(self, response):
                data = response.json()
                for playlist in data['items']:
                    yield {'name': playlist['name']}
    """

    # API configuration
    api_base_url: Optional[str] = None
    auth_type: str = 'bearer'  # 'bearer', 'api_key', 'basic', 'oauth2'

    # Authentication credentials (from environment)
    auth_token_env_var: Optional[str] = None
    api_key_env_var: Optional[str] = None
    api_secret_env_var: Optional[str] = None

    # API key configuration
    api_key_header_name: str = 'X-API-Key'
    api_key_query_param: str = 'api_key'
    use_api_key_in_header: bool = True

    # Rate limiting
    rate_limit_requests_per_second: Optional[float] = None
    rate_limit_requests_per_minute: Optional[float] = None
    retry_on_rate_limit: bool = True
    max_rate_limit_retries: int = 3

    # Additional headers
    additional_headers: Dict[str, str] = {}

    def __init__(self, *args, **kwargs):
        """Initialize authentication and rate limiting."""
        super().__init__(*args, **kwargs)

        # Load credentials from environment
        self.auth_token = self._load_env_var(self.auth_token_env_var)
        self.api_key = self._load_env_var(self.api_key_env_var)
        self.api_secret = self._load_env_var(self.api_secret_env_var)

        # Validate authentication configuration
        if self.auth_type == 'bearer' and not self.auth_token:
            raise ValueError(
                f"{self.__class__.__name__}: Bearer auth requires auth_token_env_var to be set"
            )

        if self.auth_type == 'api_key' and not self.api_key:
            raise ValueError(
                f"{self.__class__.__name__}: API key auth requires api_key_env_var to be set"
            )

        # Rate limiting tracking
        self.request_timestamps: List[float] = []
        self.rate_limit_retry_counts: Dict[str, int] = {}

        self.logger.info(f"Initialized with auth_type: {self.auth_type}")

    def _load_env_var(self, var_name: Optional[str]) -> Optional[str]:
        """
        Load value from environment variable.

        Args:
            var_name: Environment variable name

        Returns:
            Variable value or None if not found
        """
        if not var_name:
            return None

        value = os.getenv(var_name)

        if value:
            self.logger.info(f"Loaded {var_name} from environment")
        else:
            self.logger.warning(f"Environment variable {var_name} not found")

        return value

    def create_authenticated_request(
        self,
        url: str,
        callback,
        method: str = 'GET',
        body: Optional[Dict] = None,
        **kwargs
    ) -> scrapy.Request:
        """
        Create Scrapy Request with authentication headers.

        Args:
            url: Request URL
            callback: Response callback function
            method: HTTP method (GET, POST, etc.)
            body: Request body for POST/PUT requests
            **kwargs: Additional Request parameters

        Returns:
            Authenticated Scrapy Request
        """
        # Build authentication headers
        headers = self._build_auth_headers()

        # Merge with additional headers
        headers.update(self.additional_headers)
        headers.update(kwargs.get('headers', {}))

        # Handle API key in query params
        if self.auth_type == 'api_key' and not self.use_api_key_in_header:
            url = self._add_api_key_to_url(url)

        # Wait for rate limit if needed
        self._wait_for_rate_limit()

        # Track request timestamp
        self.request_timestamps.append(time.time())

        # Build request
        request_kwargs = {
            'url': url,
            'callback': callback,
            'method': method,
            'headers': headers,
            'errback': self.handle_auth_error,
            **kwargs
        }

        if body:
            request_kwargs['body'] = json.dumps(body)
            headers['Content-Type'] = 'application/json'

        self.logger.debug(f"Creating authenticated {method} request: {url}")

        return scrapy.Request(**request_kwargs)

    def _build_auth_headers(self) -> Dict[str, str]:
        """
        Build authentication headers based on auth_type.

        Returns:
            Dict of authentication headers
        """
        headers = {}

        if self.auth_type == 'bearer':
            if self.auth_token:
                headers['Authorization'] = f'Bearer {self.auth_token}'

        elif self.auth_type == 'api_key':
            if self.use_api_key_in_header and self.api_key:
                headers[self.api_key_header_name] = self.api_key

        elif self.auth_type == 'basic':
            if self.api_key and self.api_secret:
                import base64
                credentials = f"{self.api_key}:{self.api_secret}"
                encoded = base64.b64encode(credentials.encode()).decode()
                headers['Authorization'] = f'Basic {encoded}'

        return headers

    def _add_api_key_to_url(self, url: str) -> str:
        """
        Add API key as query parameter to URL.

        Args:
            url: Base URL

        Returns:
            URL with API key parameter
        """
        separator = '&' if '?' in url else '?'
        return f"{url}{separator}{self.api_key_query_param}={self.api_key}"

    def _wait_for_rate_limit(self):
        """
        Wait if rate limit would be exceeded.

        Enforces rate_limit_requests_per_second and rate_limit_requests_per_minute.
        """
        current_time = time.time()

        # Clean old timestamps
        if self.rate_limit_requests_per_minute:
            cutoff = current_time - 60
            self.request_timestamps = [t for t in self.request_timestamps if t > cutoff]
        elif self.rate_limit_requests_per_second:
            cutoff = current_time - 1
            self.request_timestamps = [t for t in self.request_timestamps if t > cutoff]

        # Check per-second rate limit
        if self.rate_limit_requests_per_second:
            recent_requests = len([
                t for t in self.request_timestamps
                if current_time - t < 1.0
            ])

            if recent_requests >= self.rate_limit_requests_per_second:
                wait_time = 1.0 - (current_time - max(self.request_timestamps))
                if wait_time > 0:
                    self.logger.debug(f"Rate limit: waiting {wait_time:.2f}s")
                    time.sleep(wait_time)

        # Check per-minute rate limit
        if self.rate_limit_requests_per_minute:
            recent_requests = len([
                t for t in self.request_timestamps
                if current_time - t < 60.0
            ])

            if recent_requests >= self.rate_limit_requests_per_minute:
                wait_time = 60.0 - (current_time - min(self.request_timestamps))
                if wait_time > 0:
                    self.logger.debug(f"Rate limit: waiting {wait_time:.2f}s")
                    time.sleep(wait_time)

    def handle_auth_error(self, failure):
        """
        Handle authentication and rate limit errors.

        Args:
            failure: Twisted Failure object
        """
        request = failure.request

        if hasattr(failure.value, 'response'):
            response = failure.value.response
            status = response.status

            # Handle rate limiting (429 Too Many Requests)
            if status == 429 and self.retry_on_rate_limit:
                retry_count = self.rate_limit_retry_counts.get(request.url, 0)

                if retry_count < self.max_rate_limit_retries:
                    # Extract retry-after header if available
                    retry_after = response.headers.get('Retry-After', b'60').decode()
                    try:
                        wait_time = int(retry_after)
                    except ValueError:
                        wait_time = 60

                    self.logger.warning(
                        f"Rate limited (429). Retrying after {wait_time}s "
                        f"(attempt {retry_count + 1}/{self.max_rate_limit_retries})"
                    )

                    self.rate_limit_retry_counts[request.url] = retry_count + 1

                    # Wait and retry
                    time.sleep(wait_time)

                    return request.copy()
                else:
                    self.logger.error(
                        f"Max rate limit retries ({self.max_rate_limit_retries}) exceeded for {request.url}"
                    )

            # Handle authentication errors (401 Unauthorized)
            elif status == 401:
                self.logger.error(f"Authentication failed (401) for {request.url}")

                # Attempt token refresh if method is implemented
                if hasattr(self, 'refresh_token'):
                    try:
                        self.refresh_token()
                        self.logger.info("Token refreshed. Retrying request.")
                        return request.copy()
                    except Exception as e:
                        self.logger.error(f"Token refresh failed: {e}")

            # Handle forbidden (403)
            elif status == 403:
                self.logger.error(f"Access forbidden (403) for {request.url}")

        self.logger.error(f"Request failed: {failure.value}")

    def parse_authenticated_response(self, response):
        """
        Parse authenticated API response.

        Should be overridden by subclasses.

        Args:
            response: Scrapy Response object

        Yields:
            Scrapy Items or dicts
        """
        raise NotImplementedError(
            f"{self.__class__.__name__} should implement parse_authenticated_response() method"
        )

    def closed(self, reason):
        """Log statistics on spider close."""
        super().closed(reason)

        total_requests = len(self.request_timestamps)
        self.logger.info(f"Spider closed. Total authenticated requests: {total_requests}")

        if self.rate_limit_retry_counts:
            self.logger.info(f"Rate limit retries: {sum(self.rate_limit_retry_counts.values())}")


# Export all base spider classes
__all__ = [
    'BaseNextPageSpider',
    'BaseJsonApiSpider',
    'BaseOfficialApiSpider',
]
