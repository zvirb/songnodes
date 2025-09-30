"""
🎵 SongNodes Metadata Enrichment Service
Waterfall pipeline for comprehensive track metadata enrichment using multiple APIs
"""

import asyncio
import hashlib
import json
import os
import time
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional

import aiohttp
import httpx
import redis.asyncio as aioredis
import structlog
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from fastapi import BackgroundTasks, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse
from prometheus_client import Counter, Gauge, Histogram, generate_latest
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

# Import enrichment components
from api_clients import (
    SpotifyClient,
    MusicBrainzClient,
    DiscogsClient,
    BeatportClient,
    LastFMClient
)
from enrichment_pipeline import MetadataEnrichmentPipeline
from circuit_breaker import CircuitBreaker, CircuitBreakerState
from db_api_keys import initialize_api_key_helper, get_service_keys, close_api_key_helper

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

# ===================
# METRICS
# ===================
enrichment_tasks_total = Counter('enrichment_tasks_total', 'Total enrichment tasks', ['source', 'status'])
api_calls_total = Counter('api_calls_total', 'Total API calls', ['api', 'status'])
api_response_time = Histogram('api_response_time_seconds', 'API response time', ['api'])
cache_hits = Counter('enrichment_cache_hits_total', 'Cache hits', ['cache_type'])
cache_misses = Counter('enrichment_cache_misses_total', 'Cache misses', ['cache_type'])
circuit_breaker_state_metric = Gauge('enrichment_circuit_breaker_state', 'Circuit breaker state', ['api', 'state'])
tracks_enriched = Counter('tracks_enriched_total', 'Total tracks enriched', ['status'])
enrichment_duration = Histogram('enrichment_duration_seconds', 'Enrichment duration', ['stage'])

# ===================
# DATA MODELS
# ===================
class EnrichmentStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    PARTIAL = "partial"

class EnrichmentSource(str, Enum):
    SPOTIFY = "spotify"
    MUSICBRAINZ = "musicbrainz"
    DISCOGS = "discogs"
    BEATPORT = "beatport"
    LASTFM = "lastfm"

class EnrichmentTask(BaseModel):
    track_id: str
    artist_name: str
    track_title: str
    existing_spotify_id: Optional[str] = None
    existing_isrc: Optional[str] = None
    existing_musicbrainz_id: Optional[str] = None
    priority: int = Field(default=5, ge=1, le=10)
    force_refresh: bool = False
    correlation_id: Optional[str] = None

class EnrichmentResult(BaseModel):
    track_id: str
    status: EnrichmentStatus
    sources_used: List[EnrichmentSource]
    metadata_acquired: Dict[str, Any]
    errors: List[str]
    duration_seconds: float
    cached: bool
    timestamp: datetime

# ===================
# CONNECTION MANAGER
# ===================
class EnrichmentConnectionManager:
    def __init__(self):
        self.db_engine = None
        self.session_factory = None
        self.redis_client = None
        self.http_client = None

    async def initialize(self):
        """Initialize all connections"""
        logger.info("Initializing enrichment connection manager")

        # Database connection
        database_url = os.getenv(
            "DATABASE_URL",
            "postgresql+asyncpg://musicdb_user:musicdb_secure_pass@db-connection-pool:6432/musicdb"
        )

        self.db_engine = create_async_engine(
            database_url,
            pool_size=15,
            max_overflow=25,
            pool_timeout=30,
            pool_recycle=3600,
            pool_pre_ping=True,
            echo=False,
            future=True
        )

        self.session_factory = async_sessionmaker(
            self.db_engine,
            class_=AsyncSession,
            expire_on_commit=False
        )

        # Redis connection for caching
        redis_host = os.getenv("REDIS_HOST", "redis")
        redis_port = int(os.getenv("REDIS_PORT", 6379))

        self.redis_client = await aioredis.from_url(
            f"redis://{redis_host}:{redis_port}",
            decode_responses=False,  # We'll handle encoding
            socket_connect_timeout=5,
            socket_timeout=5,
            retry_on_timeout=True,
            health_check_interval=30,
            max_connections=50
        )

        # HTTP client
        self.http_client = httpx.AsyncClient(
            timeout=httpx.Timeout(30.0, connect=10.0),
            limits=httpx.Limits(max_keepalive_connections=50, max_connections=200)
        )

        logger.info("Connection manager initialized successfully")

    async def health_check(self) -> Dict[str, str]:
        """Health check for all connections"""
        health_status = {}

        try:
            async with self.session_factory() as session:
                await session.execute(text("SELECT 1"))
            health_status['database'] = 'healthy'
        except Exception as e:
            health_status['database'] = f'unhealthy: {e}'

        try:
            await self.redis_client.ping()
            health_status['redis'] = 'healthy'
        except Exception as e:
            health_status['redis'] = f'unhealthy: {e}'

        try:
            await self.http_client.get('https://httpbin.org/status/200', timeout=5.0)
            health_status['http_client'] = 'healthy'
        except Exception as e:
            health_status['http_client'] = f'unhealthy: {e}'

        return health_status

    async def close(self):
        """Graceful shutdown"""
        logger.info("Closing enrichment connection manager")

        if self.http_client:
            await self.http_client.aclose()

        if self.redis_client:
            await self.redis_client.close()

        if self.db_engine:
            await self.db_engine.dispose()

