# Browser Collector - Production Deployment Guide

## ✅ Production Status: READY FOR DEPLOYMENT

**Last Updated:** 2025-10-01
**Version:** 1.0.0 (Production-Hardened)
**Status:** All critical production requirements implemented and tested

---

## Quick Start

### Deploy to Production

```bash
# 1. Build with latest production hardening
docker compose build browser-collector

# 2. Deploy service
docker compose up -d browser-collector

# 3. Verify health
curl http://localhost:8030/health | jq
```

### Expected Output

```json
{
  "status": "healthy",
  "service": "browser-collector",
  "ollama": {
    "status": "healthy",
    "available_models": ["llama3.2:3b"]
  }
}
```

---

## Production Features Implemented

### 1. Request Queuing ✅
- **Purpose:** Prevents memory exhaustion from too many concurrent browsers
- **Implementation:** asyncio.Semaphore limiting to 3 concurrent browsers
- **Configuration:** `MAX_CONCURRENT_BROWSERS` environment variable (default: 3)
- **Monitoring:** `queued_collections` Prometheus metric

**Why this matters:** Each browser instance uses ~500MB RAM. Without queuing, 5+ concurrent requests would exceed the 2GB container limit and crash the service.

### 2. Collection Timeout ✅
- **Purpose:** Prevents hung requests from blocking resources indefinitely
- **Implementation:** asyncio.timeout() wrapper on all collection operations
- **Configuration:** `COLLECTION_TIMEOUT_SECONDS` environment variable (default: 300)
- **Response:** Returns HTTP 504 Gateway Timeout on expiration

**Why this matters:** Websites can hang due to slow loading, infinite redirects, or JavaScript errors. Without timeouts, these would block browser slots forever.

### 3. Screenshot Cleanup ✅
- **Purpose:** Prevents disk exhaustion from accumulating screenshots
- **Implementation:** Automated cron job running daily at 2 AM
- **Configuration:** `SCREENSHOT_RETENTION_DAYS` environment variable (default: 7)
- **Logging:** Results written to `/var/log/screenshot_cleanup.log`

**Why this matters:** Screenshots average 200KB each. At 1,000 collections/day, this is 200MB/day or 6GB/month without cleanup.

### 4. Monitoring & Alerts ✅
- **Purpose:** Early detection of performance degradation and failures
- **Implementation:** 9 comprehensive Prometheus alert rules
- **Coverage:** Memory, queue depth, failure rates, performance, availability
- **File:** `prometheus-alerts.yml`

**Alert levels:**
- **Critical:** Service down, critical memory usage (>95%)
- **Warning:** High memory (>90%), high failure rates, slow performance
- **Info:** At capacity, no recent activity

### 5. Resource Limits ✅
- **Purpose:** Prevents runaway resource consumption
- **Memory Limit:** 2GB (configured in docker-compose.yml)
- **CPU Limit:** 2.0 cores
- **Memory Reservation:** 1GB guaranteed
- **Auto-restart:** Enabled on failure

### 6. Health Checks ✅
- **Purpose:** Enable container orchestration and load balancer monitoring
- **Interval:** 30 seconds
- **Timeout:** 10 seconds
- **Start Period:** 60 seconds (grace period for startup)
- **Endpoint:** `/health`

---

## Configuration Reference

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MAX_CONCURRENT_BROWSERS` | 3 | Maximum simultaneous browser instances |
| `COLLECTION_TIMEOUT_SECONDS` | 300 | Timeout for collection operations (5 min) |
| `SCREENSHOT_RETENTION_DAYS` | 7 | Days to keep screenshots before deletion |
| `OLLAMA_URL` | http://ollama:11434 | Ollama LLM service URL |
| `DATABASE_URL` | (auto-configured) | PostgreSQL connection string |

### Production Tuning

**For high-volume production (5000+ collections/day):**

```yaml
# docker-compose.yml
environment:
  MAX_CONCURRENT_BROWSERS: 5  # Increase if you have >3GB RAM available
  COLLECTION_TIMEOUT_SECONDS: 180  # Reduce for faster failure detection
  SCREENSHOT_RETENTION_DAYS: 3  # Reduce if disk space is limited
```

**For low-volume staging (100-500 collections/day):**

```yaml
environment:
  MAX_CONCURRENT_BROWSERS: 2  # Reduce to save memory
  COLLECTION_TIMEOUT_SECONDS: 600  # Increase for patient collection
  SCREENSHOT_RETENTION_DAYS: 14  # Increase for longer debugging window
```

---

## Prometheus Integration

### Load Alert Rules

**Option 1: Docker Compose Volume Mount**

```yaml
# Add to prometheus service in docker-compose.yml
prometheus:
  volumes:
    - ./services/browser-collector/prometheus-alerts.yml:/etc/prometheus/browser-collector-alerts.yml:ro
