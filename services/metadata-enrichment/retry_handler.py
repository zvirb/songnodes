"""
Exponential backoff retry handler for API calls with jitter

Implements robust retry logic for external API calls following best practices:
- Exponential backoff: wait_time = (2 ** retries) + random.uniform(0, 1)
- Respects Retry-After header for 429 (Too Many Requests) responses
- Configurable max retries and max delay cap
- Comprehensive error handling for network failures and timeouts
- Structured logging for observability
"""

import asyncio
import random
import time
from typing import Any, Callable, Dict, Optional, TypeVar

import aiohttp
import structlog

logger = structlog.get_logger(__name__)

# Type variable for generic return type
T = TypeVar('T')


class RetryExhausted(Exception):
    """Raised when maximum retry attempts have been exhausted"""

    def __init__(self, attempts: int, last_error: Exception):
        self.attempts = attempts
        self.last_error = last_error
        super().__init__(
            f"Retry exhausted after {attempts} attempts. Last error: {last_error}"
        )


async def fetch_with_exponential_backoff(
    api_call_func: Callable[..., Any],
    max_retries: int = 5,
    initial_delay: float = 1.0,
    max_delay: float = 60.0,
    logger_context: Optional[Dict[str, Any]] = None
) -> Any:
    """
    Execute an API call with exponential backoff retry logic.

    Implements the retry pattern with:
    1. Exponential backoff: wait_time = (2 ** retries) + random.uniform(0, 1)
    2. Jitter to prevent thundering herd
    3. Retry-After header support for 429 responses
    4. Max delay cap to prevent excessive waits
    5. Comprehensive error handling

    Args:
        api_call_func: Async callable that performs the API request
        max_retries: Maximum number of retry attempts (default: 5)
        initial_delay: Base delay for exponential backoff in seconds (default: 1.0)
        max_delay: Maximum delay cap in seconds (default: 60.0)
        logger_context: Additional context for structured logging

    Returns:
        The result of the successful API call

    Raises:
        RetryExhausted: When max_retries is exceeded
        aiohttp.ClientError: For unrecoverable client errors (4xx except 429)

    Example:
        >>> async def call_spotify():
        ...     async with session.get(url) as response:
        ...         response.raise_for_status()
        ...         return await response.json()
        >>> result = await fetch_with_exponential_backoff(
        ...     call_spotify,
        ...     max_retries=5,
        ...     logger_context={'api': 'spotify', 'endpoint': 'search'}
        ... )
    """
    context = logger_context or {}
    retries = 0
    last_error = None

    while retries <= max_retries:
        try:
            # Execute the API call
            result = await api_call_func()

            # Log success if we had previous retries
            if retries > 0:
                logger.info(
                    "API call succeeded after retries",
                    retries=retries,
                    **context
                )

            return result

        except aiohttp.ClientResponseError as e:
            last_error = e

            # Handle 429 (Too Many Requests) with Retry-After header
            if e.status == 429:
                retry_after = _extract_retry_after(e.headers)

                logger.warning(
                    "Rate limit hit (429), respecting Retry-After header",
                    retry_after=retry_after,
                    retries=retries,
                    max_retries=max_retries,
                    **context
                )

                # Honor Retry-After but respect max_delay cap
                wait_time = min(retry_after, max_delay)
                await asyncio.sleep(wait_time)

                retries += 1
                if retries > max_retries:
                    raise RetryExhausted(retries, e)

                continue

            # Don't retry client errors (4xx) except 429
            elif 400 <= e.status < 500:
                logger.error(
                    "Client error - not retrying",
                    status=e.status,
                    error=str(e),
                    **context
                )
                raise

            # Retry server errors (5xx)
            elif e.status >= 500:
                retries += 1
                if retries > max_retries:
                    raise RetryExhausted(retries, e)

                wait_time = _calculate_backoff(retries, initial_delay, max_delay)

                logger.warning(
                    "Server error - retrying with exponential backoff",
                    status=e.status,
                    retries=retries,
                    max_retries=max_retries,
                    wait_time=wait_time,
                    error=str(e),
                    **context
                )

                await asyncio.sleep(wait_time)
                continue

        except (
            aiohttp.ClientError,
            asyncio.TimeoutError,
            ConnectionError
        ) as e:
            # Network errors, timeouts, connection failures - retry these
            last_error = e
            retries += 1

            if retries > max_retries:
                raise RetryExhausted(retries, e)

            wait_time = _calculate_backoff(retries, initial_delay, max_delay)

            logger.warning(
                "Network/timeout error - retrying with exponential backoff",
                error_type=type(e).__name__,
                retries=retries,
                max_retries=max_retries,
                wait_time=wait_time,
                error=str(e),
                **context
            )

            await asyncio.sleep(wait_time)
            continue

        except Exception as e:
            # Unexpected errors - don't retry
            logger.error(
                "Unexpected error - not retrying",
                error_type=type(e).__name__,
                error=str(e),
                **context
            )
            raise

    # This should not be reached, but handle it gracefully
    if last_error:
        raise RetryExhausted(retries, last_error)

    raise RetryExhausted(retries, Exception("Unknown error"))


def _calculate_backoff(
    retries: int,
    initial_delay: float = 1.0,
    max_delay: float = 60.0
) -> float:
    """
    Calculate exponential backoff with jitter.

    Formula: wait_time = min((2 ** retries) * initial_delay + jitter, max_delay)
    Jitter: random.uniform(0, 1) to prevent thundering herd

    Args:
        retries: Current retry attempt number (1-indexed)
        initial_delay: Base delay multiplier in seconds
        max_delay: Maximum delay cap in seconds

    Returns:
        Wait time in seconds with jitter applied
    """
    # Exponential backoff: 2^retries * initial_delay
    exponential_delay = (2 ** retries) * initial_delay

    # Add jitter: random value between 0 and 1
    jitter = random.uniform(0, 1)

    # Calculate total wait time and apply max_delay cap
    wait_time = min(exponential_delay + jitter, max_delay)

    return wait_time


def _extract_retry_after(headers: Dict[str, str]) -> float:
    """
    Extract Retry-After value from response headers.

    Supports both formats:
    - Retry-After: 120 (seconds)
    - Retry-After: Wed, 21 Oct 2025 07:28:00 GMT (HTTP date)

    Args:
        headers: Response headers dictionary

    Returns:
        Retry-after value in seconds (defaults to 60 if not present)
    """
    retry_after_header = headers.get('Retry-After', headers.get('retry-after'))

    if not retry_after_header:
        return 60.0  # Default fallback

    try:
        # Try parsing as integer (seconds)
        return float(retry_after_header)
    except ValueError:
        # If it's an HTTP date, calculate seconds until that time
        try:
            from email.utils import parsedate_to_datetime
            retry_date = parsedate_to_datetime(retry_after_header)
            now = time.time()
            retry_timestamp = retry_date.timestamp()
            return max(retry_timestamp - now, 0)
        except Exception:
            # Fallback to default if parsing fails
            logger.warning(
                "Failed to parse Retry-After header",
                header_value=retry_after_header
            )
            return 60.0
