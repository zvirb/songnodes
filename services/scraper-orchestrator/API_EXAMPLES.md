# Enhanced Scraper Orchestrator API Examples

This document provides practical examples for using the enhanced scraper orchestrator API with robots.txt compliance and intelligent scheduling.

## Base URL

```
http://localhost:8001
```

## Quick Start Commands

### 1. Check System Health

```bash
# Basic health check
curl http://localhost:8001/health

# Response:
{
  "status": "healthy",
  "timestamp": "2025-01-19T22:45:00.123456",
  "automated_scheduling": true,
  "robots_compliance": true
}
```

### 2. Get Orchestrator Status

```bash
# Comprehensive status
curl http://localhost:8001/status

# Response includes:
# - All scraper configurations
# - Scheduled jobs with next run times
# - Queue statistics
# - Domain health metrics
```

## Scraper Management

### List All Scrapers

```bash
curl http://localhost:8001/scrapers

# Response:
{
  "scrapers": {
    "1001tracklists": {
      "name": "1001tracklists",
      "enabled": true,
      "min_interval": 3600,
      "max_interval": 86400,
      "priority": "high",
      "domains": ["1001tracklists.com"],
      "respect_robots": true,
      "adaptive_scheduling": true
    }
  }
}
```

### Get Specific Scraper Details

```bash
curl http://localhost:8001/scrapers/1001tracklists

# Response includes:
# - Configuration details
# - Next scheduled run time
# - Domain health metrics
# - Robots.txt compliance status
```

### Update Scraper Configuration

```bash
# Enable adaptive scheduling with custom intervals
curl -X PATCH http://localhost:8001/scrapers/mixesdb \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": true,
    "min_interval": 7200,
    "max_interval": 172800,
    "priority": "medium",
    "adaptive_scheduling": true
  }'

# Disable a scraper temporarily
curl -X PATCH http://localhost:8001/scrapers/reddit \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": false
  }'

# Increase rate limiting for problematic domain
curl -X PATCH http://localhost:8001/scrapers/setlistfm \
  -H "Content-Type: application/json" \
  -d '{
    "min_interval": 14400,
    "max_concurrent_pages": 1
  }'
```

## Robots.txt Compliance

### Check URL Permissions

```bash
# Check if specific URL is allowed
curl -X POST http://localhost:8001/robots/check \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://1001tracklists.com/tracklist/123456",
    "user_agent": "SongNodes-Bot/1.0"
  }'

# Response:
{
  "url": "https://1001tracklists.com/tracklist/123456",
  "allowed": true,
  "crawl_delay": 10.0,
  "user_agent": "SongNodes-Bot/1.0"
}
```

### Get Domain Statistics

```bash
# View robots.txt compliance stats for all domains
curl http://localhost:8001/robots/stats

# Response:
{
  "domain_statistics": {
    "1001tracklists.com": {
      "domain": "1001tracklists.com",
      "total_requests": 150,
      "successful_requests": 145,
      "error_count": 5,
      "rate_limit_hits": 0,
      "avg_response_time": 2.1,
      "success_rate": 96.7,
      "last_request": "2025-01-19T22:30:00"
    }
  }
}
```

## Scheduling Control

### Schedule Immediate Execution

```bash
# Run scraper immediately
curl -X POST http://localhost:8001/schedule \
  -H "Content-Type: application/json" \
  -d '{
    "scraper_name": "mixesdb",
    "immediate": true
  }'

# Response:
{
  "status": "executed",
  "scraper": "mixesdb",
  "timestamp": "2025-01-19T22:45:00"
}
```

### Schedule Next Interval

```bash
# Schedule for next calculated interval
curl -X POST http://localhost:8001/schedule \
  -H "Content-Type: application/json" \
  -d '{
    "scraper_name": "1001tracklists",
    "immediate": false
  }'

# Response:
{
  "status": "scheduled",
  "scraper": "1001tracklists",
  "next_run": "2025-01-20T02:30:00"
}
```

### Stop Scheduling

```bash
# Disable automatic scheduling for a scraper
curl -X DELETE http://localhost:8001/schedule/reddit

# Response:
{
  "status": "unscheduled",
  "scraper": "reddit"
}
```

## History and Monitoring

### Get Execution History

```bash
# Get last 50 executions for a scraper
curl "http://localhost:8001/history/1001tracklists?limit=50"

# Response:
{
  "scraper": "1001tracklists",
  "history": [
    {
      "timestamp": "2025-01-19T22:00:00",
      "duration": 45.2,
      "status": "success",
      "pages_scraped": 25,
      "items_found": 127
    }
  ],
  "count": 1
}
```

### Monitor Queue Status

