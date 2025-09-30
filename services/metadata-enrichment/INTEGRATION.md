# Metadata Enrichment Integration Guide

## Integration with Existing Services

### Scraper Orchestrator Integration

The metadata enrichment service is designed to work seamlessly with the existing scraper orchestrator. Here's how to integrate:

#### 1. Automatic Enrichment After Scraping

Add a post-scraping hook in the scraper orchestrator to trigger enrichment:

```python
# In scraper-orchestrator/main.py

async def enrich_scraped_tracks(track_ids: List[str]):
    """Trigger enrichment for newly scraped tracks"""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "http://metadata-enrichment:8020/enrich/batch",
            json=[
                {
                    "track_id": track_id,
                    "artist_name": track_data["artist"],
                    "track_title": track_data["title"],
                    "priority": 7  # Higher priority for freshly scraped tracks
                }
                for track_id, track_data in get_track_data(track_ids)
            ],
            timeout=300.0
        )
        return response.json()
```

#### 2. Queue-Based Integration (Recommended)

For better decoupling, use RabbitMQ:

```python
# Scraper orchestrator publishes to enrichment queue
async def queue_for_enrichment(track_id: str, artist: str, title: str):
    """Queue track for enrichment via RabbitMQ"""
    message = {
        "track_id": track_id,
        "artist_name": artist,
        "track_title": title,
        "priority": 5,
        "correlation_id": str(uuid.uuid4())[:8]
    }

    await rabbitmq_channel.basic_publish(
        exchange="",
        routing_key="enrichment_queue",
        body=json.dumps(message)
    )
```

Then in metadata-enrichment service, add RabbitMQ consumer (similar to scraper-orchestrator pattern):

```python
# Add to main.py lifespan
async def consume_enrichment_queue():
    """Consume enrichment queue from RabbitMQ"""
    connection = await aio_pika.connect_robust(
        f"amqp://{os.getenv('RABBITMQ_USER')}:{os.getenv('RABBITMQ_PASS')}@{os.getenv('RABBITMQ_HOST')}/"
    )

    channel = await connection.channel()
    queue = await channel.declare_queue("enrichment_queue", durable=True)

    async for message in queue:
        async with message.process():
            task_data = json.loads(message.body)
            task = EnrichmentTask(**task_data)
            await enrichment_pipeline.enrich_track(task)
```

### Data Transformer Integration

Enrich tracks before transformation:

```python
# In data-transformer service

async def transform_with_enrichment(raw_track_data):
    """Ensure track is enriched before transformation"""
    # Check if track needs enrichment
    track_id = raw_track_data["id"]

    async with httpx.AsyncClient() as client:
        # Check enrichment status
        stats_response = await client.get(
            f"http://metadata-enrichment:8020/stats"
        )

        # If not enriched, trigger enrichment
        if needs_enrichment(track_id, stats_response.json()):
            await client.post(
                "http://metadata-enrichment:8020/enrich",
                json={
                    "track_id": track_id,
                    "artist_name": raw_track_data["artist"],
                    "track_title": raw_track_data["title"],
                    "priority": 8
                }
            )

    # Continue with transformation...
```

### REST API Integration

Expose enrichment through the existing REST API:

```python
# In services/rest-api/main.py

from fastapi import BackgroundTasks

@app.post("/tracks/{track_id}/enrich")
async def enrich_track_endpoint(
    track_id: str,
    force_refresh: bool = False,
    background_tasks: BackgroundTasks
):
    """Trigger enrichment for a specific track"""
    # Get track details from database
    track = await get_track_by_id(track_id)

    if not track:
        raise HTTPException(status_code=404, detail="Track not found")

    # Call enrichment service
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "http://metadata-enrichment:8020/enrich",
            json={
                "track_id": str(track_id),
                "artist_name": track.artist_name,
                "track_title": track.title,
                "existing_spotify_id": track.spotify_id,
                "existing_isrc": track.isrc,
                "force_refresh": force_refresh,
                "priority": 5
            },
            timeout=60.0
        )

        return response.json()
```

### GraphQL Integration

Add enrichment mutations:

```graphql
# In services/graphql-api/schema.graphql

type Mutation {
  enrichTrack(trackId: ID!, forceRefresh: Boolean): EnrichmentResult!
  enrichTracks(trackIds: [ID!]!): [EnrichmentResult!]!
}

type EnrichmentResult {
  trackId: ID!
  status: EnrichmentStatus!
  sourcesUsed: [String!]!
  metadataAcquired: JSON!
  errors: [String!]!
  durationSeconds: Float!
  cached: Boolean!
  timestamp: DateTime!
}

enum EnrichmentStatus {
  PENDING
  IN_PROGRESS
  COMPLETED
  PARTIAL
  FAILED
}
```

Resolver:

```python
# In services/graphql-api/resolvers.py

async def resolve_enrich_track(obj, info, track_id, force_refresh=False):
    """Enrich a single track"""
    track = await get_track(track_id)

    async with httpx.AsyncClient() as client:
        response = await client.post(
            "http://metadata-enrichment:8020/enrich",
            json={
                "track_id": track_id,
                "artist_name": track.artist_name,
                "track_title": track.title,
                "existing_spotify_id": track.spotify_id,
                "existing_isrc": track.isrc,
                "force_refresh": force_refresh
            }
        )

        return response.json()
```

## Monitoring Integration

### Prometheus Integration

The enrichment service already exposes metrics at `/metrics`. Add to Prometheus config:

