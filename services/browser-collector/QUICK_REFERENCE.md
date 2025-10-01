# Browser Collector - Quick Reference

## 🚀 Quick Start

```bash
# Setup (one-time)
./services/browser-collector/setup.sh

# Start service
docker compose up -d browser-collector

# Check health
curl http://localhost:8030/health

# Simple collection
curl -X POST http://localhost:8030/collect \
  -H "Content-Type: application/json" \
  -d '{"session_name": "test", "collector_type": "tracklist_finder", "target_url": "https://www.1001tracklists.com", "extraction_type": "tracklist", "auto_extract": true}'
```

## 📋 Navigation Step Types

| Type | Purpose | Required Params | Optional |
|------|---------|----------------|----------|
| `click` | Click element | `selector` | `text`, `screenshot` |
| `type` | Type text | `selector`, `text` | `clear` |
| `scroll` | Scroll page | `direction` | `amount` |
| `wait` | Pause | `duration_ms` | - |
| `wait_for_selector` | Wait for element | `selector` | `timeout_ms` |
| `select` | Select dropdown | `selector`, `value` | - |
| `hover` | Hover element | `selector` | - |

## 🎯 Extraction Types

### Tracklist
```json
{
  "tracks": [
    {"position": 1, "artist": "...", "title": "...", "time": "12:34"}
  ],
  "metadata": {
    "dj_name": "...",
    "event_name": "...",
    "date": "2024-10-01"
  }
}
```

### Artist
```json
{
  "artist_name": "...",
  "genres": ["Techno", "House"],
  "biography": "...",
  "links": {"website": "...", "soundcloud": "..."},
  "record_labels": ["..."]
}
```

### Event
```json
{
  "event_name": "...",
  "date": "2024-10-15",
  "venue": "...",
  "location": "City, Country",
  "lineup": ["Artist1", "Artist2"],
  "ticket_link": "..."
}
```

### Metadata
```json
{
  "title": "...",
  "artist": "...",
  "bpm": 128,
  "key": "Am",
  "genre": "Techno",
  "label": "...",
  "year": 2024
}
```

## 🔧 Common Configurations

### Development (Visible Browser)
```json
{
  "browser_config": {
    "headless": false,
    "viewport_width": 1920,
    "viewport_height": 1080
  },
  "collect_screenshots": true
}
```

### Production (Headless)
```json
{
  "browser_config": {
    "headless": true
  },
  "collect_screenshots": false
}
```

### Fast Testing
```json
{
  "ollama_model": "llama3.2:3b",
  "browser_config": {"headless": true},
  "collect_screenshots": false
}
```

## 📊 Useful Database Queries

### Recent Collections
```sql
SELECT session_name, started_at, status, successful_extractions
FROM collection_sessions
ORDER BY started_at DESC LIMIT 10;
```

### Extraction Results
```sql
SELECT rcd.source_url, oej.extraction_type, oej.confidence_score,
       oej.extracted_data
FROM ollama_extraction_jobs oej
JOIN raw_collected_data rcd ON oej.raw_data_id = rcd.id
WHERE oej.status = 'completed'
ORDER BY oej.completed_at DESC LIMIT 10;
```

### Low Confidence Extractions
```sql
SELECT source_url, extraction_status, llm_confidence_score, page_title
FROM raw_collected_data
WHERE llm_confidence_score < 0.7
  AND extraction_status = 'completed'
ORDER BY llm_confidence_score ASC;
```

### Collection Stats (Today)
```sql
SELECT
    COUNT(*) as total,
    AVG(total_duration_ms) as avg_duration,
    SUM(successful_extractions) as total_extractions
FROM collection_sessions
WHERE started_at > CURRENT_DATE;
```

## 🐛 Troubleshooting Commands

```bash
# View logs
docker compose logs -f browser-collector

# Check service status
docker compose ps browser-collector

# Restart service
docker compose restart browser-collector

# Rebuild service
docker compose build --no-cache browser-collector
docker compose up -d browser-collector

# Check Ollama models
docker compose exec ollama ollama list

# Pull Ollama model
docker compose exec ollama ollama pull llama3.2:3b

# Check PostgreSQL connection
docker compose exec postgres psql -U musicdb_user -d musicdb -c "SELECT COUNT(*) FROM collection_sessions;"

# View screenshots
ls -lh ./data/browser-screenshots/

# Check disk space
docker compose exec browser-collector df -h

# View service metrics
curl http://localhost:8030/metrics

# Test health
curl http://localhost:8030/health | jq
```

## 🎓 Example Workflows

### 1. Search and Navigate
```bash
curl -X POST http://localhost:8030/collect \
  -H "Content-Type: application/json" \
  -d '{
    "session_name": "search_example",
    "collector_type": "tracklist_finder",
    "target_url": "https://www.1001tracklists.com",
    "navigation_steps": [
      {"type": "click", "selector": "input[name=\"q\"]"},
      {"type": "type", "selector": "input[name=\"q\"]", "text": "Carl Cox"},
      {"type": "click", "selector": "button[type=\"submit\"]"},
      {"type": "wait_for_selector", "selector": ".result", "timeout_ms": 10000},
      {"type": "click", "selector": ".result:first-child a"}
    ],
    "extraction_type": "tracklist",
    "auto_extract": true
  }'
```

