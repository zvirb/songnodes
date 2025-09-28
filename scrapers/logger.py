"""
Centralized logging module for scrapers with OpenTelemetry integration.
Provides structured logging with correlation IDs and distributed tracing.
"""

import structlog
import logging
import functools
from typing import Any, Dict, Optional, Callable
from datetime import datetime
import uuid
import json
from contextlib import contextmanager

try:
    from opentelemetry import trace
    from opentelemetry.sdk.trace import TracerProvider
    from opentelemetry.sdk.trace.export import BatchSpanProcessor
    from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
    from opentelemetry.instrumentation.psycopg2 import Psycopg2Instrumentor
    from opentelemetry.sdk.resources import Resource
    from opentelemetry.semconv.resource import ResourceAttributes

    OTEL_ENABLED = True
except ImportError:
    OTEL_ENABLED = False
    print("OpenTelemetry not available - tracing disabled")

# Configure OpenTelemetry if available
if OTEL_ENABLED:
    # Create resource identifying this service
    resource = Resource.create({
        ResourceAttributes.SERVICE_NAME: "scrapers",
        ResourceAttributes.SERVICE_VERSION: "1.0.0",
    })

    # Set up tracer provider
    provider = TracerProvider(resource=resource)

    # Configure OTLP exporter (sends to OpenTelemetry Collector)
    try:
        otlp_exporter = OTLPSpanExporter(
            endpoint="otel-collector:4317",
            insecure=True
        )
        span_processor = BatchSpanProcessor(otlp_exporter)
        provider.add_span_processor(span_processor)
        trace.set_tracer_provider(provider)

        # Auto-instrument database calls
        Psycopg2Instrumentor().instrument()

        tracer = trace.get_tracer(__name__)
    except Exception as e:
        print(f"Failed to initialize OpenTelemetry: {e}")
        OTEL_ENABLED = False
        tracer = None
else:
    tracer = None

# Configure structlog for JSON output
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        structlog.processors.JSONRenderer()
    ],
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    cache_logger_on_first_use=True,
)

def get_logger(name: str = None) -> structlog.BoundLogger:
    """
    Get a configured logger instance with correlation ID.

    Args:
        name: Logger name (defaults to module name)

    Returns:
        Configured structlog logger
    """
    logger = structlog.get_logger(name or __name__)

    # Add correlation ID for request tracking
    correlation_id = str(uuid.uuid4())
    logger = logger.bind(correlation_id=correlation_id)

    # Add service metadata
    logger = logger.bind(
        service="scrapers",
        environment="production",
        timestamp=datetime.utcnow().isoformat()
    )

    return logger

def trace_operation(operation_name: str = None):
    """
    Decorator to add distributed tracing to functions.
    Creates a span for the decorated function execution.

    Args:
        operation_name: Custom name for the operation (defaults to function name)
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            if OTEL_ENABLED and tracer:
                span_name = operation_name or f"{func.__module__}.{func.__name__}"
                with tracer.start_as_current_span(span_name) as span:
                    # Add function arguments as span attributes
                    span.set_attribute("function.module", func.__module__)
                    span.set_attribute("function.name", func.__name__)

                    try:
                        result = func(*args, **kwargs)
                        span.set_status(trace.Status(trace.StatusCode.OK))
                        return result
                    except Exception as e:
                        # Record exception in span
                        span.record_exception(e)
                        span.set_status(
                            trace.Status(trace.StatusCode.ERROR, str(e))
                        )
                        raise
            else:
                # No tracing available, just execute function
                return func(*args, **kwargs)

        return wrapper
    return decorator

@contextmanager
def log_context(**kwargs):
    """
    Context manager to add temporary context to logs.

    Usage:
        with log_context(user_id=123, action="scraping"):
            logger.info("Starting scrape")
    """
    logger = structlog.get_logger()
    try:
        for key, value in kwargs.items():
            logger = logger.bind(**{key: value})
        yield logger
    finally:
        for key in kwargs:
            logger = logger.unbind(key)

class LogAdapter:
    """
    Adapter to make structlog compatible with standard logging.
    Useful for libraries that expect standard Python logger.
    """
    def __init__(self, logger):
        self.logger = logger

    def debug(self, msg, *args, **kwargs):
        self.logger.debug(msg, *args, **kwargs)

    def info(self, msg, *args, **kwargs):
        self.logger.info(msg, *args, **kwargs)

    def warning(self, msg, *args, **kwargs):
        self.logger.warning(msg, *args, **kwargs)

    def error(self, msg, *args, **kwargs):
        self.logger.error(msg, *args, **kwargs)

    def exception(self, msg, *args, **kwargs):
        self.logger.exception(msg, *args, **kwargs)

    def critical(self, msg, *args, **kwargs):
        self.logger.critical(msg, *args, **kwargs)

# Configure standard logging to work with structlog
logging.basicConfig(
    format="%(message)s",
    stream=None,  # Will use structlog's output
    level=logging.INFO
)

# Export commonly used functions
__all__ = [
    'get_logger',
    'trace_operation',
    'log_context',
    'LogAdapter'
]