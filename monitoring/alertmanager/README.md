# Alertmanager Slack Integration for SongNodes

**Status:** ✅ Configuration Complete - Ready for Deployment
**Date:** 2025-10-12
**Version:** 1.0

---

## Overview

This directory contains a comprehensive Slack integration configuration for Alertmanager, designed specifically for SongNodes scraper monitoring. The configuration provides intelligent, severity-based alert routing to dedicated Slack channels with minimal false positives and alert fatigue.

### Key Features

- **19 Specialized Receivers** for different alert types and teams
- **Intelligent Routing** based on severity, component, and alert name
- **Inhibition Rules** to prevent redundant notifications
- **Optimized Timing** for each alert severity (10s - 12h)
- **Rich Message Formatting** with emojis, links, and context
- **Fallback Configuration** for minimal setup or full deployment

---

## Quick Start (5 Minutes)

### Minimum Setup

1. **Create Slack Webhook:**
   - Go to https://api.slack.com/apps
   - Create new app → Incoming Webhooks → Enable
   - Add webhook to `#songnodes-alerts` channel
   - Copy webhook URL

2. **Configure Environment:**
   ```bash
   # Add to .env file
   echo 'SLACK_WEBHOOK_URL="https://hooks.slack.com/services/YOUR/WEBHOOK/HERE"' >> /mnt/my_external_drive/programming/songnodes/.env
   ```

3. **Update Docker Compose:**
   Add to alertmanager service in `docker-compose.yml`:
   ```yaml
   alertmanager:
     env_file:
       - .env
   ```

4. **Deploy:**
   ```bash
   docker compose restart alertmanager
   ```

5. **Test:**
   ```bash
   curl -X POST "${SLACK_WEBHOOK_URL}" -d '{"text":"✅ Connected!"}'
   ```

---

## Documentation

### Primary Documents

| Document | Purpose | Audience |
|:---------|:--------|:---------|
| [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md) | Step-by-step deployment guide | DevOps, SysAdmin |
| [SLACK_SETUP_GUIDE.md](./SLACK_SETUP_GUIDE.md) | Comprehensive setup instructions | All engineers |
| [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) | One-page command reference | Daily operations |
| [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md) | Technical implementation details | Architects, senior engineers |

### Configuration Files

| File | Path | Purpose |
|:-----|:-----|:--------|
| **Production Config** | `/observability/alerting/alertmanager.yaml` | Active configuration (used by docker-compose) |
| **Scraper-Focused Config** | `/monitoring/alertmanager/alertmanager.yml` | Alternative config with scraper-specific routing |

---

## Architecture

### Alert Flow

```
Prometheus
    ↓ (evaluates alert rules every 30s)
Alert Fired
    ↓ (sends to Alertmanager)
Alertmanager
    ↓ (applies routing rules)
Route Matching
    ↓ (groups by: alertname, severity, scraper_name, component)
Grouped Alerts
    ↓ (waits: group_wait duration)
Slack Receiver
    ↓ (formats message)
Slack Channel
```

### Receiver Hierarchy

```
Default Receiver (#songnodes-alerts)
├── Critical Alerts (#songnodes-critical)
│   └── @channel mention, 10s notification
├── Component-Specific
│   ├── Scraper (#songnodes-scraper-alerts)
│   ├── Extraction (#songnodes-extraction-alerts)
│   ├── Data Quality (#songnodes-data-quality)
│   ├── Database (#songnodes-database-alerts)
│   ├── Infrastructure (#songnodes-infrastructure)
│   └── Performance (#songnodes-performance)
├── Service-Specific
│   ├── Service Down (#songnodes-service-down)
│   ├── Enrichment (#songnodes-enrichment)
│   ├── API Gateway (#songnodes-api-gateway)
│   ├── DLQ (#songnodes-dlq)
│   └── Data Engineering (#songnodes-data-engineering)
├── Team-Specific
│   ├── Data Platform (#songnodes-data-platform)
│   ├── Backend (#songnodes-backend)
│   └── Finance (#songnodes-cost-alerts)
└── Severity-Specific
    ├── Warnings (#songnodes-warnings)
    └── Info (#songnodes-info)
```

---

## Slack Channel Configuration

### Recommended Channels

