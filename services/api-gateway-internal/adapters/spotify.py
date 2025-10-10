"""
Spotify API Adapter - Unified Implementation
============================================

Thin wrapper around common/api_gateway.SpotifyClient.
All resilience patterns, OAuth, caching, and metrics are handled by the common client.
"""

import sys
import os
import asyncio
from typing import Dict, List, Optional, Any
import structlog

# Add parent directory for common imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from common.api_gateway import SpotifyClient

logger = structlog.get_logger(__name__)


class SpotifyAdapter:
    """
    Spotify API adapter using unified common/api_gateway.SpotifyClient.

    Features (inherited from SpotifyClient):
    - OAuth 2.0 with automatic token refresh
    - Circuit breaker protection
    - Token bucket rate limiting
    - Redis caching with configurable TTLs
    - Exponential backoff retries
    - Comprehensive Prometheus metrics
    """

    provider_name = "spotify"

    def __init__(
        self,
        client_id: str,
        client_secret: str,
        cache_manager,
        rate_limiter,
        circuit_breaker,
        **kwargs
    ):
        """
        Initialize Spotify adapter.

        Args:
            client_id: Spotify client ID
            client_secret: Spotify client secret
            cache_manager: CacheManager from common.api_gateway
            rate_limiter: RateLimiter from common.api_gateway
            circuit_breaker: CircuitBreaker from common.api_gateway
        """
        self.client = SpotifyClient(
            client_id=client_id,
            client_secret=client_secret,
            cache_manager=cache_manager,
            rate_limiter=rate_limiter,
            circuit_breaker=circuit_breaker
        )
        logger.info("Spotify adapter initialized with unified client")

    async def search_track(
        self,
        artist: str,
        title: str,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """
        Search for tracks.

        Args:
            artist: Artist name
            title: Track title
            limit: Maximum results

        Returns:
            List of track objects
        """
        # Run synchronous client method in thread pool
        result = await asyncio.to_thread(
            self.client.search_track,
            artist=artist,
            title=title,
            use_cache=True
        )

        # Convert single result to list format expected by FastAPI endpoint
        if result:
            return [result]
        return []

    async def get_track(self, track_id: str) -> Dict[str, Any]:
        """
        Get track metadata by Spotify ID.

        Args:
            track_id: Spotify track ID

        Returns:
            Track metadata
        """
        # Run synchronous client method in thread pool
        return await asyncio.to_thread(
            self.client.get_track,
            spotify_id=track_id,
            use_cache=True
        )

    async def get_audio_features(self, track_id: str) -> Dict[str, Any]:
        """
        Get audio features for a track.

        Args:
            track_id: Spotify track ID

        Returns:
            Audio features (tempo, key, energy, etc.)
        """
        # Run synchronous client method in thread pool
        return await asyncio.to_thread(
            self.client.get_audio_features,
            spotify_id=track_id,
            use_cache=True
        )

    async def get_artist(self, artist_id: str) -> Dict[str, Any]:
        """
        Get artist metadata.

        Args:
            artist_id: Spotify artist ID

        Returns:
            Artist metadata
        """
        # Note: get_artist not yet implemented in common client
        # This would need to be added to common/api_gateway/spotify_client.py
        logger.warning("get_artist not yet implemented in unified client")
        return {}
