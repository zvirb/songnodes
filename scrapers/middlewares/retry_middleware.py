"""
Enhanced Retry Middleware - Specification Section IV.1
Priority: 550 (runs first in middleware chain)

Extends Scrapy's default RetryMiddleware with intelligent retry strategies:
- Exponential backoff for rate limiting (429, 503)
- Custom retry logic per HTTP status code
- Integration with proxy rotation
- Request-specific retry configuration

Features:
- Exponential backoff: 2^n seconds (max 300s)
- Rate limit detection and handling
- Per-status-code retry strategies
- Configurable retry limits per request
- Comprehensive logging and metrics
"""

import logging
import time
from typing import Optional, Union
from scrapy import signals
from scrapy.http import Request, Response
from scrapy.exceptions import NotConfigured
from scrapy.downloadermiddlewares.retry import RetryMiddleware
from twisted.internet.error import (
    TimeoutError,
    DNSLookupError,
    ConnectionRefusedError,
    ConnectionDone,
    ConnectError,
    ConnectionLost,
    TCPTimedOutError,
)

logger = logging.getLogger(__name__)


class EnhancedRetryMiddleware(RetryMiddleware):
    """
    Enhanced retry middleware with exponential backoff and intelligent retry strategies.

    Extends Scrapy's built-in RetryMiddleware with:
    - Exponential backoff for rate limits
    - Custom handling per HTTP status code
    - Integration with proxy rotation
    - Request-specific retry configuration

    Configuration (settings.py):
        RETRY_ENABLED = True
        RETRY_TIMES = 5
        RETRY_HTTP_CODES = [500, 502, 503, 504, 522, 524, 408, 429, 403]
        RETRY_BACKOFF_ENABLED = True
        RETRY_BACKOFF_MAX_DELAY = 300  # seconds (5 minutes)
    """

    # HTTP status codes that indicate rate limiting
    RATE_LIMIT_CODES = [429, 503, 408]

    # HTTP status codes that indicate temporary failures
    TEMPORARY_FAILURE_CODES = [500, 502, 504, 522, 524]

    # HTTP status codes that indicate authentication/permission issues
    AUTH_CODES = [401, 403, 407]

    # Network exceptions that should trigger retry
    EXCEPTION_TYPES_TO_RETRY = (
        TimeoutError,
        DNSLookupError,
        ConnectionRefusedError,
        ConnectionDone,
        ConnectError,
        ConnectionLost,
        TCPTimedOutError,
    )

    def __init__(self, settings):
        """
        Initialize enhanced retry middleware.

        Args:
            settings: Scrapy settings
        """
        super().__init__(settings)

        # Enhanced retry configuration
        self.backoff_enabled = settings.getbool('RETRY_BACKOFF_ENABLED', True)
        self.backoff_max_delay = settings.getint('RETRY_BACKOFF_MAX_DELAY', 300)  # 5 minutes
        self.backoff_base = settings.getint('RETRY_BACKOFF_BASE', 2)  # Exponential base

        # Statistics
        self.stats = None
        self.retry_counts = {}  # Track retry attempts per URL

    @classmethod
    def from_crawler(cls, crawler):
        """Factory method to create middleware from Scrapy crawler."""
        # Check if retry is disabled
        if not crawler.settings.getbool('RETRY_ENABLED'):
            raise NotConfigured

        middleware = cls(crawler.settings)
        middleware.stats = crawler.stats

        # Connect signals
        crawler.signals.connect(middleware.spider_opened, signal=signals.spider_opened)
        crawler.signals.connect(middleware.spider_closed, signal=signals.spider_closed)

        return middleware

    def spider_opened(self, spider):
        """Called when spider is opened."""
        logger.info(f"EnhancedRetryMiddleware initialized for spider '{spider.name}'")
        logger.info(f"Max retry times: {self.max_retry_times}")
        logger.info(f"Retry HTTP codes: {self.retry_http_codes}")
        logger.info(f"Exponential backoff: {'ENABLED' if self.backoff_enabled else 'DISABLED'}")

        if self.stats:
            self.stats.set_value('retry_middleware/max_retry_times', self.max_retry_times)
            self.stats.set_value('retry_middleware/backoff_enabled', self.backoff_enabled)

    def spider_closed(self, spider):
        """Called when spider is closed - log statistics."""
        logger.info("=== Enhanced Retry Middleware Statistics ===")

        if self.stats:
            total_retries = self.stats.get_value('retry/count', 0)
            backoff_retries = self.stats.get_value('retry/backoff_count', 0)
            rate_limit_retries = self.stats.get_value('retry/rate_limit_count', 0)
            max_retries_exceeded = self.stats.get_value('retry/max_reached', 0)

            logger.info(f"Total retries: {total_retries}")
            logger.info(f"Backoff retries: {backoff_retries}")
            logger.info(f"Rate limit retries: {rate_limit_retries}")
            logger.info(f"Max retries exceeded: {max_retries_exceeded}")

            # Log per-status-code statistics
            for code in self.retry_http_codes:
                count = self.stats.get_value(f'retry/status_{code}', 0)
                if count > 0:
                    logger.info(f"Retries for HTTP {code}: {count}")

    def process_response(self, request: Request, response: Response, spider):
        """
        Process response - retry if status code indicates failure.

        Args:
            request: Original Scrapy Request
            response: Scrapy Response
            spider: Spider instance

        Returns:
            Response (success) or new Request (retry)
        """
        # Check if response status should trigger retry
        if request.meta.get('dont_retry', False):
            return response

        if response.status in self.retry_http_codes:
            # Determine retry strategy based on status code
            reason = self._get_retry_reason(response.status)

            # Check if this is a rate limit response
            is_rate_limit = response.status in self.RATE_LIMIT_CODES

            # Attempt retry with appropriate strategy
            retry_request = self._retry(
                request=request,
                reason=reason,
                spider=spider,
                status_code=response.status,
                is_rate_limit=is_rate_limit,
            )

            if retry_request:
                return retry_request

        return response

    def process_exception(self, request: Request, exception: Exception, spider):
        """
        Process exception - retry network errors.

        Args:
            request: Original Scrapy Request
            exception: Exception that occurred
            spider: Spider instance

        Returns:
            None (no retry) or new Request (retry)
        """
        if isinstance(exception, self.EXCEPTION_TYPES_TO_RETRY) and not request.meta.get('dont_retry', False):
            reason = f'{exception.__class__.__name__}'

            retry_request = self._retry(
                request=request,
                reason=reason,
                spider=spider,
                exception=exception,
            )

            if retry_request:
                return retry_request

        return None

    def _retry(
        self,
        request: Request,
        reason: str,
        spider,
        status_code: Optional[int] = None,
        is_rate_limit: bool = False,
        exception: Optional[Exception] = None,
    ) -> Optional[Request]:
        """
        Create retry request with enhanced logic.

        Args:
            request: Original request
            reason: Retry reason
            spider: Spider instance
            status_code: HTTP status code (if response retry)
            is_rate_limit: Whether this is a rate limit retry
            exception: Exception (if exception retry)

        Returns:
            New Request or None (max retries exceeded)
        """
        # Get retry count
        retry_times = request.meta.get('retry_times', 0) + 1
        max_retry_times = request.meta.get('max_retry_times', self.max_retry_times)

        # Check if max retries exceeded
        if retry_times > max_retry_times:
            logger.warning(
                f"Max retry times ({max_retry_times}) reached for {request.url} - Reason: {reason}"
            )

            if self.stats:
                self.stats.inc_value('retry/max_reached')

            return None

        # Calculate backoff delay
        delay = self._calculate_backoff_delay(retry_times, is_rate_limit)

        # Log retry
        logger.info(
            f"Retrying {request.url} (attempt {retry_times}/{max_retry_times}) "
            f"- Reason: {reason} - Delay: {delay:.1f}s"
        )

        # Track statistics
        if self.stats:
            self.stats.inc_value('retry/count')
            if status_code:
                self.stats.inc_value(f'retry/status_{status_code}')
            if is_rate_limit:
                self.stats.inc_value('retry/rate_limit_count')
            if delay > 0:
                self.stats.inc_value('retry/backoff_count')

        # Create retry request
        retry_request = request.copy()
        retry_request.meta['retry_times'] = retry_times
        retry_request.meta['retry_reason'] = reason
        retry_request.dont_filter = True  # Allow duplicate

        # Add backoff delay if enabled
        if delay > 0:
            retry_request.meta['download_slot_delay'] = delay

        # Mark that proxy should be rotated on retry (if using proxy middleware)
        if status_code in self.RATE_LIMIT_CODES or status_code in self.AUTH_CODES:
            retry_request.meta['rotate_proxy'] = True

        return retry_request

    def _calculate_backoff_delay(self, retry_count: int, is_rate_limit: bool) -> float:
        """
        Calculate exponential backoff delay.

        Formula: min(base^retry_count, max_delay)

        Args:
            retry_count: Current retry attempt number
            is_rate_limit: Whether this is a rate limit retry (longer backoff)

        Returns:
            Delay in seconds
        """
        if not self.backoff_enabled:
            return 0.0

        # Calculate exponential backoff
        delay = self.backoff_base ** retry_count

        # Double delay for rate limits
        if is_rate_limit:
            delay *= 2

        # Apply max delay cap
        delay = min(delay, self.backoff_max_delay)

        return float(delay)

    def _get_retry_reason(self, status_code: int) -> str:
        """
        Get human-readable retry reason for status code.

        Args:
            status_code: HTTP status code

        Returns:
            Retry reason string
        """
        reasons = {
            429: 'Rate limit exceeded',
            503: 'Service unavailable',
            408: 'Request timeout',
            500: 'Internal server error',
            502: 'Bad gateway',
            504: 'Gateway timeout',
            522: 'Connection timed out',
            524: 'Timeout occurred',
            403: 'Forbidden (possible rate limit)',
            401: 'Unauthorized',
            407: 'Proxy authentication required',
        }

        return reasons.get(status_code, f'HTTP {status_code}')


class RetryStats:
    """
    Helper class to track retry statistics across middlewares.

    Stores state in crawler.stats for cross-middleware visibility.
    """

    @staticmethod
    def record_retry(stats, url: str, reason: str, retry_count: int):
        """Record retry attempt in stats."""
        stats.inc_value('retry/total_retries')
        stats.set_value('retry/last_retry_url', url)
        stats.set_value('retry/last_retry_reason', reason)
        stats.set_value('retry/last_retry_count', retry_count)

    @staticmethod
    def get_retry_count(stats, url: str) -> int:
        """Get retry count for URL."""
        return stats.get_value(f'retry/url_{hash(url)}', 0)

    @staticmethod
    def increment_retry_count(stats, url: str):
        """Increment retry count for URL."""
        stats.inc_value(f'retry/url_{hash(url)}')
