"""
Prometheus Metrics Instrumentation for SongNodes Scrapers
Implements comprehensive monitoring for scraping pipeline health

Metrics Categories:
1. Data Volume Metrics - Track EnhancedTrackItem and PlaylistItem creation rates
2. Error Tracking - asyncio warnings, schema mismatches, validation errors
3. Performance Metrics - Pipeline flush latency, extraction time
4. Resource Metrics - Connection pool usage, memory patterns
5. Data Quality - Artist coverage, duplicate rates, validation success
"""

from prometheus_client import Counter, Gauge, Histogram, Info, Summary
from prometheus_client import generate_latest, CONTENT_TYPE_LATEST
from typing import Dict, Any, Optional
import time
import logging
from functools import wraps
import asyncio

logger = logging.getLogger(__name__)

# ==============================================================================
# DATA VOLUME METRICS
# ==============================================================================

# Track item creation rates by type
items_created_total = Counter(
    'scraper_items_created_total',
    'Total items created by scrapers',
    ['scraper_name', 'item_type', 'source']
)

# Track EnhancedTrackItem creation specifically (critical metric)
enhanced_tracks_created = Counter(
    'scraper_enhanced_tracks_total',
    'Total EnhancedTrackItem objects created',
    ['scraper_name', 'source', 'has_isrc', 'has_spotify_id']
)

# Track PlaylistItem creation
playlists_discovered = Counter(
    'scraper_playlists_discovered_total',
    'Total playlists/tracklists discovered',
    ['scraper_name', 'source']
)

# Track artist coverage
artists_discovered = Counter(
    'scraper_artists_discovered_total',
    'Total unique artists discovered',
    ['scraper_name']
)

# Current artist coverage percentage (gauge, updated periodically)
artist_coverage_percentage = Gauge(
    'scraper_artist_coverage_percent',
    'Percentage of target artists with data',
    ['scraper_name']
)

# ==============================================================================
# ERROR TRACKING METRICS
# ==============================================================================

# AsyncIO event loop warnings
asyncio_warnings_total = Counter(
    'scraper_asyncio_warnings_total',
    'AsyncIO event loop warnings detected',
    ['scraper_name', 'warning_type']
)

# Schema/model mismatches
schema_errors_total = Counter(
    'scraper_schema_errors_total',
    'Schema validation errors detected',
    ['scraper_name', 'error_type', 'item_type']
)

# Validation errors by stage
validation_errors_total = Counter(
    'scraper_validation_errors_total',
    'Validation errors by pipeline stage',
    ['scraper_name', 'stage', 'error_type']
)

# Extraction failures
extraction_failures_total = Counter(
    'scraper_extraction_failures_total',
    'Failed extractions by reason',
    ['scraper_name', 'failure_reason', 'url_pattern']
)

# ==============================================================================
# PERFORMANCE METRICS
# ==============================================================================

# Pipeline flush latency
pipeline_flush_duration_seconds = Histogram(
    'scraper_pipeline_flush_duration_seconds',
    'Time taken to flush pipeline items to database',
    ['scraper_name', 'pipeline_stage'],
    buckets=[0.1, 0.5, 1.0, 2.5, 5.0, 10.0, 30.0, 60.0]
)

# Request/response time
scraper_request_duration_seconds = Histogram(
    'scraper_request_duration_seconds',
    'HTTP request duration',
    ['scraper_name', 'domain', 'status_code'],
    buckets=[0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0]
)

# Items processing rate (items/second)
items_processing_rate = Gauge(
    'scraper_items_processing_rate',
    'Current items processing rate (items/second)',
    ['scraper_name']
)

# Scraping run duration
scraping_run_duration_seconds = Histogram(
    'scraper_run_duration_seconds',
    'Total scraping run duration',
    ['scraper_name', 'status'],
    buckets=[60, 300, 600, 1800, 3600, 7200]
)

# ==============================================================================
# RESOURCE METRICS
# ==============================================================================

# Database connection pool usage
db_connection_pool_usage = Gauge(
    'scraper_db_connection_pool_usage',
    'Database connection pool usage',
    ['scraper_name', 'pool_type']
)

# Active connections
db_active_connections = Gauge(
    'scraper_db_active_connections',
    'Active database connections',
    ['scraper_name']
)

# Redis connection metrics
redis_connections_active = Gauge(
    'scraper_redis_connections_active',
    'Active Redis connections',
    ['scraper_name']
)

