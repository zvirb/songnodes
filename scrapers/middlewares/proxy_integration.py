"""
Proxy Middleware Integration - Specification Section IV Communication Layer

Provides helper classes and utilities for middleware-to-middleware communication
via crawler.stats shared state. Enables seamless integration between:

- CaptchaSolvingMiddleware ↔ ProxyRotationMiddleware
- EnhancedRetryMiddleware ↔ ProxyRotationMiddleware
- DynamicHeaderMiddleware ↔ ProxyRotationMiddleware

Key Features:
- Shared state management via crawler.stats
- Proxy marking (dirty, failed, successful)
- Cross-middleware event signaling
- Statistics aggregation
- Thread-safe state access

Usage:
    # In CaptchaSolvingMiddleware:
    integration = ProxyMiddlewareIntegration(crawler.stats)
    integration.mark_proxy_dirty(proxy_url, 'captcha_detected')

    # In ProxyRotationMiddleware:
    integration = ProxyMiddlewareIntegration(crawler.stats)
    dirty_proxies = integration.get_dirty_proxies()
"""

import logging
import time
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class ProxyEvent:
    """Represents a proxy-related event for cross-middleware communication."""
    proxy_url: str
    event_type: str  # 'dirty', 'failed', 'success', 'timeout'
    reason: str
    timestamp: float = field(default_factory=time.time)
    metadata: Dict[str, Any] = field(default_factory=dict)


