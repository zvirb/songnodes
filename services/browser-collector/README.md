# Browser Automation Data Collector

Human-like browser automation for collecting music data with local Ollama LLM extraction.

## Overview

This service provides intelligent browser automation that:
1. **Navigates like a human** - Uses your actual Chrome browser with realistic delays, typing, clicking
2. **Collects raw data** - Stores complete HTML and text before processing
3. **Extracts with Ollama** - Uses local LLM to extract structured data from raw content
4. **Integrates with pipeline** - Works alongside existing scrapers in the SongNodes ecosystem

## Key Features

- 🤖 **Human-like interactions** - Variable delays, character-by-character typing, smooth scrolling
- 🔍 **Visual browser** - Runs non-headless by default for debugging and CAPTCHA solving
- 📸 **Screenshot capture** - Full-page screenshots at each step for verification
- 🧠 **Local LLM extraction** - No API costs, fully private data processing
- 💾 **Raw data persistence** - Complete data stored before extraction
- 📊 **Prometheus metrics** - Full observability integration

## Architecture

```
┌─────────────────┐      ┌──────────────────┐      ┌─────────────┐
│ Browser         │      │ Browser          │      │ Raw Data    │
│ Automation      │─────>│ Collector        │─────>│ Storage     │
│ Request         │      │ Service          │      │ (Postgres)  │
└─────────────────┘      └──────────────────┘      └─────────────┘
                                  │
                                  │ Extract
                                  ▼
                         ┌──────────────────┐      ┌─────────────┐
                         │ Ollama LLM       │─────>│ Structured  │
                         │ Extractor        │      │ Data        │
                         └──────────────────┘      └─────────────┘
```

## Installation

### Prerequisites

- Docker and Docker Compose
- Ollama running with appropriate models
- PostgreSQL with browser-collector schema

### Setup

1. The service is already configured in `docker-compose.yml`

2. Ensure Ollama has required models:
```bash
docker compose exec ollama ollama pull llama3.2:3b
docker compose exec ollama ollama pull mistral
```

3. Create data directories:
```bash
mkdir -p ./data/browser-screenshots
chmod 777 ./data/browser-screenshots
```

4. Start the service:
```bash
docker compose build browser-collector
docker compose up -d browser-collector
```

## Usage

### Basic Collection Example

```bash
curl -X POST http://localhost:8030/collect \
  -H "Content-Type: application/json" \
  -d '{
    "session_name": "1001tracklists_search",
    "collector_type": "tracklist_finder",
    "target_url": "https://www.1001tracklists.com/search/?q=Carl+Cox",
    "extraction_type": "tracklist",
    "ollama_model": "llama3.2:3b",
    "auto_extract": true,
    "collect_screenshots": true
  }'
```

### Advanced: Multi-Step Navigation

Search for a tracklist and navigate to results:

```bash
curl -X POST http://localhost:8030/collect \
  -H "Content-Type: application/json" \
  -d '{
    "session_name": "tracklist_search",
    "collector_type": "tracklist_finder",
    "target_url": "https://www.1001tracklists.com",
    "navigation_steps": [
      {
        "type": "click",
        "selector": "input[name=\"q\"]",
        "screenshot": false
      },
      {
        "type": "type",
        "selector": "input[name=\"q\"]",
        "text": "Carl Cox Space Ibiza 2023",
        "clear": false
      },
      {
        "type": "wait",
        "duration_ms": 500
      },
      {
        "type": "click",
        "selector": "button[type=\"submit\"]",
        "screenshot": false
      },
      {
        "type": "wait_for_selector",
        "selector": ".tracklist-item",
        "timeout_ms": 10000
      },
      {
        "type": "scroll",
        "direction": "down",
        "amount": 500
      },
      {
        "type": "click",
        "selector": ".tracklist-item:first-child a",
        "screenshot": true
      }
    ],
    "extraction_type": "tracklist",
    "auto_extract": true
  }'
```

### Navigation Step Types

