# Enrichment Pipeline End-to-End Testing Guide

## Purpose

This guide provides step-by-step instructions to validate the complete enrichment pipeline implementation before production deployment.

---

## Prerequisites

- Docker and Docker Compose installed
- Access to the SongNodes repository
- `.env` file configured with required credentials
- PostgreSQL database running

---

## Testing Phases

### Phase 0: Pre-Flight Checks

#### 0.1 Verify Dependencies

```bash
# Check all required dependencies are listed
cd services/metadata-enrichment
grep -E "aio-pika|pika" requirements.txt

# Expected output:
# aio-pika==9.3.1  # RabbitMQ async client for queue consumers

cd ../../scrapers
grep -E "pika" requirements.txt

# Expected output:
# pika>=1.3.2  # Synchronous RabbitMQ client for Scrapy pipelines
```

✅ **Pass criteria**: Both `aio-pika` and `pika` are present in requirements files

#### 0.2 Verify File Existence

```bash
# From repository root
ls -la services/metadata-enrichment/worker_bootstrap.py
ls -la services/metadata-enrichment/queue_consumer.py
ls -la services/metadata-enrichment/queue_init.py
ls -la docker-compose.enrichment-workers.yml
ls -la sql/migrations/008_enrichment_metadata_fields_up.sql
ls -la monitoring/grafana/dashboards/enrichment-pipeline-dashboard.json
ls -la monitoring/prometheus/alerts/enrichment-alerts.yml
```

✅ **Pass criteria**: All files exist with expected sizes:
- `worker_bootstrap.py` (~350 lines)
- `queue_consumer.py` (~310 lines)
- `queue_init.py` (~215 lines)

---

## Phase 1: Database Migration Testing

### 1.1 Run Migration (Up)

```bash
# Connect to database
docker compose exec postgres psql -U musicdb_user -d musicdb

# Run migration
\i /docker-entrypoint-initdb.d/../../sql/migrations/008_enrichment_metadata_fields_up.sql

# Verify new fields exist
\d tracks

# Expected new columns:
# enrichment_timestamp | timestamp with time zone
# enrichment_source_api | character varying(50)
# source_data_version | character varying(100)
# camelot_key | character varying(3)
# tempo_confidence | numeric(3,2)
```

✅ **Pass criteria**: All 5 new columns are present in `tracks` table

### 1.2 Verify Trigger

```bash
# Still in psql
\df update_enrichment_timestamp

# Expected output: Function exists
```

### 1.3 Verify Materialized View

```bash
# In psql
SELECT * FROM enrichment_coverage_stats;

# Expected output: Single row with statistics
# total_tracks | with_spotify | enriched_tracks | stale_tracks_90d | spotify_coverage_pct
```

✅ **Pass criteria**: Query returns without errors

### 1.4 Test Trigger Functionality

```bash
# In psql
-- Update a track's spotify_id
UPDATE tracks
SET spotify_id = 'test_spotify_id_123'
WHERE id = (SELECT id FROM tracks LIMIT 1)
RETURNING id, enrichment_timestamp;

-- Verify enrichment_timestamp was auto-updated
```

✅ **Pass criteria**: `enrichment_timestamp` is set to current time

---

## Phase 2: Caching & Monitoring Testing

### 2.1 Verify Redis Connection

```bash
# Test Redis connectivity
docker compose exec redis redis-cli -a ${REDIS_PASSWORD} ping

# Expected output: PONG
```

### 2.2 Rebuild Services with Caching

```bash
# Rebuild scrapers with updated pipeline
docker compose build scraper-mixesdb scraper-1001tracklists

# Restart services
docker compose up -d scraper-mixesdb scraper-1001tracklists metadata-enrichment
```

### 2.3 Test Cache-Aside Pattern

