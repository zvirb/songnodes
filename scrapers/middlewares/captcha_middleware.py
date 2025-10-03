"""
CAPTCHA Solving Middleware - Specification Section IV.2
Priority: 600 (runs before proxy selection, after retry logic)

Detects CAPTCHA challenges in responses and automatically solves them using
FREE self-hosted Ollama vision models (default) or paid services (legacy).

Features:
- Automatic CAPTCHA detection (Cloudflare, reCAPTCHA, hCaptcha)
- FREE Ollama backend using local LLM (NO COST, privacy-preserving)
- Legacy paid backend support (2Captcha, Anti-Captcha - deprecated)
- Budget tracking and cost limits (for paid backends only)
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

# Import FREE Ollama backend (default)
try:
    from .ollama_captcha_solver import OllamaCaptchaBackend
    OLLAMA_AVAILABLE = True
except ImportError:
    OLLAMA_AVAILABLE = False
    logger.warning("Ollama CAPTCHA solver not available - install with: pip install pillow requests")

logger = logging.getLogger(__name__)


class CaptchaSolvingMiddleware:
    """
    Detects CAPTCHA challenges and automatically solves them using FREE Ollama or paid services.

    Supported Backends:
    - **Ollama (DEFAULT, FREE)**: Self-hosted LLM with vision capabilities
    - 2Captcha (LEGACY, PAID): ~$0.002 per solve (https://2captcha.com/)
    - Anti-Captcha (LEGACY, PAID): ~$0.002 per solve (https://anti-captcha.com/)

    Configuration (settings.py):
        # FREE Ollama backend (recommended)
        CAPTCHA_ENABLED = False  # Set to True to enable
        CAPTCHA_BACKEND = 'ollama'  # FREE, self-hosted
        OLLAMA_URL = 'http://ollama:11434'  # Optional, auto-detected

        # Legacy paid backends (deprecated)
        # CAPTCHA_BACKEND = '2captcha'
        # CAPTCHA_API_KEY = 'your_api_key'
        # CAPTCHA_BUDGET_LIMIT = 100.00

        # Common settings
        CAPTCHA_MAX_RETRIES = 3
        CAPTCHA_TIMEOUT = 120
        CAPTCHA_MIN_CONFIDENCE = 0.6  # For Ollama backend
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
        self.backend = settings.get('CAPTCHA_BACKEND', 'ollama')  # Default to FREE Ollama
        self.api_key = settings.get('CAPTCHA_API_KEY')  # Only for paid backends
        self.budget_limit = settings.getfloat('CAPTCHA_BUDGET_LIMIT', 100.0)
        self.max_retries = settings.getint('CAPTCHA_MAX_RETRIES', 3)
        self.timeout = settings.getint('CAPTCHA_TIMEOUT', 120)  # seconds
        self.min_confidence = settings.getfloat('CAPTCHA_MIN_CONFIDENCE', 0.6)  # For Ollama

        # Validate configuration
        if self.enabled:
            if self.backend == 'ollama':
                # Ollama doesn't need API key
                if not OLLAMA_AVAILABLE:
                    raise NotConfigured("Ollama backend not available. Install dependencies: pip install pillow requests")
            elif self.backend in ['2captcha', 'anticaptcha']:
                # Paid backends require API key
                if not self.api_key:
                    raise NotConfigured(f"CAPTCHA_BACKEND is '{self.backend}' but CAPTCHA_API_KEY is not set")
                logger.warning(
                    f"⚠️  Using PAID CAPTCHA backend '{self.backend}'. "
                    f"Consider using FREE 'ollama' backend instead (CAPTCHA_BACKEND='ollama')"
                )

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

        Priority:
        1. Ollama (FREE, self-hosted) - RECOMMENDED
        2. 2Captcha (PAID, legacy) - DEPRECATED
        3. Anti-Captcha (PAID, legacy) - DEPRECATED
        4. Mock (testing only)

        Returns:
            CaptchaBackend instance
        """
        if self.backend == 'ollama':
            logger.info("✓ Initializing FREE Ollama CAPTCHA backend (cost: $0)")
            return OllamaCaptchaBackend(None, self.crawler.settings)

        # Legacy paid backends (deprecated)
        elif self.backend == '2captcha':
            logger.warning("⚠️  Using LEGACY PAID backend: 2Captcha (~$0.002/solve)")
            logger.warning("💡 Switch to FREE Ollama: Set CAPTCHA_BACKEND='ollama'")
            return TwoCaptchaBackend(self.api_key, self.crawler.settings)

        elif self.backend == 'anticaptcha':
            logger.warning("⚠️  Using LEGACY PAID backend: Anti-Captcha (~$0.002/solve)")
            logger.warning("💡 Switch to FREE Ollama: Set CAPTCHA_BACKEND='ollama'")
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
    """
    2Captcha API backend - Production implementation.

    Supports:
    - reCAPTCHA v2 (~$0.002/solve)
    - reCAPTCHA v3 (~$0.003/solve)
    - hCaptcha (~$0.002/solve)
    - FunCaptcha (~$0.002/solve)
    - Normal CAPTCHA (~$0.001/solve)

    API Documentation: https://2captcha.com/2captcha-api
    """

    API_SUBMIT_URL = 'https://2captcha.com/in.php'
    API_RESULT_URL = 'https://2captcha.com/res.php'

    # Pricing per CAPTCHA type (USD)
    PRICING = {
        'recaptcha': 0.002,
        'recaptcha_v3': 0.003,
        'hcaptcha': 0.002,
        'funcaptcha': 0.002,
        'cloudflare': 0.003,
        'generic': 0.001,
    }

    def __init__(self, api_key: str, settings):
        super().__init__(api_key, settings)
        self.fallback_provider = settings.get('CAPTCHA_FALLBACK_PROVIDER', 'anticaptcha')
        self.fallback_api_key = settings.get('CAPTCHA_FALLBACK_API_KEY')

    def solve(self, captcha_type: str, params: Dict[str, Any], timeout: int = 120) -> Optional[Dict[str, Any]]:
        """Solve CAPTCHA using 2Captcha API with fallback support."""
        import requests

        logger.info(f"Solving {captcha_type} CAPTCHA using 2Captcha API")

        try:
            # Validate API key
            if not self.api_key or self.api_key == 'your_2captcha_api_key_here':
                logger.error("2Captcha API key not configured")
                return self._try_fallback(captcha_type, params, timeout)

            # Submit CAPTCHA to 2Captcha
            captcha_id = self._submit_captcha(captcha_type, params)

            if not captcha_id:
                logger.error("Failed to submit CAPTCHA to 2Captcha")
                return self._try_fallback(captcha_type, params, timeout)

            # Poll for result with exponential backoff
            token = self._poll_result(captcha_id, timeout)

            if token:
                cost = self.PRICING.get(captcha_type, 0.002)
                logger.info(f"2Captcha solved successfully (cost: ${cost:.4f})")

                return {
                    'token': token,
                    'cost': cost,
                    'backend': '2captcha',
                    'type': captcha_type,
                }
            else:
                logger.error("2Captcha failed to solve CAPTCHA within timeout")
                return self._try_fallback(captcha_type, params, timeout)

        except Exception as e:
            logger.error(f"2Captcha error: {e}")
            return self._try_fallback(captcha_type, params, timeout)

    def _submit_captcha(self, captcha_type: str, params: Dict[str, Any]) -> Optional[str]:
        """Submit CAPTCHA to 2Captcha API."""
        import requests

        # Build request data based on CAPTCHA type
        data = {
            'key': self.api_key,
            'json': 1,  # Return JSON response
        }

        if captcha_type == 'recaptcha':
            data['method'] = 'userrecaptcha'
            data['googlekey'] = params.get('sitekey')
            data['pageurl'] = params.get('url')
            data['version'] = 'v2'

        elif captcha_type == 'recaptcha_v3':
            data['method'] = 'userrecaptcha'
            data['googlekey'] = params.get('sitekey')
            data['pageurl'] = params.get('url')
            data['version'] = 'v3'
            data['action'] = params.get('action', 'verify')
            data['min_score'] = params.get('min_score', 0.3)

        elif captcha_type == 'hcaptcha':
            data['method'] = 'hcaptcha'
            data['sitekey'] = params.get('sitekey')
            data['pageurl'] = params.get('url')

        elif captcha_type == 'cloudflare':
            data['method'] = 'turnstile'
            data['sitekey'] = params.get('sitekey', 'cloudflare')
            data['pageurl'] = params.get('url')

        else:
            logger.warning(f"Unsupported CAPTCHA type '{captcha_type}' for 2Captcha")
            return None

        try:
            response = requests.post(self.API_SUBMIT_URL, data=data, timeout=30)
            result = response.json()

            if result.get('status') == 1:
                captcha_id = result.get('request')
                logger.info(f"CAPTCHA submitted to 2Captcha, ID: {captcha_id}")
                return captcha_id
            else:
                error_msg = result.get('request', 'Unknown error')
                logger.error(f"2Captcha submission failed: {error_msg}")

                # Check for specific errors
                if 'ERROR_ZERO_BALANCE' in error_msg:
                    logger.error("2Captcha account has insufficient balance")
                elif 'ERROR_WRONG_USER_KEY' in error_msg:
                    logger.error("Invalid 2Captcha API key")
                elif 'ERROR_KEY_DOES_NOT_EXIST' in error_msg:
                    logger.error("2Captcha API key does not exist")

                return None

        except requests.exceptions.Timeout:
            logger.error("2Captcha submission timed out")
            return None
        except Exception as e:
            logger.error(f"2Captcha submission error: {e}")
            return None

    def _poll_result(self, captcha_id: str, timeout: int) -> Optional[str]:
        """Poll 2Captcha for CAPTCHA solution with exponential backoff."""
        import requests
        import time

        start_time = time.time()
        delay = 5  # Start with 5 second delay
        max_delay = 30  # Cap at 30 seconds

        while time.time() - start_time < timeout:
            try:
                response = requests.get(
                    self.API_RESULT_URL,
                    params={
                        'key': self.api_key,
                        'action': 'get',
                        'id': captcha_id,
                        'json': 1,
                    },
                    timeout=10
                )

                result = response.json()

                if result.get('status') == 1:
                    # Success - return token
                    token = result.get('request')
                    logger.info(f"2Captcha solved in {time.time() - start_time:.1f}s")
                    return token

                elif result.get('request') == 'CAPCHA_NOT_READY':
                    # Still processing - wait and retry
                    logger.debug(f"2Captcha still processing, waiting {delay}s...")
                    time.sleep(delay)

                    # Exponential backoff
                    delay = min(delay * 1.5, max_delay)

                else:
                    # Error occurred
                    error_msg = result.get('request', 'Unknown error')
                    logger.error(f"2Captcha result error: {error_msg}")

                    if 'ERROR_CAPTCHA_UNSOLVABLE' in error_msg:
                        logger.error("2Captcha reports CAPTCHA is unsolvable")
                        return None

                    # Continue polling for other errors
                    time.sleep(delay)

            except requests.exceptions.Timeout:
                logger.warning("2Captcha result check timed out, retrying...")
                time.sleep(delay)
            except Exception as e:
                logger.error(f"2Captcha polling error: {e}")
                time.sleep(delay)

        logger.error(f"2Captcha timeout after {timeout}s")
        return None

    def _try_fallback(self, captcha_type: str, params: Dict[str, Any], timeout: int) -> Optional[Dict[str, Any]]:
        """Try fallback CAPTCHA provider if configured."""
        if not self.fallback_api_key or self.fallback_provider == 'none':
            logger.info("No fallback CAPTCHA provider configured")
            return None

        logger.info(f"Trying fallback provider: {self.fallback_provider}")

        if self.fallback_provider == 'anticaptcha':
            fallback = AntiCaptchaBackend(self.fallback_api_key, self.settings)
            return fallback.solve(captcha_type, params, timeout)

        return None


class AntiCaptchaBackend(CaptchaBackend):
    """
    Anti-Captcha API backend - Production implementation.

    Supports:
    - reCAPTCHA v2 (~$0.002/solve)
    - reCAPTCHA v3 (~$0.003/solve)
    - hCaptcha (~$0.002/solve)
    - FunCaptcha (~$0.002/solve)
    - Cloudflare Turnstile (~$0.003/solve)

    API Documentation: https://anti-captcha.com/apidoc
    """

    API_URL = 'https://api.anti-captcha.com'

    # Pricing per CAPTCHA type (USD)
    PRICING = {
        'recaptcha': 0.002,
        'recaptcha_v3': 0.003,
        'hcaptcha': 0.002,
        'funcaptcha': 0.002,
        'cloudflare': 0.003,
        'generic': 0.001,
    }

    def solve(self, captcha_type: str, params: Dict[str, Any], timeout: int = 120) -> Optional[Dict[str, Any]]:
        """Solve CAPTCHA using Anti-Captcha API."""
        import requests

        logger.info(f"Solving {captcha_type} CAPTCHA using Anti-Captcha API")

        try:
            # Validate API key
            if not self.api_key or self.api_key == 'your_anticaptcha_api_key_here':
                logger.error("Anti-Captcha API key not configured")
                return None

            # Create task
            task_id = self._create_task(captcha_type, params)

            if not task_id:
                logger.error("Failed to create Anti-Captcha task")
                return None

            # Poll for result with exponential backoff
            token = self._poll_result(task_id, timeout)

            if token:
                cost = self.PRICING.get(captcha_type, 0.002)
                logger.info(f"Anti-Captcha solved successfully (cost: ${cost:.4f})")

                return {
                    'token': token,
                    'cost': cost,
                    'backend': 'anticaptcha',
                    'type': captcha_type,
                }
            else:
                logger.error("Anti-Captcha failed to solve CAPTCHA within timeout")
                return None

        except Exception as e:
            logger.error(f"Anti-Captcha error: {e}")
            return None

    def _create_task(self, captcha_type: str, params: Dict[str, Any]) -> Optional[int]:
        """Create CAPTCHA task in Anti-Captcha API."""
        import requests

        # Build task data based on CAPTCHA type
        task_data = None

        if captcha_type == 'recaptcha':
            task_data = {
                'type': 'NoCaptchaTaskProxyless',
                'websiteURL': params.get('url'),
                'websiteKey': params.get('sitekey'),
            }

        elif captcha_type == 'recaptcha_v3':
            task_data = {
                'type': 'RecaptchaV3TaskProxyless',
                'websiteURL': params.get('url'),
                'websiteKey': params.get('sitekey'),
                'minScore': params.get('min_score', 0.3),
                'pageAction': params.get('action', 'verify'),
            }

        elif captcha_type == 'hcaptcha':
            task_data = {
                'type': 'HCaptchaTaskProxyless',
                'websiteURL': params.get('url'),
                'websiteKey': params.get('sitekey'),
            }

        elif captcha_type == 'cloudflare':
            task_data = {
                'type': 'TurnstileTaskProxyless',
                'websiteURL': params.get('url'),
                'websiteKey': params.get('sitekey', 'cloudflare'),
            }

        else:
            logger.warning(f"Unsupported CAPTCHA type '{captcha_type}' for Anti-Captcha")
            return None

        # Submit task
        try:
            response = requests.post(
                f'{self.API_URL}/createTask',
                json={
                    'clientKey': self.api_key,
                    'task': task_data,
                },
                timeout=30
            )

            result = response.json()

            if result.get('errorId') == 0:
                task_id = result.get('taskId')
                logger.info(f"Anti-Captcha task created, ID: {task_id}")
                return task_id
            else:
                error_code = result.get('errorCode', 'Unknown')
                error_msg = result.get('errorDescription', 'Unknown error')
                logger.error(f"Anti-Captcha task creation failed: {error_code} - {error_msg}")

                # Check for specific errors
                if error_code == 'ERROR_ZERO_BALANCE':
                    logger.error("Anti-Captcha account has insufficient balance")
                elif error_code == 'ERROR_KEY_DOES_NOT_EXIST':
                    logger.error("Invalid Anti-Captcha API key")

                return None

        except requests.exceptions.Timeout:
            logger.error("Anti-Captcha task creation timed out")
            return None
        except Exception as e:
            logger.error(f"Anti-Captcha task creation error: {e}")
            return None

    def _poll_result(self, task_id: int, timeout: int) -> Optional[str]:
        """Poll Anti-Captcha for task result with exponential backoff."""
        import requests
        import time

        start_time = time.time()
        delay = 5  # Start with 5 second delay
        max_delay = 30  # Cap at 30 seconds

        while time.time() - start_time < timeout:
            try:
                response = requests.post(
                    f'{self.API_URL}/getTaskResult',
                    json={
                        'clientKey': self.api_key,
                        'taskId': task_id,
                    },
                    timeout=10
                )

                result = response.json()

                if result.get('errorId') == 0:
                    status = result.get('status')

                    if status == 'ready':
                        # Success - extract token
                        solution = result.get('solution', {})
                        token = solution.get('gRecaptchaResponse') or solution.get('token')

                        if token:
                            logger.info(f"Anti-Captcha solved in {time.time() - start_time:.1f}s")
                            return token
                        else:
                            logger.error("Anti-Captcha returned empty solution")
                            return None

                    elif status == 'processing':
                        # Still processing - wait and retry
                        logger.debug(f"Anti-Captcha still processing, waiting {delay}s...")
                        time.sleep(delay)

                        # Exponential backoff
                        delay = min(delay * 1.5, max_delay)

                    else:
                        logger.error(f"Anti-Captcha unknown status: {status}")
                        time.sleep(delay)

                else:
                    # Error occurred
                    error_code = result.get('errorCode', 'Unknown')
                    error_msg = result.get('errorDescription', 'Unknown error')
                    logger.error(f"Anti-Captcha result error: {error_code} - {error_msg}")
                    return None

            except requests.exceptions.Timeout:
                logger.warning("Anti-Captcha result check timed out, retrying...")
                time.sleep(delay)
            except Exception as e:
                logger.error(f"Anti-Captcha polling error: {e}")
                time.sleep(delay)

        logger.error(f"Anti-Captcha timeout after {timeout}s")
        return None


class MockCaptchaBackend(CaptchaBackend):
    """
    Mock backend for testing only (NOT for production use).

    WARNING: This backend is deprecated and should only be used for development/testing.
    Production deployments MUST use real CAPTCHA solving services.
    """

    def solve(self, captcha_type: str, params: Dict[str, Any], timeout: int = 120) -> Optional[Dict[str, Any]]:
        """Return mock solution."""
        logger.warning(
            f"⚠️  SECURITY WARNING: Using MOCK CAPTCHA backend for {captcha_type}. "
            "This is NOT suitable for production! Configure a real CAPTCHA service."
        )

        # Only allow in development/testing environments
        if self.settings.get('CAPTCHA_ALLOW_MOCK', False):
            return {
                'token': f'mock_token_{int(time.time())}',
                'cost': 0.0,
                'backend': 'mock',
                'type': captcha_type,
            }
        else:
            logger.error("Mock CAPTCHA backend disabled in production. Set CAPTCHA_ALLOW_MOCK=True to enable (NOT RECOMMENDED)")
            return None
