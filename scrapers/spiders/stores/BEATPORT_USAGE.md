# Beatport Spider - Quick Start Guide

## Overview

The Beatport spider extracts high-quality metadata for electronic music tracks, with a focus on **BPM** and **musical key** data critical for DJ applications and harmonic mixing.

**Priority Score:** 2.11 (High Priority for BPM/key data)

## Quick Start

### Basic Usage

```bash
# Search for specific artist
scrapy crawl beatport -a search_query="Chris Lake"

# Search for specific track
scrapy crawl beatport -a search_query="Acid Test"

# Use targeted mode (searches from target_tracks_for_scraping.json)
scrapy crawl beatport -a search_mode=targeted

# Discovery mode (browse popular genres)
scrapy crawl beatport -a search_mode=discovery
```

### Advanced Usage

```bash
# Scrape specific track URL
scrapy crawl beatport -a start_urls="https://www.beatport.com/track/steam-room/18632551"

# Multiple URLs (comma-separated)
scrapy crawl beatport -a start_urls="https://www.beatport.com/track/1,https://www.beatport.com/track/2"

# Output to JSON file
scrapy crawl beatport -a search_query="Tale Of Us" -o beatport_output.json

# Output to CSV
scrapy crawl beatport -a search_query="Amelie Lens" -o beatport_output.csv
```

## What Data Gets Extracted?

