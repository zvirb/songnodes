# SongNodes Scraper Monitoring Integration Guide

## Overview

This guide covers the comprehensive monitoring and alerting system designed to detect and prevent critical scraping issues early, specifically:

- **Zero EnhancedTrackItem Creation**: Detect when extraction stops completely
- **Event Loop Cleanup Issues**: Track asyncio warnings accumulating over time
- **Schema/Model Mismatches**: Identify validation failures causing silent data loss
- **Container Health Degradation**: Monitor resource usage and service health

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Scraper Services                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │ 1001TL   │  │ MixesDB  │  │ SetlistFM│  │ Reddit   │ ...  │
│  │  :8011   │  │  :8012   │  │  :8013   │  │  :8014   │      │
│  └─────┬────┘  └─────┬────┘  └─────┬────┘  └─────┬────┘      │
│        │             │              │             │            │
│        └─────────────┴──────────────┴─────────────┘            │
│                          │                                      │
│                    /metrics endpoint                            │
└────────────────────────┬───────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Prometheus (port 9091)                        │
│  - Scrapes metrics every 30s                                    │
│  - Evaluates alert rules                                        │
│  - Stores time-series data                                      │
└────────────────────────┬───────────────────────────────────────┘
                         │
                         ├─────────────────┐
                         │                 │
                         ▼                 ▼
┌────────────────────────────┐   ┌────────────────────────────┐
│  Alertmanager (port 9093)  │   │  Grafana (port 3001)       │
│  - Routes alerts           │   │  - Visualizes metrics      │
│  - Deduplicates            │   │  - Real-time dashboards    │
│  - Sends notifications     │   │  - Historical analysis     │
└────────────────────────────┘   └────────────────────────────┘
```

## Component Files

### 1. Metrics Instrumentation
**File**: `/mnt/my_external_drive/programming/songnodes/scrapers/monitoring_metrics.py`

Prometheus metrics definitions for all scraper monitoring:

```python
from scrapers.monitoring_metrics import (
    track_item_creation,
    track_schema_error,
    track_asyncio_warning,
    ScraperMetricsCollector
)

# Track item creation
track_item_creation('mixesdb', 'EnhancedTrackItem', 'mixesdb.com', item_data)

# Track errors
track_schema_error('mixesdb', 'missing_field', 'EnhancedTrackItem')
track_asyncio_warning('mixesdb', 'coroutine_not_awaited')