#### Essential (Priority 1)
- `#songnodes-alerts` - Default catch-all
- `#songnodes-critical` - P1/P0 incidents (all engineers + on-call)
- `#songnodes-scraper-alerts` - Scraper health (data platform team)

#### Important (Priority 2)
- `#songnodes-data-quality` - Data validation (data platform + QA)
- `#songnodes-extraction-alerts` - Scraping failures (data platform)
- `#songnodes-database-alerts` - Database issues (platform + DBAs)
- `#songnodes-service-down` - Service availability (all engineers)

#### Specialized (Priority 3)
- `#songnodes-enrichment` - Enrichment pipeline
- `#songnodes-api-gateway` - API Gateway/circuit breaker
- `#songnodes-dlq` - Dead letter queue
- `#songnodes-data-engineering` - Medallion architecture
- `#songnodes-infrastructure` - Container/system
- `#songnodes-performance` - Performance degradation
- `#songnodes-warnings` - Non-critical warnings (muted)
- `#songnodes-info` - Informational alerts (muted)

#### Additional
- `#songnodes-data-platform` - Data platform team
- `#songnodes-backend` - Backend API issues
- `#songnodes-cost-alerts` - Cost monitoring

### Channel Settings Recommendations

| Channel | Mobile Notifications | Mute Settings | Retention |
|:--------|:--------------------|:--------------|:----------|
| `#critical` | All messages | Never mute | 90 days |
| `#service-down` | All messages | Never mute | 90 days |
| `#scraper-alerts` | All messages | Optional | 60 days |
| `#data-quality` | All messages | Optional | 60 days |
| `#warnings` | Muted by default | Always muted | 30 days |
| `#info` | Fully muted | Always muted | 7 days |

---

## Environment Variables

### Variable Reference

| Variable | Channel | Priority | Fallback |
|:---------|:--------|:---------|:---------|
| `SLACK_WEBHOOK_URL` | `#songnodes-alerts` | **REQUIRED** | None (PLACEHOLDER) |
| `SLACK_WEBHOOK_URL_CRITICAL` | `#songnodes-critical` | High | `SLACK_WEBHOOK_URL` |
| `SLACK_WEBHOOK_URL_SCRAPERS` | `#songnodes-scraper-alerts` | High | `SLACK_WEBHOOK_URL` |
| `SLACK_WEBHOOK_URL_DATA_QUALITY` | `#songnodes-data-quality` | High | `SLACK_WEBHOOK_URL` |
| `SLACK_WEBHOOK_URL_EXTRACTION` | `#songnodes-extraction-alerts` | Medium | `SLACK_WEBHOOK_URL` |
| `SLACK_WEBHOOK_URL_DATABASE` | `#songnodes-database-alerts` | Medium | `SLACK_WEBHOOK_URL` |
| `SLACK_WEBHOOK_URL_SERVICE_DOWN` | `#songnodes-service-down` | High | `SLACK_WEBHOOK_URL` |
| `SLACK_WEBHOOK_URL_ENRICHMENT` | `#songnodes-enrichment` | Medium | `SLACK_WEBHOOK_URL` |
| `SLACK_WEBHOOK_URL_API_GATEWAY` | `#songnodes-api-gateway` | Medium | `SLACK_WEBHOOK_URL` |
| `SLACK_WEBHOOK_URL_DLQ` | `#songnodes-dlq` | Medium | `SLACK_WEBHOOK_URL` |
| `SLACK_WEBHOOK_URL_DATA_ENG` | `#songnodes-data-engineering` | Low | `SLACK_WEBHOOK_URL` |
| `SLACK_WEBHOOK_URL_INFRA` | `#songnodes-infrastructure` | Medium | `SLACK_WEBHOOK_URL` |
| `SLACK_WEBHOOK_URL_DATA_PLATFORM` | `#songnodes-data-platform` | Low | `SLACK_WEBHOOK_URL` |
| `SLACK_WEBHOOK_URL_BACKEND` | `#songnodes-backend` | Low | `SLACK_WEBHOOK_URL` |
| `SLACK_WEBHOOK_URL_PERFORMANCE` | `#songnodes-performance` | Medium | `SLACK_WEBHOOK_URL` |
| `SLACK_WEBHOOK_URL_WARNINGS` | `#songnodes-warnings` | Low | `SLACK_WEBHOOK_URL` |
| `SLACK_WEBHOOK_URL_INFO` | `#songnodes-info` | Low | `SLACK_WEBHOOK_URL` |
| `SLACK_WEBHOOK_URL_FINANCE` | `#songnodes-cost-alerts` | Low | `SLACK_WEBHOOK_URL` |

