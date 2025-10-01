# Browser Automation Data Collector - Integration Guide

## 🎯 Overview

The Browser Automation Data Collector is a new addition to SongNodes that provides **human-like browser automation** for collecting music data from websites that are difficult to scrape with traditional methods.

### Key Differences from Existing Scrapers

| Feature | Traditional Scrapers | Browser Collector |
|---------|---------------------|-------------------|
| **Method** | HTTP requests + HTML parsing | Real browser automation (Playwright) |
| **JavaScript** | Limited support | Full JavaScript execution |
| **Interactions** | None | Click, type, scroll, navigate |
| **CAPTCHA** | Fails | Can be solved manually (non-headless) |
| **Detection** | Easily detected as bot | Human-like behavior |
| **Extraction** | BeautifulSoup/regex | Local Ollama LLM |
| **Data Storage** | Direct to structured | Raw → Extraction → Structured |

## 🏗 Architecture Integration

```
┌─────────────────────────────────────────────────────────────────┐
│                    SongNodes Data Pipeline                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────┐      ┌──────────────┐      ┌──────────────┐  │
│  │ Traditional  │      │ Browser      │      │ NLP          │  │
│  │ Scrapers     │      │ Collector    │      │ Processor    │  │
│  │              │      │              │      │              │  │
│  │ • 1001       │      │ • Playwright │      │ • Claude API │  │
│  │ • Mixcloud   │      │ • Human-like │      │ • Fallback   │  │
│  │ • SoundCloud │      │ • Ollama LLM │      │              │  │
│  │ • Reddit     │      │              │      │              │  │
│  └──────┬───────┘      └──────┬───────┘      └──────┬───────┘  │
│         │                     │                     │           │
│         │                     │                     │           │
│         └─────────────────────┴─────────────────────┘           │
│                               │                                  │
│                       ┌───────▼────────┐                        │
│                       │  PostgreSQL    │                        │
│                       │  Raw + Struct  │                        │
│                       └────────────────┘                        │
└─────────────────────────────────────────────────────────────────┘
```

## 📦 Components

### 1. Database Schema (`sql/init/09-browser-collector-schema.sql`)

New tables for the collector:

- **`collection_sessions`** - Tracks browser automation sessions
- **`raw_collected_data`** - Stores complete HTML/text before extraction
- **`ollama_extraction_jobs`** - LLM extraction task tracking
- **`browser_interaction_logs`** - Detailed interaction logs for debugging
- **`collector_templates`** - Reusable collection strategies

### 2. Core Modules

#### `human_browser_navigator.py`
- Real browser control via Playwright
- Human-like timing (100-1500ms delays)
- Character-by-character typing
- Screenshot capture
- Multiple browser support (Chromium/Firefox/WebKit)

#### `ollama_extractor.py`
- Local LLM extraction (no API costs)
- Multiple extraction types (tracklist, artist, event, metadata)
- Confidence scoring
- Retry logic with exponential backoff
- Batch extraction support

#### `main.py`
- FastAPI service with REST endpoints
- Prometheus metrics integration
- Health checks
- Background task processing
- Database integration

### 3. Docker Service

Added to `docker-compose.yml`:
- Port: 8030
- Dependencies: postgres, redis, ollama
- Chrome browser pre-installed
- Screenshot volume mounted

## 🚀 Quick Start

### 1. Setup

```bash
# Run the setup script
cd /mnt/my_external_drive/programming/songnodes
./services/browser-collector/setup.sh
```

This will:
- Create necessary directories
- Apply database schema
- Pull Ollama models
- Build and start the service

### 2. Verify Installation

```bash
# Check service health
curl http://localhost:8030/health

# View logs
docker compose logs -f browser-collector

# Test collection
curl -X POST http://localhost:8030/collect \
  -H "Content-Type: application/json" \
  -d '{
    "session_name": "test",
    "collector_type": "tracklist_finder",
    "target_url": "https://www.1001tracklists.com",
    "extraction_type": "tracklist",
    "auto_extract": true
  }'
```