# Use collector for structured tracking
collector = ScraperMetricsCollector('mixesdb')
collector.track_item('EnhancedTrackItem', 'mixesdb.com', item_data)
collector.track_error('validation_failed', 'enrichment', 'EnhancedTrackItem')
```

### 2. Alert Rules
**Files**:
- `/mnt/my_external_drive/programming/songnodes/monitoring/prometheus/alerts/scraper-data-quality-alerts.yml`
- `/mnt/my_external_drive/programming/songnodes/monitoring/prometheus/alerts/scraper-health-alerts.yml`

#### Critical Alerts

| Alert | Trigger | For | Action |
|:------|:--------|:----|:-------|
| **ScraperZeroEnhancedTracksCreated** | No EnhancedTrackItems created | 6 hours | CRITICAL - Check extraction pipeline |
| **ScraperHighSchemaErrorRate** | Schema errors > 0.5/s | 5 min | CRITICAL - Check schema compatibility |
| **ScraperAsyncIOWarningsAccumulating** | >10 asyncio warnings | 30 min | CRITICAL - Check event loop cleanup |
| **ScraperContainerUnhealthy** | Health check failing | 15 min | CRITICAL - Check container logs |
| **ScraperDBConnectionPoolExhausted** | Pool usage = 100% | 5 min | CRITICAL - Check connection leaks |

#### Warning Alerts

| Alert | Trigger | For | Action |
|:------|:--------|:----|:-------|
| **ScraperLowEnhancedTrackRate** | Rate < 1/s | 2 hours | WARNING - Check performance |
| **ScraperArtistCoverageDropped** | Coverage drop > 5% | 1 hour | WARNING - Review failed scrapes |
| **ScraperHighDuplicateRate** | Duplicates > 30% | 30 min | WARNING - Review scraping strategy |
| **ScraperHighPipelineFlushLatency** | p95 latency > 30s | 10 min | WARNING - Check database performance |
| **ScraperHighMemoryUsage** | Memory > 800MB | 10 min | WARNING - Check for memory leaks |

### 3. Grafana Dashboard
**File**: `/mnt/my_external_drive/programming/songnodes/monitoring/grafana/dashboards/scraper-monitoring-comprehensive.json`

Dashboard panels:
1. **Overview Stats** (Row 1)
   - Enhanced Tracks Created (24h)
   - Playlists Discovered (24h)
   - Schema Errors (24h)
   - All Containers Healthy

2. **Creation Rates** (Row 2)
   - EnhancedTrackItem Creation Rate (per scraper)
   - Artist Coverage Percentage

3. **Error Tracking** (Row 3)
   - Schema Errors Rate
   - AsyncIO Warnings Rate

4. **Health & Performance** (Rows 4-5)
   - Container Health Status (table)
   - Pipeline Flush Latency (p95)
   - Database Connection Pool Usage
   - Scraper Memory Usage

**Access**: http://localhost:3001/d/scraper-monitoring-comprehensive

### 4. Enhanced Healthcheck
**File**: `/mnt/my_external_drive/programming/songnodes/scrapers/enhanced_healthcheck.py`

Comprehensive health validation script that checks:
- AsyncIO event loop warnings in logs
- Recent EnhancedTrackItem creation activity
- Database connectivity and performance
- Redis connectivity
- Memory usage patterns
- Pipeline processing health
- Schema validation health

**Usage**:
```bash
# Run healthcheck for a specific scraper
docker exec scraper-mixesdb python /app/enhanced_healthcheck.py

# Exit codes:
# 0 = Healthy
# 1 = Warning
# 2 = Critical
# 3 = Unknown
```

## Integration Steps

### Step 1: Add Metrics to Scraper API

For each scraper service, add the `/metrics` endpoint:

```python
# In scraper_api_*.py
from prometheus_client import generate_latest, CONTENT_TYPE_LATEST
from scrapers.monitoring_metrics import (
    ScraperMetricsCollector,
    initialize_scraper_metrics
)

# Initialize metrics at startup
initialize_scraper_metrics(
    scraper_name='mixesdb',
    version='2.0.0',
    config={'source': 'mixesdb.com'}
)

# Create metrics collector
metrics_collector = ScraperMetricsCollector('mixesdb')

@app.get("/metrics")
async def metrics():
    """Prometheus metrics endpoint"""
    return Response(
        content=generate_latest(),
        media_type=CONTENT_TYPE_LATEST
    )
```

### Step 2: Instrument Scraper Code

Add metrics tracking throughout the scraper pipeline:

```python
# In spider/pipeline code
from scrapers.monitoring_metrics import (
    track_item_creation,
    track_schema_error,
    track_asyncio_warning,
    timed_pipeline_operation
)

class EnhancedPersistencePipeline:
    def __init__(self, scraper_name: str):
        self.scraper_name = scraper_name

    @timed_pipeline_operation('mixesdb', 'database_insert')
    async def process_item(self, item, spider):
        # Track item creation
        if isinstance(item, EnhancedTrackItem):
            track_item_creation(
                self.scraper_name,
                'EnhancedTrackItem',
                spider.name,
                dict(item)
            )

        try:
            # Process item
            await self._insert_to_database(item)
        except ValidationError as e:
            # Track schema errors
            track_schema_error(
                self.scraper_name,
                'validation_failed',
                type(item).__name__
            )
            raise

    async def close_spider(self, spider):
        # Check for event loop warnings
        if self._has_pending_tasks():
            track_asyncio_warning(
                self.scraper_name,
                'pending_tasks_on_close'
            )
