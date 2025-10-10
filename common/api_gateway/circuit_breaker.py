"""
Circuit Breaker Pattern for API Gateway
========================================

Implements the Circuit Breaker pattern to prevent cascading failures when
external APIs are degraded or down.

States:
- CLOSED: Normal operation, requests pass through
- OPEN: Failing fast, requests rejected immediately
- HALF_OPEN: Testing if service recovered, allowing probe requests

Architecture Pattern: Circuit Breaker
Reference: Blueprint Section "Preventing Cascading Failures"
"""

import time
import threading
import logging
from enum import Enum
from typing import Callable, Any, Optional, Dict
from datetime import datetime, timedelta
from functools import wraps

logger = logging.getLogger(__name__)


class CircuitState(Enum):
    """Circuit breaker states following the standard state machine."""
    CLOSED = "closed"        # Normal operation
    OPEN = "open"           # Failing fast
    HALF_OPEN = "half_open"  # Testing recovery


class CircuitBreakerOpenError(Exception):
    """Raised when circuit breaker is OPEN and rejects requests."""
    pass


class CircuitBreaker:
    """
    Circuit breaker implementation for protecting against failing external services.

    Usage:
        breaker = CircuitBreaker(
            name="spotify_api",
            failure_threshold=5,     # Open after 5 failures
            timeout=60,              # Try recovery after 60s
            expected_exception=requests.RequestException
        )

        @breaker.protect
        def call_spotify_api():
            return requests.get("https://api.spotify.com/...")

        # Or use explicitly:
        result = breaker.call(lambda: api_request())
    """

    def __init__(
        self,
        name: str = "default",
        failure_threshold: int = 5,
        success_threshold: int = 2,
        timeout: int = 60,
        expected_exception: type = Exception
    ):
        """
        Initialize circuit breaker.

        Args:
            name: Identifier for logging/debugging
            failure_threshold: Number of failures before opening circuit
            success_threshold: Successes needed in HALF_OPEN to close circuit
            timeout: Seconds to wait in OPEN state before attempting HALF_OPEN
            expected_exception: Exception type to catch and count as failure
        """
        self.name = name
        self.failure_threshold = failure_threshold
        self.success_threshold = success_threshold
        self.timeout = timedelta(seconds=timeout)
        self.expected_exception = expected_exception

        self.state = CircuitState.CLOSED
        self.failure_count = 0
        self.success_count = 0
        self.last_failure_time: Optional[datetime] = None
        self.last_state_change: datetime = datetime.utcnow()

        self.lock = threading.Lock()

        logger.info(
            f"CircuitBreaker '{name}' initialized: "
            f"failure_threshold={failure_threshold}, timeout={timeout}s"
        )

    def call(self, func: Callable, *args, **kwargs) -> Any:
        """
        Execute function through circuit breaker.

        Args:
            func: Function to execute
            *args, **kwargs: Arguments to pass to function

        Returns:
            Result of function call

        Raises:
            CircuitBreakerOpenError: If circuit is OPEN
            expected_exception: If function fails with expected exception
        """
        with self.lock:
            # Check if we should transition from OPEN to HALF_OPEN
            if self.state == CircuitState.OPEN:
                if datetime.utcnow() - self.last_failure_time > self.timeout:
                    self._transition_to(CircuitState.HALF_OPEN)
                else:
                    # Circuit still open - fail fast
                    raise CircuitBreakerOpenError(
                        f"CircuitBreaker '{self.name}' is OPEN "
                        f"(fails={self.failure_count}, "
                        f"retry in {(self.last_failure_time + self.timeout - datetime.utcnow()).total_seconds():.1f}s)"
                    )

        # Execute the function
        try:
            result = func(*args, **kwargs)

            # Success handling
            with self.lock:
                if self.state == CircuitState.HALF_OPEN:
                    self.success_count += 1
                    logger.debug(
                        f"CircuitBreaker '{self.name}': Success in HALF_OPEN "
                        f"({self.success_count}/{self.success_threshold})"
                    )

                    if self.success_count >= self.success_threshold:
                        self._transition_to(CircuitState.CLOSED)

                elif self.state == CircuitState.CLOSED:
                    # Reset failure count on success in CLOSED state
                    if self.failure_count > 0:
                        self.failure_count = 0
                        logger.debug(f"CircuitBreaker '{self.name}': Failure count reset after success")

            return result

        except self.expected_exception as e:
            # Failure handling
            with self.lock:
                self.failure_count += 1
                self.last_failure_time = datetime.utcnow()

                logger.warning(
                    f"CircuitBreaker '{self.name}': Failure caught "
                    f"({self.failure_count}/{self.failure_threshold}) - {type(e).__name__}: {e}"
                )

                if self.state == CircuitState.HALF_OPEN:
                    # Failure in HALF_OPEN immediately opens circuit
                    self._transition_to(CircuitState.OPEN)

                elif self.state == CircuitState.CLOSED:
                    # Check if we've hit the failure threshold
                    if self.failure_count >= self.failure_threshold:
                        self._transition_to(CircuitState.OPEN)

            raise  # Re-raise the exception

    def protect(self, func: Callable) -> Callable:
        """
        Decorator to protect a function with the circuit breaker.

        Usage:
            @breaker.protect
            def risky_api_call():
                return requests.get(...)
        """
        @wraps(func)
        def wrapper(*args, **kwargs):
            return self.call(func, *args, **kwargs)
        return wrapper

    def _transition_to(self, new_state: CircuitState):
        """
        Transition circuit breaker to a new state.

        Args:
            new_state: Target state
        """
        old_state = self.state
        self.state = new_state
        self.last_state_change = datetime.utcnow()

        # Reset counters on state transition
        if new_state == CircuitState.CLOSED:
            self.failure_count = 0
            self.success_count = 0
        elif new_state == CircuitState.HALF_OPEN:
            self.success_count = 0
        elif new_state == CircuitState.OPEN:
            self.success_count = 0

        logger.warning(
            f"CircuitBreaker '{self.name}': State transition {old_state.value} → {new_state.value}"
        )

    def reset(self):
        """Manually reset circuit breaker to CLOSED state."""
        with self.lock:
            self._transition_to(CircuitState.CLOSED)
            logger.info(f"CircuitBreaker '{self.name}': Manually reset to CLOSED")

    def get_state(self) -> CircuitState:
        """Get current circuit state."""
        return self.state

    def get_stats(self) -> Dict[str, Any]:
        """Get circuit breaker statistics."""
        with self.lock:
            return {
                'name': self.name,
                'state': self.state.value,
                'failure_count': self.failure_count,
                'success_count': self.success_count,
                'failure_threshold': self.failure_threshold,
                'last_failure_time': self.last_failure_time.isoformat() if self.last_failure_time else None,
                'last_state_change': self.last_state_change.isoformat(),
                'time_in_current_state': (datetime.utcnow() - self.last_state_change).total_seconds()
            }