### Critical DJ Metadata
- **BPM**: 60-200 range (validated for electronic music)
- **Musical Key**: Both standard (Dbm, C, F#m) and Camelot (12A, 8B) notation
- **Genre/Subgenre**: Detailed classification (Techno, Tech House, Melodic House & Techno)

### Release Information
- **Track Name**: Full track title with remix info
- **Artists**: Primary, featured, and remixer credits
- **Release Date**: ISO format date
- **Label**: Record label name
- **ISRC**: International Standard Recording Code
- **Duration**: Track length in milliseconds

### Example Output

```json
{
  "track_name": "Steam Room",
  "bpm": 124,
  "musical_key": "Dbm",
  "genre": "Nu Disco / Disco",
  "release_date": "2024-02-08",
  "record_label": "RH2",
  "isrc": "DEW872401019",
  "duration_ms": 360000,
  "metadata": {
    "camelot_key": "12A",
    "source": "beatport",
    "is_target_track": true
  }
}
```

## Integration with SongNodes

### Automatic Database Storage

The spider automatically stores data in PostgreSQL via `database_pipeline.DatabasePipeline`:

```sql
-- Query tracks with BPM and key data
SELECT
  track_name,
  bpm,
  musical_key,
  genre,
  metadata->>'camelot_key' as camelot
FROM tracks
WHERE data_source = 'beatport'
  AND bpm IS NOT NULL;
```

### Harmonic Mixing Queries

```sql
-- Find harmonically compatible tracks (Camelot wheel)
SELECT
  t1.track_name as track1,
  t2.track_name as track2,
  t1.bpm as bpm1,
  t2.bpm as bpm2,
  t1.metadata->>'camelot_key' as key1,
  t2.metadata->>'camelot_key' as key2
FROM tracks t1
JOIN tracks t2
  ON t1.metadata->>'camelot_key' IN (
    t2.metadata->>'camelot_key',  -- Same key
    -- Adjacent keys on Camelot wheel (simplified)
  )
WHERE t1.bpm BETWEEN t2.bpm - 3 AND t2.bpm + 3
  AND t1.data_source = 'beatport';
```

## Configuration

### Environment Variables

```bash
# Rate limiting
BEATPORT_SEARCH_BATCH_SIZE=30  # Max search results per run (default: 30)

# Redis state tracking (for deduplication)
SCRAPER_STATE_REDIS_HOST=redis
SCRAPER_STATE_REDIS_PORT=6379
SCRAPER_STATE_REDIS_DB=0

# TTL settings
SCRAPER_SOURCE_TTL_DAYS=30      # Remember processed tracks for 30 days
SCRAPER_RUN_TTL_HOURS=24        # Daily run quota (24 hours)

# Force run (bypass daily quota)
SCRAPER_FORCE_RUN=0             # Set to 1 to force run
```

### Rate Limiting (Very Important!)

The spider uses **conservative rate limiting** to avoid blocking:

- **Download Delay**: 10 seconds between requests
- **Concurrent Requests**: 1 per domain (no parallelization)
- **AutoThrottle**: Enabled with dynamic adjustment (10-60s range)

**Why so slow?**
- Beatport is a React/Next.js app requiring JavaScript rendering
- Conservative approach prevents CAPTCHA and IP blocking
- Expected throughput: ~6 tracks/minute, ~360 tracks/hour

## Daily Run Quota

To prevent over-scraping, the spider enforces a **24-hour run quota**:

```bash
# First run today: OK
scrapy crawl beatport -a search_mode=targeted

# Second run within 24 hours: Blocked
# Output: "Daily quota already used (last run at 2025-10-01T12:00:00Z)"

# Force run (bypass quota - use carefully!)
scrapy crawl beatport -a search_mode=targeted -a force_run=1
# OR
SCRAPER_FORCE_RUN=1 scrapy crawl beatport -a search_mode=targeted
```

## Troubleshooting

### Problem: No tracks found in search results

**Possible Causes:**
1. JavaScript rendering failed (Playwright not installed)
2. Track doesn't exist on Beatport
3. Search query too specific

**Solutions:**
```bash
# Check Playwright installation
pip list | grep playwright

# Install if missing
pip install scrapy-playwright playwright
playwright install chromium

# Try broader search
scrapy crawl beatport -a search_query="Chris Lake"  # Good
scrapy crawl beatport -a search_query="Chris Lake Acid Test Original Mix"  # Too specific
```

### Problem: CAPTCHA or blocking

**Possible Causes:**
1. Rate limit too aggressive
2. Multiple spider instances running
3. IP previously flagged

**Solutions:**
```bash
# Increase delay in beatport_spider.py
download_delay = 15.0  # Increase from 10 to 15 seconds

# Check for multiple instances
ps aux | grep scrapy

# Wait 24 hours before retry
# Use proxy rotation (advanced)
```

### Problem: Missing BPM or key data

**This is normal!** Not all tracks have BPM/key metadata on Beatport.

**Solutions:**
- Use multiple sources (Discogs, Spotify, MixesDB)
- Cross-reference with other scrapers
- Use audio analysis service for missing data

### Problem: Redis connection failed

```
Redis state store unavailable (Error 111 connecting to localhost:6379)
```

**Solutions:**
```bash
# Start Redis container
docker compose up -d redis

# Check Redis is running
docker compose ps redis

# Test connection
redis-cli ping
```

## Docker Deployment (Recommended)

### Using Docker Compose

```bash
# Start all services (includes Redis, PostgreSQL, etc.)
docker compose up -d

# Run spider in container
docker compose exec scraper-orchestrator scrapy crawl beatport -a search_mode=targeted

# View logs
docker compose logs -f scraper-orchestrator
```

### Standalone Docker

```bash
# Build scraper image
docker build -t songnodes-scraper -f scrapers/Dockerfile .

# Run spider
docker run --rm \
  --network songnodes_default \
  -e REDIS_HOST=redis \
  -e DB_HOST=postgres \
  songnodes-scraper \
  scrapy crawl beatport -a search_mode=targeted
```

## Performance Monitoring

### Check Spider Stats

```bash
# Enable stats collection in custom_settings
'STATS_CLASS': 'scrapy.statscollectors.MemoryStatsCollector'

# View stats in spider close callback
# Logged automatically: requests, items, errors, duration
```

### Monitor Redis State

```bash
# Connect to Redis
redis-cli

# Check keys (processed tracks)
redis> KEYS scraped:tracks:beatport:*
redis> TTL scraped:tracks:beatport:abc123  # Check TTL

# Clear state (force re-scrape all tracks)
redis> KEYS scraped:tracks:beatport:* | xargs redis-cli DEL
```

## Best Practices

### 1. Use Targeted Mode for Efficiency

✅ **Good:** Search for specific artists from your target list
```bash
scrapy crawl beatport -a search_mode=targeted
```

❌ **Bad:** Blind discovery (wastes quota on irrelevant tracks)
```bash
scrapy crawl beatport -a search_mode=discovery
```

### 2. Respect Rate Limits

- Never reduce `download_delay` below 10 seconds
- Never increase `CONCURRENT_REQUESTS` above 1
- Let AutoThrottle do its job

### 3. Combine with Other Sources

Beatport is **one source** in your metadata pipeline:

```
1001tracklists → Beatport → Discogs → Spotify → Database
     ↓            ↓           ↓          ↓
  Tracklists   BPM/Key    Catalog    Audio
                                    Features
```

### 4. Monitor Logs for Issues

```bash
# Watch for rate limiting
tail -f scrapy.log | grep "429"

# Watch for CAPTCHA (shouldn't happen with our settings)
tail -f scrapy.log | grep -i "captcha"

# Watch for extraction errors
tail -f scrapy.log | grep "ERROR"
```

## Testing

### Run Unit Tests

```bash
cd scrapers/
python3 test_beatport_spider.py
```

Expected output:
```
============================================================
BEATPORT SPIDER TEST SUITE
============================================================

Testing spider initialization...
✓ Targeted mode initialization
✓ Discovery mode initialization
✓ Search query initialization
✓ All initialization tests passed!

...

============================================================
✅ ALL TESTS PASSED!
============================================================
```

### Dry Run (No Database)

```bash
# Test extraction without saving to database
scrapy crawl beatport \
  -a search_query="Chris Lake" \
  -s ITEM_PIPELINES={} \
  -o test_output.json
```

## Integration Examples

### REST API Endpoint

```python
# services/rest-api/main.py
@app.post("/scrape/beatport")
async def trigger_beatport_scrape(artist: str):
    """Trigger Beatport scrape for artist."""
    process = CrawlerProcess(get_project_settings())
    process.crawl(BeatportSpider, search_query=artist)
    process.start()
    return {"status": "scraping", "artist": artist}
```

### Scraper Orchestrator

```python
# services/scraper-orchestrator/main.py
from scrapers.spiders.stores.beatport_spider import BeatportSpider

# Automatically triggered for high-priority targets
if track_needs_bpm(track):
    scheduler.schedule_spider(
        BeatportSpider,
        search_query=f"{track.artist} {track.title}"
    )
```

## FAQ

**Q: How long does a full run take?**
A: ~30-60 minutes for targeted mode (30 tracks), ~4-6 hours for discovery mode (full genre scrape)

**Q: Can I run multiple spiders in parallel?**
A: Not recommended! Each spider has daily quota. Run sequentially.

**Q: What if Beatport changes their site structure?**
A: Spider uses JSON-LD structured data (most stable), with CSS selector fallbacks. Updates may be needed for major redesigns.

**Q: Do I need a Beatport account?**
A: No, all data is publicly accessible without authentication.

**Q: Can I scrape Beatport charts?**
A: Yes! Use custom start_urls:
```bash
scrapy crawl beatport -a start_urls="https://www.beatport.com/genre/techno/6/tracks?per-page=100"
```

## Support

- **GitHub Issues**: Report bugs or request features
- **Documentation**: `/docs/scrapers/beatport.md`
- **Logs**: `scrapy.log` (verbose debugging)

---

**Last Updated:** October 2025
**Spider Version:** 1.0.0
**Status:** Production Ready ✅
