# SongNodes Scraper Configuration Guide

This document provides configuration instructions for all data source scrapers in the SongNodes platform.

## Overview

SongNodes includes scrapers for the following platforms:
- **1001tracklists** (Existing)
- **MixesDB** (Existing)
- **Setlist.fm** (Existing)
- **Reddit** (Existing)
- **Mixcloud** (NEW - HIGH PRIORITY)
- **SoundCloud** (NEW - HIGH PRIORITY)
- **YouTube** (NEW - MEDIUM PRIORITY)
- **Internet Archive** (NEW - MEDIUM PRIORITY)
- **LiveTracklist** (NEW - MEDIUM PRIORITY)
- **Resident Advisor** (NEW - LOW PRIORITY)

## Environment Variables Setup

Create a `.env` file in the project root with the following variables:

```bash
# Database Configuration
POSTGRES_PASSWORD=your_secure_password_here
PGBOUNCER_ADMIN_PASSWORD=your_pgbouncer_password_here

# Existing Scraper API Keys
SETLISTFM_API_KEY=your_setlistfm_api_key
REDDIT_CLIENT_ID=your_reddit_client_id
REDDIT_CLIENT_SECRET=your_reddit_client_secret

# NEW Scraper API Keys
YOUTUBE_API_KEY=your_youtube_api_key

# Metadata Enrichment API Keys (if using metadata-enrichment service)
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
DISCOGS_TOKEN=your_discogs_token
LASTFM_API_KEY=your_lastfm_api_key
BEATPORT_API_KEY=your_beatport_api_key
```

## Scraper-Specific Configuration

### 1. Mixcloud Scraper (Port 8015)

**Description**: Scrapes DJ mixes from Mixcloud with timestamped tracklists.

**API Requirements**: No API key required - uses web scraping

**Strategy**:
- Extracts embedded `__NEXT_DATA__` JSON from HTML
- Falls back to description parsing if structured data unavailable
- Rate limit: 2 seconds between requests

**Configuration**:
```yaml
environment:
  SCRAPER_NAME: mixcloud
  REDIS_HOST: redis
  POSTGRES_HOST: db-connection-pool
  DATABASE_URL: postgresql://musicdb_user:${POSTGRES_PASSWORD}@db-connection-pool:6432/musicdb
```

**Usage**:
```bash
# Via API
curl -X POST http://localhost:8015/scrape \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.mixcloud.com/username/mix-name/"}'
```

### 2. SoundCloud Scraper (Port 8016)

**Description**: Scrapes DJ mixes from SoundCloud using unofficial API + NLP processing.

**API Requirements**: No API key required - uses SoundCloud widget API

**Strategy**:
- Uses SoundCloud widget oEmbed API for metadata
- Sends descriptions to NLP processor for tracklist extraction
- Rate limit: 2.5 seconds between requests

**Configuration**:
```yaml
environment:
  SCRAPER_NAME: soundcloud
  NLP_PROCESSOR_URL: http://nlp-processor:8021
  DATABASE_URL: postgresql://musicdb_user:${POSTGRES_PASSWORD}@db-connection-pool:6432/musicdb
```

**Usage**:
```bash
curl -X POST http://localhost:8016/scrape \
  -H "Content-Type: application/json" \
  -d '{"url": "https://soundcloud.com/username/mix-name"}'
```

### 3. YouTube Scraper (Port 8017)

**Description**: Scrapes DJ sets from YouTube with quota management.

**API Requirements**: **REQUIRED** - YouTube Data API v3 key

**How to get API Key**:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable **YouTube Data API v3**
4. Go to Credentials → Create Credentials → API Key
5. Restrict the key to YouTube Data API v3 (recommended)
6. Add to `.env` as `YOUTUBE_API_KEY`

**Daily Quota**: 10,000 units per day
- `videos.list`: 1 unit per request
- `commentThreads.list`: 1 unit per request

**Strategy**:
- Extracts tracklists from video descriptions
- Falls back to comment extraction if description has no tracklist
- NLP processing for unstructured tracklists
- Quota tracking via Redis