# Memory usage tracking
scraper_memory_usage_bytes = Gauge(
    'scraper_memory_usage_bytes',
    'Scraper process memory usage',
    ['scraper_name']
)

# ==============================================================================
# DATA QUALITY METRICS
# ==============================================================================

# Duplicate detection rate
duplicate_items_detected = Counter(
    'scraper_duplicate_items_total',
    'Duplicate items detected and skipped',
    ['scraper_name', 'item_type', 'dedup_strategy']
)

# Data enrichment success rate
enrichment_success_total = Counter(
    'scraper_enrichment_success_total',
    'Successful data enrichment operations',
    ['scraper_name', 'enrichment_source', 'data_type']
)

enrichment_failures_total = Counter(
    'scraper_enrichment_failures_total',
    'Failed data enrichment operations',
    ['scraper_name', 'enrichment_source', 'failure_reason']
)

# NLP extraction quality
nlp_extraction_confidence = Histogram(
    'scraper_nlp_extraction_confidence',
    'NLP extraction confidence scores',
    ['scraper_name', 'extraction_type'],
    buckets=[0.1, 0.3, 0.5, 0.7, 0.8, 0.9, 0.95, 0.99, 1.0]
)

# Track validation success
validation_success_rate = Gauge(
    'scraper_validation_success_rate',
    'Validation success rate (0-1)',
    ['scraper_name', 'validation_type']
)

# ==============================================================================
# CONTAINER HEALTH METRICS
# ==============================================================================

# Container health status
container_health_status = Gauge(
    'scraper_container_health_status',
    'Container health status (1=healthy, 0=unhealthy)',
    ['scraper_name', 'container_id']
)

# Last successful scrape timestamp
last_successful_scrape_timestamp = Gauge(
    'scraper_last_success_timestamp',
    'Timestamp of last successful scrape',
    ['scraper_name']
)

# Items in queue/buffer
items_in_queue = Gauge(
    'scraper_items_in_queue',
    'Number of items in processing queue',
    ['scraper_name', 'queue_type']
)

# ==============================================================================
# SCRAPER INFO METRICS
# ==============================================================================

scraper_info = Info(
    'scraper_info',
    'Scraper version and configuration information'
)

# ==============================================================================
# HELPER FUNCTIONS & DECORATORS
# ==============================================================================

def track_item_creation(scraper_name: str, item_type: str, source: str,
                       item_data: Optional[Dict[str, Any]] = None):
    """Track item creation with appropriate labels"""
    items_created_total.labels(
        scraper_name=scraper_name,
        item_type=item_type,
        source=source
    ).inc()

    # Special tracking for EnhancedTrackItem
    if item_type == 'EnhancedTrackItem' and item_data:
        has_isrc = 'yes' if item_data.get('isrc') else 'no'
        has_spotify_id = 'yes' if item_data.get('spotify_id') else 'no'

        enhanced_tracks_created.labels(
            scraper_name=scraper_name,
            source=source,
            has_isrc=has_isrc,
            has_spotify_id=has_spotify_id
        ).inc()

    # Track PlaylistItem
    elif item_type == 'PlaylistItem':
        playlists_discovered.labels(
            scraper_name=scraper_name,
            source=source
        ).inc()


def track_schema_error(scraper_name: str, error_type: str, item_type: str):
    """Track schema/validation errors"""
    schema_errors_total.labels(
        scraper_name=scraper_name,
        error_type=error_type,
        item_type=item_type
    ).inc()


def track_asyncio_warning(scraper_name: str, warning_type: str):
    """Track asyncio event loop warnings"""
    asyncio_warnings_total.labels(
        scraper_name=scraper_name,
        warning_type=warning_type
    ).inc()


def track_validation_error(scraper_name: str, stage: str, error_type: str):
    """Track pipeline validation errors"""
    validation_errors_total.labels(
        scraper_name=scraper_name,
        stage=stage,
        error_type=error_type
    ).inc()


