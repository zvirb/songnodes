"""
Redis Queue Consumer - Bridges Redis queue to scraper APIs
Pulls tasks from Redis queue and makes HTTP calls to appropriate scraper services
"""

import asyncio
import json
import logging
import os
import redis
import httpx
from typing import Dict, Any, Optional
from datetime import datetime
import structlog

# Configure structured logging
structlog.configure(
    processors=[
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.dev.ConsoleRenderer()
    ],
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger()

class RedisQueueConsumer:
    """Consumes tasks from Redis queue and dispatches to scraper APIs"""

    def __init__(self):
        # Redis connection (synchronous for blocking operations)
        self.redis_client = redis.Redis(
            host=os.getenv("REDIS_HOST", "redis"),
            port=int(os.getenv("REDIS_PORT", 6379)),
            decode_responses=True,
            socket_connect_timeout=5,
            socket_timeout=5,
            retry_on_timeout=True,
            health_check_interval=30
        )

        # HTTP client for calling scraper APIs
        self.http_client = httpx.AsyncClient(timeout=60.0)

        # Scraper service mappings
        self.scraper_endpoints = {
            '1001tracklists': 'http://scraper-1001tracklists:8011/scrape',
            'mixesdb': 'http://scraper-mixesdb:8012/scrape',
            'setlistfm': 'http://scraper-setlistfm:8013/scrape',
            'reddit': 'http://scraper-reddit:8014/scrape'
        }

        self.running = True
        self.tasks_processed = 0
        self.tasks_failed = 0

    async def consume_queue(self):
        """Main consumer loop - pulls from Redis and calls scrapers"""
        logger.info("Starting Redis queue consumer", queue="scraping_queue")

        while self.running:
            try:
                # Blocking pop from Redis queue (timeout after 5 seconds)
                result = self.redis_client.brpop('scraping_queue', timeout=5)

                if result:
                    _, task_json = result
                    await self.process_task(task_json)
                else:
                    # No tasks available, wait a bit
                    await asyncio.sleep(1)

            except redis.ConnectionError as e:
                logger.error("Redis connection error", error=str(e))
                await asyncio.sleep(5)  # Wait before retry

            except redis.TimeoutError:
                # Expected behavior when queue is empty - not an error
                await asyncio.sleep(1)

            except Exception as e:
                # Only log truly unexpected errors
                logger.error("Consumer unexpected error", error=str(e), error_type=type(e).__name__)
                await asyncio.sleep(2)

    async def process_task(self, task_json: str):
        """Process a single task from the queue"""
        try:
            task = json.loads(task_json)

            logger.info(
                "Processing scraping task",
                url=task.get('url'),
                scraper=task.get('scraper'),
                discovered_via=task.get('discovered_via')
            )

            # Determine which scraper to call
            scraper = task.get('scraper', '1001tracklists')
            endpoint = self.scraper_endpoints.get(scraper)

            if not endpoint:
                logger.warning("Unknown scraper type", scraper=scraper)
                self.tasks_failed += 1
                return

            # Make HTTP call to scraper API
            response = await self.http_client.post(
                endpoint,
                json={
                    'url': task.get('url'),
                    'metadata': {
                        'discovered_via': task.get('discovered_via'),
                        'priority': task.get('priority', 'normal'),
                        'created_at': task.get('created_at')
                    }
                }
            )

            if response.status_code == 200:
                result = response.json()
                # Different scrapers may return tracks_count or items_processed
                tracks_found = result.get('tracks_count', result.get('items_processed', 0))
                logger.info(
                    "Scraping task completed",
                    url=task.get('url'),
                    tracks_found=tracks_found
                )
                self.tasks_processed += 1

                # Store success metrics in Redis
                self.redis_client.hincrby('scraper:stats', f'{scraper}:success', 1)

            else:
                logger.error(
                    "Scraper API error",
                    url=task.get('url'),
                    status=response.status_code,
                    response=response.text
                )
                self.tasks_failed += 1

                # Re-queue failed task with backoff
                await self.requeue_failed_task(task)

        except json.JSONDecodeError as e:
            logger.error("Invalid task JSON", error=str(e), task=task_json)
            self.tasks_failed += 1

        except httpx.RequestError as e:
            logger.error("HTTP request failed", error=str(e), url=task.get('url'))
            self.tasks_failed += 1

            # Re-queue on network errors
            await self.requeue_failed_task(task)

        except Exception as e:
            logger.error("Task processing error", error=str(e))
            self.tasks_failed += 1

    async def requeue_failed_task(self, task: Dict[str, Any]):
        """Re-queue failed task with retry logic"""
        retry_count = task.get('retry_count', 0)

        if retry_count < 3:
            task['retry_count'] = retry_count + 1
            task['retry_at'] = datetime.now().isoformat()

            # Add back to queue (at the end)
            self.redis_client.lpush('scraping_queue', json.dumps(task))

            logger.info(
                "Task re-queued for retry",
                url=task.get('url'),
                retry_count=task['retry_count']
            )
        else:
            # Move to dead letter queue after max retries
            self.redis_client.lpush('scraping_queue:failed', json.dumps(task))

            logger.warning(
                "Task moved to dead letter queue",
                url=task.get('url'),
                retries=retry_count
            )

    async def get_stats(self) -> Dict[str, Any]:
        """Get consumer statistics"""
        queue_length = self.redis_client.llen('scraping_queue')
        failed_queue_length = self.redis_client.llen('scraping_queue:failed')

        return {
            'queue_length': queue_length,
            'failed_queue_length': failed_queue_length,
            'tasks_processed': self.tasks_processed,
            'tasks_failed': self.tasks_failed,
            'consumer_status': 'running' if self.running else 'stopped'
        }

    async def health_check(self) -> bool:
        """Check consumer health"""
        try:
            # Check Redis connection
            self.redis_client.ping()

            # Check if scrapers are reachable
            for scraper, endpoint in self.scraper_endpoints.items():
                try:
                    response = await self.http_client.get(
                        endpoint.replace('/scrape', '/health'),
                        timeout=5.0
                    )
                    if response.status_code != 200:
                        logger.warning(f"Scraper {scraper} unhealthy")
                except:
                    logger.warning(f"Scraper {scraper} unreachable")

            return True

        except Exception as e:
            logger.error("Health check failed", error=str(e))
            return False

    async def shutdown(self):
        """Graceful shutdown"""
        logger.info("Shutting down Redis queue consumer")
        self.running = False
        await self.http_client.aclose()
        self.redis_client.close()
        logger.info(
            "Consumer shutdown complete",
            tasks_processed=self.tasks_processed,
            tasks_failed=self.tasks_failed
        )

async def main():
    """Main entry point"""
    consumer = RedisQueueConsumer()

    # Start health check task
    async def periodic_health_check():
        while consumer.running:
            await consumer.health_check()
            stats = await consumer.get_stats()
            logger.info("Consumer stats", **stats)
            await asyncio.sleep(30)

    # Run consumer and health check concurrently
    try:
        await asyncio.gather(
            consumer.consume_queue(),
            periodic_health_check()
        )
    except KeyboardInterrupt:
        logger.info("Received shutdown signal")
        await consumer.shutdown()
    except Exception as e:
        logger.error("Fatal error", error=str(e))
        await consumer.shutdown()
        raise

if __name__ == "__main__":
    asyncio.run(main())