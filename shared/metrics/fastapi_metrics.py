"""
Universal Prometheus Metrics Module for FastAPI Services
Can be integrated into any FastAPI application
"""

from typing import Optional, Callable
from prometheus_client import Counter, Histogram, Gauge, generate_latest, CONTENT_TYPE_LATEST, CollectorRegistry
from starlette.requests import Request
from starlette.responses import Response
from starlette.middleware.base import BaseHTTPMiddleware
import time
import os


class MetricsService:
    """Prometheus metrics service for FastAPI applications"""

    def __init__(self, service_name: str = "fastapi-service", registry: Optional[CollectorRegistry] = None):
        self.service_name = service_name
        self.registry = registry or CollectorRegistry()

        # Initialize metrics
        self._initialize_metrics()

    def _initialize_metrics(self):
        """Initialize all Prometheus metrics"""

        # HTTP metrics
        self.http_requests_total = Counter(
            'http_requests_total',
            'Total HTTP requests',
            ['method', 'endpoint', 'status'],
            registry=self.registry
        )

        self.http_request_duration_seconds = Histogram(
            'http_request_duration_seconds',
            'HTTP request latency',
            ['method', 'endpoint'],
            buckets=(0.01, 0.05, 0.1, 0.5, 1.0, 2.5, 5.0, 10.0),
            registry=self.registry
        )

        self.http_request_size_bytes = Histogram(
            'http_request_size_bytes',
            'HTTP request size',
            ['method', 'endpoint'],
            buckets=(100, 1000, 10000, 100000, 1000000),
            registry=self.registry
        )

        self.http_response_size_bytes = Histogram(
            'http_response_size_bytes',
            'HTTP response size',
            ['method', 'endpoint'],
            buckets=(100, 1000, 10000, 100000, 1000000),
            registry=self.registry
        )

        # Business metrics
        self.business_operations_total = Counter(
            'business_operations_total',
            'Total business operations',
            ['operation', 'status'],
            registry=self.registry
        )

        # Active requests gauge
        self.http_requests_in_progress = Gauge(
            'http_requests_in_progress',
            'HTTP requests currently being processed',
            registry=self.registry
        )

        # Database metrics
        self.db_query_duration_seconds = Histogram(
            'db_query_duration_seconds',
            'Database query duration',
            ['operation', 'table'],
            buckets=(0.001, 0.01, 0.05, 0.1, 0.5, 1.0),
            registry=self.registry
        )

        self.db_connections = Gauge(
            'db_connections',
            'Database connections',
            ['state'],
            registry=self.registry
        )

        # Cache metrics
        self.cache_hits_total = Counter(
            'cache_hits_total',
            'Total cache hits',
            ['cache_type'],
            registry=self.registry
        )

        self.cache_misses_total = Counter(
            'cache_misses_total',
            'Total cache misses',
            ['cache_type'],
            registry=self.registry
        )

        # Error metrics
        self.errors_total = Counter(
            'errors_total',
            'Total errors',
            ['type', 'severity'],
            registry=self.registry
        )

        # Service info
        self.app_info = Gauge(
            'app_info',
            'Application info',
            ['version', 'service_name'],
            registry=self.registry
        )
        self.app_info.labels(
            version=os.getenv('APP_VERSION', '1.0.0'),
            service_name=self.service_name
        ).set(1)

    def record_operation(self, operation: str, status: str = 'success'):
        """Record a business operation"""
        self.business_operations_total.labels(operation=operation, status=status).inc()

    def record_db_query(self, operation: str, table: str, duration: float):
        """Record database query metrics"""
        self.db_query_duration_seconds.labels(operation=operation, table=table).observe(duration)

    def record_cache_hit(self, cache_type: str = 'default'):
        """Record cache hit"""
        self.cache_hits_total.labels(cache_type=cache_type).inc()

    def record_cache_miss(self, cache_type: str = 'default'):
        """Record cache miss"""
        self.cache_misses_total.labels(cache_type=cache_type).inc()

    def record_error(self, error_type: str, severity: str = 'error'):
        """Record an error"""
        self.errors_total.labels(type=error_type, severity=severity).inc()

    def set_db_connections(self, active: int, idle: int):
        """Update database connection gauges"""
        self.db_connections.labels(state='active').set(active)
        self.db_connections.labels(state='idle').set(idle)

    def get_metrics(self) -> bytes:
        """Generate current metrics"""
        return generate_latest(self.registry)