```bash
# Trigger a scrape job (replace with valid spider)
docker compose exec scraper-mixesdb scrapy crawl mixesdb -a artist_name='Deadmau5' -a limit=5

# Monitor logs for cache hits/misses
docker compose logs -f scraper-mixesdb | grep -E "cache hit|cache miss"

# Expected output (first run):
# cache miss: spotify:search:deadmau5:strobe
# cache miss: spotify:search:deadmau5:ghosts

# Re-run same spider
docker compose exec scraper-mixesdb scrapy crawl mixesdb -a artist_name='Deadmau5' -a limit=5

# Expected output (second run):
# cache hit: spotify:search:deadmau5:strobe (70-80% hits)
```

✅ **Pass criteria**: Second run shows >50% cache hits

### 2.4 Verify Prometheus Metrics

```bash
# Check Prometheus is scraping enrichment metrics
curl -s http://localhost:9091/api/v1/targets | jq '.data.activeTargets[] | select(.labels.job=="api-gateway-internal")'

# Query cache hit metrics
curl -s 'http://localhost:9091/api/v1/query?query=enrichment_cache_hits_total' | jq

# Expected output: Metric with value > 0 after scraping
```

### 2.5 Verify Grafana Dashboard

```bash
# Access Grafana
open http://localhost:3001

# Navigate to:
# Dashboards → Enrichment Pipeline Dashboard

# Verify 9 panels display data:
# 1. Cache Hit Rate (gauge)
# 2. API Call Rate (time series)
# 3. Monthly API Cost (stat)
# 4. Success Rate (gauge)
# 5. Error Rate (time series)
# 6. API Latency p95 (time series)
# 7. Cache Hits vs Misses (bars)
# 8. Error Types (bar gauge)
# 9. Cost Over Time (time series)
```

✅ **Pass criteria**: All 9 panels load without errors

### 2.6 Test Alert Rules

```bash
# Verify Prometheus loaded alert rules
curl -s http://localhost:9091/api/v1/rules | jq '.data.groups[] | select(.name=="enrichment")'

# Expected output: 14 alert rules including:
# - EnrichmentCacheHitRateLow
# - EnrichmentAPIMonthlyBudgetExceeded
# - SpotifyRateLimitApproaching
```

✅ **Pass criteria**: All 14 alerts are loaded

---

## Phase 3: Queue Initialization Testing

### 3.1 Start RabbitMQ

```bash
# Ensure RabbitMQ is running
docker compose up -d rabbitmq

# Wait for healthy status
docker compose ps rabbitmq

# Expected: Status "healthy"
```

### 3.2 Initialize Queues

```bash
# Run queue initialization
docker compose -f docker-compose.yml -f docker-compose.enrichment-workers.yml run --rm enrichment-queue-init

# Expected output:
# ✓ Connected to RabbitMQ
# Creating Dead-Letter Exchange...
# ✓ Dead-Letter Queue configured
# Creating main enrichment queue...
# ✓ Main enrichment queue configured (priority enabled)
# Creating backlog enrichment queue...
# ✓ Backlog enrichment queue configured
# Creating re-enrichment queue...
# ✓ Re-enrichment queue configured
# Queue Initialization Complete
```

✅ **Pass criteria**: All 4 queues created successfully

### 3.3 Verify Queues in RabbitMQ

```bash
# List queues
docker compose exec rabbitmq rabbitmqctl list_queues name messages consumers durable auto_delete arguments

# Expected output:
# metadata_enrichment_queue        0  0  true  false  {x-max-priority,10,...}
# metadata_enrichment_backlog_queue 0  0  true  false  {...}
# metadata_reenrichment_queue      0  0  true  false  {...}
# metadata_enrichment_dlq          0  0  true  false  {...}
```

✅ **Pass criteria**: All 4 queues exist with correct settings

### 3.4 Verify DLX Configuration

```bash
# Check Dead-Letter Exchange
docker compose exec rabbitmq rabbitmqctl list_exchanges name type durable auto_delete

# Expected to include:
# metadata_enrichment_dlx  direct  true  false
```

✅ **Pass criteria**: DLX exchange exists

---

## Phase 4: Worker Bootstrap Testing