**Configuration**:
```yaml
environment:
  SCRAPER_NAME: youtube
  YOUTUBE_API_KEY: ${YOUTUBE_API_KEY}  # REQUIRED
  NLP_PROCESSOR_URL: http://nlp-processor:8021
  REDIS_HOST: redis
  DATABASE_URL: postgresql://musicdb_user:${POSTGRES_PASSWORD}@db-connection-pool:6432/musicdb
```

**Usage**:
```bash
# Scrape a DJ set
curl -X POST http://localhost:8017/scrape \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.youtube.com/watch?v=VIDEO_ID"}'

# Check quota status
curl http://localhost:8017/quota
```

### 4. Internet Archive Scraper (Port 8018)

**Description**: Scrapes BBC Essential Mix collection and Hip-hop mixtapes from archive.org.

**API Requirements**: No API key required - completely open API

**Strategy**:
- Uses Internet Archive metadata API
- Extracts tracklists from item descriptions via NLP
- Supports collection searches
- No authentication required

**Configuration**:
```yaml
environment:
  SCRAPER_NAME: internetarchive
  NLP_PROCESSOR_URL: http://nlp-processor:8021
  DATABASE_URL: postgresql://musicdb_user:${POSTGRES_PASSWORD}@db-connection-pool:6432/musicdb
```

**Usage**:
```bash
# Scrape a specific item
curl -X POST http://localhost:8018/scrape \
  -H "Content-Type: application/json" \
  -d '{"url": "https://archive.org/details/IDENTIFIER"}'

# Search a collection
curl "http://localhost:8018/search?collection=etree&query=essential+mix&rows=50"
```

**Popular Collections**:
- `etree` - BBC Essential Mix and radio shows
- `hiphopmixtapes` - DatPiff archive

### 5. LiveTracklist Scraper (Port 8019)

**Description**: Scrapes high-quality timestamped tracklists from EDM festivals and radio shows.

**API Requirements**: No API key required - web scraping

**Strategy**:
- Parses structured HTML tables and lists
- Extracts precise timestamps for each track
- Covers major festivals (Tomorrowland, Ultra, EDC)
- Radio shows (BBC Radio 1, A State of Trance)
- Rate limit: 2 seconds between requests

**Configuration**:
```yaml
environment:
  SCRAPER_NAME: livetracklist
  DATABASE_URL: postgresql://musicdb_user:${POSTGRES_PASSWORD}@db-connection-pool:6432/musicdb
```

**Usage**:
```bash
curl -X POST http://localhost:8019/scrape \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.livetracklist.com/show/EVENT_ID"}'
```

### 6. Resident Advisor Scraper (Port 8023)

**Description**: Scrapes contextual metadata from Resident Advisor for electronic music events and artists.

**API Requirements**: No API key required - web scraping

**Strategy**:
- Extracts `__NEXT_DATA__` JSON from Next.js pages
- Focuses on event lineups and artist metadata
- Does not provide direct setlists (contextual data only)
- Rate limit: 2 seconds between requests

**Configuration**:
```yaml
environment:
  SCRAPER_NAME: residentadvisor
  DATABASE_URL: postgresql://musicdb_user:${POSTGRES_PASSWORD}@db-connection-pool:6432/musicdb
```

**Usage**:
```bash
# Scrape event
curl -X POST http://localhost:8023/scrape \
  -H "Content-Type: application/json" \
  -d '{"url": "https://ra.co/events/EVENT_ID"}'

# Scrape artist
curl -X POST http://localhost:8023/scrape \
  -H "Content-Type: application/json" \
  -d '{"url": "https://ra.co/dj/ARTIST_NAME"}'
```

## Service Ports Reference