| Type | Description | Parameters |
|------|-------------|------------|
| `click` | Click an element | `selector`, optional `text` |
| `type` | Type text character-by-character | `selector`, `text`, optional `clear` |
| `scroll` | Scroll page | `direction` (up/down/top/bottom), `amount` (pixels) |
| `wait` | Wait for duration | `duration_ms` |
| `wait_for_selector` | Wait for element | `selector`, `timeout_ms` |
| `select` | Select dropdown option | `selector`, `value` |
| `hover` | Hover over element | `selector` |

### Extract from Existing Raw Data

If you already collected data and want to re-extract:

```bash
curl -X POST http://localhost:8030/extract/{raw_data_id} \
  -H "Content-Type: application/json" \
  -d '{
    "extraction_type": "tracklist",
    "ollama_model": "llama3.2:3b"
  }'
```

## Extraction Types

### 1. Tracklist Extraction

Extracts track information from DJ sets, mixes, live recordings:

```json
{
  "extraction_type": "tracklist",
  "result": {
    "tracks": [
      {
        "position": 1,
        "artist": "Artist Name",
        "title": "Track Title",
        "time": "12:34",
        "confidence": "high"
      }
    ],
    "metadata": {
      "dj_name": "DJ Name",
      "event_name": "Event Name",
      "date": "2024-10-01",
      "venue": "Venue Name"
    }
  }
}
```

### 2. Artist Info Extraction

Extracts artist biography, links, discography:

```json
{
  "extraction_type": "artist",
  "result": {
    "artist_name": "Artist Name",
    "genres": ["Techno", "House"],
    "biography": "Short bio...",
    "links": {
      "website": "https://...",
      "soundcloud": "https://...",
      "instagram": "https://..."
    },
    "record_labels": ["Label1", "Label2"]
  }
}
```

### 3. Event Info Extraction

Extracts event details from listings:

```json
{
  "extraction_type": "event",
  "result": {
    "event_name": "Event Name",
    "date": "2024-10-15",
    "venue": "Venue Name",
    "location": "City, Country",
    "lineup": ["Artist1", "Artist2"],
    "genres": ["Techno"]
  }
}
```

### 4. Music Metadata Extraction

Extracts detailed track metadata:

```json
{
  "extraction_type": "metadata",
  "result": {
    "title": "Track Title",
    "artist": "Artist Name",
    "album": "Album Name",
    "year": 2024,
    "bpm": 128,
    "key": "Am",
    "genre": "Techno",
    "label": "Record Label"
  }
}
```

## Custom Extraction Prompts

You can provide custom extraction prompts for specialized use cases:

```bash
curl -X POST http://localhost:8030/extract/{raw_data_id} \
  -H "Content-Type: application/json" \
  -d '{
    "extraction_type": "custom",
    "custom_prompt": "Extract all festival lineup information from this text. Return JSON with festival name, dates, stages, and artists per stage."
  }'
```

## Configuration

### Browser Configuration

Control browser behavior in the `browser_config` parameter:

```json
{
  "browser_config": {
    "browser_type": "chromium",
    "headless": false,
    "viewport_width": 1920,
    "viewport_height": 1080,
    "use_real_chrome": true
  }
}
```

### Human-Like Delays

Delays are automatically applied but can be customized by modifying `HumanLikeDelays` in `human_browser_navigator.py`:

- Typing: 100-300ms between characters
- Clicks: 100-400ms before/after
- Scrolling: 500-1500ms delays
- Page load: 1000-3000ms after navigation

## Database Schema

All collected data is stored with complete traceability:

- `collection_sessions` - Browser automation sessions
- `raw_collected_data` - Raw HTML/text with metadata
- `ollama_extraction_jobs` - LLM extraction tasks
- `browser_interaction_logs` - Detailed interaction logs

Query collected data:

```sql
-- Get recent collections
SELECT cs.session_name, rcd.source_url, rcd.page_title, rcd.extraction_status
FROM collection_sessions cs
JOIN raw_collected_data rcd ON cs.id = rcd.collection_session_id
WHERE cs.started_at > NOW() - INTERVAL '1 day'
ORDER BY cs.started_at DESC;

-- Get extraction results
SELECT rcd.source_url, oej.extraction_type, oej.confidence_score,
       oej.extracted_data
FROM ollama_extraction_jobs oej
JOIN raw_collected_data rcd ON oej.raw_data_id = rcd.id
WHERE oej.status = 'completed'
ORDER BY oej.completed_at DESC;
```

