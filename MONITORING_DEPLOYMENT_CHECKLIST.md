# Scraper Monitoring Deployment Checklist

## Phase 1: Immediate Deployment (No Code Changes Required) - 30 minutes

### ✅ Step 1: Restart Prometheus with New Alert Rules
```bash
# Verify alert rule files exist
ls -la /mnt/my_external_drive/programming/songnodes/monitoring/prometheus/alerts/scraper-*.yml

# Expected output:
# scraper-data-quality-alerts.yml
# scraper-health-alerts.yml

# Restart Prometheus to load new rules
docker restart metrics-prometheus

# Wait 10 seconds for startup
sleep 10

# Verify Prometheus loaded rules successfully
docker logs metrics-prometheus | grep "alerts/scraper"

# Expected output:
# level=info msg="Loading configuration file" filename=/etc/prometheus/prometheus.yml
# level=info msg="Completed loading of configuration file" filename=/etc/prometheus/prometheus.yml
```

**Verification**:
```bash
# Check alert rules are active
curl http://localhost:9091/api/v1/rules | jq '.data.groups[] | select(.name | contains("scraper"))'

# Should return scraper-data-quality-critical, scraper-health, etc.
```

### ✅ Step 2: Import Grafana Dashboard
1. Open browser: http://localhost:3001
2. Login (default: admin/admin)
3. Navigate to: Dashboards → Import
4. Click "Upload JSON file"
5. Select: `/mnt/my_external_drive/programming/songnodes/monitoring/grafana/dashboards/scraper-monitoring-comprehensive.json`
6. Select datasource: **Prometheus**
7. Click **Import**

**Verification**:
- Dashboard should appear at: http://localhost:3001/d/scraper-monitoring-comprehensive
- All panels should show "No data" (expected - metrics not yet instrumented)

### ✅ Step 3: Verify Prometheus Scrape Configuration
```bash
# Check Prometheus targets
curl http://localhost:9091/api/v1/targets | jq '.data.activeTargets[] | select(.labels.job | startswith("scraper-")) | {job: .labels.job, health: .health}'

# Expected output (for each scraper):
# {
#   "job": "scraper-mixesdb",
#   "health": "down"  # Expected - /metrics endpoint not yet added
# }
```

### ✅ Step 4: Test Alertmanager Connection
```bash
# Verify Alertmanager is running
curl http://localhost:9093/api/v2/status | jq .

# Verify Prometheus → Alertmanager connection
curl http://localhost:9091/api/v1/alertmanagers | jq .
```

---

## Phase 2: Code Instrumentation (Requires Development) - Per Scraper

### For Each Scraper Service (e.g., scraper-mixesdb)

#### ✅ Step 1: Add Dependencies
Edit `requirements.txt` or `pyproject.toml`:
```txt
prometheus-client>=0.19.0
```

#### ✅ Step 2: Add /metrics Endpoint
Edit `scraper_api_mixesdb.py` (or equivalent):

```python
from prometheus_client import generate_latest, CONTENT_TYPE_LATEST
from fastapi.responses import Response
from scrapers.monitoring_metrics import initialize_scraper_metrics

# At startup (before app initialization)
initialize_scraper_metrics(
    scraper_name='mixesdb',
    version='2.0.0',
    config={'source': 'mixesdb.com'}
)

# Add metrics endpoint
@app.get("/metrics")
async def metrics():
    """Prometheus metrics endpoint"""
    return Response(
        content=generate_latest(),
        media_type=CONTENT_TYPE_LATEST
    )
```

#### ✅ Step 3: Instrument Pipeline
Edit pipeline files (e.g., `pipelines/persistence_pipeline.py`):

```python
from scrapers.monitoring_metrics import (
    track_item_creation,
    track_schema_error,
    track_asyncio_warning,
    timed_pipeline_operation,
    ScraperMetricsCollector
)

class EnhancedPersistencePipeline:
    def __init__(self):
        self.scraper_name = 'mixesdb'
        self.metrics = ScraperMetricsCollector(self.scraper_name)

    @timed_pipeline_operation('mixesdb', 'database_insert')
    async def process_item(self, item, spider):
        # Track item creation
        if isinstance(item, EnhancedTrackItem):
            self.metrics.track_item(
                'EnhancedTrackItem',
                spider.name,
                dict(item)
            )

        try:
            await self._insert_to_database(item)
        except ValidationError as e:
            # Track schema errors
            self.metrics.track_error(
                'validation_failed',
                'persistence',
                'EnhancedTrackItem'
            )
            raise

    async def close_spider(self, spider):
        # Check for pending tasks (asyncio warnings)
        if self._has_pending_tasks():
            track_asyncio_warning(self.scraper_name, 'pending_tasks_on_close')
```

#### ✅ Step 4: Update Docker Healthcheck
Edit `docker-compose.yml`:

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

#### ✅ Step 5: Rebuild and Deploy
```bash
# Rebuild container
docker compose build scraper-mixesdb

# Deploy with zero downtime
docker compose up -d scraper-mixesdb

# Verify metrics endpoint
sleep 10
curl http://localhost:8012/metrics | grep scraper_

# Should return Prometheus metrics
```

