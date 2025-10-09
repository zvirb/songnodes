"""
🎵 SongNodes Scraper Orchestrator - 2025 Best Practices Edition
Enhanced with circuit breakers, structured logging, comprehensive monitoring, and graceful error handling

Features:
- Automated failed queue cleanup (removes tasks older than 3 days, runs daily at 3 AM UTC)
- Manual cleanup endpoint: POST /queue/cleanup-expired
- Circuit breaker pattern for resilient scraping
- Comprehensive health monitoring
"""

import asyncio
import json
import os
import time
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional

import httpx
import redis
import structlog
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from fastapi import BackgroundTasks, FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse
from prometheus_client import Counter, Gauge, Histogram, generate_latest
from pydantic import BaseModel, Field
from typing import Optional
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

# Import our 2025 best practices components
from target_track_searcher import TargetTrackSearcher2025, SearchOrchestrator2025, AsyncDatabaseService
from redis_queue_consumer import RedisQueueConsumer
from browser_collector_fallback import BrowserCollectorFallback, ScraperWithFallback

# Configure structured logging
structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.StackInfoRenderer(),
        structlog.dev.set_exc_info,
        structlog.processors.JSONRenderer()
    ],
    wrapper_class=structlog.make_filtering_bound_logger(20),
    logger_factory=structlog.WriteLoggerFactory(),
    cache_logger_on_first_use=False,
)

logger = structlog.get_logger(__name__)

# Import secrets manager for unified credential management
try:
    import sys
    sys.path.insert(0, '/app/common')
    from secrets_manager import get_database_url, get_redis_config, validate_secrets
    logger.info("✅ Secrets manager imported successfully")
except ImportError as e:
    logger.error(f"❌ Failed to import secrets_manager: {e}")
    logger.warning("Falling back to environment variables")

# ===================
# 2025 METRICS & MONITORING
# ===================
scraping_tasks_total = Counter('scraping_tasks_total', 'Total scraping tasks', ['scraper', 'status'])
active_scrapers = Gauge('active_scrapers', 'Active scrapers', ['scraper'])
scraping_duration = Histogram('scraping_duration_seconds', 'Task duration', ['scraper'])
queue_size = Gauge('scraping_queue_size', 'Queue size', ['priority'])
circuit_breaker_state = Gauge('circuit_breaker_state', 'Circuit breaker states', ['service', 'state'])
database_operations = Counter('database_operations_total', 'Database operations', ['operation', 'status'])
search_operations = Counter('search_operations_total', 'Search operations', ['platform', 'status'])

# ===================
# ENHANCED DATA MODELS
# ===================
class ScraperStatus(str, Enum):
    IDLE = "idle"
    RUNNING = "running"
    ERROR = "error"
    DISABLED = "disabled"
    CIRCUIT_OPEN = "circuit_open"

class TaskPriority(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class TaskStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    TIMEOUT = "timeout"

class ScrapingTask(BaseModel):
    model_config = {"use_enum_values": True}

    id: Optional[str] = Field(default=None)
    scraper: str
    url: Optional[str] = None
    priority: TaskPriority = TaskPriority.MEDIUM
    params: Optional[Dict[str, Any]] = {}
    retry_count: int = 0
    max_retries: int = 3
    created_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    status: TaskStatus = TaskStatus.PENDING
    error_message: Optional[str] = None
    correlation_id: Optional[str] = None

# ===================
# ENHANCED CONNECTION MANAGEMENT
# ===================
class EnhancedConnectionManager:
    def __init__(self):
        self.db_engine = None
        self.session_factory = None
        self.redis_client = None
        self.http_client = None

    async def initialize(self):
        """Initialize all connections with 2025 best practices"""
        correlation_id = str(uuid.uuid4())[:8]

        structlog.contextvars.bind_contextvars(
            operation="connection_initialization",
            correlation_id=correlation_id
        )

        logger.info("Initializing enhanced connection manager")

        # Database connection - use secrets_manager if available
        try:
            database_url = get_database_url(async_driver=True, use_connection_pool=True)
            logger.info("✅ Using secrets_manager for database connection")
        except NameError:
            database_url = os.getenv(
                "DATABASE_URL",
                "postgresql+asyncpg://musicdb_user:musicdb_secure_pass_2024@db-connection-pool:6432/musicdb"
            )
            logger.warning("⚠️ Using fallback DATABASE_URL from environment")

        self.db_engine = create_async_engine(
            database_url,
            pool_size=20,
            max_overflow=30,
            pool_timeout=30,
            pool_recycle=3600,
            pool_pre_ping=True,
            connect_args={
                # PostgreSQL accepts 'options' for server-side parameters
                # But some options may not be supported by all versions
            },
            echo=False,
            future=True
        )

        self.session_factory = async_sessionmaker(
            self.db_engine,
            class_=AsyncSession,
            expire_on_commit=False
        )

        # Redis connection - use secrets_manager if available
        try:
            redis_config = get_redis_config()
            redis_host = redis_config['host']
            redis_port = redis_config['port']
            redis_password = redis_config.get('password')
            logger.info("✅ Using secrets_manager for Redis connection")
        except NameError:
            redis_host = os.getenv("REDIS_HOST", "redis")
            redis_port = int(os.getenv("REDIS_PORT", 6379))
            redis_password = os.getenv("REDIS_PASSWORD")
            logger.warning("⚠️ Using fallback Redis config from environment")

        redis_pool = redis.ConnectionPool(
            host=redis_host,
            port=redis_port,
            password=redis_password,
            max_connections=50,
            decode_responses=True
        )

        self.redis_client = redis.Redis(connection_pool=redis_pool)

        # HTTP client for external API calls
        self.http_client = httpx.AsyncClient(
            timeout=httpx.Timeout(30.0, connect=10.0),
            limits=httpx.Limits(max_keepalive_connections=50, max_connections=200)
        )

        logger.info("Connection manager initialized successfully")

    async def health_check(self) -> Dict[str, Any]:
        """Comprehensive health check"""
        health_status = {
            'database': 'unknown',
            'redis': 'unknown',
            'http_client': 'unknown'
        }

        # Database health
        try:
            async with self.session_factory() as session:
                await session.execute(text("SELECT 1"))
            health_status['database'] = 'healthy'
        except Exception as e:
            health_status['database'] = f'unhealthy: {e}'

        # Redis health
        try:
            # Using sync Redis client, no await needed
            self.redis_client.ping()
            health_status['redis'] = 'healthy'
        except Exception as e:
            health_status['redis'] = f'unhealthy: {e}'

        # HTTP client health
        try:
            await self.http_client.get('https://httpbin.org/status/200', timeout=5.0)
            health_status['http_client'] = 'healthy'
        except Exception as e:
            health_status['http_client'] = f'unhealthy: {e}'

        return health_status

    async def close(self):
        """Graceful shutdown of all connections"""
        logger.info("Closing connection manager")

        if self.http_client:
            await self.http_client.aclose()

        if self.db_engine:
            await self.db_engine.dispose()

# ===================
# MIDDLEWARE FOR CORRELATION IDS
# ===================
class CorrelationIdMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, request: Request, call_next):
        # Generate or extract correlation ID
        correlation_id = request.headers.get('x-correlation-id', str(uuid.uuid4())[:8])

        # Bind to structlog context
        structlog.contextvars.bind_contextvars(
            correlation_id=correlation_id,
            method=request.method,
            path=request.url.path,
            service="scraper-orchestrator"
        )

        # Process request
        start_time = time.time()
        response = await call_next(request)
        execution_time = time.time() - start_time

        # Add correlation ID to response
        response.headers['x-correlation-id'] = correlation_id

        # Log request completion
        logger.info(
            "Request completed",
            status_code=response.status_code,
            execution_time=f"{execution_time:.3f}s"
        )

        return response