### Configuration Strategy

**Option 1: Minimum (Single Webhook)**
- Set only `SLACK_WEBHOOK_URL`
- All alerts go to one channel
- Simple, fast setup

**Option 2: Essential (3-5 Webhooks)**
- Set `SLACK_WEBHOOK_URL`, `SLACK_WEBHOOK_URL_CRITICAL`, `SLACK_WEBHOOK_URL_SCRAPERS`
- Critical separation for urgent alerts
- Recommended for small teams

**Option 3: Recommended (10-15 Webhooks)**
- Set all Priority 1 and 2 channels
- Good balance between organization and complexity
- Recommended for production

**Option 4: Full (All Webhooks)**
- Set all 18 channel-specific webhooks
- Maximum organization and routing
- Best for large teams

---

## Alert Routing Examples

### Example 1: Scraper Container Unhealthy

**Alert:** `ScraperContainerUnhealthy` (severity: critical, component: infrastructure)

**Routing:**
1. Matches `severity=critical` → `slack-critical`
2. Matches `component=infrastructure` → `slack-infrastructure`

**Slack Channels:**
- `#songnodes-critical` (with @channel mention, 10s delay)
- `#songnodes-infrastructure` (1m delay)

**Inhibition:**
- Suppresses performance alerts for same scraper

### Example 2: High Schema Error Rate

**Alert:** `ScraperHighSchemaErrorRate` (severity: critical, component: scraper)

**Routing:**
1. Matches `severity=critical` → `slack-critical`
2. Matches `component=scraper` → `slack-scraper-alerts`

**Slack Channels:**
- `#songnodes-critical` (with @channel, 10s)
- `#songnodes-scraper-alerts` (1m)

### Example 3: Slow Requests (Warning)

**Alert:** `ScraperSlowRequests` (severity: warning, component: performance)

**Routing:**
1. Matches `component=performance` → `slack-performance`
2. Matches `severity=warning` → `slack-warnings`

**Slack Channels:**
- `#songnodes-performance` (2m delay)
- `#songnodes-warnings` (2m delay)

---

## Common Operations

### View Active Alerts
```bash
curl http://localhost:9093/api/v2/alerts | jq .
```

### Silence Alert
```bash
amtool silence add component=scraper --duration=2h --comment="Maintenance" \
  --alertmanager.url=http://localhost:9093
```

### List Silences
```bash
amtool silence query --alertmanager.url=http://localhost:9093
```

### Test Notification
```bash
curl -X POST "${SLACK_WEBHOOK_URL}" -d '{"text":"Test"}'
```

### Check Configuration
```bash
docker compose exec alertmanager amtool check-config /etc/alertmanager/alertmanager.yml
```

### Reload Configuration
```bash
docker compose restart alertmanager
```

---

## Performance and Scaling

### Expected Alert Volume

**Healthy System:**
- 20-40 alerts/day
- 0-1 critical alerts/day
- 5-10 warnings/day

**During Issues:**
- Single scraper failure: 3-5 alerts
- Database issue: 5-10 alerts
- Service outage: 15-30 alerts
- Inhibition rules reduce volume by 30-50%

### Notification Timing

| Alert Severity | Group Wait | Repeat Interval | Use Case |
|:---------------|:-----------|:----------------|:---------|
| Critical | 10s | 15m | Immediate action required |
| Service Down | 10s | 10m | Service unavailable |
| Scraper/Extraction | 1m | 2h | Operational issues |
| Data Quality | 2m | 3h | Data integrity |
| Performance | 2m | 2h | Performance degradation |
| Warning | 2m | 6h | Non-critical issues |
| Info | 5m | 12h | Informational |

### Resource Usage

- **Memory:** ~50MB per Alertmanager instance
- **CPU:** <0.1 core average, <0.5 core peak
- **Network:** ~1KB per notification
- **Storage:** <100MB for 30 days of data

---

## Monitoring Alertmanager

### Key Metrics

