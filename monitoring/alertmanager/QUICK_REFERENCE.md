# Alertmanager Slack Integration - Quick Reference

## One-Time Setup (5 minutes)

```bash
# 1. Get Slack webhook URL from https://api.slack.com/apps
#    → Create New App → Incoming Webhooks → Add to Workspace

# 2. Add to .env file
echo 'SLACK_WEBHOOK_URL="https://hooks.slack.com/services/YOUR/WEBHOOK/HERE"' >> .env

# 3. Restart Alertmanager
docker compose restart alertmanager

# 4. Test
curl -X POST "${SLACK_WEBHOOK_URL}" \
  -H 'Content-Type: application/json' \
  -d '{"text":"✅ Alertmanager connected!"}'
```

---

## Recommended Slack Channels

Create these channels for optimal alert routing:

| Channel | Webhook Variable | Purpose |
|:--------|:-----------------|:--------|
| `#songnodes-critical` | `SLACK_WEBHOOK_URL_CRITICAL` | P1/P0 incidents |
| `#songnodes-scraper-alerts` | `SLACK_WEBHOOK_URL_SCRAPERS` | Scraper health |
| `#songnodes-data-quality` | `SLACK_WEBHOOK_URL_DATA_QUALITY` | Data validation |
| `#songnodes-extraction-alerts` | `SLACK_WEBHOOK_URL_EXTRACTION` | Scraping failures |
| `#songnodes-database-alerts` | `SLACK_WEBHOOK_URL_DATABASE` | Database issues |
| `#songnodes-warnings` | `SLACK_WEBHOOK_URL_WARNINGS` | Non-critical alerts |

---

## Common Commands

### Check Alertmanager Status

```bash
# View status
curl http://localhost:9093/api/v1/status | jq .

# View active alerts
curl http://localhost:9093/api/v2/alerts | jq .

# Check logs
docker compose logs -f alertmanager
```

### Test Slack Notifications

```bash
# Method 1: Direct webhook test
curl -X POST "${SLACK_WEBHOOK_URL}" \
  -H 'Content-Type: application/json' \
  -d '{"text":"Test from Alertmanager"}'

# Method 2: Using amtool (install first: go install github.com/prometheus/alertmanager/cmd/amtool@latest)
amtool alert add test_alert \
  severity=warning \
  alertname="TestAlert" \
  summary="Testing Slack notifications" \
  --alertmanager.url=http://localhost:9093
```

### Silence Alerts

```bash
# Silence all scraper alerts for 2 hours
amtool silence add component=scraper --duration=2h --comment="Maintenance" \
  --alertmanager.url=http://localhost:9093

# Silence specific scraper
amtool silence add scraper_name=mixesdb-scraper --duration=1h \
  --alertmanager.url=http://localhost:9093

# List silences
amtool silence query --alertmanager.url=http://localhost:9093

# Remove silence
amtool silence expire <silence-id> --alertmanager.url=http://localhost:9093
```

### Validate Configuration

```bash
# Check YAML syntax
docker compose exec alertmanager amtool check-config /etc/alertmanager/alertmanager.yml

# Reload configuration (after changes)
docker compose restart alertmanager
```

---

## Alert Routing Logic

```
All Alerts
│
├── severity=critical → #songnodes-critical (+ default)
│   ├── 10s group_wait
│   └── 15m repeat_interval
│
├── component=scraper → #songnodes-scraper-alerts
│   ├── 1m group_wait
│   └── 2h repeat_interval
│
├── alertname~=Schema|Quality|Validation → #songnodes-data-quality
│   ├── 2m group_wait
│   └── 3h repeat_interval
│
├── component=extraction → #songnodes-extraction-alerts
│   ├── 1m group_wait
│   └── 2h repeat_interval
│
└── severity=warning → #songnodes-warnings
    ├── 2m group_wait
    └── 6h repeat_interval
```

---

## Troubleshooting

### No Alerts Received

```bash
# 1. Check webhook URL is set
echo $SLACK_WEBHOOK_URL

# 2. Check Alertmanager logs
docker compose logs alertmanager | grep -i error

# 3. Verify configuration
curl http://localhost:9093/api/v1/status | jq '.config.receivers[0].slack_configs[0].api_url'

# 4. Test webhook directly
curl -X POST "${SLACK_WEBHOOK_URL}" -d '{"text":"Test"}'
```

### Wrong Channel Receiving Alerts

```bash
# Check routing rules
curl http://localhost:9093/api/v1/status | jq '.config.route'

# Verify channel-specific webhooks are set
env | grep SLACK_WEBHOOK
```

### Too Many Notifications

```bash
# Increase repeat_interval in alertmanager.yml
# Default: 4h → Change to: 12h

# Or silence noisy alerts
amtool silence add alertname=NoisyAlert --duration=24h \
  --comment="Investigating root cause"
```

---

## Environment Variables Reference

### Minimum Setup (Single Webhook)

