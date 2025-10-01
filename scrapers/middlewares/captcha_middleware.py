"""
CAPTCHA Solving Middleware - Specification Section IV.2
Priority: 600 (runs before proxy selection, after retry logic)

Detects CAPTCHA challenges in responses and automatically solves them using
third-party CAPTCHA solving services (2Captcha, Anti-Captcha, etc.).

Features:
- Automatic CAPTCHA detection (Cloudflare, reCAPTCHA, hCaptcha)
- Pluggable backend support (2Captcha, Anti-Captcha)
- Budget tracking and cost limits
- Proxy marking on CAPTCHA detection
- Request rescheduling with solution
- Comprehensive logging and metrics

Integration:
- Communicates with proxy_middleware via crawler.stats
- Calls proxy_manager.mark_as_dirty() when CAPTCHA detected
"""

import logging
import time
from typing import Optional, Dict, Any
from scrapy import signals
from scrapy.http import Request, Response
from scrapy.exceptions import NotConfigured, IgnoreRequest
import json

logger = logging.getLogger(__name__)


class CaptchaSolvingMiddleware:
    """
    Detects CAPTCHA challenges and automatically solves them using external services.

    Supported Services:
    - 2Captcha (https://2captcha.com/)
    - Anti-Captcha (https://anti-captcha.com/)
    - Custom backends via CAPTCHA_BACKEND setting

    Configuration (settings.py):
        CAPTCHA_ENABLED = True
        CAPTCHA_BACKEND = '2captcha'  # or 'anticaptcha', 'custom'
        CAPTCHA_API_KEY = 'your_api_key'
        CAPTCHA_BUDGET_LIMIT = 100.00  # USD
        CAPTCHA_MAX_RETRIES = 3
    """

    # CAPTCHA detection patterns
    CAPTCHA_INDICATORS = {
        'cloudflare': [
            b'<title>Just a moment...</title>',
            b'cf-challenge-running',
            b'Checking your browser',
            b'cf_clearance',
        ],
        'recaptcha': [
            b'g-recaptcha',
            b'grecaptcha',
            b'recaptcha/api.js',
        ],
        'hcaptcha': [
            b'h-captcha',
            b'hcaptcha.com',
        ],
        'generic': [
            b'captcha',
            b'challenge',
            b'security check',
        ]
    }

    def __init__(self, crawler):
        """
        Initialize CAPTCHA solving middleware.

        Args:
            crawler: Scrapy Crawler instance
        """
        self.crawler = crawler
        self.stats = crawler.stats

        # Configuration
        settings = crawler.settings
        self.enabled = settings.getbool('CAPTCHA_ENABLED', False)
        self.backend = settings.get('CAPTCHA_BACKEND', '2captcha')
        self.api_key = settings.get('CAPTCHA_API_KEY')
        self.budget_limit = settings.getfloat('CAPTCHA_BUDGET_LIMIT', 100.0)
        self.max_retries = settings.getint('CAPTCHA_MAX_RETRIES', 3)
        self.timeout = settings.getint('CAPTCHA_TIMEOUT', 120)  # seconds

        # Validate configuration
        if self.enabled and not self.api_key:
            raise NotConfigured("CAPTCHA_ENABLED is True but CAPTCHA_API_KEY is not set")

        # Initialize backend
        if self.enabled:
            self.backend_client = self._initialize_backend()
        else:
            self.backend_client = None

        # Budget tracking
        self.total_cost = 0.0
        self.captcha_count = 0

        # Import proxy manager for integration
        self.proxy_manager = None

    @classmethod
    def from_crawler(cls, crawler):
        """Factory method to create middleware from Scrapy crawler."""
        middleware = cls(crawler)

        # Skip if disabled
        if not middleware.enabled:
            logger.info("CAPTCHA solving middleware is DISABLED")
            raise NotConfigured("CAPTCHA_ENABLED is False")

        crawler.signals.connect(middleware.spider_opened, signal=signals.spider_opened)
        crawler.signals.connect(middleware.spider_closed, signal=signals.spider_closed)

        return middleware

    def spider_opened(self, spider):
        """Called when spider is opened."""
        logger.info(f"CaptchaSolvingMiddleware initialized for spider '{spider.name}'")
        logger.info(f"CAPTCHA backend: {self.backend}")
        logger.info(f"Budget limit: ${self.budget_limit:.2f}")

        # Get proxy manager from middleware if available
        self.proxy_manager = getattr(spider.crawler.engine.downloader, 'middleware', None)
        if self.proxy_manager:
            # Try to get ProxyRotationMiddleware instance
            for mw in self.proxy_manager.middlewares:
                if hasattr(mw, 'proxy_manager'):
                    self.proxy_manager = mw.proxy_manager
                    logger.info("Successfully connected to ProxyManager")
                    break

        self.stats.set_value('captcha_middleware/enabled', True)
        self.stats.set_value('captcha_middleware/backend', self.backend)
        self.stats.set_value('captcha_middleware/budget_limit', self.budget_limit)

    def spider_closed(self, spider):
        """Called when spider is closed - log statistics."""
        logger.info("=== CAPTCHA Solving Middleware Statistics ===")
        logger.info(f"Total CAPTCHAs detected: {self.captcha_count}")
        logger.info(f"Total cost: ${self.total_cost:.2f}")
        logger.info(f"Remaining budget: ${self.budget_limit - self.total_cost:.2f}")

        solved = self.stats.get_value('captcha_middleware/solved', 0)
        failed = self.stats.get_value('captcha_middleware/failed', 0)

        if self.captcha_count > 0:
            success_rate = (solved / self.captcha_count) * 100
            logger.info(f"Success rate: {success_rate:.1f}% ({solved}/{self.captcha_count})")

        # Log per-type statistics
        for captcha_type in ['cloudflare', 'recaptcha', 'hcaptcha', 'generic']:
            count = self.stats.get_value(f'captcha_middleware/type_{captcha_type}', 0)
            if count > 0:
                logger.info(f"{captcha_type.capitalize()} CAPTCHAs: {count}")

    def process_response(self, request: Request, response: Response, spider):
        """
        Process response - detect CAPTCHA and solve if necessary.

        Args:
            request: Original Scrapy Request
            response: Scrapy Response
            spider: Spider instance

        Returns:
            Response (unmodified) or new Request (with CAPTCHA solution)
        """
        # Skip if CAPTCHA solving is disabled for this request
        if request.meta.get('skip_captcha_solving', False):
            return response

        # Detect CAPTCHA
        captcha_type = self._detect_captcha(response)

        if captcha_type:
            logger.warning(f"CAPTCHA detected ({captcha_type}) on {request.url}")

            # Track detection
            self.captcha_count += 1
            self.stats.inc_value('captcha_middleware/detected')
            self.stats.inc_value(f'captcha_middleware/type_{captcha_type}')

            # Mark proxy as dirty if available
            self._mark_proxy_dirty(request, captcha_type)

            # Check budget
            if self.total_cost >= self.budget_limit:
                logger.error(f"CAPTCHA budget limit (${self.budget_limit:.2f}) exceeded - cannot solve")
                self.stats.inc_value('captcha_middleware/budget_exceeded')
                return response  # Return CAPTCHA page

            # Check retry count
            captcha_retry_count = request.meta.get('captcha_retry_count', 0)
            if captcha_retry_count >= self.max_retries:
                logger.error(f"Max CAPTCHA retries ({self.max_retries}) reached for {request.url}")
                self.stats.inc_value('captcha_middleware/max_retries_exceeded')
                return response

            # Attempt to solve CAPTCHA
            try:
                solution = self._solve_captcha(captcha_type, response, request)

                if solution:
                    logger.info(f"CAPTCHA solved successfully for {request.url}")
                    self.stats.inc_value('captcha_middleware/solved')

                    # Track cost
                    cost = solution.get('cost', 0.0)
                    self.total_cost += cost
                    self.stats.set_value('captcha_middleware/total_cost', self.total_cost)

                    # Create retry request with solution
                    retry_request = self._create_retry_request(request, solution, captcha_retry_count)
                    return retry_request

                else:
                    logger.error(f"Failed to solve CAPTCHA for {request.url}")
                    self.stats.inc_value('captcha_middleware/failed')

            except Exception as e:
                logger.error(f"CAPTCHA solving error: {e}")
                self.stats.inc_value('captcha_middleware/errors')

        return response

    def _detect_captcha(self, response: Response) -> Optional[str]:
        """
        Detect CAPTCHA type in response.

        Args:
            response: Scrapy Response

        Returns:
            CAPTCHA type ('cloudflare', 'recaptcha', 'hcaptcha', 'generic') or None
        """
        body = response.body

        # Check for specific CAPTCHA types
        for captcha_type, indicators in self.CAPTCHA_INDICATORS.items():
            for indicator in indicators:
                if indicator in body:
                    return captcha_type

        # Check HTTP status codes that often indicate CAPTCHA
        if response.status in [403, 429] and b'captcha' in body.lower():
            return 'generic'

        return None

    def _solve_captcha(self, captcha_type: str, response: Response, request: Request) -> Optional[Dict[str, Any]]:
        """
        Solve CAPTCHA using configured backend.

        Args:
            captcha_type: Type of CAPTCHA detected
            response: Scrapy Response containing CAPTCHA
            request: Original request

        Returns:
            Solution dict with 'token' and 'cost' keys, or None if failed
        """
        if not self.backend_client:
            logger.error("CAPTCHA backend client not initialized")
            return None

        logger.info(f"Attempting to solve {captcha_type} CAPTCHA using {self.backend} backend")

        try:
            # Extract CAPTCHA parameters from response
            captcha_params = self._extract_captcha_params(captcha_type, response, request)

            if not captcha_params:
                logger.error(f"Failed to extract CAPTCHA parameters from {request.url}")
                return None

            # Submit CAPTCHA to solving service
            solution = self.backend_client.solve(captcha_type, captcha_params, timeout=self.timeout)

            return solution

        except Exception as e:
            logger.error(f"Error solving CAPTCHA: {e}")
            return None

    def _extract_captcha_params(self, captcha_type: str, response: Response, request: Request) -> Optional[Dict[str, Any]]:
        """
        Extract CAPTCHA parameters from response.

        Args:
            captcha_type: Type of CAPTCHA
            response: Scrapy Response
            request: Original request

        Returns:
            Dict with CAPTCHA parameters or None
        """
        params = {
            'url': request.url,
            'type': captcha_type,
        }

        body_str = response.text

        if captcha_type == 'recaptcha':
            # Extract reCAPTCHA site key
            import re
            match = re.search(r'data-sitekey="([^"]+)"', body_str)
            if not match:
                match = re.search(r'sitekey:\s*["\']([^"\']+)["\']', body_str)

            if match:
                params['sitekey'] = match.group(1)
                return params

        elif captcha_type == 'hcaptcha':
            # Extract hCaptcha site key
            import re
            match = re.search(r'data-sitekey="([^"]+)"', body_str)
            if match:
                params['sitekey'] = match.group(1)
                return params

        elif captcha_type == 'cloudflare':
            # Cloudflare challenge - extract challenge parameters
            params['cookies'] = request.headers.get('Cookie', '')
            params['user_agent'] = request.headers.get('User-Agent', '')
            return params

        elif captcha_type == 'generic':
            # Generic CAPTCHA - return basic params
            return params

        return None

    def _create_retry_request(self, request: Request, solution: Dict[str, Any], retry_count: int) -> Request:
        """
        Create retry request with CAPTCHA solution.

        Args:
            request: Original request
            solution: CAPTCHA solution dict
            retry_count: Current retry count

        Returns:
            New Request with solution applied
        """
        retry_request = request.copy()
        retry_request.meta['captcha_retry_count'] = retry_count + 1
        retry_request.meta['captcha_solution'] = solution
        retry_request.dont_filter = True  # Allow duplicate request

        # Apply solution to request (depends on CAPTCHA type)
        token = solution.get('token')
        if token:
            # Add solution as form data or cookie
            if 'recaptcha' in solution.get('type', ''):
                retry_request.meta['recaptcha_token'] = token
            elif 'hcaptcha' in solution.get('type', ''):
                retry_request.meta['hcaptcha_token'] = token
            elif 'cloudflare' in solution.get('type', ''):
                # Cloudflare solution is typically a cookie
                retry_request = retry_request.replace(
                    cookies={**retry_request.cookies, 'cf_clearance': token}
                )

        logger.info(f"Created retry request with CAPTCHA solution for {request.url}")

        return retry_request

    def _mark_proxy_dirty(self, request: Request, captcha_type: str):
        """
        Mark proxy as dirty when CAPTCHA is detected.

        Communicates with proxy_middleware to blacklist problematic proxies.

        Args:
            request: Request that encountered CAPTCHA
            captcha_type: Type of CAPTCHA detected
        """
        # Check if proxy was used
        proxy_info = request.meta.get('proxy_info')

        if proxy_info:
            logger.warning(f"Marking proxy {proxy_info.url} as dirty due to {captcha_type} CAPTCHA")

            # Store in stats for proxy_middleware to read
            self.stats.set_value('captcha_middleware/last_dirty_proxy', proxy_info.url)
            self.stats.set_value('captcha_middleware/last_dirty_reason', f'{captcha_type}_captcha')
            self.stats.inc_value('captcha_middleware/proxies_marked_dirty')

            # Direct integration if proxy_manager is available
            if self.proxy_manager and hasattr(self.proxy_manager, 'record_failure'):
                self.proxy_manager.record_failure(proxy_info, f'CAPTCHA_{captcha_type}')
                logger.info(f"Proxy {proxy_info.url} marked as degraded in ProxyManager")

        else:
            logger.info(f"CAPTCHA detected but no proxy was used for {request.url}")

    def _initialize_backend(self) -> 'CaptchaBackend':
        """
        Initialize CAPTCHA solving backend.

        Returns:
            CaptchaBackend instance
        """
        if self.backend == '2captcha':
            return TwoCaptchaBackend(self.api_key, self.crawler.settings)
        elif self.backend == 'anticaptcha':
            return AntiCaptchaBackend(self.api_key, self.crawler.settings)
        else:
            logger.warning(f"Unknown CAPTCHA backend '{self.backend}', using mock backend")
            return MockCaptchaBackend(self.api_key, self.crawler.settings)