class PrometheusMiddleware(BaseHTTPMiddleware):
    """Middleware to automatically collect HTTP metrics"""

    def __init__(self, app, metrics_service: MetricsService,
                 should_group_status_codes: bool = True,
                 should_ignore_untemplated: bool = True,
                 excluded_paths: Optional[list] = None):
        super().__init__(app)
        self.metrics = metrics_service
        self.should_group_status_codes = should_group_status_codes
        self.should_ignore_untemplated = should_ignore_untemplated
        self.excluded_paths = excluded_paths or ['/metrics', '/health', '/docs', '/redoc', '/openapi.json']

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Skip metrics for excluded paths
        if request.url.path in self.excluded_paths:
            return await call_next(request)

        # Start timing
        start_time = time.time()

        # Track in-progress requests
        self.metrics.http_requests_in_progress.inc()

        try:
            # Process request
            response = await call_next(request)

            # Calculate metrics
            duration = time.time() - start_time

            # Get endpoint path
            path = str(request.url.path)
            if self.should_ignore_untemplated and not hasattr(request, 'path_params'):
                path = 'other'

            # Group status codes if needed
            status = str(response.status_code)
            if self.should_group_status_codes:
                status = f"{status[0]}xx"

            # Record metrics
            self.metrics.http_requests_total.labels(
                method=request.method,
                endpoint=path,
                status=status
            ).inc()

            self.metrics.http_request_duration_seconds.labels(
                method=request.method,
                endpoint=path
            ).observe(duration)

            # Record request size if available
            if request.headers.get('content-length'):
                request_size = int(request.headers['content-length'])
                self.metrics.http_request_size_bytes.labels(
                    method=request.method,
                    endpoint=path
                ).observe(request_size)

            # Record response size if available
            if response.headers.get('content-length'):
                response_size = int(response.headers['content-length'])
                self.metrics.http_response_size_bytes.labels(
                    method=request.method,
                    endpoint=path
                ).observe(response_size)

            return response

        except Exception as e:
            # Record error
            self.metrics.record_error(type(e).__name__, 'critical')
            raise

        finally:
            # Decrement in-progress requests
            self.metrics.http_requests_in_progress.dec()


def setup_metrics(app, service_name: str = None, registry: CollectorRegistry = None):
    """
    Quick setup function for FastAPI apps

    Usage:
        from fastapi import FastAPI
        from fastapi_metrics import setup_metrics

        app = FastAPI()
        metrics = setup_metrics(app, "my-service")

        @app.get("/metrics")
        async def metrics_endpoint():
            return Response(content=metrics.get_metrics(), media_type=CONTENT_TYPE_LATEST)
    """
    service_name = service_name or os.getenv('SERVICE_NAME', 'fastapi-service')

    # Create metrics service
    metrics_service = MetricsService(service_name, registry)

    # Add middleware
    app.add_middleware(PrometheusMiddleware, metrics_service=metrics_service)

    return metrics_service


# Alternative: Use with prometheus-fastapi-instrumentator
def create_instrumentator(service_name: str = None):
    """
    Create an instrumentator for prometheus-fastapi-instrumentator library
    This is an alternative approach using the external library
    """
    try:
        from prometheus_fastapi_instrumentator import Instrumentator

        instrumentator = Instrumentator(
            should_group_status_codes=True,
            should_ignore_untemplated=True,
            should_respect_env_var=True,
            should_instrument_requests_inprogress=True,
            excluded_handlers=[".*admin.*", "/metrics"],
            env_var_name="ENABLE_METRICS",
            inprogress_name="http_requests_in_progress",
            inprogress_labels=True,
        )

        # Add custom metrics if needed
        @instrumentator.add
        def custom_metrics(info):
            # Add any custom metrics here
            pass

        return instrumentator

    except ImportError:
        # Fallback if library not installed
        return None