# ===================
# APPLICATION SETUP
# ===================
connection_manager = EnrichmentConnectionManager()
scheduler = AsyncIOScheduler()
enrichment_pipeline = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan management"""
    global enrichment_pipeline

    logger.info("Starting Metadata Enrichment Service")

    try:
        # Initialize connections
        await connection_manager.initialize()

        # Initialize database API key helper
        database_url = os.getenv(
            "DATABASE_URL",
            "postgresql://musicdb_user:musicdb_secure_pass@db:5432/musicdb"
        )
        await initialize_api_key_helper(database_url)
        logger.info("Database API key helper initialized")

        # Retrieve API keys from database (with fallback to environment variables)
        spotify_keys = await get_service_keys('spotify')
        musicbrainz_keys = await get_service_keys('musicbrainz')
        discogs_keys = await get_service_keys('discogs')
        lastfm_keys = await get_service_keys('lastfm')

        # Initialize API clients with database keys
        spotify_client = SpotifyClient(
            client_id=spotify_keys.get('client_id') or os.getenv("SPOTIFY_CLIENT_ID"),
            client_secret=spotify_keys.get('client_secret') or os.getenv("SPOTIFY_CLIENT_SECRET"),
            redis_client=connection_manager.redis_client
        )
        logger.info("Spotify client initialized", has_credentials=bool(spotify_client.client_id))

        musicbrainz_client = MusicBrainzClient(
            user_agent=musicbrainz_keys.get('user_agent') or os.getenv("MUSICBRAINZ_USER_AGENT", "SongNodes/1.0 (contact@songnodes.com)"),
            redis_client=connection_manager.redis_client
        )
        logger.info("MusicBrainz client initialized")

        discogs_client = DiscogsClient(
            token=discogs_keys.get('token') or os.getenv("DISCOGS_TOKEN"),
            redis_client=connection_manager.redis_client
        )
        logger.info("Discogs client initialized", has_token=bool(discogs_client.token))

        beatport_client = BeatportClient(
            redis_client=connection_manager.redis_client
        )
        logger.info("Beatport client initialized")

        lastfm_client = LastFMClient(
            api_key=lastfm_keys.get('api_key') or os.getenv("LASTFM_API_KEY"),
            redis_client=connection_manager.redis_client
        )
        logger.info("Last.fm client initialized", has_api_key=bool(lastfm_client.api_key))

        # Initialize enrichment pipeline
        enrichment_pipeline = MetadataEnrichmentPipeline(
            spotify_client=spotify_client,
            musicbrainz_client=musicbrainz_client,
            discogs_client=discogs_client,
            beatport_client=beatport_client,
            lastfm_client=lastfm_client,
            db_session_factory=connection_manager.session_factory,
            redis_client=connection_manager.redis_client
        )

        # Start scheduler
        scheduler.start()

        # Add scheduled enrichment tasks
        scheduler.add_job(
            process_pending_enrichments,
            trigger=CronTrigger(minute="*/15"),  # Every 15 minutes
            id="process_pending_enrichments",
            max_instances=1,
            coalesce=True
        )

        scheduler.add_job(
            update_circuit_breaker_metrics,
            trigger=CronTrigger(minute="*"),  # Every minute
            id="update_circuit_breaker_metrics",
            max_instances=1,
            coalesce=True
        )

        logger.info("Metadata Enrichment Service started successfully")

    except Exception as e:
        logger.error("Failed to start application", error=str(e))
        raise

    yield  # Application running

    # Shutdown
    logger.info("Shutting down Metadata Enrichment Service")

    try:
        scheduler.shutdown()
        await close_api_key_helper()
        await connection_manager.close()
        logger.info("Graceful shutdown completed")

    except Exception as e:
        logger.error("Error during shutdown", error=str(e))

app = FastAPI(
    title="SongNodes Metadata Enrichment Service",
    description="Waterfall pipeline for comprehensive track metadata enrichment",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ===================
# SCHEDULED TASKS
# ===================
async def process_pending_enrichments():
    """Process tracks pending enrichment"""
    correlation_id = str(uuid.uuid4())[:8]

    structlog.contextvars.bind_contextvars(
        operation="process_pending_enrichments",
        correlation_id=correlation_id
    )

    logger.info("Starting scheduled enrichment processing")

    try:
        async with connection_manager.session_factory() as session:
            # Find tracks that need enrichment
            query = text("""
                SELECT t.id, t.title,
                       COALESCE(ta.artist_names, 'Unknown') as artist_name,
                       t.spotify_id, t.isrc, t.metadata->>'musicbrainz_id' as musicbrainz_id,
                       es.status, es.last_attempt
                FROM tracks t
                LEFT JOIN (
                    SELECT ta.track_id, STRING_AGG(a.name, ', ') as artist_names
                    FROM track_artists ta
                    JOIN artists a ON ta.artist_id = a.id
                    WHERE ta.role = 'primary'
                    GROUP BY ta.track_id
                ) ta ON t.id = ta.track_id
                LEFT JOIN enrichment_status es ON t.id = es.track_id
                WHERE (
                    es.status IS NULL
                    OR es.status = 'pending'
                    OR (es.status = 'failed' AND es.retry_count < 3)
                    OR (es.status = 'partial' AND es.last_attempt < NOW() - INTERVAL '24 hours')
                )
                AND (t.metadata IS NULL OR jsonb_array_length(COALESCE(t.metadata->'enrichment_sources', '[]'::jsonb)) < 2)
                LIMIT 100
            """)

            result = await session.execute(query)
            pending_tracks = result.fetchall()

            logger.info(f"Found {len(pending_tracks)} tracks pending enrichment")

            # Process in batches
            batch_size = 10
            for i in range(0, len(pending_tracks), batch_size):
                batch = pending_tracks[i:i+batch_size]
                tasks = []

                for track in batch:
                    task = EnrichmentTask(
                        track_id=str(track.id),
                        artist_name=track.artist_name,
                        track_title=track.title,
                        existing_spotify_id=track.spotify_id,
                        existing_isrc=track.isrc,
                        existing_musicbrainz_id=track.musicbrainz_id,
                        correlation_id=correlation_id
                    )
                    tasks.append(enrichment_pipeline.enrich_track(task))

                # Execute batch
                results = await asyncio.gather(*tasks, return_exceptions=True)

                # Log results
                success_count = sum(1 for r in results if isinstance(r, EnrichmentResult) and r.status == EnrichmentStatus.COMPLETED)
                logger.info(f"Batch processed: {success_count}/{len(batch)} successful")

                # Add delay between batches to respect rate limits
                await asyncio.sleep(5)

    except Exception as e:
        logger.error("Scheduled enrichment processing failed", error=str(e))

async def update_circuit_breaker_metrics():
    """Update circuit breaker metrics"""
    if enrichment_pipeline:
        for api_name, client in [
            ('spotify', enrichment_pipeline.spotify_client),
            ('musicbrainz', enrichment_pipeline.musicbrainz_client),
            ('discogs', enrichment_pipeline.discogs_client),
            ('beatport', enrichment_pipeline.beatport_client),
            ('lastfm', enrichment_pipeline.lastfm_client)
        ]:
            if hasattr(client, 'circuit_breaker'):
                state = client.circuit_breaker.state.value
                for s in ['closed', 'open', 'half_open']:
                    circuit_breaker_state_metric.labels(api=api_name, state=s).set(1 if s == state else 0)

# ===================
# API ENDPOINTS
# ===================
@app.get("/health")
async def health_check():
    """Comprehensive health check"""
    try:
        health_status = {
            'service': 'metadata-enrichment',
            'status': 'healthy',
            'timestamp': datetime.now().isoformat(),
            'version': '1.0.0',
            'connections': await connection_manager.health_check()
        }

        # Check API client health
        if enrichment_pipeline:
            health_status['api_clients'] = {
                'spotify': 'healthy' if enrichment_pipeline.spotify_client else 'unavailable',
                'musicbrainz': 'healthy' if enrichment_pipeline.musicbrainz_client else 'unavailable',
                'discogs': 'healthy' if enrichment_pipeline.discogs_client else 'unavailable',
                'beatport': 'healthy' if enrichment_pipeline.beatport_client else 'unavailable',
                'lastfm': 'healthy' if enrichment_pipeline.lastfm_client else 'unavailable'
            }

        connection_health = all('healthy' in status for status in health_status['connections'].values())

        if not connection_health:
            health_status['status'] = 'degraded'
            return JSONResponse(status_code=503, content=health_status)

        return health_status

    except Exception as e:
        logger.error("Health check failed", error=str(e))
        return JSONResponse(
            status_code=503,
            content={
                'service': 'metadata-enrichment',
                'status': 'unhealthy',
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }
        )

@app.get("/metrics")
async def prometheus_metrics():
    """Prometheus metrics endpoint"""
    return PlainTextResponse(generate_latest())

@app.post("/enrich")
async def enrich_track(task: EnrichmentTask, background_tasks: BackgroundTasks):
    """Enrich a single track"""
    correlation_id = task.correlation_id or str(uuid.uuid4())[:8]

    structlog.contextvars.bind_contextvars(
        operation="enrich_track",
        track_id=task.track_id,
        correlation_id=correlation_id
    )

    logger.info("Track enrichment requested", track_id=task.track_id)

    if not enrichment_pipeline:
        raise HTTPException(status_code=503, detail="Enrichment pipeline not available")

    try:
        result = await enrichment_pipeline.enrich_track(task)

        enrichment_tasks_total.labels(source='api', status=result.status.value).inc()
        tracks_enriched.labels(status=result.status.value).inc()

        return result

    except Exception as e:
        logger.error("Track enrichment failed", error=str(e), track_id=task.track_id)
        enrichment_tasks_total.labels(source='api', status='error').inc()
        raise HTTPException(status_code=500, detail=f"Enrichment failed: {str(e)}")

@app.post("/enrich/batch")
async def enrich_batch(tasks: List[EnrichmentTask], background_tasks: BackgroundTasks):
    """Enrich multiple tracks in batch"""
    correlation_id = str(uuid.uuid4())[:8]

    structlog.contextvars.bind_contextvars(
        operation="enrich_batch",
        batch_size=len(tasks),
        correlation_id=correlation_id
    )

    logger.info(f"Batch enrichment requested for {len(tasks)} tracks")

    if not enrichment_pipeline:
        raise HTTPException(status_code=503, detail="Enrichment pipeline not available")

    # Execute in background
    background_tasks.add_task(process_enrichment_batch, tasks, correlation_id)

    return {
        "status": "processing",
        "batch_size": len(tasks),
        "correlation_id": correlation_id,
        "message": "Batch enrichment started in background"
    }

async def process_enrichment_batch(tasks: List[EnrichmentTask], correlation_id: str):
    """Process a batch of enrichment tasks"""
    logger.info(f"Processing enrichment batch of {len(tasks)} tracks")

    results = []
    for task in tasks:
        task.correlation_id = correlation_id
        try:
            result = await enrichment_pipeline.enrich_track(task)
            results.append(result)
            enrichment_tasks_total.labels(source='batch', status=result.status.value).inc()
        except Exception as e:
            logger.error("Batch enrichment task failed", error=str(e), track_id=task.track_id)
            enrichment_tasks_total.labels(source='batch', status='error').inc()

        # Rate limiting between tasks
        await asyncio.sleep(0.5)

    success_count = sum(1 for r in results if r.status == EnrichmentStatus.COMPLETED)
    logger.info(f"Batch enrichment completed: {success_count}/{len(tasks)} successful")

@app.get("/stats")
async def get_enrichment_stats():
    """Get enrichment statistics"""
    try:
        async with connection_manager.session_factory() as session:
            stats_query = text("""
                SELECT
                    COUNT(*) as total_tracks,
                    COUNT(CASE WHEN spotify_id IS NOT NULL THEN 1 END) as with_spotify_id,
                    COUNT(CASE WHEN isrc IS NOT NULL THEN 1 END) as with_isrc,
                    COUNT(CASE WHEN metadata->>'musicbrainz_id' IS NOT NULL THEN 1 END) as with_musicbrainz_id,
                    COUNT(CASE WHEN bpm IS NOT NULL THEN 1 END) as with_bpm,
                    COUNT(CASE WHEN key IS NOT NULL THEN 1 END) as with_key,
                    COUNT(CASE WHEN energy IS NOT NULL THEN 1 END) as with_audio_features
                FROM tracks
            """)

            result = await session.execute(stats_query)
            stats = result.fetchone()

            enrichment_stats_query = text("""
                SELECT
                    status,
                    COUNT(*) as count,
                    AVG(retry_count) as avg_retries
                FROM enrichment_status
                GROUP BY status
            """)

            result = await session.execute(enrichment_stats_query)
            enrichment_stats = result.fetchall()

            return {
                "track_stats": {
                    "total_tracks": stats.total_tracks,
                    "with_spotify_id": stats.with_spotify_id,
                    "with_isrc": stats.with_isrc,
                    "with_musicbrainz_id": stats.with_musicbrainz_id,
                    "with_bpm": stats.with_bpm,
                    "with_key": stats.with_key,
                    "with_audio_features": stats.with_audio_features
                },
                "enrichment_status": [
                    {
                        "status": row.status,
                        "count": row.count,
                        "avg_retries": float(row.avg_retries) if row.avg_retries else 0
                    }
                    for row in enrichment_stats
                ],
                "timestamp": datetime.now().isoformat()
            }

    except Exception as e:
        logger.error("Failed to get enrichment stats", error=str(e))
        raise HTTPException(status_code=500, detail=f"Failed to get stats: {str(e)}")

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8020,
        reload=False,
        log_level="info",
        access_log=True
    )