### 3. View Collected Data

```sql
-- Connect to database
docker compose exec postgres psql -U musicdb_user -d musicdb

-- View recent collections
SELECT
    cs.session_name,
    cs.started_at,
    cs.status,
    cs.total_pages_visited,
    cs.successful_extractions
FROM collection_sessions cs
ORDER BY started_at DESC
LIMIT 10;

-- View raw collected data
SELECT
    rcd.source_url,
    rcd.page_title,
    rcd.collection_method,
    rcd.extraction_status,
    rcd.llm_confidence_score,
    rcd.collected_at
FROM raw_collected_data rcd
ORDER BY collected_at DESC
LIMIT 10;

-- View extracted tracklists
SELECT
    rcd.source_url,
    oej.extraction_type,
    oej.extracted_data->'tracks' as tracks,
    oej.extracted_data->'metadata' as metadata,
    oej.confidence_score
FROM ollama_extraction_jobs oej
JOIN raw_collected_data rcd ON oej.raw_data_id = rcd.id
WHERE oej.extraction_type = 'tracklist'
  AND oej.status = 'completed'
ORDER BY oej.completed_at DESC
LIMIT 5;
```

## 🔗 Integration Patterns

### Pattern 1: Fallback for Failed Scrapers

Use browser collector when traditional scraping fails:

```python
# In your scraper code
from services.browser_collector.client import BrowserCollectorClient

async def scrape_with_fallback(url: str):
    try:
        # Try traditional scraping first
        data = await traditional_scraper.scrape(url)
        return data
    except Exception as e:
        logger.warning(f"Traditional scraping failed: {e}, using browser collector")

        # Fallback to browser automation
        client = BrowserCollectorClient("http://browser-collector:8030")
        result = await client.collect(
            url=url,
            extraction_type="tracklist",
            auto_extract=True
        )
        return result.extraction_result
```

### Pattern 2: CAPTCHA Handling

For sites with CAPTCHAs, use non-headless mode:

```python
result = await client.collect(
    url="https://difficult-site.com",
    browser_config={
        "headless": False  # Shows browser for manual CAPTCHA solving
    },
    navigation_steps=[
        # Wait for user to solve CAPTCHA manually
        {"type": "wait", "duration_ms": 30000},
        # Then continue automation
        {"type": "click", "selector": ".continue-button"}
    ]
)
```

### Pattern 3: Scheduled Collection

Integrate with scraper-orchestrator for scheduled collection:

```python
# In scraper-orchestrator/main.py

@app.post("/schedule/browser-collection")
async def schedule_browser_collection(urls: List[str]):
    """Schedule browser collection for multiple URLs"""

    for url in urls:
        # Queue browser collection task
        await queue_browser_collection(
            url=url,
            extraction_type="tracklist",
            priority="medium"
        )

    return {"status": "scheduled", "count": len(urls)}
```

### Pattern 4: Batch Processing

Process multiple URLs efficiently:

```python
import asyncio
from services.browser_collector.client import BrowserCollectorClient

async def batch_collect(urls: List[str]):
    client = BrowserCollectorClient()

    # Process in batches to avoid overwhelming the system
    batch_size = 3
    results = []

    for i in range(0, len(urls), batch_size):
        batch = urls[i:i+batch_size]
        batch_tasks = [
            client.collect(url, extraction_type="tracklist", headless=True)
            for url in batch
        ]

        batch_results = await asyncio.gather(*batch_tasks, return_exceptions=True)
        results.extend(batch_results)

        # Delay between batches
        await asyncio.sleep(10)

    return results
```

## 📊 Monitoring & Metrics

### Prometheus Metrics

Available at `http://localhost:8030/metrics`:

