"""
Unified Caching Layer for API Gateway
======================================

Smart caching with different TTLs per data type:
- Spotify track metadata: 30 days
- Spotify search results: 7 days
- MusicBrainz ISRC: 90 days (stable)
- Beatport BPM: 60 days
- Last.fm genre: 14 days

Features:
- Redis-based caching
- Automatic cache invalidation
- Cache hit/miss metrics
- Graceful degradation
"""

import hashlib
import json
from typing import Any, Optional, Dict
import structlog
import redis.asyncio as redis
from prometheus_client import Counter, Histogram

logger = structlog.get_logger(__name__)

# Prometheus metrics
cache_hits = Counter(
    'api_gateway_cache_hits_total',
    'Total cache hits',
    ['provider', 'data_type']
)
cache_misses = Counter(
    'api_gateway_cache_misses_total',
    'Total cache misses',
    ['provider', 'data_type']
)
cache_errors = Counter(
    'api_gateway_cache_errors_total',
    'Total cache errors',
    ['provider', 'operation']
)
cache_operation_duration = Histogram(
    'api_gateway_cache_operation_seconds',
    'Cache operation duration',
    ['provider', 'operation']
)


class CacheManager:
    """
    Smart caching layer with different TTLs per data type.

    Cache key format: api_gateway:{provider}:{data_type}:{key_hash}
    """

    # Cache TTL policies (in seconds)
    CACHE_POLICIES = {
        'spotify_track_metadata': 30 * 24 * 3600,  # 30 days
        'spotify_search_results': 7 * 24 * 3600,   # 7 days
        'spotify_audio_features': 90 * 24 * 3600,  # 90 days (stable)
        'musicbrainz_isrc': 90 * 24 * 3600,        # 90 days (stable)
        'musicbrainz_artist': 60 * 24 * 3600,      # 60 days
        'beatport_bpm': 60 * 24 * 3600,            # 60 days
        'beatport_track': 30 * 24 * 3600,          # 30 days
        'lastfm_genre': 14 * 24 * 3600,            # 14 days
        'lastfm_artist': 14 * 24 * 3600,           # 14 days
        'discogs_release': 60 * 24 * 3600,         # 60 days
        'discogs_master': 90 * 24 * 3600,          # 90 days (stable)
        'acousticbrainz_features': 90 * 24 * 3600, # 90 days (stable)
        'default': 7 * 24 * 3600,                  # 7 days default
    }

    def __init__(self, redis_client: redis.Redis):
        """
        Initialize cache manager.

        Args:
            redis_client: Async Redis client instance
        """
        self.redis = redis_client

    def _generate_cache_key(
        self,
        provider: str,
        data_type: str,
        params: Dict[str, Any]
    ) -> str:
        """
        Generate a cache key from request parameters.

        Args:
            provider: API provider name
            data_type: Type of data being cached
            params: Request parameters

        Returns:
            Cache key string
        """
        # Sort params for consistent hashing
        param_str = json.dumps(params, sort_keys=True)
        param_hash = hashlib.sha256(param_str.encode()).hexdigest()[:16]

        return f"api_gateway:{provider}:{data_type}:{param_hash}"

    def _get_ttl(self, provider: str, data_type: str) -> int:
        """
        Get TTL for cache entry.

        Args:
            provider: API provider name
            data_type: Type of data being cached

        Returns:
            TTL in seconds
        """
        # Try provider-specific cache policy
        cache_key = f"{provider}_{data_type}"
        ttl = self.CACHE_POLICIES.get(cache_key)

        if ttl is None:
            # Fall back to generic data type
            ttl = self.CACHE_POLICIES.get(data_type)

        if ttl is None:
            # Fall back to default
            ttl = self.CACHE_POLICIES['default']

        return ttl

    async def get(
        self,
        provider: str,
        data_type: str,
        params: Dict[str, Any]
    ) -> Optional[Any]:
        """
        Get value from cache.

        Args:
            provider: API provider name
            data_type: Type of data being cached
            params: Request parameters

        Returns:
            Cached value or None if not found
        """
        cache_key = self._generate_cache_key(provider, data_type, params)

        try:
            import time
            start_time = time.monotonic()

            # Get from Redis
            value = await self.redis.get(cache_key)

            duration = time.monotonic() - start_time
            cache_operation_duration.labels(
                provider=provider,
                operation='get'
            ).observe(duration)

            if value is not None:
                # Cache hit
                cache_hits.labels(
                    provider=provider,
                    data_type=data_type
                ).inc()

                logger.debug(
                    "Cache hit",
                    provider=provider,
                    data_type=data_type,
                    key=cache_key
                )

                # Deserialize
                return json.loads(value)
            else:
                # Cache miss
                cache_misses.labels(
                    provider=provider,
                    data_type=data_type
                ).inc()

                logger.debug(
                    "Cache miss",
                    provider=provider,
                    data_type=data_type,
                    key=cache_key
                )

                return None

        except Exception as e:
            cache_errors.labels(
                provider=provider,
                operation='get'
            ).inc()

            logger.error(
                "Cache get error",
                provider=provider,
                data_type=data_type,
                error=str(e)
            )
            # Return None on error (graceful degradation)
            return None

    async def set(
        self,
        provider: str,
        data_type: str,
        params: Dict[str, Any],
        value: Any,
        ttl_override: Optional[int] = None
    ) -> bool:
        """
        Set value in cache.

        Args:
            provider: API provider name
            data_type: Type of data being cached
            params: Request parameters
            value: Value to cache
            ttl_override: Optional TTL override in seconds

        Returns:
            True if successful, False otherwise
        """
        cache_key = self._generate_cache_key(provider, data_type, params)

        try:
            import time
            start_time = time.monotonic()

            # Determine TTL
            ttl = ttl_override or self._get_ttl(provider, data_type)

            # Serialize value
            serialized = json.dumps(value)

            # Store in Redis with TTL
            await self.redis.setex(cache_key, ttl, serialized)

            duration = time.monotonic() - start_time
            cache_operation_duration.labels(
                provider=provider,
                operation='set'
            ).observe(duration)

            logger.debug(
                "Cache set",
                provider=provider,
                data_type=data_type,
                key=cache_key,
                ttl=ttl
            )

            return True

        except Exception as e:
            cache_errors.labels(
                provider=provider,
                operation='set'
            ).inc()

            logger.error(
                "Cache set error",
                provider=provider,
                data_type=data_type,
                error=str(e)
            )
            return False

    async def invalidate(
        self,
        provider: str,
        data_type: str,
        params: Dict[str, Any]
    ) -> bool:
        """
        Invalidate a cache entry.

        Args:
            provider: API provider name
            data_type: Type of data being cached
            params: Request parameters

        Returns:
            True if successful, False otherwise
        """
        cache_key = self._generate_cache_key(provider, data_type, params)

        try:
            import time
            start_time = time.monotonic()

            # Delete from Redis
            result = await self.redis.delete(cache_key)

            duration = time.monotonic() - start_time
            cache_operation_duration.labels(
                provider=provider,
                operation='invalidate'
            ).observe(duration)

            logger.info(
                "Cache invalidated",
                provider=provider,
                data_type=data_type,
                key=cache_key,
                existed=result > 0
            )

            return result > 0

        except Exception as e:
            cache_errors.labels(
                provider=provider,
                operation='invalidate'
            ).inc()

            logger.error(
                "Cache invalidate error",
                provider=provider,
                data_type=data_type,
                error=str(e)
            )
            return False

    async def invalidate_pattern(
        self,
        provider: Optional[str] = None,
        data_type: Optional[str] = None
    ) -> int:
        """
        Invalidate cache entries matching a pattern.

        Args:
            provider: Optional provider filter
            data_type: Optional data type filter

        Returns:
            Number of keys deleted
        """
        # Build pattern
        parts = ['api_gateway']

        if provider:
            parts.append(provider)
        else:
            parts.append('*')

        if data_type:
            parts.append(data_type)
        else:
            parts.append('*')

        parts.append('*')

        pattern = ':'.join(parts)

        try:
            import time
            start_time = time.monotonic()

            # Scan for matching keys
            keys = []
            async for key in self.redis.scan_iter(match=pattern):
                keys.append(key)

            # Delete keys
            deleted = 0
            if keys:
                deleted = await self.redis.delete(*keys)

            duration = time.monotonic() - start_time
            cache_operation_duration.labels(
                provider=provider or 'all',
                operation='invalidate_pattern'
            ).observe(duration)

            logger.info(
                "Cache pattern invalidated",
                provider=provider,
                data_type=data_type,
                pattern=pattern,
                deleted=deleted
            )

            return deleted

        except Exception as e:
            cache_errors.labels(
                provider=provider or 'all',
                operation='invalidate_pattern'
            ).inc()

            logger.error(
                "Cache pattern invalidate error",
                provider=provider,
                data_type=data_type,
                error=str(e)
            )
            return 0

    async def get_stats(self) -> Dict[str, Any]:
        """
        Get cache statistics.

        Returns:
            Dictionary with cache stats
        """
        try:
            info = await self.redis.info('stats')

            return {
                'keyspace_hits': info.get('keyspace_hits', 0),
                'keyspace_misses': info.get('keyspace_misses', 0),
                'expired_keys': info.get('expired_keys', 0),
                'evicted_keys': info.get('evicted_keys', 0)
            }

        except Exception as e:
            logger.error("Error getting cache stats", error=str(e))
            return {}
