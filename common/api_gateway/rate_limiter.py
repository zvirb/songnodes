"""
Token Bucket Rate Limiter for API Gateway
==========================================

Implements proactive client-side rate limiting to prevent hitting API quotas.

Key Features:
- Token bucket algorithm for smooth rate limiting
- Per-provider configuration (e.g., Spotify: 10 req/s, MusicBrainz: 1 req/s)
- Blocking and non-blocking modes
- Thread-safe implementation
- Dynamic rate adjustment based on API response headers

Architecture Pattern: Token Bucket Rate Limiting
Reference: Blueprint Section "Strategic Rate Limit Management and Throttling"
"""

import time
import threading
import logging
from typing import Optional, Dict
from enum import Enum
from prometheus_client import Gauge

logger = logging.getLogger(__name__)

# Prometheus metrics
from prometheus_client import Counter, Histogram

api_gateway_rate_limit_requests_total = Counter(
    'api_gateway_rate_limit_requests_total',
    'Total number of rate limit requests',
    ['provider']
)

api_gateway_rate_limit_tokens = Gauge(
    'api_gateway_rate_limit_tokens',
    'Current number of available rate limit tokens',
    ['provider']
)

api_gateway_rate_limit_wait_seconds = Histogram(
    'api_gateway_rate_limit_wait_seconds',
    'Rate limit wait time in seconds',
    ['provider'],
    buckets=(0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0, 30.0, 60.0)
)

# Rate limit prediction metrics
rate_limit_exhaustion_predicted_seconds = Gauge(
    'api_gateway_rate_limit_exhaustion_predicted_seconds',
    'Predicted seconds until rate limit exhaustion',
    ['provider']
)

rate_limit_token_bucket_fill_ratio = Gauge(
    'api_gateway_rate_limit_token_bucket_fill_ratio',
    'Current token bucket fill ratio (0.0 to 1.0)',
    ['provider']
)


class RateLimitExceeded(Exception):
    """Raised when rate limit is exceeded in non-blocking mode."""
    pass


