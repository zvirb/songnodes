"""
Dead-Letter Queue (DLQ) Manager Service
========================================

FastAPI service for monitoring, analyzing, and replaying failed enrichment messages.

Endpoints:
- GET /dlq/messages - List failed messages with pagination
- GET /dlq/stats - Statistics (total failed, by error type, by service)
- POST /dlq/replay/{message_id} - Replay a specific message
- POST /dlq/replay/batch - Replay multiple messages
- DELETE /dlq/message/{message_id} - Permanently remove a message
- GET /dlq/errors/grouped - Group failures by error type
- GET /health - Health check endpoint
- GET /metrics - Prometheus metrics endpoint
"""

import logging
import json
import uuid
import traceback
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from contextlib import asynccontextmanager

import pika
from fastapi import FastAPI, HTTPException, Query, status
from fastapi.responses import PlainTextResponse, JSONResponse
from pydantic import BaseModel, Field
from prometheus_client import Counter, Gauge, Histogram, generate_latest, CONTENT_TYPE_LATEST
import sys
from pathlib import Path

# Add common module to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from common.secrets_manager import get_rabbitmq_config
from rabbitmq_setup import RabbitMQSetup

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ============================================================================
# PROMETHEUS METRICS
# ============================================================================

dlq_messages_total = Gauge(
    'dlq_messages_total',
    'Total messages in DLQ',
    ['queue']
)

dlq_messages_by_error = Gauge(
    'dlq_messages_by_error_type',
    'DLQ messages grouped by error type',
    ['error_type']
)

dlq_replay_total = Counter(
    'dlq_replay_total',
    'Total DLQ message replays',
    ['status']
)

dlq_message_age = Histogram(
    'dlq_message_age_seconds',
    'Age of messages in DLQ',
    buckets=[60, 300, 900, 3600, 86400, 604800]  # 1m, 5m, 15m, 1h, 1d, 7d
)

# ============================================================================
# PYDANTIC MODELS
# ============================================================================

class DLQMessage(BaseModel):
    """DLQ message representation"""
    message_id: str = Field(..., description="Unique message ID")
    correlation_id: Optional[str] = Field(None, description="Correlation ID for tracing")
    routing_key: str = Field(..., description="Original routing key")
    timestamp: datetime = Field(..., description="When message entered DLQ")
    retry_count: int = Field(0, description="Number of retry attempts")
    error_type: str = Field(..., description="Type of error (spotify, musicbrainz, etc.)")
    error_message: str = Field(..., description="Error message")
    stack_trace: Optional[str] = Field(None, description="Full stack trace")
    source_service: str = Field(..., description="Service that published to DLQ")
    payload: Dict[str, Any] = Field(..., description="Original message payload")
    metadata: Optional[Dict[str, Any]] = Field(None, description="Additional metadata")


class DLQStats(BaseModel):
    """DLQ statistics"""
    total_messages: int
    by_error_type: Dict[str, int]
    by_service: Dict[str, int]
    oldest_message_age_seconds: Optional[int]
    newest_message_age_seconds: Optional[int]
    queue_stats: Dict[str, int]


class ReplayRequest(BaseModel):
    """Request to replay messages"""
    message_ids: List[str] = Field(..., description="List of message IDs to replay")
    max_retries: int = Field(3, description="Maximum retry attempts")


class ReplayResponse(BaseModel):
    """Response from replay operation"""
    success: bool
    replayed_count: int
    failed_count: int
    errors: List[str] = []


class ErrorGroup(BaseModel):
    """Grouped error information"""
    error_type: str
    count: int
    sample_messages: List[str]
    first_seen: datetime
    last_seen: datetime


# ============================================================================
# DLQ MANAGER
# ============================================================================

