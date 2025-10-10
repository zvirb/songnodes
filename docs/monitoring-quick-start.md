# SongNodes Enrichment Monitoring: Quick Start Guide

## 🚀 Fast Access

### Dashboards

| Service | URL | Credentials |
|---------|-----|-------------|
| **Grafana** | http://localhost:3001 | admin / admin |
| **Prometheus** | http://localhost:9091 | None |
| **Alertmanager** | http://localhost:9093 | None |

### Key Dashboards in Grafana

1. **Enrichment Pipeline** - Main enrichment overview
2. **DLQ Monitoring** - Dead-letter queue management
3. **API Gateway** - Circuit breakers and rate limiting
4. **Infrastructure Overview** - System health

## ⚡ Quick Health Checks

### Is Everything Running?

```bash
# Check all services
docker compose ps

# View logs
docker compose logs -f metadata-enrichment api-gateway-internal dlq-manager
```

### Current Enrichment Status

**Grafana**: Go to Enrichment Pipeline dashboard

Key metrics to check:
- ✅ **Success Rate**: Should be > 85%
- ✅ **Cache Hit Rate**: Should be > 60%
- ✅ **DLQ Depth**: Should be < 50
- ✅ **Circuit Breakers**: All CLOSED (green)

### Quick Prometheus Queries

```promql
# Success rate (last 5 minutes)
(sum(rate(enrichment_api_calls_total{status="success"}[5m])) / sum(rate(enrichment_api_calls_total[5m]))) * 100

# Current DLQ depth
dlq_messages_total

# Circuit breaker states (0=CLOSED/good, 2=OPEN/bad)
api_gateway_circuit_breaker_state

# Data quality score
medallion_data_quality_score{layer="silver"}
```

## 🔍 Common Troubleshooting

### Problem: High Error Rate

**Check**:
1. Grafana → Enrichment Pipeline → API Error Rate panel
2. Identify which provider is failing
3. Check circuit breaker state for that provider

**Quick Fix**:
```bash
# Check provider health
curl http://localhost:8100/health

# Restart enrichment service
docker compose restart metadata-enrichment

# View error logs
docker compose logs --tail=100 api-gateway-internal | grep ERROR
```

### Problem: DLQ Filling Up

**Check**:
1. Grafana → DLQ Monitoring → Error Types Breakdown
2. See which error type is most common

**Quick Fix**:
```bash
# View DLQ errors
curl http://localhost:8024/dlq/stats

# If authentication errors, check credentials:
docker compose exec postgres psql -U musicdb_user -d musicdb -c \
  "SELECT provider, key_type, is_valid FROM api_keys;"

# After fixing, replay messages
curl -X POST http://localhost:8024/dlq/replay?queue=enrichment.dlq.queue
```

### Problem: Slow Enrichment

**Check**:
1. Grafana → Enrichment Pipeline → API Latency (p95) panel
2. Identify slow provider

**Quick Fix**:
```bash
# Check connection pool usage
curl http://localhost:8100/metrics | grep db_pool

# Check Redis memory
curl http://localhost:8100/metrics | grep redis_memory

# Scale if needed (increase replicas in docker-compose.yml)
```

## 📊 Loki Log Queries

Access: Grafana → Explore → Select "Loki" data source

### Useful Queries

**Recent errors**:
```logql
{service=~"metadata-enrichment|api-gateway-internal"}
| json
| level="error"
| line_format "{{.timestamp}} [{{.service}}] {{.message}}"
```

**DLQ failures**:
```logql
{service="dlq-manager"}
| json
| error_type!=""
| count_over_time($__interval) by (error_type)
```

**Circuit breaker events**:
```logql
{service="api-gateway-internal"}
| json
| circuit_breaker_state!=""
| line_format "{{.timestamp}} {{.provider}}: {{.circuit_breaker_state}}"
```

**Track specific enrichment**:
```logql
{service="metadata-enrichment"}
| json
| track_id="12345"
```

## 🚨 Active Alerts

**View in Alertmanager**: http://localhost:9093

