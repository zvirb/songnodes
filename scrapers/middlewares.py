import random
import time
import logging
from scrapy.downloadermiddlewares.retry import RetryMiddleware
from scrapy.utils.response import response_status_message
from scrapy.core.downloader.handlers.http11 import TunnelError

logger = logging.getLogger(__name__)

class PoliteDownloaderMiddleware:
    """
    Middleware to ensure polite crawling with additional delays and request handling
    """

    def __init__(self):
        self.last_request_time = {}

    def process_request(self, request, spider):
        """Add random delay and headers for polite crawling"""

        # Add random user agents occasionally
        user_agents = [
            'SongNodes MixesDB Scraper/1.0 (+https://github.com/your-project/songnodes; contact@songnodes.com)',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        ]

        if random.random() < 0.1:  # 10% chance to rotate user agent
            request.headers['User-Agent'] = random.choice(user_agents)

        # Ensure minimum delay between requests to the same domain
        domain = request.url.split('/')[2]
        current_time = time.time()

        if domain in self.last_request_time:
            time_since_last = current_time - self.last_request_time[domain]
            min_delay = 4.0  # Respect robots.txt

            if time_since_last < min_delay:
                sleep_time = min_delay - time_since_last + random.uniform(0.5, 1.5)
                logger.info(f"Sleeping {sleep_time:.2f}s before request to {domain}")
                time.sleep(sleep_time)

        self.last_request_time[domain] = time.time()
        return None

    def process_response(self, request, response, spider):
        """Handle response and log status"""
        if response.status >= 400:
            logger.warning(f"HTTP {response.status} for {request.url}")

        return response

class EnhancedRetryMiddleware(RetryMiddleware):
    """
    Enhanced retry middleware with specific handling for MixesDB
    """

    def __init__(self, settings):
        super().__init__(settings)
        self.retry_http_codes = [500, 502, 503, 504, 522, 524, 408, 429, 403, 404]

    def retry(self, request, reason, spider):
        """Retry requests with exponential backoff"""
        retries = request.meta.get('retry_times', 0) + 1

        if retries <= self.max_retry_times:
            logger.warning(f"Retrying {request.url} (retry {retries}/{self.max_retry_times}): {reason}")

            # Exponential backoff with jitter
            delay = min(60, (2 ** retries) + random.uniform(1, 3))
            time.sleep(delay)

            retry_req = request.copy()
            retry_req.meta['retry_times'] = retries
            retry_req.dont_filter = True
            return retry_req
        else:
            logger.error(f"Gave up retrying {request.url} (failed {retries} times): {reason}")

    def process_response(self, request, response, spider):
        """Process response and determine if retry is needed"""
        if request.meta.get('dont_retry', False):
            return response

        if response.status in self.retry_http_codes:
            reason = response_status_message(response.status)
            return self.retry(request, reason, spider) or response

        # Check for specific error content
        if b"This website is inaccessible" in response.body:
            reason = "Website inaccessible message detected"
            return self.retry(request, reason, spider) or response

        if b"rate limit" in response.body.lower():
            reason = "Rate limit detected"
            logger.warning(f"Rate limit hit for {request.url}, backing off")
            time.sleep(30)  # Longer delay for rate limits
            return self.retry(request, reason, spider) or response

        return response

    def process_exception(self, request, exception, spider):
        """Handle exceptions during request processing"""
        if isinstance(exception, TunnelError):
            logger.warning(f"Tunnel error for {request.url}: {exception}")
            return self.retry(request, f"TunnelError: {exception}", spider)

        if "timeout" in str(exception).lower():
            logger.warning(f"Timeout error for {request.url}: {exception}")
            return self.retry(request, f"Timeout: {exception}", spider)

        return super().process_exception(request, exception, spider)

class RobotsTxtComplianceMiddleware:
    """
    Middleware to ensure compliance with robots.txt rules
    """

    def __init__(self):
        self.disallowed_paths = [
            '/db/',
            '/list-artist-content/',
            '/tools/',
            '/w/Special:',
            '/w/Category:',  # We'll allow categories but log them
        ]

    def process_request(self, request, spider):
        """Check if request complies with robots.txt"""
        url_path = request.url.split('mixesdb.com')[-1] if 'mixesdb.com' in request.url else ''

        # Check for disallowed paths
        for disallowed in self.disallowed_paths:
            if url_path.startswith(disallowed):
                if disallowed == '/w/Category:':
                    # Allow categories but log
                    logger.info(f"Accessing category page: {request.url}")
                else:
                    logger.warning(f"Blocking request to disallowed path: {request.url}")
                    return None

        return None