class TokenBucket:
    """
    Token bucket rate limiter implementation.

    The bucket starts full and refills at a constant rate. Each API request
    consumes one token. When the bucket is empty, requests are either blocked
    (waiting for tokens) or rejected.

    Usage:
        limiter = TokenBucket(rate=10.0, capacity=10)  # 10 req/sec
        limiter.acquire()  # Blocks until token available
        response = api_call()  # Make API call
    """

    def __init__(self, rate: float, capacity: int, name: str = "default"):
        """
        Initialize token bucket.

        Args:
            rate: Token refill rate per second (e.g., 10.0 = 10 tokens/sec)
            capacity: Maximum number of tokens in bucket
            name: Identifier for logging/debugging
        """
        self.rate = rate
        self.capacity = capacity
        self.name = name
        self.tokens = float(capacity)
        self.last_update = time.time()
        self.lock = threading.Lock()

        # Rate tracking for prediction
        self.consumption_history = []  # List of (timestamp, tokens_consumed)
        self.consumption_window = 300  # 5 minutes window for rate calculation

        logger.info(
            f"TokenBucket '{name}' initialized: "
            f"rate={rate} tokens/sec, capacity={capacity}"
        )

    def acquire(self, tokens: int = 1, blocking: bool = True, timeout: Optional[float] = None) -> bool:
        """
        Acquire tokens from the bucket.

        Args:
            tokens: Number of tokens to acquire (default: 1)
            blocking: If True, wait for tokens; if False, raise error if unavailable
            timeout: Maximum time to wait in blocking mode (None = wait forever)

        Returns:
            True if tokens acquired, False if timeout exceeded (blocking mode only)

        Raises:
            RateLimitExceeded: If tokens unavailable and blocking=False
        """
        start_time = time.time()
        wait_time_for_metrics = 0

        with self.lock:
            self._refill()

            # Track request
            api_gateway_rate_limit_requests_total.labels(provider=self.name).inc()

            # Update token gauge
            api_gateway_rate_limit_tokens.labels(provider=self.name).set(self.tokens)

            if self.tokens >= tokens:
                self.tokens -= tokens

                # Track consumption for rate prediction
                self._track_consumption(tokens)

                # Update token gauge after consumption
                api_gateway_rate_limit_tokens.labels(provider=self.name).set(self.tokens)

                logger.debug(
                    f"TokenBucket '{self.name}': Acquired {tokens} token(s), "
                    f"{self.tokens:.2f} remaining"
                )
                return True

            elif blocking:
                # Calculate wait time
                wait_time = (tokens - self.tokens) / self.rate
                wait_time_for_metrics = wait_time

                # Check timeout
                if timeout is not None and wait_time > timeout:
                    logger.warning(
                        f"TokenBucket '{self.name}': Timeout waiting for {tokens} token(s) "
                        f"(wait={wait_time:.2f}s, timeout={timeout:.2f}s)"
                    )
                    return False

                # Log the wait
                if wait_time > 1.0:
                    logger.info(
                        f"TokenBucket '{self.name}': Waiting {wait_time:.2f}s for {tokens} token(s)"
                    )

                # Release lock while sleeping to allow other threads
                self.lock.release()
                try:
                    time.sleep(wait_time)
                finally:
                    self.lock.acquire()

                # Refill and consume tokens
                self._refill()
                self.tokens = max(0, self.tokens - tokens)

                # Update token gauge
                api_gateway_rate_limit_tokens.labels(provider=self.name).set(self.tokens)

                elapsed = time.time() - start_time

                # Track wait time
                api_gateway_rate_limit_wait_seconds.labels(provider=self.name).observe(wait_time_for_metrics)

                logger.debug(
                    f"TokenBucket '{self.name}': Acquired {tokens} token(s) after {elapsed:.2f}s wait"
                )
                return True

            else:
                # Non-blocking mode - raise error
                raise RateLimitExceeded(
                    f"TokenBucket '{self.name}': Insufficient tokens "
                    f"(requested={tokens}, available={self.tokens:.2f})"
                )

    def _refill(self):
        """Refill tokens based on elapsed time since last update."""
        now = time.time()
        elapsed = now - self.last_update

        # Add tokens based on elapsed time
        new_tokens = elapsed * self.rate
        self.tokens = min(self.capacity, self.tokens + new_tokens)
        self.last_update = now

    def get_available_tokens(self) -> float:
        """Get current number of available tokens."""
        with self.lock:
            self._refill()
            return self.tokens

    def _track_consumption(self, tokens: int):
        """Track token consumption for rate prediction."""
        now = time.time()
        self.consumption_history.append((now, tokens))

        # Remove old entries outside the window
        cutoff_time = now - self.consumption_window
        self.consumption_history = [
            (ts, count) for ts, count in self.consumption_history
            if ts > cutoff_time
        ]

    def get_consumption_rate(self) -> float:
        """
        Calculate current consumption rate (tokens/second).

        Returns:
            Average consumption rate over the tracking window
        """
        if not self.consumption_history:
            return 0.0

        now = time.time()
        cutoff_time = now - self.consumption_window

        # Calculate total tokens consumed in window
        total_consumed = sum(
            count for ts, count in self.consumption_history
            if ts > cutoff_time
        )

        # Calculate actual time span
        if self.consumption_history:
            oldest_timestamp = min(ts for ts, _ in self.consumption_history)
            time_span = now - oldest_timestamp
            if time_span > 0:
                return total_consumed / time_span

        return 0.0

    def predict_exhaustion_time(self) -> Optional[float]:
        """
        Predict time in seconds until rate limit exhaustion.

        Returns:
            Seconds until exhaustion, None if not applicable (consumption < refill rate)
        """
        with self.lock:
            self._refill()

            consumption_rate = self.get_consumption_rate()

            # If consumption rate is less than or equal to refill rate, no exhaustion
            if consumption_rate <= self.rate:
                return None

            # Net depletion rate (consumption - refill)
            net_depletion_rate = consumption_rate - self.rate

            # Time until exhaustion: current_tokens / net_depletion_rate
            if net_depletion_rate > 0 and self.tokens > 0:
                exhaustion_seconds = self.tokens / net_depletion_rate
                return exhaustion_seconds

            return 0.0  # Already exhausted or will exhaust immediately

    def get_fill_ratio(self) -> float:
        """
        Get current bucket fill ratio.

        Returns:
            Ratio from 0.0 (empty) to 1.0 (full)
        """
        with self.lock:
            self._refill()
            return self.tokens / self.capacity

    def adjust_rate(self, new_rate: float):
        """
        Dynamically adjust the refill rate.

        Useful for adapting to API response headers like X-RateLimit-Remaining.

        Args:
            new_rate: New token refill rate per second
        """
        with self.lock:
            self._refill()  # Apply old rate first
            old_rate = self.rate
            self.rate = new_rate
            logger.info(
                f"TokenBucket '{self.name}': Rate adjusted from {old_rate} to {new_rate} tokens/sec"
            )


