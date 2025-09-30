# 🎵 SongNodes Metadata Enrichment Service

Comprehensive metadata enrichment service implementing a waterfall pipeline strategy for acquiring track metadata from multiple authoritative sources.

## Overview

This service enriches track metadata using a **sequential waterfall approach** based on research-driven best practices:

1. **Spotify API** → Get ISRC, audio features, basic metadata
2. **MusicBrainz** → Get canonical identifiers, relationships, artist data
3. **Text search fallback** → When no identifiers available
4. **Discogs** → Release-specific metadata (label, catalog number)
5. **Last.fm** → User-generated tags, popularity metrics

## Features

### ✅ Waterfall Enrichment Pipeline
- Sequential API calls with intelligent fallback
- Identifier-based lookups prioritized over text search
- Automatic ISRC → MusicBrainz ID linking
- Comprehensive error handling and retry logic

### ✅ Advanced Metadata Fields
- **Audio Features**: energy, danceability, valence, tempo, key, mode
- **Harmonic Mixing**: Camelot key derivation for DJ mixing
- **Identifiers**: spotify_id, musicbrainz_id, isrc, discogs_id
- **Release Info**: label, catalog_number, release_year, release_country
- **Popularity**: spotify_popularity, lastfm_playcount

### ✅ Circuit Breakers & Rate Limiting
- Per-API circuit breakers (failure threshold: 5, timeout: 60s)
- Respectful rate limiting:
  - Spotify: 3 req/sec
  - MusicBrainz: 0.9 req/sec (1/sec limit)
  - Discogs: 0.9 req/sec (60/min limit)
  - Last.fm: 0.5 req/sec
- Exponential backoff on 429 responses

### ✅ Aggressive Caching
- Redis-based response caching
- TTL-based expiration (7-90 days depending on data type)
- Database-level API response cache table

### ✅ Prometheus Metrics
- `enrichment_tasks_total` - Total enrichment tasks by source and status
- `api_calls_total` - API calls by API and status
- `api_response_time_seconds` - API response time histogram
- `enrichment_cache_hits_total` / `cache_misses_total` - Cache performance
- `circuit_breaker_state` - Circuit breaker states per API
- `tracks_enriched_total` - Tracks enriched by status
- `enrichment_duration_seconds` - Enrichment duration histogram

## API Key Setup

### Required API Keys

1. **Spotify Web API** (Required)
   - Register at: https://developer.spotify.com/dashboard
   - Create an app to get Client ID and Client Secret
   - Set `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET`

2. **MusicBrainz** (No key required, but User-Agent with contact required)
   - Set `MUSICBRAINZ_USER_AGENT=YourApp/1.0 (contact@yourdomain.com)`
   - Respect 1 request/second rate limit

3. **Discogs API** (Required for release metadata)
   - Register at: https://www.discogs.com/settings/developers
   - Generate a Personal Access Token
   - Set `DISCOGS_TOKEN`

4. **Last.fm API** (Optional, for tags and popularity)
   - Register at: https://www.last.fm/api/account/create
   - Get API key
   - Set `LASTFM_API_KEY`

5. **Beatport API** (Optional, currently placeholder)
   - No official public API available
   - Set `BEATPORT_API_KEY` if using unofficial endpoints

### Environment Variables

Create a `.env` file in the project root:

```bash
# Spotify API (REQUIRED)
SPOTIFY_CLIENT_ID=your_spotify_client_id_here
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret_here

# MusicBrainz (REQUIRED - contact info)
MUSICBRAINZ_USER_AGENT=SongNodes/1.0 (your-email@example.com)

# Discogs API (REQUIRED for release metadata)
DISCOGS_TOKEN=your_discogs_personal_access_token_here

# Last.fm API (OPTIONAL)
LASTFM_API_KEY=your_lastfm_api_key_here

# Beatport (OPTIONAL - not fully implemented)
BEATPORT_API_KEY=your_beatport_key_if_available

# Database
POSTGRES_PASSWORD=your_secure_postgres_password

# Redis (default values work with docker-compose)
REDIS_HOST=redis
REDIS_PORT=6379
```

## Usage

### Start the Service

```bash
# Build and start all services including metadata-enrichment
docker compose up -d

# View logs
docker compose logs -f metadata-enrichment

# Check health
curl http://localhost:8022/health

# View metrics
curl http://localhost:8022/metrics
```

### API Endpoints