```bash
# Add to .env
SLACK_WEBHOOK_URL="https://hooks.slack.com/services/YOUR/WEBHOOK/HERE"
```

### Full Setup (All Channels)

```bash
# Add to .env
SLACK_WEBHOOK_URL="https://hooks.slack.com/services/DEFAULT/WEBHOOK"
SLACK_WEBHOOK_URL_CRITICAL="https://hooks.slack.com/services/CRITICAL/WEBHOOK"
SLACK_WEBHOOK_URL_SCRAPERS="https://hooks.slack.com/services/SCRAPER/WEBHOOK"
SLACK_WEBHOOK_URL_DATA_QUALITY="https://hooks.slack.com/services/DATA_QUALITY/WEBHOOK"
SLACK_WEBHOOK_URL_EXTRACTION="https://hooks.slack.com/services/EXTRACTION/WEBHOOK"
SLACK_WEBHOOK_URL_DATABASE="https://hooks.slack.com/services/DATABASE/WEBHOOK"
SLACK_WEBHOOK_URL_INFRA="https://hooks.slack.com/services/INFRA/WEBHOOK"
SLACK_WEBHOOK_URL_PERFORMANCE="https://hooks.slack.com/services/PERFORMANCE/WEBHOOK"
SLACK_WEBHOOK_URL_SERVICE_DOWN="https://hooks.slack.com/services/SERVICE_DOWN/WEBHOOK"
SLACK_WEBHOOK_URL_GRAPH_API="https://hooks.slack.com/services/GRAPH_API/WEBHOOK"
SLACK_WEBHOOK_URL_WEBSOCKET="https://hooks.slack.com/services/WEBSOCKET/WEBHOOK"
SLACK_WEBHOOK_URL_WARNINGS="https://hooks.slack.com/services/WARNINGS/WEBHOOK"
SLACK_WEBHOOK_URL_INFO="https://hooks.slack.com/services/INFO/WEBHOOK"
```

---

## Alert Examples

### What You'll See in Slack

**Critical Alert:**
```
🚨 CRITICAL: ScraperContainerUnhealthy
@channel CRITICAL ALERT FIRED

Alert: CRITICAL: mixesdb-scraper container is unhealthy
Priority: P1
Team: platform
Scraper: mixesdb-scraper
Component: infrastructure

Description:
Scraper container mixesdb-scraper (abc123) has been unhealthy
for more than 15 minutes...

Runbook: https://docs.songnodes.com/runbooks/container-unhealthy
Dashboard: http://grafana:3000/d/scraper-health
```

**Data Quality Alert:**
```
📊 Data Quality Alert: ScraperHighSchemaErrorRate

Scraper: 1001tracklists-scraper
Item Type: EnhancedTrackItem

Summary: CRITICAL: High schema error rate for 1001tracklists-scraper
Description: Scraper is experiencing schema validation errors at 0.8 errors/s...
Error Type: validation_error
Runbook: https://docs.songnodes.com/runbooks/schema-errors
```

**Resolved Alert:**
```
✅ RESOLVED: ScraperHighErrorRate

Alert has been resolved.
Duration: 45 minutes
```

---

## Inhibition Rules Summary

These rules prevent alert spam:

| If this fires | Then suppress | Reason |
|:--------------|:--------------|:-------|
| `ServiceDown` | All alerts for that service | Service is down |
| `ScraperContainerUnhealthy` | Performance alerts for that scraper | Container issues cause performance problems |
| `PostgreSQLDown` | Database connection alerts | Root cause is database |
| `ScraperAllExtractionsFailing` | `ScraperHighExtractionFailureRate` | More specific alert exists |
| Any critical alert | Warnings for same issue | Critical takes precedence |

---

## Metrics to Monitor

```bash
# Notification success rate
curl -s http://localhost:9093/metrics | grep alertmanager_notifications_total

# Notification failures
curl -s http://localhost:9093/metrics | grep alertmanager_notifications_failed_total

# Active alerts
curl -s http://localhost:9093/metrics | grep alertmanager_alerts{state="active"}

# Silenced alerts
curl -s http://localhost:9093/metrics | grep alertmanager_silences
```

---

## Quick Links

- **Alertmanager UI:** http://localhost:9093
- **Prometheus UI:** http://localhost:9090
- **Grafana Dashboards:** http://localhost:3001
- **Slack API Apps:** https://api.slack.com/apps
- **Full Setup Guide:** [SLACK_SETUP_GUIDE.md](./SLACK_SETUP_GUIDE.md)

---

## Support

For detailed setup instructions, troubleshooting, and advanced configuration, see:
- [SLACK_SETUP_GUIDE.md](./SLACK_SETUP_GUIDE.md)
- [Alertmanager Documentation](https://prometheus.io/docs/alerting/latest/)

**Configuration Files:**
- Alertmanager config: `/mnt/my_external_drive/programming/songnodes/monitoring/alertmanager/alertmanager.yml`
- Alert rules: `/mnt/my_external_drive/programming/songnodes/monitoring/prometheus/alerts/*.yml`