# ===================
# ENHANCED APPLICATION SETUP
# ===================
connection_manager = EnhancedConnectionManager()
scheduler = AsyncIOScheduler()
target_searcher = None
search_orchestrator = None
redis_consumer = None
consumer_task = None
browser_collector_fallback = None  # Browser automation fallback

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Enhanced application lifespan management"""
    global target_searcher, search_orchestrator, redis_consumer, consumer_task, browser_collector_fallback

    logger.info("Starting SongNodes Scraper Orchestrator 2025")

    try:
        # Initialize connections
        await connection_manager.initialize()

        # Initialize browser-collector fallback
        browser_collector_fallback = BrowserCollectorFallback()
        health = await browser_collector_fallback.health_check()
        if health.get("status") == "healthy":
            logger.info("Browser collector fallback initialized successfully")
        else:
            logger.warning("Browser collector unavailable - fallback disabled", error=health.get("error"))

        # Initialize search components
        target_searcher = TargetTrackSearcher2025(connection_manager.session_factory)
        search_orchestrator = SearchOrchestrator2025(
            connection_manager.session_factory,
            connection_manager.redis_client,
            None  # Message queue not implemented yet
        )

        # Initialize and start Redis queue consumer
        redis_consumer = RedisQueueConsumer()
        consumer_task = asyncio.create_task(redis_consumer.consume_queue())
        logger.info("Redis queue consumer started")

        # Start scheduler
        scheduler.start()

        # Add scheduled tasks
        scheduler.add_job(
            scheduled_target_search,
            trigger=CronTrigger(minute="*/30"),  # Every 30 minutes
            id="target_track_search",
            max_instances=1,
            coalesce=True,
            misfire_grace_time=300
        )

        scheduler.add_job(
            health_monitor,
            trigger=CronTrigger(minute="*/5"),  # Every 5 minutes
            id="health_monitor",
            max_instances=1,
            coalesce=True
        )

        # Reddit community monitoring - Tier 3 latency advantage source
        scheduler.add_job(
            scheduled_reddit_monitor,
            trigger=CronTrigger(minute="*/30"),  # Every 30 minutes
            id="reddit_community_monitor",
            max_instances=1,
            coalesce=True,
            misfire_grace_time=300
        )

        # Failed queue cleanup - Remove tasks older than 3 days
        scheduler.add_job(
            cleanup_expired_failed_tasks,
            trigger=CronTrigger(hour=3, minute=0),  # Daily at 3:00 AM UTC
            id="failed_queue_cleanup",
            max_instances=1,
            coalesce=True,
            misfire_grace_time=3600  # 1 hour grace period
        )

        logger.info("Scraper Orchestrator started successfully")

    except Exception as e:
        logger.error("Failed to start application", error=str(e))
        raise

    yield  # Application running

    # Shutdown
    logger.info("Shutting down Scraper Orchestrator")

    try:
        scheduler.shutdown()

        # Stop Redis consumer
        if 'redis_consumer' in globals() and redis_consumer:
            await redis_consumer.shutdown()
            if 'consumer_task' in globals() and consumer_task:
                consumer_task.cancel()
                try:
                    await consumer_task
                except asyncio.CancelledError:
                    pass
            logger.info("Redis queue consumer stopped")

        if target_searcher:
            await target_searcher.close()

        if browser_collector_fallback:
            await browser_collector_fallback.close()

        await connection_manager.close()

        logger.info("Graceful shutdown completed")

    except Exception as e:
        logger.error("Error during shutdown", error=str(e))

# Initialize FastAPI with enhanced configuration
app = FastAPI(
    title="SongNodes Scraper Orchestrator 2025",
    description="Enhanced orchestration service with 2025 best practices",
    version="2.0.0",
    lifespan=lifespan
)

# Add enhanced middleware
app.middleware("http")(CorrelationIdMiddleware(app))

CORS_ALLOWED_ORIGINS = os.getenv('CORS_ALLOWED_ORIGINS', 'http://localhost:3006').split(',')
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ===================
# SCHEDULED TASKS WITH ERROR HANDLING
# ===================
async def scheduled_target_search():
    """Scheduled target track search with comprehensive error handling"""
    correlation_id = str(uuid.uuid4())[:8]

    structlog.contextvars.bind_contextvars(
        operation="scheduled_target_search",
        correlation_id=correlation_id
    )

    logger.info("Starting scheduled target track search")

    try:
        if search_orchestrator:
            await search_orchestrator.execute_search_pipeline()
            search_operations.labels(platform="all", status="success").inc()
        else:
            logger.error("Search orchestrator not initialized")
            search_operations.labels(platform="all", status="error").inc()

    except Exception as e:
        logger.error("Scheduled search failed", error=str(e))
        search_operations.labels(platform="all", status="error").inc()

async def scheduled_reddit_monitor():
    """
    Scheduled Reddit community monitoring for Tier 3 track identification.
    Monitors subreddits for early track discoveries before they hit aggregators.
    """
    correlation_id = str(uuid.uuid4())[:8]

    structlog.contextvars.bind_contextvars(
        operation="scheduled_reddit_monitor",
        correlation_id=correlation_id
    )

    logger.info("Starting scheduled Reddit community monitoring")

    try:
        # Trigger reddit_monitor spider via Scrapy command
        import subprocess
        import os

        scrapers_dir = os.getenv('SCRAPERS_DIR', '/app/scrapers')

        # Run spider with time filter for recent posts
        result = subprocess.run(
            ['scrapy', 'crawl', 'reddit_monitor', '-a', 'time_filter=day'],
            cwd=scrapers_dir,
            capture_output=True,
            text=True,
            timeout=600  # 10 minute timeout
        )

        if result.returncode == 0:
            logger.info("Reddit monitoring completed successfully", output=result.stdout[-500:])
            search_operations.labels(platform="reddit", status="success").inc()
        else:
            logger.error("Reddit monitoring failed", error=result.stderr[-500:])
            search_operations.labels(platform="reddit", status="error").inc()

    except subprocess.TimeoutExpired:
        logger.error("Reddit monitoring timed out after 10 minutes")
        search_operations.labels(platform="reddit", status="timeout").inc()
    except Exception as e:
        logger.error("Reddit monitoring failed", error=str(e))
        search_operations.labels(platform="reddit", status="error").inc()

async def health_monitor():
    """Monitor system health and update metrics"""
    correlation_id = str(uuid.uuid4())[:8]

    structlog.contextvars.bind_contextvars(
        operation="health_monitor",
        correlation_id=correlation_id
    )

    try:
        # Check connection health
        health_status = await connection_manager.health_check()

        # Update metrics
        for service, status in health_status.items():
            if 'healthy' in status:
                circuit_breaker_state.labels(service=service, state="closed").set(1)
                circuit_breaker_state.labels(service=service, state="open").set(0)
            else:
                circuit_breaker_state.labels(service=service, state="closed").set(0)
                circuit_breaker_state.labels(service=service, state="open").set(1)

        # Check target searcher health
        if target_searcher:
            searcher_health = await target_searcher.health_check()

            for name, cb_status in searcher_health.get('circuit_breakers', {}).items():
                state = cb_status['state']
                circuit_breaker_state.labels(service=name, state=state).set(1)
                # Set other states to 0
                for other_state in ['closed', 'open', 'half_open']:
                    if other_state != state:
                        circuit_breaker_state.labels(service=name, state=other_state).set(0)

        logger.info("Health monitoring completed", health_status=health_status)

    except Exception as e:
        logger.error("Health monitoring failed", error=str(e))

async def cleanup_expired_failed_tasks():
    """Clean up failed queue items older than 3 days"""
    correlation_id = str(uuid.uuid4())[:8]

    structlog.contextvars.bind_contextvars(
        operation="cleanup_expired_failed_tasks",
        correlation_id=correlation_id
    )

    try:
        redis_client = connection_manager.redis_client
        failed_queue_key = 'scraping_queue:failed'

        # Get all failed tasks
        failed_tasks_json = redis_client.lrange(failed_queue_key, 0, -1)

        if not failed_tasks_json:
            logger.info("No failed tasks to clean up")
            return

        total_tasks = len(failed_tasks_json)
        removed_count = 0
        kept_count = 0
        cutoff_time = datetime.now() - timedelta(days=3)

        # Parse tasks and filter out expired ones
        valid_tasks = []

        for task_json in failed_tasks_json:
            try:
                task = json.loads(task_json)
                created_at = datetime.fromisoformat(task.get('created_at', ''))

                if created_at < cutoff_time:
                    # Task is older than 3 days - mark for removal
                    removed_count += 1
                    logger.debug(
                        "Removing expired failed task",
                        task_id=task.get('id'),
                        created_at=task.get('created_at'),
                        age_days=(datetime.now() - created_at).days
                    )
                else:
                    # Task is still valid - keep it
                    valid_tasks.append(task_json)
                    kept_count += 1

            except (json.JSONDecodeError, ValueError) as e:
                logger.warning("Failed to parse task, removing it", error=str(e))
                removed_count += 1

        # Replace the failed queue with only valid tasks
        if removed_count > 0:
            # Use a pipeline for atomic operation
            pipe = redis_client.pipeline()
            pipe.delete(failed_queue_key)

            if valid_tasks:
                for task_json in valid_tasks:
                    pipe.lpush(failed_queue_key, task_json)

            pipe.execute()

            logger.info(
                "Failed queue cleanup completed",
                total_tasks=total_tasks,
                removed=removed_count,
                kept=kept_count,
                cutoff_days=3
            )
        else:
            logger.info(
                "No expired tasks found in failed queue",
                total_tasks=total_tasks,
                cutoff_days=3
            )

    except Exception as e:
        logger.error("Failed queue cleanup failed", error=str(e))

# ===================
# ENHANCED API ENDPOINTS
# ===================
@app.get("/health")
async def comprehensive_health_check():
    """
    Comprehensive health check with resource monitoring per CLAUDE.md Section 5.3.4.

    Monitors:
    - Database pool usage (503 if > 80%)
    - System memory (503 if > 85%)
    - Database connectivity
    - Redis connectivity
    - HTTP client status

    Returns health status with resource metrics.
    Raises 503 Service Unavailable if resource thresholds exceeded.
    """
    try:
        import psutil

        # Check database pool usage
        pool_usage = 0
        if connection_manager.db_engine:
            try:
                pool = connection_manager.db_engine.pool
                pool_size = pool.size()
                pool_max = pool.size() + pool._max_overflow
                pool_usage = pool_size / pool_max if pool_max > 0 else 0

                if pool_usage > 0.8:
                    logger.error(f"Database pool exhausted: {pool_usage:.1%}")
                    return JSONResponse(
                        status_code=503,
                        content={
                            'service': 'scraper-orchestrator-2025',
                            'status': 'unhealthy',
                            'error': f'Database pool exhausted: {pool_usage:.1%} usage (threshold: 80%)',
                            'timestamp': datetime.now().isoformat()
                        }
                    )
            except AttributeError:
                # Pool doesn't have expected attributes
                pass

        # Check system memory
        memory_percent = psutil.virtual_memory().percent
        if memory_percent > 85:
            logger.error(f"Memory usage critical: {memory_percent:.1f}%")
            return JSONResponse(
                status_code=503,
                content={
                    'service': 'scraper-orchestrator-2025',
                    'status': 'unhealthy',
                    'error': f'Memory usage critical: {memory_percent:.1f}% (threshold: 85%)',
                    'timestamp': datetime.now().isoformat()
                }
            )

        health_status = {
            'service': 'scraper-orchestrator-2025',
            'status': 'healthy',
            'timestamp': datetime.now().isoformat(),
            'version': '2.0.0',
            'connections': await connection_manager.health_check(),
            'checks': {
                'database_pool': {
                    'status': 'ok',
                    'usage': pool_usage,
                    'threshold': 0.8
                },
                'memory': {
                    'status': 'ok',
                    'usage': memory_percent,
                    'threshold': 85
                }
            }
        }

        # Check searcher health
        if target_searcher:
            searcher_health = await target_searcher.health_check()
            health_status['searcher'] = searcher_health

        # Determine overall health
        connection_health = all(
            'healthy' in status for status in health_status['connections'].values()
        )

        if not connection_health:
            health_status['status'] = 'degraded'
            return JSONResponse(
                status_code=503,
                content=health_status
            )

        return health_status

    except Exception as e:
        logger.error("Health check failed", error=str(e))
        return JSONResponse(
            status_code=503,
            content={
                'service': 'scraper-orchestrator-2025',
                'status': 'unhealthy',
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }
        )

@app.get("/healthz")
async def liveness_probe():
    """Simple liveness probe for Kubernetes"""
    return {"status": "alive", "timestamp": datetime.now().isoformat()}

@app.get("/readyz")
async def readiness_probe():
    """Readiness probe for Kubernetes"""
    try:
        health_status = await connection_manager.health_check()

        if all('healthy' in status for status in health_status.values()):
            return {"status": "ready", "timestamp": datetime.now().isoformat()}
        else:
            return JSONResponse(
                status_code=503,
                content={
                    "status": "not_ready",
                    "health_status": health_status,
                    "timestamp": datetime.now().isoformat()
                }
            )
    except Exception as e:
        return JSONResponse(
            status_code=503,
            content={
                "status": "not_ready",
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }
        )

@app.get("/metrics")
async def prometheus_metrics():
    """Prometheus metrics endpoint"""
    return PlainTextResponse(generate_latest())

class TargetSearchRequest(BaseModel):
    """Request model for target track search"""
    force_rescrape: bool = Field(
        default=False,
        description="If true, ignores last_searched timestamp and scrapes all active tracks immediately"
    )
    clear_last_searched: bool = Field(
        default=False,
        description="If true, clears last_searched timestamps before scraping (allows fresh start)"
    )
    track_id: Optional[str] = Field(
        default=None,
        description="If provided, scrapes only this specific track (UUID format)"
    )
    artist: Optional[str] = Field(
        default=None,
        description="If provided, scrapes only tracks by this artist"
    )
    title: Optional[str] = Field(
        default=None,
        description="If provided, scrapes only tracks with this title"
    )
    limit: int = Field(
        default=20,
        ge=1,
        le=100,
        description="Maximum number of tracks to process (1-100, default 20)"
    )

@app.post("/target-tracks/search")
async def manual_target_search(
    background_tasks: BackgroundTasks,
    request: TargetSearchRequest = TargetSearchRequest()
):
    """Manually trigger target track search with enhanced error handling

    Args:
        request: Request parameters including:
            - force_rescrape: Bypass 24-hour rate limit, scrape immediately
            - clear_last_searched: Reset all timestamps before scraping
    """
    correlation_id = str(uuid.uuid4())[:8]

    structlog.contextvars.bind_contextvars(
        operation="manual_target_search",
        correlation_id=correlation_id
    )

    logger.info(
        "Manual target track search triggered",
        force_rescrape=request.force_rescrape,
        clear_last_searched=request.clear_last_searched,
        track_id=request.track_id,
        artist=request.artist,
        title=request.title,
        limit=request.limit
    )

    if not search_orchestrator:
        logger.error("Search orchestrator not available")
        raise HTTPException(
            status_code=503,
            detail="Search orchestrator not available"
        )

    # Execute in background with all parameters
    background_tasks.add_task(
        execute_search_with_metrics,
        force_rescrape=request.force_rescrape,
        clear_last_searched=request.clear_last_searched,
        track_id=request.track_id,
        artist=request.artist,
        title=request.title,
        limit=request.limit
    )

    response_data = {
        "status": "started",
        "message": "Target track search pipeline started in background",
        "correlation_id": correlation_id,
        "timestamp": datetime.now().isoformat(),
        "force_rescrape": request.force_rescrape,
        "clear_last_searched": request.clear_last_searched,
        "limit": request.limit
    }

    # Add optional fields if provided
    if request.track_id:
        response_data["track_id"] = request.track_id
    if request.artist:
        response_data["artist"] = request.artist
    if request.title:
        response_data["title"] = request.title

    return response_data

async def execute_search_with_metrics(
    force_rescrape: bool = False,
    clear_last_searched: bool = False,
    track_id: Optional[str] = None,
    artist: Optional[str] = None,
    title: Optional[str] = None,
    limit: int = 20
):
    """Execute search pipeline with metrics tracking

    Args:
        force_rescrape: If True, bypass 24-hour rate limit
        clear_last_searched: If True, clear timestamps before scraping
        track_id: If provided, scrape only this specific track
        artist: If provided, filter tracks by artist
        title: If provided, filter tracks by title
        limit: Maximum number of tracks to process
    """
    start_time = time.time()

    try:
        await search_orchestrator.execute_search_pipeline(
            force_rescrape=force_rescrape,
            clear_last_searched=clear_last_searched,
            track_id=track_id,
            artist=artist,
            title=title,
            limit=limit
        )
        execution_time = time.time() - start_time

        scraping_duration.labels(scraper="orchestrator").observe(execution_time)
        scraping_tasks_total.labels(scraper="orchestrator", status="success").inc()

        logger.info(
            "Search pipeline completed successfully",
            execution_time=f"{execution_time:.3f}s",
            force_rescrape=force_rescrape,
            clear_last_searched=clear_last_searched,
            track_id=track_id,
            artist=artist,
            title=title,
            limit=limit
        )

    except Exception as e:
        execution_time = time.time() - start_time

        scraping_duration.labels(scraper="orchestrator").observe(execution_time)
        scraping_tasks_total.labels(scraper="orchestrator", status="error").inc()

        logger.error(
            "Search pipeline failed",
            error=str(e),
            execution_time=f"{execution_time:.3f}s",
            force_rescrape=force_rescrape,
            clear_last_searched=clear_last_searched,
            track_id=track_id,
            artist=artist,
            title=title,
            limit=limit
        )

@app.get("/scrapers/status")
async def get_scrapers_status():
    """Get status of all scrapers with circuit breaker information"""
    correlation_id = str(uuid.uuid4())[:8]

    structlog.contextvars.bind_contextvars(
        operation="get_scrapers_status",
        correlation_id=correlation_id
    )

    try:
        scrapers_config = [
            {"name": "1001tracklists", "url": "http://scraper-1001tracklists:8011", "health_endpoint": "/health"},
            {"name": "mixesdb", "url": "http://scraper-mixesdb:8012", "health_endpoint": "/health"},
            {"name": "setlistfm", "url": "http://scraper-setlistfm:8013", "health_endpoint": "/health"},
            {"name": "reddit", "url": "http://scraper-reddit:8014", "health_endpoint": "/health"},
            {"name": "mixcloud", "url": "http://scraper-mixcloud:8015", "health_endpoint": "/health"},
            {"name": "soundcloud", "url": "http://scraper-soundcloud:8016", "health_endpoint": "/health"},
            {"name": "youtube", "url": "http://scraper-youtube:8017", "health_endpoint": "/health"},
            {"name": "internetarchive", "url": "http://scraper-internetarchive:8018", "health_endpoint": "/health"},
            {"name": "livetracklist", "url": "http://scraper-livetracklist:8019", "health_endpoint": "/health"},
            {"name": "residentadvisor", "url": "http://scraper-residentadvisor:8023", "health_endpoint": "/health"},
        ]

        scrapers_status = []

        for scraper in scrapers_config:
            try:
                async with asyncio.timeout(5.0):
                    response = await connection_manager.http_client.get(
                        f"{scraper['url']}{scraper['health_endpoint']}"
                    )

                if response.status_code == 200:
                    scrapers_status.append({
                        "name": scraper["name"],
                        "status": "healthy",
                        "url": scraper["url"],
                        "response_time": response.elapsed.total_seconds() if hasattr(response, 'elapsed') else 0,
                        "last_checked": datetime.now().isoformat()
                    })
                    active_scrapers.labels(scraper=scraper["name"]).set(1)
                else:
                    scrapers_status.append({
                        "name": scraper["name"],
                        "status": "unhealthy",
                        "url": scraper["url"],
                        "status_code": response.status_code,
                        "last_checked": datetime.now().isoformat()
                    })
                    active_scrapers.labels(scraper=scraper["name"]).set(0)

            except Exception as e:
                scrapers_status.append({
                    "name": scraper["name"],
                    "status": "error",
                    "url": scraper["url"],
                    "error": str(e),
                    "last_checked": datetime.now().isoformat()
                })
                active_scrapers.labels(scraper=scraper["name"]).set(0)

        # Include circuit breaker status
        circuit_breaker_status = {}
        if target_searcher:
            searcher_health = await target_searcher.health_check()
            circuit_breaker_status = searcher_health.get('circuit_breakers', {})

        logger.info("Scrapers status check completed", scrapers_count=len(scrapers_status))

        return {
            "scrapers": scrapers_status,
            "circuit_breakers": circuit_breaker_status,
            "total_scrapers": len(scrapers_status),
            "healthy_scrapers": len([s for s in scrapers_status if s["status"] == "healthy"]),
            "timestamp": datetime.now().isoformat(),
            "correlation_id": correlation_id
        }

    except Exception as e:
        logger.error("Failed to get scrapers status", error=str(e))
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get scrapers status: {str(e)}"
        )

@app.get("/queue/status")
async def get_queue_status():
    """Get queue status with enhanced metrics"""
    correlation_id = str(uuid.uuid4())[:8]

    try:
        # Get queue sizes from Redis (synchronous calls - redis-py client is sync)
        high_queue_size = connection_manager.redis_client.llen('scraping:queue:high') or 0
        medium_queue_size = connection_manager.redis_client.llen('scraping:queue:medium') or 0
        low_queue_size = connection_manager.redis_client.llen('scraping:queue:low') or 0

        # Also check the main scraping_queue that consumer uses
        main_queue_size = connection_manager.redis_client.llen('scraping_queue') or 0
        failed_queue_size = connection_manager.redis_client.llen('scraping_queue:failed') or 0

        # Get consumer stats if available
        consumer_stats = {}
        if redis_consumer:
            consumer_stats = await redis_consumer.get_stats()

        # Update metrics
        queue_size.labels(priority='high').set(high_queue_size)
        queue_size.labels(priority='medium').set(medium_queue_size)
        queue_size.labels(priority='low').set(low_queue_size)

        return {
            "queues": {
                "high_priority": high_queue_size,
                "medium_priority": medium_queue_size,
                "low_priority": low_queue_size,
                "main_queue": main_queue_size,
                "failed_queue": failed_queue_size,
                "total": high_queue_size + medium_queue_size + low_queue_size + main_queue_size
            },
            "consumer": consumer_stats,
            "timestamp": datetime.now().isoformat(),
            "correlation_id": correlation_id
        }

    except Exception as e:
        logger.error("Failed to get queue status", error=str(e))
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get queue status: {str(e)}"
        )

@app.post("/queue/clear")
async def clear_queue(queue_type: Optional[str] = None):
    """
    Clear scraping queue(s)

    Args:
        queue_type: Optional queue type to clear ('high', 'medium', 'low', 'main', 'failed', 'all')
                   If not specified, clears all queues
    """
    correlation_id = str(uuid.uuid4())[:8]

    structlog.contextvars.bind_contextvars(
        operation="clear_queue",
        queue_type=queue_type or "all",
        correlation_id=correlation_id
    )

    try:
        cleared_counts = {}

        # Define queue keys
        queue_keys = {
            'high': 'scraping:queue:high',
            'medium': 'scraping:queue:medium',
            'low': 'scraping:queue:low',
            'main': 'scraping_queue',
            'failed': 'scraping_queue:failed'
        }

        # Determine which queues to clear
        if queue_type and queue_type != 'all':
            if queue_type not in queue_keys:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid queue type. Must be one of: {', '.join(queue_keys.keys())}, all"
                )
            queues_to_clear = {queue_type: queue_keys[queue_type]}
        else:
            queues_to_clear = queue_keys

        # Clear each queue and track counts
        for queue_name, queue_key in queues_to_clear.items():
            # Get current size before clearing
            queue_length = connection_manager.redis_client.llen(queue_key) or 0

            if queue_length > 0:
                # Delete the queue (this removes all items)
                connection_manager.redis_client.delete(queue_key)
                cleared_counts[queue_name] = queue_length
                logger.info(
                    "Queue cleared",
                    queue=queue_name,
                    items_cleared=queue_length,
                    correlation_id=correlation_id
                )
            else:
                cleared_counts[queue_name] = 0

        # Reset metrics for cleared queues
        for queue_name in cleared_counts.keys():
            if queue_name in ['high', 'medium', 'low']:
                queue_size.labels(priority=queue_name).set(0)

        total_cleared = sum(cleared_counts.values())

        logger.info(
            "Queue clearing completed",
            total_cleared=total_cleared,
            details=cleared_counts,
            correlation_id=correlation_id
        )

        return {
            "status": "success",
            "message": f"Cleared {total_cleared} items from queue(s)",
            "cleared_queues": cleared_counts,
            "total_items_cleared": total_cleared,
            "timestamp": datetime.now().isoformat(),
            "correlation_id": correlation_id
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to clear queue", error=str(e), correlation_id=correlation_id)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to clear queue: {str(e)}"
        )

@app.post("/queue/cleanup-expired")
async def trigger_failed_queue_cleanup():
    """
    Manually trigger cleanup of expired failed queue items (older than 3 days)

    This endpoint is useful for testing the automatic cleanup that runs daily at 3 AM.
    """
    correlation_id = str(uuid.uuid4())[:8]

    structlog.contextvars.bind_contextvars(
        operation="manual_failed_queue_cleanup",
        correlation_id=correlation_id
    )

    try:
        logger.info("Manual cleanup triggered via API", correlation_id=correlation_id)

        # Run the cleanup function
        await cleanup_expired_failed_tasks()

        # Get updated queue status
        failed_queue_size = connection_manager.redis_client.llen('scraping_queue:failed') or 0

        return {
            "status": "success",
            "message": "Failed queue cleanup completed",
            "remaining_failed_tasks": failed_queue_size,
            "timestamp": datetime.now().isoformat(),
            "correlation_id": correlation_id
        }

    except Exception as e:
        logger.error("Manual cleanup failed", error=str(e), correlation_id=correlation_id)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to cleanup expired tasks: {str(e)}"
        )

# ===================
# ENHANCED TASK MANAGEMENT
# ===================
@app.post("/tasks/add")
async def add_task_enhanced(task: ScrapingTask):
    """Add scraping task with enhanced error handling and metrics"""
    correlation_id = str(uuid.uuid4())[:8]

    structlog.contextvars.bind_contextvars(
        operation="add_task",
        scraper=task.scraper,
        correlation_id=correlation_id
    )

    try:
        # Generate task ID if not provided
        if not task.id:
            task.id = f"{task.scraper}_{int(time.time() * 1000000)}"

        # Set timestamps
        task.created_at = datetime.now()
        task.correlation_id = correlation_id

        # Determine queue based on priority
        queue_key = f"scraping:queue:{task.priority.value}"

        logger.info("Adding task to queue", task_id=task.id, queue=queue_key)

        # Convert to dict for Redis storage
        task_dict = task.model_dump()
        task_dict['created_at'] = task_dict['created_at'].isoformat()

        # Add to Redis queue (synchronous call - redis-py client is sync)
        connection_manager.redis_client.lpush(
            queue_key,
            json.dumps(task_dict)
        )

        # Update metrics
        scraping_tasks_total.labels(scraper=task.scraper, status="queued").inc()

        logger.info("Task added successfully", task_id=task.id)

        return {
            "status": "success",
            "message": "Task added to queue successfully",
            "task_id": task.id,
            "queue": queue_key,
            "correlation_id": correlation_id,
            "timestamp": datetime.now().isoformat()
        }

    except Exception as e:
        logger.error("Failed to add task", error=str(e), task_id=task.id)
        scraping_tasks_total.labels(scraper=task.scraper, status="error").inc()

        raise HTTPException(
            status_code=500,
            detail=f"Failed to add task: {str(e)}"
        )

@app.get("/browser-collector/stats")
async def get_browser_collector_stats():
    """Get browser-collector fallback statistics"""
    if not browser_collector_fallback:
        return {"status": "not_initialized", "stats": None}

    try:
        stats = await browser_collector_fallback.get_statistics()
        health = await browser_collector_fallback.health_check()

        return {
            "status": "active" if health.get("status") == "healthy" else "unhealthy",
            "health": health,
            "statistics": stats
        }
    except Exception as e:
        logger.error("Failed to get browser-collector stats", error=str(e))
        return {"status": "error", "error": str(e)}

# ===================
# OBSERVABILITY API ENDPOINTS
# ===================
@app.get("/api/v1/observability/runs")
async def get_scraping_runs(
    limit: int = 20,
    offset: int = 0,
    status: Optional[str] = None
):
    """
    Get list of scraping runs with pagination and optional status filter

    Args:
        limit: Maximum number of runs to return (default 20)
        offset: Number of runs to skip (default 0)
        status: Optional status filter (e.g., 'completed', 'failed', 'running')

    Returns:
        List of scraping run records
    """
    correlation_id = str(uuid.uuid4())[:8]

    structlog.contextvars.bind_contextvars(
        operation="get_scraping_runs",
        correlation_id=correlation_id,
        limit=limit,
        offset=offset,
        status_filter=status
    )

    try:
        async with connection_manager.session_factory() as session:
            # Build query - only select existing columns
            query = """
                SELECT
                    run_id,
                    scraper_name,
                    start_time,
                    end_time,
                    status,
                    tracks_searched,
                    playlists_found,
                    songs_added,
                    artists_added,
                    errors_count
                FROM scraping_runs
            """

            params = {}
            if status:
                query += " WHERE status = :status"
                params['status'] = status

            query += " ORDER BY start_time DESC LIMIT :limit OFFSET :offset"
            params['limit'] = limit
            params['offset'] = offset

            result = await session.execute(text(query), params)
            rows = result.fetchall()

            runs = []
            for row in rows:
                runs.append({
                    'run_id': str(row.run_id),
                    'scraper_name': row.scraper_name,
                    'start_time': row.start_time.isoformat() if row.start_time else None,
                    'end_time': row.end_time.isoformat() if row.end_time else None,
                    'status': row.status,
                    'tracks_searched': row.tracks_searched,
                    'playlists_found': row.playlists_found,
                    'songs_added': row.songs_added,
                    'artists_added': row.artists_added,
                    'errors_count': row.errors_count,
                    # These columns will be added later via other tables
                    'avg_quality_score': None,
                    'quality_issues': None,
                    'playlists_validated': None,
                    'validation_failures': None,
                    'sources_attempted': None,
                    'sources_successful': None,
                    'avg_response_time_ms': None,
                    'critical_anomalies': None,
                    'warning_anomalies': None
                })

            logger.info(f"Retrieved {len(runs)} scraping runs", correlation_id=correlation_id)
            return runs

    except Exception as e:
        logger.error("Failed to get scraping runs", error=str(e), correlation_id=correlation_id)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get scraping runs: {str(e)}"
        )

@app.get("/api/v1/observability/metrics/summary")
async def get_metrics_summary():
    """
    Get aggregated metrics summary for the pipeline monitoring dashboard

    Returns:
        Summary metrics including total runs, success rate, songs scraped, etc.
    """
    correlation_id = str(uuid.uuid4())[:8]

    structlog.contextvars.bind_contextvars(
        operation="get_metrics_summary",
        correlation_id=correlation_id
    )

    try:
        async with connection_manager.session_factory() as session:
            # Get overall summary
            summary_query = """
                SELECT
                    COUNT(*) as total_runs,
                    COUNT(*) FILTER (WHERE status = 'completed') as successful_runs,
                    COUNT(*) FILTER (WHERE status = 'failed') as failed_runs,
                    COUNT(*) FILTER (WHERE start_time >= NOW() - INTERVAL '24 hours') as runs_last_24h,
                    AVG(songs_added) as avg_songs_per_run,
                    SUM(songs_added) as total_songs_scraped,
                    SUM(artists_added) as total_artists_scraped
                FROM scraping_runs
            """

            result = await session.execute(text(summary_query))
            row = result.fetchone()

            summary = {
                'total_runs': row.total_runs or 0,
                'successful_runs': row.successful_runs or 0,
                'failed_runs': row.failed_runs or 0,
                'runs_last_24h': row.runs_last_24h or 0,
                'avg_songs_per_run': float(row.avg_songs_per_run) if row.avg_songs_per_run else 0,
                'total_songs_scraped': row.total_songs_scraped or 0,
                'total_artists_scraped': row.total_artists_scraped or 0
            }

            # Return empty data for now (quality_by_pillar and recent_anomalies tables may not exist yet)
            return {
                'summary': summary,
                'quality_by_pillar': [],
                'recent_anomalies': []
            }

    except Exception as e:
        logger.error("Failed to get metrics summary", error=str(e), correlation_id=correlation_id)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get metrics summary: {str(e)}"
        )

@app.get("/api/v1/observability/health")
async def get_pipeline_health(hours: int = 24):
    """
    Get pipeline health metrics over time

    Args:
        hours: Number of hours to look back (default 24)

    Returns:
        Time-series health data for the pipeline
    """
    correlation_id = str(uuid.uuid4())[:8]

    structlog.contextvars.bind_contextvars(
        operation="get_pipeline_health",
        correlation_id=correlation_id,
        hours=hours
    )

    try:
        # For now, return empty array since we don't have time-series health data yet
        # In a real implementation, you would aggregate scraping_runs data by time buckets
        return []

    except Exception as e:
        logger.error("Failed to get pipeline health", error=str(e), correlation_id=correlation_id)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get pipeline health: {str(e)}"
        )

@app.get("/api/v1/observability/data-completeness")
async def get_data_completeness():
    """
    Get data completeness metrics for tracks, artists, and setlists

    Returns comprehensive data quality metrics showing what data exists and what's missing,
    organized by enrichment pipeline dependency levels.
    """
    correlation_id = str(uuid.uuid4())[:8]

    structlog.contextvars.bind_contextvars(
        operation="get_data_completeness",
        correlation_id=correlation_id
    )

    try:
        async with connection_manager.session_factory() as session:
            # Get total counts
            total_counts_query = """
                SELECT
                    (SELECT COUNT(*) FROM tracks) as total_tracks,
                    (SELECT COUNT(*) FROM artists) as total_artists,
                    (SELECT COUNT(*) FROM playlists) as total_playlists
            """
            result = await session.execute(text(total_counts_query))
            totals = result.fetchone()

            total_tracks = totals.total_tracks or 0
            total_artists = totals.total_artists or 0
            total_playlists = totals.total_playlists or 0

            # For now, return a basic structure with placeholder data
            # In a real implementation, you would query the actual completeness metrics
            return {
                'total_counts': {
                    'tracks': total_tracks,
                    'artists': total_artists,
                    'setlists': total_playlists  # Frontend expects 'setlists' key
                },
                'track_completeness': {
                    'artist_attribution': {
                        'count': total_tracks,  # Placeholder - all tracks have artists
                        'percentage': 100.0,
                        'missing': 0,
                        'blocking_enrichment': False,
                        'dependency_level': 1,
                        'description': 'Tracks must have artist attribution to proceed with enrichment'
                    },
                    'platform_ids': {},
                    'audio_features': {},
                    'metadata': {}
                },
                'artist_completeness': {
                    'total_artists': total_artists,
                    'artists_with_tracks': total_artists,
                    'platform_ids': {}
                },
                'setlist_completeness': {
                    'total_setlists': total_playlists,
                    'complete_setlists': total_playlists,
                    'setlists_with_tracks': total_playlists,
                    'setlists_with_performer': total_playlists
                },
                'enrichment_pipeline_status': {
                    'tracks_ready_for_enrichment': total_tracks,
                    'tracks_blocking_enrichment': 0,
                    'enrichment_readiness_rate': 100.0
                },
                'data_quality': {
                    'total_checks': 0,
                    'passed': 0,
                    'warned': 0,
                    'failed': 0,
                    'avg_score': 0.0
                }
            }

    except Exception as e:
        logger.error("Failed to get data completeness", error=str(e), correlation_id=correlation_id)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get data completeness: {str(e)}"
        )

if __name__ == "__main__":
    import uvicorn
    import sys

    # Validate secrets before starting service
    if not validate_secrets():
        logger.error("❌ Required secrets missing - exiting")
        sys.exit(1)

    # Enhanced server configuration
    uvicorn.run(
        "main_2025:app",
        host="0.0.0.0",
        port=8001,
        reload=False,  # Disable in production
        log_level="info",
        access_log=True,
        server_header=False,  # Don't expose server info
        date_header=True
    )