"""
Base API Client with Integrated Resilience Patterns
===================================================

Abstract base class for all external API clients with built-in:
- Redis caching
- Token bucket rate limiting
- Circuit breaker protection
- Retry with exponential backoff
- Comprehensive logging and metrics

All provider-specific clients (Spotify, MusicBrainz, etc.) should inherit from this class.

Architecture Pattern: Template Method + Composition
Reference: Blueprint Section "The API Integration Gateway"
"""

import requests
import logging
import time
from typing import Dict, Optional, Any, Callable
from abc import ABC, abstractmethod
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from prometheus_client import Counter, Histogram, Gauge

from .cache_manager import CacheManager
from .rate_limiter import RateLimiter, RateLimitExceeded
from .circuit_breaker import CircuitBreaker, CircuitBreakerOpenError, CircuitState

logger = logging.getLogger(__name__)

# Prometheus Metrics - Module-level definitions
api_gateway_requests_total = Counter(
    'api_gateway_requests_total',
    'Total number of API gateway requests',
    ['provider', 'endpoint', 'status']
)

api_gateway_request_duration_seconds = Histogram(
    'api_gateway_request_duration_seconds',
    'API gateway request duration in seconds',
    ['provider', 'endpoint'],
    buckets=(0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0)
)

api_gateway_retry_attempts_total = Counter(
    'api_gateway_retry_attempts_total',
    'Total number of retry attempts',
    ['provider', 'error_type']
)

api_gateway_retry_success_total = Counter(
    'api_gateway_retry_success_total',
    'Total number of successful retries',
    ['provider']
)

api_gateway_retry_failures_total = Counter(
    'api_gateway_retry_failures_total',
    'Total number of failed retries after all attempts',
    ['provider']
)


