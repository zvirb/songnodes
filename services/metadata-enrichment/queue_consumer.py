"""
RabbitMQ Queue Consumer for Enrichment Workers
===============================================

Consumes enrichment tasks from RabbitMQ and processes them asynchronously.
Blueprint Section 3: Decoupled Enrichment Processing

This consumer enables:
- Horizontal scaling (multiple worker instances)
- Independent scaling of enrichment from scraping
- Load balancing via RabbitMQ
- Graceful shutdown with message acknowledgment
"""

import os
import asyncio
import logging
import json
from typing import Dict, Optional
from datetime import datetime

import aio_pika
from aio_pika import IncomingMessage
from aio_pika.abc import AbstractIncomingMessage

# Import enrichment components
from worker_bootstrap import WorkerBootstrap
from main import EnrichmentTask, EnrichmentResult, EnrichmentStatus

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class EnrichmentQueueConsumer:
    """
    RabbitMQ consumer for enrichment tasks.
    Blueprint Section 3.3: Queue Consumer Implementation
    """

    def __init__(
        self,
        queue_name: str = 'metadata_enrichment_queue',
        rabbitmq_url: Optional[str] = None,
        prefetch_count: int = 1,
        bootstrap: Optional[WorkerBootstrap] = None
    ):
        self.queue_name = queue_name
        self.prefetch_count = prefetch_count
        self.bootstrap = bootstrap

        # Build RabbitMQ URL
        if rabbitmq_url:
            self.rabbitmq_url = rabbitmq_url
        else:
            host = os.getenv('RABBITMQ_HOST', 'rabbitmq')
            port = int(os.getenv('RABBITMQ_PORT', 5672))
            user = os.getenv('RABBITMQ_USER', 'musicdb')
            password = os.getenv('RABBITMQ_PASS', 'rabbitmq_secure_pass_2024')
            vhost = os.getenv('RABBITMQ_VHOST', 'musicdb')

            self.rabbitmq_url = f"amqp://{user}:{password}@{host}:{port}/{vhost}"

        self.connection = None
        self.channel = None
        self.queue = None
        self.consumer_tag = None

        # Statistics
        self.stats = {
            'messages_processed': 0,
            'messages_succeeded': 0,
            'messages_failed': 0,
            'messages_requeued': 0,
            'start_time': datetime.utcnow()
        }

    async def connect(self):
        """Establish connection to RabbitMQ with reconnection support"""
        try:
            # Use connect_robust for automatic reconnection
            self.connection = await aio_pika.connect_robust(
                self.rabbitmq_url,
                timeout=30
            )

            self.channel = await self.connection.channel()

            # Set QoS (Blueprint Section 3.4: Rate Limiting)
            # prefetch_count=1 ensures fair dispatch across workers
            await self.channel.set_qos(prefetch_count=self.prefetch_count)

            # Declare queue (passive=False creates if not exists)
            self.queue = await self.channel.declare_queue(
                self.queue_name,
                durable=True,
                passive=False
            )

            logger.info(f"✓ Connected to RabbitMQ queue: {self.queue_name}")
            logger.info(f"  Prefetch count: {self.prefetch_count}")
            logger.info(f"  Queue depth: {self.queue.declaration_result.message_count} messages")

        except Exception as e:
            logger.error(f"Failed to connect to RabbitMQ: {e}")
            raise

    async def process_message(self, message: AbstractIncomingMessage):
        """
        Process a single enrichment task.
        Blueprint Section 6.1: Robust Error Handling with Retries
        """
        async with message.process():
            try:
                # Parse message body
                task_data = json.loads(message.body.decode())

                logger.info(f"Processing enrichment task: {task_data.get('track_id', 'unknown')}")

                # Extract task parameters
                track_id = task_data.get('track_id')
                artist_name = task_data.get('artist')
                track_title = task_data.get('title')
                priority = task_data.get('priority', 5)
                retry_count = task_data.get('retry_count', 0)

                # Validate required fields
                if not all([track_id, artist_name, track_title]):
                    raise ValueError(f"Missing required fields: track_id={track_id}, artist={artist_name}, title={track_title}")

                # Create EnrichmentTask object
                enrichment_task = EnrichmentTask(
                    track_id=track_id,
                    artist_name=artist_name,
                    track_title=track_title,
                    priority=priority,
                    existing_spotify_id=task_data.get('spotify_id'),
                    existing_isrc=task_data.get('isrc'),
                    existing_musicbrainz_id=task_data.get('musicbrainz_id'),
                    force_refresh=task_data.get('force_refresh', False),
                    correlation_id=task_data.get('correlation_id', 'queue-consumer')
                )

                # Execute enrichment using bootstrap pipeline
                if self.bootstrap and self.bootstrap.enrichment_pipeline:
                    result: EnrichmentResult = await self.bootstrap.enrichment_pipeline.enrich_track(enrichment_task)

                    if result.status == EnrichmentStatus.COMPLETED:
                        self.stats['messages_succeeded'] += 1
                        logger.info(
                            f"✓ Enriched: {artist_name} - {track_title}",
                            sources=len(result.sources_used),
                            cached=result.cached
                        )
                    elif result.status == EnrichmentStatus.PARTIAL:
                        self.stats['messages_succeeded'] += 1
                        logger.warning(
                            f"⚠ Partial enrichment: {artist_name} - {track_title}",
                            sources=len(result.sources_used)
                        )
                    else:
                        # Failed enrichment
                        self.stats['messages_failed'] += 1
                        logger.warning(f"⚠ Enrichment failed: {artist_name} - {track_title}", errors=result.errors)

                        # Requeue with exponential backoff (Blueprint Section 6.1)
                        if retry_count < 3:
                            await self._requeue_with_backoff(task_data, retry_count)
                        else:
                            logger.error(f"❌ Max retries exceeded for: {artist_name} - {track_title}")
                            # Message will go to DLQ via x-dead-letter-exchange
                            raise Exception(f"Max retries exceeded (retry_count={retry_count})")
                else:
                    logger.error("No enrichment pipeline available - cannot process task")
                    raise Exception("Enrichment pipeline not initialized")

                self.stats['messages_processed'] += 1

                # Message will be auto-acknowledged on successful exit from context manager

            except json.JSONDecodeError as e:
                logger.error(f"Invalid JSON in message: {e}")
                self.stats['messages_failed'] += 1
                # Don't requeue - bad message format

            except Exception as e:
                logger.error(f"Error processing message: {e}")
                self.stats['messages_failed'] += 1
                # Let message go to DLQ (will be rejected and sent to x-dead-letter-exchange)
                raise

    async def _requeue_with_backoff(self, task_data: Dict, retry_count: int):
        """
        Requeue failed message with exponential backoff.
        Blueprint Section 6.1: Exponential Backoff
        """
        # Calculate backoff delay (2^retry_count seconds)
        backoff_seconds = 2 ** retry_count

        # Update retry count
        task_data['retry_count'] = retry_count + 1
        task_data['retry_scheduled_at'] = datetime.utcnow().isoformat()

        # Publish to queue with delay (using x-message-ttl)
        await self.channel.default_exchange.publish(
            aio_pika.Message(
                body=json.dumps(task_data).encode(),
                delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
                expiration=str(backoff_seconds * 1000),  # Convert to milliseconds
                headers={'x-retry-count': retry_count + 1}
            ),
            routing_key=self.queue_name
        )

        self.stats['messages_requeued'] += 1
        logger.info(f"⏳ Requeued with {backoff_seconds}s backoff (retry {retry_count + 1}/3)")

    async def start_consuming(self):
        """
        Start consuming messages from the queue.
        Blueprint Section 3.3: Consumer Loop
        """
        logger.info(f"🚀 Starting consumer for queue: {self.queue_name}")

        try:
            # Start consuming with concurrent processing
            await self.queue.consume(
                self.process_message,
                no_ack=False  # Manual acknowledgment for reliability
            )

            logger.info("✓ Consumer started successfully")
            logger.info("Waiting for enrichment tasks...")

        except Exception as e:
            logger.error(f"Failed to start consumer: {e}")
            raise

    async def stop_consuming(self):
        """Graceful shutdown of consumer"""
        logger.info("Stopping consumer...")

        if self.consumer_tag:
            await self.queue.cancel(self.consumer_tag)

        # Log statistics
        duration = (datetime.utcnow() - self.stats['start_time']).total_seconds()
        logger.info("\n" + "="*60)
        logger.info("Consumer Statistics")
        logger.info("="*60)
        logger.info(f"Messages processed:  {self.stats['messages_processed']}")
        logger.info(f"Messages succeeded:  {self.stats['messages_succeeded']}")
        logger.info(f"Messages failed:     {self.stats['messages_failed']}")
        logger.info(f"Messages requeued:   {self.stats['messages_requeued']}")
        logger.info(f"Runtime:             {duration:.1f}s")
        logger.info(f"Throughput:          {self.stats['messages_processed'] / duration:.2f} msg/sec")
        logger.info("="*60)

    async def close(self):
        """Close RabbitMQ connection"""
        if self.connection and not self.connection.is_closed:
            await self.connection.close()
            logger.info("✓ RabbitMQ connection closed")