```

### Step 3: Update Docker Healthchecks

Enhance container healthchecks in `docker-compose.yml`:

```yaml
scraper-mixesdb:
  # ... existing config ...
  healthcheck:
    test:
      - CMD
      - python
      - /app/enhanced_healthcheck.py
    interval: 60s
    timeout: 30s
    retries: 3
    start_period: 60s
```

### Step 4: Configure Prometheus Scraping

Already configured in `/mnt/my_external_drive/programming/songnodes/monitoring/prometheus/prometheus.yml`:

```yaml
- job_name: 'scraper-mixesdb'
  static_configs:
    - targets: ['scraper-mixesdb:8012']
  scrape_interval: 30s
  metrics_path: /metrics
```

### Step 5: Load Alert Rules

Alert rules are automatically loaded by Prometheus from:
```yaml
rule_files:
  - "alerts/scraper-data-quality-alerts.yml"
  - "alerts/scraper-health-alerts.yml"
```

### Step 6: Import Grafana Dashboard

1. Navigate to Grafana: http://localhost:3001
2. Go to Dashboards → Import
3. Upload: `/monitoring/grafana/dashboards/scraper-monitoring-comprehensive.json`
4. Select Prometheus datasource
5. Click Import

## Monitoring Runbooks

### Runbook 1: Zero EnhancedTrackItem Creation

**Alert**: `ScraperZeroEnhancedTracksCreated`

**Symptoms**:
- No EnhancedTrackItems created for 6+ hours
- Container reports healthy
- No obvious errors in logs

**Diagnostic Steps**:
1. Check scraper logs for extraction errors:
   ```bash
   docker logs scraper-mixesdb --tail 1000 | grep -i "error\|exception"
   ```

2. Verify EnhancedTrackItem schema matches database:
   ```bash
   docker exec scraper-mixesdb python -c "
   from scrapers.items import EnhancedTrackItem
   print(EnhancedTrackItem.fields.keys())
   "
   ```

3. Check pipeline flush operations:
   ```bash
   docker logs scraper-mixesdb | grep -i "pipeline\|flush"
   ```

4. Verify Scrapy item loaders are functioning:
   ```bash
   docker exec scraper-mixesdb scrapy list
   ```

**Resolution**:
- **Schema mismatch**: Update item definitions in `/scrapers/items.py`
- **Pipeline stuck**: Restart container: `docker restart scraper-mixesdb`
- **Extraction failing**: Check website structure changes
- **Item loader broken**: Review loader configuration in `/scrapers/item_loaders.py`

### Runbook 2: AsyncIO Warnings Accumulating

**Alert**: `ScraperAsyncIOWarningsAccumulating`

**Symptoms**:
- >10 asyncio warnings in 30 minutes
- Warnings like "coroutine was never awaited"
- Memory usage gradually increasing

**Diagnostic Steps**:
1. Check specific warning types:
   ```bash
   docker logs scraper-mixesdb 2>&1 | grep -i "coroutine\|asyncio\|RuntimeWarning"
   ```

2. Verify event loop cleanup in spider:
   ```bash
   docker exec scraper-mixesdb python -c "
   import inspect
   from scrapers.spiders.mixesdb_spider import MixesdbSpider
   print(inspect.getsource(MixesdbSpider.closed))
   "
   ```

3. Check for unclosed connections:
   ```bash
   docker exec scraper-mixesdb python -c "
   import asyncio
   print(asyncio.all_tasks())
   "
   ```

**Resolution**:
- **Event loop not closed**: Add proper cleanup in spider's `closed()` method
- **Pending tasks**: Ensure all async tasks are awaited before spider closes
- **Unclosed connections**: Review connection pool cleanup
- **Immediate fix**: Restart container to clear state: `docker restart scraper-mixesdb`

### Runbook 3: High Schema Error Rate

**Alert**: `ScraperHighSchemaErrorRate`

**Symptoms**:
- Schema errors > 0.5/s
- Error type: validation_failed, missing_field, type_mismatch
- Items being dropped

**Diagnostic Steps**:
1. Check recent database schema changes:
   ```sql
   SELECT * FROM schema_migrations ORDER BY applied_at DESC LIMIT 10;
   ```

2. Review validation error details:
   ```bash
   docker logs scraper-mixesdb | grep "ValidationError" | tail -50
   ```

3. Compare scraper item definition with database schema:
   ```bash
   docker exec postgres psql -U musicdb_user -d musicdb -c "\d songs"
   docker exec scraper-mixesdb python -c "from scrapers.items import EnhancedTrackItem; print(EnhancedTrackItem.fields)"
   ```

**Resolution**:
- **Recent migration**: Update scraper item definitions to match new schema
- **Type mismatch**: Fix data type conversions in item loaders
- **Missing fields**: Add default values or make fields optional
- **Deploy fix**: Rebuild and restart scraper container

### Runbook 4: Container Unhealthy

**Alert**: `ScraperContainerUnhealthy`

**Symptoms**:
- Health check failing for 15+ minutes
- Container status shows "unhealthy"
- Service not responding

**Diagnostic Steps**:
1. Check container status and health:
   ```bash
   docker ps | grep scraper-mixesdb
   docker inspect scraper-mixesdb | jq '.[0].State.Health'
   ```

2. View recent container logs:
   ```bash
   docker logs scraper-mixesdb --tail 500
   ```

3. Check resource usage:
   ```bash
   docker stats scraper-mixesdb --no-stream
   ```

**Resolution**:
- **Out of memory**: Increase container memory limit in docker-compose.yml
- **Crashed process**: Check logs for exceptions, restart container
- **Deadlock**: Restart container: `docker restart scraper-mixesdb`
- **Persistent issues**: Check for recent code changes, consider rollback

## Alert Notification Setup

### Slack Integration

Configure Alertmanager to send alerts to Slack:

1. Create Slack webhook:
   - Go to https://api.slack.com/apps
   - Create new app → Incoming Webhooks
   - Add webhook to workspace
   - Copy webhook URL

2. Update Alertmanager config (`/observability/alerting/alertmanager.yaml`):
```yaml
receivers:
  - name: 'slack-critical'
    slack_configs:
      - api_url: 'YOUR_WEBHOOK_URL'
        channel: '#scraper-alerts-critical'
        title: 'Scraper Critical Alert'
        text: '{{ range .Alerts }}{{ .Annotations.summary }}\n{{ .Annotations.description }}{{ end }}'

