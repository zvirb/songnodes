"""
Exponential Backoff Retry Strategy
===================================

Implements sophisticated retry logic with:
- Exponential backoff with jitter
- Respects Retry-After headers
- Different strategies for transient vs permanent errors
- Circuit breaker integration
"""

import asyncio
import random
import time
from typing import Callable, Optional, Any, Set
from dataclasses import dataclass
import structlog
from prometheus_client import Counter, Histogram

logger = structlog.get_logger(__name__)

# Prometheus metrics
retry_attempts = Counter(
    'api_gateway_retry_attempts_total',
    'Total retry attempts',
    ['provider', 'error_type']
)
retry_success = Counter(
    'api_gateway_retry_success_total',
    'Successful retries',
    ['provider']
)
retry_failures = Counter(
    'api_gateway_retry_failures_total',
    'Failed retries after exhaustion',
    ['provider']
)
retry_delay_seconds = Histogram(
    'api_gateway_retry_delay_seconds',
    'Retry delay duration',
    ['provider']
)


@dataclass
class RetryConfig:
    """Configuration for retry strategy."""
    max_retries: int = 5
    initial_delay: float = 1.0
    max_delay: float = 60.0
    exponential_base: float = 2.0
    jitter_percentage: float = 0.2
    retry_on_status_codes: Set[int] = None

    def __post_init__(self):
        if self.retry_on_status_codes is None:
            self.retry_on_status_codes = {429, 500, 502, 503, 504}