```bash
# Notification success rate
curl -s http://localhost:9093/metrics | grep alertmanager_notifications_total

# Notification failures
curl -s http://localhost:9093/metrics | grep alertmanager_notifications_failed_total

# Active alerts
curl -s http://localhost:9093/metrics | grep 'alertmanager_alerts{state="active"}'

# Notification latency
curl -s http://localhost:9093/metrics | grep alertmanager_notification_latency_seconds
```

### Grafana Dashboard

Import dashboard ID `9578` in Grafana for comprehensive Alertmanager monitoring.

---

## Troubleshooting

### No Alerts in Slack

1. Check webhook URL: `echo $SLACK_WEBHOOK_URL`
2. Verify env_file in docker-compose: `grep -A 5 alertmanager: docker-compose.yml`
3. Check Alertmanager logs: `docker compose logs alertmanager`
4. Test webhook directly: `curl -X POST $SLACK_WEBHOOK_URL -d '{"text":"test"}'`

### PLACEHOLDER in Logs

```bash
# Add webhook URL to .env
echo 'SLACK_WEBHOOK_URL="https://hooks.slack.com/services/..."' >> .env

# Restart Alertmanager
docker compose restart alertmanager
```

### Wrong Channel

- Verify channel-specific webhook URLs are set
- Check routing rules in configuration
- Review Alertmanager logs for routing decisions

### Too Many Notifications

- Increase `repeat_interval` in configuration
- Adjust alert thresholds in Prometheus rules
- Use silences for noisy alerts
- Review inhibition rules

---

## Security

### Best Practices

- ✅ Store webhook URLs in .env (in .gitignore)
- ✅ Use environment variables (never hardcode)
- ✅ Limit Slack app permissions (only Incoming Webhooks)
- ✅ Rotate webhooks if exposed
- ✅ Use separate webhooks for dev/staging/prod
- ✅ Review audit logs regularly

### Sensitive Information

Configuration **does NOT** include:
- API keys or passwords
- User personal data
- Internal IP addresses
- Database credentials

Configuration **includes**:
- Scraper names (not sensitive)
- Container IDs (internal only)
- Error messages (may contain URLs)

---

## Maintenance

### Regular Tasks

**Weekly:**
- Review alert volume and trends
- Check notification success rate (should be >99%)
- Verify critical channel on-call roster

**Monthly:**
- Review and tune alert thresholds
- Update runbook links
- Audit webhook access
- Clean up stale silences

**Quarterly:**
- Review channel organization
- Gather team feedback on alert quality
- Update inhibition rules as needed
- Rotate Slack webhook URLs

---

## Support

### Internal Resources

- **Documentation:** This directory
- **Alertmanager UI:** http://localhost:9093
- **Prometheus UI:** http://localhost:9090
- **Grafana:** http://localhost:3001

### External Resources

- [Alertmanager Documentation](https://prometheus.io/docs/alerting/latest/)
- [Slack Incoming Webhooks](https://api.slack.com/messaging/webhooks)
- [Alert Notification Templating](https://prometheus.io/docs/alerting/latest/notification_examples/)

---

## FAQ

**Q: Can I use just one Slack channel?**
A: Yes! Set only `SLACK_WEBHOOK_URL` and all alerts go to one channel.

**Q: How do I add a new Slack channel?**
A: Create webhook in Slack app, add to .env, restart alertmanager.

**Q: Can I test without sending to Slack?**
A: Yes, use placeholder URL or don't set webhook URL. Alerts show in UI only.

**Q: How do I silence alerts during maintenance?**
A: Use `amtool silence add` (see QUICK_REFERENCE.md).

**Q: Can I customize message formatting?**
A: Yes, edit the `text:` field in receiver configuration.

**Q: How do I route a new alert type?**
A: Add a new route in the `routes:` section matching alert labels.

**Q: What if webhook URL is exposed?**
A: Immediately delete webhook in Slack app, create new one, update .env.

**Q: Can I use PagerDuty instead of Slack?**
A: Yes, add `pagerduty_configs` to receivers. See Alertmanager docs.

---

## Changelog

### Version 1.0 (2025-10-12)
- Initial implementation
- 19 Slack receivers configured
- Intelligent routing rules
- 6 inhibition rules
- Comprehensive documentation

---

## License

This configuration is part of the SongNodes project. Internal use only.

---

**Maintained by:** Platform Engineering Team
**Last Updated:** 2025-10-12
**Configuration Version:** 1.0
**Alertmanager Version:** latest (v0.25+ compatible)