route:
  group_by: ['alertname', 'scraper_name']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 12h
  receiver: 'slack-critical'
  routes:
    - match:
        severity: critical
      receiver: 'slack-critical'
      continue: true
```

3. Reload Alertmanager:
```bash
docker restart alertmanager
```

### Email Integration

Configure Alertmanager for email notifications:

```yaml
receivers:
  - name: 'email-critical'
    email_configs:
      - to: 'team@example.com'
        from: 'alertmanager@songnodes.com'
        smarthost: 'smtp.gmail.com:587'
        auth_username: 'alerts@songnodes.com'
        auth_password: 'YOUR_APP_PASSWORD'
        headers:
          Subject: '{{ range .Alerts }}{{ .Annotations.summary }}{{ end }}'
```

## Prometheus Queries

Useful queries for debugging:

### Check EnhancedTrackItem creation rate:
```promql
rate(scraper_enhanced_tracks_total[5m])
```

### Find scrapers with zero activity:
```promql
scraper_enhanced_tracks_total == 0
```

### Check error rates by type:
```promql
rate(scraper_schema_errors_total[10m]) by (scraper_name, error_type)
```

### Connection pool usage above 80%:
```promql
scraper_db_connection_pool_usage > 0.8
```

### Memory usage trends:
```promql
scraper_memory_usage_bytes / 1024 / 1024
```

## Testing Alerts

### Trigger Test Alerts

1. **Zero EnhancedTrackItem Creation**:
```bash
# Stop a scraper for 6+ hours
docker stop scraper-mixesdb
```

2. **High Schema Errors**:
```bash
# Introduce schema mismatch
docker exec scraper-mixesdb python -c "
from scrapers.items import EnhancedTrackItem
item = EnhancedTrackItem()
item['invalid_field'] = 'test'  # This will trigger validation error
"
```

3. **AsyncIO Warnings**:
```python
# Add unclosed coroutine in scraper code
async def test_function():
    await asyncio.sleep(1)

