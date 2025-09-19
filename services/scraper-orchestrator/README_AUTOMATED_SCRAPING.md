# Automated Scraping System with Robots.txt Compliance

## Overview

The enhanced scraper orchestrator provides intelligent, automated web scraping that respects website robots.txt files and implements adaptive rate limiting to prevent overloading target servers.

## Key Features

### 🤖 Robots.txt Compliance
- Automatically fetches and parses robots.txt for each domain
- Respects Crawl-Delay and Request-Rate directives
- Caches robots.txt files for 24 hours to minimize requests
- User-Agent specific rule matching

### 📊 Adaptive Rate Limiting
- Monitors server response times and adjusts delays accordingly
- Implements exponential backoff on rate limit errors (429, 403)
- Tracks domain-specific health metrics:
  - Success rates
  - Average response times
  - Rate limit encounters
  - Error patterns

### 🎯 Intelligent Scheduling
- Calculates optimal scraping intervals based on:
  - Robots.txt requirements
  - Domain health statistics
  - Historical performance data
  - Server load indicators
- Automatically adjusts intervals between configured min/max bounds

### 🔄 Domain-Based Queue Management
- Separate queues per domain to prevent concurrent requests
- Priority-based task scheduling
- Automatic retry with exponential backoff

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│                 │     │                  │     │                 │
│  Main Enhanced  │────▶│ Automated        │────▶│ Robots Parser   │
│  Orchestrator   │     │ Scheduler        │     │ & Rate Limiter  │
│                 │     │                  │     │                 │
└─────────────────┘     └──────────────────┘     └─────────────────┘
        │                       │                         │
        │                       ▼                         ▼
        │               ┌──────────────────┐     ┌─────────────────┐
        │               │                  │     │                 │
        └──────────────▶│ Redis State      │     │ Domain Stats    │
                        │ Persistence      │     │ Tracking        │
                        │                  │     │                 │
                        └──────────────────┘     └─────────────────┘
```

## Components

### 1. robots_parser.py
- **RobotRules**: Parsed robots.txt rules with pattern matching
- **DomainStats**: Tracks performance metrics per domain
- **RobotsChecker**: Main class for robots.txt compliance
- **SmartScheduler**: Domain-based task queue management

### 2. automated_scheduler.py
- **ScraperConfig**: Configuration for each scraper
- **AutomatedScrapingScheduler**: Manages scheduled scraping jobs
- Calculates adaptive intervals based on multiple factors
- Integrates with APScheduler for periodic execution

### 3. main_enhanced.py
- Enhanced FastAPI application with comprehensive API
- RESTful endpoints for configuration and monitoring
- Real-time status updates and metrics
- Manual control capabilities (pause/resume)

## Deployment

### Using Docker Compose Overlay

```bash
# Deploy with enhanced orchestrator
docker-compose -f docker-compose.yml \
               -f docker-compose.enhanced-orchestrator.yml \
               up -d

# Check orchestrator status
curl http://localhost:8001/status

# View robots.txt statistics
curl http://localhost:8001/robots/stats
```

### Configuration

Environment variables:
- `ENABLE_ROBOTS_COMPLIANCE`: Enable robots.txt checking (default: true)
- `ENABLE_ADAPTIVE_SCHEDULING`: Enable intelligent scheduling (default: true)
- `DEFAULT_MIN_INTERVAL`: Minimum seconds between scrapes (default: 3600)
- `DEFAULT_MAX_INTERVAL`: Maximum seconds between scrapes (default: 86400)

## API Endpoints

### Core Endpoints

#### GET /status
Returns comprehensive orchestrator status including:
- Active scrapers and their configurations
- Scheduled jobs with next run times
- Queue statistics
- Domain health metrics

#### GET /scrapers
List all configured scrapers with their settings

#### PATCH /scrapers/{scraper_name}
Update scraper configuration:
```json
{
  "enabled": true,
  "min_interval": 7200,
  "max_interval": 86400,
  "priority": "high",
  "respect_robots": true
}
```

### Robots.txt Compliance

#### POST /robots/check
Check if a URL is allowed:
```json
{
  "url": "https://example.com/path",
  "user_agent": "SongNodes-Bot/1.0"
}
```

#### GET /robots/stats
Get robots.txt statistics for all monitored domains

### Scheduling Control

#### POST /schedule
Schedule or immediately run a scraper:
```json
{
  "scraper_name": "mixesdb",
  "immediate": false
}
```

#### DELETE /schedule/{scraper_name}
Stop scheduling a specific scraper

### Monitoring

#### GET /history/{scraper_name}
Get execution history with performance metrics

#### GET /queue
View current task queue status by domain

#### GET /metrics
Prometheus-compatible metrics endpoint

## Adaptive Behavior

The system automatically adjusts scraping behavior based on:

1. **Server Response**: Slower response times increase delays
2. **Error Rates**: High error rates trigger longer backoffs
3. **Rate Limits**: 429/403 responses exponentially increase delays
4. **Success Rates**: Consistent success allows faster scraping
5. **Time of Day**: Can adjust based on traffic patterns

## Example Interval Calculation

For a domain with:
- Robots.txt crawl-delay: 10 seconds
- Recent 429 rate limit error
- Average response time: 3 seconds
- Success rate: 85%

The system might calculate:
- Base delay: 10 seconds (from robots.txt)
- Rate limit factor: 1.5x (due to recent 429)
- Response time factor: 1.2x (slower responses)
- Final delay: ~18 seconds

## Monitoring and Observability

### Metrics Available
- `scrapers_scheduled_total`: Number of scheduled scrapers
- `scrapers_enabled_total`: Number of enabled scrapers
- `queue_size_total`: Current task queue size
- `domain_success_rate`: Per-domain success rates
- `domain_rate_limits`: Rate limit encounters by domain

### Health Monitoring
```bash
# Check orchestrator health
curl http://localhost:8001/health

# Get detailed status
curl http://localhost:8001/orchestration/status
```

## Best Practices

1. **Start Conservative**: Begin with longer intervals and decrease gradually
2. **Monitor Domain Health**: Check `/robots/stats` regularly
3. **Respect Rate Limits**: Never disable robots.txt compliance
4. **Use Priority Wisely**: Reserve high priority for time-sensitive tasks
5. **Review Logs**: Check for patterns in failures or rate limits

## Troubleshooting

### High Rate Limit Errors
- Check domain health: `GET /scrapers/{scraper_name}`
- Increase min_interval for affected scraper
- Review robots.txt rules: `POST /robots/check`

### Slow Scraping
- Check queue status: `GET /queue`
- Verify scraper health: `GET /scrapers/status`
- Review domain statistics for bottlenecks

### Failed Tasks
- Check task history: `GET /history/{scraper_name}`
- Review error patterns in logs
- Adjust retry settings if needed

## Ethical Scraping

This system is designed to be a good web citizen by:
- Always respecting robots.txt
- Implementing intelligent rate limiting
- Adapting to server conditions
- Providing clear User-Agent identification
- Caching appropriately to minimize requests

Remember: The goal is sustainable, long-term data collection that doesn't negatively impact target websites.