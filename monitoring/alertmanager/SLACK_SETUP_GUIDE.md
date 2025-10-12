# Slack Alerting Setup Guide for SongNodes Monitoring

This guide provides step-by-step instructions for configuring Slack webhook integration with Alertmanager for comprehensive scraper monitoring.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Obtaining Slack Webhook URLs](#obtaining-slack-webhook-urls)
3. [Configuration Options](#configuration-options)
4. [Deployment Methods](#deployment-methods)
5. [Slack Channel Setup](#slack-channel-setup)
6. [Testing Alerts](#testing-alerts)
7. [Troubleshooting](#troubleshooting)

---

## Quick Start

### Minimum Setup (Single Webhook)

**Use one webhook for all alerts:**

```bash
# Set environment variable
export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/YOUR/WEBHOOK/HERE"

# Restart Alertmanager
docker compose restart alertmanager

# Verify configuration loaded
curl http://localhost:9093/api/v1/status | jq .
```

### Recommended Setup (Multiple Webhooks)

**Use different webhooks for different alert types:**

```bash
# Add to .env file
SLACK_WEBHOOK_URL="https://hooks.slack.com/services/YOUR/DEFAULT/WEBHOOK"
SLACK_WEBHOOK_URL_CRITICAL="https://hooks.slack.com/services/YOUR/CRITICAL/WEBHOOK"
SLACK_WEBHOOK_URL_SCRAPERS="https://hooks.slack.com/services/YOUR/SCRAPER/WEBHOOK"
SLACK_WEBHOOK_URL_DATA_QUALITY="https://hooks.slack.com/services/YOUR/DATA_QUALITY/WEBHOOK"
```

---

## Obtaining Slack Webhook URLs

### Step 1: Create a Slack App

1. Go to [Slack API Apps](https://api.slack.com/apps)
2. Click **"Create New App"**
3. Select **"From scratch"**
4. Enter App Name: `SongNodes Alertmanager`
5. Select your workspace
6. Click **"Create App"**

### Step 2: Enable Incoming Webhooks

1. In your new app, navigate to **"Incoming Webhooks"** (left sidebar)
2. Toggle **"Activate Incoming Webhooks"** to **ON**
3. Scroll down and click **"Add New Webhook to Workspace"**
4. Select the channel where you want alerts to be posted
5. Click **"Allow"**
6. Copy the webhook URL (format: `https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX`)

### Step 3: Create Multiple Webhooks (Optional)

For better alert routing, create separate webhooks for different alert types:

**Recommended Slack Channels:**

| Channel Name | Purpose | Webhook Variable |
|:-------------|:--------|:-----------------|
| `#songnodes-alerts` | Default catch-all | `SLACK_WEBHOOK_URL` |
| `#songnodes-critical` | Critical P1/P0 incidents | `SLACK_WEBHOOK_URL_CRITICAL` |
| `#songnodes-scraper-alerts` | Scraper health/performance | `SLACK_WEBHOOK_URL_SCRAPERS` |
| `#songnodes-data-quality` | Data validation/schema | `SLACK_WEBHOOK_URL_DATA_QUALITY` |
| `#songnodes-extraction-alerts` | Scraping failures | `SLACK_WEBHOOK_URL_EXTRACTION` |
| `#songnodes-database-alerts` | Database issues | `SLACK_WEBHOOK_URL_DATABASE` |
| `#songnodes-infrastructure` | Container/system alerts | `SLACK_WEBHOOK_URL_INFRA` |
| `#songnodes-performance` | Performance degradation | `SLACK_WEBHOOK_URL_PERFORMANCE` |
| `#songnodes-service-down` | Service availability | `SLACK_WEBHOOK_URL_SERVICE_DOWN` |
| `#songnodes-warnings` | Warning-level alerts | `SLACK_WEBHOOK_URL_WARNINGS` |
| `#songnodes-info` | Informational alerts | `SLACK_WEBHOOK_URL_INFO` |

**To create each webhook:**

1. Return to your Slack app
2. Go to **"Incoming Webhooks"**
3. Click **"Add New Webhook to Workspace"**
4. Select the target channel
5. Copy the webhook URL
6. Repeat for each channel

---

## Configuration Options

### Option 1: Environment Variables (Recommended for Docker)

Add to your `.env` file in the project root:

```bash
# /mnt/my_external_drive/programming/songnodes/.env

# Minimum configuration (single webhook)
SLACK_WEBHOOK_URL="https://hooks.slack.com/services/YOUR/DEFAULT/WEBHOOK"

# Full configuration (all channels)
SLACK_WEBHOOK_URL_CRITICAL="https://hooks.slack.com/services/YOUR/CRITICAL/WEBHOOK"
SLACK_WEBHOOK_URL_SCRAPERS="https://hooks.slack.com/services/YOUR/SCRAPER/WEBHOOK"
SLACK_WEBHOOK_URL_DATA_QUALITY="https://hooks.slack.com/services/YOUR/DATA_QUALITY/WEBHOOK"
SLACK_WEBHOOK_URL_EXTRACTION="https://hooks.slack.com/services/YOUR/EXTRACTION/WEBHOOK"
SLACK_WEBHOOK_URL_DATABASE="https://hooks.slack.com/services/YOUR/DATABASE/WEBHOOK"
SLACK_WEBHOOK_URL_INFRA="https://hooks.slack.com/services/YOUR/INFRA/WEBHOOK"
SLACK_WEBHOOK_URL_PERFORMANCE="https://hooks.slack.com/services/YOUR/PERFORMANCE/WEBHOOK"
SLACK_WEBHOOK_URL_SERVICE_DOWN="https://hooks.slack.com/services/YOUR/SERVICE_DOWN/WEBHOOK"
SLACK_WEBHOOK_URL_GRAPH_API="https://hooks.slack.com/services/YOUR/GRAPH_API/WEBHOOK"
SLACK_WEBHOOK_URL_WEBSOCKET="https://hooks.slack.com/services/YOUR/WEBSOCKET/WEBHOOK"
SLACK_WEBHOOK_URL_WARNINGS="https://hooks.slack.com/services/YOUR/WARNINGS/WEBHOOK"
SLACK_WEBHOOK_URL_INFO="https://hooks.slack.com/services/YOUR/INFO/WEBHOOK"
```

### Option 2: Docker Compose Override

Create `docker-compose.override.yml`:

```yaml
version: '3.8'

services:
  alertmanager:
    environment:
      - SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/DEFAULT/WEBHOOK
      - SLACK_WEBHOOK_URL_CRITICAL=https://hooks.slack.com/services/YOUR/CRITICAL/WEBHOOK
```

### Option 3: Kubernetes Secrets

```bash
# Create secret
kubectl create secret generic alertmanager-slack \
  --from-literal=webhook-url='https://hooks.slack.com/services/YOUR/DEFAULT/WEBHOOK' \
  --from-literal=webhook-url-critical='https://hooks.slack.com/services/YOUR/CRITICAL/WEBHOOK' \
  -n songnodes

# Reference in deployment
env:
  - name: SLACK_WEBHOOK_URL
    valueFrom:
      secretKeyRef:
        name: alertmanager-slack
        key: webhook-url
```

---

## Deployment Methods

### Docker Compose Deployment

```bash
# 1. Add webhook URLs to .env file
nano /mnt/my_external_drive/programming/songnodes/.env

# 2. Restart Alertmanager to load new configuration
docker compose restart alertmanager

# 3. Verify Alertmanager is running
docker compose ps alertmanager

# 4. Check logs for configuration errors
docker compose logs alertmanager

# 5. Verify configuration is loaded
curl http://localhost:9093/api/v1/status | jq .
```

### Standalone Deployment

```bash
# Set environment variables
export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/YOUR/WEBHOOK"

# Start Alertmanager with environment variable expansion
docker run -d \
  --name alertmanager \
  -p 9093:9093 \
  -v /mnt/my_external_drive/programming/songnodes/monitoring/alertmanager:/etc/alertmanager \
  -e SLACK_WEBHOOK_URL="${SLACK_WEBHOOK_URL}" \
  prom/alertmanager:latest \
  --config.file=/etc/alertmanager/alertmanager.yml
```

### Kubernetes Deployment

```bash
# 1. Create ConfigMap with alertmanager.yml
kubectl create configmap alertmanager-config \
  --from-file=/mnt/my_external_drive/programming/songnodes/monitoring/alertmanager/alertmanager.yml \
  -n songnodes

# 2. Create Secret with webhook URLs
kubectl create secret generic alertmanager-slack \
  --from-literal=webhook-url='https://hooks.slack.com/services/YOUR/DEFAULT/WEBHOOK' \
  --from-literal=webhook-url-critical='https://hooks.slack.com/services/YOUR/CRITICAL/WEBHOOK' \
  -n songnodes

# 3. Apply deployment (see k8s/alertmanager-deployment.yml)
kubectl apply -f k8s/alertmanager-deployment.yml
```

---

## Slack Channel Setup

### Channel Configuration Recommendations

#### 1. Critical Alerts Channel (`#songnodes-critical`)

**Purpose:** P1/P0 incidents requiring immediate response

**Settings:**
- Enable **@channel** mentions (already configured in alertmanager.yml)
- Set up mobile push notifications for all members
- Pin runbook links to channel
- Add on-call rotation schedule to channel description

**Members:**
- All platform engineers
- On-call rotation
- Engineering leads

#### 2. Scraper Alerts Channel (`#songnodes-scraper-alerts`)

**Purpose:** Scraper health, performance, and operational issues

**Settings:**
- Standard notifications
- Integrate with scraper dashboard URL
- Pin common troubleshooting commands

**Members:**
- Data platform team
- Backend engineers
- DevOps team

#### 3. Data Quality Channel (`#songnodes-data-quality`)

**Purpose:** Schema validation, enrichment, and data integrity issues

**Settings:**
- Standard notifications
- Link to data quality dashboard
- Pin data quality SLAs

**Members:**
- Data platform team
- Data scientists
- QA team

#### 4. Warnings Channel (`#songnodes-warnings`)

**Purpose:** Non-critical issues that need attention but not immediate action

**Settings:**
- Muted by default (no mobile notifications)
- Daily digest review
- Auto-archive after 30 days

**Members:**
- All engineering team members

#### 5. Info Channel (`#songnodes-info`)

**Purpose:** Informational alerts, trends, and system changes

**Settings:**
- Fully muted
- Review on-demand
- Auto-archive after 7 days

**Members:**
- Optional for all team members

---

## Testing Alerts

### Method 1: Manual Alert Trigger (Recommended)

Use `amtool` (Alertmanager CLI tool) to send test alerts:

```bash
# Install amtool
go install github.com/prometheus/alertmanager/cmd/amtool@latest

# Send test critical alert
amtool alert add test_critical_alert \
  severity=critical \
  alertname="TestCriticalAlert" \
  scraper_name="test-scraper" \
  component="scraper" \
  summary="This is a test critical alert" \
  description="Testing Slack notification for critical alerts" \
  --alertmanager.url=http://localhost:9093

# Send test warning alert
amtool alert add test_warning_alert \
  severity=warning \
  alertname="TestWarningAlert" \
  component="scraper" \
  summary="This is a test warning alert" \
  --alertmanager.url=http://localhost:9093
```

### Method 2: Trigger Real Alert via Prometheus Query

```bash
# Access Prometheus container
docker compose exec prometheus sh

# Add temporary alert rule
cat > /tmp/test_alert.yml <<EOF
groups:
  - name: test
    rules:
      - alert: TestSlackIntegration
        expr: vector(1)
        labels:
          severity: warning
          component: test
        annotations:
          summary: "Test alert for Slack integration"
          description: "This is a test alert to verify Slack notifications"
EOF

# Reload Prometheus configuration
curl -X POST http://localhost:9090/-/reload
```

### Method 3: Direct Webhook Test

Test webhook connectivity directly:

```bash
# Replace with your actual webhook URL
WEBHOOK_URL="https://hooks.slack.com/services/YOUR/WEBHOOK/HERE"

# Send test notification
curl -X POST "${WEBHOOK_URL}" \
  -H 'Content-Type: application/json' \
  -d '{
    "text": "Test notification from SongNodes Alertmanager",
    "attachments": [
      {
        "color": "danger",
        "title": "Test Alert",
        "text": "If you see this, your Slack webhook is configured correctly!",
        "footer": "Alertmanager Test"
      }
    ]
  }'
```

### Expected Results

**Successful Test:**
- You should receive a Slack notification in the configured channel
- Message should include alert details (summary, description, severity)
- Message should have appropriate emoji and formatting
- If critical, message should include `@channel` mention

**Troubleshooting Failed Tests:**
See [Troubleshooting](#troubleshooting) section below.

---

## Troubleshooting

### Issue 1: No Alerts Received in Slack

**Symptoms:**
- Alertmanager shows alerts in UI (http://localhost:9093)
- No notifications in Slack channels

**Diagnosis:**

```bash
# 1. Check Alertmanager logs for errors
docker compose logs alertmanager | grep -i error

# 2. Check if webhook URL is loaded
curl http://localhost:9093/api/v1/status | jq '.config.receivers'

# 3. Test webhook directly (see Method 3 above)

# 4. Check Alertmanager configuration syntax
docker compose exec alertmanager amtool check-config /etc/alertmanager/alertmanager.yml
```

**Common Causes:**

1. **Environment variable not loaded:**
   ```bash
   # Solution: Verify .env file and restart
   docker compose down
   docker compose up -d alertmanager
   ```

2. **Invalid webhook URL:**
   ```bash
   # Solution: Verify URL format
   # Correct: https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX
   # Incorrect: Missing https:// or incomplete URL
   ```

3. **Slack app permissions revoked:**
   - Go to Slack API Apps
   - Reinstall app to workspace
   - Generate new webhook URLs

### Issue 2: Placeholder URL Still in Configuration

**Symptoms:**
- Alertmanager logs show: `sending webhook to https://hooks.slack.com/services/PLACEHOLDER_REPLACE_ME`

**Solution:**

```bash
# Check if environment variable is set
echo $SLACK_WEBHOOK_URL

# If empty, add to .env file
echo 'SLACK_WEBHOOK_URL="https://hooks.slack.com/services/YOUR/WEBHOOK/HERE"' >> .env

# Restart Alertmanager
docker compose restart alertmanager
```

### Issue 3: Wrong Channel Receiving Alerts

**Symptoms:**
- All alerts go to one channel regardless of severity

**Diagnosis:**

```bash
# Check routing configuration
curl http://localhost:9093/api/v1/status | jq '.config.route'
```

**Solution:**

Ensure you've configured channel-specific webhook URLs in `.env`:

```bash
# Each receiver needs its own webhook URL
SLACK_WEBHOOK_URL_CRITICAL="https://hooks.slack.com/services/CRITICAL/CHANNEL"
SLACK_WEBHOOK_URL_SCRAPERS="https://hooks.slack.com/services/SCRAPER/CHANNEL"
```

### Issue 4: Duplicate Alerts

**Symptoms:**
- Same alert appears in multiple Slack channels

**Explanation:**
- This is expected behavior for critical alerts (configured with `continue: true`)
- Critical alerts are sent to both `#songnodes-critical` and `#songnodes-alerts`

**To Disable:**
- Remove `continue: true` from critical route in `alertmanager.yml`

### Issue 5: Too Many Notifications

**Symptoms:**
- Slack channels flooded with alerts

**Solutions:**

1. **Increase `repeat_interval`:**
   ```yaml
   # In alertmanager.yml
   route:
     repeat_interval: 12h  # Instead of 4h
   ```

2. **Adjust alert thresholds in Prometheus:**
   ```yaml
   # In prometheus/alerts/*.yml
   # Change 'for' duration to reduce sensitivity
   - alert: ScraperHighErrorRate
     expr: rate(scraper_errors_total[10m]) > 0.1
     for: 30m  # Increased from 10m
   ```

3. **Use inhibition rules:**
   - Already configured in `alertmanager.yml`
   - Critical alerts suppress warnings for same issue

### Issue 6: Alertmanager Configuration Validation Errors

**Check configuration syntax:**

```bash
# Validate YAML syntax
docker compose exec alertmanager amtool check-config /etc/alertmanager/alertmanager.yml

# Expected output: "Checking '/etc/alertmanager/alertmanager.yml' SUCCESS"
```

**Common YAML errors:**
- Incorrect indentation (use spaces, not tabs)
- Missing colons after keys
- Unquoted strings with special characters

### Issue 7: Network Connectivity Issues

**Test Slack API reachability from container:**

```bash
# Access Alertmanager container
docker compose exec alertmanager sh

# Test DNS resolution
nslookup hooks.slack.com

# Test HTTPS connectivity
wget -O- https://hooks.slack.com

# If wget not available, use wget from host
wget -O- https://hooks.slack.com
```

**Solution for network issues:**
- Check firewall rules
- Verify Docker network configuration
- Ensure outbound HTTPS (port 443) is allowed

---

## Advanced Configuration

### Custom Alert Templates

You can customize Slack message formatting by modifying the `text` field in `alertmanager.yml`:

```yaml
receivers:
  - name: 'custom-format'
    slack_configs:
      - channel: '#custom-alerts'
        text: |
          🚨 *{{ .GroupLabels.alertname }}* 🚨

          *When:* {{ .CommonAnnotations.startsAt | humanizeTimestamp }}
          *Severity:* {{ .GroupLabels.severity | toUpper }}

          {{ range .Alerts }}
          • {{ .Annotations.summary }}
          {{ end }}

          <http://grafana:3000/d/scraper-health|📊 View Dashboard>
```

### Rate Limiting Notifications

To prevent Slack rate limiting (1 message per second per webhook):

```yaml
route:
  group_wait: 30s       # Batch alerts for 30s
  group_interval: 5m    # Batch updates every 5 minutes
```

### Silence Alerts

**Temporarily mute alerts:**

```bash
# Silence all scraper alerts for 2 hours
amtool silence add \
  component=scraper \
  --duration=2h \
  --comment="Scheduled maintenance" \
  --alertmanager.url=http://localhost:9093

# Silence specific scraper
amtool silence add \
  scraper_name=mixesdb-scraper \
  --duration=1h \
  --alertmanager.url=http://localhost:9093

# List active silences
amtool silence query --alertmanager.url=http://localhost:9093
```

---

## Monitoring Alertmanager Health

### Key Metrics to Monitor

```bash
# Alertmanager is exposing metrics on :9093/metrics

# Check notification success rate
curl -s http://localhost:9093/metrics | grep alertmanager_notifications_total

# Check notification failures
curl -s http://localhost:9093/metrics | grep alertmanager_notifications_failed_total

# Check alert grouping
curl -s http://localhost:9093/metrics | grep alertmanager_alerts
```

### Grafana Dashboard

Import Alertmanager dashboard (ID: 9578) in Grafana:

1. Go to http://localhost:3001 (Grafana)
2. Click **+** → **Import**
3. Enter dashboard ID: `9578`
4. Select Prometheus data source
5. Click **Import**

---

## Security Best Practices

### 1. Protect Webhook URLs

- **NEVER commit webhook URLs to Git**
- Store in `.env` file (already in `.gitignore`)
- Use environment variables or secrets management
- Rotate webhook URLs if exposed

### 2. Restrict Slack App Permissions

- Only grant "Incoming Webhooks" permission
- Do not enable "Bot Token" unless needed
- Review OAuth scopes regularly

### 3. Monitor Webhook Usage

- Enable Slack audit logs (Enterprise plan)
- Review webhook usage in Slack API dashboard
- Set up alerts for unusual activity

### 4. Use Separate Webhooks for Different Environments

```bash
# Development
SLACK_WEBHOOK_URL="https://hooks.slack.com/services/DEV/WEBHOOK"

# Staging
SLACK_WEBHOOK_URL="https://hooks.slack.com/services/STAGING/WEBHOOK"

# Production
SLACK_WEBHOOK_URL="https://hooks.slack.com/services/PROD/WEBHOOK"
```

---

## Summary

### Minimum Configuration Checklist

- [ ] Create Slack app and enable Incoming Webhooks
- [ ] Create webhook for `#songnodes-alerts` channel
- [ ] Add `SLACK_WEBHOOK_URL` to `.env` file
- [ ] Restart Alertmanager: `docker compose restart alertmanager`
- [ ] Test notification: `curl -X POST $SLACK_WEBHOOK_URL -d '{"text":"Test"}'`
- [ ] Verify in Slack channel

### Recommended Configuration Checklist

- [ ] Create 13 Slack channels (see [Slack Channel Setup](#slack-channel-setup))
- [ ] Create webhook for each channel
- [ ] Add all webhook URLs to `.env` file
- [ ] Configure channel notification preferences
- [ ] Restart Alertmanager
- [ ] Test critical alert (`amtool alert add`)
- [ ] Test warning alert
- [ ] Verify routing to correct channels
- [ ] Set up on-call rotation in critical channel
- [ ] Pin runbook links to channels

---

## Support and Resources

### Documentation Links

- [Alertmanager Configuration](https://prometheus.io/docs/alerting/latest/configuration/)
- [Slack Incoming Webhooks](https://api.slack.com/messaging/webhooks)
- [Alertmanager Templating](https://prometheus.io/docs/alerting/latest/notification_examples/)

### Configuration Files

- Alertmanager config: `/mnt/my_external_drive/programming/songnodes/monitoring/alertmanager/alertmanager.yml`
- Alert rules: `/mnt/my_external_drive/programming/songnodes/monitoring/prometheus/alerts/*.yml`
- Environment variables: `/mnt/my_external_drive/programming/songnodes/.env`

### Useful Commands

```bash
# Check Alertmanager status
curl http://localhost:9093/api/v1/status | jq .

# View active alerts
curl http://localhost:9093/api/v2/alerts | jq .

# View silences
curl http://localhost:9093/api/v2/silences | jq .

# Validate configuration
docker compose exec alertmanager amtool check-config /etc/alertmanager/alertmanager.yml

# Reload configuration (if supported)
curl -X POST http://localhost:9093/-/reload
```

---

**Last Updated:** 2025-10-12
**Configuration Version:** 1.0
**Alertmanager Version:** latest (compatible with v0.25+)