#### ✅ Step 6: Verify Prometheus Scraping
```bash
# Wait 30 seconds for Prometheus scrape
sleep 30

# Check target health
curl http://localhost:9091/api/v1/targets | jq '.data.activeTargets[] | select(.labels.job=="scraper-mixesdb")'

# Should show health: "up"

# Query metrics
curl "http://localhost:9091/api/v1/query?query=scraper_enhanced_tracks_total{scraper_name=\"mixesdb\"}" | jq .
```

---

## Phase 3: Alert Notification Setup (Optional) - 15 minutes

### ✅ Slack Integration

1. Create Slack webhook:
   - Go to https://api.slack.com/apps
   - Create new app → Incoming Webhooks
   - Activate incoming webhooks
   - Add New Webhook to Workspace
   - Copy webhook URL

2. Update Alertmanager config:
```bash
# Edit alertmanager config
nano /mnt/my_external_drive/programming/songnodes/observability/alerting/alertmanager.yaml
```

Add:
```yaml
receivers:
  - name: 'slack-critical'
    slack_configs:
      - api_url: 'YOUR_WEBHOOK_URL_HERE'
        channel: '#scraper-alerts'
        title: '{{ range .Alerts }}{{ .Annotations.summary }}{{ end }}'
        text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'

route:
  group_by: ['alertname', 'scraper_name']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 4h
  receiver: 'slack-critical'
```

3. Restart Alertmanager:
```bash
docker restart alertmanager

# Verify config loaded
docker logs alertmanager | grep "Loading configuration"
```

---

## Phase 4: Testing and Validation - 30 minutes

### ✅ Test Metrics Collection
```bash
# Generate test traffic
curl -X POST http://localhost:8012/scrape -H "Content-Type: application/json" -d '{"artist_name":"Test Artist","limit":1}'

# Wait for processing
sleep 60

# Check metrics updated
curl "http://localhost:9091/api/v1/query?query=scraper_enhanced_tracks_total" | jq .
```

### ✅ Test Alert Triggering
```bash
# Manually trigger critical alert (stop scraper for 6+ hours)
# For immediate testing, temporarily modify alert duration to 1m

# Edit alert rule temporarily
nano /mnt/my_external_drive/programming/songnodes/monitoring/prometheus/alerts/scraper-data-quality-alerts.yml

# Change:
# for: 6h
# To:
# for: 1m

# Reload Prometheus
curl -X POST http://localhost:9091/-/reload

# Stop a scraper
docker stop scraper-mixesdb

# Wait 2 minutes
sleep 120

# Check for firing alert
curl http://localhost:9091/api/v1/alerts | jq '.data.alerts[] | select(.labels.alertname=="ScraperZeroEnhancedTracksCreated")'

# Start scraper again
docker start scraper-mixesdb

# Revert alert rule back to 6h
```

### ✅ Test Healthcheck
```bash
# Run enhanced healthcheck
docker exec scraper-mixesdb python /app/enhanced_healthcheck.py

# Should return JSON with check results and exit code 0 (healthy)
```

### ✅ Test Dashboard
1. Open: http://localhost:3001/d/scraper-monitoring-comprehensive
2. Verify panels showing data (if metrics instrumented)
3. Test time range selector
4. Test scraper variable filter
5. Verify auto-refresh working (30s)

---

## Rollout Schedule

### Week 1: Foundation (Phase 1)
- [ ] Monday: Deploy monitoring infrastructure (Phase 1)
- [ ] Tuesday: Verify alerts and dashboard
- [ ] Wednesday: Configure notifications
- [ ] Thursday: Test alert scenarios
- [ ] Friday: Document and train team

### Week 2: Pilot Scrapers (Phase 2)
- [ ] Monday: Instrument scraper-mixesdb
- [ ] Tuesday: Deploy and verify scraper-mixesdb
- [ ] Wednesday: Instrument scraper-1001tracklists
- [ ] Thursday: Deploy and verify scraper-1001tracklists
- [ ] Friday: Review Week 2, tune thresholds

### Week 3: Remaining Scrapers (Phase 2)
- [ ] Monday: Instrument 3 scrapers
- [ ] Tuesday: Deploy 3 scrapers
- [ ] Wednesday: Instrument 3 scrapers
- [ ] Thursday: Deploy 3 scrapers
- [ ] Friday: Instrument + deploy remaining scrapers

### Week 4: Optimization
- [ ] Monday: Tune alert thresholds based on data
- [ ] Tuesday: Optimize metric collection overhead
- [ ] Wednesday: Expand healthcheck coverage
- [ ] Thursday: Document runbooks
- [ ] Friday: Retrospective and celebration

---

## Success Criteria

### Phase 1 (Immediate)
- [x] Prometheus loading scraper alert rules
- [x] Grafana dashboard imported and accessible
- [x] Alertmanager connected to Prometheus
- [x] No errors in Prometheus/Grafana logs

### Phase 2 (Per Scraper)
- [ ] /metrics endpoint returning valid Prometheus metrics
- [ ] Prometheus successfully scraping scraper
- [ ] Enhanced healthcheck passing (exit code 0)
- [ ] Metrics visible in Grafana dashboard

