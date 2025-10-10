# Operations Runbooks

## Overview

This document provides step-by-step operational procedures for common alerts, incidents, and maintenance tasks. Each runbook is designed to be executed by on-call engineers with minimal context.

---

## Quick Alert Index

| Alert Name | Severity | Runbook | Typical Resolution Time |
|------------|----------|---------|------------------------|
| `DLQDepthCritical` | P1 | [DLQ Overflow](#runbook-dlq-overflow) | 30 minutes |
| `CircuitBreakerOpen` | P1 | [Circuit Breaker Storm](#runbook-circuit-breaker-storm) | 15 minutes |
| `EnrichmentSuccessRateLow` | P2 | [Low Success Rate](#runbook-low-enrichment-success-rate) | 1 hour |
| `DataQualityScoreLow` | P2 | [Data Quality Issues](#runbook-data-quality-issues) | 2 hours |
| `DatabaseConnectionPoolHigh` | P1 | [Connection Pool Exhaustion](#runbook-database-connection-pool-exhaustion) | 15 minutes |
| `DiskSpaceHigh` | P1 | [Disk Space Critical](#runbook-disk-space-critical) | 30 minutes |
| `MemoryUsageHigh` | P1 | [Memory Exhaustion](#runbook-memory-exhaustion) | 20 minutes |
| `ScraperStalled` | P2 | [Scraper Not Progressing](#runbook-scraper-stalled) | 30 minutes |
| `APIGatewayErrorRateHigh` | P1 | [API Gateway Errors](#runbook-api-gateway-high-error-rate) | 30 minutes |

---

## Runbook: DLQ Overflow

**Alert Name:** `DLQDepthCritical`
**Severity:** P1
**Threshold:** DLQ depth > 1000 messages
**Impact:** Enrichment failures accumulating, potential disk space issues

### Symptoms
- Alert: "Dead Letter Queue depth exceeds 1000 messages"
- Grafana: DLQ depth chart spiking
- Enrichment success rate declining

### Investigation Steps

```bash
# 1. Check current DLQ stats
curl http://localhost:8024/dlq/stats | jq

# Expected output:
# {
#   "total_messages": 2500,
#   "oldest_message_age_minutes": 120,
#   "error_rate_per_minute": 25
# }

# 2. Identify error types
curl http://localhost:8024/dlq/errors/grouped | jq

# Expected output:
# {
#   "circuit_breaker_open": 1500,
#   "timeout": 600,
#   "invalid_data": 300,
#   "api_rate_limit": 100
# }

# 3. Sample failed messages
curl http://localhost:8024/dlq/messages?limit=10 | jq

# 4. Check circuit breaker states
curl http://localhost:8020/health | jq '.api_clients'
```

### Resolution Steps

**Scenario A: Circuit Breaker Errors (Most Common)**

```bash
# 1. Check which circuit breakers are open
curl http://localhost:8020/health | jq '.api_clients'

# 2. Wait for auto-recovery (60 seconds)
echo "Waiting for circuit breaker auto-recovery..."
sleep 60

# 3. Verify recovery
curl http://localhost:8020/health | jq '.api_clients'

# 4. If still open after 5 minutes, check external API status
curl -I https://api.spotify.com/v1/search
curl -I https://musicbrainz.org/ws/2/

# 5. If external API is down, disable temporarily
psql -h localhost -p 5433 -U musicdb_user -d musicdb << EOF
UPDATE metadata_enrichment_config
SET enabled = false
WHERE priority_1_provider = 'spotify';
EOF

curl -X POST http://localhost:8020/admin/config/reload

# 6. Manual reset if needed (after 5 minutes)
curl -X POST http://localhost:8020/admin/circuit-breakers/reset-all

# 7. Once recovered, replay DLQ
curl -X POST http://localhost:8024/dlq/replay/batch \
  -H "Content-Type: application/json" \
  -d '{"batch_size": 100}'

# 8. Monitor replay
watch -n 30 'curl -s http://localhost:8024/dlq/stats | jq .total_messages'
```

**Scenario B: Timeout Errors**

```bash
# 1. Increase timeout temporarily
psql -h localhost -p 5433 -U musicdb_user -d musicdb << EOF
UPDATE metadata_enrichment_config
SET timeout_seconds = 60
WHERE timeout_seconds < 60;
EOF

# 2. Reload configuration
curl -X POST http://localhost:8020/admin/config/reload

# 3. Wait 5 minutes and check error rate
sleep 300
curl http://localhost:8024/dlq/errors/grouped | jq

# 4. If improved, replay DLQ
curl -X POST http://localhost:8024/dlq/replay/batch \
  -H "Content-Type: application/json" \
  -d '{"batch_size": 50}'
```

**Scenario C: API Rate Limit**

```bash
# 1. Pause scrapers to reduce load
docker compose stop scraper-mixesdb scraper-1001tracklists

# 2. Wait 15 minutes for rate limits to reset
sleep 900

# 3. Restart with reduced concurrency
docker compose start scraper-mixesdb

# Wait and verify
sleep 60
docker compose logs scraper-mixesdb --tail=50

# 4. Gradually add more scrapers
docker compose start scraper-1001tracklists
```

**Scenario D: Invalid Data**

```bash
# 1. Sample failed messages to identify pattern
curl http://localhost:8024/dlq/messages?limit=20 | jq '.[] | {track_id, artist_name, track_name, error}'

# 2. If common pattern (e.g., missing field), fix validation
# (Requires code change - escalate to engineering)

# 3. Purge bad messages that can't be fixed
curl -X DELETE http://localhost:8024/dlq/messages/before/2025-10-09
```

### Verification

```bash
# 1. DLQ depth decreasing
curl http://localhost:8024/dlq/stats | jq .total_messages

# 2. No new errors
curl http://localhost:8024/dlq/errors/grouped | jq

# 3. Enrichment success rate normal
curl http://localhost:8020/stats | jq .success_rate

# Should be > 70%
```

### Prevention
- Monitor circuit breaker health proactively
- Set up alerts for increasing DLQ depth (>100 messages)
- Review DLQ weekly for patterns

---

## Runbook: Circuit Breaker Storm

**Alert Name:** `CircuitBreakerOpen`
**Severity:** P1
**Threshold:** Circuit breaker open for > 5 minutes
**Impact:** Enrichment failing for affected provider

### Symptoms
- Alert: "Circuit breaker for [provider] is OPEN"
- Enrichment success rate < 50%
- DLQ filling with circuit breaker errors

### Investigation Steps

```bash
# 1. Check all circuit breaker states
curl http://localhost:8020/health | jq '.api_clients'

# 2. Check failure counts
curl http://localhost:8020/metrics | grep circuit_breaker_failure_count

# 3. Check external API status
# Spotify
curl -I https://api.spotify.com/v1/search

# MusicBrainz
curl -I https://musicbrainz.org/ws/2/

# Last.fm
curl -I https://ws.audioscrobbler.com/2.0/

# 4. Check API Gateway logs
docker compose logs api-gateway-internal --tail=100 | grep -i "error\|timeout"

# 5. Check response times in Grafana
# Dashboard: API Gateway
# Panel: External API Response Times
```

### Resolution Steps

**Scenario A: External API Outage**

```bash
# 1. Confirm API is down (check status pages)
# Spotify: https://status.spotify.com
# MusicBrainz: https://metabrainz.org/

# 2. Disable affected provider
psql -h localhost -p 5433 -U musicdb_user -d musicdb << EOF
UPDATE metadata_enrichment_config
SET enabled = false
WHERE priority_1_provider = 'spotify'
   OR priority_2_provider = 'spotify'
   OR priority_3_provider = 'spotify';
EOF

# 3. Reload configuration
curl -X POST http://localhost:8020/admin/config/reload

# 4. Verify enrichment continues with other providers
curl http://localhost:8020/stats | jq

# 5. Monitor for API recovery
# When recovered, re-enable
psql -h localhost -p 5433 -U musicdb_user -d musicdb << EOF
UPDATE metadata_enrichment_config
SET enabled = true
WHERE priority_1_provider = 'spotify'
   OR priority_2_provider = 'spotify'
   OR priority_3_provider = 'spotify';
EOF

curl -X POST http://localhost:8020/admin/config/reload
```

**Scenario B: Network Issue**

```bash
# 1. Test DNS resolution
docker compose exec api-gateway-internal nslookup api.spotify.com

# 2. Test connectivity
docker compose exec api-gateway-internal curl -I https://api.spotify.com/v1/search

# 3. Check Docker network
docker network inspect songnodes_default

# 4. Restart networking
docker compose restart api-gateway-internal

# 5. Verify circuit breaker recovers
curl http://localhost:8020/health | jq '.api_clients'
```

**Scenario C: Rate Limiting**

```bash
# 1. Check if rate limit errors
docker compose logs api-gateway-internal --tail=100 | grep -i "429\|rate limit"

# 2. Temporarily pause enrichment
docker compose stop metadata-enrichment-worker-1 metadata-enrichment-worker-2

# 3. Wait 15 minutes
sleep 900

# 4. Restart with reduced concurrency
# Edit docker-compose.enrichment-workers.yml
# Reduce batch_size or worker count

docker compose -f docker-compose.yml \
  -f docker-compose.enrichment-workers.yml up -d
```

**Scenario D: Circuit Breaker Stuck**

```bash
# 1. Manual reset
curl -X POST http://localhost:8020/admin/circuit-breakers/reset-all

# 2. Verify state change
curl http://localhost:8020/health | jq '.api_clients'

# 3. Monitor for re-opening
watch -n 30 'curl -s http://localhost:8020/health | jq ".api_clients"'

# 4. If keeps re-opening, there's an underlying issue
# Escalate to engineering
```

### Verification

```bash
# 1. All circuit breakers CLOSED or HALF_OPEN
curl http://localhost:8020/health | jq '.api_clients'

# 2. Enrichment success rate recovering
curl http://localhost:8020/stats | jq .success_rate

# 3. DLQ not growing
watch -n 30 'curl -s http://localhost:8024/dlq/stats | jq .total_messages'
```

### Prevention
- Monitor external API health proactively
- Set up status page monitoring for providers
- Configure circuit breaker thresholds appropriately

---

## Runbook: Low Enrichment Success Rate

**Alert Name:** `EnrichmentSuccessRateLow`
**Severity:** P2
**Threshold:** Success rate < 70% for > 15 minutes
**Impact:** Reduced data quality, incomplete metadata

### Investigation Steps

```bash
# 1. Check current success rate
curl http://localhost:8020/stats | jq

# 2. Break down by provider
curl http://localhost:8020/stats/by-provider | jq

# 3. Check cache hit rate
curl http://localhost:8020/stats | jq '.cache_hit_rate'

# 4. Check circuit breaker states
curl http://localhost:8020/health | jq '.api_clients'

# 5. Sample recent enrichments
docker compose logs metadata-enrichment --tail=100 | grep -E "enrichment completed|enrichment failed"

# 6. Check DLQ for patterns
curl http://localhost:8024/dlq/errors/grouped | jq
```

### Resolution Steps

**Scenario A: Low Cache Hit Rate**

```bash
# 1. Check cache stats
docker compose exec redis redis-cli INFO stats | grep -E "hits|misses"

# 2. Warm cache with popular tracks
curl -X POST http://localhost:8020/admin/cache/warm

# 3. Increase cache TTL if appropriate
psql -h localhost -p 5433 -U musicdb_user -d musicdb << EOF
UPDATE metadata_enrichment_config
SET cache_ttl_hours = 336  -- 2 weeks
WHERE cache_ttl_hours < 336;
EOF

curl -X POST http://localhost:8020/admin/config/reload

# 4. Monitor cache hit rate improvement
watch -n 60 'curl -s http://localhost:8020/stats | jq ".cache_hit_rate"'
```

**Scenario B: One Provider Underperforming**

```bash
# 1. Identify underperforming provider
curl http://localhost:8020/stats/by-provider | jq

# Example output:
# {
#   "spotify": {"success_rate": 0.85},
#   "musicbrainz": {"success_rate": 0.45},  # Low!
#   "lastfm": {"success_rate": 0.80}
# }

# 2. Adjust provider priorities
psql -h localhost -p 5433 -U musicdb_user -d musicdb << EOF
UPDATE metadata_enrichment_config
SET priority_2_provider = 'lastfm',
    priority_3_provider = 'musicbrainz';
EOF

curl -X POST http://localhost:8020/admin/config/reload

# 3. Monitor success rate
watch -n 60 'curl -s http://localhost:8020/stats | jq ".success_rate"'
```

**Scenario C: Timeout Issues**

```bash
# 1. Check for timeout errors
docker compose logs api-gateway-internal --tail=200 | grep -i timeout

# 2. Increase timeout
psql -h localhost -p 5433 -U musicdb_user -d musicdb << EOF
UPDATE metadata_enrichment_config
SET timeout_seconds = 45
WHERE timeout_seconds < 45;
EOF

curl -X POST http://localhost:8020/admin/config/reload

# 3. Monitor improvement
watch -n 60 'curl -s http://localhost:8020/stats | jq ".success_rate"'
```

### Verification

```bash
# Success rate > 70%
curl http://localhost:8020/stats | jq .success_rate

# Cache hit rate improving
curl http://localhost:8020/stats | jq .cache_hit_rate

# No circuit breakers open
curl http://localhost:8020/health | jq '.api_clients'
```

---

## Runbook: Data Quality Issues

**Alert Name:** `DataQualityScoreLow`
**Severity:** P2
**Threshold:** Quality score < 70 for > 1 hour
**Impact:** Inaccurate or incomplete data

### Investigation Steps

```bash
# 1. Check data quality metrics
psql -h localhost -p 5433 -U musicdb_user -d musicdb << EOF
SELECT
    quality_tier,
    COUNT(*) as track_count,
    ROUND(AVG(quality_score), 2) as avg_quality
FROM data_quality_scores
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY quality_tier
ORDER BY quality_tier;
EOF

# 2. Identify common quality issues
psql -h localhost -p 5433 -U musicdb_user -d musicdb << EOF
SELECT
    validation_errors,
    COUNT(*) as occurrence_count
FROM data_quality_scores
WHERE quality_score < 70
  AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY validation_errors
ORDER BY occurrence_count DESC
LIMIT 10;
EOF

# 3. Sample low-quality tracks
psql -h localhost -p 5433 -U musicdb_user -d musicdb << EOF
SELECT
    t.track_id,
    t.artist_name,
    t.track_name,
    dq.quality_score,
    dq.validation_errors
FROM tracks t
JOIN data_quality_scores dq ON t.track_id = dq.track_id
WHERE dq.quality_score < 50
  AND dq.created_at > NOW() - INTERVAL '24 hours'
LIMIT 20;
EOF

# 4. Check enrichment audit trail
psql -h localhost -p 5433 -U musicdb_user -d musicdb << EOF
SELECT
    sources_used,
    COUNT(*) as count,
    ROUND(AVG(quality_score), 2) as avg_quality
FROM enrichment_audit
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY sources_used
ORDER BY avg_quality DESC;
EOF
```

### Resolution Steps

**Scenario A: Missing Required Fields**

```bash
# 1. Identify missing fields
psql -h localhost -p 5433 -U musicdb_user -d musicdb << EOF
SELECT
    COUNT(*) as total_tracks,
    SUM(CASE WHEN spotify_id IS NULL THEN 1 ELSE 0 END) as missing_spotify_id,
    SUM(CASE WHEN isrc IS NULL THEN 1 ELSE 0 END) as missing_isrc,
    SUM(CASE WHEN bpm IS NULL THEN 1 ELSE 0 END) as missing_bpm,
    SUM(CASE WHEN key IS NULL THEN 1 ELSE 0 END) as missing_key
FROM tracks
WHERE created_at > NOW() - INTERVAL '24 hours';
EOF

# 2. Re-enrich tracks with missing critical fields
psql -h localhost -p 5433 -U musicdb_user -d musicdb << EOF
SELECT track_id, artist_name, track_name
FROM tracks
WHERE spotify_id IS NULL
  AND created_at > NOW() - INTERVAL '24 hours'
LIMIT 100;
EOF

# Trigger re-enrichment via API
# (Requires batch enrichment endpoint)
```

**Scenario B: Incorrect Data**

```bash
# 1. Identify validation errors
psql -h localhost -p 5433 -U musicdb_user -d musicdb << EOF
SELECT validation_errors, COUNT(*)
FROM data_quality_scores
WHERE validation_errors IS NOT NULL
  AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY validation_errors
ORDER BY COUNT(*) DESC;
EOF

# 2. If common pattern, fix validation logic
# (Requires code change - escalate)

# 3. Purge bad data if necessary
# (Get approval first - data loss)
```

### Verification

```bash
# Quality score improved
psql -h localhost -p 5433 -U musicdb_user -d musicdb << EOF
SELECT
    ROUND(AVG(quality_score), 2) as avg_quality
FROM data_quality_scores
WHERE created_at > NOW() - INTERVAL '1 hour';
EOF

# Should be > 70
```

---

## Runbook: Database Connection Pool Exhaustion

**Alert Name:** `DatabaseConnectionPoolHigh`
**Severity:** P1
**Threshold:** Pool usage > 80%
**Impact:** Service degradation, potential outages

### Investigation Steps

```bash
# 1. Check current pool usage
docker compose logs rest-api --tail=50 | grep -i "pool"

# 2. Check active connections
psql -h localhost -p 5433 -U musicdb_user -d musicdb << EOF
SELECT
    pid,
    usename,
    application_name,
    state,
    query_start,
    LEFT(query, 50) as query
FROM pg_stat_activity
WHERE datname = 'musicdb'
  AND state != 'idle'
ORDER BY query_start;
EOF

# 3. Count connections by service
psql -h localhost -p 5433 -U musicdb_user -d musicdb << EOF
SELECT
    application_name,
    state,
    COUNT(*) as connection_count
FROM pg_stat_activity
WHERE datname = 'musicdb'
GROUP BY application_name, state
ORDER BY connection_count DESC;
EOF

# 4. Check for long-running queries
psql -h localhost -p 5433 -U musicdb_user -d musicdb << EOF
SELECT
    pid,
    NOW() - query_start AS duration,
    query
FROM pg_stat_activity
WHERE state != 'idle'
  AND NOW() - query_start > INTERVAL '30 seconds'
ORDER BY duration DESC;
EOF
```

### Resolution Steps

**Scenario A: Long-Running Queries**

```bash
# 1. Identify blocking queries
psql -h localhost -p 5433 -U musicdb_user -d musicdb << EOF
SELECT pid, query_start, query
FROM pg_stat_activity
WHERE state != 'idle'
  AND NOW() - query_start > INTERVAL '5 minutes';
EOF

# 2. Kill long-running queries (get approval first)
psql -h localhost -p 5433 -U musicdb_user -d musicdb << EOF
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state != 'idle'
  AND NOW() - query_start > INTERVAL '10 minutes';
EOF

# 3. Verify pool usage decreased
# Check application logs
```

**Scenario B: Connection Leak**

```bash
# 1. Restart services to release connections
docker compose restart rest-api graph-api

# 2. Monitor pool usage
watch -n 30 'docker compose logs rest-api --tail=10 | grep pool'

# 3. If leak persists, investigate code
# (Escalate to engineering)
```

**Scenario C: Need More Connections**

```bash
# 1. Temporarily increase pool size
# Edit service environment variables
# POSTGRES_POOL_SIZE=20 (from 10)
# POSTGRES_MAX_OVERFLOW=40 (from 20)

docker compose restart rest-api graph-api

# 2. Monitor
watch -n 30 'docker compose logs rest-api --tail=10 | grep pool'
```

### Verification

```bash
# Pool usage < 80%
# Check application metrics

# No idle connections
psql -h localhost -p 5433 -U musicdb_user -d musicdb << EOF
SELECT COUNT(*)
FROM pg_stat_activity
WHERE datname = 'musicdb'
  AND state = 'idle'
  AND NOW() - state_change > INTERVAL '1 hour';
EOF

# Should be 0 or very low
```

---

## Runbook: Disk Space Critical

**Alert Name:** `DiskSpaceHigh`
**Severity:** P1
**Threshold:** Disk usage > 85%
**Impact:** System instability, database crashes

### Investigation Steps

```bash
# 1. Check disk usage
df -h

# 2. Identify large directories
du -sh /var/lib/docker/* | sort -h | tail -10

# 3. Check Docker disk usage
docker system df

# 4. Check log sizes
du -sh /var/lib/docker/containers/*/*-json.log | sort -h | tail -10
```

### Resolution Steps

```bash
# STEP 1: Stop non-critical services
docker compose stop scraper-mixesdb scraper-1001tracklists

# STEP 2: Clean Docker cache
docker system prune -f

# STEP 3: Truncate large logs
truncate -s 100M /var/lib/docker/containers/*/*-json.log

# STEP 4: Remove old backups
find /backups/postgres -name "*.sql.gz" -mtime +7 -delete

# STEP 5: Verify space recovered
df -h

# STEP 6: Restart services
docker compose up -d

# STEP 7: Implement log rotation (permanent fix)
# Edit /etc/docker/daemon.json
cat > /etc/docker/daemon.json << EOF
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
EOF

systemctl restart docker
docker compose up -d
```

### Verification

```bash
# Disk usage < 80%
df -h

# Docker logs configured with rotation
docker inspect rest-api | jq '.[0].HostConfig.LogConfig'
```

---

## Runbook: Memory Exhaustion

**Alert Name:** `MemoryUsageHigh`
**Severity:** P1
**Threshold:** Memory usage > 90%
**Impact:** OOM kills, service crashes

### Investigation Steps

```bash
# 1. Check system memory
free -h

# 2. Identify memory hogs
docker stats --no-stream | sort -k4 -h

# 3. Check for memory leaks
docker compose logs rest-api --tail=200 | grep -i "memory\|oom"
```

### Resolution Steps

```bash
# 1. Restart heavy services
docker compose restart rest-api metadata-enrichment

# 2. Reduce worker count if needed
# Edit docker-compose.enrichment-workers.yml
# Reduce replicas: 2 → 1

docker compose -f docker-compose.yml \
  -f docker-compose.enrichment-workers.yml up -d

# 3. Clear Redis cache if large
docker compose exec redis redis-cli FLUSHDB

# 4. Monitor memory
watch -n 30 'free -h'
```

### Verification

```bash
# Memory usage < 85%
free -h

# No OOM events
dmesg | grep -i "oom"
```

---

## Runbook: Scraper Stalled

**Alert Name:** `ScraperStalled`
**Severity:** P2
**Threshold:** No new tracks for > 2 hours
**Impact:** No new data ingestion

### Investigation Steps

```bash
# 1. Check scraper status
docker compose ps | grep scraper

# 2. Check logs for errors
docker compose logs scraper-mixesdb --tail=100

# 3. Check if spider is running
docker compose exec scraper-mixesdb pgrep -af python

# 4. Check last scrape time
psql -h localhost -p 5433 -U musicdb_user -d musicdb << EOF
SELECT MAX(created_at) as last_track_created
FROM tracks;
EOF
```

### Resolution Steps

```bash
# 1. Restart scraper
docker compose restart scraper-mixesdb

# 2. Monitor for activity
docker compose logs scraper-mixesdb -f

# 3. If still stalled, check target site
curl -I https://www.1001tracklists.com

# 4. If site is up, may need to update spider
# (Escalate to engineering)
```

---

## Runbook: API Gateway High Error Rate

**Alert Name:** `APIGatewayErrorRateHigh`
**Severity:** P1
**Threshold:** Error rate > 10%
**Impact:** Enrichment failures

### Investigation Steps

```bash
# 1. Check error rate
curl http://localhost:8022/metrics | grep error_rate

# 2. Check circuit breakers
curl http://localhost:8020/health | jq '.api_clients'

# 3. Check logs
docker compose logs api-gateway-internal --tail=200 | grep -i error

# 4. Check external APIs
curl -I https://api.spotify.com/v1/search
curl -I https://musicbrainz.org/ws/2/
```

### Resolution Steps

```bash
# Follow Circuit Breaker Storm runbook
# See above
```

---

## Related Documentation

- [Emergency Response Playbook](EMERGENCY_RESPONSE.md)
- [Rollback Procedures](ROLLBACK_PROCEDURES.md)
- [Disaster Recovery Plan](DISASTER_RECOVERY.md)
- [Monitoring & Observability Guide](monitoring-observability-guide.md)
