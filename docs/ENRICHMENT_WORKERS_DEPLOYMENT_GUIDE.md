# Enrichment Workers Deployment Guide

**Blueprint Implementation**: Queue-Based Enrichment with Horizontal Scaling
**Last Updated**: 2025-10-10
**Status**: Production-Ready

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Prerequisites](#prerequisites)
4. [Deployment Options](#deployment-options)
5. [Scaling Guide](#scaling-guide)
6. [Monitoring](#monitoring)
7. [Troubleshooting](#troubleshooting)
8. [Performance Tuning](#performance-tuning)

---

## 1. Overview

This guide covers the deployment of **queue-based enrichment workers** that replace the synchronous Scrapy pipeline enrichment with asynchronous, horizontally scalable workers.

### Benefits

✅ **Non-blocking scraping**: Scrapers publish tasks and continue immediately
✅ **Horizontal scaling**: Add more workers to process faster
✅ **Independent scaling**: Scale enrichment separately from scraping
✅ **Priority queuing**: Real-time tasks processed before backlog
✅ **Fault tolerance**: Failed tasks retry with exponential backoff
✅ **Load balancing**: RabbitMQ distributes tasks across workers

### Performance Comparison

| Metric | Synchronous (Before) | Queue-Based (After) |
|--------|---------------------|---------------------|
| Scraping Speed | 200-500ms per track (API-bound) | 10-20ms per track (non-blocking) |
| Enrichment Throughput | 1 worker = 2-5 tracks/sec | 10 workers = 20-50 tracks/sec |
| Scalability | Limited to single process | Horizontally scalable (1-100+ workers) |
| Fault Tolerance | Scrape fails if API down | Scrape succeeds, enrichment retries |

---

## 2. Architecture

### Data Flow

```
┌─────────────────┐
│  Scrapy Spider  │ (Non-blocking scraping)
└────────┬────────┘
         │ Publish task
         ▼
┌─────────────────────────────────────┐
│       RabbitMQ Queues               │
│                                     │
│ ┌─────────────────────────────────┐│
│ │ metadata_enrichment_queue (P10) ││  ◄── Real-time (priority 7-10)
│ └─────────────────────────────────┘│
│                                     │
│ ┌─────────────────────────────────┐│
│ │ metadata_enrichment_backlog (P3)││  ◄── Backlog (priority 0-3)
│ └─────────────────────────────────┘│
│                                     │
│ ┌─────────────────────────────────┐│
│ │ metadata_enrichment_dlq         ││  ◄── Failed tasks
│ └─────────────────────────────────┘│
└───────────┬─────────────────────────┘
            │ Round-robin distribution
            ▼
┌───────────────────────────────────────┐
│   Enrichment Worker Pool (3-10+)      │
│                                       │
│  Worker1  Worker2  Worker3  ...       │
│    │        │        │                │
│    ▼        ▼        ▼                │
│  ┌────────────────────────┐           │
│  │ 1. Check Redis Cache   │           │
│  │ 2. Call API (if miss)  │           │
│  │ 3. Store in cache + DB │           │
│  │ 4. ACK message         │           │
│  └────────────────────────┘           │
└───────────────────────────────────────┘
```

### Components

| Component | Purpose | Scaling |
|-----------|---------|---------|
| `enrichment-queue-init` | Initializes RabbitMQ queues (run once) | N/A |
| `enrichment-worker` | Processes real-time enrichment tasks | 3-10+ replicas |
| `enrichment-backlog-worker` | Processes low-priority backlog | 1-2 replicas |
| `EnrichmentQueuePublisher` | Scrapy pipeline that publishes tasks | N/A |

---

## 3. Prerequisites

### Required Services

Ensure these services are running and healthy:

```bash
# Check service health
docker compose ps

# Required services:
# ✅ rabbitmq (healthy)
# ✅ redis (healthy)
# ✅ postgres (healthy)
# ✅ db-connection-pool (healthy)
```

### Database Migration

Run the enrichment metadata fields migration:

```bash
# Apply migration 008
docker compose exec postgres psql -U musicdb_user -d musicdb \
  -f /docker-entrypoint-initdb.d/migrations/008_enrichment_metadata_fields_up.sql

# Verify new fields
docker compose exec postgres psql -U musicdb_user -d musicdb \
  -c "\d tracks" | grep enrichment

# Expected output:
# enrichment_timestamp | timestamp with time zone
# enrichment_source_api | character varying(50)
# source_data_version | character varying(100)
```

### Python Dependencies

Add required packages to `services/metadata-enrichment/requirements.txt`:

```txt
aio-pika>=9.0.0  # RabbitMQ async client
pika>=1.3.0      # RabbitMQ sync client (for Scrapy)
```

Rebuild containers:

```bash
docker compose build metadata-enrichment
```

---

## 4. Deployment Options

### Option A: Quick Start (3 Workers)

Deploy with default configuration (3 real-time workers + 1 backlog worker):

```bash
# Deploy enrichment workers
docker compose -f docker-compose.yml -f docker-compose.enrichment-workers.yml up -d

# Verify workers started
docker compose ps | grep enrichment-worker

# Expected output:
# enrichment-queue-init      ... Exit 0
# enrichment-worker-1        ... Up
# enrichment-worker-2        ... Up
# enrichment-worker-3        ... Up
# enrichment-backlog-worker-1 ... Up
```

### Option B: Custom Scaling

Set worker count via environment variables:

```bash
# Set worker counts in .env
echo "ENRICHMENT_WORKERS=5" >> .env
echo "ENRICHMENT_BACKLOG_WORKERS=2" >> .env
echo "ENRICHMENT_PREFETCH_COUNT=1" >> .env

# Deploy with custom scaling
docker compose -f docker-compose.yml -f docker-compose.enrichment-workers.yml up -d

# Verify 5 workers started
docker compose ps | grep enrichment-worker | wc -l
# Expected output: 5
```

### Option C: Runtime Scaling

Scale workers dynamically without restarting:

```bash
# Scale to 10 workers
docker compose -f docker-compose.yml -f docker-compose.enrichment-workers.yml \
  up -d --scale enrichment-worker=10

# Check worker count
docker compose ps | grep enrichment-worker

# Scale down to 3 workers
docker compose -f docker-compose.yml -f docker-compose.enrichment-workers.yml \
  up -d --scale enrichment-worker=3
```

---

## 5. Scaling Guide

### When to Scale Up

**Indicators**:
- Queue depth > 1000 messages for >10 minutes
- Enrichment latency > 5 minutes (check Grafana)
- Scraping outpaces enrichment (backlog growing)

**Action**:
```bash
# Check queue depth
docker compose exec rabbitmq rabbitmqctl list_queues name messages

# If metadata_enrichment_queue > 1000:
docker compose -f docker-compose.yml -f docker-compose.enrichment-workers.yml \
  up -d --scale enrichment-worker=10
```

### When to Scale Down

**Indicators**:
- Queue depth = 0 for >1 hour
- Worker CPU usage < 10% (check `docker stats`)
- Low API call rate (check Grafana)

**Action**:
```bash
# Check worker CPU
docker stats --no-stream | grep enrichment-worker

# If all workers idle:
docker compose -f docker-compose.yml -f docker-compose.enrichment-workers.yml \
  up -d --scale enrichment-worker=2
```

### Scaling Recommendations

| Scenario | Workers | Prefetch | Notes |
|----------|---------|----------|-------|
| **Development** | 1-2 | 1 | Minimal resource usage |
| **Light Load** (<1000 tracks/day) | 3 | 1 | Default configuration |
| **Medium Load** (1000-10000 tracks/day) | 5-7 | 1 | Good balance |
| **Heavy Load** (>10000 tracks/day) | 10-15 | 2 | High throughput |
| **Backlog Processing** | 10-20 | 3 | Burst processing |

### Resource Planning

**Per Worker**:
- CPU: 0.25-0.5 cores
- Memory: 256-512MB
- Network: Minimal (API calls only)

**Total Resources** (10 workers):
- CPU: 2.5-5 cores
- Memory: 2.5-5GB

---

## 6. Monitoring

### Queue Metrics

**Check queue depth** (via RabbitMQ Management UI):
```
http://localhost:15673
Login: musicdb / rabbitmq_secure_pass_2024

Navigate to: Queues → metadata_enrichment_queue

Key metrics:
- Messages: Current queue depth
- Message rate: Messages/sec incoming vs outgoing
- Consumer utilization: Should be near 100%
```

**Via CLI**:
```bash
# List all queues with message counts
docker compose exec rabbitmq rabbitmqctl list_queues \
  name messages consumers

# Expected output:
# metadata_enrichment_queue        142    3    # 142 messages, 3 consumers
# metadata_enrichment_backlog_queue  0    1
# metadata_enrichment_dlq             0    0
```

### Worker Logs

**View worker logs**:
```bash
# All workers
docker compose logs -f enrichment-worker

# Specific worker
docker compose logs -f enrichment-worker-1

# Expected log pattern:
# Processing enrichment task: a1b2c3d4
# ✓ Spotify cache hit: Artist - Title
# ✓ Enriched: Artist - Title (source: spotify)
```

### Prometheus Metrics

**Check enrichment metrics** (Prometheus):
```
http://localhost:9091

Useful queries:
- Queue depth: rabbitmq_queue_messages{queue="metadata_enrichment_queue"}
- Processing rate: rate(enrichment_api_calls_total[1m])
- Cache hit rate: rate(enrichment_cache_hits_total[5m]) / (rate(enrichment_cache_hits_total[5m]) + rate(enrichment_cache_misses_total[5m]))
- Worker count: count(up{job="enrichment-worker"})
```

### Grafana Dashboard

**Import dashboard**:
```
http://localhost:3001

1. Navigate to Dashboards → Import
2. Upload: monitoring/grafana/dashboards/enrichment-pipeline-dashboard.json
3. Select Prometheus datasource
4. Click Import

Key panels:
- Cache Hit Rate (target: >60%)
- API Call Rate by Provider
- Queue Depth (alert if >1000)
- Worker CPU/Memory usage
```

---

## 7. Troubleshooting

### Issue: Workers Not Processing Messages

**Symptoms**:
- Queue depth increasing
- Worker logs show no activity
- `docker compose ps` shows workers as "Up" but idle

**Diagnosis**:
```bash
# Check if workers are consuming
docker compose exec rabbitmq rabbitmqctl list_consumers

# Expected output should show consumers on metadata_enrichment_queue
# If no consumers listed, workers aren't connected

# Check worker logs for errors
docker compose logs enrichment-worker | grep -i error
```

**Solutions**:
```bash
# 1. Restart workers
docker compose -f docker-compose.yml -f docker-compose.enrichment-workers.yml restart enrichment-worker

# 2. Check RabbitMQ connectivity
docker compose exec enrichment-worker-1 \
  python -c "import pika; pika.BlockingConnection(pika.ConnectionParameters('rabbitmq'))"

# 3. Verify queue exists
docker compose exec rabbitmq rabbitmqctl list_queues | grep metadata_enrichment

# 4. Re-run queue initialization
docker compose -f docker-compose.yml -f docker-compose.enrichment-workers.yml \
  up -d enrichment-queue-init
```

---

### Issue: High API Error Rate

**Symptoms**:
- Enrichment success rate < 85% (Grafana)
- Many messages in DLQ
- Error logs showing API failures

**Diagnosis**:
```bash
# Check DLQ size
docker compose exec rabbitmq rabbitmqctl list_queues | grep dlq

# View DLQ messages (first 10)
docker compose exec rabbitmq rabbitmqctl list_queue_messages metadata_enrichment_dlq 10

# Check error patterns in logs
docker compose logs enrichment-worker | grep -i "error\|failed" | tail -20
```

**Solutions**:
```bash
# 1. Check external API status
curl -I https://api.spotify.com/v1/search

# 2. Verify API credentials
docker compose exec enrichment-worker-1 env | grep SPOTIFY

# 3. Check rate limiting
# If seeing HTTP 429, reduce worker count or add delays
docker compose -f docker-compose.yml -f docker-compose.enrichment-workers.yml \
  up -d --scale enrichment-worker=2

# 4. Replay DLQ messages (after fixing root cause)
# Use DLQ manager service (see services/dlq-manager/README.md)
```

---

### Issue: Memory/CPU High

**Symptoms**:
- Workers using >512MB RAM
- CPU usage >80%
- OOM kills in logs

**Diagnosis**:
```bash
# Check resource usage
docker stats --no-stream | grep enrichment-worker

# Check worker count
docker compose ps | grep enrichment-worker | wc -l
```

**Solutions**:
```bash
# 1. Scale down workers
docker compose -f docker-compose.yml -f docker-compose.enrichment-workers.yml \
  up -d --scale enrichment-worker=2

# 2. Reduce prefetch_count (process fewer messages concurrently)
echo "ENRICHMENT_PREFETCH_COUNT=1" >> .env
docker compose -f docker-compose.yml -f docker-compose.enrichment-workers.yml restart enrichment-worker

# 3. Increase memory limits (if host has capacity)
# Edit docker-compose.enrichment-workers.yml:
#   limits:
#     memory: 1G  # Increase from 512M
```

---

## 8. Performance Tuning

### Tuning Parameters

#### `ENRICHMENT_WORKERS` (default: 3)

Controls number of concurrent worker instances.

**Increase if**:
- Queue depth consistently >1000
- Scraping faster than enrichment
- Want higher throughput

**Decrease if**:
- Workers idle most of the time
- High memory/CPU usage
- API rate limits hit frequently

#### `ENRICHMENT_PREFETCH_COUNT` (default: 1)

Number of messages a worker can process concurrently.

```bash
# Conservative (safe for rate limits)
ENRICHMENT_PREFETCH_COUNT=1

# Aggressive (higher throughput, may hit rate limits)
ENRICHMENT_PREFETCH_COUNT=3
```

**Tradeoffs**:
- Higher = more throughput but risk of rate limiting
- Lower = safer but slower processing

#### Cache TTL Configuration

Edit `scrapers/pipelines/api_enrichment_pipeline.py`:

```python
CACHE_TTL = {
    'spotify': 7 * 24 * 3600,      # 7 days (default)
    'musicbrainz': 30 * 24 * 3600,  # 30 days (very stable)
    'lastfm': 7 * 24 * 3600         # 7 days
}

# For higher cache hit rates (more cost savings), increase TTLs:
CACHE_TTL = {
    'spotify': 30 * 24 * 3600,      # 30 days
    'musicbrainz': 90 * 24 * 3600,  # 90 days
    'lastfm': 14 * 24 * 3600        # 14 days
}
```

### Benchmarking

**Test enrichment throughput**:

```bash
# 1. Publish 1000 test tasks to queue
docker compose exec enrichment-queue-init python -c "
import pika
import json
import time

connection = pika.BlockingConnection(pika.ConnectionParameters('rabbitmq'))
channel = connection.channel()

start = time.time()
for i in range(1000):
    channel.basic_publish(
        exchange='',
        routing_key='metadata_enrichment_queue',
        body=json.dumps({
            'track_id': f'test_{i}',
            'artist': 'Deadmau5',
            'title': 'Strobe',
            'priority': 5
        })
    )

duration = time.time() - start
print(f'Published 1000 tasks in {duration:.2f}s ({1000/duration:.1f} tasks/sec)')
connection.close()
"

# 2. Monitor processing speed
watch 'docker compose exec rabbitmq rabbitmqctl list_queues name messages'

# 3. Calculate throughput
# Throughput = (1000 tasks) / (time to empty queue)
```

---

## 9. Migration Path (Sync → Async)

### Step 1: Deploy Workers (No Impact)

```bash
# Deploy workers alongside existing sync pipeline
docker compose -f docker-compose.yml -f docker-compose.enrichment-workers.yml up -d

# Scrapers still use synchronous enrichment
# Workers are idle (no messages yet)
```

### Step 2: Switch One Scraper to Queue Mode

```bash
# Test with low-volume scraper first
# Edit scrapers/settings.py for ONE spider:

ITEM_PIPELINES = {
   'pipelines.validation_pipeline.ValidationPipeline': 100,
   'pipelines.enrichment_pipeline.EnrichmentPipeline': 200,
   # OLD: 'pipelines.api_enrichment_pipeline.APIEnrichmentPipeline': 250,
   # NEW (test mode):
   'pipelines.enrichment_queue_publisher.EnrichmentQueuePublisher': 250,
   'pipelines.persistence_pipeline.PersistencePipeline': 300,
}

# Restart ONE scraper
docker compose restart scraper-mixesdb

# Monitor worker logs for activity
docker compose logs -f enrichment-worker

# Expected: Tasks published, workers processing
```

### Step 3: Gradual Rollout

```bash
# Once confirmed working, update remaining scrapers
# Update all Dockerfiles to use EnrichmentQueuePublisher

# Rebuild and restart all scrapers
docker compose build scraper-1001tracklists scraper-reddit scraper-setlistfm
docker compose restart scraper-1001tracklists scraper-reddit scraper-setlistfm
```

### Step 4: Remove Sync Pipeline (Optional)

```bash
# After all scrapers migrated, remove APIEnrichmentPipeline from settings.py
# This reduces memory usage in scraper containers
```

---

## 10. Production Checklist

Before deploying to production:

- [ ] Run database migration 008
- [ ] Add `aio-pika` and `pika` to requirements.txt
- [ ] Set `ENRICHMENT_WORKERS` in .env (recommended: 5)
- [ ] Set `ENRICHMENT_PREFETCH_COUNT=1` for safe rate limiting
- [ ] Initialize queues: `docker compose -f ... up -d enrichment-queue-init`
- [ ] Deploy workers: `docker compose -f ... up -d enrichment-worker`
- [ ] Import Grafana dashboard: enrichment-pipeline-dashboard.json
- [ ] Configure Prometheus alerts: enrichment-alerts.yml
- [ ] Test with one scraper first
- [ ] Monitor queue depth for 24 hours
- [ ] Verify cache hit rate >60%
- [ ] Check API cost tracking in Grafana
- [ ] Rollout to all scrapers

---

## 11. Rollback Procedure

If issues occur, revert to synchronous enrichment:

```bash
# 1. Stop workers
docker compose -f docker-compose.yml -f docker-compose.enrichment-workers.yml down

# 2. Revert Scrapy pipeline configuration
# Edit scrapers/settings.py:
ITEM_PIPELINES = {
   'pipelines.api_enrichment_pipeline.APIEnrichmentPipeline': 250,  # Restore sync
   # 'pipelines.enrichment_queue_publisher.EnrichmentQueuePublisher': 250,  # Remove async
}

# 3. Rebuild and restart scrapers
docker compose build scraper-orchestrator scraper-mixesdb
docker compose restart scraper-orchestrator scraper-mixesdb

# 4. Process queued messages (optional)
# Messages in queue will remain until workers redeployed
# Or manually drain queue via RabbitMQ Management UI
```

---

## 12. Support

**Documentation**:
- Blueprint: `docs/ENRICHMENT_BLUEPRINT_IMPLEMENTATION_SUMMARY.md`
- Cache Implementation: `scrapers/pipelines/api_enrichment_pipeline.py`
- Queue Consumer: `services/metadata-enrichment/queue_consumer.py`

**Monitoring**:
- Grafana: http://localhost:3001/d/enrichment-pipeline
- Prometheus: http://localhost:9091
- RabbitMQ UI: http://localhost:15673

**Logs**:
```bash
# Worker logs
docker compose logs -f enrichment-worker

# Queue initialization
docker compose logs enrichment-queue-init

# Scraper logs (publishing)
docker compose logs -f scraper-mixesdb | grep "Published enrichment task"
```

---

**Deployment Guide Version**: 1.0
**Last Updated**: 2025-10-10
**Blueprint Reference**: Section 3 (Decoupled Enrichment Processing)
