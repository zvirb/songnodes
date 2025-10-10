"""
MusicBrainz API Adapter - Unified Implementation
================================================

Thin wrapper around common/api_gateway.MusicBrainzClient.
All resilience patterns, rate limiting (1 req/sec), and caching are handled by the common client.
"""

import sys
import os
from typing import Dict, List, Optional, Any
import structlog

# Add parent directory for common imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from common.api_gateway import MusicBrainzClient

logger = structlog.get_logger(__name__)


class MusicBrainzAdapter:
    """
    MusicBrainz API adapter using unified common/api_gateway.MusicBrainzClient.

    Features (inherited from MusicBrainzClient):
    - 1 request/second rate limiting (MusicBrainz requirement)
    - Circuit breaker protection
    - Redis caching with configurable TTLs
    - Exponential backoff retries
    - ISRC and artist/title lookups
    - Comprehensive Prometheus metrics
    """

    provider_name = "musicbrainz"

    def __init__(
        self,
        user_agent: str,
        redis_client,
        **kwargs
    ):
        """
        Initialize MusicBrainz adapter.

        Args:
            user_agent: User agent string for MusicBrainz API
            redis_client: Redis client for caching
        """
        self.client = MusicBrainzClient(
            user_agent=user_agent,
            redis_client=redis_client
        )
        logger.info("MusicBrainz adapter initialized with unified client")

    async def search_by_isrc(
        self,
        isrc: str
    ) -> Optional[Dict[str, Any]]:
        """
        Search for recording by ISRC.

        Args:
            isrc: International Standard Recording Code

        Returns:
            Recording metadata or None
        """
        return await self.client.search_by_isrc(
            isrc=isrc,
            use_cache=True
        )

    async def search_recording(
        self,
        artist: str,
        title: str
    ) -> Optional[Dict[str, Any]]:
        """
        Search for recording by artist and title.

        Args:
            artist: Artist name
            title: Track title

        Returns:
            Recording metadata or None
        """
        return await self.client.search_recording(
            artist=artist,
            title=title,
            use_cache=True
        )
