"""
Last.fm API Adapter - Unified Implementation
============================================

Thin wrapper around common/api_gateway.LastFmClient.
All resilience patterns, rate limiting, and caching are handled by the common client.
"""

import sys
import os
from typing import Dict, List, Optional, Any
import structlog

# Add parent directory for common imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from common.api_gateway import LastFmClient

logger = structlog.get_logger(__name__)


class LastFMAdapter:
    """
    Last.fm API adapter using unified common/api_gateway.LastFmClient.

    Features (inherited from LastFmClient):
    - API key authentication
    - Circuit breaker protection
    - Token bucket rate limiting
    - Redis caching with configurable TTLs
    - Exponential backoff retries
    - Track info, genre tags, and popularity data
    - Comprehensive Prometheus metrics
    """

    provider_name = "lastfm"

    def __init__(
        self,
        api_key: str,
        redis_client,
        **kwargs
    ):
        """
        Initialize Last.fm adapter.

        Args:
            api_key: Last.fm API key
            redis_client: Redis client for caching
        """
        self.client = LastFmClient(
            api_key=api_key,
            redis_client=redis_client
        )
        logger.info("Last.fm adapter initialized with unified client")

    async def get_track_info(
        self,
        artist: str,
        track: str
    ) -> Optional[Dict[str, Any]]:
        """
        Get track information including tags and popularity.

        Args:
            artist: Artist name
            track: Track title

        Returns:
            Track metadata including tags, playcount, listeners
        """
        return await self.client.get_track_info(
            artist=artist,
            track=track,
            use_cache=True
        )

    async def get_artist_info(
        self,
        artist: str
    ) -> Optional[Dict[str, Any]]:
        """
        Get artist information.

        Args:
            artist: Artist name

        Returns:
            Artist metadata including tags, bio, stats
        """
        # Note: get_artist_info not yet implemented in common client
        # This would need to be added to common/api_gateway/lastfm_client.py
        logger.warning("get_artist_info not yet implemented in unified client")
        return {}
