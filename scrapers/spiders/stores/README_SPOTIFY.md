# Spotify API Spider - Production Integration Guide

## Overview

The Spotify API spider (`spotify_spider.py`) is a production-ready scraper that integrates with the Spotify Web API to collect rich audio features and metadata for DJ playlists and electronic music tracks.

**Priority Score: 3.85 (HIGHEST ROI)**

## Features

### Rich Audio Features Extraction
- **BPM** (tempo in beats per minute)
- **Musical Key** (e.g., "Cmaj", "Amin")
- **Energy** (0.0-1.0) - intensity and activity
- **Danceability** (0.0-1.0) - suitability for dancing
- **Valence** (0.0-1.0) - musical positivity/happiness
- **Acousticness** (0.0-1.0) - confidence track is acoustic
- **Instrumentalness** (0.0-1.0) - predicts if track contains vocals
- **Liveness** (0.0-1.0) - presence of audience in recording
- **Speechiness** (0.0-1.0) - presence of spoken words
- **Loudness** (dB) - overall loudness

### Track Metadata
- Track name, ISRC, duration, popularity
- Artist information and relationships
- Album context
- Release date
- Explicit content flag

### Playlist Context
- Playlist name, curator, description
- Track order and position
- DJ-focused playlists (Tech House, Melodic Techno, etc.)

## Configuration

### 1. Spotify API Credentials

Get your credentials at: https://developer.spotify.com/dashboard

#### Option A: Frontend Settings UI (Recommended for Production)
1. Navigate to Settings panel (⚙️)
2. Go to API Keys tab
3. Add Spotify credentials:
   - **Service**: spotify
   - **Client ID**: `your_client_id_here`
   - **Client Secret**: `your_client_secret_here`

Credentials are encrypted in the database using `API_KEY_ENCRYPTION_SECRET`.

#### Option B: Environment Variables (Development/Testing)
```bash
export SPOTIFY_CLIENT_ID=your_client_id_here
export SPOTIFY_CLIENT_SECRET=your_client_secret_here
```

Or add to `.env` file:
```bash
SPOTIFY_CLIENT_ID=your_client_id_here
SPOTIFY_CLIENT_SECRET=your_client_secret_here
```

### 2. Database Configuration

The spider uses the centralized secrets manager for database access:

```python
from common.secrets_manager import get_database_config

db_config = get_database_config()
# Returns: {"host": "postgres", "port": 5432, "database": "musicdb",
#           "user": "musicdb_user", "password": "musicdb_secure_pass_2024"}
```

### 3. Redis Configuration (Optional but Recommended)

Redis is used for:
- OAuth token caching (prevents repeated authentication)
- Playlist deduplication (tracks processed items)

```bash
REDIS_HOST=redis  # or localhost for testing
REDIS_PORT=6379
REDIS_DB=0
```

## Usage

### Basic Usage (Search DJ Playlists)

```bash
# Using Docker Compose (MANDATORY for production)
docker compose run scrapers scrapy crawl spotify

# The spider will search for:
# - DJ Mix, Tech House, Melodic Techno
# - Progressive House, Deep House, Techno Mix
# - House Music, Electronic Mix, DJ Set
# - Club Mix, Festival Mix, Radio Mix
```

### Custom Search Query

```bash
docker compose run scrapers scrapy crawl spotify -a search_query="Afterlife"
```

### Specific Playlist IDs

```bash
docker compose run scrapers scrapy crawl spotify -a playlist_ids="37i9dQZF1DX4dyzvuaRJ0n,37i9dQZF1DX0BcQWzuB7XE"
```

### Combined Search

```bash
docker compose run scrapers scrapy crawl spotify \
  -a search_query="Drumcode Radio" \
  -a playlist_ids="37i9dQZF1DX6J5NfMJS675"
```

## Rate Limiting

The spider implements **conservative rate limiting** to ensure compliance with Spotify's API guidelines:

- **Download Delay**: 20 seconds between requests
- **Concurrent Requests**: 1 (no parallel requests)
- **AutoThrottle**: Enabled with max 60s delay
- **Batch Size**: 50 tracks per audio features request (max 100 allowed)
- **Playlist Limit**: 10 playlists per search query