class CircuitBreakerRegistry:
    """
    Registry for managing multiple circuit breakers.

    Allows centralized configuration and monitoring of all circuit breakers
    in the application.

    Usage:
        registry = CircuitBreakerRegistry()
        registry.register('spotify', failure_threshold=5, timeout=60)
        registry.register('musicbrainz', failure_threshold=3, timeout=30)

        # Use registered breaker
        @registry.get('spotify').protect
        def call_spotify():
            ...

        # Monitor all breakers
        stats = registry.get_all_stats()
    """

    def __init__(self):
        self.breakers: Dict[str, CircuitBreaker] = {}
        self.lock = threading.Lock()

    def register(
        self,
        name: str,
        failure_threshold: int = 5,
        success_threshold: int = 2,
        timeout: int = 60,
        expected_exception: type = Exception
    ) -> CircuitBreaker:
        """
        Register a new circuit breaker.

        Args:
            name: Unique identifier
            failure_threshold: Failures before opening
            success_threshold: Successes to close from HALF_OPEN
            timeout: Seconds in OPEN state
            expected_exception: Exception type to handle

        Returns:
            Created CircuitBreaker instance
        """
        with self.lock:
            if name in self.breakers:
                logger.warning(f"CircuitBreaker '{name}' already registered - returning existing")
                return self.breakers[name]

            breaker = CircuitBreaker(
                name=name,
                failure_threshold=failure_threshold,
                success_threshold=success_threshold,
                timeout=timeout,
                expected_exception=expected_exception
            )

            self.breakers[name] = breaker
            logger.info(f"CircuitBreakerRegistry: Registered '{name}'")
            return breaker

    def get(self, name: str) -> Optional[CircuitBreaker]:
        """Get a circuit breaker by name."""
        return self.breakers.get(name)

    def get_all_stats(self) -> Dict[str, Dict[str, Any]]:
        """Get statistics for all registered circuit breakers."""
        return {name: breaker.get_stats() for name, breaker in self.breakers.items()}

    def reset_all(self):
        """Reset all circuit breakers to CLOSED state."""
        with self.lock:
            for breaker in self.breakers.values():
                breaker.reset()
            logger.info("CircuitBreakerRegistry: All breakers reset to CLOSED")
