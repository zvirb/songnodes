"""
Redis-based Cache Manager for API Gateway
==========================================

Implements transparent caching layer for external API calls with:
- TTL-based expiration
- Decorator pattern for easy integration
- Key namespacing by provider
- Automatic serialization/deserialization

Architecture Pattern: Cache-Aside
Reference: Blueprint Section "Intelligent Caching for Performance and Cost Optimization"
"""

import redis
import json
import hashlib
import logging
import time
from typing import Optional, Callable, Any
from functools import wraps
from prometheus_client import Counter, Histogram

logger = logging.getLogger(__name__)

# Prometheus Metrics - Module-level definitions
api_gateway_cache_hits_total = Counter(
    'api_gateway_cache_hits_total',
    'Total number of cache hits',
    ['provider']
)

api_gateway_cache_misses_total = Counter(
    'api_gateway_cache_misses_total',
    'Total number of cache misses',
    ['provider']
)

api_gateway_cache_operation_seconds = Histogram(
    'api_gateway_cache_operation_seconds',
    'Cache operation duration in seconds',
    ['provider', 'operation'],
    buckets=(0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0)
)


class CacheManager:
    """
    Redis-based cache manager with decorator support.

    Usage:
        cache = CacheManager(redis_client, default_ttl=604800)  # 7 days

        @cache.cached(key_prefix="spotify:track", ttl=86400)
        def fetch_spotify_track(artist: str, title: str):
            return api_call(artist, title)
    """

    def __init__(self, redis_client: redis.Redis, default_ttl: int = 604800):
        """
        Initialize cache manager.

        Args:
            redis_client: Connected Redis client instance
            default_ttl: Default TTL in seconds (default: 7 days)
        """
        self.redis = redis_client
        self.default_ttl = default_ttl
        self.stats = {
            'hits': 0,
            'misses': 0,
            'errors': 0
        }

    def get_hit_ratio(self) -> float:
        """Calculate cache hit ratio for monitoring."""
        total = self.stats['hits'] + self.stats['misses']
        return self.stats['hits'] / total if total > 0 else 0.0

    def cached(self, key_prefix: str, ttl: Optional[int] = None, hash_key: bool = True):
        """
        Decorator to cache function results in Redis.

        Args:
            key_prefix: Namespace prefix for cache keys (e.g., "spotify:track")
            ttl: Time-to-live in seconds (None = use default)
            hash_key: If True, hash the key to handle long strings

        Example:
            @cache.cached(key_prefix="spotify:track", ttl=86400)
            def search_spotify(artist: str, title: str) -> dict:
                return spotify_api.search(artist, title)
        """
        def decorator(func: Callable) -> Callable:
            @wraps(func)
            def wrapper(*args, **kwargs) -> Any:
                # Generate cache key from function args
                # Skip first arg if it's 'self' (instance method)
                cache_args = args[1:] if args and hasattr(args[0], func.__name__) else args

                # Create key from args and kwargs
                key_parts = [str(arg) for arg in cache_args]
                key_parts.extend(f"{k}={v}" for k, v in sorted(kwargs.items()))
                key_suffix = ":".join(key_parts)

                # Hash key if requested (useful for very long keys)
                if hash_key and len(key_suffix) > 200:
                    key_suffix = hashlib.sha256(key_suffix.encode()).hexdigest()

                cache_key = f"{key_prefix}:{key_suffix}"

                # Extract provider from cache key (format: "provider:...")
                provider = key_prefix.split(':')[0] if ':' in key_prefix else 'unknown'

                # Try cache first
                try:
                    start_time = time.time()
                    cached_result = self.redis.get(cache_key)
                    duration = time.time() - start_time

                    api_gateway_cache_operation_seconds.labels(
                        provider=provider,
                        operation='get'
                    ).observe(duration)

                    if cached_result:
                        self.stats['hits'] += 1
                        api_gateway_cache_hits_total.labels(provider=provider).inc()
                        logger.debug(f"Cache HIT: {cache_key}")
                        return json.loads(cached_result)
                except Exception as e:
                    logger.warning(f"Cache read error for {cache_key}: {e}")
                    self.stats['errors'] += 1

                # Cache miss - call function
                self.stats['misses'] += 1
                api_gateway_cache_misses_total.labels(provider=provider).inc()
                logger.debug(f"Cache MISS: {cache_key}")

                result = func(*args, **kwargs)

                # Store result if not None
                if result is not None:
                    try:
                        start_time = time.time()
                        self.redis.setex(
                            cache_key,
                            ttl or self.default_ttl,
                            json.dumps(result)
                        )
                        duration = time.time() - start_time

                        api_gateway_cache_operation_seconds.labels(
                            provider=provider,
                            operation='set'
                        ).observe(duration)

                        logger.debug(f"Cache WRITE: {cache_key} (TTL: {ttl or self.default_ttl}s)")
                    except Exception as e:
                        logger.warning(f"Cache write error for {cache_key}: {e}")
                        self.stats['errors'] += 1

                return result

            return wrapper
        return decorator

    def invalidate(self, key_prefix: str, *args, **kwargs):
        """
        Manually invalidate a cache entry.

        Args:
            key_prefix: Same prefix used in @cached decorator
            *args, **kwargs: Same arguments passed to cached function
        """
        key_parts = [str(arg) for arg in args]
        key_parts.extend(f"{k}={v}" for k, v in sorted(kwargs.items()))
        key_suffix = ":".join(key_parts)

        cache_key = f"{key_prefix}:{key_suffix}"

        try:
            deleted = self.redis.delete(cache_key)
            if deleted:
                logger.info(f"Cache invalidated: {cache_key}")
            return bool(deleted)
        except Exception as e:
            logger.error(f"Cache invalidation error for {cache_key}: {e}")
            return False

    def invalidate_pattern(self, pattern: str):
        """
        Invalidate all keys matching a pattern.

        Args:
            pattern: Redis key pattern (e.g., "spotify:*")

        Warning: Use with caution - can be expensive on large keyspaces
        """
        try:
            keys = self.redis.keys(pattern)
            if keys:
                deleted = self.redis.delete(*keys)
                logger.info(f"Invalidated {deleted} keys matching pattern: {pattern}")
                return deleted
            return 0
        except Exception as e:
            logger.error(f"Pattern invalidation error for {pattern}: {e}")
            return 0

    def get_stats(self) -> dict:
        """Get cache statistics for monitoring."""
        return {
            'hits': self.stats['hits'],
            'misses': self.stats['misses'],
            'errors': self.stats['errors'],
            'hit_ratio': self.get_hit_ratio()
        }