Spotify API limits:
- **Official Limit**: 180 requests/minute (3/second)
- **Our Implementation**: ~0.05 requests/second (very conservative)

## Data Flow

1. **Authentication** (OAuth Client Credentials)
   - Request access token from `https://accounts.spotify.com/api/token`
   - Cache token in Redis (expires in ~3600s)
   - Reuse token for all subsequent requests

2. **Playlist Search**
   - Search for DJ playlists: `GET /v1/search?q=DJ+Mix&type=playlist`
   - Extract playlist IDs from results

3. **Playlist Details**
   - Fetch playlist: `GET /v1/playlists/{id}`
   - Extract track URIs and metadata

4. **Audio Features (Batch)**
   - Fetch features: `GET /v1/audio-features?ids={track_ids}`
   - Process 50 tracks per request (conservative batch size)

5. **Data Storage**
   - Transform with ItemLoaders (TrackLoader, ArtistLoader, PlaylistLoader)
   - Validate with Pydantic models
   - Insert into PostgreSQL via DatabasePipeline

## ItemLoader Processing

The spider uses **ItemLoaders** for consistent data transformation:

### TrackLoader
```python
loader = TrackLoader(item=EnhancedTrackItem(), response=response)
loader.add_value('track_name', track.get('name'))
loader.add_value('bpm', features.get('tempo'))  # Cleaned with clean_bpm()
loader.add_value('musical_key', self._map_key(...))  # Converted to notation
loader.add_value('energy', features.get('energy'))  # to_float()
track_item = loader.load_item()
```

### ArtistLoader
```python
loader = ArtistLoader(item=EnhancedArtistItem())
loader.add_value('artist_name', artist.get('name'))  # normalize_artist_name()
loader.add_value('spotify_id', artist.get('id'))  # strip_text()
artist_item = loader.load_item()
```

### PlaylistLoader
```python
loader = PlaylistLoader(item=PlaylistItem(), response=response)
loader.add_value('name', playlist.get('name'))
loader.add_value('source', 'spotify')
loader.add_value('total_tracks', playlist.get('tracks', {}).get('total'))
playlist_item = loader.load_item()
```

## Database Schema

The spider populates the following tables:

### `artists`
```sql
artist_id UUID PRIMARY KEY,
name TEXT NOT NULL,
normalized_name TEXT,
spotify_id TEXT UNIQUE,
genre_preferences TEXT[],
follower_count INTEGER,
monthly_listeners INTEGER,
popularity_score INTEGER,
...
```

### `songs`
```sql
song_id UUID PRIMARY KEY,
title TEXT NOT NULL,
normalized_title TEXT,
spotify_id TEXT UNIQUE,
isrc TEXT,
duration_ms INTEGER,
bpm INTEGER,
musical_key TEXT,
energy FLOAT,
danceability FLOAT,
valence FLOAT,
acousticness FLOAT,
instrumentalness FLOAT,
liveness FLOAT,
speechiness FLOAT,
loudness FLOAT,
...
```

### `playlists`
```sql
playlist_id UUID PRIMARY KEY,
name TEXT NOT NULL,
source TEXT,  -- 'spotify'
source_url TEXT,
spotify_playlist_id TEXT UNIQUE,
curator TEXT,
description TEXT,
total_tracks INTEGER,
...
```

## Error Handling

### Rate Limiting (429)
```python
if response.status == 429:
    retry_after = response.headers.get('Retry-After', 60)
    # Scrapy automatically retries with backoff
```

### Token Expiration (401)
```python
if response.status == 401:
    self.access_token = None
    # Re-authenticate on next request
```

### API Quota Limits
- Conservative rate limiting prevents quota exhaustion
- Redis caching reduces redundant requests
- Batch processing minimizes API calls

## Monitoring

### Logs
```bash
docker compose logs -f scrapers

# Expected output:
# ✓ Spotify credentials loaded (Client ID: 1a2b3c4d...)
# ✓ Spotify authentication successful (expires in 3600s)
# Found 15 playlists for query: DJ Mix
# Processing playlist: Afterlife Presents: Top of Mind
# ✓ Extracted 47 tracks with audio features
```

