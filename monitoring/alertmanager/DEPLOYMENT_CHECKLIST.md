# Alertmanager Slack Integration - Deployment Checklist

**Configuration Status:** ✅ Complete - Ready for Deployment
**Date:** 2025-10-12

---

## Pre-Deployment Checklist

### 1. Configuration Files

- [x] `/mnt/my_external_drive/programming/songnodes/observability/alerting/alertmanager.yaml` - Updated with Slack integration
- [x] `/mnt/my_external_drive/programming/songnodes/monitoring/alertmanager/alertmanager.yml` - Comprehensive scraper-focused config
- [x] Configuration validated with `amtool check-config`
- [x] YAML syntax verified
- [x] All receiver names referenced in routes exist

### 2. Docker Compose Configuration

**IMPORTANT:** The alertmanager service in `docker-compose.yml` needs environment variable configuration.

#### Current Configuration
```yaml
alertmanager:
  image: quay.io/prometheus/alertmanager:latest
  volumes:
    - ./observability/alerting/alertmanager.yaml:/etc/alertmanager/alertmanager.yml
```

#### Required Addition
Add this to the alertmanager service in `docker-compose.yml`:

```yaml
alertmanager:
  image: quay.io/prometheus/alertmanager:latest
  env_file:
    - .env  # This passes SLACK_WEBHOOK_URL environment variables
  environment:
    # Optional: Override specific variables here if needed
    # - SLACK_WEBHOOK_URL=${SLACK_WEBHOOK_URL}
  volumes:
    - ./observability/alerting/alertmanager.yaml:/etc/alertmanager/alertmanager.yml
```

**Action Required:**
```bash
# Edit docker-compose.yml and add env_file to alertmanager service
nano /mnt/my_external_drive/programming/songnodes/docker-compose.yml

# Add under alertmanager service:
#   env_file:
#     - .env
```

### 3. Slack Workspace Setup

#### Minimum Setup (5 minutes)
- [ ] Create Slack app at https://api.slack.com/apps
- [ ] Enable "Incoming Webhooks"
- [ ] Create webhook for `#songnodes-alerts` channel
- [ ] Copy webhook URL
- [ ] Add to .env: `SLACK_WEBHOOK_URL="https://hooks.slack.com/services/..."`

#### Recommended Setup (30 minutes)
Create these Slack channels:

##### Essential Channels (Priority 1)
- [ ] `#songnodes-alerts` - Default catch-all
- [ ] `#songnodes-critical` - Critical P1/P0 incidents
- [ ] `#songnodes-scraper-alerts` - Scraper health/performance

##### Important Channels (Priority 2)
- [ ] `#songnodes-data-quality` - Data validation/schema
- [ ] `#songnodes-extraction-alerts` - Scraping failures
- [ ] `#songnodes-database-alerts` - Database issues
- [ ] `#songnodes-service-down` - Service availability

##### Specialized Channels (Priority 3)
- [ ] `#songnodes-enrichment` - Enrichment pipeline
- [ ] `#songnodes-api-gateway` - API Gateway/circuit breaker
- [ ] `#songnodes-dlq` - Dead letter queue
- [ ] `#songnodes-data-engineering` - Medallion architecture
- [ ] `#songnodes-infrastructure` - Container/system
- [ ] `#songnodes-performance` - Performance degradation
- [ ] `#songnodes-warnings` - Non-critical warnings
- [ ] `#songnodes-info` - Informational alerts

##### Additional Channels
- [ ] `#songnodes-data-platform` - Data platform team
- [ ] `#songnodes-backend` - Backend API issues
- [ ] `#songnodes-cost-alerts` - Cost monitoring

#### Webhook Creation
For each channel:
1. Go to Slack app → Incoming Webhooks
2. Click "Add New Webhook to Workspace"
3. Select target channel
4. Copy webhook URL
5. Add to .env with appropriate variable name

### 4. Environment Variables Configuration

**Location:** `/mnt/my_external_drive/programming/songnodes/.env`

#### Minimum Configuration
```bash
# Add this line to .env
SLACK_WEBHOOK_URL="https://hooks.slack.com/services/YOUR/DEFAULT/WEBHOOK"
```

