"""
Base API Adapter
================

Abstract base class for all API adapters.
"""

from abc import ABC, abstractmethod
from typing import Any, Dict, Optional
import aiohttp
import structlog

logger = structlog.get_logger(__name__)


class BaseAPIAdapter(ABC):
    """
    Base adapter for API providers.

    All adapters implement unified interface with automatic:
    - Rate limiting
    - Caching
    - Retries
    - Circuit breaker protection
    """

    def __init__(
        self,
        rate_limiter,
        cache_manager,
        circuit_breaker,
        retry_strategy,
        session: aiohttp.ClientSession
    ):
        """
        Initialize adapter.

        Args:
            rate_limiter: TokenBucketRateLimiter instance
            cache_manager: CacheManager instance
            circuit_breaker: CircuitBreaker instance
            retry_strategy: ExponentialBackoffRetry instance
            session: aiohttp ClientSession
        """
        self.rate_limiter = rate_limiter
        self.cache_manager = cache_manager
        self.circuit_breaker = circuit_breaker
        self.retry_strategy = retry_strategy
        self.session = session

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Return the provider name."""
        pass

    @property
    @abstractmethod
    def base_url(self) -> str:
        """Return the base URL for API requests."""
        pass

    async def _make_request(
        self,
        method: str,
        endpoint: str,
        params: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, Any]] = None,
        json_data: Optional[Dict[str, Any]] = None,
        timeout: int = 30
    ) -> Dict[str, Any]:
        """
        Make HTTP request with all gateway features.

        Args:
            method: HTTP method (GET, POST, etc.)
            endpoint: API endpoint path
            params: Query parameters
            headers: HTTP headers
            json_data: JSON body data
            timeout: Request timeout in seconds

        Returns:
            Response JSON data
        """
        url = f"{self.base_url}{endpoint}"

        async def _execute_request():
            # Acquire rate limit token
            await self.rate_limiter.acquire(self.provider_name)

            # Make request
            async with self.session.request(
                method=method,
                url=url,
                params=params,
                headers=headers,
                json=json_data,
                timeout=aiohttp.ClientTimeout(total=timeout)
            ) as response:
                # Update rate limiter from response headers
                self.rate_limiter.update_from_headers(
                    self.provider_name,
                    dict(response.headers)
                )

                # Check status code
                if response.status >= 400:
                    error = aiohttp.ClientResponseError(
                        request_info=response.request_info,
                        history=response.history,
                        status=response.status
                    )
                    error.status_code = response.status
                    error.headers = dict(response.headers)
                    raise error

                # Parse JSON response
                return await response.json()

        # Execute with retry strategy and circuit breaker
        result = await self.retry_strategy.execute_with_retry(
            lambda: self.circuit_breaker.call(_execute_request),
            provider=self.provider_name
        )

        return result

    async def _get_with_cache(
        self,
        data_type: str,
        params: Dict[str, Any],
        fetch_func,
        ttl_override: Optional[int] = None
    ) -> Any:
        """
        Get data with caching.

        Args:
            data_type: Type of data (e.g., 'track_metadata')
            params: Request parameters
            fetch_func: Async function to fetch data if not cached
            ttl_override: Optional TTL override

        Returns:
            Data from cache or API
        """
        # Try cache first
        cached = await self.cache_manager.get(
            self.provider_name,
            data_type,
            params
        )

        if cached is not None:
            return cached

        # Fetch from API
        data = await fetch_func()

        # Cache result
        await self.cache_manager.set(
            self.provider_name,
            data_type,
            params,
            data,
            ttl_override=ttl_override
        )

        return data