```yaml
# In monitoring/prometheus/prometheus.yml

scrape_configs:
  - job_name: 'metadata-enrichment'
    static_configs:
      - targets: ['metadata-enrichment:8020']
    scrape_interval: 15s
    scrape_timeout: 10s
```

### Grafana Dashboard

Create a dashboard with these panels:

1. **Enrichment Success Rate**
   ```promql
   rate(enrichment_tasks_total{status="completed"}[5m]) /
   rate(enrichment_tasks_total[5m]) * 100
   ```

2. **API Latency (95th percentile)**
   ```promql
   histogram_quantile(0.95,
     rate(api_response_time_seconds_bucket[5m]))
   ```

3. **Cache Hit Rate**
   ```promql
   rate(enrichment_cache_hits_total[5m]) /
   (rate(enrichment_cache_hits_total[5m]) +
    rate(enrichment_cache_misses_total[5m])) * 100
   ```

4. **Circuit Breaker Status**
   ```promql
   circuit_breaker_state{state="open"}
   ```

5. **Tracks Enriched per Minute**
   ```promql
   rate(tracks_enriched_total{status="completed"}[1m]) * 60
   ```

### Alert Rules

Add to Prometheus alerting rules:

```yaml
# In observability/alerting/enrichment-alerts.yml

groups:
  - name: metadata_enrichment
    interval: 30s
    rules:
      - alert: EnrichmentFailureRateHigh
        expr: |
          rate(enrichment_tasks_total{status="failed"}[5m]) /
          rate(enrichment_tasks_total[5m]) > 0.3
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High enrichment failure rate"
          description: "{{ $value | humanizePercentage }} of enrichment tasks failing"

      - alert: CircuitBreakerOpen
        expr: circuit_breaker_state{state="open"} > 0
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Circuit breaker open for {{ $labels.api }}"
          description: "API {{ $labels.api }} circuit breaker has been open for 2+ minutes"

      - alert: CacheHitRateLow
        expr: |
          rate(enrichment_cache_hits_total[10m]) /
          (rate(enrichment_cache_hits_total[10m]) +
           rate(enrichment_cache_misses_total[10m])) < 0.5
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Low cache hit rate"
          description: "Cache hit rate is {{ $value | humanizePercentage }}"

      - alert: EnrichmentServiceDown
        expr: up{job="metadata-enrichment"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Metadata enrichment service is down"
          description: "Service has been unavailable for 1+ minutes"
```

## Testing Integration

### Integration Test Example

```python
# tests/integration/test_enrichment_pipeline.py

import pytest
import httpx

@pytest.mark.asyncio
async def test_full_enrichment_pipeline():
    """Test complete enrichment pipeline from scraping to enriched data"""

    # 1. Scrape a track
    scrape_response = await scrape_track_from_1001tracklists(
        "https://www.1001tracklists.com/tracklist/test"
    )

    track_id = scrape_response["track_id"]

    # 2. Trigger enrichment
    async with httpx.AsyncClient() as client:
        enrich_response = await client.post(
            "http://localhost:8022/enrich",
            json={
                "track_id": track_id,
                "artist_name": "Test Artist",
                "track_title": "Test Track"
            },
            timeout=60.0
        )

        assert enrich_response.status_code == 200
        result = enrich_response.json()

        # 3. Verify enrichment
        assert result["status"] in ["completed", "partial"]
        assert len(result["sources_used"]) >= 1
        assert "spotify" in result["sources_used"] or "musicbrainz" in result["sources_used"]

        # 4. Check database was updated
        track = await get_track_from_db(track_id)
        assert track.spotify_id is not None or track.musicbrainz_id is not None
        assert track.bpm is not None
        assert track.enriched_at is not None
```

## Best Practices

### 1. Rate Limit Management

Batch enrichment requests during off-peak hours:

```python
# Schedule batch enrichment at night
scheduler.add_job(
    batch_enrich_old_tracks,
    trigger=CronTrigger(hour=3, minute=0),  # 3 AM
    id="nightly_enrichment",
    max_instances=1
)
```

### 2. Priority Handling

Use priority levels strategically:
- **10**: Critical (user-requested)
- **7-9**: High priority (freshly scraped)
- **4-6**: Normal (scheduled enrichment)
- **1-3**: Low priority (backfill)

### 3. Error Handling

Always handle enrichment failures gracefully:

```python
try:
    result = await enrich_track(track_id)
except Exception as e:
    logger.error(f"Enrichment failed for {track_id}: {e}")
    # Continue processing, enrichment can be retried later
    # Don't block the main workflow
```

### 4. Monitoring

Set up alerts for:
- Circuit breakers opening
- High failure rates (>30%)
- Low cache hit rates (<50%)
- API rate limit violations
- Service unavailability

### 5. Caching Strategy

- Cache successful responses for 7-90 days
- Don't cache 404s or errors
- Invalidate cache on force_refresh
- Monitor cache size and eviction rate

## Deployment Checklist

Before deploying metadata enrichment service:

- [ ] All API keys configured in .env
- [ ] Database migration `06-metadata-enrichment.sql` applied
- [ ] Redis is running and accessible
- [ ] Prometheus scraping configured
- [ ] Grafana dashboard created
- [ ] Alert rules configured
- [ ] Integration tests passing
- [ ] Resource limits set in docker-compose.yml
- [ ] Health checks configured
- [ ] Backup strategy for enrichment_status table

## Troubleshooting

See main README.md for detailed troubleshooting guide.