#### Recommended Configuration (All Channels)
```bash
# Default webhook (REQUIRED - fallback for all channels)
SLACK_WEBHOOK_URL="https://hooks.slack.com/services/YOUR/DEFAULT/WEBHOOK"

# Critical alerts
SLACK_WEBHOOK_URL_CRITICAL="https://hooks.slack.com/services/YOUR/CRITICAL/WEBHOOK"

# Scraper monitoring
SLACK_WEBHOOK_URL_SCRAPERS="https://hooks.slack.com/services/YOUR/SCRAPER/WEBHOOK"
SLACK_WEBHOOK_URL_EXTRACTION="https://hooks.slack.com/services/YOUR/EXTRACTION/WEBHOOK"

# Data quality and enrichment
SLACK_WEBHOOK_URL_DATA_QUALITY="https://hooks.slack.com/services/YOUR/DATA_QUALITY/WEBHOOK"
SLACK_WEBHOOK_URL_ENRICHMENT="https://hooks.slack.com/services/YOUR/ENRICHMENT/WEBHOOK"

# Infrastructure
SLACK_WEBHOOK_URL_DATABASE="https://hooks.slack.com/services/YOUR/DATABASE/WEBHOOK"
SLACK_WEBHOOK_URL_SERVICE_DOWN="https://hooks.slack.com/services/YOUR/SERVICE_DOWN/WEBHOOK"
SLACK_WEBHOOK_URL_INFRA="https://hooks.slack.com/services/YOUR/INFRA/WEBHOOK"

# API and gateway
SLACK_WEBHOOK_URL_API_GATEWAY="https://hooks.slack.com/services/YOUR/API_GATEWAY/WEBHOOK"
SLACK_WEBHOOK_URL_DLQ="https://hooks.slack.com/services/YOUR/DLQ/WEBHOOK"

# Teams and performance
SLACK_WEBHOOK_URL_DATA_ENG="https://hooks.slack.com/services/YOUR/DATA_ENG/WEBHOOK"
SLACK_WEBHOOK_URL_DATA_PLATFORM="https://hooks.slack.com/services/YOUR/DATA_PLATFORM/WEBHOOK"
SLACK_WEBHOOK_URL_BACKEND="https://hooks.slack.com/services/YOUR/BACKEND/WEBHOOK"
SLACK_WEBHOOK_URL_PERFORMANCE="https://hooks.slack.com/services/YOUR/PERFORMANCE/WEBHOOK"

# Severity levels
SLACK_WEBHOOK_URL_WARNINGS="https://hooks.slack.com/services/YOUR/WARNINGS/WEBHOOK"
SLACK_WEBHOOK_URL_INFO="https://hooks.slack.com/services/YOUR/INFO/WEBHOOK"

# Finance/cost
SLACK_WEBHOOK_URL_FINANCE="https://hooks.slack.com/services/YOUR/FINANCE/WEBHOOK"
```

**Important:**
- Replace `YOUR/...WEBHOOK` with actual Slack webhook URLs
- Keep .env file secure (already in .gitignore)
- Minimum: Set `SLACK_WEBHOOK_URL` (all alerts go to one channel)
- Recommended: Set channel-specific URLs for optimal routing

---

## Deployment Steps

### Step 1: Update Docker Compose (REQUIRED)

```bash
# 1. Open docker-compose.yml
nano /mnt/my_external_drive/programming/songnodes/docker-compose.yml

# 2. Find the alertmanager service
# 3. Add this configuration:

alertmanager:
  image: quay.io/prometheus/alertmanager:latest
  container_name: alertmanager
  restart: always
  env_file:
    - .env
  ports:
    - 9093:9093
  # ... rest of configuration
```

### Step 2: Configure Slack Webhooks

```bash
# 1. Create Slack app and webhooks (see "Slack Workspace Setup" above)

# 2. Add webhook URLs to .env file
nano /mnt/my_external_drive/programming/songnodes/.env

# 3. Add at minimum:
SLACK_WEBHOOK_URL="https://hooks.slack.com/services/YOUR/WEBHOOK/HERE"

# 4. Verify .env file permissions
chmod 600 /mnt/my_external_drive/programming/songnodes/.env
```

### Step 3: Deploy Alertmanager

```bash
cd /mnt/my_external_drive/programming/songnodes

# Stop existing Alertmanager
docker compose stop alertmanager

# Remove old container
docker compose rm -f alertmanager

# Start with new configuration
docker compose up -d alertmanager

# Verify startup
docker compose logs -f alertmanager
```

**Expected output:**
```
level=info msg="Starting Alertmanager" version=...
level=info msg="Build context" ...
level=info msg="Listening on :9093" ...
```

**No errors about:**
- Configuration parsing
- Invalid YAML
- Missing receivers
- Template errors