### Phase 3 (Notifications)
- [ ] Slack notifications working for test alerts
- [ ] Alert grouping/deduplication working
- [ ] On-call rotation configured (if applicable)

### Phase 4 (Validation)
- [ ] All 10 scrapers instrumented and healthy
- [ ] Zero false positive alerts in 48 hours
- [ ] MTTR (Mean Time To Recovery) < 30 minutes
- [ ] Team trained on runbooks

---

## Troubleshooting Common Issues

### Issue: Prometheus not loading alert rules
**Symptoms**: No scraper alerts in Prometheus UI

**Fix**:
```bash
# Check Prometheus config syntax
docker exec metrics-prometheus promtool check config /etc/prometheus/prometheus.yml

# Check alert rule syntax
docker exec metrics-prometheus promtool check rules /etc/prometheus/alerts/scraper-data-quality-alerts.yml

# View Prometheus logs
docker logs metrics-prometheus --tail 100
```

### Issue: Metrics not appearing
**Symptoms**: /metrics endpoint returns data but Prometheus shows no data

**Fix**:
```bash
# Check Prometheus targets
curl http://localhost:9091/api/v1/targets | jq '.data.activeTargets[] | select(.labels.job | startswith("scraper"))'

# Check for scrape errors
curl http://localhost:9091/api/v1/targets | jq '.data.activeTargets[] | select(.labels.job | startswith("scraper")) | {job: .labels.job, lastError: .lastError}'

# Verify scraper /metrics endpoint accessible from Prometheus container
docker exec metrics-prometheus wget -O- http://scraper-mixesdb:8012/metrics
```

### Issue: Dashboard shows "No data"
**Symptoms**: Dashboard panels empty

**Fix**:
```bash
# Verify Prometheus datasource in Grafana
curl http://localhost:3001/api/datasources | jq '.[] | select(.type=="prometheus")'

# Test Prometheus query from Grafana
curl "http://localhost:3001/api/datasources/proxy/1/api/v1/query?query=up" | jq .

# Check if metrics exist in Prometheus
curl "http://localhost:9091/api/v1/label/__name__/values" | jq . | grep scraper_
```

### Issue: Alerts not firing
**Symptoms**: Expected alerts not appearing in Alertmanager

**Fix**:
```bash
# Check alert evaluation in Prometheus
curl http://localhost:9091/api/v1/rules | jq '.data.groups[] | select(.name | contains("scraper"))'

# Verify Alertmanager connection
curl http://localhost:9091/api/v1/alertmanagers | jq .

# Check Alertmanager logs
docker logs alertmanager --tail 100
```

---

## Rollback Plan

If issues occur during deployment:

1. **Rollback Prometheus config**:
```bash
# Restore previous prometheus.yml
git checkout HEAD~1 -- monitoring/prometheus/prometheus.yml
docker restart metrics-prometheus
```

2. **Remove Grafana dashboard**:
   - Navigate to dashboard
   - Dashboard settings → Delete

3. **Rollback scraper instrumentation**:
```bash
# Rebuild without metrics
git checkout HEAD~1 -- scrapers/monitoring_metrics.py
docker compose build scraper-mixesdb
docker compose up -d scraper-mixesdb
```

---

## Support and Documentation

- **Full Guide**: `/mnt/my_external_drive/programming/songnodes/docs/SCRAPER_MONITORING_GUIDE.md`
- **Architecture**: `/mnt/my_external_drive/programming/songnodes/docs/MONITORING_ARCHITECTURE.txt`
- **Implementation Summary**: `/mnt/my_external_drive/programming/songnodes/docs/MONITORING_IMPLEMENTATION_SUMMARY.md`
- **Metrics Library**: `/mnt/my_external_drive/programming/songnodes/scrapers/monitoring_metrics.py`
- **Healthcheck Script**: `/mnt/my_external_drive/programming/songnodes/scrapers/enhanced_healthcheck.py`

---

## Quick Reference Commands

```bash
# Restart monitoring stack
docker restart metrics-prometheus alertmanager grafana

# View scraper metrics
curl http://localhost:8012/metrics | grep scraper_

# Check Prometheus targets
curl http://localhost:9091/api/v1/targets | jq '.data.activeTargets[] | select(.labels.job | startswith("scraper"))'

# View active alerts
curl http://localhost:9091/api/v1/alerts | jq '.data.alerts[] | select(.labels.component=="scraper")'

# Test healthcheck
docker exec scraper-mixesdb python /app/enhanced_healthcheck.py

# Silence an alert
curl -X POST http://localhost:9093/api/v2/silences -d '{
  "matchers": [{"name": "alertname", "value": "ScraperZeroEnhancedTracksCreated"}],
  "startsAt": "2025-10-12T00:00:00Z",
  "endsAt": "2025-10-12T04:00:00Z",
  "comment": "Maintenance window"
}' -H "Content-Type: application/json"
```

---

**Ready to Deploy?** Start with Phase 1 and verify each step before proceeding.
