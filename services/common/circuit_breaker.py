"""
Circuit breaker pattern implementation for API resilience

This module provides circuit breaker protection for external API calls to prevent
cascading failures when APIs degrade or become unavailable.

Usage:
    from common.circuit_breaker import CircuitBreakerManager

    manager = CircuitBreakerManager()
    result = await manager.call('spotify', spotify_api_function, *args, **kwargs)
"""

import asyncio
import time
from enum import Enum
from typing import Callable, Any, Dict, Optional

try:
    import structlog
    logger = structlog.get_logger(__name__)
    STRUCTLOG_AVAILABLE = True
except ImportError:
    import logging
    logger = logging.getLogger(__name__)
    STRUCTLOG_AVAILABLE = False

# Prometheus metrics (optional)
try:
    from prometheus_client import Gauge, Counter
    PROMETHEUS_AVAILABLE = True
except ImportError:
    PROMETHEUS_AVAILABLE = False
    logger.debug("prometheus_client not available - circuit breaker metrics disabled")


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
        name: str = "unknown",
        metrics_callback: Optional[Callable] = None
    ):
        self.failure_threshold = failure_threshold
        self.timeout_seconds = timeout_seconds
        self.success_threshold = success_threshold
        self.name = name
        self.metrics_callback = metrics_callback

        self.failure_count = 0
        self.success_count = 0
        self.last_failure_time = None
        self.state = CircuitBreakerState.CLOSED

    async def call(self, func: Callable, *args, **kwargs) -> Any:
        """Execute function with circuit breaker protection"""

        if self.state == CircuitBreakerState.OPEN:
            if self._should_attempt_reset():
                if STRUCTLOG_AVAILABLE:
                    logger.info(
                        "Circuit breaker attempting reset",
                        name=self.name,
                        state=self.state.value
                    )
                else:
                    logger.info(f"Circuit breaker attempting reset: {self.name} (state: {self.state.value})")
                self.state = CircuitBreakerState.HALF_OPEN
                self.success_count = 0
            else:
                if STRUCTLOG_AVAILABLE:
                    logger.warning(
                        "Circuit breaker is OPEN, rejecting call",
                        name=self.name,
                        failure_count=self.failure_count
                    )
                else:
                    logger.warning(f"Circuit breaker is OPEN, rejecting call: {self.name} (failures: {self.failure_count})")
                raise CircuitBreakerOpenException(
                    f"Circuit breaker {self.name} is OPEN"
                )

        try:
            # Handle both sync and async functions
            if asyncio.iscoroutinefunction(func):
                result = await func(*args, **kwargs)
            else:
                result = func(*args, **kwargs)

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
                if STRUCTLOG_AVAILABLE:
                    logger.info(
                        "Circuit breaker closing after successful recovery",
                        name=self.name,
                        success_count=self.success_count
                    )
                else:
                    logger.info(f"Circuit breaker closing after successful recovery: {self.name} (successes: {self.success_count})")
                old_state = self.state
                self.state = CircuitBreakerState.CLOSED
                self.failure_count = 0
                self.success_count = 0

                # Track recovery metric
                if self.metrics_callback:
                    self.metrics_callback('recovery', self.name)
        else:
            # Reset failure count on success in CLOSED state
            self.failure_count = 0

    def _on_failure(self):
        """Handle failed call"""
        self.failure_count += 1
        self.last_failure_time = time.time()

        if self.state == CircuitBreakerState.HALF_OPEN:
            if STRUCTLOG_AVAILABLE:
                logger.warning(
                    "Circuit breaker re-opening after failure during recovery",
                    name=self.name
                )
            else:
                logger.warning(f"Circuit breaker re-opening after failure during recovery: {self.name}")
            self.state = CircuitBreakerState.OPEN
            self.success_count = 0

            # Track re-open metric
            if self.metrics_callback:
                self.metrics_callback('open', self.name)

        elif self.failure_count >= self.failure_threshold:
            if STRUCTLOG_AVAILABLE:
                logger.error(
                    "Circuit breaker opening due to failure threshold",
                    name=self.name,
                    failure_count=self.failure_count,
                    threshold=self.failure_threshold
                )
            else:
                logger.error(f"Circuit breaker opening due to failure threshold: {self.name} (failures: {self.failure_count}/{self.failure_threshold})")
            self.state = CircuitBreakerState.OPEN

            # Track open metric
            if self.metrics_callback:
                self.metrics_callback('open', self.name)

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
        """Manually reset circuit breaker (for debugging)"""
        logger.info(f"Manually resetting circuit breaker: {self.name}")
        self.state = CircuitBreakerState.CLOSED
        self.failure_count = 0
        self.success_count = 0
        self.last_failure_time = None


class CircuitBreakerOpenException(Exception):
    """Exception raised when circuit breaker is open"""
    pass


