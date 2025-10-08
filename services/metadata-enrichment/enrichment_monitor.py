"""
Comprehensive monitoring module for metadata enrichment pipeline
Tracks per-source metrics, circuit breaker states, queue depth, and processing rates
"""

import time
from datetime import datetime
from typing import Dict, Optional, Any, List
from collections import deque

from prometheus_client import Counter, Gauge, Histogram, Info
import structlog

logger = structlog.get_logger(__name__)


class EnrichmentMonitor:
    """
    Comprehensive monitoring for the enrichment pipeline

    Tracks:
    - Per-source enrichment success/failure rates
    - Circuit breaker states
    - Queue depth and processing rates
    - Average enrichment time per source
    - API rate limit status
    - Real-time health metrics
    """

    def __init__(self):
        # Per-source enrichment metrics
        self.enrichment_requests = Counter(
            'enrichment_requests_total',
            'Total enrichment requests per source',
            ['source', 'status']
        )

        self.enrichment_duration = Histogram(
            'enrichment_duration_seconds',
            'Time spent enriching from each source',
            ['source'],
            buckets=[0.1, 0.5, 1.0, 2.0, 5.0, 10.0, 30.0, 60.0]
        )

        self.enrichment_errors = Counter(
            'enrichment_errors_total',
            'Total enrichment errors by source and error type',
            ['source', 'error_type']
        )

        # Circuit breaker metrics
        self.circuit_breaker_state = Gauge(
            'circuit_breaker_state',
            'Circuit breaker state (0=closed, 1=half_open, 2=open)',
            ['source']
        )

        self.circuit_breaker_failures = Counter(
            'circuit_breaker_failures_total',
            'Total circuit breaker failures',
            ['source']
        )

        self.circuit_breaker_trips = Counter(
            'circuit_breaker_trips_total',
            'Times circuit breaker opened',
            ['source']
        )

        # Queue metrics
        self.queue_depth = Gauge(
            'enrichment_queue_depth',
            'Current enrichment queue depth',
            ['status']
        )

        self.queue_processing_rate = Gauge(
            'enrichment_queue_processing_rate',
            'Tracks processed per minute'
        )

        # API rate limit metrics
        self.api_rate_limit_remaining = Gauge(
            'enrichment_api_rate_limit_remaining',
            'Remaining API calls before rate limit',
            ['source']
        )

        self.api_rate_limit_reset = Gauge(
            'enrichment_api_rate_limit_reset_timestamp',
            'Unix timestamp when rate limit resets',
            ['source']
        )

        # Cache metrics
        self.cache_operations = Counter(
            'enrichment_cache_operations_total',
            'Cache operations',
            ['operation', 'status']
        )

        # Track processing performance
        self.tracks_in_progress = Gauge(
            'enrichment_tracks_in_progress',
            'Number of tracks currently being enriched'
        )

        self.enrichment_batch_size = Histogram(
            'enrichment_batch_size',
            'Size of enrichment batches',
            buckets=[1, 5, 10, 20, 50, 100]
        )

        # Source availability
        self.source_health = Gauge(
            'enrichment_source_health',
            'Source health status (0=down, 1=degraded, 2=healthy)',
            ['source']
        )

        # Metadata quality metrics
        self.metadata_fields_populated = Counter(
            'enrichment_metadata_fields_populated_total',
            'Metadata fields successfully populated',
            ['field']
        )

        # Info metric for service version
        self.service_info = Info(
            'enrichment_service',
            'Enrichment service information'
        )
        self.service_info.info({
            'version': '1.0.0',
            'pipeline': 'waterfall',
            'sources': 'spotify,musicbrainz,discogs,beatport,lastfm,acousticbrainz,getsongbpm,sonoteller'
        })

        # Track recent processing times for rate calculation
        self._recent_completions = deque(maxlen=100)

    def record_enrichment_request(self, source: str, status: str):
        """Record an enrichment request"""
        self.enrichment_requests.labels(source=source, status=status).inc()

    def record_enrichment_duration(self, source: str, duration_seconds: float):
        """Record enrichment duration for a source"""
        self.enrichment_duration.labels(source=source).observe(duration_seconds)

    def record_enrichment_error(self, source: str, error_type: str):
        """Record an enrichment error"""
        self.enrichment_errors.labels(source=source, error_type=error_type).inc()

    def update_circuit_breaker_state(self, source: str, state: str):
        """
        Update circuit breaker state

        Args:
            source: Source name (spotify, musicbrainz, etc.)
            state: State string (closed, half_open, open)
        """
        state_map = {
            'closed': 0,
            'half_open': 1,
            'open': 2
        }
        self.circuit_breaker_state.labels(source=source).set(state_map.get(state, 0))

    def record_circuit_breaker_failure(self, source: str):
        """Record a circuit breaker failure"""
        self.circuit_breaker_failures.labels(source=source).inc()

    def record_circuit_breaker_trip(self, source: str):
        """Record circuit breaker opening"""
        self.circuit_breaker_trips.labels(source=source).inc()
        logger.warning("Circuit breaker tripped", source=source)

    def update_queue_depth(self, pending: int = 0, in_progress: int = 0, failed: int = 0):
        """Update enrichment queue depths"""
        self.queue_depth.labels(status='pending').set(pending)
        self.queue_depth.labels(status='in_progress').set(in_progress)
        self.queue_depth.labels(status='failed').set(failed)

    def record_track_completion(self):
        """Record a track completion for processing rate calculation"""
        self._recent_completions.append(time.time())
        self._update_processing_rate()

    def _update_processing_rate(self):
        """Calculate and update processing rate"""
        if len(self._recent_completions) < 2:
            return

        current_time = time.time()
        # Count completions in last minute
        recent = [t for t in self._recent_completions if current_time - t <= 60]

        if recent:
            rate = len(recent)  # Tracks per minute
            self.queue_processing_rate.set(rate)

    def update_api_rate_limit(self, source: str, remaining: int, reset_timestamp: Optional[int] = None):
        """Update API rate limit info"""
        self.api_rate_limit_remaining.labels(source=source).set(remaining)
        if reset_timestamp:
            self.api_rate_limit_reset.labels(source=source).set(reset_timestamp)

    def record_cache_operation(self, operation: str, status: str):
        """Record cache operation (hit, miss, set, error)"""
        self.cache_operations.labels(operation=operation, status=status).inc()

    def set_tracks_in_progress(self, count: int):
        """Update number of tracks currently being enriched"""
        self.tracks_in_progress.set(count)

    def record_batch_size(self, size: int):
        """Record enrichment batch size"""
        self.enrichment_batch_size.observe(size)

    def update_source_health(self, source: str, health: str):
        """
        Update source health status

        Args:
            source: Source name
            health: Health status (down, degraded, healthy)
        """
        health_map = {
            'down': 0,
            'degraded': 1,
            'healthy': 2
        }
        self.source_health.labels(source=source).set(health_map.get(health, 0))

    def record_metadata_field(self, field: str):
        """Record that a metadata field was successfully populated"""
        self.metadata_fields_populated.labels(field=field).inc()

    def get_current_metrics(self) -> Dict[str, Any]:
        """
        Get current metric values for real-time monitoring

        Returns:
            Dictionary with current metric values
        """
        return {
            'timestamp': datetime.utcnow().isoformat(),
            'queue_processing_rate': self.queue_processing_rate._value.get(),
            'tracks_in_progress': self.tracks_in_progress._value.get(),
        }


# Global monitor instance
_monitor: Optional[EnrichmentMonitor] = None


def get_monitor() -> EnrichmentMonitor:
    """Get or create the global monitor instance"""
    global _monitor
    if _monitor is None:
        _monitor = EnrichmentMonitor()
    return _monitor


def track_enrichment(source: str):
    """
    Decorator to track enrichment operations

    Usage:
        @track_enrichment('spotify')
        async def enrich_from_spotify(data):
            ...
    """
    def decorator(func):
        async def wrapper(*args, **kwargs):
            monitor = get_monitor()
            start_time = time.time()

            try:
                result = await func(*args, **kwargs)

                duration = time.time() - start_time
                monitor.record_enrichment_duration(source, duration)

                if result:
                    monitor.record_enrichment_request(source, 'success')
                else:
                    monitor.record_enrichment_request(source, 'no_data')

                return result

            except Exception as e:
                duration = time.time() - start_time
                monitor.record_enrichment_duration(source, duration)
                monitor.record_enrichment_request(source, 'error')
                monitor.record_enrichment_error(source, type(e).__name__)
                raise

        return wrapper
    return decorator
