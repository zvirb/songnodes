# Store-Based Music Metadata Spiders

This directory contains spiders that interact with official music stores and databases via their APIs or structured scraping for comprehensive metadata enrichment.

## Available Spiders

### 1. Beatport Spider (`beatport_spider.py`)

**Priority Score:** 2.11 (High Priority)
**Target:** https://www.beatport.com

**Best For:**
- Electronic music (techno, house, trance, drum & bass)
- **BPM data (critical for DJ mixing)**
- **Musical key (Camelot notation for harmonic mixing)**
- Detailed genre/subgenre classification
- ISRC codes for track identification
- Release metadata (dates, labels)

**Technical Details:**
- **Approach:** JavaScript rendering with Playwright (React/Next.js)
- **Data Extraction:** JSON-LD structured data + CSS selectors
- **Rate Limit:** 10 seconds between requests (conservative)
- **Robots.txt:** Fully permissive (Allow: / for all user-agents)

**Usage Examples:**
```bash
# Targeted search (from target_tracks_for_scraping.json)
scrapy crawl beatport -a search_mode=targeted

# Search by artist
scrapy crawl beatport -a search_query="Chris Lake"

# Discovery mode (browse popular genres)
scrapy crawl beatport -a search_mode=discovery

# Custom URLs
scrapy crawl beatport -a start_urls="https://www.beatport.com/track/..."
```

**Key Features:**
- ✅ BPM extraction (60-200 range for electronic music)
- ✅ Musical key in both standard (Dbm) and Camelot (12A) notation
- ✅ ISRC codes for cross-platform matching
- ✅ Deterministic track IDs for deduplication
- ✅ Redis state tracking (30-day TTL)
- ✅ Daily run quota enforcement

---

### 2. Discogs API Spider (`discogs_spider.py`)

**Priority Score:** 2.65 (High Priority)

**Best For:**
- Electronic music (techno, house, drum & bass, trance)
- Vinyl releases and catalog numbers
- Label metadata and discographies
- Detailed genre/style classification
- Producer/remixer credits
- Release dates and countries

**API Details:**
- **Official API:** https://api.discogs.com/
- **Authentication:** Personal Access Token (DISCOGS_TOKEN)
- **Rate Limit:** 60 requests/min (authenticated), 25 requests/min (unauthenticated)
- **Documentation:** https://www.discogs.com/developers

---

## Setup & Configuration

### 1. Obtain Discogs Personal Access Token

1. Visit: https://www.discogs.com/settings/developers
2. Click "Generate new token"
3. Copy your Personal Access Token

### 2. Configure Token (Two Options)

#### Option A: Frontend Settings UI (Recommended for Production)
1. Navigate to SongNodes frontend
2. Click Settings (⚙️) → API Keys tab
3. Add Discogs token
4. Token is stored encrypted in database

#### Option B: Environment Variable (Development/Testing)
```bash
# Add to .env file
DISCOGS_TOKEN=your_personal_access_token_here
```

### 3. Verify Configuration
```bash
# Test connection
scrapy crawl discogs -a release_id="249504"
```

---

## Usage Examples

### Basic Search

#### Search by Artist + Title
```bash
scrapy crawl discogs -a artist="Amelie Lens" -a title="Feel It"
```

#### Free-form Query Search
```bash
scrapy crawl discogs -a query="Adam Beyer Drumcode"
```

#### Search for Label Releases
```bash
scrapy crawl discogs -a query="label:Drumcode"
```

### Specific Resource Queries

#### Get Specific Release by ID
```bash
scrapy crawl discogs -a release_id="12345678"
```

#### Get Artist Information
```bash
scrapy crawl discogs -a artist_id="12345"
```

#### Get Label Information
```bash
scrapy crawl discogs -a label_id="12345"
```

### Advanced Usage

#### Custom Output Format
```bash
scrapy crawl discogs -a query="techno vinyl" -o output.json
scrapy crawl discogs -a query="techno vinyl" -o output.csv
```

#### Limit Results
```bash
# Spider processes top 20 results per search by default
# To modify, edit MAX_RESULTS in spider code
```

