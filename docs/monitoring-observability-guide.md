# SongNodes Enrichment Infrastructure: Monitoring & Observability Guide

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Accessing Dashboards](#accessing-dashboards)
4. [Key Metrics](#key-metrics)
5. [Alert Rules](#alert-rules)
6. [Troubleshooting Workflows](#troubleshooting-workflows)
7. [Performance Optimization](#performance-optimization)
8. [Runbook Index](#runbook-index)

---

## Overview

This guide provides comprehensive documentation for monitoring the SongNodes enrichment infrastructure, including:

- **Medallion Architecture** (Bronze/Silver/Gold data layers)
- **Dead-Letter Queue (DLQ)** management
- **API Integration Gateway** with circuit breakers and rate limiting
- **Configuration-driven waterfall enrichment**

### Monitoring Stack

- **Prometheus**: Metrics collection and alerting
- **Grafana**: Visualization dashboards
- **Loki**: Log aggregation and querying
- **Tempo**: Distributed tracing
- **Alertmanager**: Alert routing and notification

---

## Architecture

### Components Under Monitoring

```
┌─────────────────────────────────────────────────────────────┐
│                    Enrichment Pipeline                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Bronze Layer (Raw Data)                                     │
│      ↓                                                       │
│  Waterfall Enrichment ──→ API Gateway ──→ External APIs    │
│      ↓                         │                             │
│  Silver Layer (Enriched)       └──→ DLQ (failures)          │
│      ↓                                                       │
│  Gold Layer (Analytics)                                      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow Monitoring Points

1. **Bronze Ingestion**: Raw data from scrapers
2. **Enrichment Processing**: Waterfall API calls
3. **Circuit Breaker & Rate Limiting**: Resilience patterns
4. **DLQ Publishing**: Failed enrichments
5. **Silver Promotion**: Quality-checked enriched data
6. **Gold Materialization**: Analytics aggregates

---

## Accessing Dashboards

### Grafana Dashboards

Access Grafana at: **http://localhost:3001**

Default credentials (development):
- Username: `admin`
- Password: `admin`

### Available Dashboards

| Dashboard | URL | Purpose |
|-----------|-----|---------|
| **Enrichment Pipeline** | `/d/enrichment-pipeline` | Overview of enrichment operations, API calls, costs |
| **DLQ Monitoring** | `/d/dlq-monitoring` | Dead-letter queue depth, error types, replay status |
| **API Gateway** | `/d/api-gateway-dashboard` | Circuit breakers, rate limiters, provider health |
| **Infrastructure Overview** | `/d/infrastructure-overview` | System resources, database, Redis, RabbitMQ |

### Prometheus

Access Prometheus at: **http://localhost:9091**

Use for:
- Ad-hoc metric queries
- Alert rule validation
- Target health checks

### Alertmanager

Access Alertmanager at: **http://localhost:9093**

Use for:
- Active alert status
- Silencing alerts
- Alert routing verification

### Loki (Log Queries)

Access via Grafana Explore:
1. Go to Grafana → Explore
2. Select "Loki" data source
3. Use LogQL queries (see saved queries below)

---

## Key Metrics

### 1. Enrichment Success Metrics

#### Overall Success Rate
```promql
(sum(rate(enrichment_api_calls_total{status="success"}[5m])) /
 sum(rate(enrichment_api_calls_total[5m]))) * 100
```

**Target**: > 85%
**Alert**: < 70% for 15 minutes

#### Cache Hit Rate
```promql
(rate(enrichment_cache_hits_total[5m]) /
 (rate(enrichment_cache_hits_total[5m]) + rate(enrichment_cache_misses_total[5m]))) * 100
```

**Target**: > 60%
**Alert**: < 30% for 10 minutes

### 2. Medallion Architecture Metrics

#### Data Quality Score
```promql
medallion_data_quality_score{layer="silver"}
```

**Target**: > 0.7 (70%)
**Alert**: < 0.6 for 30 minutes

#### Bronze → Silver Lag (P95)
```promql
histogram_quantile(0.95,
  rate(medallion_bronze_to_silver_lag_seconds_bucket[10m])
)
```

**Target**: < 1 hour
**Alert**: > 1 hour for 15 minutes

#### Enrichment Completeness by Category
```promql
medallion_enrichment_completeness
```

**Target**: > 60% per category
**Alert**: < 40% for 30 minutes

### 3. API Gateway Resilience Metrics

#### Circuit Breaker State
```promql
api_gateway_circuit_breaker_state
```

**Values**:
- `0` = CLOSED (healthy)
- `1` = OPEN (blocking calls)
- `2` = HALF_OPEN (testing recovery)

**Alert**: State = 2 for > 5 minutes

#### Rate Limiter Token Availability
```promql
(api_gateway_rate_limiter_tokens_available /
 api_gateway_rate_limiter_capacity) * 100
```

**Target**: > 20%
**Info**: < 10% (informational)

#### Retry Rate
```promql
sum(rate(api_gateway_retry_attempts_total{attempt!="1"}[5m])) by (provider) /
sum(rate(api_gateway_retry_attempts_total[5m])) by (provider)
```

**Target**: < 10%
**Alert**: > 30% for 10 minutes

### 4. Dead-Letter Queue (DLQ) Metrics

#### DLQ Depth
```promql
dlq_messages_total
```

**Target**: < 50
**Warning**: > 100 for 10 minutes
**Critical**: > 500 for 5 minutes

#### DLQ Message Age (P99)
```promql
dlq_message_age_seconds{quantile="0.99"}
```

**Target**: < 1 hour
**Warning**: > 24 hours for 30 minutes

#### DLQ Replay Success Rate
```promql
rate(dlq_replay_total{status="success"}[10m]) /
rate(dlq_replay_total[10m])
```

**Target**: > 80%
**Alert**: < 50% for 15 minutes

### 5. Waterfall Enrichment Metrics

#### Provider Win Rate
```promql
sum(rate(waterfall_provider_wins_total[10m])) by (provider, field_name)
```

Use to identify:
- Which provider is most successful per field
- Provider degradation (sudden drops)

#### Fallback Frequency
```promql
sum(rate(waterfall_fallback_count_total[10m])) by (field_name) /
sum(rate(waterfall_provider_wins_total[10m])) by (field_name)
```

**Target**: < 20%
**Alert**: > 50% for 15 minutes (indicates primary provider issues)

#### Fields Enriched Per Run (Median)
```promql
histogram_quantile(0.50,
  rate(waterfall_fields_enriched_per_run_bucket[15m])
)
```

**Target**: > 15 fields
**Alert**: < 10 fields for 30 minutes

### 6. API Cost Tracking

#### Estimated Monthly Cost
```promql
sum(increase(enrichment_api_cost_estimate_usd[30d]))
```

**Budget**: $100/month
**Alert**: > $100 (warning)

#### Hourly Cost Trend
```promql
sum(increase(enrichment_api_cost_estimate_usd[1h])) by (provider)
```

Use to detect cost spikes and runaway enrichment jobs.

---

## Alert Rules

### Severity Levels

- **Critical**: Immediate action required, data pipeline severely impacted
- **Warning**: Action needed soon, degraded performance
- **Info**: Awareness only, no immediate action required

### Critical Alerts

#### 1. CircuitBreakerFlapping
**Trigger**: Circuit breaker changes state > 10 times in 15 minutes
**Impact**: Unstable API connection, enrichment failures
**Action**:
1. Check provider API status page
2. Review recent error patterns in Loki
3. Consider temporarily disabling provider

#### 2. DLQDepthCritical
**Trigger**: > 500 messages in DLQ for 5 minutes
**Impact**: Data pipeline severely degraded, data loss risk
**Action**:
1. Check error distribution: `{service="dlq-manager"} | json | error_type!=""`
2. Fix root cause (API credentials, provider downtime)
3. Replay messages after fix: `POST /dlq/replay?queue=enrichment.dlq`

#### 3. WaterfallProviderFailure
**Trigger**: Provider stopped enriching fields (was active 1h ago)
**Impact**: Specific fields not being enriched
**Action**:
1. Check provider health: `api_gateway_circuit_breaker_state{provider="X"}`
2. Verify API credentials in database
3. Review provider-specific logs

#### 4. EnrichmentCompletenessCritical
**Trigger**: < 40% of fields enriched for 30 minutes
**Impact**: Low data quality, analytics reliability affected
**Action**:
1. Check which providers are failing
2. Review waterfall configuration
3. Verify API rate limits not exhausted

### Warning Alerts

#### 1. BronzeToSilverLagHigh
**Trigger**: P95 lag > 1 hour for 15 minutes
**Impact**: Stale enriched data
**Action**:
1. Check enrichment worker health
2. Review API response times
3. Scale enrichment workers if needed

#### 2. WaterfallFallbackRateHigh
**Trigger**: > 50% fallback rate for 15 minutes
**Impact**: Degraded enrichment quality (using backup providers)
**Action**:
1. Identify affected field
2. Check primary provider health
3. Review waterfall configuration priority

#### 3. DLQDepthHigh
**Trigger**: > 100 messages for 10 minutes
**Impact**: Accumulating failed enrichments
**Action**:
1. Review error patterns
2. Identify transient vs permanent errors
3. Fix root cause before replaying

---

## Troubleshooting Workflows

### Workflow 1: High Error Rate Investigation

**Symptom**: `EnrichmentAPIHighErrorRate` alert firing

**Steps**:

1. **Identify Error Distribution**
   ```logql
   {service=~"api-gateway-internal|metadata-enrichment"}
   | json
   | status=~"error|failed"
   | count_over_time($__interval) by (provider, error_type)
   ```

2. **Check Circuit Breaker States**
   ```promql
   api_gateway_circuit_breaker_state
   ```
   - `2` (OPEN) = Provider is being blocked due to failures

3. **Review Recent Failures**
   ```logql
   {service="api-gateway-internal"}
   | json
   | provider="spotify"
   | status="error"
   | line_format "{{.timestamp}} Error: {{.error_type}} - {{.error_message}}"
   ```

4. **Check Provider API Status**
   - Spotify: https://developer.spotify.com/status
   - MusicBrainz: https://status.musicbrainz.org

5. **Verify Credentials**
   ```sql
   SELECT provider, key_type, is_valid
   FROM api_keys
   WHERE provider = 'spotify';
   ```

6. **Resolution**:
   - If transient: Wait for circuit breaker to recover
   - If credentials: Update in database, restart service
   - If rate limit: Reduce request rate in configuration

### Workflow 2: DLQ Backlog Cleanup

**Symptom**: `DLQDepthHigh` or `DLQDepthCritical` alert

**Steps**:

1. **Analyze Error Distribution**
   ```logql
   {service="dlq-manager"}
   | json
   | error_type!=""
   | count_over_time($__interval) by (error_type)
   ```

2. **Get Specific Failures**
   ```logql
   {service="dlq-manager"}
   | json
   | error_type="authentication_failed"
   | line_format "Track: {{.track_artist}} - {{.track_title}}\nError: {{.error_message}}"
   ```

3. **Fix Root Cause**:
   - Authentication errors → Update credentials
   - Rate limit errors → Adjust rate limiter config
   - 4xx errors → Check request format/data quality
   - 5xx errors → Wait for provider recovery

4. **Replay Messages** (after fix):
   ```bash
   # Replay all messages
   curl -X POST http://localhost:8024/dlq/replay?queue=enrichment.dlq.queue

   # Or replay specific error types
   curl -X POST http://localhost:8024/dlq/replay \
     -H "Content-Type: application/json" \
     -d '{"queue": "enrichment.dlq.queue", "error_type": "authentication_failed"}'
   ```

5. **Monitor Replay**:
   ```logql
   {service="dlq-manager"}
   |= "replay"
   | json
   | line_format "{{.timestamp}} Replay {{.replay_status}}: {{.message_id}}"
   ```

### Workflow 3: Slow Enrichment Investigation

**Symptom**: `EnrichmentAPIHighLatency` alert or slow dashboard

**Steps**:

1. **Check API Latency by Provider**
   ```promql
   histogram_quantile(0.95,
     sum(rate(enrichment_api_duration_seconds_bucket[5m])) by (le, provider)
   )
   ```

2. **Identify Slow Operations**
   ```logql
   {service="metadata-enrichment"}
   | json
   | duration > 5
   | line_format "{{.timestamp}} Slow ({{.duration}}s): {{.provider}} - {{.field_name}}"
   ```

3. **Check Database Connection Pool**
   ```promql
   db_pool_connections{state="in_use"} / db_pool_connections{state="total"}
   ```
   - If > 80%, pool is exhausted

4. **Review Redis Performance**
   ```promql
   redis_memory_usage_bytes / redis_memory_max_bytes
   ```

5. **Check External API Health**:
   - Use Tempo to trace full request: Grafana → Explore → Tempo
   - Search: `{service.name="api-gateway-internal" && span.duration > 5s}`

6. **Resolution**:
   - Increase connection pool size
   - Scale Redis if memory exhausted
   - Add caching for frequently-accessed data
   - Report to provider if their API is slow

### Workflow 4: Low Data Quality Resolution

**Symptom**: `SilverDataQualityLow` alert firing

**Steps**:

1. **Check Quality Score Distribution**
   ```promql
   medallion_data_quality_score{layer="silver"}
   ```

2. **Identify Missing Fields**
   ```promql
   medallion_enrichment_completeness
   ```
   - Shows completeness per field category

3. **Find Affected Tracks**
   ```sql
   SELECT artist, title, data_quality_score,
          ARRAY(
            SELECT field FROM (
              VALUES ('spotify_id'), ('bpm'), ('key'), ('release_date')
            ) f(field)
            WHERE jsonb_extract_path_text(enrichment_data, field) IS NULL
          ) as missing_fields
   FROM silver_enriched_tracks
   WHERE data_quality_score < 0.6
   ORDER BY data_quality_score ASC
   LIMIT 50;
   ```

4. **Check Provider Success Rates**
   ```promql
   sum(rate(waterfall_provider_wins_total[30m])) by (provider, field_name)
   ```

5. **Resolution**:
   - If specific provider failing → Check credentials/health
   - If all providers failing → Check track data quality (typos, special characters)
   - If consistent pattern → Update waterfall configuration

---

## Performance Optimization

### Caching Strategy

**Current TTLs**:
- Spotify track data: 24 hours
- MusicBrainz metadata: 7 days
- Beatport genre: 7 days

**Optimization**:
1. Monitor cache hit rate (target > 60%)
2. Increase TTL for stable data (e.g., ISRC codes never change)
3. Preload cache for popular artists

### Rate Limiting Configuration

**Current Limits** (`/mnt/my_external_drive/programming/songnodes/services/api-gateway-internal/config.yaml`):

```yaml
rate_limiters:
  spotify:
    requests_per_second: 10
    burst: 20
  musicbrainz:
    requests_per_second: 1
    burst: 2
```

**Tuning**:
- If `rate_limiter_tokens_available` consistently near 0: Reduce RPS
- If always near capacity: Increase RPS (check provider ToS first)

### Database Query Optimization

**Slow Query Detection**:
```sql
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
WHERE mean_exec_time > 1000  -- > 1 second
ORDER BY mean_exec_time DESC
LIMIT 10;
```

**Index Analysis**:
```sql
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0  -- Unused indexes
ORDER BY pg_relation_size(indexrelid) DESC;
```

---

## Runbook Index

### Quick Reference

| Alert | Runbook | Severity |
|-------|---------|----------|
| CircuitBreakerOpen | [circuit-breaker-open.md](#) | Warning |
| CircuitBreakerFlapping | [circuit-breaker-flapping.md](#) | Critical |
| DLQDepthHigh | [dlq-high-depth.md](#) | Warning |
| DLQDepthCritical | [dlq-critical-depth.md](#) | Critical |
| EnrichmentAPIHighErrorRate | [high-error-rate.md](#) | Warning |
| EnrichmentSuccessRateLow | [low-success-rate.md](#) | Warning |
| BronzeToSilverLagHigh | [medallion-lag.md](#) | Warning |
| SilverDataQualityLow | [low-data-quality.md](#) | Warning |
| WaterfallProviderFailure | [provider-failure.md](#) | Critical |
| EnrichmentConfigReloadFailed | [config-reload-failed.md](#) | Critical |

### Common Commands

**Restart Enrichment Service**:
```bash
docker compose restart metadata-enrichment
```

**Reload Configuration** (without restart):
```bash
curl -X POST http://localhost:8020/admin/reload-config
```

**Check Service Health**:
```bash
docker compose ps
docker compose logs -f metadata-enrichment
```

**Database Connection**:
```bash
docker compose exec postgres psql -U musicdb_user -d musicdb
```

**Manual Enrichment Trigger**:
```bash
curl -X POST http://localhost:8020/enrich \
  -H "Content-Type: application/json" \
  -d '{"track_id": 12345}'
```

---

## Advanced Topics

### Custom Metric Creation

Add custom metrics to `/mnt/my_external_drive/programming/songnodes/services/metadata-enrichment/medallion_metrics.py`:

```python
from prometheus_client import Counter

my_custom_metric = Counter(
    'my_custom_metric_total',
    'Description of what this counts',
    ['label1', 'label2']
)

# Increment in code
my_custom_metric.labels(label1='value1', label2='value2').inc()
```

### Log Correlation with Traces

Link logs to traces by adding trace ID:

```python
import logging
from opentelemetry import trace

logger = logging.getLogger(__name__)

span = trace.get_current_span()
trace_id = span.get_span_context().trace_id

logger.info("Enrichment started", extra={
    "trace_id": format(trace_id, '032x'),
    "track_id": track_id
})
```

Query in Loki:
```logql
{service="metadata-enrichment"}
| json
| trace_id="00000000000000001234567890abcdef"
```

Then view full trace in Tempo using the trace ID.

### Dashboard Customization

Create custom Grafana dashboards:

1. Grafana → Dashboards → New Dashboard
2. Add Panel → Select Prometheus data source
3. Enter PromQL query
4. Configure visualization type
5. Save dashboard

Export as JSON:
```bash
curl -H "Authorization: Bearer $API_KEY" \
  http://localhost:3001/api/dashboards/uid/$DASHBOARD_UID \
  > my-custom-dashboard.json
```

---

## Support and Escalation

### Contact Information

- **Enrichment Pipeline Issues**: enrichment-team@songnodes.local
- **API Gateway Issues**: api-team@songnodes.local
- **DLQ Management**: dlq-team@songnodes.local
- **Data Quality**: data-quality-team@songnodes.local

### Escalation Path

1. **Level 1**: Check this guide, review dashboards
2. **Level 2**: Review Loki logs and Tempo traces
3. **Level 3**: Contact appropriate team (see above)
4. **Level 4**: Create incident ticket with:
   - Alert screenshot
   - Relevant log snippets
   - Trace IDs
   - Steps already taken

---

## Appendix: Metric Reference

### Complete Metric List

| Metric Name | Type | Labels | Description |
|-------------|------|--------|-------------|
| `enrichment_api_calls_total` | Counter | provider, status | Total API calls made |
| `enrichment_api_duration_seconds` | Histogram | provider | API call duration |
| `enrichment_api_errors_total` | Counter | provider, error_type | API errors |
| `enrichment_cache_hits_total` | Counter | provider | Cache hits |
| `enrichment_cache_misses_total` | Counter | provider | Cache misses |
| `api_gateway_circuit_breaker_state` | Gauge | provider | Circuit breaker state (0/1/2) |
| `api_gateway_rate_limiter_tokens_available` | Gauge | provider | Available rate limit tokens |
| `api_gateway_retry_attempts_total` | Counter | provider, attempt | Retry attempts |
| `dlq_messages_total` | Gauge | queue | Messages in DLQ |
| `dlq_message_age_seconds` | Histogram | queue | Age of DLQ messages |
| `dlq_replay_total` | Counter | queue, status | DLQ replay attempts |
| `medallion_bronze_records_total` | Gauge | source | Bronze layer records |
| `medallion_silver_records_total` | Gauge | - | Silver layer records |
| `medallion_gold_records_total` | Gauge | - | Gold layer records |
| `medallion_data_quality_score` | Gauge | layer | Data quality score (0-1) |
| `medallion_enrichment_completeness` | Gauge | field_category | Field completeness (0-1) |
| `waterfall_provider_wins_total` | Counter | provider, field_name | Provider enrichment wins |
| `waterfall_fallback_count_total` | Counter | from_provider, to_provider, field_name | Fallback events |

---

**Document Version**: 1.0
**Last Updated**: 2025-10-10
**Maintained By**: SongNodes Observability Team
