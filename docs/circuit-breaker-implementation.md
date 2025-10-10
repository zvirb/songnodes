# Circuit Breaker Implementation for SongNodes Scrapers

## Overview

This document describes the circuit breaker protection added to all API calls in the SongNodes scraper system to prevent cascading failures when external APIs degrade or become unavailable.

## Architecture

### Component Location

**Shared Circuit Breaker Module**: `/mnt/my_external_drive/programming/songnodes/services/common/circuit_breaker.py`

This module provides:
- `CircuitBreaker` class - Individual circuit breaker implementation
- `CircuitBreakerManager` class - Manages multiple circuit breakers for different API providers
- `CircuitBreakerOpenException` - Exception raised when circuit is open
- Prometheus metrics integration (optional)

### Design Pattern

The implementation follows the **Circuit Breaker Pattern** with three states:

1. **CLOSED** (Normal operation)
   - All requests pass through
   - Failure count increments on errors
   - Opens when failure threshold is reached

2. **OPEN** (Failing state)
   - All requests are rejected immediately
   - Prevents cascading failures
   - Automatically attempts reset after timeout period

3. **HALF_OPEN** (Testing recovery)
   - Limited requests pass through to test service health
   - Returns to CLOSED after success threshold met
   - Returns to OPEN on any failure

## Implementation Details

### Circuit Breaker Configuration

Per-provider thresholds are configured in `CircuitBreakerManager.DEFAULT_CONFIG`:

```python
DEFAULT_CONFIG = {
    'spotify': {
        'failure_threshold': 10,      # Open after 10 failures
        'timeout_seconds': 120,        # Wait 2 minutes before retry
        'success_threshold': 2         # Need 2 successes to close
    },
    'musicbrainz': {
        'failure_threshold': 3,        # Open after 3 failures
        'timeout_seconds': 60,         # Wait 1 minute before retry
        'success_threshold': 2
    },
    'lastfm': {
        'failure_threshold': 5,        # Open after 5 failures
        'timeout_seconds': 60,         # Wait 1 minute before retry
        'success_threshold': 2
    },
    'beatport': {
        'failure_threshold': 5,
        'timeout_seconds': 90,
        'success_threshold': 2
    },
    'discogs': {
        'failure_threshold': 5,
        'timeout_seconds': 60,
        'success_threshold': 2
    }
}
```

### Integration Points

#### 1. Metadata Enrichment Service

The metadata-enrichment service (`/mnt/my_external_drive/programming/songnodes/services/metadata-enrichment/api_clients.py`) uses circuit breakers for all API clients:

```python
# Import shared circuit breaker
from common.circuit_breaker import CircuitBreaker

# Each client has a circuit breaker
self.circuit_breaker = CircuitBreaker(
    failure_threshold=5,
    timeout_seconds=60,
    name="spotify"
)

# API calls are wrapped
async def search_track(self, artist: str, title: str):
    try:
        return await self.circuit_breaker.call(_search)
    except CircuitBreakerOpenException:
        logger.warning("Spotify circuit breaker is OPEN")
        return None
```

#### 2. API Enrichment Pipeline (Scrapers)

The scrapers now delegate to the metadata-enrichment service (thin client pattern), which provides circuit breaker protection:

```python
# services/metadata-enrichment/api_enrichment_pipeline.py
# Now delegates to metadata-enrichment service
enrichment_data = await self._enrich_via_service(
    track_id=adapter.get('track_id'),
    artist_name=artist,
    track_title=title
)
```

The metadata-enrichment service handles:
- Circuit breaker protection
- Caching (7-30 day TTL)
- Automatic retries with exponential backoff
- DLQ for failed enrichments
- Waterfall enrichment pattern

## Prometheus Metrics

The circuit breaker exports the following Prometheus metrics:

### Metrics Exported

1. **`circuit_breaker_state`** (Gauge)
   - Labels: `provider`
   - Values: 0=closed, 1=half_open, 2=open
   - Description: Current state of circuit breaker

2. **`circuit_breaker_failures_total`** (Counter)
   - Labels: `provider`
   - Description: Total circuit breaker failures

3. **`circuit_breaker_opens_total`** (Counter)
   - Labels: `provider`
   - Description: Total times circuit breaker opened

4. **`circuit_breaker_recoveries_total`** (Counter)
   - Labels: `provider`
   - Description: Total circuit breaker recoveries (close after open)

### Grafana Dashboard Queries

```promql
# Circuit breaker state by provider
circuit_breaker_state{provider="spotify"}

# Failure rate
rate(circuit_breaker_failures_total[5m])

# Circuit breaker opens per hour
rate(circuit_breaker_opens_total[1h])

# Recovery rate
rate(circuit_breaker_recoveries_total[1h])
```

## Logging and Monitoring

### Circuit Breaker State Logging

The `CircuitBreakerManager` provides a `format_stats()` method for logging:

```python
# Format circuit breaker stats
stats = circuit_breaker_manager.format_stats()
logger.info(f"Circuit Breaker States:\n{stats}")
```

Output example:
```
Circuit Breaker States:
  ✓ beatport        | State: closed      | Failures:  0/5
  ✓ discogs         | State: closed      | Failures:  0/5
  ⚠ lastfm          | State: half_open   | Failures:  2/5
  ✗ spotify         | State: open        | Failures: 10/10
  ✓ musicbrainz     | State: closed      | Failures:  0/3
```

### Metadata Enrichment Service Monitoring