#### Integration with Scraper Orchestrator
```python
# orchestrator.py
from scrapers.spiders.stores.discogs_spider import DiscogsAPISpider

# Orchestrator will automatically call spider with target tracks
```

---

## Data Extraction

### Track Metadata Extracted

| Field | Description | Example |
|-------|-------------|---------|
| `track_name` | Artist - Title | "Amelie Lens - Feel It" |
| `discogs_id` | Discogs release ID | "10234567" |
| `duration_ms` | Duration in milliseconds | 390000 (6:30) |
| `release_date` | Release date | "2017-06-15" |
| `record_label` | Label name | "LENSKE" |
| `catalog_number` | Catalog number | "LENSKE001" |
| `genre` | Primary genre | "electronic" |
| `subgenre` | Primary style | "techno" |
| `is_remix` | Remix detection | true/false |
| `remix_type` | Type of remix | "Original Mix" |
| `release_country` | Release country | "Belgium" |

### Artist Metadata Extracted

| Field | Description | Example |
|-------|-------------|---------|
| `artist_name` | Artist name | "Amelie Lens" |
| `discogs_id` | Discogs artist ID | "12345" |
| `bio` | Artist biography | "Belgian techno DJ..." |
| `external_urls` | URLs (Discogs, websites) | {...} |

### Rich Metadata Context

All items include comprehensive metadata in JSON format:
```json
{
  "discogs_release_id": "10234567",
  "discogs_url": "https://www.discogs.com/release/10234567",
  "catalog_number": "LENSKE001",
  "release_country": "Belgium",
  "track_position": "A1",
  "genres": ["Electronic"],
  "styles": ["Techno", "Peak Time Techno"],
  "source": "discogs_api",
  "scraped_at": "2025-10-01T12:00:00Z"
}
```

---

## Rate Limiting

### Authenticated (with DISCOGS_TOKEN)
- **Limit:** 60 requests per minute
- **Delay:** 1.2 seconds between requests (conservative)
- **Recommended for:** Production use

### Unauthenticated (no token)
- **Limit:** 25 requests per minute
- **Delay:** 2.5 seconds minimum
- **Recommended for:** Testing only

### AutoThrottle Configuration
The spider uses Scrapy's AutoThrottle middleware to dynamically adjust request rate:
- **Start Delay:** 1.2s
- **Max Delay:** 10.0s
- **Target Concurrency:** 0.5 (very conservative)

If rate limiting occurs (HTTP 429), AutoThrottle automatically increases delay.

---

## Error Handling

### HTTP Status Codes

| Code | Meaning | Action |
|------|---------|--------|
| 200 | Success | Process data |
| 401 | Unauthorized | Check token validity |
| 404 | Not Found | Skip resource |
| 429 | Rate Limit | Auto-retry with backoff |
| 500 | Server Error | Retry with exponential backoff |

### Common Issues

#### Issue: "Authentication failed (401)"
**Solution:**
1. Verify token is valid: https://www.discogs.com/settings/developers
2. Check token is configured in .env or database
3. Ensure token has no extra spaces or newlines

#### Issue: "Rate limit hit (429)"
**Solution:**
1. Increase `download_delay` in custom_settings
2. Verify only one spider instance is running
3. Check if token is authenticated (60/min vs 25/min)

#### Issue: "No results found"
**Solution:**
1. Verify spelling of artist/track names
2. Try broader search query
3. Check if release exists on Discogs website first

---

## Integration with Database

### Automatic Pipeline Processing

All extracted items are automatically processed by `database_pipeline.DatabasePipeline`:

1. **Validation:** Ensures all required fields are present
2. **Deduplication:** Checks existing records by discogs_id
3. **Insertion:** Inserts into PostgreSQL database
4. **Relationship Mapping:** Creates artist-track relationships

### Database Schema

#### Tracks Table
```sql
-- Tracks with Discogs metadata
SELECT
  track_name,
  discogs_id,
  record_label,
  genre,
  subgenre,
  release_date,
  metadata->>'catalog_number' as catalog_number
FROM tracks
WHERE discogs_id IS NOT NULL;
```

