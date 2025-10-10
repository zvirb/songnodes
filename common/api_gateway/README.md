# API Integration Gateway

Centralized gateway for external API communication with comprehensive resilience patterns.

## Architecture

This module implements the **API Integration Gateway** pattern from the architectural blueprint, providing a unified interface for external API providers (Spotify, MusicBrainz, Last.fm) with built-in:

- ✅ **Redis Caching** - Transparent caching with configurable TTL
- ✅ **Token Bucket Rate Limiting** - Proactive quota management
- ✅ **Circuit Breaker** - Fail-fast protection against cascading failures
- ✅ **Retry with Exponential Backoff** - Automatic recovery from transient errors
- ✅ **Connection Pooling** - HTTP session reuse for performance
- ✅ **Comprehensive Logging** - Structured logs with provider context

## Components

```
common/api_gateway/
├── __init__.py                    # Module exports
├── cache_manager.py               # Redis caching layer
├── rate_limiter.py                # Token bucket rate limiter
├── circuit_breaker.py             # Circuit breaker pattern
├── base_client.py                 # Abstract base with resilience stack
├── spotify_client.py              # Spotify API implementation
├── musicbrainz_client.py          # MusicBrainz API implementation
├── lastfm_client.py               # Last.fm API implementation
└── README.md                      # This file
```

## Quick Start

### 1. Initialize Core Components

```python
import redis
from common.api_gateway import (
    CacheManager,
    RateLimiter,
    CircuitBreakerRegistry,
    SpotifyClient,
    MusicBrainzClient,
    LastFmClient
)
import requests

# Connect to Redis
redis_client = redis.Redis(
    host='redis',
    port=6379,
    password='your_password',
    decode_responses=True
)

# Create cache manager
cache = CacheManager(redis_client, default_ttl=604800)  # 7 days

# Create rate limiter
limiter = RateLimiter()
limiter.configure_provider('spotify', rate=10.0, capacity=10)      # 10 req/sec
limiter.configure_provider('musicbrainz', rate=1.0, capacity=1)    # 1 req/sec (API requirement)
limiter.configure_provider('lastfm', rate=5.0, capacity=5)         # 5 req/sec

# Create circuit breakers
breaker_registry = CircuitBreakerRegistry()
spotify_breaker = breaker_registry.register(
    'spotify',
    failure_threshold=5,
    timeout=60,
    expected_exception=requests.RequestException
)
musicbrainz_breaker = breaker_registry.register(
    'musicbrainz',
    failure_threshold=3,
    timeout=30,
    expected_exception=requests.RequestException
)
lastfm_breaker = breaker_registry.register(
    'lastfm',
    failure_threshold=5,
    timeout=60,
    expected_exception=requests.RequestException
)
```

### 2. Create API Clients

```python
# Spotify client
spotify = SpotifyClient(
    client_id='your_spotify_client_id',
    client_secret='your_spotify_client_secret',
    cache_manager=cache,
    rate_limiter=limiter,
    circuit_breaker=spotify_breaker
)

# MusicBrainz client
musicbrainz = MusicBrainzClient(
    user_agent='YourApp/1.0 (contact@example.com)',
    cache_manager=cache,
    rate_limiter=limiter,
    circuit_breaker=musicbrainz_breaker
)

# Last.fm client
lastfm = LastFmClient(
    api_key='your_lastfm_api_key',
    cache_manager=cache,
    rate_limiter=limiter,
    circuit_breaker=lastfm_breaker
)
```

### 3. Use the Clients

```python
# Search Spotify
track = spotify.search_track(artist="Deadmau5", title="Strobe")
if track:
    print(f"Found: {track['name']} by {track['artists'][0]['name']}")

# Lookup by ISRC in MusicBrainz
recording = musicbrainz.lookup_isrc(isrc="USIR20400500")
if recording:
    print(f"MusicBrainz: {recording['title']} (MBID: {recording['id']})")

# Get genre tags from Last.fm
tags = lastfm.get_track_tags(artist="Deadmau5", track="Strobe")
print(f"Genres: {', '.join(tags[:5])}")
```

## Resilience Patterns

### Caching

All responses are automatically cached in Redis with configurable TTL:

```python
# Default cache behavior
track = spotify.search_track("Deadmau5", "Strobe")  # Cache miss, API call made
track = spotify.search_track("Deadmau5", "Strobe")  # Cache hit, instant return

# Disable cache for specific call
track = spotify.search_track("Deadmau5", "Strobe", use_cache=False)

# Manual cache invalidation
cache.invalidate(key_prefix="spotify:track", "Deadmau5", "Strobe")
```

**Cache Keys:**
- Spotify Search: `spotify:search:{artist}:{title}`
- Spotify Track: `spotify:track:{spotify_id}`
- MusicBrainz ISRC: `musicbrainz:isrc:{isrc}`
- Last.fm Tags: `lastfm:track_tags:{artist}:{track}`

### Rate Limiting

Token bucket algorithm prevents hitting API quotas:

```python
# Automatic rate limiting (blocks until token available)
limiter.acquire('spotify')  # Waits if bucket empty
response = spotify_api.call()

# Adaptive throttling based on response headers
limiter.adjust_from_headers('spotify', response.headers)

# Get statistics
stats = limiter.get_stats()
print(stats['spotify'])  # {'rate': 10.0, 'capacity': 10, 'available_tokens': 7.5}
```

### Circuit Breaker

Prevents cascading failures during API outages:

```python
from common.api_gateway import CircuitBreakerOpenError

try:
    track = spotify.search_track("Artist", "Title")
except CircuitBreakerOpenError as e:
    print(f"Spotify API down: {e}")
    # Fallback to MusicBrainz
    recording = musicbrainz.search_recording("Artist", "Title")
```

