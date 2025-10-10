"""
RabbitMQ Dead-Letter Queue Setup
=================================

Configures RabbitMQ exchanges, queues, and bindings for DLQ system.

Topology:
- Exchange: enrichment.dlq.exchange (topic)
- Queue: enrichment.dlq.queue (durable, with 30-day TTL)
- Queue: enrichment.dlq.retry (for manual replay)
- Binding: all enrichment failures route to DLQ

Run on service startup to ensure infrastructure exists.
"""

import logging
import pika
import sys
from typing import Dict, Optional
from pathlib import Path

# Add common module to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from common.secrets_manager import get_rabbitmq_config

logger = logging.getLogger(__name__)


class RabbitMQSetup:
    """Configure RabbitMQ for DLQ system"""

    # Message TTL: 30 days (in milliseconds)
    MESSAGE_TTL = 30 * 24 * 60 * 60 * 1000

    def __init__(self, config: Optional[Dict] = None):
        """
        Initialize RabbitMQ setup.

        Args:
            config: Optional RabbitMQ configuration dict
        """
        self.config = config or get_rabbitmq_config()
        self.connection = None
        self.channel = None

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

            logger.info(f"✓ Connected to RabbitMQ at {self.config['host']}:{self.config['port']}")
            return True

        except Exception as e:
            logger.error(f"Failed to connect to RabbitMQ: {e}")
            return False

    def setup_dlq_infrastructure(self) -> bool:
        """
        Create all DLQ exchanges, queues, and bindings.

        Returns:
            True if setup successful, False otherwise
        """
        if not self.channel:
            logger.error("No RabbitMQ channel available")
            return False

        try:
            # 1. Declare DLQ Exchange (topic type for flexible routing)
            self.channel.exchange_declare(
                exchange='enrichment.dlq.exchange',
                exchange_type='topic',
                durable=True,
                arguments={
                    'x-description': 'Dead Letter Queue exchange for failed enrichments'
                }
            )
            logger.info("✓ Created exchange: enrichment.dlq.exchange")

            # 2. Declare Main DLQ Queue (with 30-day TTL)
            self.channel.queue_declare(
                queue='enrichment.dlq.queue',
                durable=True,
                arguments={
                    'x-message-ttl': self.MESSAGE_TTL,
                    'x-max-length': 100000,  # Max 100k messages
                    'x-overflow': 'drop-head',  # Drop oldest when full
                    'x-queue-type': 'quorum',  # Quorum queue for data safety
                    'x-description': 'Main DLQ for failed enrichments (30-day retention)'
                }
            )
            logger.info("✓ Created queue: enrichment.dlq.queue (30-day TTL)")

            # 3. Declare Retry Queue (for manual replay)
            self.channel.queue_declare(
                queue='enrichment.dlq.retry',
                durable=True,
                arguments={
                    'x-message-ttl': 24 * 60 * 60 * 1000,  # 24 hours
                    'x-max-length': 10000,
                    'x-overflow': 'reject-publish',  # Reject new when full
                    'x-queue-type': 'quorum',
                    'x-description': 'Retry queue for DLQ replay operations'
                }
            )
            logger.info("✓ Created queue: enrichment.dlq.retry (24-hour TTL)")

            # 4. Declare Analysis Queue (for error pattern analysis)
            self.channel.queue_declare(
                queue='enrichment.dlq.analysis',
                durable=True,
                arguments={
                    'x-message-ttl': 7 * 24 * 60 * 60 * 1000,  # 7 days
                    'x-max-length': 50000,
                    'x-overflow': 'drop-head',
                    'x-queue-type': 'quorum',
                    'x-description': 'Queue for DLQ message analysis and reporting'
                }
            )
            logger.info("✓ Created queue: enrichment.dlq.analysis (7-day TTL)")

            # 5. Bind Main DLQ Queue to Exchange
            # Route all enrichment failures (*.enrichment.failed)
            self.channel.queue_bind(
                exchange='enrichment.dlq.exchange',
                queue='enrichment.dlq.queue',
                routing_key='*.enrichment.failed'
            )
            logger.info("✓ Bound enrichment.dlq.queue to *.enrichment.failed")

            # 6. Bind specific error types for analysis
            error_types = [
                'spotify.enrichment.failed',
                'musicbrainz.enrichment.failed',
                'lastfm.enrichment.failed',
                'audio_analysis.enrichment.failed',
                'general.enrichment.failed'
            ]

            for routing_key in error_types:
                self.channel.queue_bind(
                    exchange='enrichment.dlq.exchange',
                    queue='enrichment.dlq.analysis',
                    routing_key=routing_key
                )
            logger.info(f"✓ Bound {len(error_types)} error types to analysis queue")

            logger.info("✓ DLQ infrastructure setup complete")
            return True

        except Exception as e:
            logger.error(f"Failed to setup DLQ infrastructure: {e}")
            return False

    def verify_setup(self) -> bool:
        """
        Verify DLQ infrastructure exists and is healthy.

        Returns:
            True if verification successful, False otherwise
        """
        if not self.channel:
            return False

        try:
            # Check exchange exists
            self.channel.exchange_declare(
                exchange='enrichment.dlq.exchange',
                exchange_type='topic',
                durable=True,
                passive=True  # Check only, don't create
            )

            # Check queues exist
            queues = [
                'enrichment.dlq.queue',
                'enrichment.dlq.retry',
                'enrichment.dlq.analysis'
            ]

            for queue in queues:
                result = self.channel.queue_declare(
                    queue=queue,
                    durable=True,
                    passive=True
                )
                message_count = result.method.message_count
                logger.info(f"✓ Queue {queue}: {message_count} messages")

            logger.info("✓ DLQ infrastructure verification passed")
            return True

        except Exception as e:
            logger.error(f"DLQ verification failed: {e}")
            return False

    def get_queue_stats(self) -> Dict[str, int]:
        """
        Get statistics for all DLQ queues.

        Returns:
            Dictionary mapping queue names to message counts
        """
        stats = {}

        if not self.channel:
            return stats

        try:
            queues = [
                'enrichment.dlq.queue',
                'enrichment.dlq.retry',
                'enrichment.dlq.analysis'
            ]

            for queue in queues:
                try:
                    result = self.channel.queue_declare(
                        queue=queue,
                        durable=True,
                        passive=True
                    )
                    stats[queue] = result.method.message_count
                except Exception as e:
                    logger.warning(f"Could not get stats for {queue}: {e}")
                    stats[queue] = -1

            return stats

        except Exception as e:
            logger.error(f"Failed to get queue stats: {e}")
            return stats

    def purge_queue(self, queue_name: str) -> bool:
        """
        Purge all messages from a queue (DANGEROUS - admin only).

        Args:
            queue_name: Name of queue to purge

        Returns:
            True if purge successful, False otherwise
        """
        if not self.channel:
            return False

        try:
            result = self.channel.queue_purge(queue=queue_name)
            logger.warning(f"⚠ Purged queue {queue_name}: {result.method.message_count} messages removed")
            return True

        except Exception as e:
            logger.error(f"Failed to purge queue {queue_name}: {e}")
            return False

    def close(self):
        """Close RabbitMQ connection"""
        try:
            if self.channel and self.channel.is_open:
                self.channel.close()
            if self.connection and self.connection.is_open:
                self.connection.close()
            logger.info("✓ RabbitMQ connection closed")
        except Exception as e:
            logger.warning(f"Error closing RabbitMQ connection: {e}")


def main():
    """CLI entry point for DLQ setup"""
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )

    logger.info("Starting RabbitMQ DLQ setup...")

    setup = RabbitMQSetup()

    try:
        # Connect to RabbitMQ
        if not setup.connect():
            logger.error("Failed to connect to RabbitMQ")
            sys.exit(1)

        # Setup DLQ infrastructure
        if not setup.setup_dlq_infrastructure():
            logger.error("Failed to setup DLQ infrastructure")
            sys.exit(1)

        # Verify setup
        if not setup.verify_setup():
            logger.error("Failed to verify DLQ infrastructure")
            sys.exit(1)

        # Show stats
        stats = setup.get_queue_stats()
        logger.info("Queue Statistics:")
        for queue, count in stats.items():
            logger.info(f"  {queue}: {count} messages")

        logger.info("✓ DLQ setup complete and verified")
        sys.exit(0)

    except KeyboardInterrupt:
        logger.info("Setup interrupted by user")
        sys.exit(1)

    except Exception as e:
        logger.error(f"Unexpected error during setup: {e}", exc_info=True)
        sys.exit(1)

    finally:
        setup.close()


if __name__ == '__main__':
    main()