#### Cross-Source Matching
```sql
-- Match tracks across multiple sources
SELECT
  track_name,
  spotify_id,
  discogs_id,
  apple_music_id,
  COUNT(*) as source_count
FROM tracks
WHERE discogs_id IS NOT NULL
GROUP BY track_name, spotify_id, discogs_id, apple_music_id
HAVING COUNT(*) > 1;
```

---

## Performance Metrics

### Typical Performance (Authenticated)

| Metric | Value |
|--------|-------|
| Requests per minute | 50 (target: 60) |
| Tracks per release | 5-15 (average) |
| Releases per hour | 200-300 |
| API errors | < 1% |

### Resource Usage
- **Memory:** ~50-100MB
- **CPU:** Low (rate-limited)
- **Network:** ~10KB per request

---

## Best Practices

### 1. Use Targeted Searches
❌ Bad: `query="techno"`
✅ Good: `artist="Adam Beyer" title="Your Mind"`

### 2. Use Specific IDs When Available
❌ Bad: Search for well-known release
✅ Good: `release_id="249504"` (direct API call)

### 3. Configure Authentication
❌ Bad: Run without token (25/min limit)
✅ Good: Configure DISCOGS_TOKEN (60/min limit)

### 4. Monitor Rate Limits
```bash
# Check spider logs for rate limit warnings
tail -f scrapy.log | grep "429"
```

### 5. Validate Data Quality
```bash
# Export to JSON for inspection
scrapy crawl discogs -a query="Drumcode" -o discogs_output.json

# Validate schema
python -m json.tool discogs_output.json
```

---

## Troubleshooting

### Enable Debug Logging
```bash
scrapy crawl discogs -a query="test" --loglevel=DEBUG
```

### Test API Connection
```bash
# Test with curl (replace TOKEN)
curl -H "Authorization: Discogs token=YOUR_TOKEN" \
     https://api.discogs.com/database/search?q=techno&type=release
```

### Verify Token
```python
import os
import requests

token = os.getenv('DISCOGS_TOKEN')
response = requests.get(
    'https://api.discogs.com/database/search?q=test',
    headers={'Authorization': f'Discogs token={token}'}
)
print(f"Status: {response.status_code}")
print(f"Rate limit: {response.headers.get('X-Discogs-Ratelimit')}")
print(f"Remaining: {response.headers.get('X-Discogs-Ratelimit-Remaining')}")
```

---

## Future Enhancements

### Planned Features
- [ ] Batch processing from target tracks list
- [ ] Master release fetching (for multiple pressings)
- [ ] Marketplace data (pricing, availability)
- [ ] Wantlist integration
- [ ] Collection sync
- [ ] Label discography scraping
- [ ] Image/artwork download

### Integration Opportunities
- [ ] Metadata enrichment service integration
- [ ] Automatic cross-platform matching (Spotify + Discogs)
- [ ] Label analytics dashboard
- [ ] Genre trend analysis
- [ ] Release calendar

---

## References

### Official Documentation
- **API Docs:** https://www.discogs.com/developers
- **Database Guidelines:** https://www.discogs.com/help/contributing
- **API Forum:** https://www.discogs.com/forum/thread/780877

### SongNodes Documentation
- **Scraper Architecture:** `/docs/scrapers/architecture.md`
- **Item Loaders Guide:** `/docs/scrapers/itemloaders.md`
- **Database Schema:** `/sql/init/`

### Example Queries
```bash
# Electronic music labels
scrapy crawl discogs -a query="label:Drumcode" -o drumcode.json
scrapy crawl discogs -a query="label:Afterlife" -o afterlife.json

# Specific artists
scrapy crawl discogs -a artist="Charlotte de Witte"
scrapy crawl discogs -a artist="Tale Of Us"

# Genre exploration
scrapy crawl discogs -a query="style:Minimal Techno"
scrapy crawl discogs -a query="style:Progressive House"
```

---

## Support

For issues, questions, or contributions:
- **GitHub Issues:** https://github.com/songnodes/songnodes/issues
- **Documentation:** https://songnodes.com/docs
- **Discogs API Support:** https://www.discogs.com/developers

---

**Last Updated:** October 1, 2025
**Spider Version:** 1.0.0
**API Version:** v2 (Discogs API)