### 4.1 Test Worker Bootstrap Initialization

```bash
# Start a test worker (will initialize bootstrap then exit)
docker compose -f docker-compose.yml -f docker-compose.enrichment-workers.yml run --rm enrichment-worker python -c "
import asyncio
from worker_bootstrap import WorkerBootstrap

async def test():
    bootstrap = await WorkerBootstrap.create()
    print('✅ Bootstrap initialized successfully')

    # Test health check
    health = await bootstrap.health_check()
    print(f'Health check: {health}')

    # Verify enrichment pipeline exists
    assert bootstrap.enrichment_pipeline is not None
    print('✅ Enrichment pipeline available')

    await bootstrap.close()
    print('✅ Bootstrap closed successfully')

asyncio.run(test())
"

# Expected output:
# 🚀 Initializing worker bootstrap
# ✓ Database connection pool initialized
# ✓ Redis connection initialized
# ✓ HTTP client initialized
# ✓ Database API key helper initialized
# ✓ Spotify client initialized
# ✓ MusicBrainz client initialized
# ✓ Enrichment pipeline initialized
# ✅ Bootstrap initialized successfully
# Health check: {'database': 'healthy', 'redis': 'healthy', ...}
# ✅ Enrichment pipeline available
# ✅ Bootstrap closed successfully
```

✅ **Pass criteria**: Bootstrap initializes without errors

---

## Phase 5: Worker Consumer Testing

### 5.1 Start Single Worker

```bash
# Start one worker instance
docker compose -f docker-compose.yml -f docker-compose.enrichment-workers.yml up enrichment-worker

# Expected output:
# 🚀 Initializing enrichment worker
# ✓ Worker bootstrap initialized successfully
# ✓ Connected to RabbitMQ queue: metadata_enrichment_queue
#   Prefetch count: 1
#   Queue depth: 0 messages
# 🚀 Starting consumer for queue: metadata_enrichment_queue
# ✓ Consumer started successfully
# Waiting for enrichment tasks...
```

✅ **Pass criteria**: Worker starts and waits for messages

### 5.2 Publish Test Message

```bash
# In another terminal, publish a test message
docker compose exec rabbitmq rabbitmqadmin publish \
  exchange="" \
  routing_key="metadata_enrichment_queue" \
  properties='{"delivery_mode":2,"priority":5}' \
  payload='{"track_id":"00000000-0000-0000-0000-000000000001","artist":"Deadmau5","title":"Strobe","priority":5,"retry_count":0,"source":"test"}'

# Monitor worker logs
docker compose -f docker-compose.yml -f docker-compose.enrichment-workers.yml logs -f enrichment-worker

# Expected output:
# Processing enrichment task: 00000000-0000-0000-0000-000000000001
# Starting track enrichment artist=Deadmau5 title=Strobe
# ✓ Enriched: Deadmau5 - Strobe sources=2 cached=False
```

✅ **Pass criteria**: Worker processes message successfully

### 5.3 Test Failed Message → DLQ

```bash
# Publish invalid message (missing required fields)
docker compose exec rabbitmq rabbitmqadmin publish \
  exchange="" \
  routing_key="metadata_enrichment_queue" \
  properties='{"delivery_mode":2}' \
  payload='{"track_id":"invalid"}'

# Check DLQ
docker compose exec rabbitmq rabbitmqctl list_queues name messages

# Expected: metadata_enrichment_dlq should have 1 message
```

✅ **Pass criteria**: Failed message routes to DLQ

### 5.4 Test Exponential Backoff

```bash
# Publish message for non-existent track (will fail 3 times)
docker compose exec rabbitmq rabbitmqadmin publish \
  exchange="" \
  routing_key="metadata_enrichment_queue" \
  properties='{"delivery_mode":2,"priority":5}' \
  payload='{"track_id":"00000000-0000-0000-0000-999999999999","artist":"Unknown","title":"DoesNotExist","priority":5,"retry_count":0}'

# Watch logs for retry delays
docker compose logs -f enrichment-worker | grep -E "Requeued|retry"

# Expected output:
# ⏳ Requeued with 2s backoff (retry 1/3)
# ... (2 seconds later)
# ⏳ Requeued with 4s backoff (retry 2/3)
# ... (4 seconds later)
# ⏳ Requeued with 8s backoff (retry 3/3)
# ... (8 seconds later)
# ❌ Max retries exceeded for: Unknown - DoesNotExist
```