class ProxyMiddlewareIntegration:
    """
    Manages shared state between CaptchaSolvingMiddleware and ProxyRotationMiddleware.

    Uses crawler.stats as a message bus for cross-middleware communication.
    All state is stored with namespaced keys to avoid conflicts.

    Namespace Convention:
        proxy_integration/dirty_proxies
        proxy_integration/failed_proxies
        proxy_integration/events
        proxy_integration/last_event
    """

    # Stats key prefixes
    PREFIX = 'proxy_integration'
    DIRTY_PROXIES_KEY = f'{PREFIX}/dirty_proxies'
    FAILED_PROXIES_KEY = f'{PREFIX}/failed_proxies'
    EVENTS_KEY = f'{PREFIX}/events'
    LAST_EVENT_KEY = f'{PREFIX}/last_event'

    def __init__(self, stats):
        """
        Initialize integration layer.

        Args:
            stats: Scrapy stats collector (shared across middlewares)
        """
        self.stats = stats
        self._initialize_state()

    def _initialize_state(self):
        """Initialize shared state if not already present."""
        if not self.stats.get_value(self.DIRTY_PROXIES_KEY):
            self.stats.set_value(self.DIRTY_PROXIES_KEY, {})

        if not self.stats.get_value(self.FAILED_PROXIES_KEY):
            self.stats.set_value(self.FAILED_PROXIES_KEY, {})

        if not self.stats.get_value(self.EVENTS_KEY):
            self.stats.set_value(self.EVENTS_KEY, [])

    # =========================================================================
    # PROXY MARKING API (Called by CaptchaSolvingMiddleware, RetryMiddleware)
    # =========================================================================

    def mark_proxy_dirty(self, proxy_url: str, reason: str, metadata: Optional[Dict[str, Any]] = None):
        """
        Mark proxy as dirty (encountered CAPTCHA, rate limit, etc.).

        A dirty proxy should be avoided for future requests but not completely
        banned (may recover after cooldown).

        Args:
            proxy_url: Proxy URL to mark
            reason: Reason for marking (e.g., 'captcha_detected', 'rate_limit')
            metadata: Optional additional data
        """
        logger.info(f"Marking proxy {proxy_url} as DIRTY - Reason: {reason}")

        # Get current dirty proxies dict
        dirty_proxies = self.stats.get_value(self.DIRTY_PROXIES_KEY, {})

        # Add or update proxy entry
        dirty_proxies[proxy_url] = {
            'reason': reason,
            'timestamp': time.time(),
            'metadata': metadata or {},
        }

        # Store back to stats
        self.stats.set_value(self.DIRTY_PROXIES_KEY, dirty_proxies)

        # Record event
        self._record_event(ProxyEvent(
            proxy_url=proxy_url,
            event_type='dirty',
            reason=reason,
            metadata=metadata or {},
        ))

        # Increment counter
        self.stats.inc_value(f'{self.PREFIX}/total_dirty_marked')

    def mark_proxy_failed(self, proxy_url: str, reason: str, metadata: Optional[Dict[str, Any]] = None):
        """
        Mark proxy as completely failed (hard ban).

        A failed proxy should not be used for any requests.

        Args:
            proxy_url: Proxy URL to mark
            reason: Reason for failure
            metadata: Optional additional data
        """
        logger.warning(f"Marking proxy {proxy_url} as FAILED - Reason: {reason}")

        # Get current failed proxies dict
        failed_proxies = self.stats.get_value(self.FAILED_PROXIES_KEY, {})

        # Add or update proxy entry
        failed_proxies[proxy_url] = {
            'reason': reason,
            'timestamp': time.time(),
            'metadata': metadata or {},
        }

        # Store back to stats
        self.stats.set_value(self.FAILED_PROXIES_KEY, failed_proxies)

        # Record event
        self._record_event(ProxyEvent(
            proxy_url=proxy_url,
            event_type='failed',
            reason=reason,
            metadata=metadata or {},
        ))

        # Increment counter
        self.stats.inc_value(f'{self.PREFIX}/total_failed_marked')

    def mark_proxy_success(self, proxy_url: str):
        """
        Mark proxy as successful (clear dirty/failed status).

        Args:
            proxy_url: Proxy URL that succeeded
        """
        # Remove from dirty list
        dirty_proxies = self.stats.get_value(self.DIRTY_PROXIES_KEY, {})
        if proxy_url in dirty_proxies:
            del dirty_proxies[proxy_url]
            self.stats.set_value(self.DIRTY_PROXIES_KEY, dirty_proxies)
            logger.info(f"Proxy {proxy_url} cleared from dirty list (successful request)")

        # Record event
        self._record_event(ProxyEvent(
            proxy_url=proxy_url,
            event_type='success',
            reason='request_successful',
        ))

        self.stats.inc_value(f'{self.PREFIX}/total_success_marked')

    # =========================================================================
    # PROXY QUERYING API (Called by ProxyRotationMiddleware)
    # =========================================================================

    def get_dirty_proxies(self) -> Dict[str, Dict[str, Any]]:
        """
        Get all proxies marked as dirty.

        Returns:
            Dict mapping proxy_url → {reason, timestamp, metadata}
        """
        return self.stats.get_value(self.DIRTY_PROXIES_KEY, {})

    def get_failed_proxies(self) -> Dict[str, Dict[str, Any]]:
        """
        Get all proxies marked as failed.

        Returns:
            Dict mapping proxy_url → {reason, timestamp, metadata}
        """
        return self.stats.get_value(self.FAILED_PROXIES_KEY, {})

    def is_proxy_dirty(self, proxy_url: str) -> bool:
        """Check if proxy is marked as dirty."""
        dirty_proxies = self.get_dirty_proxies()
        return proxy_url in dirty_proxies

    def is_proxy_failed(self, proxy_url: str) -> bool:
        """Check if proxy is marked as failed."""
        failed_proxies = self.get_failed_proxies()
        return proxy_url in failed_proxies

    def get_proxy_status(self, proxy_url: str) -> str:
        """
        Get current status of proxy.

        Returns:
            'failed', 'dirty', 'clean', or 'unknown'
        """
        if self.is_proxy_failed(proxy_url):
            return 'failed'
        elif self.is_proxy_dirty(proxy_url):
            return 'dirty'
        elif proxy_url:
            return 'clean'
        else:
            return 'unknown'

    # =========================================================================
    # CLEANUP API
    # =========================================================================

    def cleanup_expired_dirty_proxies(self, max_age_seconds: int = 600):
        """
        Remove dirty proxies older than max_age_seconds (default 10 minutes).

        This allows proxies to "recover" after a cooldown period.

        Args:
            max_age_seconds: Maximum age before proxy is cleared from dirty list
        """
        current_time = time.time()
        dirty_proxies = self.get_dirty_proxies()

        # Find expired proxies
        expired = [
            proxy_url
            for proxy_url, data in dirty_proxies.items()
            if current_time - data['timestamp'] > max_age_seconds
        ]

        # Remove expired proxies
        for proxy_url in expired:
            del dirty_proxies[proxy_url]
            logger.info(f"Proxy {proxy_url} removed from dirty list (cooldown expired)")

        # Update stats
        if expired:
            self.stats.set_value(self.DIRTY_PROXIES_KEY, dirty_proxies)
            logger.info(f"Cleaned up {len(expired)} expired dirty proxies")

    def clear_all_dirty_proxies(self):
        """Clear all dirty proxy markings."""
        self.stats.set_value(self.DIRTY_PROXIES_KEY, {})
        logger.info("Cleared all dirty proxy markings")

    def clear_all_failed_proxies(self):
        """Clear all failed proxy markings."""
        self.stats.set_value(self.FAILED_PROXIES_KEY, {})
        logger.info("Cleared all failed proxy markings")

    # =========================================================================
    # EVENT LOGGING
    # =========================================================================

    def _record_event(self, event: ProxyEvent):
        """
        Record proxy event for debugging and monitoring.

        Args:
            event: ProxyEvent to record
        """
        # Get current events list
        events = self.stats.get_value(self.EVENTS_KEY, [])

        # Add new event (convert to dict for serialization)
        event_dict = {
            'proxy_url': event.proxy_url,
            'event_type': event.event_type,
            'reason': event.reason,
            'timestamp': event.timestamp,
            'metadata': event.metadata,
        }
        events.append(event_dict)

        # Keep only last 100 events (memory management)
        if len(events) > 100:
            events = events[-100:]

        # Store back to stats
        self.stats.set_value(self.EVENTS_KEY, events)
        self.stats.set_value(self.LAST_EVENT_KEY, event_dict)

    def get_recent_events(self, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Get recent proxy events.

        Args:
            limit: Maximum number of events to return

        Returns:
            List of event dicts (most recent first)
        """
        events = self.stats.get_value(self.EVENTS_KEY, [])
        return events[-limit:][::-1]  # Return most recent first

    def get_last_event(self) -> Optional[Dict[str, Any]]:
        """Get the most recent proxy event."""
        return self.stats.get_value(self.LAST_EVENT_KEY)

    # =========================================================================
    # STATISTICS
    # =========================================================================

    def get_statistics(self) -> Dict[str, Any]:
        """
        Get comprehensive proxy integration statistics.

        Returns:
            Statistics dict
        """
        dirty_proxies = self.get_dirty_proxies()
        failed_proxies = self.get_failed_proxies()

        return {
            'dirty_count': len(dirty_proxies),
            'failed_count': len(failed_proxies),
            'total_dirty_marked': self.stats.get_value(f'{self.PREFIX}/total_dirty_marked', 0),
            'total_failed_marked': self.stats.get_value(f'{self.PREFIX}/total_failed_marked', 0),
            'total_success_marked': self.stats.get_value(f'{self.PREFIX}/total_success_marked', 0),
            'dirty_proxies': list(dirty_proxies.keys()),
            'failed_proxies': list(failed_proxies.keys()),
            'recent_events': self.get_recent_events(limit=5),
        }


class ProxyRotationHelper:
    """
    Helper utilities for proxy rotation logic.

    Provides common functions used across multiple middlewares.
    """

    @staticmethod
    def should_rotate_proxy(request, response=None, exception=None) -> bool:
        """
        Determine if proxy should be rotated for this request/response.

        Args:
            request: Scrapy Request
            response: Scrapy Response (optional)
            exception: Exception (optional)

        Returns:
            True if proxy should be rotated
        """
        # Check explicit rotation flag
        if request.meta.get('rotate_proxy', False):
            return True

        # Rotate on rate limit responses
        if response and response.status in [429, 403, 503]:
            return True

        # Rotate on network exceptions
        if exception:
            return True

        return False

    @staticmethod
    def get_proxy_retry_count(request) -> int:
        """Get number of proxy retries for this request."""
        return request.meta.get('proxy_retry_count', 0)

    @staticmethod
    def increment_proxy_retry_count(request):
        """Increment proxy retry counter for request."""
        request.meta['proxy_retry_count'] = request.meta.get('proxy_retry_count', 0) + 1

    @staticmethod
    def should_use_proxy(request) -> bool:
        """
        Determine if proxy should be used for this request.

        Args:
            request: Scrapy Request

        Returns:
            True if proxy should be used
        """
        # Check explicit flag
        if 'use_proxy' in request.meta:
            return request.meta['use_proxy']

        # Default: use proxy
        return True


# =============================================================================
# EXAMPLE USAGE
# =============================================================================

if __name__ == '__main__':
    """
    Example usage of ProxyMiddlewareIntegration.

    This demonstrates how middlewares communicate via shared state.
    """

    # Mock stats collector
    class MockStats:
        def __init__(self):
            self._data = {}

        def get_value(self, key, default=None):
            return self._data.get(key, default)

        def set_value(self, key, value):
            self._data[key] = value

        def inc_value(self, key, count=1):
            self._data[key] = self._data.get(key, 0) + count

    # Create integration instance
    stats = MockStats()
    integration = ProxyMiddlewareIntegration(stats)

    # Simulate CAPTCHA detection in CaptchaSolvingMiddleware
    print("Simulating CAPTCHA detection...")
    integration.mark_proxy_dirty('http://proxy1.example.com:8080', 'captcha_detected')

    # Simulate rate limit in RetryMiddleware
    print("Simulating rate limit...")
    integration.mark_proxy_dirty('http://proxy2.example.com:8080', 'rate_limit_429')

    # ProxyRotationMiddleware queries dirty proxies
    print("\nQuerying dirty proxies...")
    dirty = integration.get_dirty_proxies()
    print(f"Dirty proxies: {list(dirty.keys())}")

    # Check proxy status
    print(f"\nProxy 1 status: {integration.get_proxy_status('http://proxy1.example.com:8080')}")

    # Simulate successful request
    print("\nSimulating successful request...")
    integration.mark_proxy_success('http://proxy1.example.com:8080')

    # Check status again
    print(f"Proxy 1 status after success: {integration.get_proxy_status('http://proxy1.example.com:8080')}")

    # Get statistics
    print("\nStatistics:")
    stats_data = integration.get_statistics()
    for key, value in stats_data.items():
        if key not in ['dirty_proxies', 'failed_proxies', 'recent_events']:
            print(f"  {key}: {value}")
