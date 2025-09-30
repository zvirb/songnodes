"""
Circuit breaker pattern implementation for API resilience
"""

import asyncio
import time
from enum import Enum
from typing import Callable, Any

import structlog

logger = structlog.get_logger(__name__)


class CircuitBreakerState(str, Enum):
    CLOSED = "closed"  # Normal operation
    OPEN = "open"  # Failing, reject calls
    HALF_OPEN = "half_open"  # Testing if service recovered


class CircuitBreaker:
    """
    Circuit breaker pattern implementation

    Protects against cascading failures by:
    - Counting failures
    - Opening circuit after threshold
    - Periodically testing recovery
    """

    def __init__(
        self,
        failure_threshold: int = 5,
        timeout_seconds: int = 60,
        success_threshold: int = 2,
        name: str = "unknown"
    ):
        self.failure_threshold = failure_threshold
        self.timeout_seconds = timeout_seconds
        self.success_threshold = success_threshold
        self.name = name

        self.failure_count = 0
        self.success_count = 0
        self.last_failure_time = None
        self.state = CircuitBreakerState.CLOSED

    async def call(self, func: Callable, *args, **kwargs) -> Any:
        """Execute function with circuit breaker protection"""

        if self.state == CircuitBreakerState.OPEN:
            if self._should_attempt_reset():
                logger.info(
                    "Circuit breaker attempting reset",
                    name=self.name,
                    state=self.state.value
                )
                self.state = CircuitBreakerState.HALF_OPEN
                self.success_count = 0
            else:
                logger.warning(
                    "Circuit breaker is OPEN, rejecting call",
                    name=self.name,
                    failure_count=self.failure_count
                )
                raise CircuitBreakerOpenException(
                    f"Circuit breaker {self.name} is OPEN"
                )

        try:
            result = await func(*args, **kwargs)
            self._on_success()
            return result

        except Exception as e:
            self._on_failure()
            raise e

    def _on_success(self):
        """Handle successful call"""
        if self.state == CircuitBreakerState.HALF_OPEN:
            self.success_count += 1

            if self.success_count >= self.success_threshold:
                logger.info(
                    "Circuit breaker closing after successful recovery",
                    name=self.name,
                    success_count=self.success_count
                )
                self.state = CircuitBreakerState.CLOSED
                self.failure_count = 0
                self.success_count = 0
        else:
            # Reset failure count on success in CLOSED state
            self.failure_count = 0

    def _on_failure(self):
        """Handle failed call"""
        self.failure_count += 1
        self.last_failure_time = time.time()

        if self.state == CircuitBreakerState.HALF_OPEN:
            logger.warning(
                "Circuit breaker re-opening after failure during recovery",
                name=self.name
            )
            self.state = CircuitBreakerState.OPEN
            self.success_count = 0

        elif self.failure_count >= self.failure_threshold:
            logger.error(
                "Circuit breaker opening due to failure threshold",
                name=self.name,
                failure_count=self.failure_count,
                threshold=self.failure_threshold
            )
            self.state = CircuitBreakerState.OPEN

    def _should_attempt_reset(self) -> bool:
        """Check if enough time has passed to attempt reset"""
        if self.last_failure_time is None:
            return True

        return (time.time() - self.last_failure_time) >= self.timeout_seconds

    def get_state(self) -> dict:
        """Get current circuit breaker state"""
        return {
            "name": self.name,
            "state": self.state.value,
            "failure_count": self.failure_count,
            "success_count": self.success_count,
            "failure_threshold": self.failure_threshold,
            "last_failure_time": self.last_failure_time
        }


class CircuitBreakerOpenException(Exception):
    """Exception raised when circuit breaker is open"""
    pass