✅ **Pass criteria**: Retries occur with increasing delays (2s, 4s, 8s)

---

## Phase 6: Horizontal Scaling Testing

### 6.1 Scale to 3 Workers

```bash
# Scale to 3 worker instances
docker compose -f docker-compose.yml -f docker-compose.enrichment-workers.yml up -d --scale enrichment-worker=3

# Verify 3 workers running
docker compose -f docker-compose.yml -f docker-compose.enrichment-workers.yml ps enrichment-worker

# Expected output: 3 containers running
```

### 6.2 Test Load Distribution

```bash
# Publish 10 messages rapidly
for i in {1..10}; do
  docker compose exec rabbitmq rabbitmqadmin publish \
    exchange="" \
    routing_key="metadata_enrichment_queue" \
    properties='{"delivery_mode":2,"priority":5}' \
    payload="{\"track_id\":\"test-$i\",\"artist\":\"Artist$i\",\"title\":\"Title$i\",\"priority\":5,\"retry_count\":0}"
done

# Check worker logs
docker compose -f docker-compose.yml -f docker-compose.enrichment-workers.yml logs enrichment-worker | grep "Processing enrichment task"

# Expected: Messages distributed across 3 workers
# songnodes-enrichment-worker-1  | Processing enrichment task: test-1
# songnodes-enrichment-worker-2  | Processing enrichment task: test-2
# songnodes-enrichment-worker-3  | Processing enrichment task: test-3
# etc.
```

✅ **Pass criteria**: Messages distributed evenly across workers

### 6.3 Verify Prefetch Count

```bash
# Check RabbitMQ consumer prefetch
docker compose exec rabbitmq rabbitmqctl list_consumers

# Expected: prefetch_count = 1 for all consumers
```

✅ **Pass criteria**: Each worker has `prefetch_count=1`

---

## Phase 7: Integration Testing (Scrapy → Queue → Workers)

### 7.1 Configure Scrapy for Queue Mode

```bash
# Check if ENABLE_ENRICHMENT_QUEUE is set
docker compose exec scraper-mixesdb env | grep ENABLE_ENRICHMENT_QUEUE

# If not set, add to docker-compose.yml:
# environment:
#   ENABLE_ENRICHMENT_QUEUE: "true"
```

### 7.2 Run Scraper with Queue Publishing

```bash
# Ensure workers are running
docker compose -f docker-compose.yml -f docker-compose.enrichment-workers.yml up -d --scale enrichment-worker=3

# Run scraper
docker compose exec scraper-mixesdb scrapy crawl mixesdb -a artist_name='Deadmau5' -a limit=10

# Expected Scrapy output:
# ✓ Published enrichment task: Deadmau5 - Strobe
# ✓ Published enrichment task: Deadmau5 - Ghosts n Stuff
# ...
# Enrichment Queue Publisher Statistics
# ======================================
# Total tracks processed:     10
# Tasks published to queue:   10
# Publish failures:           0
```

### 7.3 Monitor Worker Processing

```bash
# Watch workers process tasks
docker compose -f docker-compose.yml -f docker-compose.enrichment-workers.yml logs -f enrichment-worker | grep "✓ Enriched"

# Expected output:
# ✓ Enriched: Deadmau5 - Strobe sources=2 cached=False
# ✓ Enriched: Deadmau5 - Ghosts n Stuff sources=2 cached=False
# ... (10 tasks total)
```

### 7.4 Verify Database Updates