### Step 4: Validate Configuration

```bash
# Check Alertmanager is running
docker compose ps alertmanager

# Check configuration loaded correctly
curl http://localhost:9093/api/v1/status | jq '.config.receivers[] | {name: .name, has_slack: (.slack_configs != null)}'

# Expected output: Each receiver should show has_slack: true
```

### Step 5: Test Notification

#### Method 1: Direct Webhook Test
```bash
# Test webhook directly
WEBHOOK_URL="YOUR_SLACK_WEBHOOK_URL"
curl -X POST "${WEBHOOK_URL}" \
  -H 'Content-Type: application/json' \
  -d '{"text":"✅ Alertmanager Slack integration test successful!"}'
```

**Expected:** Message appears in Slack channel within 1-2 seconds

#### Method 2: Test via Alertmanager API
```bash
# Install amtool if not already installed
go install github.com/prometheus/alertmanager/cmd/amtool@latest

# Send test alert
amtool alert add test_alert \
  severity=warning \
  alertname="TestSlackIntegration" \
  component="test" \
  summary="Testing Slack notification from Alertmanager" \
  description="If you see this in Slack, the integration is working!" \
  --alertmanager.url=http://localhost:9093

# Check alert was created
amtool alert query --alertmanager.url=http://localhost:9093
```