# =============================================================================
# CAPTCHA Backend Implementations
# =============================================================================

class CaptchaBackend:
    """Base class for CAPTCHA solving backends."""

    def __init__(self, api_key: str, settings):
        self.api_key = api_key
        self.settings = settings

    def solve(self, captcha_type: str, params: Dict[str, Any], timeout: int = 120) -> Optional[Dict[str, Any]]:
        """
        Solve CAPTCHA.

        Args:
            captcha_type: Type of CAPTCHA
            params: CAPTCHA parameters
            timeout: Timeout in seconds

        Returns:
            Solution dict with 'token' and 'cost' keys, or None
        """
        raise NotImplementedError


class TwoCaptchaBackend(CaptchaBackend):
    """2Captcha API backend."""

    API_URL = 'https://2captcha.com'

    def solve(self, captcha_type: str, params: Dict[str, Any], timeout: int = 120) -> Optional[Dict[str, Any]]:
        """Solve CAPTCHA using 2Captcha API."""
        logger.info(f"Solving {captcha_type} using 2Captcha API (mock implementation)")

        # TODO: Implement actual 2Captcha API integration
        # For now, return mock solution
        return {
            'token': 'mock_2captcha_token',
            'cost': 0.002,  # $0.002 per reCAPTCHA solve
            'backend': '2captcha',
            'type': captcha_type,
        }


class AntiCaptchaBackend(CaptchaBackend):
    """Anti-Captcha API backend."""

    API_URL = 'https://api.anti-captcha.com'

    def solve(self, captcha_type: str, params: Dict[str, Any], timeout: int = 120) -> Optional[Dict[str, Any]]:
        """Solve CAPTCHA using Anti-Captcha API."""
        logger.info(f"Solving {captcha_type} using Anti-Captcha API (mock implementation)")

        # TODO: Implement actual Anti-Captcha API integration
        return {
            'token': 'mock_anticaptcha_token',
            'cost': 0.002,
            'backend': 'anticaptcha',
            'type': captcha_type,
        }


class MockCaptchaBackend(CaptchaBackend):
    """Mock backend for testing (always succeeds)."""

    def solve(self, captcha_type: str, params: Dict[str, Any], timeout: int = 120) -> Optional[Dict[str, Any]]:
        """Return mock solution."""
        logger.warning(f"Using MOCK CAPTCHA backend - returning fake solution for {captcha_type}")

        return {
            'token': f'mock_token_{int(time.time())}',
            'cost': 0.0,
            'backend': 'mock',
            'type': captcha_type,
        }