class RateLimiter:
    """
    Multi-provider rate limiter with adaptive throttling.

    Manages separate token buckets for each API provider and can dynamically
    adjust rates based on response headers.

    Usage:
        limiter = RateLimiter()
        limiter.configure_provider('spotify', rate=10.0, capacity=10)
        limiter.configure_provider('musicbrainz', rate=1.0, capacity=1)

        limiter.acquire('spotify')  # Acquire token for Spotify
        response = spotify_api.call()
        limiter.adjust_from_headers('spotify', response.headers)  # Adaptive
    """

    def __init__(self):
        self.buckets: Dict[str, TokenBucket] = {}
        self.lock = threading.Lock()

    def configure_provider(
        self,
        provider: str,
        rate: float,
        capacity: int
    ):
        """
        Configure rate limiting for a provider.

        Args:
            provider: Provider name (e.g., 'spotify', 'musicbrainz')
            rate: Tokens per second
            capacity: Maximum burst capacity
        """
        with self.lock:
            self.buckets[provider] = TokenBucket(
                rate=rate,
                capacity=capacity,
                name=provider
            )
            logger.info(f"RateLimiter: Configured provider '{provider}' (rate={rate}/s, capacity={capacity})")

    def acquire(self, provider: str, tokens: int = 1, blocking: bool = True, timeout: Optional[float] = None) -> bool:
        """
        Acquire tokens for a provider.

        Args:
            provider: Provider name
            tokens: Number of tokens to acquire
            blocking: Wait for tokens if unavailable
            timeout: Maximum wait time (blocking mode only)

        Returns:
            True if acquired, False if timeout

        Raises:
            ValueError: If provider not configured
            RateLimitExceeded: If non-blocking and tokens unavailable
        """
        if provider not in self.buckets:
            raise ValueError(f"Provider '{provider}' not configured in RateLimiter")

        return self.buckets[provider].acquire(
            tokens=tokens,
            blocking=blocking,
            timeout=timeout
        )

    def adjust_from_headers(self, provider: str, headers: Dict[str, str]):
        """
        Dynamically adjust rate based on API response headers.

        Supports common rate limit header formats:
        - X-RateLimit-Remaining
        - X-RateLimit-Reset
        - Retry-After

        Args:
            provider: Provider name
            headers: HTTP response headers
        """
        if provider not in self.buckets:
            return

        bucket = self.buckets[provider]

        # Parse X-RateLimit-Remaining
        remaining = headers.get('X-RateLimit-Remaining') or headers.get('x-ratelimit-remaining')
        reset_time = headers.get('X-RateLimit-Reset') or headers.get('x-ratelimit-reset')

        if remaining and reset_time:
            try:
                remaining_count = int(remaining)
                reset_timestamp = int(reset_time)
                now = int(time.time())

                # Calculate time until reset
                time_until_reset = max(1, reset_timestamp - now)

                # Calculate new rate to distribute remaining requests
                new_rate = max(0.1, remaining_count / time_until_reset)

                # Only adjust if significantly different (>20% change)
                rate_change = abs(new_rate - bucket.rate) / bucket.rate
                if rate_change > 0.2:
                    bucket.adjust_rate(new_rate)

            except (ValueError, TypeError) as e:
                logger.debug(f"Could not parse rate limit headers for {provider}: {e}")

        # Parse Retry-After header (used when rate limited)
        retry_after = headers.get('Retry-After') or headers.get('retry-after')
        if retry_after:
            try:
                # Retry-After can be seconds or HTTP date
                retry_seconds = int(retry_after)
                logger.warning(
                    f"Provider '{provider}' requests retry after {retry_seconds}s - throttling"
                )
                # Temporarily reduce rate
                bucket.adjust_rate(1.0 / retry_seconds)
            except ValueError:
                pass  # HTTP date format not supported

    def get_stats(self) -> Dict[str, Dict[str, float]]:
        """Get statistics for all configured providers."""
        stats = {}
        for provider, bucket in self.buckets.items():
            stats[provider] = {
                'rate': bucket.rate,
                'capacity': bucket.capacity,
                'available_tokens': bucket.get_available_tokens()
            }
        return stats

    def update_prediction_metrics(self):
        """
        Update Prometheus metrics for rate limit prediction.

        This should be called periodically (e.g., every 10 seconds) to update
        prediction metrics for monitoring and alerting.
        """
        for provider, bucket in self.buckets.items():
            # Update fill ratio metric
            fill_ratio = bucket.get_fill_ratio()
            rate_limit_token_bucket_fill_ratio.labels(provider=provider).set(fill_ratio)

            # Update exhaustion prediction metric
            exhaustion_time = bucket.predict_exhaustion_time()
            if exhaustion_time is not None:
                rate_limit_exhaustion_predicted_seconds.labels(provider=provider).set(exhaustion_time)

                # Log warning if exhaustion predicted within 5 minutes
                if exhaustion_time < 300:
                    logger.warning(
                        f"Rate limit exhaustion predicted for {provider}",
                        provider=provider,
                        exhaustion_in_seconds=exhaustion_time,
                        fill_ratio=fill_ratio
                    )
            else:
                # No exhaustion predicted - set to a high value or clear
                rate_limit_exhaustion_predicted_seconds.labels(provider=provider).set(-1)