**Expected:**
- Alert appears in Alertmanager UI (http://localhost:9093)
- Notification appears in Slack within 30-60 seconds (due to group_wait)

#### Method 3: Test Different Alert Routes
```bash
# Test critical alert
amtool alert add test_critical \
  severity=critical \
  alertname="TestCriticalAlert" \
  summary="Test critical alert" \
  --alertmanager.url=http://localhost:9093

# Test scraper alert
amtool alert add test_scraper \
  component=scraper \
  scraper_name="test-scraper" \
  severity=warning \
  alertname="TestScraperAlert" \
  summary="Test scraper alert" \
  --alertmanager.url=http://localhost:9093

# Test data quality alert
amtool alert add test_quality \
  component=data_quality \
  category=data_quality \
  severity=warning \
  alertname="TestDataQuality" \
  summary="Test data quality alert" \
  --alertmanager.url=http://localhost:9093
```

**Expected:**
- Critical alert → `#songnodes-critical` (with @channel)
- Scraper alert → `#songnodes-scraper-alerts`
- Data quality alert → `#songnodes-data-quality`

---

## Post-Deployment Verification

### 1. Configuration Health Check

```bash
# Check Alertmanager health
curl http://localhost:9093/-/healthy
# Expected: Healthy

# Check Alertmanager ready
curl http://localhost:9093/-/ready
# Expected: Ready

# Validate configuration
docker compose exec alertmanager amtool check-config /etc/alertmanager/alertmanager.yml
# Expected: SUCCESS
```

### 2. Metrics Check

```bash
# Check notification metrics
curl -s http://localhost:9093/metrics | grep alertmanager_notifications_total

# Expected: Counter exists, value > 0 after sending test alerts

# Check for notification failures
curl -s http://localhost:9093/metrics | grep alertmanager_notifications_failed_total

# Expected: Value should be 0 or very low
```

### 3. Slack Channel Verification

For each configured channel:
- [ ] Channel receives test alert
- [ ] Message format is correct (has emojis, formatting)
- [ ] Links (runbook, dashboard) are clickable
- [ ] @channel/@here mentions work (for critical/service-down)
- [ ] Resolved notifications arrive when alert clears

### 4. Routing Verification

Verify alerts route to correct channels:

| Alert Type | Expected Channel(s) | Test Command |
|:-----------|:-------------------|:-------------|
| Critical | `#critical` + `#alerts` | `severity=critical` |
| Scraper | `#scraper-alerts` | `component=scraper` |
| Data Quality | `#data-quality` | `category=data_quality` |
| Service Down | `#service-down` + `#critical` | `alertname=ServiceDown severity=critical` |
| Warning | `#warnings` | `severity=warning` |
| Info | `#info` | `severity=info` |

---

## Rollback Procedure

If issues occur, rollback to previous configuration:

```bash
cd /mnt/my_external_drive/programming/songnodes

# Stop Alertmanager
docker compose stop alertmanager

# Restore old configuration (if backup exists)
cp observability/alerting/alertmanager.yaml.backup observability/alerting/alertmanager.yaml

# Or revert to basic configuration with no notifications
git checkout observability/alerting/alertmanager.yaml

# Restart Alertmanager
docker compose up -d alertmanager

# Verify
docker compose logs alertmanager
```

---

## Monitoring Alertmanager Performance

### Key Metrics to Track

```bash
# Notification success rate
curl -s http://localhost:9093/metrics | grep alertmanager_notifications_total

# Notification latency
curl -s http://localhost:9093/metrics | grep alertmanager_notification_latency_seconds

# Active alerts
curl -s http://localhost:9093/metrics | grep 'alertmanager_alerts{state="active"}'

# Silences
curl -s http://localhost:9093/metrics | grep alertmanager_silences
```

### Grafana Dashboard

Import Alertmanager dashboard:
1. Go to http://localhost:3001
2. Click + → Import
3. Enter dashboard ID: `9578`
4. Select Prometheus data source
5. Click Import

---

## Troubleshooting

### Issue: No environment variables passed to container

**Symptoms:**
- Alerts logged in Alertmanager but not sent to Slack
- Webhook URL shows PLACEHOLDER in logs

**Solution:**
```bash
# Verify env_file is configured in docker-compose.yml
grep -A 5 "alertmanager:" docker-compose.yml | grep env_file

# If missing, add it
nano docker-compose.yml
# Add under alertmanager service:
#   env_file:
#     - .env

# Restart Alertmanager
docker compose restart alertmanager
```

### Issue: PLACEHOLDER_REPLACE_ME in logs

**Symptoms:**
```
sending webhook to https://hooks.slack.com/services/PLACEHOLDER_REPLACE_ME
```

**Solution:**
```bash
# Check if SLACK_WEBHOOK_URL is set
echo $SLACK_WEBHOOK_URL

# If empty, add to .env
echo 'SLACK_WEBHOOK_URL="https://hooks.slack.com/services/YOUR/WEBHOOK"' >> .env

# Restart Alertmanager
docker compose restart alertmanager
```

### Issue: Configuration validation error

**Symptoms:**
```
error checking config: <error message>
```

**Solution:**
```bash
# Validate configuration locally
docker compose exec alertmanager amtool check-config /etc/alertmanager/alertmanager.yml

# Check for YAML syntax errors
python3 -c "import yaml; yaml.safe_load(open('observability/alerting/alertmanager.yaml'))"

# Fix errors and restart
docker compose restart alertmanager
```

---

## Success Criteria

Deployment is considered successful when:

✅ **Configuration**
- [x] Alertmanager configuration validated
- [ ] Docker Compose updated with env_file
- [ ] Slack webhook URLs configured in .env
- [ ] Alertmanager restarted successfully

✅ **Testing**
- [ ] Direct webhook test successful
- [ ] Test alert received in default channel
- [ ] Critical alerts route to #critical channel
- [ ] Scraper alerts route to #scraper-alerts channel
- [ ] Resolved alerts show in Slack

✅ **Production Readiness**
- [ ] No configuration errors in logs
- [ ] Notification success rate > 99%
- [ ] All configured channels receiving alerts
- [ ] Team trained on silencing alerts
- [ ] Grafana dashboard imported
- [ ] On-call rotation established for critical channel

---

## Next Steps After Deployment

1. **Monitor Initial Performance**
   - Watch Alertmanager logs for 24 hours
   - Track notification success rate
   - Identify any routing issues

2. **Tune Alert Thresholds**
   - Adjust Prometheus alert rules if too noisy
   - Modify repeat_interval for different severity levels
   - Add inhibition rules if needed

3. **Document Runbooks**
   - Create runbook pages for common alerts
   - Update runbook_url in alert rules
   - Train team on runbook usage

4. **Establish On-Call Rotation**
   - Set up PagerDuty/OpsGenie for critical alerts
   - Define escalation policies
   - Configure on-call schedule

5. **Review and Optimize**
   - Review alert volume after 1 week
   - Gather team feedback on alert quality
   - Adjust routing rules as needed

---

## Support and Documentation

- **Setup Guide:** [SLACK_SETUP_GUIDE.md](./SLACK_SETUP_GUIDE.md)
- **Quick Reference:** [QUICK_REFERENCE.md](./QUICK_REFERENCE.md)
- **Implementation Summary:** [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)
- **Alertmanager Config:** [alertmanager.yaml](../../observability/alerting/alertmanager.yaml)

---

**Last Updated:** 2025-10-12
**Configuration Version:** 1.0
**Deployment Status:** ⏳ Awaiting deployment
