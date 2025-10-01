"""
Dynamic Header Middleware - Specification Section IV.3
Priority: 700 (runs after proxy selection, before HTTP layer)

Generates realistic, consistent browser headers based on User-Agent to avoid detection.
Each User-Agent string generates a complete set of matching HTTP headers that a real
browser of that type would send.

Features:
- User-Agent rotation from realistic pool
- Header consistency (Chrome UA → Chrome headers)
- Browser fingerprint completeness (sec-ch-ua, Accept, etc.)
- Disables default Scrapy UserAgentMiddleware
- Per-request header generation
"""

import logging
import random
from typing import Dict, Optional
from scrapy import signals
from scrapy.http import Request

logger = logging.getLogger(__name__)


class DynamicHeaderMiddleware:
    """
    Rotates User-Agent and generates consistent browser headers to avoid detection.

    This middleware ensures that all HTTP headers match the selected User-Agent,
    preventing fingerprinting mismatches that could reveal automated scraping.
    """

    # Realistic User-Agent pool (Chrome, Firefox, Safari, Edge - recent versions)
    USER_AGENTS = [
        # Chrome on Windows (most common)
        {
            'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'sec_ch_ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
            'sec_ch_ua_platform': '"Windows"',
            'browser': 'chrome'
        },
        {
            'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            'sec_ch_ua': '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
            'sec_ch_ua_platform': '"Windows"',
            'browser': 'chrome'
        },

        # Chrome on macOS
        {
            'user_agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'sec_ch_ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
            'sec_ch_ua_platform': '"macOS"',
            'browser': 'chrome'
        },

        # Firefox on Windows
        {
            'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
            'sec_ch_ua': None,  # Firefox doesn't send sec-ch-ua headers
            'sec_ch_ua_platform': None,
            'browser': 'firefox'
        },
        {
            'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0',
            'sec_ch_ua': None,
            'sec_ch_ua_platform': None,
            'browser': 'firefox'
        },

        # Firefox on macOS
        {
            'user_agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0',
            'sec_ch_ua': None,
            'sec_ch_ua_platform': None,
            'browser': 'firefox'
        },

        # Safari on macOS
        {
            'user_agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
            'sec_ch_ua': None,  # Safari doesn't send sec-ch-ua headers
            'sec_ch_ua_platform': None,
            'browser': 'safari'
        },
        {
            'user_agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
            'sec_ch_ua': None,
            'sec_ch_ua_platform': None,
            'browser': 'safari'
        },

        # Edge on Windows (Chromium-based)
        {
            'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
            'sec_ch_ua': '"Not_A Brand";v="8", "Chromium";v="120", "Microsoft Edge";v="120"',
            'sec_ch_ua_platform': '"Windows"',
            'browser': 'edge'
        },

        # Chrome on Linux
        {
            'user_agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'sec_ch_ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
            'sec_ch_ua_platform': '"Linux"',
            'browser': 'chrome'
        },
    ]

    def __init__(self, stats):
        """
        Initialize middleware.

        Args:
            stats: Scrapy stats collector for tracking header rotation
        """
        self.stats = stats
        self.request_count = 0

    @classmethod
    def from_crawler(cls, crawler):
        """Factory method to create middleware from Scrapy crawler."""
        middleware = cls(crawler.stats)
        crawler.signals.connect(middleware.spider_opened, signal=signals.spider_opened)
        crawler.signals.connect(middleware.spider_closed, signal=signals.spider_closed)
        return middleware

    def spider_opened(self, spider):
        """Called when spider is opened."""
        logger.info(f"DynamicHeaderMiddleware initialized for spider '{spider.name}'")
        logger.info(f"User-Agent pool size: {len(self.USER_AGENTS)}")
        self.stats.set_value('headers_middleware/user_agent_pool_size', len(self.USER_AGENTS))

    def spider_closed(self, spider):
        """Called when spider is closed - log statistics."""
        logger.info("=== Dynamic Header Middleware Statistics ===")
        logger.info(f"Total requests processed: {self.request_count}")

        # Log per-browser distribution
        for browser in ['chrome', 'firefox', 'safari', 'edge']:
            count = self.stats.get_value(f'headers_middleware/browser_{browser}', 0)
            if count > 0:
                logger.info(f"{browser.capitalize()} user-agents used: {count}")

    def process_request(self, request: Request, spider):
        """
        Process outgoing request - add dynamic headers based on User-Agent.

        Args:
            request: Scrapy Request object
            spider: Spider instance

        Returns:
            None (modifies request in-place)
        """
        # Skip if headers are explicitly disabled for this request
        if request.meta.get('skip_dynamic_headers', False):
            return None

        # Skip if User-Agent is already set with custom value
        if 'User-Agent' in request.headers and request.meta.get('custom_user_agent', False):
            logger.debug(f"Using custom User-Agent for {request.url}")
            return None

        # Select User-Agent configuration
        ua_config = self._select_user_agent(request)

        # Generate complete header set
        headers = self._generate_headers(ua_config, request)

        # Apply headers to request
        for key, value in headers.items():
            if value is not None:  # Skip None values (browser-specific exclusions)
                request.headers[key] = value

        # Track request
        self.request_count += 1
        self.stats.inc_value(f'headers_middleware/browser_{ua_config["browser"]}')

        logger.debug(f"Applied {ua_config['browser']} headers to {request.url}")

        return None

    def _select_user_agent(self, request: Request) -> Dict[str, Optional[str]]:
        """
        Select User-Agent configuration for request.

        Supports:
        - Random selection (default)
        - Sticky User-Agent per domain (via request.meta)
        - Explicit User-Agent selection

        Args:
            request: Scrapy Request object

        Returns:
            User-Agent configuration dict
        """
        # Check for explicit UA selection in request metadata
        if 'user_agent_type' in request.meta:
            ua_type = request.meta['user_agent_type']
            matching = [ua for ua in self.USER_AGENTS if ua['browser'] == ua_type]
            if matching:
                return random.choice(matching)

        # Check for sticky UA (same UA for entire domain)
        if request.meta.get('sticky_user_agent', False):
            domain = request.url.split('/')[2]  # Extract domain
            # Use deterministic selection based on domain hash
            index = hash(domain) % len(self.USER_AGENTS)
            return self.USER_AGENTS[index]

        # Default: random selection
        return random.choice(self.USER_AGENTS)

    def _generate_headers(self, ua_config: Dict[str, Optional[str]], request: Request) -> Dict[str, Optional[str]]:
        """
        Generate complete header set matching the User-Agent.

        Args:
            ua_config: User-Agent configuration dict
            request: Scrapy Request object

        Returns:
            Complete header dict
        """
        browser = ua_config['browser']

        # Base headers (common to all browsers)
        headers = {
            'User-Agent': ua_config['user_agent'],
            'Accept-Language': self._get_accept_language(),
            'Accept-Encoding': 'gzip, deflate, br',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
        }

        # Browser-specific headers
        if browser in ['chrome', 'edge']:
            # Chromium-based browsers
            headers.update({
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                'sec-ch-ua': ua_config['sec_ch_ua'],
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': ua_config['sec_ch_ua_platform'],
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Sec-Fetch-User': '?1',
            })

        elif browser == 'firefox':
            # Firefox-specific
            headers.update({
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Sec-Fetch-User': '?1',
            })
            # Firefox doesn't send sec-ch-ua headers

        elif browser == 'safari':
            # Safari-specific
            headers.update({
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            })
            # Safari doesn't send Sec-Fetch-* headers

        # Add Referer if this is not the first request in a chain
        if 'referer' in request.meta:
            headers['Referer'] = request.meta['referer']

        return headers

    def _get_accept_language(self) -> str:
        """
        Get realistic Accept-Language header with slight variation.

        Returns:
            Accept-Language header value
        """
        # Most common language preferences (slightly randomized)
        languages = [
            'en-US,en;q=0.9',
            'en-US,en;q=0.9,es;q=0.8',
            'en-GB,en;q=0.9,en-US;q=0.8',
            'en-US,en;q=0.9,fr;q=0.8',
            'en-US,en;q=0.9,de;q=0.8',
        ]
        return random.choice(languages)


class UserAgentRotationStats:
    """
    Helper class to track User-Agent rotation statistics across middlewares.

    Stores state in crawler.stats for cross-middleware access.
    """

    @staticmethod
    def record_user_agent(stats, user_agent: str, browser: str):
        """Record User-Agent usage in stats."""
        stats.inc_value('user_agent_rotation/total_requests')
        stats.inc_value(f'user_agent_rotation/browser_{browser}')
        stats.set_value('user_agent_rotation/last_user_agent', user_agent)

    @staticmethod
    def get_current_user_agent(stats) -> Optional[str]:
        """Get the last used User-Agent."""
        return stats.get_value('user_agent_rotation/last_user_agent')