async def main():
    """Main entry point for enrichment worker"""
    import signal

    # Initialize worker bootstrap (API clients, database, Redis)
    logger.info("🚀 Initializing enrichment worker")
    try:
        bootstrap = await WorkerBootstrap.create()
        logger.info("✓ Worker bootstrap initialized successfully")
    except Exception as e:
        logger.error(f"❌ Failed to initialize worker bootstrap: {e}")
        raise

    # Create consumer
    consumer = EnrichmentQueueConsumer(
        queue_name=os.getenv('QUEUE_NAME', 'metadata_enrichment_queue'),
        prefetch_count=int(os.getenv('PREFETCH_COUNT', 1)),
        bootstrap=bootstrap
    )

    try:
        # Connect and start consuming
        await consumer.connect()
        await consumer.start_consuming()

        # Wait indefinitely (until SIGTERM/SIGINT)
        await asyncio.Event().wait()

    except KeyboardInterrupt:
        logger.info("\n⚠ Received shutdown signal")
    except Exception as e:
        logger.error(f"Consumer error: {e}")
        raise
    finally:
        await consumer.stop_consuming()
        await consumer.close()

        # Close bootstrap connections
        if bootstrap:
            await bootstrap.close()
            logger.info("✓ Bootstrap connections closed")


if __name__ == "__main__":
    asyncio.run(main())