```bash
# Check enriched tracks in database
docker compose exec postgres psql -U musicdb_user -d musicdb -c "
SELECT title, artist_name, spotify_id, enrichment_timestamp, enrichment_source_api
FROM tracks
WHERE title LIKE '%Strobe%' OR title LIKE '%Ghosts%'
LIMIT 5;
"

# Expected: Tracks have spotify_id and enrichment_timestamp populated
```

✅ **Pass criteria**: All scraped tracks are enriched via workers

---

## Phase 8: Performance Validation

### 8.1 Measure Throughput

```bash
# Clear queue
docker compose exec rabbitmq rabbitmqctl purge_queue metadata_enrichment_queue

# Publish 100 tasks
time for i in {1..100}; do
  docker compose exec rabbitmq rabbitmqadmin publish \
    exchange="" \
    routing_key="metadata_enrichment_queue" \
    properties='{"delivery_mode":2}' \
    payload="{\"track_id\":\"perf-$i\",\"artist\":\"Artist\",\"title\":\"Track$i\",\"priority\":5}" \
    >/dev/null 2>&1
done

# Start timer
start=$(date +%s)

# Wait for queue to empty
while [ $(docker compose exec rabbitmq rabbitmqctl list_queues name messages | grep metadata_enrichment_queue | awk '{print $2}') -gt 0 ]; do
  sleep 1
done

# End timer
end=$(date +%s)
duration=$((end - start))

echo "Processed 100 tasks in $duration seconds"
echo "Throughput: $((100 / duration)) tasks/second"
```

✅ **Pass criteria** (3 workers):
- Throughput: >5 tasks/second
- Duration: <20 seconds for 100 tasks

### 8.2 Verify Cache Hit Rate After Warm-up

```bash
# Scrape same artist twice
docker compose exec scraper-mixesdb scrapy crawl mixesdb -a artist_name='Deadmau5' -a limit=5
docker compose exec scraper-mixesdb scrapy crawl mixesdb -a artist_name='Deadmau5' -a limit=5

# Query Prometheus for cache hit rate
curl -s 'http://localhost:9091/api/v1/query?query=rate(enrichment_cache_hits_total[5m])/rate(enrichment_cache_hits_total[5m]%2Benrichment_cache_misses_total[5m])' | jq '.data.result[0].value[1]'

# Expected: >0.7 (70% cache hit rate)
```

✅ **Pass criteria**: Cache hit rate >70% after warm-up

---

## Phase 9: Resource Monitoring

### 9.1 Check Worker Memory Usage

```bash
# Monitor memory usage per worker
docker stats --no-stream --format "table {{.Name}}\t{{.MemUsage}}\t{{.CPUPerc}}" | grep enrichment-worker

# Expected output (per worker):
# enrichment-worker-1  150MB / 512MB  5-10%
# enrichment-worker-2  150MB / 512MB  5-10%
# enrichment-worker-3  150MB / 512MB  5-10%
```

✅ **Pass criteria**: Each worker <512MB RAM, <20% CPU

### 9.2 Check Redis Memory

```bash
# Check Redis memory usage
docker compose exec redis redis-cli -a ${REDIS_PASSWORD} INFO memory | grep used_memory_human

# Expected: <500MB (with 2GB limit)
```

### 9.3 Monitor RabbitMQ

```bash
# Access RabbitMQ Management UI
open http://localhost:15673

# Login: musicdb / rabbitmq_secure_pass_2024

# Verify:
# - 3 consumers on metadata_enrichment_queue
# - Message rate ~5-10 msg/sec
# - No memory alarms
```

---

## Phase 10: Rollback Testing

### 10.1 Test Down Migration

```bash
# Run down migration
docker compose exec postgres psql -U musicdb_user -d musicdb -f /sql/migrations/008_enrichment_metadata_fields_down.sql

# Verify columns removed
docker compose exec postgres psql -U musicdb_user -d musicdb -c "\d tracks" | grep enrichment

# Expected: No enrichment columns
```

### 10.2 Re-run Up Migration

