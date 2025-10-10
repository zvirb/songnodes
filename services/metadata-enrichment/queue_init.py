"""
RabbitMQ Queue Initialization for Enrichment Pipeline
======================================================

Initializes enrichment-specific queues, exchanges, and bindings.
Blueprint Section 3: Multi-Queue Strategy for Prioritization

Queues created:
- metadata_enrichment_queue (priority queue for real-time enrichment)
- metadata_enrichment_dlx (dead-letter exchange for failed tasks)
- metadata_enrichment_dlq (dead-letter queue for inspection)

Usage:
    python -m queue_init
"""

import os
import sys
import asyncio
import logging
from typing import Optional

import aio_pika
from aio_pika import ExchangeType, DeliveryMode

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class EnrichmentQueueInitializer:
    """Initialize RabbitMQ queues for enrichment pipeline (Blueprint Section 3.2)"""

    def __init__(
        self,
        rabbitmq_url: Optional[str] = None,
        host: Optional[str] = None,
        port: int = 5672,
        user: Optional[str] = None,
        password: Optional[str] = None,
        vhost: str = "musicdb"
    ):
        if rabbitmq_url:
            self.rabbitmq_url = rabbitmq_url
        else:
            host = host or os.getenv('RABBITMQ_HOST', 'rabbitmq')
            port = int(os.getenv('RABBITMQ_PORT', port))
            user = user or os.getenv('RABBITMQ_USER', 'musicdb')
            password = password or os.getenv('RABBITMQ_PASS', 'rabbitmq_secure_pass_2024')
            vhost = os.getenv('RABBITMQ_VHOST', vhost)

            self.rabbitmq_url = f"amqp://{user}:{password}@{host}:{port}/{vhost}"

        self.connection = None
        self.channel = None

    async def connect(self):
        """Establish connection to RabbitMQ"""
        try:
            self.connection = await aio_pika.connect_robust(
                self.rabbitmq_url,
                timeout=30
            )
            self.channel = await self.connection.channel()
            await self.channel.set_qos(prefetch_count=1)  # Fair dispatch
            logger.info("✓ Connected to RabbitMQ")
        except Exception as e:
            logger.error(f"Failed to connect to RabbitMQ: {e}")
            raise

    async def initialize_queues(self):
        """
        Initialize all enrichment queues with proper configuration.
        Blueprint Section 3.2: Multi-Queue Strategy
        """

        # ========================================================================
        # STEP 1: Declare Dead-Letter Exchange (DLX) and Queue
        # Blueprint Section 6.2: DLQ for Terminal Failures
        # ========================================================================

        logger.info("Creating Dead-Letter Exchange...")
        dlx_exchange = await self.channel.declare_exchange(
            'metadata_enrichment_dlx',
            type=ExchangeType.DIRECT,
            durable=True
        )

        dlq = await self.channel.declare_queue(
            'metadata_enrichment_dlq',
            durable=True,
            arguments={
                'x-message-ttl': 86400000 * 7,  # 7 days retention
                'x-max-length': 10000  # Limit DLQ size
            }
        )

        await dlq.bind(dlx_exchange, routing_key='failed')
        logger.info("✓ Dead-Letter Queue configured")

        # ========================================================================
        # STEP 2: Declare Main Enrichment Queue (with Priority Support)
        # Blueprint Section 3.2: Prioritized Task Queuing
        # ========================================================================

        logger.info("Creating main enrichment queue...")
        enrichment_queue = await self.channel.declare_queue(
            'metadata_enrichment_queue',
            durable=True,
            arguments={
                'x-message-ttl': 86400000,  # 24 hours before auto-expire
                'x-max-priority': 10,  # Priority range: 0-10 (10 = highest)
                'x-dead-letter-exchange': 'metadata_enrichment_dlx',
                'x-dead-letter-routing-key': 'failed',
                'x-max-length': 100000  # Prevent unbounded queue growth
            }
        )
        logger.info("✓ Main enrichment queue configured (priority enabled)")

        # ========================================================================
        # STEP 3: Declare Backlog Queue (Low Priority)
        # Blueprint Section 3.2: Separate queue for backlog processing
        # ========================================================================

        logger.info("Creating backlog enrichment queue...")
        backlog_queue = await self.channel.declare_queue(
            'metadata_enrichment_backlog_queue',
            durable=True,
            arguments={
                'x-message-ttl': 86400000 * 7,  # 7 days before auto-expire
                'x-dead-letter-exchange': 'metadata_enrichment_dlx',
                'x-dead-letter-routing-key': 'failed',
                'x-max-length': 1000000  # Large limit for backlog
            }
        )
        logger.info("✓ Backlog enrichment queue configured")

        # ========================================================================
        # STEP 4: Declare Re-Enrichment Queue (Stale Data Refresh)
        # Blueprint Section 5.3: Incremental Re-Enrichment
        # ========================================================================

        logger.info("Creating re-enrichment queue...")
        reenrichment_queue = await self.channel.declare_queue(
            'metadata_reenrichment_queue',
            durable=True,
            arguments={
                'x-message-ttl': 86400000 * 30,  # 30 days before auto-expire
                'x-dead-letter-exchange': 'metadata_enrichment_dlx',
                'x-dead-letter-routing-key': 'failed'
            }
        )
        logger.info("✓ Re-enrichment queue configured")

        logger.info("\n" + "="*60)
        logger.info("Queue Initialization Complete")
        logger.info("="*60)
        logger.info(f"Main queue:        metadata_enrichment_queue (priority: 0-10)")
        logger.info(f"Backlog queue:     metadata_enrichment_backlog_queue")
        logger.info(f"Re-enrichment:     metadata_reenrichment_queue")
        logger.info(f"Dead-letter queue: metadata_enrichment_dlq")
        logger.info("="*60)

    async def get_queue_stats(self):
        """Display current queue statistics"""
        try:
            queues = [
                'metadata_enrichment_queue',
                'metadata_enrichment_backlog_queue',
                'metadata_reenrichment_queue',
                'metadata_enrichment_dlq'
            ]

            logger.info("\nQueue Statistics:")
            logger.info("="*60)

            for queue_name in queues:
                queue = await self.channel.declare_queue(
                    queue_name,
                    passive=True  # Don't create, just check
                )
                logger.info(f"{queue_name:45} {queue.declaration_result.message_count:>6} messages")

            logger.info("="*60)
        except Exception as e:
            logger.warning(f"Could not fetch queue stats: {e}")

    async def close(self):
        """Close RabbitMQ connection"""
        if self.connection and not self.connection.is_closed:
            await self.connection.close()
            logger.info("✓ RabbitMQ connection closed")


async def main():
    """Main entry point for queue initialization"""
    initializer = EnrichmentQueueInitializer()

    try:
        await initializer.connect()
        await initializer.initialize_queues()
        await initializer.get_queue_stats()

        logger.info("\n✅ Queue initialization successful!")
        logger.info("Workers can now connect to: metadata_enrichment_queue")

    except Exception as e:
        logger.error(f"❌ Queue initialization failed: {e}")
        sys.exit(1)
    finally:
        await initializer.close()


if __name__ == "__main__":
    asyncio.run(main())