```promql
# Collection success rate
rate(collection_tasks_total{status="success"}[5m]) /
rate(collection_tasks_total[5m])

# Average collection duration
histogram_quantile(0.95, collection_duration_seconds_bucket)

# Extraction success rate
rate(extraction_tasks_total{status="success"}[5m]) /
rate(extraction_tasks_total[5m])

# Active collections
active_collections
```

### Grafana Dashboard

Create a dashboard with panels for:
1. Collection tasks over time
2. Extraction success rate
3. Average processing time
4. Active collections gauge
5. Ollama model usage

### Logging

Structured logs with correlation IDs:

```python
# View logs
docker compose logs -f browser-collector | jq

# Filter by session
docker compose logs browser-collector | jq 'select(.session_id == "xxx")'

# Filter by error
docker compose logs browser-collector | jq 'select(.level == "error")'
```

## 🎓 Use Cases

### 1. Sites with Heavy JavaScript

**Problem:** Site content loaded dynamically with JavaScript
**Solution:** Browser collector executes all JavaScript naturally

```bash
curl -X POST http://localhost:8030/collect \
  -H "Content-Type: application/json" \
  -d '{
    "target_url": "https://spa-website.com",
    "navigation_steps": [
      {"type": "wait_for_selector", "selector": ".loaded-content", "timeout_ms": 10000}
    ],
    "extraction_type": "tracklist"
  }'
```

### 2. Sites Requiring Authentication

**Problem:** Need to login before accessing content
**Solution:** Automate login flow

```json
{
  "navigation_steps": [
    {"type": "click", "selector": "#login-button"},
    {"type": "type", "selector": "input[name='username']", "text": "user"},
    {"type": "type", "selector": "input[name='password']", "text": "pass"},
    {"type": "click", "selector": "button[type='submit']"},
    {"type": "wait_for_selector", "selector": ".dashboard", "timeout_ms": 5000}
  ]
}
```

### 3. Complex Multi-Step Navigation

**Problem:** Data requires multiple page navigations
**Solution:** Chain navigation steps

```json
{
  "navigation_steps": [
    {"type": "click", "selector": ".search-button"},
    {"type": "type", "selector": "input[name='q']", "text": "Carl Cox"},
    {"type": "click", "selector": ".submit"},
    {"type": "wait_for_selector", "selector": ".results"},
    {"type": "click", "selector": ".result:first-child"},
    {"type": "wait", "duration_ms": 2000},
    {"type": "scroll", "direction": "down", "amount": 1000}
  ]
}
```

### 4. Data Quality Verification

**Problem:** Need to verify extracted data quality
**Solution:** Use confidence scores and screenshots

```sql
-- Find low-confidence extractions for review
SELECT
    rcd.source_url,
    rcd.screenshots,
    oej.confidence_score,
    oej.extracted_data
FROM ollama_extraction_jobs oej
JOIN raw_collected_data rcd ON oej.raw_data_id = rcd.id
WHERE oej.confidence_score < 0.7
  AND oej.status = 'completed'
ORDER BY oej.confidence_score ASC;
```

## 🔧 Configuration

### Environment Variables

```bash
# In .env file
DATABASE_URL=postgresql+asyncpg://musicdb_user:password@db:5432/musicdb
OLLAMA_URL=http://ollama:11434
REDIS_HOST=redis
REDIS_PORT=6379
```

### Browser Configuration

Customize in collection request:

```json
{
  "browser_config": {
    "browser_type": "chromium",     # or "firefox", "webkit"
    "headless": false,              # false = visible browser
    "viewport_width": 1920,
    "viewport_height": 1080,
    "use_real_chrome": true         # Use actual Chrome binary
  }
}
```

### Ollama Models

Recommended models by use case:

- **Fast extraction**: `llama3.2:3b` (3B parameters)
- **Accurate extraction**: `llama3.2:8b` (8B parameters)
- **Complex extraction**: `mistral:7b` (7B parameters)
- **Budget-friendly**: `phi3:3.8b` (3.8B parameters)

