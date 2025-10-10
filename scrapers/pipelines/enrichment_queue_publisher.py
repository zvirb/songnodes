"""
Enrichment Queue Publisher Pipeline
====================================

Publishes enrichment tasks to RabbitMQ instead of processing synchronously.
Blueprint Section 3.1: Decoupling Ingestion from Enrichment

This pipeline replaces synchronous API enrichment with async queue-based processing,
enabling:
- Independent scaling of scraping and enrichment
- Non-blocking scraping (no API latency)
- Horizontal scaling of enrichment workers
- Priority-based task processing

Priority: 250 (replaces APIEnrichmentPipeline when queue-based mode is enabled)
"""

import logging
import json
from typing import Optional
from itemadapter import ItemAdapter

# Pika for synchronous RabbitMQ publishing (compatible with Scrapy's sync framework)
try:
    import pika
    PIKA_AVAILABLE = True
except ImportError:
    PIKA_AVAILABLE = False
    logging.warning("pika not installed - queue publishing disabled")

logger = logging.getLogger(__name__)


class EnrichmentQueuePublisher:
    """
    Publishes enrichment tasks to RabbitMQ for async processing.
    Blueprint Section 3.1: Decoupling Pattern
    """

    def __init__(
        self,
        rabbitmq_host: str = None,
        rabbitmq_port: int = 5672,
        rabbitmq_user: str = None,
        rabbitmq_pass: str = None,
        rabbitmq_vhost: str = 'musicdb',
        queue_name: str = 'metadata_enrichment_queue',
        enable_queue: bool = True
    ):
        self.enable_queue = enable_queue and PIKA_AVAILABLE

        if not self.enable_queue:
            logger.warning("Queue publishing disabled - enrichment will be skipped")
            return

        # Load RabbitMQ configuration
        import os
        self.rabbitmq_host = rabbitmq_host or os.getenv('RABBITMQ_HOST', 'rabbitmq')
        self.rabbitmq_port = rabbitmq_port or int(os.getenv('RABBITMQ_PORT', 5672))
        self.rabbitmq_user = rabbitmq_user or os.getenv('RABBITMQ_USER', 'musicdb')
        self.rabbitmq_pass = rabbitmq_pass or os.getenv('RABBITMQ_PASS', 'rabbitmq_secure_pass_2024')
        self.rabbitmq_vhost = rabbitmq_vhost or os.getenv('RABBITMQ_VHOST', 'musicdb')
        self.queue_name = queue_name

        # Connection and channel (lazy initialized)
        self.connection = None
        self.channel = None

        # Statistics
        self.stats = {
            'total_tracks': 0,
            'tasks_published': 0,
            'already_enriched': 0,
            'publish_failures': 0,
            'skipped_invalid': 0
        }

    @classmethod
    def from_crawler(cls, crawler):
        """Create pipeline from crawler settings"""
        import os
        return cls(
            rabbitmq_host=crawler.settings.get('RABBITMQ_HOST') or os.getenv('RABBITMQ_HOST'),
            rabbitmq_port=crawler.settings.get('RABBITMQ_PORT') or int(os.getenv('RABBITMQ_PORT', 5672)),
            rabbitmq_user=crawler.settings.get('RABBITMQ_USER') or os.getenv('RABBITMQ_USER'),
            rabbitmq_pass=crawler.settings.get('RABBITMQ_PASS') or os.getenv('RABBITMQ_PASS'),
            enable_queue=crawler.settings.get('ENABLE_ENRICHMENT_QUEUE', True)
        )

    def _connect(self):
        """Establish connection to RabbitMQ (lazy initialization)"""
        if self.connection and self.connection.is_open:
            return

        try:
            credentials = pika.PlainCredentials(self.rabbitmq_user, self.rabbitmq_pass)
            parameters = pika.ConnectionParameters(
                host=self.rabbitmq_host,
                port=self.rabbitmq_port,
                virtual_host=self.rabbitmq_vhost,
                credentials=credentials,
                heartbeat=600,
                blocked_connection_timeout=300
            )

            self.connection = pika.BlockingConnection(parameters)
            self.channel = self.connection.channel()

            # Declare queue (passive=True to verify it exists)
            self.channel.queue_declare(
                queue=self.queue_name,
                durable=True,
                passive=False  # Create if not exists
            )

            logger.info(f"✓ Connected to RabbitMQ queue: {self.queue_name}")

        except Exception as e:
            logger.error(f"Failed to connect to RabbitMQ: {e}")
            self.connection = None
            self.channel = None
            raise

    def process_item(self, item, spider):
        """
        Publish enrichment task to queue instead of processing synchronously.
        Blueprint Section 3.1: Non-blocking Async Pattern
        """
        if not self.enable_queue:
            return item

        adapter = ItemAdapter(item)

        # Skip non-track items
        item_class_name = item.__class__.__name__
        if 'TrackArtist' in item_class_name or 'Adjacency' in item_class_name:
            return item

        item_type = adapter.get('item_type')
        if item_type and item_type != 'track':
            return item

        self.stats['total_tracks'] += 1

        # Skip if already has spotify_id (already enriched)
        if adapter.get('spotify_id'):
            self.stats['already_enriched'] += 1
            return item

        # Extract track information
        artist = self._get_primary_artist(adapter)
        title = self._get_track_title(adapter)
        track_id = adapter.get('id')

        if not all([track_id, artist, title]):
            logger.debug(f"Track missing required fields - skipping queue (id={track_id}, artist={artist}, title={title})")
            self.stats['skipped_invalid'] += 1
            return item

        # Publish enrichment task to queue
        try:
            self._publish_enrichment_task(
                track_id=str(track_id),
                artist=artist,
                title=title,
                priority=self._determine_priority(adapter)
            )
            self.stats['tasks_published'] += 1
            logger.debug(f"✓ Published enrichment task: {artist} - {title}")

        except Exception as e:
            logger.error(f"Failed to publish enrichment task: {e}")
            self.stats['publish_failures'] += 1

        return item

    def _publish_enrichment_task(
        self,
        track_id: str,
        artist: str,
        title: str,
        priority: int = 5
    ):
        """
        Publish enrichment task to RabbitMQ with priority.
        Blueprint Section 3.2: Priority-based Task Queuing
        """
        # Ensure connection
        self._connect()

        if not self.channel:
            raise Exception("RabbitMQ channel not available")

        # Build task payload
        task = {
            'track_id': track_id,
            'artist': artist,
            'title': title,
            'priority': priority,
            'retry_count': 0,
            'source': 'scraper',
            'queued_at': self._get_timestamp()
        }

        # Publish with persistence and priority
        self.channel.basic_publish(
            exchange='',
            routing_key=self.queue_name,
            body=json.dumps(task),
            properties=pika.BasicProperties(
                delivery_mode=2,  # Persistent message
                priority=priority,  # Message priority (0-10)
                content_type='application/json'
            )
        )

    def _determine_priority(self, adapter: ItemAdapter) -> int:
        """
        Determine task priority based on track metadata.
        Blueprint Section 3.2: Intelligent Prioritization

        Priority levels:
        - 10 (highest): Tracks from high-value sources (Beatport charts, etc.)
        - 7: Standard new tracks
        - 3: Backlog tracks
        - 0: Re-enrichment tasks
        """
        source = adapter.get('source', '').lower()

        # High-priority sources
        if any(keyword in source for keyword in ['beatport', 'spotify_chart', 'billboard']):
            return 10

        # Standard priority for new tracks
        if adapter.get('created_at'):
            return 7

        # Low priority for backlog
        return 3

    def _get_primary_artist(self, adapter: ItemAdapter) -> Optional[str]:
        """Extract primary artist name"""
        artist = (
            adapter.get('original_artist') or
            adapter.get('artist_name') or
            adapter.get('artist') or
            (adapter.get('artists', [{}])[0].get('name') if adapter.get('artists') else None)
        )

        if artist:
            return artist

        # Fallback: Parse from source_context
        source_context = adapter.get('source_context')
        if source_context and ' - ' in source_context:
            artist = source_context.split(' - ')[0].strip()
            return artist if artist else None

        return None

    def _get_track_title(self, adapter: ItemAdapter) -> Optional[str]:
        """Extract track title"""
        title = adapter.get('track_name') or adapter.get('title')

        if not title:
            # Parse from source_context
            source_context = adapter.get('source_context')
            if source_context and ' - ' in source_context:
                title_part = source_context.split(' - ', 1)[1].strip()
                title = title_part if title_part else None

        return title

    def _get_timestamp(self) -> str:
        """Get current UTC timestamp"""
        from datetime import datetime
        return datetime.utcnow().isoformat()

    def close_spider(self, spider):
        """Log statistics and close connection"""
        logger.info(
            f"\n{'='*60}\n"
            f"Enrichment Queue Publisher Statistics\n"
            f"{'='*60}\n"
            f"Total tracks processed:     {self.stats['total_tracks']}\n"
            f"Already enriched (skipped): {self.stats['already_enriched']}\n"
            f"Tasks published to queue:   {self.stats['tasks_published']}\n"
            f"Publish failures:           {self.stats['publish_failures']}\n"
            f"Skipped (invalid data):     {self.stats['skipped_invalid']}\n"
            f"{'='*60}\n"
            f"NOTE: Enrichment tasks are being processed asynchronously\n"
            f"      by workers consuming from: {self.queue_name}\n"
            f"      Check worker logs for enrichment results.\n"
            f"{'='*60}\n"
        )

        # Close RabbitMQ connection
        if self.connection and self.connection.is_open:
            try:
                self.connection.close()
                logger.info("✓ RabbitMQ connection closed")
            except Exception as e:
                logger.warning(f"Error closing RabbitMQ connection: {e}")