### Redis Cache Inspection
```bash
docker compose exec redis redis-cli

# View cached token
> GET scraped:playlists:spotify:access_token
> GET scraped:playlists:spotify:token_expiry

# View processed playlists
> KEYS scraped:playlists:spotify:*
```

### Database Verification
```sql
-- Check inserted tracks
SELECT
    title,
    bpm,
    musical_key,
    energy,
    danceability
FROM songs
WHERE data_source = 'spotify'
ORDER BY created_at DESC
LIMIT 10;

-- Check playlists
SELECT
    name,
    total_tracks,
    curator
FROM playlists
WHERE source = 'spotify'
ORDER BY created_at DESC;
```

## Troubleshooting

### Issue: "Required secret 'POSTGRES_PASSWORD' not found"
**Solution**: Set environment variable or use Docker Secrets
```bash
export POSTGRES_PASSWORD=musicdb_secure_pass_2024
```

### Issue: "Spotify API credentials not found"
**Solution**: Configure via Settings UI or set environment variables
```bash
export SPOTIFY_CLIENT_ID=your_client_id
export SPOTIFY_CLIENT_SECRET=your_secret
```

### Issue: "429 Rate Limit Exceeded"
**Solution**: Increase download delay in custom_settings
```python
'DOWNLOAD_DELAY': 30.0,  # Increase to 30 seconds
```

### Issue: "No playlists found"
**Solution**: Try more specific search queries
```bash
scrapy crawl spotify -a search_query="FISHER DJ Set"
```

## Performance Benchmarks

### Typical Execution Metrics
- **Authentication**: ~1 second
- **Playlist Search**: ~2-3 seconds per query
- **Playlist Fetch**: ~2-3 seconds per playlist
- **Audio Features**: ~3-5 seconds per 50-track batch
- **Total Time**: ~5-10 minutes for 100 tracks with conservative rate limiting

### Throughput
- **Conservative Mode** (current): ~5-10 playlists/hour, ~50-100 tracks/hour
- **Balanced Mode** (10s delay): ~15-20 playlists/hour, ~150-200 tracks/hour
- **Aggressive Mode** (3s delay): ~50+ playlists/hour (NOT RECOMMENDED - risk of rate limiting)

## Integration with Metadata Enrichment

The Spotify spider complements the metadata enrichment service:

1. **Spider**: Collects audio features for discovered tracks
2. **Enrichment Service**: Adds Spotify data to existing tracks from other sources
3. **Unified Database**: Consolidates all track metadata

```python
# Enrichment service can fetch additional data
from services.metadata_enrichment.api_clients import SpotifyClient

client = SpotifyClient()
audio_features = await client.get_audio_features(spotify_id)
```

## Best Practices

1. ✅ **Use Docker Compose** - Ensures proper service networking
2. ✅ **Configure via Frontend UI** - Encrypted credential storage
3. ✅ **Enable Redis Caching** - Reduces API calls
4. ✅ **Monitor Rate Limits** - Check logs for 429 errors
5. ✅ **Batch Processing** - Use 50-track batches for efficiency
6. ✅ **Conservative Delays** - Start with 20s delay, adjust as needed

## Future Enhancements

- [ ] Artist API integration (`/v1/artists/{id}`)
- [ ] Album track fetching (`/v1/albums/{id}/tracks`)
- [ ] Recommendations API (`/v1/recommendations`)
- [ ] Followed playlists (`/v1/me/playlists`) - requires user auth
- [ ] Track popularity trends over time
- [ ] Genre-based clustering using audio features

## References

- [Spotify Web API Documentation](https://developer.spotify.com/documentation/web-api)
- [Audio Features Reference](https://developer.spotify.com/documentation/web-api/reference/get-audio-features)
- [OAuth Client Credentials Flow](https://developer.spotify.com/documentation/web-api/tutorials/client-credentials-flow)
- [Rate Limiting Guidelines](https://developer.spotify.com/documentation/web-api/concepts/rate-limits)