**States:**
- **CLOSED** (Normal): Requests pass through
- **OPEN** (Failing): Requests fail immediately for 60s
- **HALF_OPEN** (Testing): Allows probe requests to check recovery

## Integration with Existing Pipeline

### Option 1: Refactor Existing Pipeline (Recommended)

Update `APIEnrichmentPipeline` to use the gateway clients:

```python
# In api_enrichment_pipeline.py
from common.api_gateway import (
    CacheManager, RateLimiter, CircuitBreakerRegistry,
    SpotifyClient, MusicBrainzClient, LastFmClient
)

class APIEnrichmentPipeline:
    def __init__(self, ...):
        # Initialize gateway components
        self._init_gateway()

    def _init_gateway(self):
        # Setup Redis cache
        self.cache = CacheManager(self.redis_client)

        # Setup rate limiter
        self.limiter = RateLimiter()
        self.limiter.configure_provider('spotify', rate=10.0, capacity=10)
        self.limiter.configure_provider('musicbrainz', rate=1.0, capacity=1)

        # Setup circuit breakers
        breakers = CircuitBreakerRegistry()
        spotify_breaker = breakers.register('spotify', failure_threshold=5)

        # Create clients
        self.spotify_client = SpotifyClient(
            client_id=self.spotify_client_id,
            client_secret=self.spotify_client_secret,
            cache_manager=self.cache,
            rate_limiter=self.limiter,
            circuit_breaker=spotify_breaker
        )

    def _search_spotify(self, artist: str, title: str):
        # Replace raw requests with gateway client
        return self.spotify_client.search_track(artist, title)
```

### Option 2: Standalone Microservices (Future)

Extract into independent services:

```yaml
# docker-compose.yml
services:
  enrichment-spotify:
    build: ./services/enrichment-spotify
    environment:
      SPOTIFY_CLIENT_ID: ${SPOTIFY_CLIENT_ID}
      REDIS_HOST: redis
    depends_on:
      - redis
      - rabbitmq
```

## Monitoring

### Get Statistics

```python
# Client stats
spotify_stats = spotify.get_stats()
print(f"Cache hit ratio: {spotify_stats['cache_hit_ratio']:.2%}")
print(f"Circuit breaker state: {spotify_stats['circuit_breaker']['state']}")

# Rate limiter stats
limiter_stats = limiter.get_stats()
print(f"Spotify tokens available: {limiter_stats['spotify']['available_tokens']}")

# Cache stats
cache_stats = cache.get_stats()
print(f"Total hits: {cache_stats['hits']}, misses: {cache_stats['misses']}")
```

### Prometheus Metrics (Future)

Export metrics for Grafana dashboards:

```python
# api_calls_total{provider="spotify",status="success"} 1245
# api_calls_total{provider="spotify",status="failed"} 3
# circuit_breaker_state{provider="spotify"} 0  # 0=closed, 1=open, 2=half_open
# cache_hit_ratio{provider="spotify"} 0.87
# rate_limit_tokens_available{provider="spotify"} 7.5
```

## Configuration

### Rate Limits by Provider

| Provider | Rate Limit | Capacity | Notes |
|----------|-----------|----------|-------|
| **Spotify** | 10 req/sec | 10 | Generous limit, supports burst |
| **MusicBrainz** | 1 req/sec | 1 | API requirement |
| **Last.fm** | 5 req/sec | 5 | Unofficial limit |

### Cache TTLs

| Data Type | TTL | Reason |
|-----------|-----|--------|
| Spotify Track | 30 days | Metadata rarely changes |
| Spotify Search | 7 days | Search results can vary |
| MusicBrainz ISRC | 30 days | ISRCs are permanent |
| Last.fm Tags | 7 days | Community tags evolve |

### Circuit Breaker Thresholds

| Provider | Failure Threshold | Timeout | Success Threshold |
|----------|------------------|---------|-------------------|
| **Spotify** | 5 failures | 60s | 2 successes |
| **MusicBrainz** | 3 failures | 30s | 2 successes |
| **Last.fm** | 5 failures | 60s | 2 successes |

## Best Practices

1. **Always use caching** - Set `use_cache=False` only for debugging
2. **Configure rate limiters before client creation** - Prevents startup failures
3. **Handle CircuitBreakerOpenError** - Implement fallback logic
4. **Monitor statistics** - Export to Prometheus for alerting
5. **Use structured logging** - Include correlation IDs for request tracing

## Testing

```python
import pytest
from common.api_gateway import SpotifyClient

def test_spotify_search_with_caching(cache, limiter, breaker):
    client = SpotifyClient(
        client_id='test_id',
        client_secret='test_secret',
        cache_manager=cache,
        rate_limiter=limiter,
        circuit_breaker=breaker
    )

    # First call - cache miss
    track1 = client.search_track("Deadmau5", "Strobe")
    assert track1 is not None

    # Second call - cache hit
    track2 = client.search_track("Deadmau5", "Strobe")
    assert track1 == track2

    # Verify cache hit
    stats = client.get_stats()
    assert stats['cache_hits'] == 1
```

## Troubleshooting

### Circuit Breaker Stuck Open

```python
# Check breaker state
print(spotify_breaker.get_stats())

# Manual reset (use with caution)
spotify_breaker.reset()
```

### Rate Limit Exceeded

```python
# Check available tokens
print(limiter.get_stats()['spotify']['available_tokens'])

# Adjust rate (temporary)
limiter.buckets['spotify'].adjust_rate(new_rate=5.0)  # Reduce to 5 req/sec
```

### Cache Not Working

```python
# Test Redis connection
redis_client.ping()  # Should return True

# Check cache stats
print(cache.get_stats())

# Clear cache for debugging
cache.invalidate_pattern("spotify:*")
```

## License

Part of the SongNodes project. See main README for details.