```bash
# Get current task queue status
curl http://localhost:8001/queue

# Response:
{
  "queue_stats": {
    "total_tasks": 5,
    "domains_queued": 3,
    "domains_processing": 1,
    "queue_by_domain": {
      "1001tracklists.com": 2,
      "mixesdb.com": 1,
      "setlist.fm": 2
    }
  }
}
```

## System Control

### Pause All Scrapers

```bash
# Pause automatic scheduling
curl -X POST http://localhost:8001/pause

# Response:
{
  "status": "paused",
  "timestamp": "2025-01-19T22:45:00"
}
```

### Resume All Scrapers

```bash
# Resume automatic scheduling
curl -X POST http://localhost:8001/resume

# Response:
{
  "status": "resumed",
  "timestamp": "2025-01-19T22:46:00"
}
```

## Metrics and Observability

### Prometheus Metrics

```bash
# Get Prometheus-format metrics
curl http://localhost:8001/metrics

# Sample output:
# HELP scrapers_scheduled_total Total number of scheduled scrapers
# TYPE scrapers_scheduled_total gauge
scrapers_scheduled_total 4

# HELP domain_success_rate Success rate for domain
# TYPE domain_success_rate gauge
domain_success_rate{domain="1001tracklists.com"} 96.7
```

## Advanced Usage Scenarios

### 1. Handling Rate Limits

If a domain starts returning 429 errors:

```bash
# Check domain health
curl http://localhost:8001/scrapers/problematic-scraper

# Increase minimum interval
curl -X PATCH http://localhost:8001/scrapers/problematic-scraper \
  -H "Content-Type: application/json" \
  -d '{
    "min_interval": 14400,
    "max_concurrent_pages": 1
  }'

# Monitor improvement
curl http://localhost:8001/robots/stats
```

### 2. Emergency Stop

To immediately stop all scraping:

```bash
# Pause all scheduling
curl -X POST http://localhost:8001/pause

# Disable all scrapers
for scraper in 1001tracklists mixesdb setlistfm reddit; do
  curl -X PATCH http://localhost:8001/scrapers/$scraper \
    -H "Content-Type: application/json" \
    -d '{"enabled": false}'
done
```

### 3. Monitoring Setup

Create a monitoring script:

```bash
#!/bin/bash

echo "=== Orchestrator Status ==="
curl -s http://localhost:8001/status | jq '.scrapers | to_entries[] | {name: .key, enabled: .value.enabled, next_run: .value.next_run}'

echo -e "\n=== Domain Health ==="
curl -s http://localhost:8001/robots/stats | jq '.domain_statistics | to_entries[] | {domain: .key, success_rate: .value.success_rate, rate_limits: .value.rate_limit_hits}'

echo -e "\n=== Queue Status ==="
curl -s http://localhost:8001/queue | jq '.queue_stats'
```

### 4. Bulk Configuration Update

Update multiple scrapers for maintenance window:

```bash
#!/bin/bash

# Increase intervals for maintenance period
scrapers=("1001tracklists" "mixesdb" "setlistfm" "reddit")

for scraper in "${scrapers[@]}"; do
  curl -X PATCH http://localhost:8001/scrapers/$scraper \
    -H "Content-Type: application/json" \
    -d '{
      "min_interval": 21600,
      "max_interval": 86400,
      "max_concurrent_pages": 1
    }'
  echo "Updated $scraper for maintenance mode"
done
```

## Response Codes

- `200 OK`: Request successful
- `400 Bad Request`: Invalid request parameters
- `404 Not Found`: Scraper not found
- `500 Internal Server Error`: Server error
- `503 Service Unavailable`: Scheduler not initialized

## Error Handling

Always check response status and handle errors appropriately:

```bash
response=$(curl -s -w "%{http_code}" http://localhost:8001/scrapers/invalid)
status_code=${response: -3}

if [ "$status_code" -eq 200 ]; then
  echo "Success: ${response%???}"
elif [ "$status_code" -eq 404 ]; then
  echo "Error: Scraper not found"
else
  echo "Error: HTTP $status_code"
fi
```

## Integration with Monitoring Systems

### Grafana Dashboard Query Examples

```promql
# Success rate by domain
domain_success_rate

# Queue size over time
queue_size_total

# Rate limit incidents
increase(domain_rate_limits[1h])

# Scraper health
scrapers_enabled_total / scrapers_scheduled_total * 100
```

### Alerting Rules

```yaml
groups:
  - name: scraper_alerts
    rules:
      - alert: ScraperSuccessRateLow
        expr: domain_success_rate < 80
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Low success rate for domain {{ $labels.domain }}"

      - alert: HighRateLimits
        expr: increase(domain_rate_limits[1h]) > 5
        for: 0m
        labels:
          severity: critical
        annotations:
          summary: "High rate limit hits for domain {{ $labels.domain }}"
```

This API provides comprehensive control over the automated scraping system while maintaining ethical compliance with robots.txt and intelligent adaptation to server conditions.