"""
Scrapy Proxy Middleware
Integrates ProxyManager with Scrapy for automatic proxy rotation and user agent management.
"""
import time
import logging
from typing import Optional
from scrapy import signals
from scrapy.http import Request, Response
from scrapy.exceptions import IgnoreRequest
from twisted.internet.error import TimeoutError, ConnectionRefusedError, DNSLookupError

# Import our proxy manager
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(__file__)))
from proxy_manager import ProxyManager, UserAgentRotator, ProxyInfo

logger = logging.getLogger(__name__)


class ProxyRotationMiddleware:
    """
    Scrapy middleware for automatic proxy rotation with health checking.

    Features:
    - Automatic proxy selection and rotation
    - Request retry with different proxy on failure
    - Performance-based proxy selection
    - Statistics tracking
    """

    def __init__(self, proxy_manager: ProxyManager, user_agent_rotator: UserAgentRotator):
        self.proxy_manager = proxy_manager
        self.user_agent_rotator = user_agent_rotator
        self.stats = {
            'requests_with_proxy': 0,
            'requests_without_proxy': 0,
            'proxy_failures': 0,
            'proxy_successes': 0
        }

    @classmethod
    def from_crawler(cls, crawler):
        """Factory method to create middleware from Scrapy crawler"""

        # Get proxy configuration from settings
        proxy_list = crawler.settings.get('PROXY_LIST', [])
        enable_proxies = crawler.settings.getbool('ENABLE_PROXIES', False)
        proxy_strategy = crawler.settings.get('PROXY_STRATEGY', 'performance')

        # Initialize proxy manager
        proxy_manager = ProxyManager(
            proxies=proxy_list if enable_proxies else [],
            health_check_interval=crawler.settings.getint('PROXY_HEALTH_CHECK_INTERVAL', 300),
            max_consecutive_failures=crawler.settings.getint('PROXY_MAX_FAILURES', 3),
            cooldown_period=crawler.settings.getint('PROXY_COOLDOWN_PERIOD', 600),
            enable_health_checks=crawler.settings.getbool('PROXY_ENABLE_HEALTH_CHECKS', True)
        )

        # Initialize user agent rotator
        ua_strategy = crawler.settings.get('USER_AGENT_STRATEGY', 'random')
        user_agent_rotator = UserAgentRotator(strategy=ua_strategy)

        # Create middleware instance
        middleware = cls(proxy_manager, user_agent_rotator)

        # Connect signals
        crawler.signals.connect(middleware.spider_opened, signal=signals.spider_opened)
        crawler.signals.connect(middleware.spider_closed, signal=signals.spider_closed)

        return middleware

    def spider_opened(self, spider):
        """Called when spider is opened"""
        logger.info(f"ProxyRotationMiddleware initialized for spider '{spider.name}'")
        logger.info(f"Proxy pool size: {len(self.proxy_manager.proxies)}")

        # Start health checks if enabled
        if self.proxy_manager.enable_health_checks:
            spider.crawler.engine.loop.create_task(
                self.proxy_manager.start_health_checks()
            )

    def spider_closed(self, spider):
        """Called when spider is closed"""
        # Stop health checks
        spider.crawler.engine.loop.create_task(
            self.proxy_manager.stop_health_checks()
        )

        # Log statistics
        logger.info("=== Proxy Middleware Statistics ===")
        logger.info(f"Requests with proxy: {self.stats['requests_with_proxy']}")
        logger.info(f"Requests without proxy: {self.stats['requests_without_proxy']}")
        logger.info(f"Proxy successes: {self.stats['proxy_successes']}")
        logger.info(f"Proxy failures: {self.stats['proxy_failures']}")

        proxy_stats = self.proxy_manager.get_statistics()
        logger.info(f"Overall proxy success rate: {proxy_stats['overall_success_rate']:.2%}")

    def process_request(self, request: Request, spider):
        """
        Process outgoing request.

        Adds proxy and rotates user agent if enabled.
        """
        # Skip if proxy is already set
        if 'proxy' in request.meta:
            return None

        # Check if proxies should be used for this request
        use_proxy = request.meta.get('use_proxy', True)

        if use_proxy and self.proxy_manager.proxies:
            # Select proxy
            proxy_strategy = request.meta.get('proxy_strategy', 'performance')
            proxy = self.proxy_manager.select_proxy(strategy=proxy_strategy)

            if proxy:
                # Set proxy
                request.meta['proxy'] = proxy.proxy_url
                request.meta['proxy_info'] = proxy
                request.meta['request_start_time'] = time.time()

                self.stats['requests_with_proxy'] += 1

                logger.debug(f"Using proxy {proxy.url} for {request.url}")
            else:
                logger.warning("No healthy proxies available, proceeding without proxy")
                self.stats['requests_without_proxy'] += 1
        else:
            self.stats['requests_without_proxy'] += 1

        # Rotate user agent
        user_agent = self.user_agent_rotator.get_user_agent()
        request.headers['User-Agent'] = user_agent

        return None

    def process_response(self, request: Request, response: Response, spider):
        """
        Process response.

        Records proxy success metrics.
        """
        # Check if request used proxy
        if 'proxy_info' in request.meta:
            proxy = request.meta['proxy_info']
            response_time = time.time() - request.meta['request_start_time']

            # Check if response indicates success
            if 200 <= response.status < 400:
                self.proxy_manager.record_success(proxy, response_time)
                self.stats['proxy_successes'] += 1
                logger.debug(f"Proxy {proxy.url} success ({response_time:.2f}s)")
            else:
                self.proxy_manager.record_failure(proxy, f"HTTP {response.status}")
                self.stats['proxy_failures'] += 1

                # Retry with different proxy if configured
                if request.meta.get('retry_with_new_proxy', False):
                    return self._retry_with_new_proxy(request, spider, f"HTTP {response.status}")

        return response

    def process_exception(self, request: Request, exception, spider):
        """
        Process request exception.

        Retries with different proxy on network errors.
        """
        # Check if request used proxy
        if 'proxy_info' in request.meta:
            proxy = request.meta['proxy_info']
            error_msg = str(exception)

            # Record failure
            self.proxy_manager.record_failure(proxy, error_msg)
            self.stats['proxy_failures'] += 1

            logger.warning(f"Proxy {proxy.url} failed: {error_msg}")

            # Retry with different proxy for network errors
            if isinstance(exception, (TimeoutError, ConnectionRefusedError, DNSLookupError)):
                return self._retry_with_new_proxy(request, spider, error_msg)

        return None

    def _retry_with_new_proxy(self, request: Request, spider, reason: str):
        """
        Retry request with a different proxy.

        Args:
            request: Original request
            spider: Spider instance
            reason: Reason for retry

        Returns:
            New request or None
        """
        retry_count = request.meta.get('proxy_retry_count', 0)
        max_retries = request.meta.get('max_proxy_retries', 3)

        if retry_count >= max_retries:
            logger.error(f"Max proxy retries ({max_retries}) reached for {request.url}")
            return None

        # Select new proxy
        new_proxy = self.proxy_manager.select_proxy(strategy='performance')

        if not new_proxy:
            logger.error(f"No alternative proxy available for retry")
            return None

        # Create retry request
        logger.info(f"Retrying {request.url} with proxy {new_proxy.url} (attempt {retry_count + 1}/{max_retries})")

        retry_request = request.copy()
        retry_request.meta['proxy'] = new_proxy.proxy_url
        retry_request.meta['proxy_info'] = new_proxy
        retry_request.meta['proxy_retry_count'] = retry_count + 1
        retry_request.meta['request_start_time'] = time.time()
        retry_request.dont_filter = True

        return retry_request


class UserAgentMiddleware:
    """
    Simple user agent rotation middleware.

    Use this if you only need user agent rotation without proxy support.
    """

    def __init__(self, user_agent_rotator: UserAgentRotator):
        self.user_agent_rotator = user_agent_rotator

    @classmethod
    def from_crawler(cls, crawler):
        """Factory method to create middleware from Scrapy crawler"""
        ua_strategy = crawler.settings.get('USER_AGENT_STRATEGY', 'random')
        user_agent_rotator = UserAgentRotator(strategy=ua_strategy)
        return cls(user_agent_rotator)

    def process_request(self, request: Request, spider):
        """Add rotated user agent to request"""
        # Skip if User-Agent already set
        if 'User-Agent' in request.headers:
            return None

        user_agent = self.user_agent_rotator.get_user_agent()
        request.headers['User-Agent'] = user_agent

        return None