```

**Option 2: Copy to Prometheus Config Directory**

```bash
# Copy alert rules
cp services/browser-collector/prometheus-alerts.yml /path/to/prometheus/alerts/

# Update prometheus.yml
rule_files:
  - "/etc/prometheus/alerts/browser-collector-alerts.yml"

# Reload Prometheus
curl -X POST http://localhost:9090/-/reload
```

### Verify Alerts Loaded

```bash
# Check Prometheus web UI
open http://localhost:9091/alerts

# Or via API
curl http://localhost:9091/api/v1/rules | jq '.data.groups[] | select(.name=="browser_collector_alerts")'
```

---

## Monitoring Dashboard

### Key Metrics to Watch

| Metric | Warning Threshold | Critical Threshold |
|--------|------------------|-------------------|
| Memory Usage | >1.8GB (90%) | >1.9GB (95%) |
| Queue Depth | >10 waiting | >20 waiting |
| Failure Rate | >20% | >50% |
| Collection Duration (p95) | >2 minutes | >5 minutes |
| Active Collections | 3 (at capacity) | N/A |

### Grafana Dashboard Panels

**Recommended panels for visualization:**

1. **Active Collections** (Gauge) - `active_collections`
2. **Queue Depth** (Graph) - `queued_collections`
3. **Memory Usage** (Graph) - `container_memory_usage_bytes{container="browser-collector"}`
4. **Collection Success Rate** (Graph) - `rate(collection_tasks_total{status="success"}[5m])`
5. **Collection Duration** (Heatmap) - `collection_duration_seconds_bucket`
6. **Extraction Success Rate** (Graph) - `rate(extraction_tasks_total{status="success"}[5m])`

---

## API Usage Examples

### Basic Collection

```bash
curl -X POST http://localhost:8030/collect \
  -H "Content-Type: application/json" \
  -d '{
    "session_name": "production_test_1",
    "collector_type": "tracklist_finder",
    "target_url": "https://www.example.com",
    "extraction_type": "tracklist",
    "browser_config": {
      "headless": true,
      "browser_type": "chromium"
    },
    "collect_screenshots": false,
    "auto_extract": true
  }'
```

### Production-Optimized Collection

```bash
# Disable screenshots, use headless, faster timeout
curl -X POST http://localhost:8030/collect \
  -H "Content-Type: application/json" \
  -d '{
    "session_name": "production_collection",
    "collector_type": "music_discovery",
    "target_url": "https://www.1001tracklists.com/tracklist/...",
    "extraction_type": "tracklist",
    "browser_config": {
      "headless": true,
      "browser_type": "chromium",
      "viewport_width": 1920,
      "viewport_height": 1080
    },
    "collect_screenshots": false,
    "auto_extract": true,
    "ollama_model": "llama3.2:3b"
  }'
```

### With Navigation Steps

```bash
curl -X POST http://localhost:8030/collect \
  -H "Content-Type: application/json" \
  -d '{
    "session_name": "search_collection",
    "collector_type": "artist_info",
    "target_url": "https://www.discogs.com",
    "navigation_steps": [
      {
        "type": "wait_for_selector",
        "selector": "input[name=\"q\"]",
        "timeout_ms": 10000
      },
      {
        "type": "type",
        "selector": "input[name=\"q\"]",
        "text": "Daft Punk",
        "clear": true
      },
      {
        "type": "click",
        "selector": "button[type=\"submit\"]"
      },
      {
        "type": "wait",
        "duration_ms": 2000
      }
    ],
    "extraction_type": "artist",
    "browser_config": {"headless": true},
    "collect_screenshots": false,
    "auto_extract": true
  }'
```

---

## Operational Procedures

### Daily Operations

**Morning Health Check:**
```bash
# Verify service health
curl http://localhost:8030/health | jq

# Check recent collections
docker compose exec browser-collector sh -c "
  psql \$DATABASE_URL -c 'SELECT COUNT(*), status FROM collection_sessions WHERE started_at > NOW() - INTERVAL '\''24 hours'\'' GROUP BY status;'
"

# Check cron logs
docker compose exec browser-collector tail -20 /var/log/screenshot_cleanup.log
```

**Monitor Queue Depth:**
```bash
# If queue depth is consistently high, consider scaling
curl -s http://localhost:8030/metrics | grep queued_collections
```

### Weekly Maintenance

```bash
# Review failure patterns
docker compose exec browser-collector sh -c "
  psql \$DATABASE_URL -c 'SELECT last_error, COUNT(*) FROM collection_sessions WHERE status='\''failed'\'' AND started_at > NOW() - INTERVAL '\''7 days'\'' GROUP BY last_error ORDER BY count DESC LIMIT 10;'
"

# Check screenshot cleanup effectiveness
docker compose exec browser-collector sh -c "
  echo 'Screenshot count:' && find /app/screenshots -name '*.png' | wc -l &&
  echo 'Total size:' && du -sh /app/screenshots
"
```

### Troubleshooting

**Service Not Starting:**
```bash
# Check logs
docker compose logs browser-collector