## Monitoring

### Prometheus Metrics

Available at `http://localhost:8030/metrics`:

- `collection_tasks_total` - Total collection tasks by status
- `extraction_tasks_total` - Total extraction tasks by status
- `active_collections` - Currently active collections
- `collection_duration_seconds` - Collection duration histogram
- `extraction_duration_seconds` - Extraction duration histogram

### Health Check

```bash
curl http://localhost:8030/health
```

Response:
```json
{
  "status": "healthy",
  "service": "browser-collector",
  "ollama": {
    "status": "healthy",
    "available_models": ["llama3.2:3b", "mistral"],
    "base_url": "http://ollama:11434"
  }
}
```

## Integration with Existing Scrapers

The browser collector integrates seamlessly:

1. **Fallback mechanism** - Use when API/HTML scraping fails
2. **CAPTCHA handling** - Non-headless mode allows manual solving
3. **JavaScript-heavy sites** - Handles dynamic content loading
4. **Consistent storage** - Same database as other scrapers

### Example Integration

From scraper-orchestrator, trigger browser collection:

```python
import httpx

async def collect_with_browser(url: str, extraction_type: str):
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "http://browser-collector:8030/collect",
            json={
                "session_name": f"scraper_fallback_{url}",
                "collector_type": "fallback",
                "target_url": url,
                "extraction_type": extraction_type,
                "auto_extract": True
            }
        )
        return response.json()
```

## Example Collector Templates

### SoundCloud Artist Discovery

```json
{
  "target_url": "https://soundcloud.com/search?q=techno",
  "navigation_steps": [
    {"type": "wait_for_selector", "selector": ".searchList__item"},
    {"type": "scroll", "direction": "down", "amount": 800},
    {"type": "wait", "duration_ms": 1000},
    {"type": "click", "selector": ".searchList__item:first-child a"}
  ],
  "extraction_type": "artist"
}
```

### Resident Advisor Event Scraping

```json
{
  "target_url": "https://ra.co/events/us/newyork",
  "navigation_steps": [
    {"type": "wait_for_selector", "selector": ".event-item"},
    {"type": "scroll", "direction": "down", "amount": 1000},
    {"type": "wait", "duration_ms": 1500}
  ],
  "extraction_type": "event"
}
```

## Troubleshooting

### Browser not launching

- Ensure Chrome is installed: `docker compose exec browser-collector google-chrome --version`
- Check browser logs: `docker compose logs browser-collector`

### Screenshots not saving

- Verify volume permissions: `ls -la ./data/browser-screenshots`
- Check container access: `docker compose exec browser-collector ls -la /app/screenshots`

### Ollama extraction failing

- Verify Ollama is running: `docker compose ps ollama`
- Check available models: `docker compose exec ollama ollama list`
- Pull required model: `docker compose exec ollama ollama pull llama3.2:3b`

### Slow extraction

- Use smaller models (llama3.2:3b instead of llama3.2:70b)
- Truncate raw text (automatically limited to 8000 chars)
- Batch multiple extractions concurrently

## Performance Tips

1. **Use headless mode in production** - Set `headless: true` for better performance
2. **Batch extractions** - Process multiple raw data items together
3. **Optimize delays** - Reduce human-like delays if not needed for bot detection
4. **Screenshot selectively** - Only capture when needed
5. **Monitor resources** - Browser automation is memory-intensive

## Security Considerations

- Browser runs in Docker container (isolated)
- No data leaves your infrastructure (local Ollama)
- Raw data stored in your database
- Screenshots stored in your volumes
- No third-party API calls for extraction

## Future Enhancements

- [ ] Proxy rotation support
- [ ] CAPTCHA solving integration (2captcha, Anti-Captcha)
- [ ] Browser fingerprint randomization
- [ ] Parallel browser sessions
- [ ] Cookie/session persistence
- [ ] Advanced anti-detection measures
- [ ] Template library for popular sites
