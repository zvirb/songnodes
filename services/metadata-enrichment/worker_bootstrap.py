"""
Worker Bootstrap Module
========================

Shared initialization logic for both FastAPI service and RabbitMQ workers.
This ensures consistent configuration and prevents code duplication.

Usage:
    # In FastAPI service (main.py)
    bootstrap = await WorkerBootstrap.create()
    app.state.bootstrap = bootstrap

    # In RabbitMQ worker (queue_consumer.py)
    bootstrap = await WorkerBootstrap.create()
    pipeline = bootstrap.enrichment_pipeline
"""

import os
import logging
from typing import Optional, Dict, Any

import httpx
import redis.asyncio as aioredis
import structlog
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

# Import API clients
from api_clients import (
    SpotifyClient,
    MusicBrainzClient,
    DiscogsClient,
    BeatportClient,
    LastFMClient,
    AcousticBrainzClient,
    GetSongBPMClient
)
from enrichment_pipeline import MetadataEnrichmentPipeline
from config_loader import EnrichmentConfigLoader
from config_driven_enrichment import ConfigDrivenEnricher

logger = structlog.get_logger(__name__)


class WorkerBootstrap:
    """
    Centralized initialization for enrichment workers.

    Manages:
    - Database connection pool
    - Redis connection
    - HTTP client
    - API clients (Spotify, MusicBrainz, etc.)
    - Enrichment pipeline
    """

    def __init__(self):
        self.db_engine = None
        self.session_factory = None
        self.redis_client = None
        self.http_client = None

        # API clients
        self.spotify_client = None
        self.musicbrainz_client = None
        self.discogs_client = None
        self.beatport_client = None
        self.lastfm_client = None
        self.acousticbrainz_client = None
        self.getsongbpm_client = None

        # Enrichment components
        self.enrichment_pipeline = None
        self.config_loader = None
        self.config_driven_enricher = None

        self._initialized = False

    @classmethod
    async def create(cls) -> 'WorkerBootstrap':
        """
        Factory method to create and initialize bootstrap instance.

        Returns:
            Fully initialized WorkerBootstrap instance
        """
        instance = cls()
        await instance.initialize()
        return instance

    async def initialize(self):
        """Initialize all connections and API clients"""
        if self._initialized:
            logger.warning("WorkerBootstrap already initialized - skipping")
            return

        logger.info("🚀 Initializing worker bootstrap")

        # Step 1: Initialize database connection
        await self._init_database()

        # Step 2: Initialize Redis
        await self._init_redis()

        # Step 3: Initialize HTTP client
        await self._init_http_client()

        # Step 4: Initialize database API key helper
        await self._init_api_key_helper()

        # Step 5: Initialize API clients
        await self._init_api_clients()

        # Step 6: Initialize enrichment pipeline
        await self._init_enrichment_pipeline()

        # Step 7: Initialize config loader
        await self._init_config_loader()

        self._initialized = True
        logger.info("✅ Worker bootstrap initialization complete")

    async def _init_database(self):
        """Initialize database connection pool"""
        database_url = os.getenv(
            "DATABASE_URL",
            "postgresql+asyncpg://musicdb_user:musicdb_secure_pass_2024@db-connection-pool:6432/musicdb"
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

        logger.info("✓ Database connection pool initialized")

    async def _init_redis(self):
        """Initialize Redis connection"""
        redis_host = os.getenv("REDIS_HOST", "redis")
        redis_port = int(os.getenv("REDIS_PORT", 6379))
        redis_password = os.getenv("REDIS_PASSWORD", "")

        self.redis_client = await aioredis.from_url(
            f"redis://:{redis_password}@{redis_host}:{redis_port}",
            decode_responses=False,  # We handle encoding
            max_connections=50
        )

        # Verify connection
        await self.redis_client.ping()

        logger.info("✓ Redis connection initialized", host=redis_host, port=redis_port)

    async def _init_http_client(self):
        """Initialize HTTP client for API calls"""
        self.http_client = httpx.AsyncClient(
            timeout=httpx.Timeout(30.0, connect=10.0),
            limits=httpx.Limits(max_keepalive_connections=50, max_connections=200)
        )

        logger.info("✓ HTTP client initialized")

    async def _init_api_key_helper(self):
        """Initialize database API key helper"""
        from db_api_keys import initialize_api_key_helper, get_service_keys

        database_url = os.getenv(
            "DATABASE_URL",
            "postgresql://musicdb_user:musicdb_secure_pass_2024@db:5432/musicdb"
        )

        # asyncpg needs plain postgresql:// URL (strip +asyncpg if present)
        asyncpg_url = database_url.replace('+asyncpg', '')

        await initialize_api_key_helper(asyncpg_url)
        logger.info("✓ Database API key helper initialized")

    async def _init_api_clients(self):
        """Initialize all API clients with credentials from database/environment"""
        from db_api_keys import get_service_keys

        # Retrieve API keys from database (with fallback to environment variables)
        spotify_keys = await get_service_keys('spotify')
        musicbrainz_keys = await get_service_keys('musicbrainz')
        discogs_keys = await get_service_keys('discogs')
        lastfm_keys = await get_service_keys('lastfm')
        getsongbpm_keys = await get_service_keys('getsongbpm')

        # Spotify - only if credentials exist
        spotify_client_id = spotify_keys.get('client_id') or os.getenv("SPOTIFY_CLIENT_ID")
        spotify_client_secret = spotify_keys.get('client_secret') or os.getenv("SPOTIFY_CLIENT_SECRET")

        if spotify_client_id and spotify_client_secret:
            self.spotify_client = SpotifyClient(
                client_id=spotify_client_id,
                client_secret=spotify_client_secret,
                redis_client=self.redis_client,
                db_session_factory=self.session_factory
            )
            logger.info("✓ Spotify client initialized")
        else:
            logger.warning("⚠ Spotify client NOT initialized - no credentials (OK if not using Spotify)")

        # MusicBrainz - always initialize (has default user_agent)
        self.musicbrainz_client = MusicBrainzClient(
            user_agent=musicbrainz_keys.get('user_agent') or os.getenv(
                "MUSICBRAINZ_USER_AGENT",
                "SongNodes/1.0 (contact@songnodes.com)"
            ),
            redis_client=self.redis_client
        )
        logger.info("✓ MusicBrainz client initialized")

        # Discogs - only if token exists
        discogs_token = discogs_keys.get('token') or os.getenv("DISCOGS_TOKEN")
        if discogs_token:
            self.discogs_client = DiscogsClient(
                token=discogs_token,
                redis_client=self.redis_client
            )
            logger.info("✓ Discogs client initialized")
        else:
            logger.warning("⚠ Discogs client NOT initialized - no token (OK if not using Discogs)")

        # Beatport - no credentials needed
        self.beatport_client = BeatportClient(
            redis_client=self.redis_client
        )
        logger.info("✓ Beatport client initialized")

        # Last.fm - only if API key exists
        lastfm_api_key = lastfm_keys.get('api_key') or os.getenv("LASTFM_API_KEY")
        if lastfm_api_key:
            self.lastfm_client = LastFMClient(
                api_key=lastfm_api_key,
                redis_client=self.redis_client
            )
            logger.info("✓ Last.fm client initialized")
        else:
            logger.warning("⚠ Last.fm client NOT initialized - no API key (OK if not using Last.fm)")

        # AcousticBrainz - free, no API key required
        self.acousticbrainz_client = AcousticBrainzClient(
            redis_client=self.redis_client
        )
        logger.info("✓ AcousticBrainz client initialized")

        # GetSongBPM - only if API key exists
        getsongbpm_api_key = getsongbpm_keys.get('api_key') or os.getenv("GETSONGBPM_API_KEY")
        if getsongbpm_api_key:
            self.getsongbpm_client = GetSongBPMClient(
                api_key=getsongbpm_api_key,
                redis_client=self.redis_client
            )
            logger.info("✓ GetSongBPM client initialized")
        else:
            logger.warning("⚠ GetSongBPM client NOT initialized - no API key")

    async def _init_enrichment_pipeline(self):
        """Initialize the enrichment pipeline"""
        self.enrichment_pipeline = MetadataEnrichmentPipeline(
            spotify_client=self.spotify_client,
            musicbrainz_client=self.musicbrainz_client,
            discogs_client=self.discogs_client,
            beatport_client=self.beatport_client,
            lastfm_client=self.lastfm_client,
            acousticbrainz_client=self.acousticbrainz_client,
            getsongbpm_client=self.getsongbpm_client,
            db_session_factory=self.session_factory,
            redis_client=self.redis_client
        )

        logger.info("✓ Enrichment pipeline initialized")

    async def _init_config_loader(self):
        """Initialize configuration loader"""
        self.config_loader = EnrichmentConfigLoader(
            db_session_factory=self.session_factory
        )

        # Load initial configuration
        try:
            await self.config_loader.load_configuration()
            logger.info("✓ Enrichment configuration loaded")
        except Exception as e:
            logger.warning(
                "⚠ Failed to load enrichment configuration - using defaults",
                error=str(e)
            )

        # Initialize config-driven enricher
        api_clients = {
            'spotify': self.spotify_client,
            'musicbrainz': self.musicbrainz_client,
            'discogs': self.discogs_client,
            'beatport': self.beatport_client,
            'lastfm': self.lastfm_client,
            'acousticbrainz': self.acousticbrainz_client,
            'getsongbpm': self.getsongbpm_client
        }

        self.config_driven_enricher = ConfigDrivenEnricher(
            config_loader=self.config_loader,
            api_clients=api_clients
        )
        logger.info("✓ Config-driven enricher initialized")

    async def health_check(self) -> Dict[str, str]:
        """
        Health check for all connections.

        Returns:
            Dictionary with health status of each component
        """
        health_status = {}

        # Database
        try:
            async with self.session_factory() as session:
                await session.execute(text("SELECT 1"))
            health_status['database'] = 'healthy'
        except Exception as e:
            health_status['database'] = f'unhealthy: {str(e)}'

        # Redis
        try:
            await self.redis_client.ping()
            health_status['redis'] = 'healthy'
        except Exception as e:
            health_status['redis'] = f'unhealthy: {str(e)}'

        # HTTP client
        try:
            await self.http_client.get('https://httpbin.org/status/200', timeout=5.0)
            health_status['http_client'] = 'healthy'
        except Exception as e:
            health_status['http_client'] = f'unhealthy: {str(e)}'

        return health_status

    async def close(self):
        """Graceful shutdown of all connections"""
        logger.info("🛑 Closing worker bootstrap connections")

        if self.http_client:
            await self.http_client.aclose()
            logger.info("✓ HTTP client closed")

        if self.redis_client:
            await self.redis_client.close()
            logger.info("✓ Redis connection closed")

        if self.db_engine:
            await self.db_engine.dispose()
            logger.info("✓ Database connection pool closed")

        # Close API key helper
        try:
            from db_api_keys import close_api_key_helper
            await close_api_key_helper()
            logger.info("✓ API key helper closed")
        except Exception as e:
            logger.warning("Failed to close API key helper", error=str(e))

        self._initialized = False
        logger.info("✅ Worker bootstrap shutdown complete")


# Singleton instance for convenience
_bootstrap_instance: Optional[WorkerBootstrap] = None


async def get_bootstrap() -> WorkerBootstrap:
    """
    Get singleton bootstrap instance.
    Creates one if it doesn't exist.

    Returns:
        Initialized WorkerBootstrap instance
    """
    global _bootstrap_instance

    if _bootstrap_instance is None:
        _bootstrap_instance = await WorkerBootstrap.create()

    return _bootstrap_instance


async def close_bootstrap():
    """Close singleton bootstrap instance"""
    global _bootstrap_instance

    if _bootstrap_instance is not None:
        await _bootstrap_instance.close()
        _bootstrap_instance = None