| Service | Port | Priority | API Key Required |
|---------|------|----------|------------------|
| scraper-1001tracklists | 8011 | Existing | No |
| scraper-mixesdb | 8012 | Existing | No |
| scraper-setlistfm | 8013 | Existing | Yes (Setlist.fm) |
| scraper-reddit | 8014 | Existing | Yes (Reddit) |
| **scraper-mixcloud** | **8015** | **HIGH** | **No** |
| **scraper-soundcloud** | **8016** | **HIGH** | **No** |
| **scraper-youtube** | **8017** | **MEDIUM** | **Yes (YouTube)** |
| **scraper-internetarchive** | **8018** | **MEDIUM** | **No** |
| **scraper-livetracklist** | **8019** | **MEDIUM** | **No** |
| **scraper-residentadvisor** | **8023** | **LOW** | **No** |

## Starting the Scrapers

### Start All Scrapers
```bash
docker compose up -d
```

### Start Specific Scraper
```bash
# Start only YouTube scraper
docker compose up -d scraper-youtube

# Rebuild and start
docker compose build scraper-youtube && docker compose up -d scraper-youtube
```

### View Logs
```bash
# All scraper logs
docker compose logs -f scraper-mixcloud scraper-soundcloud scraper-youtube

# Specific scraper
docker compose logs -f scraper-youtube
```

## Health Checks

All scrapers expose a `/health` endpoint:

```bash
# Check Mixcloud scraper
curl http://localhost:8015/health

# Check all scrapers
for port in 8011 8012 8013 8014 8015 8016 8017 8018 8019 8023; do
  echo "Port $port: $(curl -s http://localhost:$port/health)"
done
```

## Rate Limiting & Best Practices

### Rate Limits by Scraper:
- **Mixcloud**: 2 seconds between requests
- **SoundCloud**: 2.5 seconds between requests
- **YouTube**: Managed by daily quota (10,000 units/day)
- **Internet Archive**: No limits (but be respectful)
- **LiveTracklist**: 2 seconds between requests
- **Resident Advisor**: 2 seconds between requests

### Best Practices:
1. **Use Redis caching** - All scrapers cache results to avoid redundant requests
2. **Monitor quota** - Check YouTube quota regularly: `curl http://localhost:8017/quota`
3. **Batch operations** - Group scraping tasks to minimize API calls
4. **Error handling** - Scrapers implement exponential backoff on failures
5. **Respect robots.txt** - Scrapers check robots.txt before scraping

## NLP Processor Integration

Scrapers that require NLP processing (SoundCloud, YouTube, Internet Archive) depend on the **nlp-processor** service running on port 8021.

The NLP processor:
- Extracts structured tracklists from unstructured text
- Identifies artist names, track titles, and timestamps
- Uses pattern matching and NLP models

**Ensure nlp-processor is running**:
```bash
docker compose up -d nlp-processor
curl http://localhost:8021/health
```

## Troubleshooting

### Scraper Not Starting
```bash
# Check logs
docker compose logs scraper-youtube

# Check dependencies
docker compose ps postgres redis nlp-processor

# Rebuild
docker compose build scraper-youtube && docker compose up -d scraper-youtube
```

### YouTube Quota Exceeded
```bash
# Check quota status
curl http://localhost:8017/quota

# Wait for quota reset (resets at midnight Pacific Time)
# Or use multiple API keys and rotate
```

### NLP Processor Errors
```bash
# Restart NLP processor
docker compose restart nlp-processor

# Check if models are loaded
docker compose logs nlp-processor | grep "Model loaded"
```

### Database Connection Issues
```bash
# Check database connection pool
docker compose ps db-connection-pool

# Test database connectivity
docker compose exec db-connection-pool curl -f http://127.0.0.1:8025/health
```

## Integration with Orchestrator

All scrapers integrate with the **scraper-orchestrator** service (port 8001) which:
- Coordinates scraping tasks across multiple scrapers
- Manages task queues via RabbitMQ
- Handles rate limiting and backoff
- Aggregates results

See scraper-orchestrator documentation for orchestration details.

## Monitoring

All scrapers expose Prometheus metrics:
- Request counts
- Error rates
- Response times
- Queue depths

View metrics in Grafana: http://localhost:3001

## Support

For issues or questions:
1. Check logs: `docker compose logs -f scraper-NAME`
2. Verify configuration in `.env`
3. Ensure all dependencies are running
4. Check health endpoints: `curl http://localhost:PORT/health`