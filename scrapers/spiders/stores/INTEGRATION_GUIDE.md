# Discogs Spider Integration Guide

## Quick Start

### 1. Setup Credentials

**Get your Discogs token:**
```bash
# Visit: https://www.discogs.com/settings/developers
# Click "Generate new token"
```

**Add to environment:**
```bash
# .env file
DISCOGS_TOKEN=your_discogs_personal_access_token_here
```

### 2. Test Connection

```bash
# Test with a known release (Plastikman - Spastik)
cd /mnt/my_external_drive/programming/songnodes/scrapers
scrapy crawl discogs -a release_id="249504"
```

### 3. Search for Tracks

```bash
# Search by artist + title
scrapy crawl discogs -a artist="Amelie Lens" -a title="Feel It"

# Search by query
scrapy crawl discogs -a query="Charlotte de Witte"

# Export to JSON
scrapy crawl discogs -a query="Drumcode techno" -o output.json
```

---

## Integration with Scraper Orchestrator

The Discogs spider can be integrated into the scraper orchestrator for automated metadata enrichment.

### Orchestrator Configuration

```python
# services/scraper-orchestrator/main.py

SPIDER_CONFIGS = {
    'discogs': {
        'enabled': True,
        'priority': 2.65,  # High priority
        'mode': 'enrichment',  # Used for metadata enrichment
        'rate_limit': 60,  # 60 req/min authenticated
        'timeout': 30
    }
}

# Orchestrator will call Discogs spider for tracks missing metadata
def enrich_track_metadata(track):
    """Enrich track with Discogs metadata"""
    if not track.discogs_id and not track.record_label:
        # Call Discogs spider
        result = run_spider('discogs', artist=track.artist, title=track.title)

        if result:
            # Update track with Discogs metadata
            track.update({
                'discogs_id': result.discogs_id,
                'record_label': result.record_label,
                'catalog_number': result.catalog_number,
                'genre': result.genre,
                'release_date': result.release_date
            })
```

---

## Database Integration

### Automatic Pipeline Processing

All Discogs spider results are automatically processed through the database pipeline:

```python
# database_pipeline.py processes:
1. Track items → tracks table
2. Artist items → artists table
3. Track-Artist relationships → track_artists table
4. Metadata JSON → metadata columns
```

### Query Enriched Data

```sql
-- Find tracks with Discogs metadata
SELECT
  track_name,
  record_label,
  metadata->>'catalog_number' as catalog_number,
  metadata->>'release_country' as country,
  genre,
  subgenre,
  release_date
FROM tracks
WHERE discogs_id IS NOT NULL
ORDER BY release_date DESC
LIMIT 100;

-- Label statistics
SELECT
  record_label,
  COUNT(*) as track_count,
  ARRAY_AGG(DISTINCT genre) as genres,
  MIN(release_date) as first_release,
  MAX(release_date) as latest_release
FROM tracks
WHERE record_label IS NOT NULL
GROUP BY record_label
ORDER BY track_count DESC
LIMIT 50;

-- Genre distribution
SELECT
  subgenre,
  COUNT(*) as count,
  ARRAY_AGG(DISTINCT record_label) as labels
FROM tracks
WHERE subgenre IS NOT NULL
GROUP BY subgenre
ORDER BY count DESC;
```

---

## API Usage Examples

### Python Script Integration

```python
#!/usr/bin/env python3
"""
Example: Enrich tracks with Discogs metadata
"""

from scrapy.crawler import CrawlerProcess
from scrapy.utils.project import get_project_settings
from spiders.stores.discogs_spider import DiscogsAPISpider

# Configure Scrapy settings
settings = get_project_settings()
settings.update({
    'FEEDS': {
        'discogs_output.json': {
            'format': 'json',
            'overwrite': True
        }
    }
})

# Create crawler process
process = CrawlerProcess(settings)

# Target tracks to enrich
target_tracks = [
    {'artist': 'Amelie Lens', 'title': 'Feel It'},
    {'artist': 'Charlotte de Witte', 'title': 'Selected'},
    {'artist': 'Adam Beyer', 'title': 'Your Mind'}
]

# Crawl each track
for track in target_tracks:
    process.crawl(
        DiscogsAPISpider,
        artist=track['artist'],
        title=track['title']
    )

# Start crawling
process.start()
```

### Batch Processing Script

```python
#!/usr/bin/env python3
"""
Batch process tracks from database for Discogs enrichment
"""

import asyncpg
import asyncio
from scrapy.crawler import CrawlerRunner
from scrapy.utils.log import configure_logging
from twisted.internet import reactor, defer

# Configure logging
configure_logging()

async def get_tracks_needing_enrichment():
    """Fetch tracks from database that need Discogs metadata"""
    conn = await asyncpg.connect(
        host='db-connection-pool',
        port=6432,
        database='musicdb',
        user='musicdb_user',
        password='musicdb_secure_pass_2024'
    )

    try:
        # Find tracks without Discogs ID or label
        tracks = await conn.fetch("""
            SELECT
                track_name,
                SPLIT_PART(track_name, ' - ', 1) as artist,
                SPLIT_PART(track_name, ' - ', 2) as title
            FROM tracks
            WHERE discogs_id IS NULL
              AND record_label IS NULL
            LIMIT 100
        """)

        return [dict(track) for track in tracks]
    finally:
        await conn.close()

@defer.inlineCallbacks
def crawl_tracks():
    """Crawl tracks using Scrapy"""
    from twisted.internet import asyncioreactor

    # Get tracks
    loop = asyncio.get_event_loop()
    tracks = loop.run_until_complete(get_tracks_needing_enrichment())

    print(f"Processing {len(tracks)} tracks for Discogs enrichment")

    # Create crawler runner
    runner = CrawlerRunner()

    # Schedule all spiders
    for track in tracks:
        if track['artist'] and track['title']:
            yield runner.crawl(
                DiscogsAPISpider,
                artist=track['artist'],
                title=track['title']
            )

    reactor.stop()

if __name__ == '__main__':
    crawl_tracks()
    reactor.run()
```