class DLQManager:
    """Manages DLQ operations"""

    def __init__(self):
        self.config = get_rabbitmq_config()
        self.connection = None
        self.channel = None
        self.setup = RabbitMQSetup()

    def connect(self) -> bool:
        """Establish RabbitMQ connection"""
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

            logger.info("✓ DLQ Manager connected to RabbitMQ")
            return True

        except Exception as e:
            logger.error(f"Failed to connect to RabbitMQ: {e}")
            return False

    def get_messages(
        self,
        queue: str = 'enrichment.dlq.queue',
        limit: int = 100,
        offset: int = 0
    ) -> List[DLQMessage]:
        """
        Get messages from DLQ (non-destructive peek).

        Args:
            queue: Queue name to read from
            limit: Maximum messages to return
            offset: Number of messages to skip

        Returns:
            List of DLQ messages
        """
        if not self.channel:
            raise HTTPException(status_code=503, detail="Not connected to RabbitMQ")

        messages = []

        try:
            # Use basic_get to peek at messages without consuming
            for i in range(offset + limit):
                method, properties, body = self.channel.basic_get(queue=queue, auto_ack=False)

                if not method:
                    break  # No more messages

                # Skip offset messages
                if i < offset:
                    self.channel.basic_nack(delivery_tag=method.delivery_tag, requeue=True)
                    continue

                # Parse message
                try:
                    payload = json.loads(body)

                    # Extract headers
                    headers = properties.headers or {}

                    # Create DLQ message
                    dlq_msg = DLQMessage(
                        message_id=properties.message_id or str(uuid.uuid4()),
                        correlation_id=properties.correlation_id,
                        routing_key=method.routing_key,
                        timestamp=datetime.fromtimestamp(properties.timestamp) if properties.timestamp else datetime.utcnow(),
                        retry_count=headers.get('x-retry-count', 0),
                        error_type=headers.get('x-error-type', 'unknown'),
                        error_message=headers.get('x-error-message', 'No error message'),
                        stack_trace=headers.get('x-stack-trace'),
                        source_service=headers.get('x-source-service', 'unknown'),
                        payload=payload,
                        metadata=headers.get('x-metadata', {})
                    )

                    messages.append(dlq_msg)

                    # Re-queue message (non-destructive)
                    self.channel.basic_nack(delivery_tag=method.delivery_tag, requeue=True)

                except Exception as e:
                    logger.error(f"Failed to parse message: {e}")
                    self.channel.basic_nack(delivery_tag=method.delivery_tag, requeue=True)

            return messages

        except Exception as e:
            logger.error(f"Failed to get DLQ messages: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    def get_stats(self) -> DLQStats:
        """Get DLQ statistics"""
        if not self.channel:
            raise HTTPException(status_code=503, detail="Not connected to RabbitMQ")

        try:
            # Get queue stats
            queue_stats = self.setup.get_queue_stats()

            # Get sample messages for analysis
            messages = self.get_messages(limit=1000)

            # Analyze error types
            by_error_type = {}
            by_service = {}
            oldest_age = None
            newest_age = None

            for msg in messages:
                # Count by error type
                by_error_type[msg.error_type] = by_error_type.get(msg.error_type, 0) + 1

                # Count by service
                by_service[msg.source_service] = by_service.get(msg.source_service, 0) + 1

                # Track age
                age = (datetime.utcnow() - msg.timestamp).total_seconds()
                if oldest_age is None or age > oldest_age:
                    oldest_age = age
                if newest_age is None or age < newest_age:
                    newest_age = age

            # Update Prometheus metrics
            for queue, count in queue_stats.items():
                dlq_messages_total.labels(queue=queue).set(count)

            for error_type, count in by_error_type.items():
                dlq_messages_by_error.labels(error_type=error_type).set(count)

            return DLQStats(
                total_messages=queue_stats.get('enrichment.dlq.queue', 0),
                by_error_type=by_error_type,
                by_service=by_service,
                oldest_message_age_seconds=int(oldest_age) if oldest_age else None,
                newest_message_age_seconds=int(newest_age) if newest_age else None,
                queue_stats=queue_stats
            )

        except Exception as e:
            logger.error(f"Failed to get DLQ stats: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    def replay_message(self, message_id: str) -> bool:
        """
        Replay a single message from DLQ.

        Args:
            message_id: ID of message to replay

        Returns:
            True if replay successful, False otherwise
        """
        if not self.channel:
            raise HTTPException(status_code=503, detail="Not connected to RabbitMQ")

        try:
            # Find message by ID
            found = False

            while True:
                method, properties, body = self.channel.basic_get(queue='enrichment.dlq.queue', auto_ack=False)

                if not method:
                    break

                if properties.message_id == message_id:
                    found = True

                    # Publish to retry queue
                    self.channel.basic_publish(
                        exchange='',
                        routing_key='enrichment.dlq.retry',
                        body=body,
                        properties=pika.BasicProperties(
                            message_id=properties.message_id,
                            correlation_id=properties.correlation_id,
                            timestamp=int(datetime.utcnow().timestamp()),
                            headers={
                                **properties.headers,
                                'x-replayed-at': datetime.utcnow().isoformat(),
                                'x-original-routing-key': method.routing_key
                            }
                        )
                    )

                    # Acknowledge (remove from DLQ)
                    self.channel.basic_ack(delivery_tag=method.delivery_tag)

                    dlq_replay_total.labels(status='success').inc()
                    logger.info(f"✓ Replayed message {message_id}")
                    break
                else:
                    # Not the message we're looking for - re-queue
                    self.channel.basic_nack(delivery_tag=method.delivery_tag, requeue=True)

            if not found:
                dlq_replay_total.labels(status='not_found').inc()
                raise HTTPException(status_code=404, detail=f"Message {message_id} not found")

            return True

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Failed to replay message {message_id}: {e}")
            dlq_replay_total.labels(status='error').inc()
            raise HTTPException(status_code=500, detail=str(e))

    def replay_batch(self, message_ids: List[str]) -> ReplayResponse:
        """
        Replay multiple messages from DLQ.

        Args:
            message_ids: List of message IDs to replay

        Returns:
            ReplayResponse with success/failure counts
        """
        replayed = 0
        failed = 0
        errors = []

        for msg_id in message_ids:
            try:
                self.replay_message(msg_id)
                replayed += 1
            except Exception as e:
                failed += 1
                errors.append(f"{msg_id}: {str(e)}")

        return ReplayResponse(
            success=failed == 0,
            replayed_count=replayed,
            failed_count=failed,
            errors=errors
        )

    def delete_message(self, message_id: str) -> bool:
        """
        Permanently delete a message from DLQ.

        Args:
            message_id: ID of message to delete

        Returns:
            True if deletion successful, False otherwise
        """
        if not self.channel:
            raise HTTPException(status_code=503, detail="Not connected to RabbitMQ")

        try:
            found = False

            while True:
                method, properties, body = self.channel.basic_get(queue='enrichment.dlq.queue', auto_ack=False)

                if not method:
                    break

                if properties.message_id == message_id:
                    found = True

                    # Acknowledge (remove from queue)
                    self.channel.basic_ack(delivery_tag=method.delivery_tag)

                    logger.warning(f"⚠ Deleted message {message_id} from DLQ")
                    break
                else:
                    # Not the message we're looking for - re-queue
                    self.channel.basic_nack(delivery_tag=method.delivery_tag, requeue=True)

            if not found:
                raise HTTPException(status_code=404, detail=f"Message {message_id} not found")

            return True

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Failed to delete message {message_id}: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    def get_error_groups(self) -> List[ErrorGroup]:
        """
        Group DLQ messages by error type for analysis.

        Returns:
            List of error groups with statistics
        """
        try:
            messages = self.get_messages(limit=1000)

            # Group by error type
            groups = {}

            for msg in messages:
                if msg.error_type not in groups:
                    groups[msg.error_type] = {
                        'count': 0,
                        'sample_messages': [],
                        'first_seen': msg.timestamp,
                        'last_seen': msg.timestamp
                    }

                group = groups[msg.error_type]
                group['count'] += 1

                # Keep first 5 message IDs as samples
                if len(group['sample_messages']) < 5:
                    group['sample_messages'].append(msg.message_id)

                # Update timestamps
                if msg.timestamp < group['first_seen']:
                    group['first_seen'] = msg.timestamp
                if msg.timestamp > group['last_seen']:
                    group['last_seen'] = msg.timestamp

            # Convert to list
            error_groups = [
                ErrorGroup(
                    error_type=error_type,
                    count=data['count'],
                    sample_messages=data['sample_messages'],
                    first_seen=data['first_seen'],
                    last_seen=data['last_seen']
                )
                for error_type, data in groups.items()
            ]

            # Sort by count (most common first)
            error_groups.sort(key=lambda x: x.count, reverse=True)

            return error_groups

        except Exception as e:
            logger.error(f"Failed to group errors: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    def close(self):
        """Close RabbitMQ connection"""
        try:
            if self.channel and self.channel.is_open:
                self.channel.close()
            if self.connection and self.connection.is_open:
                self.connection.close()
            logger.info("✓ DLQ Manager disconnected from RabbitMQ")
        except Exception as e:
            logger.warning(f"Error closing RabbitMQ connection: {e}")


# ============================================================================
# FASTAPI APPLICATION
# ============================================================================

# Global DLQ manager instance
dlq_manager: Optional[DLQManager] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    global dlq_manager

    # Startup
    logger.info("Starting DLQ Manager service...")

    # Initialize RabbitMQ setup
    setup = RabbitMQSetup()
    if setup.connect():
        setup.setup_dlq_infrastructure()
        setup.verify_setup()
        setup.close()

    # Initialize DLQ manager
    dlq_manager = DLQManager()
    if not dlq_manager.connect():
        logger.error("Failed to connect DLQ Manager to RabbitMQ")

    logger.info("✓ DLQ Manager service started")

    yield

    # Shutdown
    logger.info("Shutting down DLQ Manager service...")
    if dlq_manager:
        dlq_manager.close()


app = FastAPI(
    title="DLQ Manager",
    description="Dead-Letter Queue management for SongNodes enrichment pipeline",
    version="1.0.0",
    lifespan=lifespan
)


# ============================================================================
# API ENDPOINTS
# ============================================================================

@app.get("/health", status_code=status.HTTP_200_OK)
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "dlq-manager",
        "timestamp": datetime.utcnow().isoformat(),
        "rabbitmq_connected": dlq_manager is not None and dlq_manager.channel is not None
    }


@app.get("/metrics", response_class=PlainTextResponse)
async def metrics():
    """Prometheus metrics endpoint"""
    return generate_latest()


@app.get("/dlq/messages", response_model=List[DLQMessage])
async def get_dlq_messages(
    limit: int = Query(100, ge=1, le=1000, description="Maximum messages to return"),
    offset: int = Query(0, ge=0, description="Number of messages to skip")
):
    """
    List failed messages in DLQ with pagination.

    Args:
        limit: Maximum messages to return (1-1000)
        offset: Number of messages to skip

    Returns:
        List of DLQ messages
    """
    if not dlq_manager:
        raise HTTPException(status_code=503, detail="DLQ Manager not initialized")

    return dlq_manager.get_messages(limit=limit, offset=offset)


@app.get("/dlq/stats", response_model=DLQStats)
async def get_dlq_stats():
    """
    Get DLQ statistics.

    Returns:
        Statistics including total messages, breakdown by error type, etc.
    """
    if not dlq_manager:
        raise HTTPException(status_code=503, detail="DLQ Manager not initialized")

    return dlq_manager.get_stats()


@app.post("/dlq/replay/{message_id}")
async def replay_message(message_id: str):
    """
    Replay a specific message from DLQ.

    Args:
        message_id: ID of message to replay

    Returns:
        Success confirmation
    """
    if not dlq_manager:
        raise HTTPException(status_code=503, detail="DLQ Manager not initialized")

    dlq_manager.replay_message(message_id)

    return {
        "success": True,
        "message": f"Message {message_id} replayed successfully"
    }


@app.post("/dlq/replay/batch", response_model=ReplayResponse)
async def replay_batch(request: ReplayRequest):
    """
    Replay multiple messages from DLQ.

    Args:
        request: ReplayRequest containing message IDs

    Returns:
        ReplayResponse with success/failure counts
    """
    if not dlq_manager:
        raise HTTPException(status_code=503, detail="DLQ Manager not initialized")

    return dlq_manager.replay_batch(request.message_ids)


@app.delete("/dlq/message/{message_id}")
async def delete_message(message_id: str):
    """
    Permanently delete a message from DLQ.

    WARNING: This operation cannot be undone.

    Args:
        message_id: ID of message to delete

    Returns:
        Success confirmation
    """
    if not dlq_manager:
        raise HTTPException(status_code=503, detail="DLQ Manager not initialized")

    dlq_manager.delete_message(message_id)

    return {
        "success": True,
        "message": f"Message {message_id} permanently deleted"
    }


@app.get("/dlq/errors/grouped", response_model=List[ErrorGroup])
async def get_error_groups():
    """
    Group DLQ messages by error type for analysis.

    Returns:
        List of error groups with statistics
    """
    if not dlq_manager:
        raise HTTPException(status_code=503, detail="DLQ Manager not initialized")

    return dlq_manager.get_error_groups()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8024,
        log_level="info"
    )