The metadata-enrichment service has a scheduled task that updates circuit breaker metrics every minute:

```python
# services/metadata-enrichment/main.py
async def update_circuit_breaker_metrics():
    """Update circuit breaker metrics"""
    if enrichment_pipeline:
        for api_name, client in [
            ('spotify', enrichment_pipeline.spotify_client),
            ('musicbrainz', enrichment_pipeline.musicbrainz_client),
            # ... other clients
        ]:
            if hasattr(client, 'circuit_breaker'):
                state = client.circuit_breaker.state.value
                for s in ['closed', 'open', 'half_open']:
                    circuit_breaker_state_metric.labels(
                        api=api_name, state=s
                    ).set(1 if s == state else 0)
```

## Testing Circuit Breakers

### Manual Testing

To test circuit breaker behavior:

1. **Trigger failures to open circuit**:
```bash
# Simulate API failures by temporarily blocking API
# Circuit will open after threshold failures
docker exec -it metadata-enrichment python -c "
from api_clients import SpotifyClient
import asyncio

async def test():
    client = SpotifyClient(...)
    # Make failing requests
    for i in range(15):
        try:
            await client.search_track('artist', 'title')
        except:
            pass
asyncio.run(test())
"
```

2. **Check circuit breaker state**:
```bash
# Via metadata-enrichment service
curl http://localhost:8020/health

# Check Prometheus metrics
curl http://localhost:8020/metrics | grep circuit_breaker
```

3. **Monitor recovery**:
```bash
# Watch circuit breaker transition from OPEN -> HALF_OPEN -> CLOSED
watch -n 5 'curl -s http://localhost:8020/metrics | grep circuit_breaker_state'
```

### Automated Testing

Run integration tests:
```bash
cd /mnt/my_external_drive/programming/songnodes/services/metadata-enrichment
pytest tests/integration/test_circuit_breaker.py -v
```

## Troubleshooting

### Circuit Breaker Stuck Open

If a circuit breaker remains open:

1. **Check API health**:
```bash
# Test API directly
curl https://api.spotify.com/v1/search?q=test&type=track
```

2. **Check circuit breaker state**:
```bash
curl http://localhost:8020/metrics | grep "circuit_breaker_state.*spotify"
```

3. **Manual reset** (if needed):
```bash
# Reset via metadata-enrichment service
curl -X POST http://localhost:8020/enrich/reset-circuit-breaker/spotify
```

### High Failure Rates

If circuit breakers are opening frequently:

1. **Check API rate limits**:
   - Spotify: Check if rate limit headers indicate throttling
   - MusicBrainz: Ensure 1 req/sec limit is respected

2. **Verify API credentials**:
```bash
# Check if credentials are valid
docker exec -it metadata-enrichment python -c "
import os
print('SPOTIFY_CLIENT_ID:', os.getenv('SPOTIFY_CLIENT_ID'))
print('SPOTIFY_CLIENT_SECRET:', os.getenv('SPOTIFY_CLIENT_SECRET')[:10] + '...')
"
```

3. **Adjust thresholds** (if necessary):
```python
# In CircuitBreakerManager.DEFAULT_CONFIG
'spotify': {
    'failure_threshold': 15,  # Increase threshold
    'timeout_seconds': 180,   # Increase timeout
}
```

## Benefits

1. **Prevents Cascading Failures**
   - Stops calling degraded APIs immediately
   - Prevents resource exhaustion
   - Maintains system stability

2. **Automatic Recovery**
   - Tests service health after timeout
   - Resumes operations when service recovers
   - No manual intervention needed

3. **Observability**
   - Prometheus metrics for monitoring
   - Detailed logging of state transitions
   - Grafana dashboards for visualization

4. **Resource Efficiency**
   - Reduces unnecessary API calls
   - Preserves rate limit quotas
   - Lowers API costs

## Migration Guide

### For Existing Code

If you have existing API calls without circuit breaker protection:

**Before:**
```python
def call_api():
    response = requests.get('https://api.example.com')
    return response.json()
```

**After:**
```python
from common.circuit_breaker import CircuitBreakerManager

manager = CircuitBreakerManager()

async def call_api():
    async def _api_call():
        response = requests.get('https://api.example.com')
        return response.json()

    try:
        return await manager.call('example', _api_call)
    except CircuitBreakerOpenException:
        logger.warning("Circuit breaker open for example API")
        return None
```

### For New APIs

When adding a new API provider:

1. **Add configuration** in `CircuitBreakerManager.DEFAULT_CONFIG`
2. **Wrap API calls** with circuit breaker
3. **Add Prometheus metrics** if not using manager
4. **Test failure scenarios**

## File Locations

- **Circuit Breaker Implementation**: `/mnt/my_external_drive/programming/songnodes/services/common/circuit_breaker.py`
- **API Clients (with circuit breakers)**: `/mnt/my_external_drive/programming/songnodes/services/metadata-enrichment/api_clients.py`
- **Scraper Pipeline (delegation)**: `/mnt/my_external_drive/programming/songnodes/scrapers/pipelines/api_enrichment_pipeline.py`
- **Main Service**: `/mnt/my_external_drive/programming/songnodes/services/metadata-enrichment/main.py`

## References

- [Circuit Breaker Pattern - Martin Fowler](https://martinfowler.com/bliki/CircuitBreaker.html)
- [Netflix Hystrix](https://github.com/Netflix/Hystrix/wiki/How-it-Works)
- [Prometheus Best Practices](https://prometheus.io/docs/practices/naming/)