#### Health Check
```bash
GET /health
```

Returns service health including API client connectivity.

#### Enrich Single Track
```bash
POST /enrich
Content-Type: application/json

{
  "track_id": "uuid-of-track",
  "artist_name": "Artist Name",
  "track_title": "Track Title",
  "existing_spotify_id": "optional-spotify-id",
  "existing_isrc": "optional-isrc",
  "priority": 5,
  "force_refresh": false
}
```

#### Enrich Batch
```bash
POST /enrich/batch
Content-Type: application/json

[
  {
    "track_id": "uuid-1",
    "artist_name": "Artist 1",
    "track_title": "Track 1"
  },
  {
    "track_id": "uuid-2",
    "artist_name": "Artist 2",
    "track_title": "Track 2"
  }
]
```

#### Get Enrichment Statistics
```bash
GET /stats
```

Returns enrichment coverage statistics:
- Total tracks
- Tracks with Spotify ID, ISRC, MusicBrainz ID
- Tracks with BPM, key, audio features
- Coverage percentages

#### Prometheus Metrics
```bash
GET /metrics
```

### Database Schema

The service creates and uses the following tables:

#### `enrichment_status`
Tracks enrichment progress for each track:
- `track_id` - Reference to tracks table
- `status` - pending, in_progress, completed, partial, failed
- `sources_enriched` - Number of APIs that returned data
- `last_attempt` - Last enrichment attempt timestamp
- `retry_count` - Number of retry attempts
- `error_message` - Last error if failed

#### `api_cache`
Caches API responses to minimize external calls:
- `cache_key` - Unique cache key
- `api_source` - spotify, musicbrainz, discogs, etc.
- `endpoint` - API endpoint called
- `response_data` - Cached JSON response
- `expires_at` - TTL expiration timestamp

### Enriched Metadata Fields

The service populates the following fields in the `tracks` table:

**Core Identifiers:**
- `spotify_id`
- `isrc`
- `musicbrainz_id`
- `discogs_id`

**Audio Features:**
- `bpm` (from Spotify tempo)
- `key` (musical key)
- `camelot_key` (Camelot Wheel notation)
- `energy` (0.0-1.0)
- `danceability` (0.0-1.0)
- `valence` (0.0-1.0)
- `acousticness` (0.0-1.0)
- `instrumentalness` (0.0-1.0)
- `liveness` (0.0-1.0)
- `speechiness` (0.0-1.0)
- `loudness` (dB)
- `time_signature`

**Release Metadata:**
- `label`
- `catalog_number`
- `release_date`
- `release_country`

**Popularity:**
- `spotify_popularity` (0-100)
- `lastfm_playcount`
- `lastfm_listeners`

**Metadata JSONB:**
- `enrichment_sources` - Array of APIs used
- `lastfm_tags` - User-generated tags
- `enriched_at` - Enrichment timestamp

## Monitoring

### Prometheus Metrics

The service exposes comprehensive metrics at `/metrics`:

```
# Example queries in Prometheus/Grafana

# Enrichment success rate
rate(enrichment_tasks_total{status="completed"}[5m]) / rate(enrichment_tasks_total[5m])

# API latency by source
histogram_quantile(0.95, rate(api_response_time_seconds_bucket[5m]))

# Cache hit rate
rate(enrichment_cache_hits_total[5m]) / (rate(enrichment_cache_hits_total[5m]) + rate(enrichment_cache_misses_total[5m]))

# Circuit breaker state
circuit_breaker_state{state="open"} > 0
```

### Grafana Dashboard

Create dashboards tracking:
- Enrichment throughput and success rate
- API latency and error rates
- Cache hit ratios
- Circuit breaker states
- Queue sizes and processing times

## Scheduled Tasks

The service runs automatic enrichment tasks:

- **Every 15 minutes**: Process pending enrichments (100 tracks per batch)
- **Every minute**: Update circuit breaker metrics

Tracks are automatically queued for enrichment when:
- `enrichment_status` is NULL or 'pending'
- Status is 'failed' with retry_count < 3
- Status is 'partial' and last attempt > 24 hours ago

## Architecture