class ExponentialBackoffRetry:
    """
    Exponential backoff with jitter for API retries.

    Features:
    - Initial delay: 1s
    - Max delay: 60s
    - Jitter: ±20% to prevent thundering herd
    - Respects Retry-After headers
    - Different strategies for transient vs permanent errors

    Retry only on:
    - 429 Too Many Requests
    - 500, 502, 503, 504 (server errors)
    - Network timeouts
    - Circuit breaker failures (after cooldown)

    Do NOT retry on:
    - 400 Bad Request
    - 401 Unauthorized
    - 404 Not Found
    - Other 4xx errors
    """

    # HTTP status codes that should never be retried
    NON_RETRYABLE_CODES = {400, 401, 403, 404, 405, 406, 410, 422}

    # HTTP status codes for transient errors
    TRANSIENT_ERROR_CODES = {429, 500, 502, 503, 504}

    def __init__(self, config: Optional[RetryConfig] = None):
        self.config = config or RetryConfig()

    def _calculate_delay(
        self,
        attempt: int,
        retry_after: Optional[int] = None
    ) -> float:
        """
        Calculate retry delay with exponential backoff and jitter.

        Args:
            attempt: Current attempt number (0-indexed)
            retry_after: Retry-After header value in seconds

        Returns:
            Delay in seconds
        """
        # If API provides Retry-After, respect it
        if retry_after is not None:
            delay = float(retry_after)
            logger.info(
                "Using Retry-After header for delay",
                delay=delay,
                attempt=attempt
            )
            return min(delay, self.config.max_delay)

        # Calculate exponential backoff
        delay = self.config.initial_delay * (
            self.config.exponential_base ** attempt
        )

        # Cap at max delay
        delay = min(delay, self.config.max_delay)

        # Add jitter (±20% by default)
        jitter = delay * self.config.jitter_percentage
        jitter_amount = random.uniform(-jitter, jitter)
        delay = delay + jitter_amount

        # Ensure delay is positive
        delay = max(0.1, delay)

        return delay

    def should_retry(
        self,
        exception: Optional[Exception] = None,
        status_code: Optional[int] = None,
        attempt: int = 0
    ) -> bool:
        """
        Determine if a request should be retried.

        Args:
            exception: Exception that occurred
            status_code: HTTP status code
            attempt: Current attempt number

        Returns:
            True if should retry, False otherwise
        """
        # Check max retries
        if attempt >= self.config.max_retries:
            logger.warning(
                "Max retries exceeded",
                attempt=attempt,
                max_retries=self.config.max_retries
            )
            return False

        # Check status code
        if status_code is not None:
            # Don't retry 4xx errors (except 429)
            if status_code in self.NON_RETRYABLE_CODES:
                logger.info(
                    "Non-retryable status code",
                    status_code=status_code
                )
                return False

            # Retry transient errors
            if status_code in self.TRANSIENT_ERROR_CODES:
                return True

            # Retry 5xx errors
            if 500 <= status_code < 600:
                return True

        # Check exception type
        if exception is not None:
            # Retry on timeout
            if isinstance(exception, asyncio.TimeoutError):
                logger.warning(
                    "Request timeout, retrying",
                    attempt=attempt
                )
                return True

            # Retry on connection errors
            exception_name = exception.__class__.__name__
            retryable_exceptions = {
                'ConnectionError',
                'TimeoutError',
                'ConnectTimeout',
                'ReadTimeout',
                'ClientConnectorError',
                'ServerDisconnectedError'
            }

            if exception_name in retryable_exceptions:
                logger.warning(
                    "Retryable exception occurred",
                    exception=exception_name,
                    attempt=attempt
                )
                return True

        # Default to not retry
        return False

    async def execute_with_retry(
        self,
        func: Callable,
        provider: str,
        *args,
        **kwargs
    ) -> Any:
        """
        Execute a function with retry logic.

        Args:
            func: Async function to execute
            provider: API provider name
            *args: Positional arguments for func
            **kwargs: Keyword arguments for func

        Returns:
            Result from func

        Raises:
            Last exception if all retries exhausted
        """
        last_exception = None
        retry_after = None

        for attempt in range(self.config.max_retries + 1):
            try:
                # Execute the function
                result = await func(*args, **kwargs)

                # Success
                if attempt > 0:
                    retry_success.labels(provider=provider).inc()
                    logger.info(
                        "Retry succeeded",
                        provider=provider,
                        attempt=attempt
                    )

                return result

            except Exception as e:
                last_exception = e

                # Check if we should retry
                status_code = getattr(e, 'status_code', None)

                if not self.should_retry(
                    exception=e,
                    status_code=status_code,
                    attempt=attempt
                ):
                    # Don't retry, raise immediately
                    logger.error(
                        "Non-retryable error",
                        provider=provider,
                        error=str(e),
                        status_code=status_code
                    )
                    raise

                # Record retry attempt
                error_type = 'timeout' if isinstance(
                    e,
                    asyncio.TimeoutError
                ) else f'status_{status_code}' if status_code else 'unknown'

                retry_attempts.labels(
                    provider=provider,
                    error_type=error_type
                ).inc()

                # Check if this is the last attempt
                if attempt >= self.config.max_retries:
                    retry_failures.labels(provider=provider).inc()
                    logger.error(
                        "All retries exhausted",
                        provider=provider,
                        attempts=attempt + 1,
                        last_error=str(e)
                    )
                    raise

                # Extract Retry-After header if available
                retry_after_header = None
                if hasattr(e, 'headers') and e.headers:
                    retry_after_header = e.headers.get('Retry-After')
                    if retry_after_header:
                        try:
                            retry_after = int(retry_after_header)
                        except ValueError:
                            logger.warning(
                                "Invalid Retry-After header",
                                value=retry_after_header
                            )

                # Calculate delay
                delay = self._calculate_delay(attempt, retry_after)

                logger.warning(
                    "Request failed, retrying",
                    provider=provider,
                    attempt=attempt + 1,
                    max_retries=self.config.max_retries,
                    delay=delay,
                    error=str(e),
                    status_code=status_code
                )

                # Record delay
                retry_delay_seconds.labels(provider=provider).observe(delay)

                # Wait before retry
                await asyncio.sleep(delay)

        # Should never reach here, but just in case
        if last_exception:
            raise last_exception
        else:
            raise RuntimeError("Retry logic failed without exception")


class CircuitBreakerRetry(ExponentialBackoffRetry):
    """
    Retry strategy with circuit breaker integration.

    After circuit breaker opens, retries are delayed until cooldown period.
    """

    def __init__(self, config: Optional[RetryConfig] = None):
        super().__init__(config)
        self.circuit_breaker_cooldown = 60.0  # seconds

    def should_retry(
        self,
        exception: Optional[Exception] = None,
        status_code: Optional[int] = None,
        attempt: int = 0
    ) -> bool:
        """
        Check if should retry, considering circuit breaker state.
        """
        # Check for circuit breaker exception
        if exception and 'CircuitBreakerOpenException' in str(
            type(exception).__name__
        ):
            # Don't retry immediately, circuit needs to cool down
            logger.warning(
                "Circuit breaker open, skipping retry",
                attempt=attempt
            )
            return False

        return super().should_retry(exception, status_code, attempt)