# Verify dependencies
docker compose ps postgres redis ollama

# Check resource limits
docker stats browser-collector
```

**High Memory Usage:**
```bash
# Check active collections
curl http://localhost:8030/metrics | grep active_collections

# Restart if memory critical
docker compose restart browser-collector
```

**Collections Timing Out:**
```bash
# Check timeout setting
docker compose exec browser-collector printenv COLLECTION_TIMEOUT_SECONDS

# Increase if needed (edit docker-compose.yml)
environment:
  COLLECTION_TIMEOUT_SECONDS: 600  # 10 minutes
```

**Queue Backing Up:**
```bash
# Check queue depth
curl http://localhost:8030/metrics | grep queued_collections

# Increase browser slots (if you have RAM available)
# Edit docker-compose.yml:
environment:
  MAX_CONCURRENT_BROWSERS: 5

# Then restart
docker compose restart browser-collector
```

---

## Deployment Checklist

### Pre-Deployment

- [ ] Environment variables configured in `.env`
- [ ] Prometheus alert rules copied to Prometheus server
- [ ] Grafana dashboard configured (optional)
- [ ] Database backup completed
- [ ] Resource limits appropriate for environment

### Deployment

- [ ] Build service: `docker compose build browser-collector`
- [ ] Deploy service: `docker compose up -d browser-collector`
- [ ] Verify health: `curl http://localhost:8030/health`
- [ ] Verify cron: `docker compose logs browser-collector | grep cron`
- [ ] Test collection: Send test request to `/collect`

### Post-Deployment (Week 1)

- [ ] Monitor Prometheus metrics daily
- [ ] Review collection success/failure rates
- [ ] Check memory usage trends
- [ ] Verify screenshot cleanup running
- [ ] Tune timeouts and limits based on real traffic
- [ ] Document any issues encountered

### Production Validation

- [ ] Service survives >3 concurrent requests
- [ ] Timeouts trigger correctly after configured duration
- [ ] Screenshot cleanup runs and logs successfully
- [ ] Prometheus alerts firing correctly
- [ ] Health checks passing consistently
- [ ] No memory leaks after 7 days of operation

---

## Scaling Strategies

### Horizontal Scaling

**Current limitations:**
- Screenshot storage is local (not shared across instances)
- No built-in load balancing

**Scaling approach:**
```bash
# Run multiple instances on different ports
docker compose up -d --scale browser-collector=3

# Or use separate compose files
docker compose -f docker-compose.yml -f docker-compose.scale.yml up -d
```

**Add load balancer:**
- Use nginx or HAProxy to distribute requests
- Configure health checks on `/health` endpoint
- Use round-robin or least-connections algorithm

### Vertical Scaling

**If experiencing high queue depth:**

1. Increase `MAX_CONCURRENT_BROWSERS` (requires more RAM)
2. Increase memory limit in docker-compose.yml
3. Monitor memory usage closely

```yaml
browser-collector:
  environment:
    MAX_CONCURRENT_BROWSERS: 7  # Up from 3
  deploy:
    resources:
      limits:
        memory: 4G  # Up from 2G
        cpus: '4.0'  # Up from 2.0
      reservations:
        memory: 2G
        cpus: '2.0'
```

---

## Future Enhancements

**Planned for Week 1-2 after deployment:**

1. **Retry Logic** - Exponential backoff for transient failures
2. **Orchestrator Integration** - Seamless fallback from traditional scrapers
3. **Rate Limiting** - Per-IP/user request throttling
4. **Grafana Dashboard** - Pre-built visualization template

**Planned for Month 2:**

5. **Shared Screenshot Storage** - S3 or network volume for horizontal scaling
6. **Advanced Analytics** - Collection success patterns and optimization
7. **Proxy Rotation** - Integration with existing proxy infrastructure
8. **Custom Extraction Templates** - User-defined Ollama prompts

---

## Support & Contact

**Documentation:**
- Production Readiness: `PRODUCTION_READINESS.md`
- Architecture: `ARCHITECTURE.md`
- API Reference: `README.md`

**Monitoring:**
- Prometheus: http://localhost:9091
- Grafana: http://localhost:3001
- Service Health: http://localhost:8030/health
- Service Metrics: http://localhost:8030/metrics

**Emergency Procedures:**
- Service crash: Auto-restart enabled via docker-compose
- High memory: Check Prometheus alerts, restart if needed
- Queue overflow: Increase MAX_CONCURRENT_BROWSERS or add instances
- Ollama unavailable: Service continues, but extractions fail gracefully

---

## Version History

### v1.0.0 (2025-10-01) - Production Ready
- ✅ Request queuing implemented
- ✅ Collection timeout enforcement
- ✅ Automated screenshot cleanup
- ✅ Comprehensive monitoring alerts
- ✅ Production testing completed
- ✅ Documentation finalized

**Status:** Ready for production deployment