```
┌─────────────────┐
│   API Request   │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│   Metadata Enrichment Pipeline          │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │  1. Check Cache                   │ │
│  └───────────────────────────────────┘ │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │  2. Spotify (if spotify_id exists)│ │
│  │     └─> Get audio features        │ │
│  └───────────────────────────────────┘ │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │  3. MusicBrainz (if ISRC exists)  │ │
│  │     └─> Get canonical identifiers │ │
│  └───────────────────────────────────┘ │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │  4. Text search fallback          │ │
│  │     └─> Spotify & MusicBrainz    │ │
│  └───────────────────────────────────┘ │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │  5. Discogs (release metadata)    │ │
│  └───────────────────────────────────┘ │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │  6. Last.fm (tags & popularity)   │ │
│  └───────────────────────────────────┘ │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │  7. Derive Camelot Key            │ │
│  └───────────────────────────────────┘ │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │  8. Update Database & Cache       │ │
│  └───────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

## Circuit Breaker Pattern

Each API client implements the circuit breaker pattern:

**States:**
- `CLOSED` - Normal operation
- `OPEN` - Failing, reject calls
- `HALF_OPEN` - Testing recovery

**Configuration:**
- Failure threshold: 5 consecutive failures
- Timeout: 60 seconds before retry
- Success threshold: 2 successful calls to close

**Behavior:**
- After 5 failures → Circuit opens
- After 60 seconds → Attempt recovery (half-open)
- After 2 successes in half-open → Circuit closes
- Failure in half-open → Circuit reopens

## Rate Limiting

All API clients implement token bucket rate limiting:

| API | Rate Limit | Implementation |
|-----|-----------|----------------|
| Spotify | 3 req/sec | Token bucket with 333ms min interval |
| MusicBrainz | 0.9 req/sec | Token bucket with 1.1s min interval |
| Discogs | 0.9 req/sec | Token bucket with 1.1s min interval (60/min) |
| Last.fm | 0.5 req/sec | Token bucket with 2s min interval |
| Beatport | 0.5 req/sec | Token bucket with 2s min interval |

Additional handling:
- Exponential backoff on 429 responses
- `Retry-After` header respect
- Circuit breaker integration

## Development

### Local Development

```bash
# Install dependencies
cd services/metadata-enrichment
pip install -r requirements.txt

# Run locally (ensure Redis and PostgreSQL are available)
export DATABASE_URL=postgresql+asyncpg://musicdb_user:password@localhost:5433/musicdb
export REDIS_HOST=localhost
export REDIS_PORT=6380
export SPOTIFY_CLIENT_ID=your_client_id
export SPOTIFY_CLIENT_SECRET=your_client_secret

# Run via Docker Compose (REQUIRED per CLAUDE.md)
docker compose up -d metadata-enrichment
```

### Testing

```bash
# Test enrichment endpoint
curl -X POST http://localhost:8022/enrich \
  -H "Content-Type: application/json" \
  -d '{
    "track_id": "test-uuid",
    "artist_name": "Daft Punk",
    "track_title": "One More Time"
  }'

# Check health
curl http://localhost:8022/health

# View stats
curl http://localhost:8022/stats
```

## Troubleshooting

### Circuit Breakers Opening
**Problem:** Circuit breakers frequently open for specific APIs

**Solutions:**
- Check API credentials are valid
- Verify rate limits aren't exceeded
- Review error logs for specific API failures
- Check network connectivity to external APIs

### Low Enrichment Success Rate
**Problem:** Most tracks remain un-enriched or partially enriched

**Solutions:**
- Verify all API keys are configured correctly
- Check that tracks have artist names and titles
- Review `enrichment_status` table for error messages
- Ensure existing identifiers (spotify_id, isrc) are valid

### High API Response Times
**Problem:** Enrichment takes too long

**Solutions:**
- Verify Redis cache is working (check cache hit rate)
- Ensure circuit breakers aren't stuck open
- Check database connection pool isn't exhausted
- Review API rate limiting delays

### Memory Issues
**Problem:** Service consuming too much memory

**Solutions:**
- Redis cache may be too large - reduce TTL values
- Check for connection leaks in database pool
- Review batch sizes for scheduled enrichment
- Monitor container resource limits

## References

### Research Documents
- `/docs/research/research_sources_gemini.md` - Comprehensive enrichment strategy
- `/docs/research/research_souces_claude.md` - API details and integration patterns

### External API Documentation
- [Spotify Web API](https://developer.spotify.com/documentation/web-api)
- [MusicBrainz API](https://musicbrainz.org/doc/MusicBrainz_API)
- [Discogs API](https://www.discogs.com/developers)
- [Last.fm API](https://www.last.fm/api)

## License

Part of the SongNodes project.