def timed_pipeline_operation(scraper_name: str, pipeline_stage: str):
    """Decorator to time pipeline operations"""
    def decorator(func):
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            start_time = time.time()
            try:
                result = await func(*args, **kwargs)
                duration = time.time() - start_time
                pipeline_flush_duration_seconds.labels(
                    scraper_name=scraper_name,
                    pipeline_stage=pipeline_stage
                ).observe(duration)
                return result
            except Exception as e:
                duration = time.time() - start_time
                pipeline_flush_duration_seconds.labels(
                    scraper_name=scraper_name,
                    pipeline_stage=f"{pipeline_stage}_error"
                ).observe(duration)
                raise

        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            start_time = time.time()
            try:
                result = func(*args, **kwargs)
                duration = time.time() - start_time
                pipeline_flush_duration_seconds.labels(
                    scraper_name=scraper_name,
                    pipeline_stage=pipeline_stage
                ).observe(duration)
                return result
            except Exception as e:
                duration = time.time() - start_time
                pipeline_flush_duration_seconds.labels(
                    scraper_name=scraper_name,
                    pipeline_stage=f"{pipeline_stage}_error"
                ).observe(duration)
                raise

        # Return appropriate wrapper based on function type
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        else:
            return sync_wrapper

    return decorator


def update_connection_pool_metrics(scraper_name: str, pool_stats: Dict[str, Any]):
    """Update database connection pool metrics"""
    if 'size' in pool_stats and 'max_size' in pool_stats:
        usage_ratio = pool_stats['size'] / pool_stats['max_size']
        db_connection_pool_usage.labels(
            scraper_name=scraper_name,
            pool_type='main'
        ).set(usage_ratio)

    if 'active_connections' in pool_stats:
        db_active_connections.labels(
            scraper_name=scraper_name
        ).set(pool_stats['active_connections'])


def track_enrichment_result(scraper_name: str, enrichment_source: str,
                            data_type: str, success: bool,
                            failure_reason: Optional[str] = None):
    """Track data enrichment success/failure"""
    if success:
        enrichment_success_total.labels(
            scraper_name=scraper_name,
            enrichment_source=enrichment_source,
            data_type=data_type
        ).inc()
    else:
        enrichment_failures_total.labels(
            scraper_name=scraper_name,
            enrichment_source=enrichment_source,
            failure_reason=failure_reason or 'unknown'
        ).inc()


def update_health_status(scraper_name: str, container_id: str, is_healthy: bool):
    """Update container health status"""
    container_health_status.labels(
        scraper_name=scraper_name,
        container_id=container_id
    ).set(1 if is_healthy else 0)


def record_successful_scrape(scraper_name: str):
    """Record timestamp of successful scrape"""
    last_successful_scrape_timestamp.labels(
        scraper_name=scraper_name
    ).set(time.time())


def get_metrics_handler():
    """Get FastAPI/Flask compatible metrics handler"""
    def metrics():
        return generate_latest(), 200, {'Content-Type': CONTENT_TYPE_LATEST}
    return metrics


# ==============================================================================
# METRIC COLLECTION UTILITIES
# ==============================================================================

class ScraperMetricsCollector:
    """Helper class for collecting scraper metrics in a structured way"""

    def __init__(self, scraper_name: str):
        self.scraper_name = scraper_name
        self.run_start_time = time.time()

    def track_item(self, item_type: str, source: str, item_data: Optional[Dict] = None):
        """Track an item creation"""
        track_item_creation(self.scraper_name, item_type, source, item_data)

    def track_error(self, error_type: str, stage: str, item_type: Optional[str] = None):
        """Track an error"""
        if item_type:
            track_schema_error(self.scraper_name, error_type, item_type)
        track_validation_error(self.scraper_name, stage, error_type)

    def track_request(self, domain: str, status_code: int, duration: float):
        """Track HTTP request"""
        scraper_request_duration_seconds.labels(
            scraper_name=self.scraper_name,
            domain=domain,
            status_code=str(status_code)
        ).observe(duration)

    def update_processing_rate(self, items_per_second: float):
        """Update current processing rate"""
        items_processing_rate.labels(
            scraper_name=self.scraper_name
        ).set(items_per_second)

    def record_run_completion(self, status: str):
        """Record scraping run completion"""
        duration = time.time() - self.run_start_time
        scraping_run_duration_seconds.labels(
            scraper_name=self.scraper_name,
            status=status
        ).observe(duration)
        record_successful_scrape(self.scraper_name)

    def update_queue_size(self, queue_type: str, size: int):
        """Update queue size metric"""
        items_in_queue.labels(
            scraper_name=self.scraper_name,
            queue_type=queue_type
        ).set(size)


# ==============================================================================
# INITIALIZATION
# ==============================================================================

def initialize_scraper_metrics(scraper_name: str, version: str, config: Dict[str, Any]):
    """Initialize scraper metrics with configuration"""
    scraper_info.info({
        'scraper_name': scraper_name,
        'version': version,
        'config': str(config)
    })
    logger.info(f"Initialized metrics for scraper: {scraper_name} v{version}")