---

## Docker Integration

### Run Spider in Docker Container

```bash
# Run spider in scraper-orchestrator container
docker compose exec scraper-orchestrator \
  scrapy crawl discogs -a artist="Amelie Lens" -a title="Feel It"

# Run with output file
docker compose exec scraper-orchestrator \
  scrapy crawl discogs -a query="techno" -o /tmp/discogs_results.json

# Copy results to host
docker compose cp scraper-orchestrator:/tmp/discogs_results.json ./
```

### Docker Compose Service

```yaml
# docker-compose.yml
services:
  discogs-enrichment:
    build:
      context: .
      dockerfile: services/scraper-orchestrator/Dockerfile
    environment:
      - DISCOGS_TOKEN=${DISCOGS_TOKEN}
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
    command: scrapy crawl discogs -a query="label:Drumcode"
    depends_on:
      - postgres
      - redis
    networks:
      - songnodes-network
```

---

## Monitoring & Logging

### Enable Debug Logging

```bash
# Verbose output
scrapy crawl discogs -a query="test" --loglevel=DEBUG

# Save logs to file
scrapy crawl discogs -a query="test" --logfile=discogs.log
```

### Monitor API Rate Limits

```python
# The spider automatically logs rate limit information:
# - Current delay: 1.2s
# - Requests made: X
# - Rate limit hits: Y
# - AutoThrottle adjustments

# Check logs for:
# "Rate limit hit (429)" - Need to increase delay
# "API Errors: X" - Check authentication
```

### Prometheus Metrics (Future Enhancement)

```python
# Add to spider:
from prometheus_client import Counter, Histogram

discogs_requests = Counter('discogs_requests_total', 'Total Discogs API requests')
discogs_errors = Counter('discogs_errors_total', 'Discogs API errors')
discogs_duration = Histogram('discogs_request_duration_seconds', 'Request duration')
```

---

## Testing

### Run Unit Tests

```bash
cd /mnt/my_external_drive/programming/songnodes/scrapers/spiders/stores
python3 test_discogs_spider.py -v
```

### Integration Tests

```bash
# Test with real API (requires token)
cd /mnt/my_external_drive/programming/songnodes/scrapers

# Test 1: Known release
scrapy crawl discogs -a release_id="249504" -o test1.json

# Test 2: Artist search
scrapy crawl discogs -a artist="Amelie Lens" -o test2.json

# Test 3: Free query
scrapy crawl discogs -a query="Drumcode" -o test3.json

# Verify results
python3 -m json.tool test1.json
python3 -m json.tool test2.json
python3 -m json.tool test3.json
```

---

## Troubleshooting

### Common Issues

#### 1. "ModuleNotFoundError: No module named 'praw'"
This is unrelated to Discogs spider - it's from reddit_monitor_spider.py.

**Solution:**
```bash
cd /mnt/my_external_drive/programming/songnodes/scrapers
pip install praw
```

#### 2. "Authentication failed (401)"
**Solution:**
- Verify token: https://www.discogs.com/settings/developers
- Check .env file has correct DISCOGS_TOKEN
- Ensure no extra spaces/newlines in token

#### 3. "Rate limit hit (429)"
**Solution:**
- Increase `download_delay` in spider custom_settings
- Verify token is authenticated (60/min vs 25/min)
- Check only one spider instance is running

#### 4. "No results found"
**Solution:**
- Verify artist/title spelling
- Check release exists on Discogs website
- Try broader query terms

---

## Performance Optimization

### Best Practices

1. **Use Specific IDs When Available**
   - `release_id` is fastest (direct API call)
   - `artist_id` is better than search
   - Search queries are slowest

2. **Batch Processing**
   - Group requests by artist
   - Use orchestrator for scheduling
   - Respect rate limits

3. **Caching**
   - Enable HTTP cache middleware
   - Cache responses for 24 hours
   - Reduce duplicate API calls

4. **Database Optimization**
   - Check for existing discogs_id before searching
   - Use database indices on discogs_id
   - Batch insert results

### Cache Configuration

```python
# settings.py
HTTPCACHE_ENABLED = True
HTTPCACHE_EXPIRATION_SECS = 86400  # 24 hours
HTTPCACHE_DIR = 'httpcache'
HTTPCACHE_STORAGE = 'scrapy.extensions.httpcache.FilesystemCacheStorage'
```

---

## Next Steps

1. **Configure Discogs Token**
   - Get token from https://www.discogs.com/settings/developers
   - Add to .env or frontend settings

2. **Test Spider**
   - Run basic search test
   - Verify database integration
   - Check data quality

3. **Integrate with Orchestrator**
   - Add to spider configs
   - Enable automated enrichment
   - Set up monitoring

4. **Monitor Performance**
   - Track API usage
   - Monitor rate limits
   - Optimize batch sizes

---

## Support & Resources

- **Discogs API Docs:** https://www.discogs.com/developers
- **SongNodes Docs:** `/docs/scrapers/`
- **GitHub Issues:** https://github.com/songnodes/songnodes/issues
- **API Status:** https://www.discogs.com/developers

---

**Last Updated:** October 1, 2025
**Version:** 1.0.0