```bash
# Re-run up migration
docker compose exec postgres psql -U musicdb_user -d musicdb -f /sql/migrations/008_enrichment_metadata_fields_up.sql

# Verify columns restored
docker compose exec postgres psql -U musicdb_user -d musicdb -c "\d tracks" | grep enrichment

# Expected: All 5 enrichment columns present
```

✅ **Pass criteria**: Migrations are reversible

---

## Test Completion Checklist

### Phase 0: Pre-Flight ✅
- [ ] Dependencies verified (aio-pika, pika)
- [ ] All required files exist

### Phase 1: Database ✅
- [ ] Migration runs successfully
- [ ] Trigger auto-updates enrichment_timestamp
- [ ] Materialized view created

### Phase 2: Caching ✅
- [ ] Redis cache hit/miss logged
- [ ] Cache hit rate >70% after warm-up
- [ ] Prometheus metrics scraped
- [ ] Grafana dashboard displays 9 panels
- [ ] 14 alert rules loaded

### Phase 3: Queues ✅
- [ ] 4 queues initialized
- [ ] DLX configured correctly

### Phase 4: Bootstrap ✅
- [ ] Worker bootstrap initializes
- [ ] Health check passes
- [ ] API clients created

### Phase 5: Workers ✅
- [ ] Worker processes messages
- [ ] Failed messages route to DLQ
- [ ] Exponential backoff works (2s, 4s, 8s)

### Phase 6: Scaling ✅
- [ ] 3 workers start successfully
- [ ] Messages distributed evenly
- [ ] Prefetch count = 1

### Phase 7: Integration ✅
- [ ] Scrapy publishes to queue
- [ ] Workers enrich tracks
- [ ] Database updated correctly

### Phase 8: Performance ✅
- [ ] Throughput >5 tasks/sec (3 workers)
- [ ] Cache hit rate >70%

### Phase 9: Resources ✅
- [ ] Workers <512MB RAM each
- [ ] Redis <500MB
- [ ] No memory leaks after 1 hour

### Phase 10: Rollback ✅
- [ ] Down migration works
- [ ] Up migration works

---

## Success Criteria Summary

| Metric | Target | Status |
|:-------|:-------|:-------|
| Cache hit rate (warm) | >70% | ⬜ |
| Worker throughput (3 workers) | >5 tasks/sec | ⬜ |
| Message routing to DLQ | 100% failed msgs | ⬜ |
| Memory per worker | <512MB | ⬜ |
| Alert rules loaded | 14/14 | ⬜ |
| Grafana panels working | 9/9 | ⬜ |
| Migration reversibility | Both directions | ⬜ |

---

## Production Deployment Readiness

After completing all tests above:

```bash
# Stop test workers
docker compose -f docker-compose.yml -f docker-compose.enrichment-workers.yml down

# Tag tested commit
git tag -a enrichment-v1.0.0 -m "Enrichment pipeline tested and validated"
git push origin enrichment-v1.0.0

# Production deployment
kubectl apply -f k8s/enrichment/
```

---

## Troubleshooting

### Issue: Worker fails to connect to RabbitMQ
```bash
# Check RabbitMQ is healthy
docker compose ps rabbitmq

# Verify credentials
docker compose exec rabbitmq rabbitmqctl list_vhosts
docker compose exec rabbitmq rabbitmqctl list_users
```

### Issue: Messages stuck in queue
```bash
# Check worker logs
docker compose -f docker-compose.yml -f docker-compose.enrichment-workers.yml logs enrichment-worker

# Check for errors
docker compose exec rabbitmq rabbitmqctl list_queues name messages messages_unacknowledged
```

### Issue: High memory usage
```bash
# Reduce worker count
docker compose -f docker-compose.yml -f docker-compose.enrichment-workers.yml up -d --scale enrichment-worker=1

# Check for memory leaks
docker stats --no-stream
```

---

**Testing Complete**: All phases passed ✅
**Production Ready**: Yes/No
**Tested By**: _______________
**Date**: _______________
