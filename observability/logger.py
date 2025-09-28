"""
SongNodes Observability Helper Module
Provides structured logging, metrics, and tracing for all services
"""

import json
import logging
import time
import uuid
from datetime import datetime
from typing import Dict, Any, Optional, Union
from pathlib import Path
import threading
from contextlib import contextmanager

import structlog
from opentelemetry import trace, metrics
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.exporter.otlp.proto.grpc.metric_exporter import OTLPMetricExporter
from opentelemetry.instrumentation.requests import RequestsInstrumentor
from opentelemetry.instrumentation.psycopg2 import Psycopg2Instrumentor
from opentelemetry.instrumentation.redis import RedisInstrumentor
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
from opentelemetry.sdk.resources import Resource


class SongNodesLogger:
    """
    Advanced structured logger with OpenTelemetry integration
    Supports correlation IDs, distributed tracing, and contextual metadata
    """

    def __init__(self, service_name: str, log_dir: str = "./logs", otel_endpoint: str = "http://otel-collector:4317"):
        self.service_name = service_name
        self.log_dir = Path(log_dir)
        self.otel_endpoint = otel_endpoint

        # Thread-local storage for context
        self._local = threading.local()

        # Ensure log directories exist
        self._create_log_directories()

        # Initialize OpenTelemetry
        self._setup_opentelemetry()

        # Initialize structured logging
        self._setup_structured_logging()

        # Initialize metrics
        self._setup_metrics()

    def _create_log_directories(self):
        """Create log directory structure"""
        directories = [
            self.log_dir,
            self.log_dir / "scrapers",
            self.log_dir / "database",
            self.log_dir / "api"
        ]

        for directory in directories:
            directory.mkdir(parents=True, exist_ok=True)

    def _setup_opentelemetry(self):
        """Configure OpenTelemetry tracing and metrics"""
        # Resource identification
        resource = Resource.create({
            "service.name": self.service_name,
            "service.namespace": "songnodes",
            "deployment.environment": "docker-compose"
        })

        # Tracing setup
        trace.set_tracer_provider(TracerProvider(resource=resource))

        # OTLP Span Exporter
        otlp_exporter = OTLPSpanExporter(endpoint=self.otel_endpoint, insecure=True)
        span_processor = BatchSpanProcessor(otlp_exporter)
        trace.get_tracer_provider().add_span_processor(span_processor)

        # Get tracer
        self.tracer = trace.get_tracer(self.service_name)

        # Metrics setup
        metric_reader = PeriodicExportingMetricReader(
            OTLPMetricExporter(endpoint=self.otel_endpoint, insecure=True),
            export_interval_millis=30000
        )

        metrics.set_meter_provider(MeterProvider(resource=resource, metric_readers=[metric_reader]))
        self.meter = metrics.get_meter(self.service_name)

        # Auto-instrument common libraries
        RequestsInstrumentor().instrument()
        Psycopg2Instrumentor().instrument()
        RedisInstrumentor().instrument()

    def _setup_structured_logging(self):
        """Configure structured logging with JSON output"""
        # Configure structlog
        structlog.configure(
            processors=[
                structlog.stdlib.filter_by_level,
                structlog.stdlib.add_logger_name,
                structlog.stdlib.add_log_level,
                structlog.processors.TimeStamper(fmt="iso"),
                self._add_correlation_context,
                structlog.processors.JSONRenderer()
            ],
            context_class=dict,
            logger_factory=structlog.stdlib.LoggerFactory(),
            wrapper_class=structlog.stdlib.BoundLogger,
            cache_logger_on_first_use=True,
        )

        # Create loggers for different components
        self.logger = structlog.get_logger(self.service_name)

        # File handlers for different log types
        log_files = {
            'main': self.log_dir / f"{self.service_name}.log",
            'scrapers': self.log_dir / "scrapers" / f"{self.service_name}.log",
            'database': self.log_dir / "database" / f"{self.service_name}.log",
            'api': self.log_dir / "api" / f"{self.service_name}.log"
        }

        # Configure Python standard logging as fallback
        logging.basicConfig(
            level=logging.INFO,
            format='%(message)s',
            handlers=[
                logging.FileHandler(log_files['main']),
                logging.StreamHandler()
            ]
        )

    def _setup_metrics(self):
        """Initialize custom metrics for SongNodes"""
        # Scraper metrics
        self.scraper_requests_total = self.meter.create_counter(
            "scraper_requests_total",
            description="Total number of scraper requests"
        )

        self.scraper_success_total = self.meter.create_counter(
            "scraper_success_total",
            description="Total number of successful scraper requests"
        )

        self.scraper_errors_total = self.meter.create_counter(
            "scraper_errors_total",
            description="Total number of scraper errors"
        )

        self.tracks_discovered_total = self.meter.create_counter(
            "tracks_discovered_total",
            description="Total number of tracks discovered"
        )

        self.llm_adaptations_total = self.meter.create_counter(
            "llm_adaptations_total",
            description="Total number of LLM selector adaptations"
        )

        # Database metrics
        self.db_operations_total = self.meter.create_counter(
            "db_operations_total",
            description="Total database operations"
        )

        self.db_query_duration = self.meter.create_histogram(
            "db_query_duration_seconds",
            description="Database query duration in seconds"
        )

        # API metrics
        self.api_requests_total = self.meter.create_counter(
            "api_requests_total",
            description="Total API requests"
        )

        self.api_response_time = self.meter.create_histogram(
            "api_response_time_seconds",
            description="API response time in seconds"
        )

    def _add_correlation_context(self, logger, method_name, event_dict):
        """Add correlation context to log events"""
        # Add trace and span IDs if available
        current_span = trace.get_current_span()
        if current_span:
            span_context = current_span.get_span_context()
            if span_context.is_valid:
                event_dict["trace_id"] = format(span_context.trace_id, "032x")
                event_dict["span_id"] = format(span_context.span_id, "016x")

        # Add correlation ID
        correlation_id = getattr(self._local, 'correlation_id', None)
        if correlation_id:
            event_dict["correlation_id"] = correlation_id

        # Add service name
        event_dict["service"] = self.service_name

        # Add user context if available
        user_id = getattr(self._local, 'user_id', None)
        if user_id:
            event_dict["user_id"] = user_id

        return event_dict

    def set_correlation_id(self, correlation_id: str = None):
        """Set correlation ID for request tracking"""
        if correlation_id is None:
            correlation_id = str(uuid.uuid4())
        self._local.correlation_id = correlation_id
        return correlation_id

    def set_user_context(self, user_id: str):
        """Set user context for logging"""
        self._local.user_id = user_id

    def clear_context(self):
        """Clear thread-local context"""
        self._local.correlation_id = None
        self._local.user_id = None

    @contextmanager
    def operation_span(self, operation_name: str, **attributes):
        """Context manager for tracing operations"""
        with self.tracer.start_as_current_span(operation_name) as span:
            # Add custom attributes
            for key, value in attributes.items():
                span.set_attribute(key, value)

            start_time = time.time()
            try:
                yield span
            except Exception as e:
                span.record_exception(e)
                span.set_status(trace.Status(trace.StatusCode.ERROR, str(e)))
                raise
            finally:
                duration = time.time() - start_time
                span.set_attribute("duration_ms", duration * 1000)

    # Scraper-specific logging methods
    def log_scraper_request(self, scraper_name: str, url: str, **metadata):
        """Log scraper request start"""
        self.scraper_requests_total.add(1, {"scraper": scraper_name})
        self.logger.info(
            "Scraper request started",
            scraper_name=scraper_name,
            target_url=url,
            **metadata
        )

    def log_scraper_success(self, scraper_name: str, url: str, tracks_found: int,
                           response_time_ms: float, **metadata):
        """Log successful scraper operation"""
        self.scraper_success_total.add(1, {"scraper": scraper_name})
        self.tracks_discovered_total.add(tracks_found, {"scraper": scraper_name})

        self.logger.info(
            "Scraper request successful",
            scraper_name=scraper_name,
            target_url=url,
            tracks_found=tracks_found,
            response_time_ms=response_time_ms,
            **metadata
        )

    def log_scraper_error(self, scraper_name: str, url: str, error: str,
                         status_code: int = None, **metadata):
        """Log scraper error"""
        self.scraper_errors_total.add(1, {
            "scraper": scraper_name,
            "error_type": type(error).__name__ if isinstance(error, Exception) else "unknown"
        })

        self.logger.error(
            "Scraper request failed",
            scraper_name=scraper_name,
            target_url=url,
            error=str(error),
            status_code=status_code,
            **metadata
        )

    def log_llm_adaptation(self, scraper_name: str, original_selector: str,
                          adapted_selector: str, llm_model: str, **metadata):
        """Log LLM selector adaptation"""
        self.llm_adaptations_total.add(1, {
            "scraper": scraper_name,
            "llm_model": llm_model
        })

        self.logger.info(
            "LLM selector adaptation performed",
            scraper_name=scraper_name,
            original_selector=original_selector,
            adapted_selector=adapted_selector,
            llm_model=llm_model,
            **metadata
        )

    # Database-specific logging methods
    def log_db_operation(self, operation: str, table_name: str, rows_affected: int = None,
                        query_time_ms: float = None, **metadata):
        """Log database operation"""
        labels = {"operation": operation, "table": table_name}
        self.db_operations_total.add(1, labels)

        if query_time_ms:
            self.db_query_duration.record(query_time_ms / 1000, labels)

        self.logger.info(
            "Database operation completed",
            operation=operation,
            table_name=table_name,
            rows_affected=rows_affected,
            query_time_ms=query_time_ms,
            **metadata
        )

    def log_db_error(self, operation: str, table_name: str, error: str, **metadata):
        """Log database error"""
        self.logger.error(
            "Database operation failed",
            operation=operation,
            table_name=table_name,
            error=str(error),
            **metadata
        )

    # API-specific logging methods
    def log_api_request(self, method: str, endpoint: str, user_id: str = None, **metadata):
        """Log API request start"""
        self.api_requests_total.add(1, {"method": method, "endpoint": endpoint})

        if user_id:
            self.set_user_context(user_id)

        self.logger.info(
            "API request started",
            method=method,
            endpoint=endpoint,
            user_id=user_id,
            **metadata
        )

    def log_api_response(self, method: str, endpoint: str, status_code: int,
                        response_time_ms: float, **metadata):
        """Log API response"""
        labels = {
            "method": method,
            "endpoint": endpoint,
            "status_code": str(status_code)
        }

        self.api_response_time.record(response_time_ms / 1000, labels)

        self.logger.info(
            "API request completed",
            method=method,
            endpoint=endpoint,
            status_code=status_code,
            response_time_ms=response_time_ms,
            **metadata
        )

    def log_api_error(self, method: str, endpoint: str, error: str,
                     status_code: int = 500, **metadata):
        """Log API error"""
        self.logger.error(
            "API request failed",
            method=method,
            endpoint=endpoint,
            error=str(error),
            status_code=status_code,
            **metadata
        )

    # General logging methods
    def info(self, message: str, **metadata):
        """Log info message"""
        self.logger.info(message, **metadata)

    def warning(self, message: str, **metadata):
        """Log warning message"""
        self.logger.warning(message, **metadata)

    def error(self, message: str, **metadata):
        """Log error message"""
        self.logger.error(message, **metadata)

    def debug(self, message: str, **metadata):
        """Log debug message"""
        self.logger.debug(message, **metadata)


