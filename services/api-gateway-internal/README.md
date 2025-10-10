# API Integration Gateway

## Overview

The API Integration Gateway is a centralized service for managing all external API interactions in the SongNodes enrichment pipeline. It provides a unified interface with intelligent rate limiting, caching, retries, and circuit breaker protection.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     API Gateway Internal                         │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ Rate Limiter │  │    Cache     │  │    Circuit   │         │
│  │ (Token       │  │  (Redis)     │  │    Breaker   │         │
│  │  Bucket)     │  │              │  │              │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐                           │
│  │  Exponential │  │  Prometheus  │                           │
│  │    Backoff   │  │   Metrics    │                           │
│  └──────────────┘  └──────────────┘                           │
└─────────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
   ┌─────────┐        ┌──────────┐       ┌──────────┐
   │ Spotify │        │MusicBrainz│       │ Last.fm  │
   └─────────┘        └──────────┘       └──────────┘
   ┌─────────┐        ┌──────────┐       ┌──────────┐
   │Beatport │        │ Discogs  │       │AcousticBr│
   └─────────┘        └──────────┘       └──────────┘
```

## Features

### 1. Token Bucket Rate Limiting

- **Per-provider rate limits** configured to match API specifications
- **Burst capacity** for handling traffic spikes
- **Dynamic adjustment** based on API response headers (X-RateLimit-*)
- **Request queuing** when rate limit exceeded
- **Prometheus metrics** for monitoring

**Rate Limits:**
- Spotify: 10 req/sec, burst 20
- MusicBrainz: 1 req/sec (per guidelines)
- Last.fm: 5 req/sec
- Beatport: 2 req/sec
- Discogs: 1 req/sec
- AcousticBrainz: 5 req/sec

### 2. Exponential Backoff Retry

- **Initial delay**: 1 second
- **Max delay**: 60 seconds
- **Jitter**: ±20% to prevent thundering herd
- **Respects Retry-After headers**
- **Smart retry logic**:
  - Retries: 429, 500, 502, 503, 504, timeouts
  - Does NOT retry: 400, 401, 403, 404

### 3. Unified Caching Layer

**Cache TTL Policies:**
- Spotify track metadata: 30 days
- Spotify search results: 7 days
- Spotify audio features: 90 days (stable)
- MusicBrainz ISRC: 90 days (stable)
- Beatport BPM: 60 days
- Last.fm genres: 14 days
- Discogs releases: 60 days
- AcousticBrainz features: 90 days (stable)

**Features:**
- Redis-based caching
- Automatic cache invalidation
- Cache hit/miss metrics
- Sub-second response times for cached data

### 4. Circuit Breaker Protection

- **Failure threshold**: 5 failures → circuit opens
- **Timeout**: 60 seconds before attempting reset
- **Half-open testing**: 2 successes required to close
- **Prometheus metrics** for circuit breaker state
- **Admin endpoints** for manual reset

### 5. Comprehensive Monitoring

- **Prometheus metrics export** on `/metrics`
- **Grafana dashboard** for visualization
- **Health check endpoint** on `/health`
- **Admin endpoints** for operational management

## Usage Examples

### Basic Search Request

```bash
# Search for a track on Spotify
curl -X POST http://localhost:8100/api/spotify/search \
  -H "Content-Type: application/json" \
  -d '{
    "artist": "Deadmau5",
    "title": "Strobe",
    "limit": 10
  }'
```

### Get Track Metadata

```bash
# Get Spotify track by ID
curl http://localhost:8100/api/spotify/track/5KH0qbmre8xkRt5sNIbPrx
```

### Get Audio Features

```bash
# Get Spotify audio features (tempo, key, energy, etc.)
curl http://localhost:8100/api/spotify/audio-features/5KH0qbmre8xkRt5sNIbPrx
```

### Health Check

```bash
# Check service health and circuit breaker states
curl http://localhost:8100/health
```

**Response:**
```json
{
  "status": "healthy",
  "redis": "connected",
  "adapters": ["spotify", "musicbrainz", "lastfm", "beatport", "discogs", "acousticbrainz"],
  "circuit_breakers": {
    "spotify": {
      "name": "spotify",
      "state": "closed",
      "failure_count": 0,
      "success_count": 0,
      "failure_threshold": 10,
      "last_failure_time": null
    }
  }
}
```

## Admin Endpoints

### Rate Limit Management

```bash
# Get current rate limit stats
curl http://localhost:8100/admin/rate-limits

# Reset rate limit for a provider
curl -X POST http://localhost:8100/admin/rate-limits/spotify/reset
```

### Circuit Breaker Management

```bash
# Get all circuit breaker states
curl http://localhost:8100/admin/circuit-breakers

# Reset circuit breaker for a provider
curl -X POST http://localhost:8100/admin/circuit-breakers/spotify/reset

# Reset all circuit breakers
curl -X POST http://localhost:8100/admin/circuit-breakers/reset-all
```

### Cache Management

```bash
# Get cache statistics
curl http://localhost:8100/admin/cache/stats

# Invalidate all Spotify cache entries
curl -X POST "http://localhost:8100/admin/cache/invalidate?provider=spotify"