class BaseAPIClient(ABC):
    """
    Abstract base class for API clients with comprehensive resilience patterns.

    Subclasses must implement:
    - _get_base_url(): Return API base URL
    - _get_default_headers(): Return default request headers
    - _handle_response(): Parse and validate API responses
    """

    def __init__(
        self,
        provider_name: str,
        cache_manager: CacheManager,
        rate_limiter: RateLimiter,
        circuit_breaker: CircuitBreaker,
        timeout: int = 10
    ):
        """
        Initialize API client with resilience components.

        Args:
            provider_name: Unique provider identifier (e.g., 'spotify')
            cache_manager: Shared cache manager instance
            rate_limiter: Shared rate limiter instance
            circuit_breaker: Circuit breaker for this provider
            timeout: Default request timeout in seconds
        """
        self.provider_name = provider_name
        self.cache_manager = cache_manager
        self.rate_limiter = rate_limiter
        self.circuit_breaker = circuit_breaker
        self.timeout = timeout

        # Create HTTP session with connection pooling and retry logic
        self.session = self._create_session()

        # Statistics
        self.stats = {
            'requests_total': 0,
            'requests_successful': 0,
            'requests_failed': 0,
            'cache_hits': 0,
            'cache_misses': 0,
            'rate_limited': 0,
            'circuit_breaker_opens': 0,
        }

        logger.info(f"{self.provider_name.title()} API Client initialized")

    @abstractmethod
    def _get_base_url(self) -> str:
        """Return the base URL for this API."""
        pass

    @abstractmethod
    def _get_default_headers(self) -> Dict[str, str]:
        """Return default headers for API requests."""
        pass

    @abstractmethod
    def _handle_response(self, response: requests.Response) -> Dict[str, Any]:
        """
        Parse and validate API response.

        Args:
            response: HTTP response object

        Returns:
            Parsed response data

        Raises:
            ValueError: If response is invalid
            requests.HTTPError: If HTTP error occurred
        """
        pass

    def _create_session(self) -> requests.Session:
        """
        Create HTTP session with connection pooling and automatic retries.

        Implements retry strategy for transient HTTP errors (500, 502, 503, 504).
        """
        session = requests.Session()

        # Configure automatic retries for transient errors
        # Reference: Blueprint Section "Handling Transient Failures"
        retry_strategy = Retry(
            total=3,  # Maximum 3 retries
            backoff_factor=1,  # Exponential backoff: 1s, 2s, 4s
            status_forcelist=[500, 502, 503, 504],  # Retry on server errors
            allowed_methods=["GET", "POST"],  # Only retry safe methods
            raise_on_status=False  # Don't raise on retry exhaustion
        )

        adapter = HTTPAdapter(
            max_retries=retry_strategy,
            pool_connections=10,  # Connection pool size
            pool_maxsize=20
        )

        session.mount("http://", adapter)
        session.mount("https://", adapter)

        return session

    def _make_request(
        self,
        method: str,
        endpoint: str,
        params: Optional[Dict] = None,
        json_data: Optional[Dict] = None,
        headers: Optional[Dict] = None,
        cache_key: Optional[str] = None,
        cache_ttl: Optional[int] = None,
        use_cache: bool = True,
        use_rate_limit: bool = True,
        use_circuit_breaker: bool = True
    ) -> Dict[str, Any]:
        """
        Make HTTP request with full resilience stack.

        Flow:
        1. Check cache (if enabled)
        2. Acquire rate limit token (if enabled)
        3. Execute through circuit breaker (if enabled)
        4. Make HTTP request with auto-retry
        5. Handle response and store in cache
        6. Adjust rate limiter based on headers

        Args:
            method: HTTP method (GET, POST, etc.)
            endpoint: API endpoint path (relative to base URL)
            params: URL query parameters
            json_data: JSON request body
            headers: Additional request headers
            cache_key: Cache key (if None, caching disabled for this request)
            cache_ttl: Cache TTL in seconds (None = use default)
            use_cache: Enable caching
            use_rate_limit: Enable rate limiting
            use_circuit_breaker: Enable circuit breaker

        Returns:
            Parsed API response

        Raises:
            CircuitBreakerOpenError: If circuit breaker is OPEN
            RateLimitExceeded: If rate limit exceeded (non-blocking mode)
            requests.RequestException: If HTTP request fails
        """
        # Start timing for latency metrics
        start_time = time.time()
        status = 'unknown'

        self.stats['requests_total'] += 1

        try:
            # Step 1: Check cache
            if use_cache and cache_key:
                cached = self._check_cache(cache_key)
                if cached is not None:
                    self.stats['cache_hits'] += 1
                    status = 'cache_hit'
                    api_gateway_requests_total.labels(
                        provider=self.provider_name,
                        endpoint=endpoint,
                        status=status
                    ).inc()
                    return cached
                self.stats['cache_misses'] += 1

            # Step 2: Acquire rate limit token
            if use_rate_limit:
                try:
                    self.rate_limiter.acquire(self.provider_name, blocking=True, timeout=30)
                except RateLimitExceeded as e:
                    self.stats['rate_limited'] += 1
                    status = 'rate_limited'
                    logger.error(f"{self.provider_name}: Rate limit exceeded - {e}")
                    raise

            # Step 3: Prepare request
            url = f"{self._get_base_url()}{endpoint}"
            request_headers = {**self._get_default_headers(), **(headers or {})}

            # Step 4: Execute through circuit breaker
            def _execute_request():
                response = self.session.request(
                    method=method,
                    url=url,
                    params=params,
                    json=json_data,
                    headers=request_headers,
                    timeout=self.timeout
                )

                # Check for rate limiting (429)
                if response.status_code == 429:
                    retry_after = response.headers.get('Retry-After', '60')
                    logger.warning(
                        f"{self.provider_name}: Rate limited (429) - retry after {retry_after}s"
                    )
                    # Track retry attempt
                    api_gateway_retry_attempts_total.labels(
                        provider=self.provider_name,
                        error_type='rate_limit_429'
                    ).inc()

                    # Adjust rate limiter dynamically
                    self.rate_limiter.adjust_from_headers(self.provider_name, response.headers)
                    response.raise_for_status()

                # Raise for other HTTP errors
                response.raise_for_status()

                return response

            try:
                if use_circuit_breaker:
                    response = self.circuit_breaker.call(_execute_request)
                else:
                    response = _execute_request()

                # Step 5: Parse response
                parsed_data = self._handle_response(response)

                # Step 6: Adjust rate limiter based on headers
                self.rate_limiter.adjust_from_headers(self.provider_name, response.headers)

                # Step 7: Store in cache
                if use_cache and cache_key and parsed_data:
                    self._store_cache(cache_key, parsed_data, ttl=cache_ttl)

                self.stats['requests_successful'] += 1
                status = 'success'
                api_gateway_retry_success_total.labels(provider=self.provider_name).inc()

                return parsed_data

            except CircuitBreakerOpenError as e:
                self.stats['circuit_breaker_opens'] += 1
                status = 'circuit_breaker_open'
                logger.error(f"{self.provider_name}: Circuit breaker OPEN - {e}")
                raise

            except requests.RequestException as e:
                self.stats['requests_failed'] += 1
                status = 'error'
                error_type = type(e).__name__

                # Track retry attempts for various error types
                api_gateway_retry_attempts_total.labels(
                    provider=self.provider_name,
                    error_type=error_type
                ).inc()
                api_gateway_retry_failures_total.labels(provider=self.provider_name).inc()

                logger.error(f"{self.provider_name}: Request failed - {error_type}: {e}")
                raise

        finally:
            # Record request duration and total count
            duration = time.time() - start_time
            api_gateway_request_duration_seconds.labels(
                provider=self.provider_name,
                endpoint=endpoint
            ).observe(duration)

            if status != 'cache_hit':  # Already counted for cache hits
                api_gateway_requests_total.labels(
                    provider=self.provider_name,
                    endpoint=endpoint,
                    status=status
                ).inc()

    def _check_cache(self, cache_key: str) -> Optional[Dict[str, Any]]:
        """Check cache for existing response."""
        try:
            cached = self.cache_manager.redis.get(cache_key)
            if cached:
                import json
                logger.debug(f"{self.provider_name}: Cache HIT - {cache_key}")
                return json.loads(cached)
        except Exception as e:
            logger.warning(f"{self.provider_name}: Cache read error - {e}")
        return None

    def _store_cache(self, cache_key: str, data: Dict[str, Any], ttl: Optional[int] = None):
        """Store response in cache."""
        try:
            import json
            self.cache_manager.redis.setex(
                cache_key,
                ttl or self.cache_manager.default_ttl,
                json.dumps(data)
            )
            logger.debug(f"{self.provider_name}: Cache WRITE - {cache_key}")
        except Exception as e:
            logger.warning(f"{self.provider_name}: Cache write error - {e}")

    def get_stats(self) -> Dict[str, Any]:
        """Get client statistics for monitoring."""
        return {
            'provider': self.provider_name,
            **self.stats,
            'circuit_breaker': self.circuit_breaker.get_stats(),
            'cache_hit_ratio': (
                self.stats['cache_hits'] / (self.stats['cache_hits'] + self.stats['cache_misses'])
                if (self.stats['cache_hits'] + self.stats['cache_misses']) > 0 else 0.0
            )
        }

    def close(self):
        """Close HTTP session and release resources."""
        if self.session:
            self.session.close()
            logger.info(f"{self.provider_name}: HTTP session closed")