# Global logger instance factory
_loggers = {}

def get_logger(service_name: str, **kwargs) -> SongNodesLogger:
    """Get or create a logger instance for a service"""
    if service_name not in _loggers:
        _loggers[service_name] = SongNodesLogger(service_name, **kwargs)
    return _loggers[service_name]


# Decorator for automatic operation tracing
def trace_operation(operation_name: str = None, logger_name: str = None):
    """Decorator to automatically trace function execution"""
    def decorator(func):
        def wrapper(*args, **kwargs):
            # Get logger
            logger = get_logger(logger_name or func.__module__)

            # Generate operation name
            op_name = operation_name or f"{func.__module__}.{func.__name__}"

            # Set correlation ID if not exists
            logger.set_correlation_id()

            with logger.operation_span(op_name) as span:
                try:
                    result = func(*args, **kwargs)
                    span.set_attribute("success", True)
                    return result
                except Exception as e:
                    span.set_attribute("success", False)
                    span.set_attribute("error.type", type(e).__name__)
                    span.set_attribute("error.message", str(e))
                    raise

        return wrapper
    return decorator


# Context manager for request tracking
@contextmanager
def request_context(correlation_id: str = None, user_id: str = None, service_name: str = "default"):
    """Context manager for request-scoped logging context"""
    logger = get_logger(service_name)

    # Set context
    logger.set_correlation_id(correlation_id)
    if user_id:
        logger.set_user_context(user_id)

    try:
        yield logger
    finally:
        # Clear context
        logger.clear_context()