# Invalidate specific data type
curl -X POST "http://localhost:8100/admin/cache/invalidate?provider=spotify&data_type=search_results"
```

## Integration with Services

### From Python Services

```python
import aiohttp

async def search_spotify_track(artist: str, title: str):
    """Search Spotify via API Gateway."""
    async with aiohttp.ClientSession() as session:
        async with session.post(
            'http://api-gateway-internal:8100/api/spotify/search',
            json={
                'artist': artist,
                'title': title,
                'limit': 10
            }
        ) as response:
            return await response.json()
```

### From Scraper Pipeline

```python
from scrapers.pipelines.api_enrichment_pipeline import APIEnrichmentPipeline

class MySpider(scrapy.Spider):
    name = "my_spider"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Pipeline will use API Gateway automatically
        self.api_enrichment = APIEnrichmentPipeline()

    async def parse(self, response):
        # Extract track info
        artist = response.css('.artist::text').get()
        title = response.css('.title::text').get()

        # Enrich via API Gateway
        track_data = await self.api_enrichment.enrich_track(artist, title)

        yield track_data
```

## Monitoring & Alerting

### Grafana Dashboard

Access the API Gateway dashboard at: `http://localhost:3001/d/api-gateway`

**Panels:**
- Request rate by provider
- Circuit breaker states
- Cache hit rate
- Rate limit token availability
- Retry attempts and success rate
- Response time percentiles (p50, p95, p99)
- Rate limit wait times

### Prometheus Metrics

**Available metrics:**
- `api_gateway_rate_limit_requests_total{provider, status}`
- `api_gateway_rate_limit_tokens{provider}`
- `api_gateway_rate_limit_wait_seconds{provider}`
- `api_gateway_cache_hits_total{provider, data_type}`
- `api_gateway_cache_misses_total{provider, data_type}`
- `api_gateway_cache_errors_total{provider, operation}`
- `api_gateway_circuit_breaker_state{provider}`
- `api_gateway_circuit_breaker_failures_total{provider}`
- `api_gateway_circuit_breaker_opens_total{provider}`
- `api_gateway_retry_attempts_total{provider, error_type}`
- `api_gateway_retry_success_total{provider}`
- `api_gateway_retry_failures_total{provider}`

### Alert Rules

**Circuit Breaker Open:**
```yaml
- alert: CircuitBreakerOpen
  expr: api_gateway_circuit_breaker_state > 0
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "Circuit breaker open for {{ $labels.provider }}"
```

**High Cache Miss Rate:**
```yaml
- alert: HighCacheMissRate
  expr: |
    sum(rate(api_gateway_cache_misses_total[5m])) by (provider) /
    (sum(rate(api_gateway_cache_hits_total[5m])) by (provider) +
     sum(rate(api_gateway_cache_misses_total[5m])) by (provider)) > 0.8
  for: 10m
  labels:
    severity: info
  annotations:
    summary: "High cache miss rate for {{ $labels.provider }}"
```

## Configuration

See `config/api_gateway_config.yaml` for full configuration options:

- Rate limits per provider
- Circuit breaker thresholds
- Cache TTL policies
- Retry strategy parameters
- Timeout settings
- Logging configuration

## Deployment

### Local Development

```bash
# Start the service
docker compose up -d api-gateway-internal

# View logs
docker compose logs -f api-gateway-internal

# Test health
curl http://localhost:8100/health
```

### Production

The service is designed for horizontal scaling. Run multiple instances behind a load balancer:

```yaml
# docker-compose override for production
api-gateway-internal:
  deploy:
    replicas: 3
    resources:
      limits:
        cpus: '2.0'
        memory: 2G
```

## Troubleshooting

### Circuit Breaker Stuck Open

```bash
# Check circuit breaker state
curl http://localhost:8100/admin/circuit-breakers

# If necessary, manually reset
curl -X POST http://localhost:8100/admin/circuit-breakers/spotify/reset
```

### High Rate Limit Wait Times

```bash
# Check rate limit stats
curl http://localhost:8100/admin/rate-limits

# Review configuration in config/api_gateway_config.yaml
# Increase requests_per_second or burst_capacity if needed
```

### Cache Issues

```bash
# Check cache stats
curl http://localhost:8100/admin/cache/stats

# Verify Redis connection
docker compose exec api-gateway-internal python -c "
import redis.asyncio as redis
import asyncio

async def test():
    r = redis.Redis(host='redis', port=6379, password='...')
    await r.ping()
    print('Redis OK')

asyncio.run(test())
"
```

## Performance

**Benchmarks (sub-second response times for cached data):**
- Cache hit: ~5ms
- Rate limit acquisition: ~1ms
- Full request with retry: ~200-500ms (depending on external API)

**Throughput:**
- Spotify: 10 req/sec sustained, 20 req/sec burst
- MusicBrainz: 1 req/sec (API guideline)
- Total capacity: ~30-40 req/sec across all providers

## Future Enhancements

- [ ] Request prioritization (premium vs free tier)
- [ ] Adaptive rate limiting based on response patterns
- [ ] Request deduplication
- [ ] Multi-region deployment support
- [ ] GraphQL interface
- [ ] Webhook support for async operations

## License

Part of the SongNodes project. See main LICENSE file.