### 2. Re-extract with Custom Prompt
```bash
# Get raw_data_id from previous collection
RAW_ID="your-uuid-here"

curl -X POST http://localhost:8030/extract/$RAW_ID \
  -H "Content-Type: application/json" \
  -d '{
    "extraction_type": "custom",
    "ollama_model": "llama3.2:3b",
    "custom_prompt": "Extract all DJ names and track titles. Return as JSON array."
  }'
```

### 3. Batch Collection (Python)
```python
import asyncio
import httpx

async def batch_collect():
    urls = [
        "https://example.com/tracklist1",
        "https://example.com/tracklist2",
        "https://example.com/tracklist3"
    ]

    async with httpx.AsyncClient(timeout=300) as client:
        tasks = []
        for url in urls:
            task = client.post(
                "http://localhost:8030/collect",
                json={
                    "session_name": f"batch_{url.split('/')[-1]}",
                    "target_url": url,
                    "extraction_type": "tracklist",
                    "auto_extract": True,
                    "browser_config": {"headless": True}
                }
            )
            tasks.append(task)

        results = await asyncio.gather(*tasks)
        return [r.json() for r in results]

asyncio.run(batch_collect())
```

## 📈 Performance Tips

| Scenario | Configuration | Impact |
|----------|--------------|--------|
| Fast testing | `headless: true`, `llama3.2:3b`, no screenshots | +50% speed |
| High accuracy | `llama3.2:7b`, full screenshots | +30% accuracy, -50% speed |
| Batch processing | Headless, smaller batches (3-5), delays between | Avoid detection |
| Low memory | Headless, no screenshots, smaller model | -50% memory |
| Avoid detection | `headless: false`, full delays, real Chrome | Most human-like |

## 🔗 Integration Snippets

### With Scraper Orchestrator
```python
async def fallback_to_browser(url: str):
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "http://browser-collector:8030/collect",
            json={
                "session_name": f"fallback_{url}",
                "target_url": url,
                "extraction_type": "tracklist",
                "auto_extract": True
            }
        )
        return response.json()
```

### With Scheduled Tasks
```python
from apscheduler.schedulers.asyncio import AsyncIOScheduler

scheduler = AsyncIOScheduler()

@scheduler.scheduled_job('cron', hour=2)  # 2 AM daily
async def daily_collection():
    urls = get_urls_to_collect()
    for url in urls:
        await browser_collector_client.collect(url)

scheduler.start()
```

## 🎨 Ollama Models

| Model | Size | Speed | Accuracy | Use Case |
|-------|------|-------|----------|----------|
| `llama3.2:3b` | 3GB | ⚡⚡⚡ | ⭐⭐⭐ | Fast extraction |
| `llama3.2:8b` | 8GB | ⚡⚡ | ⭐⭐⭐⭐ | Balanced |
| `mistral:7b` | 7GB | ⚡⚡ | ⭐⭐⭐⭐ | Complex extraction |
| `phi3:3.8b` | 4GB | ⚡⚡⚡ | ⭐⭐⭐ | Budget-friendly |

Pull models:
```bash
docker compose exec ollama ollama pull MODEL_NAME
```

## 📞 Support & Resources

- **Full Docs**: `services/browser-collector/README.md`
- **Architecture**: `services/browser-collector/ARCHITECTURE.md`
- **Integration Guide**: `BROWSER_COLLECTOR_GUIDE.md`
- **Examples**: `services/browser-collector/examples/`
- **Playwright Docs**: https://playwright.dev/python/
- **Ollama Models**: https://ollama.com/library

## ⚙️ Environment Variables

```bash
# .env file
DATABASE_URL=postgresql+asyncpg://user:pass@db:5432/musicdb
OLLAMA_URL=http://ollama:11434
REDIS_HOST=redis
REDIS_PORT=6379
POSTGRES_PASSWORD=your_password
```

## 🎯 Common Use Cases

1. **JavaScript-heavy sites** → Full browser execution handles dynamic content
2. **CAPTCHA sites** → Non-headless mode allows manual solving
3. **Multi-step navigation** → Chain navigation steps
4. **Fallback scraping** → Use when traditional methods fail
5. **Data verification** → Screenshots prove what was collected

## 🔒 Security Checklist

- ✅ Browser runs in isolated container
- ✅ No external API calls (local Ollama)
- ✅ Complete audit trail in database
- ✅ Screenshot evidence stored
- ✅ Secrets managed centrally
- ✅ Network isolation via Docker
- ✅ Resource limits enforced

## 📊 Monitoring URLs

- Health: `http://localhost:8030/health`
- Metrics: `http://localhost:8030/metrics`
- Logs: `docker compose logs -f browser-collector`
- Grafana: Add Prometheus target at `:8030/metrics`

---

**Quick Help:**
```bash
# Is service running?
docker compose ps browser-collector

# What's wrong?
docker compose logs --tail=50 browser-collector

# Restart everything
docker compose restart browser-collector ollama postgres

# Clean start
docker compose down browser-collector
docker compose up -d browser-collector
```