class CircuitBreakerManager:
    """
    Manages multiple circuit breakers for different API providers

    Usage:
        manager = CircuitBreakerManager()
        result = await manager.call('spotify', spotify_api_function, *args)
    """

    # Default configuration per provider
    DEFAULT_CONFIG = {
        'spotify': {'failure_threshold': 10, 'timeout_seconds': 120, 'success_threshold': 2},
        'musicbrainz': {'failure_threshold': 3, 'timeout_seconds': 60, 'success_threshold': 2},
        'lastfm': {'failure_threshold': 5, 'timeout_seconds': 60, 'success_threshold': 2},
        'beatport': {'failure_threshold': 5, 'timeout_seconds': 90, 'success_threshold': 2},
        'discogs': {'failure_threshold': 5, 'timeout_seconds': 60, 'success_threshold': 2},
        'default': {'failure_threshold': 5, 'timeout_seconds': 60, 'success_threshold': 2}
    }

    def __init__(self, config: Optional[Dict] = None):
        """
        Initialize circuit breaker manager

        Args:
            config: Optional custom configuration dict per provider
        """
        self.breakers: Dict[str, CircuitBreaker] = {}
        self.config = config or self.DEFAULT_CONFIG

        # Initialize Prometheus metrics
        self._init_metrics()

    def _init_metrics(self):
        """Initialize Prometheus metrics for circuit breaker monitoring"""
        if not PROMETHEUS_AVAILABLE:
            self.metrics = None
            return

        try:
            self.metrics = {
                'circuit_breaker_state': Gauge(
                    'circuit_breaker_state',
                    'Circuit breaker state (0=closed, 1=half_open, 2=open)',
                    ['provider']
                ),
                'circuit_breaker_failures': Counter(
                    'circuit_breaker_failures_total',
                    'Total circuit breaker failures',
                    ['provider']
                ),
                'circuit_breaker_opens': Counter(
                    'circuit_breaker_opens_total',
                    'Total circuit breaker opens',
                    ['provider']
                ),
                'circuit_breaker_recoveries': Counter(
                    'circuit_breaker_recoveries_total',
                    'Total circuit breaker recoveries (close after open)',
                    ['provider']
                )
            }
            logger.debug("Circuit breaker Prometheus metrics initialized")
        except Exception as e:
            logger.warning(f"Could not initialize circuit breaker metrics: {e}")
            self.metrics = None

    def _update_metrics(self, provider: str, breaker: CircuitBreaker):
        """Update Prometheus metrics for a circuit breaker"""
        if not self.metrics:
            return

        try:
            # Map state to numeric value
            state_map = {
                CircuitBreakerState.CLOSED: 0,
                CircuitBreakerState.HALF_OPEN: 1,
                CircuitBreakerState.OPEN: 2
            }

            self.metrics['circuit_breaker_state'].labels(provider=provider).set(
                state_map.get(breaker.state, 0)
            )
        except Exception as e:
            logger.debug(f"Failed to update circuit breaker metrics: {e}")

    def _get_or_create_breaker(self, provider: str) -> CircuitBreaker:
        """Get existing breaker or create new one for provider"""
        if provider not in self.breakers:
            # Get config for provider or use default
            provider_config = self.config.get(provider, self.config.get('default', {}))

            self.breakers[provider] = CircuitBreaker(
                name=provider,
                failure_threshold=provider_config.get('failure_threshold', 5),
                timeout_seconds=provider_config.get('timeout_seconds', 60),
                success_threshold=provider_config.get('success_threshold', 2),
                metrics_callback=self._metrics_callback if self.metrics else None
            )
            logger.info(f"Created circuit breaker for provider: {provider}")

        return self.breakers[provider]

    def _metrics_callback(self, event: str, provider: str):
        """Callback for circuit breaker events to update metrics"""
        if not self.metrics:
            return

        try:
            if event == 'open':
                self.metrics['circuit_breaker_opens'].labels(provider=provider).inc()
            elif event == 'recovery':
                self.metrics['circuit_breaker_recoveries'].labels(provider=provider).inc()
        except Exception as e:
            logger.debug(f"Failed to update circuit breaker event metric: {e}")

    async def call(self, provider: str, func: Callable, *args, **kwargs) -> Any:
        """
        Execute function with circuit breaker protection

        Args:
            provider: API provider name (e.g., 'spotify', 'musicbrainz')
            func: Function to execute (can be sync or async)
            *args, **kwargs: Arguments to pass to function

        Returns:
            Result from function

        Raises:
            CircuitBreakerOpenException: If circuit breaker is open
        """
        breaker = self._get_or_create_breaker(provider)

        try:
            result = await breaker.call(func, *args, **kwargs)
            # Update metrics after successful call
            self._update_metrics(provider, breaker)
            return result
        except CircuitBreakerOpenException:
            # Update metrics when circuit is open
            self._update_metrics(provider, breaker)
            raise
        except Exception as e:
            # Track failure metric
            if self.metrics:
                self.metrics['circuit_breaker_failures'].labels(provider=provider).inc()
            # Update state metrics
            self._update_metrics(provider, breaker)
            raise

    def get_state(self, provider: str) -> Optional[dict]:
        """Get state of a specific circuit breaker"""
        if provider in self.breakers:
            return self.breakers[provider].get_state()
        return None

    def get_all_states(self) -> Dict[str, dict]:
        """Get states of all circuit breakers"""
        return {
            provider: breaker.get_state()
            for provider, breaker in self.breakers.items()
        }

    def reset(self, provider: str):
        """Manually reset a circuit breaker"""
        if provider in self.breakers:
            self.breakers[provider].reset()

    def reset_all(self):
        """Manually reset all circuit breakers"""
        for breaker in self.breakers.values():
            breaker.reset()

    def format_stats(self) -> str:
        """Format circuit breaker statistics for logging"""
        if not self.breakers:
            return "No circuit breakers active"

        lines = []
        for provider, breaker in sorted(self.breakers.items()):
            state = breaker.get_state()
            status_icon = {
                'closed': '✓',
                'half_open': '⚠',
                'open': '✗'
            }.get(state['state'], '?')

            lines.append(
                f"  {status_icon} {provider:15s} | "
                f"State: {state['state']:10s} | "
                f"Failures: {state['failure_count']:2d}/{state['failure_threshold']:2d}"
            )

        return "\n".join(lines)
