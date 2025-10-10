"""
API Integration Gateway Service - Unified Implementation
=========================================================

Centralized gateway using common/api_gateway library with:
- Token bucket rate limiting (from common.api_gateway)
- Exponential backoff retries (from common.api_gateway)
- Unified Redis caching (from common.api_gateway)
- Circuit breaker protection (from common.api_gateway)
- Comprehensive Prometheus metrics (from common.api_gateway)

All resilience patterns are now provided by the common/api_gateway library,
eliminating code duplication and ensuring consistent behavior.
"""

import os
import sys
from contextlib import asynccontextmanager
from typing import Optional, Dict, Any

import structlog
from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel, Field
import redis
from prometheus_client import make_asgi_app

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from common.secrets_manager import get_redis_config, get_api_keys
from common.api_gateway import CacheManager, RateLimiter, CircuitBreaker

from adapters import (
    SpotifyAdapter,
    MusicBrainzAdapter,
    LastFMAdapter,
    # BeatportAdapter,      # TODO: Refactor to use unified clients
    # DiscogsAdapter,       # TODO: Refactor to use unified clients
    # AcousticBrainzAdapter # TODO: Refactor to use unified clients
)

logger = structlog.get_logger(__name__)

# Global instances
redis_client: Optional[redis.Redis] = None
cache_manager: Optional[CacheManager] = None
rate_limiter: Optional[RateLimiter] = None
circuit_breakers: Dict[str, CircuitBreaker] = {}
adapters: Dict[str, Any] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize and cleanup resources."""
    global redis_client, cache_manager, rate_limiter, circuit_breakers, adapters

    logger.info("Initializing API Gateway with unified common/api_gateway library")

    # Initialize Redis
    redis_config = get_redis_config()
    redis_client = redis.Redis(
        host=redis_config["host"],
        port=redis_config["port"],
        password=redis_config["password"],
        decode_responses=True
    )

    # Test Redis connection
    redis_client.ping()
    logger.info("✅ Redis connection established")

    # Initialize unified components from common/api_gateway
    cache_manager = CacheManager(redis_client)
    rate_limiter = RateLimiter()

    # Configure provider-specific rate limits
    rate_limiter.configure_provider("spotify", rate=10.0, capacity=10)  # 10 req/sec
    rate_limiter.configure_provider("musicbrainz", rate=1.0, capacity=1)  # 1 req/sec (strict)
    rate_limiter.configure_provider("lastfm", rate=5.0, capacity=5)  # 5 req/sec

    logger.info("✅ Initialized CacheManager and RateLimiter from common.api_gateway")

    # Create circuit breakers for each provider
    circuit_breakers["spotify"] = CircuitBreaker(name="spotify", failure_threshold=5, timeout=60)
    circuit_breakers["musicbrainz"] = CircuitBreaker(name="musicbrainz", failure_threshold=5, timeout=60)
    circuit_breakers["lastfm"] = CircuitBreaker(name="lastfm", failure_threshold=5, timeout=60)
    logger.info("✅ Created circuit breakers for all providers")

    # Load API keys
    api_keys = get_api_keys()

    # Initialize unified adapters with shared components
    # Spotify
    if api_keys.get("spotify_client_id"):
        adapters["spotify"] = SpotifyAdapter(
            client_id=api_keys["spotify_client_id"],
            client_secret=api_keys["spotify_client_secret"],
            cache_manager=cache_manager,
            rate_limiter=rate_limiter,
            circuit_breaker=circuit_breakers["spotify"]
        )
        logger.info("✅ Spotify adapter initialized with unified client")

    # MusicBrainz
    adapters["musicbrainz"] = MusicBrainzAdapter(
        user_agent=os.getenv("MUSICBRAINZ_USER_AGENT", "SongNodes/1.0 (https://songnodes.com)"),
        cache_manager=cache_manager,
        rate_limiter=rate_limiter,
        circuit_breaker=circuit_breakers["musicbrainz"]
    )
    logger.info("✅ MusicBrainz adapter initialized with unified client")

    # Last.fm
    if api_keys.get("lastfm_api_key"):
        adapters["lastfm"] = LastFMAdapter(
            api_key=api_keys["lastfm_api_key"],
            cache_manager=cache_manager,
            rate_limiter=rate_limiter,
            circuit_breaker=circuit_breakers["lastfm"]
        )
        logger.info("✅ Last.fm adapter initialized with unified client")

    logger.info(
        "API Gateway initialized",
        adapters=list(adapters.keys()),
        unified_clients=True,
        implementation="common/api_gateway"
    )

    yield

    # Cleanup
    logger.info("Shutting down API Gateway")

    if redis_client:
        redis_client.close()


# Create FastAPI app
app = FastAPI(
    title="API Integration Gateway",
    description="Centralized gateway for external API interactions",
    version="1.0.0",
    lifespan=lifespan
)

# Mount Prometheus metrics
metrics_app = make_asgi_app()
app.mount("/metrics", metrics_app)


# Request/Response models
class SearchQuery(BaseModel):
    """Search query parameters."""
    artist: str = Field(..., description="Artist name")
    title: str = Field(..., description="Track title")
    limit: int = Field(10, ge=1, le=50, description="Maximum results")


class TrackQuery(BaseModel):
    """Track query parameters."""
    track_id: str = Field(..., description="Track ID")


# Dependency to get adapter
def get_adapter(provider: str):
    """Get adapter for provider."""
    if provider not in adapters:
        raise HTTPException(
            status_code=404,
            detail=f"Provider '{provider}' not found or not configured"
        )
    return adapters[provider]


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    try:
        # Check Redis
        redis_client.ping()

        # Get circuit breaker states from unified clients
        breaker_states = {}
        for provider_name, adapter in adapters.items():
            if hasattr(adapter, 'client') and hasattr(adapter.client, 'circuit_breaker'):
                breaker_states[provider_name] = adapter.client.circuit_breaker.state.name

        return {
            "status": "healthy",
            "redis": "connected",
            "adapters": list(adapters.keys()),
            "circuit_breakers": breaker_states,
            "implementation": "unified_common_api_gateway"
        }
    except Exception as e:
        logger.error("Health check failed", error=str(e))
        raise HTTPException(status_code=503, detail=str(e))


@app.post("/api/{provider}/search")
async def unified_search(
    provider: str,
    query: SearchQuery,
    priority: int = Query(5, ge=1, le=10, description="Request priority")
):
    """
    Unified search endpoint.

    Features:
    - Token bucket rate limiting
    - Automatic retries with exponential backoff
    - Circuit breaker protection
    - Response caching (Redis)
    - Prometheus metrics
    """
    adapter = get_adapter(provider)

    try:
        # Route to appropriate adapter method
        if provider == "spotify":
            results = await adapter.search_track(
                artist=query.artist,
                title=query.title,
                limit=query.limit
            )
        elif provider == "musicbrainz":
            # MusicBrainz uses different search pattern
            results = []
        elif provider == "lastfm":
            results = await adapter.get_track_info(
                artist=query.artist,
                track=query.title
            )
        elif provider == "beatport":
            results = await adapter.search_track(
                artist=query.artist,
                title=query.title
            )
        elif provider == "discogs":
            results = await adapter.search_release(
                artist=query.artist,
                title=query.title
            )
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Search not supported for provider: {provider}"
            )

        return {
            "provider": provider,
            "query": query.dict(),
            "results": results
        }

    except Exception as e:
        logger.error(
            "Search failed",
            provider=provider,
            error=str(e)
        )
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/{provider}/track/{track_id}")
async def get_track(
    provider: str,
    track_id: str
):
    """Get track metadata by ID."""
    adapter = get_adapter(provider)

    try:
        if provider == "spotify":
            result = await adapter.get_track(track_id)
        elif provider == "beatport":
            result = await adapter.get_track(track_id)
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Get track not supported for provider: {provider}"
            )

        return {
            "provider": provider,
            "track_id": track_id,
            "data": result
        }

    except Exception as e:
        logger.error(
            "Get track failed",
            provider=provider,
            track_id=track_id,
            error=str(e)
        )
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/spotify/audio-features/{track_id}")
async def get_spotify_audio_features(track_id: str):
    """Get Spotify audio features."""
    adapter = get_adapter("spotify")

    try:
        result = await adapter.get_audio_features(track_id)
        return {
            "provider": "spotify",
            "track_id": track_id,
            "data": result
        }

    except Exception as e:
        logger.error(
            "Get audio features failed",
            track_id=track_id,
            error=str(e)
        )
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/admin/circuit-breakers")
async def get_circuit_breakers():
    """Get circuit breaker states from unified clients."""
    breaker_states = {}

    for provider_name, adapter in adapters.items():
        if hasattr(adapter, 'client') and hasattr(adapter.client, 'circuit_breaker'):
            breaker = adapter.client.circuit_breaker
            breaker_states[provider_name] = {
                "state": breaker.state.name,
                "failure_count": breaker.failure_count,
                "failure_threshold": breaker.failure_threshold,
                "last_failure_time": breaker.last_failure_time.isoformat() if breaker.last_failure_time else None
            }

    return breaker_states


@app.post("/admin/circuit-breakers/{provider}/reset")
async def reset_circuit_breaker(provider: str):
    """Reset circuit breaker for a provider."""
    if provider not in adapters:
        raise HTTPException(status_code=404, detail=f"Provider not found: {provider}")

    adapter = adapters[provider]
    if hasattr(adapter, 'client') and hasattr(adapter.client, 'circuit_breaker'):
        adapter.client.circuit_breaker.reset()
        return {
            "provider": provider,
            "status": "reset",
            "new_state": adapter.client.circuit_breaker.state.name
        }
    else:
        raise HTTPException(status_code=400, detail=f"Provider {provider} does not have circuit breaker")


@app.get("/admin/cache/stats")
async def get_cache_stats():
    """Get cache statistics from unified clients."""
    stats = {}

    for provider_name, adapter in adapters.items():
        if hasattr(adapter, 'client') and hasattr(adapter.client, 'cache_manager'):
            cache_stats = adapter.client.cache_manager.get_stats()
            stats[provider_name] = cache_stats

    return stats


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=int(os.getenv("PORT", "8100")),
        log_level="info"
    )