**Silence an alert**:
1. Go to Alertmanager UI
2. Find alert
3. Click "Silence"
4. Set duration and reason
5. Click "Create"

**Common alerts and what they mean**:

| Alert | Meaning | Action |
|-------|---------|--------|
| `CircuitBreakerOpen` | Provider API is being blocked | Wait 5-10min for auto-recovery, or check provider status |
| `DLQDepthHigh` | Failed enrichments accumulating | Review error patterns, fix root cause |
| `EnrichmentSuccessRateLow` | Overall enrichment degraded | Check all provider health, review logs |
| `WaterfallFallbackRateHigh` | Primary provider failing frequently | Investigate primary provider health |

## 🔧 Service Management

### Restart Services

```bash
# Individual service
docker compose restart metadata-enrichment

# All enrichment services
docker compose restart metadata-enrichment api-gateway-internal dlq-manager

# View startup logs
docker compose logs -f metadata-enrichment
```

### Reload Configuration (No Downtime)

```bash
# Reload enrichment config
curl -X POST http://localhost:8020/admin/reload-config

# Reload API gateway config
curl -X POST http://localhost:8100/admin/reload-config
```

### Manual Operations

**Trigger enrichment for specific track**:
```bash
curl -X POST http://localhost:8020/enrich \
  -H "Content-Type: application/json" \
  -d '{"track_id": 12345}'
```

**Replay DLQ messages**:
```bash
# All messages
curl -X POST http://localhost:8024/dlq/replay?queue=enrichment.dlq.queue

# Specific error type only
curl -X POST http://localhost:8024/dlq/replay \
  -H "Content-Type: application/json" \
  -d '{"queue": "enrichment.dlq.queue", "error_type": "rate_limit"}'
```

**Clear cache**:
```bash
# Redis CLI
docker compose exec redis redis-cli -a $REDIS_PASSWORD

# In redis-cli:
FLUSHDB  # Clear current database
# or
DEL enrichment:cache:*  # Clear only enrichment cache
```

## 📈 Performance Metrics Targets

| Metric | Target | Warning | Critical |
|--------|--------|---------|----------|
| Success Rate | > 90% | < 85% | < 70% |
| Cache Hit Rate | > 70% | < 60% | < 30% |
| DLQ Depth | < 20 | > 100 | > 500 |
| Bronze→Silver Lag | < 30min | > 1hr | > 4hr |
| Data Quality Score | > 0.8 | < 0.7 | < 0.6 |
| API P95 Latency | < 2s | > 5s | > 10s |

## 🎯 Daily Health Check Checklist

**Morning routine** (5 minutes):

- [ ] Check Grafana "Enrichment Pipeline" dashboard
- [ ] Verify success rate > 85%
- [ ] Confirm DLQ depth < 50
- [ ] Check all circuit breakers are CLOSED
- [ ] Review any active alerts in Alertmanager
- [ ] Scan error logs for new patterns

**If all green**: ✅ System healthy, no action needed

**If any red**: ⚠️  Investigate using relevant section above

## 📚 Further Reading

- **Full Documentation**: `/mnt/my_external_drive/programming/songnodes/docs/monitoring-observability-guide.md`
- **DLQ System**: `/mnt/my_external_drive/programming/songnodes/docs/dlq-system.md`
- **Loki Queries**: `/mnt/my_external_drive/programming/songnodes/observability/loki-saved-queries.yaml`
- **Alert Rules**: `/mnt/my_external_drive/programming/songnodes/monitoring/prometheus/alerts/enrichment-alerts.yml`

## 🆘 Emergency Contacts

**Critical Issues**:
- DLQ depth > 500: dlq-team@songnodes.local
- Circuit breaker flapping: api-team@songnodes.local
- Data quality < 60%: data-quality-team@songnodes.local

**Escalation**: If issue persists > 1 hour, create incident ticket with:
- Dashboard screenshot
- Alert details
- Relevant log snippets
- Steps already attempted

---

**Quick Tip**: Bookmark these URLs in your browser:
- http://localhost:3001/d/enrichment-pipeline
- http://localhost:9093 (Alertmanager)
- http://localhost:3001/explore (Loki logs)