Pull models:
```bash
docker compose exec ollama ollama pull llama3.2:3b
docker compose exec ollama ollama pull mistral:7b
```

## 🐛 Troubleshooting

### Issue: Browser not launching

**Symptoms:** "Could not find browser" error
**Solution:**
```bash
# Verify Chrome is installed
docker compose exec browser-collector google-chrome --version

# Rebuild with fresh install
docker compose build --no-cache browser-collector
```

### Issue: Screenshots not saving

**Symptoms:** Empty screenshots array in results
**Solution:**
```bash
# Check volume permissions
ls -la ./data/browser-screenshots
chmod 777 ./data/browser-screenshots

# Verify container can write
docker compose exec browser-collector ls -la /app/screenshots
```

### Issue: Ollama extraction timeouts

**Symptoms:** "Extraction failed: timeout" errors
**Solution:**
```bash
# Check Ollama is running
docker compose ps ollama

# Verify model is loaded
docker compose exec ollama ollama list

# Pull model if missing
docker compose exec ollama ollama pull llama3.2:3b

# Increase timeout in request
{
  "ollama_model": "llama3.2:3b",
  "timeout": 300  # 5 minutes
}
```

### Issue: High memory usage

**Symptoms:** Browser collector using >2GB RAM
**Solution:**
```bash
# Use headless mode
{"browser_config": {"headless": true}}

# Reduce concurrent browsers
# Process in smaller batches

# Increase memory limit in docker-compose.yml
deploy:
  resources:
    limits:
      memory: 4G  # Increase from 2G
```

## 📈 Performance Optimization

### 1. Use Headless Mode in Production

```json
{
  "browser_config": {
    "headless": true,
    "collect_screenshots": false
  }
}
```

**Impact:** -50% memory, +30% speed

### 2. Reduce Human-Like Delays

Modify `HumanLikeDelays` for faster processing:

```python
delays = HumanLikeDelays(
    min_typing_delay_ms=50,      # Reduced from 100
    max_typing_delay_ms=150,     # Reduced from 300
    min_click_delay_ms=50,       # Reduced from 100
    max_click_delay_ms=200       # Reduced from 400
)
```

**Impact:** +40% speed, higher bot detection risk

### 3. Batch Extractions

Process multiple raw data items in one batch:

```python
await ollama_extractor.batch_extract(
    items=[
        {"raw_text": text1, "context": {}},
        {"raw_text": text2, "context": {}}
    ],
    extraction_type="tracklist",
    concurrency=3
)
```

**Impact:** Better throughput, shared Ollama context

### 4. Use Smaller Models

```json
{
  "ollama_model": "llama3.2:3b"  # Instead of 7b or 70b
}
```

**Impact:** -70% extraction time, slightly lower accuracy

## 🔐 Security Considerations

1. **Browser isolation** - Runs in Docker container
2. **No external APIs** - Ollama is local, no data leaves infrastructure
3. **Raw data persistence** - Full audit trail of collected data
4. **Screenshot storage** - Evidence of what was collected
5. **Interaction logs** - Complete record of browser actions

## 📚 Additional Resources

- **Full Documentation**: `services/browser-collector/README.md`
- **Example Scripts**: `services/browser-collector/examples/`
- **Setup Script**: `services/browser-collector/setup.sh`
- **Playwright Docs**: https://playwright.dev/python/
- **Ollama Models**: https://ollama.com/library

## 🎉 Summary

The Browser Automation Data Collector adds powerful capabilities to SongNodes:

✅ **Handles JavaScript-heavy sites**
✅ **Human-like interactions bypass bot detection**
✅ **CAPTCHA can be solved manually**
✅ **Raw data persistence before extraction**
✅ **Local LLM extraction (no API costs)**
✅ **Full integration with existing pipeline**
✅ **Complete observability (Prometheus + logs)**
✅ **Screenshot evidence of collections**

Use it for sites that traditional scrapers can't handle, and enjoy the flexibility of raw data storage combined with intelligent Ollama extraction!
