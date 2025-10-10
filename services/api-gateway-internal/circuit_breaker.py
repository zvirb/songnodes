"""
Circuit Breaker Pattern for API Gateway
========================================

Enhanced circuit breaker with Prometheus metrics export for monitoring.
"""

import time
from enum import Enum
from typing import Callable, Any, Dict
import structlog
from prometheus_client import Gauge, Counter

logger = structlog.get_logger(__name__)

# Prometheus metrics
circuit_breaker_state = Gauge(
    'api_gateway_circuit_breaker_state',
    'Circuit breaker state (0=closed, 1=half_open, 2=open)',
    ['provider']
)
circuit_breaker_failures = Counter(
    'api_gateway_circuit_breaker_failures_total',
    'Total circuit breaker failures',
    ['provider']
)
circuit_breaker_opens = Counter(
    'api_gateway_circuit_breaker_opens_total',
    'Total times circuit breaker opened',
    ['provider']
)


class CircuitBreakerState(str, Enum):
    CLOSED = "closed"  # Normal operation
    OPEN = "open"  # Failing, reject calls
    HALF_OPEN = "half_open"  # Testing if service recovered


class CircuitBreaker:
    """
    Circuit breaker pattern implementation with Prometheus metrics.

    Protects against cascading failures by:
    - Counting failures
    - Opening circuit after threshold
    - Periodically testing recovery
    - Exporting state to Prometheus
    """

    # State to numeric mapping for Prometheus
    STATE_VALUES = {
        CircuitBreakerState.CLOSED: 0,
        CircuitBreakerState.HALF_OPEN: 1,
        CircuitBreakerState.OPEN: 2
    }

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

        # Initialize Prometheus metrics
        self._update_metrics()

    def _update_metrics(self):
        """Update Prometheus metrics."""
        circuit_breaker_state.labels(provider=self.name).set(
            self.STATE_VALUES[self.state]
        )

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
                self._update_metrics()
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
                self._update_metrics()
        else:
            # Reset failure count on success in CLOSED state
            self.failure_count = 0

    def _on_failure(self):
        """Handle failed call"""
        self.failure_count += 1
        self.last_failure_time = time.time()

        # Record failure metric
        circuit_breaker_failures.labels(provider=self.name).inc()

        if self.state == CircuitBreakerState.HALF_OPEN:
            logger.warning(
                "Circuit breaker re-opening after failure during recovery",
                name=self.name
            )
            self.state = CircuitBreakerState.OPEN
            self.success_count = 0
            circuit_breaker_opens.labels(provider=self.name).inc()
            self._update_metrics()

        elif self.failure_count >= self.failure_threshold:
            logger.error(
                "Circuit breaker opening due to failure threshold",
                name=self.name,
                failure_count=self.failure_count,
                threshold=self.failure_threshold
            )
            self.state = CircuitBreakerState.OPEN
            circuit_breaker_opens.labels(provider=self.name).inc()
            self._update_metrics()

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

    def reset(self):
        """Manually reset circuit breaker (admin operation)"""
        logger.info(
            "Circuit breaker manually reset",
            name=self.name,
            previous_state=self.state.value
        )
        self.state = CircuitBreakerState.CLOSED
        self.failure_count = 0
        self.success_count = 0
        self.last_failure_time = None
        self._update_metrics()


class CircuitBreakerOpenException(Exception):
    """Exception raised when circuit breaker is open"""
    pass


class CircuitBreakerManager:
    """Manage multiple circuit breakers for different API providers."""

    def __init__(self):
        self._breakers: Dict[str, CircuitBreaker] = {}

    def get_breaker(
        self,
        provider: str,
        failure_threshold: int = 5,
        timeout_seconds: int = 60,
        success_threshold: int = 2
    ) -> CircuitBreaker:
        """Get or create circuit breaker for provider."""
        if provider not in self._breakers:
            self._breakers[provider] = CircuitBreaker(
                failure_threshold=failure_threshold,
                timeout_seconds=timeout_seconds,
                success_threshold=success_threshold,
                name=provider
            )
            logger.info(
                "Created circuit breaker",
                provider=provider,
                failure_threshold=failure_threshold,
                timeout=timeout_seconds
            )

        return self._breakers[provider]

    def get_all_states(self) -> Dict[str, dict]:
        """Get states of all circuit breakers."""
        return {
            provider: breaker.get_state()
            for provider, breaker in self._breakers.items()
        }

    def reset_breaker(self, provider: str) -> bool:
        """Reset a specific circuit breaker."""
        if provider in self._breakers:
            self._breakers[provider].reset()
            return True
        return False

    def reset_all(self):
        """Reset all circuit breakers."""
        for breaker in self._breakers.values():
            breaker.reset()
        logger.info("All circuit breakers reset")
