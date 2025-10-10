"""
Dead-Letter Queue (DLQ) Client Library
=======================================

Reusable library for publishing failed enrichments to DLQ with full error context.

Usage:
    from common.dlq_client import DLQClient

    dlq = DLQClient()
    dlq.publish_to_dlq(
        item=track_item,
        error=exception,
        retry_count=3,
        source_service='api-enrichment-pipeline',
        metadata={'spotify_id': 'abc123'}
    )
"""

import logging
import json
import uuid
import traceback
from datetime import datetime
from typing import Dict, Optional, Any

import pika
from pika.exceptions import AMQPError

from secrets_manager import get_rabbitmq_config

logger = logging.getLogger(__name__)


class DLQClient:
    """
    Client for publishing failed enrichments to Dead-Letter Queue.

    Features:
    - Automatic error classification
    - Full stack trace capture
    - Correlation ID tracking
    - Retry count tracking
    - Metadata enrichment
    """

    # Error type mappings
    ERROR_TYPE_MAPPING = {
        'spotify': 'spotify.enrichment.failed',
        'musicbrainz': 'musicbrainz.enrichment.failed',
        'lastfm': 'lastfm.enrichment.failed',
        'audio_analysis': 'audio_analysis.enrichment.failed',
        'discogs': 'discogs.enrichment.failed',
        'general': 'general.enrichment.failed'
    }

    def __init__(self, config: Optional[Dict] = None, auto_connect: bool = True):
        """
        Initialize DLQ client.

        Args:
            config: Optional RabbitMQ configuration
            auto_connect: If True, connect immediately
        """
        self.config = config or get_rabbitmq_config()
        self.connection = None
        self.channel = None

        if auto_connect:
            self.connect()

    def connect(self) -> bool:
        """
        Establish connection to RabbitMQ.

        Returns:
            True if connection successful, False otherwise
        """
        try:
            credentials = pika.PlainCredentials(
                username=self.config['username'],
                password=self.config['password']
            )

            parameters = pika.ConnectionParameters(
                host=self.config['host'],
                port=self.config['port'],
                virtual_host=self.config['vhost'],
                credentials=credentials,
                heartbeat=600,
                blocked_connection_timeout=300
            )

            self.connection = pika.BlockingConnection(parameters)
            self.channel = self.connection.channel()

            logger.debug("✓ DLQ Client connected to RabbitMQ")
            return True

        except Exception as e:
            logger.error(f"Failed to connect DLQ Client to RabbitMQ: {e}")
            return False

    def publish_to_dlq(
        self,
        item: Dict[str, Any],
        error: Exception,
        retry_count: int,
        source_service: str,
        error_type: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
        correlation_id: Optional[str] = None
    ) -> bool:
        """
        Publish failed item to DLQ with enriched error context.

        Args:
            item: Original item that failed enrichment
            error: Exception that occurred
            retry_count: Number of retry attempts
            source_service: Name of service publishing to DLQ
            error_type: Type of error (spotify, musicbrainz, etc.) - auto-detected if None
            metadata: Additional metadata to attach
            correlation_id: Correlation ID for tracing (generated if None)

        Returns:
            True if publish successful, False otherwise
        """
        if not self.channel:
            logger.error("DLQ Client not connected - attempting reconnect")
            if not self.connect():
                return False

        try:
            # Generate message ID and correlation ID
            message_id = str(uuid.uuid4())
            correlation_id = correlation_id or str(uuid.uuid4())

            # Auto-detect error type from exception message
            if error_type is None:
                error_type = self._detect_error_type(error)

            # Get routing key
            routing_key = self.ERROR_TYPE_MAPPING.get(error_type, 'general.enrichment.failed')

            # Build error context
            error_context = {
                'error_type': error_type,
                'error_class': error.__class__.__name__,
                'error_message': str(error),
                'stack_trace': traceback.format_exc(),
                'timestamp': datetime.utcnow().isoformat(),
                'retry_count': retry_count,
                'source_service': source_service,
                'correlation_id': correlation_id
            }

            # Build payload
            payload = {
                'item': item,
                'error_context': error_context,
                'metadata': metadata or {}
            }

            # Build message properties
            properties = pika.BasicProperties(
                message_id=message_id,
                correlation_id=correlation_id,
                timestamp=int(datetime.utcnow().timestamp()),
                content_type='application/json',
                delivery_mode=2,  # Persistent
                headers={
                    'x-retry-count': retry_count,
                    'x-error-type': error_type,
                    'x-error-message': str(error)[:500],  # Truncate long messages
                    'x-stack-trace': traceback.format_exc()[:2000],  # Truncate long traces
                    'x-source-service': source_service,
                    'x-metadata': metadata or {},
                    'x-failed-at': datetime.utcnow().isoformat()
                }
            )

            # Publish to DLQ exchange
            self.channel.basic_publish(
                exchange='enrichment.dlq.exchange',
                routing_key=routing_key,
                body=json.dumps(payload),
                properties=properties
            )

            logger.info(
                f"✓ Published to DLQ: {error_type} | "
                f"Service: {source_service} | "
                f"Retry: {retry_count} | "
                f"Message ID: {message_id}"
            )

            return True

        except AMQPError as e:
            logger.error(f"Failed to publish to DLQ (AMQP error): {e}")
            return False

        except Exception as e:
            logger.error(f"Failed to publish to DLQ: {e}", exc_info=True)
            return False

    def _detect_error_type(self, error: Exception) -> str:
        """
        Auto-detect error type from exception.

        Args:
            error: Exception to analyze

        Returns:
            Error type string (spotify, musicbrainz, etc.)
        """
        error_str = str(error).lower()
        error_class = error.__class__.__name__.lower()

        # Check error message and class name
        if 'spotify' in error_str or 'spotify' in error_class:
            return 'spotify'
        elif 'musicbrainz' in error_str or 'musicbrainz' in error_class:
            return 'musicbrainz'
        elif 'lastfm' in error_str or 'last.fm' in error_str:
            return 'lastfm'
        elif 'audio' in error_str or 'analysis' in error_str:
            return 'audio_analysis'
        elif 'discogs' in error_str:
            return 'discogs'
        else:
            return 'general'

    def publish_batch_to_dlq(
        self,
        items: list,
        error: Exception,
        source_service: str,
        error_type: Optional[str] = None
    ) -> int:
        """
        Publish multiple failed items to DLQ.

        Args:
            items: List of items that failed
            error: Exception that occurred
            source_service: Name of service publishing to DLQ
            error_type: Type of error (auto-detected if None)

        Returns:
            Number of items successfully published
        """
        success_count = 0

        for item in items:
            if self.publish_to_dlq(
                item=item,
                error=error,
                retry_count=0,
                source_service=source_service,
                error_type=error_type
            ):
                success_count += 1

        return success_count

    def close(self):
        """Close RabbitMQ connection"""
        try:
            if self.channel and self.channel.is_open:
                self.channel.close()
            if self.connection and self.connection.is_open:
                self.connection.close()
            logger.debug("✓ DLQ Client disconnected from RabbitMQ")
        except Exception as e:
            logger.warning(f"Error closing DLQ Client connection: {e}")

    def __enter__(self):
        """Context manager entry"""
        if not self.channel:
            self.connect()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit"""
        self.close()


# Convenience function for one-off publishes
def publish_to_dlq(
    item: Dict[str, Any],
    error: Exception,
    retry_count: int,
    source_service: str,
    **kwargs
) -> bool:
    """
    Convenience function to publish a single item to DLQ.

    Args:
        item: Original item that failed
        error: Exception that occurred
        retry_count: Number of retry attempts
        source_service: Name of service publishing to DLQ
        **kwargs: Additional arguments passed to DLQClient.publish_to_dlq()

    Returns:
        True if publish successful, False otherwise
    """
    with DLQClient() as client:
        return client.publish_to_dlq(
            item=item,
            error=error,
            retry_count=retry_count,
            source_service=source_service,
            **kwargs
        )


# Convenience exports
__all__ = [
    'DLQClient',
    'publish_to_dlq'
]