# Call without await:
test_function()  # Triggers warning
```

### Verify Alert Routing

```bash
# Check Prometheus alerts
curl http://localhost:9091/api/v1/alerts | jq '.data.alerts[] | select(.labels.alertname=="ScraperZeroEnhancedTracksCreated")'

# Check Alertmanager alerts
curl http://localhost:9093/api/v2/alerts | jq '.'

# Silence an alert
curl -X POST http://localhost:9093/api/v2/silences -d '{
  "matchers": [{"name": "alertname", "value": "ScraperZeroEnhancedTracksCreated"}],
  "startsAt": "2025-10-12T00:00:00Z",
  "endsAt": "2025-10-12T01:00:00Z",
  "comment": "Maintenance window"
}'
```

## Troubleshooting

### Metrics Not Appearing in Prometheus

1. Check scraper /metrics endpoint:
```bash
curl http://localhost:8012/metrics
```

2. Verify Prometheus scrape targets:
```bash
curl http://localhost:9091/api/v1/targets | jq '.data.activeTargets[] | select(.labels.job=="scraper-mixesdb")'
```

3. Check Prometheus logs:
```bash
docker logs metrics-prometheus
```

### Alerts Not Firing

1. Check alert rule syntax:
```bash
docker exec metrics-prometheus promtool check rules /etc/prometheus/alerts/scraper-data-quality-alerts.yml
```

2. Verify alert evaluation:
```bash
curl http://localhost:9091/api/v1/rules | jq '.data.groups[] | select(.name=="scraper-data-quality-critical")'
```

3. Check Alertmanager connection:
```bash
curl http://localhost:9091/api/v1/alertmanagers
```

### Grafana Dashboard Not Loading

1. Check Prometheus datasource:
   - Go to Configuration → Data Sources
   - Test Prometheus connection

2. Verify dashboard JSON:
```bash
cat /mnt/my_external_drive/programming/songnodes/monitoring/grafana/dashboards/scraper-monitoring-comprehensive.json | jq .
```

3. Check Grafana logs:
```bash
docker logs grafana
```

## Maintenance

### Regular Tasks

1. **Weekly**:
   - Review alert history for false positives
   - Check metric retention (30 days default)
   - Verify all scrapers reporting metrics

2. **Monthly**:
   - Review and update alert thresholds
   - Optimize slow queries in healthchecks
   - Clean up old Prometheus data

3. **Quarterly**:
   - Update monitoring stack versions
   - Review and expand metrics coverage
   - Conduct alert drill exercises

### Backup Prometheus Data

```bash
# Snapshot Prometheus data
docker exec metrics-prometheus promtool tsdb snapshot /prometheus

# Copy to backup location
docker cp metrics-prometheus:/prometheus/snapshots /backup/prometheus-$(date +%Y%m%d)
```

## Additional Resources

- **Prometheus Documentation**: https://prometheus.io/docs/
- **Grafana Dashboards**: https://grafana.com/docs/grafana/latest/
- **Alertmanager Guide**: https://prometheus.io/docs/alerting/latest/alertmanager/
- **Best Practices**: https://prometheus.io/docs/practices/alerting/

## Support

For monitoring issues or questions:
- Check existing alerts: http://localhost:9093
- Review dashboards: http://localhost:3001
- Query Prometheus: http://localhost:9091
- Contact: data-platform team
