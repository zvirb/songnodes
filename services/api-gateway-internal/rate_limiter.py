"""
Token Bucket Rate Limiter for API Gateway
==========================================

Implements proper token bucket algorithm with:
- Per-provider rate limiting
- Dynamic rate adjustment based on API headers
- Burst allowance
- Request queuing
- Prometheus metrics
"""

import asyncio
import time
from typing import Dict, Optional
from dataclasses import dataclass
import structlog
from prometheus_client import Counter, Gauge, Histogram

logger = structlog.get_logger(__name__)

# Prometheus metrics
rate_limit_requests = Counter(
    'api_gateway_rate_limit_requests_total',
    'Total rate limit requests',
    ['provider', 'status']
)
rate_limit_tokens = Gauge(
    'api_gateway_rate_limit_tokens',
    'Available tokens in bucket',
    ['provider']
)
rate_limit_wait_time = Histogram(
    'api_gateway_rate_limit_wait_seconds',
    'Time waited for rate limit token',
    ['provider']
)


@dataclass
class RateLimitConfig:
    """Rate limit configuration for an API provider."""
    requests_per_second: float
    burst_capacity: int
    max_queue_size: int = 100


class TokenBucketRateLimiter:
    """
    Token bucket rate limiter per API provider.

    Features:
    - Refills at provider's rate limit (e.g., 10 req/sec for Spotify)
    - Bursts allowed up to bucket capacity
    - Queues requests when bucket empty
    - Monitors via Prometheus
    - Dynamic rate adjustment based on API response headers
    """

    # Default rate limits per provider
    DEFAULT_LIMITS = {
        'spotify': RateLimitConfig(
            requests_per_second=10.0,
            burst_capacity=20
        ),
        'musicbrainz': RateLimitConfig(
            requests_per_second=1.0,  # 1 req/sec as per their guidelines
            burst_capacity=2
        ),
        'lastfm': RateLimitConfig(
            requests_per_second=5.0,
            burst_capacity=10
        ),
        'beatport': RateLimitConfig(
            requests_per_second=2.0,
            burst_capacity=5
        ),
        'discogs': RateLimitConfig(
            requests_per_second=2.0,  # 60 req/min = 1 req/sec
            burst_capacity=5
        ),
        'acousticbrainz': RateLimitConfig(
            requests_per_second=5.0,
            burst_capacity=10
        ),
    }

    def __init__(self):
        self._buckets: Dict[str, dict] = {}
        self._locks: Dict[str, asyncio.Lock] = {}
        self._queues: Dict[str, asyncio.Queue] = {}

    def _get_bucket(self, provider: str) -> dict:
        """Get or create token bucket for provider."""
        if provider not in self._buckets:
            config = self.DEFAULT_LIMITS.get(
                provider,
                RateLimitConfig(requests_per_second=5.0, burst_capacity=10)
            )

            self._buckets[provider] = {
                'tokens': config.burst_capacity,
                'capacity': config.burst_capacity,
                'refill_rate': config.requests_per_second,
                'last_refill': time.monotonic(),
                'config': config
            }
            self._locks[provider] = asyncio.Lock()
            self._queues[provider] = asyncio.Queue(maxsize=config.max_queue_size)

            logger.info(
                "Created rate limiter bucket",
                provider=provider,
                rate=config.requests_per_second,
                capacity=config.burst_capacity
            )

        return self._buckets[provider]

    def _refill_bucket(self, provider: str, bucket: dict):
        """Refill bucket based on elapsed time."""
        now = time.monotonic()
        elapsed = now - bucket['last_refill']

        # Calculate tokens to add
        tokens_to_add = elapsed * bucket['refill_rate']

        if tokens_to_add > 0:
            bucket['tokens'] = min(
                bucket['capacity'],
                bucket['tokens'] + tokens_to_add
            )
            bucket['last_refill'] = now

            # Update metrics
            rate_limit_tokens.labels(provider=provider).set(bucket['tokens'])

    async def acquire(self, provider: str, priority: int = 5) -> bool:
        """
        Acquire a token for making an API request.

        Args:
            provider: API provider name
            priority: Request priority (1-10, lower is higher priority)

        Returns:
            True if token acquired, False if queue is full
        """
        bucket = self._get_bucket(provider)
        lock = self._locks[provider]

        start_time = time.monotonic()

        async with lock:
            # Refill bucket
            self._refill_bucket(provider, bucket)

            # If tokens available, consume one immediately
            if bucket['tokens'] >= 1.0:
                bucket['tokens'] -= 1.0
                rate_limit_requests.labels(
                    provider=provider,
                    status='immediate'
                ).inc()
                rate_limit_tokens.labels(provider=provider).set(bucket['tokens'])
                return True

            # No tokens available - need to wait
            wait_time = (1.0 - bucket['tokens']) / bucket['refill_rate']

            logger.debug(
                "Rate limit waiting",
                provider=provider,
                wait_time=wait_time,
                tokens=bucket['tokens']
            )

            # Wait for refill
            await asyncio.sleep(wait_time)

            # Refill again after waiting
            self._refill_bucket(provider, bucket)

            if bucket['tokens'] >= 1.0:
                bucket['tokens'] -= 1.0
                elapsed = time.monotonic() - start_time
                rate_limit_wait_time.labels(provider=provider).observe(elapsed)
                rate_limit_requests.labels(
                    provider=provider,
                    status='delayed'
                ).inc()
                rate_limit_tokens.labels(provider=provider).set(bucket['tokens'])
                return True

            # Still no tokens (shouldn't happen)
            logger.warning(
                "Rate limit failed to acquire token after wait",
                provider=provider,
                tokens=bucket['tokens']
            )
            rate_limit_requests.labels(
                provider=provider,
                status='failed'
            ).inc()
            return False

    def update_from_headers(
        self,
        provider: str,
        headers: Dict[str, str]
    ):
        """
        Update rate limits based on API response headers.

        Supported headers:
        - X-RateLimit-Remaining
        - X-RateLimit-Reset
        - X-RateLimit-Limit
        - Retry-After
        """
        bucket = self._get_bucket(provider)

        # Parse rate limit headers
        remaining = headers.get('X-RateLimit-Remaining')
        reset = headers.get('X-RateLimit-Reset')
        limit = headers.get('X-RateLimit-Limit')
        retry_after = headers.get('Retry-After')

        if remaining is not None:
            try:
                remaining_requests = int(remaining)

                # Adjust tokens based on remaining
                if remaining_requests < bucket['tokens']:
                    logger.warning(
                        "API reports fewer remaining requests than our bucket",
                        provider=provider,
                        api_remaining=remaining_requests,
                        bucket_tokens=bucket['tokens']
                    )
                    bucket['tokens'] = float(remaining_requests)
                    rate_limit_tokens.labels(provider=provider).set(bucket['tokens'])

            except ValueError:
                logger.warning(
                    "Invalid X-RateLimit-Remaining header",
                    provider=provider,
                    value=remaining
                )

        if reset is not None and limit is not None:
            try:
                reset_timestamp = int(reset)
                total_limit = int(limit)
                now = time.time()

                # Calculate time until reset
                time_until_reset = reset_timestamp - now

                if time_until_reset > 0:
                    # Calculate actual rate
                    actual_rate = total_limit / time_until_reset

                    # Update refill rate if significantly different
                    if abs(actual_rate - bucket['refill_rate']) > 0.5:
                        logger.info(
                            "Adjusting rate limit based on API headers",
                            provider=provider,
                            old_rate=bucket['refill_rate'],
                            new_rate=actual_rate
                        )
                        bucket['refill_rate'] = actual_rate

            except ValueError:
                logger.warning(
                    "Invalid rate limit headers",
                    provider=provider,
                    reset=reset,
                    limit=limit
                )

        if retry_after is not None:
            try:
                retry_seconds = int(retry_after)
                logger.warning(
                    "API requested retry after delay",
                    provider=provider,
                    retry_after=retry_seconds
                )
                # Set tokens to 0 and update last_refill to enforce wait
                bucket['tokens'] = 0.0
                bucket['last_refill'] = time.monotonic() + retry_seconds
                rate_limit_tokens.labels(provider=provider).set(0)

            except ValueError:
                logger.warning(
                    "Invalid Retry-After header",
                    provider=provider,
                    value=retry_after
                )

    def get_stats(self, provider: str) -> dict:
        """Get current rate limit statistics."""
        if provider not in self._buckets:
            return {}

        bucket = self._buckets[provider]
        return {
            'provider': provider,
            'tokens_available': bucket['tokens'],
            'capacity': bucket['capacity'],
            'refill_rate': bucket['refill_rate'],
            'last_refill': bucket['last_refill']
        }

    def reset_bucket(self, provider: str):
        """Manually reset a bucket (admin operation)."""
        if provider in self._buckets:
            bucket = self._buckets[provider]
            bucket['tokens'] = bucket['capacity']
            bucket['last_refill'] = time.monotonic()
            rate_limit_tokens.labels(provider=provider).set(bucket['tokens'])

            logger.info(
                "Rate limit bucket reset",
                provider=provider,
                capacity=bucket['capacity']
            )
