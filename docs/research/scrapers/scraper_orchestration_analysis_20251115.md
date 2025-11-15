# SongNodes Scraper Orchestration & Configuration Analysis

**Research Date:** 2025-11-15
**Analyst:** Claude Code
**Focus:** Scraper architecture, orchestration patterns, data flow, and configuration

---

## Executive Summary

The SongNodes scraping system uses a sophisticated **unified scraper architecture** with centralized orchestration, replacing the original 12 separate scraper deployments. The system implements:

- **Unified Scraper API** (`/home/marku/Documents/programming/songnodes/scrapers/unified_scraper_api.py`) - Single service consolidating all scrapers
- **Scraper Orchestrator** (`/home/marku/Documents/programming/songnodes/services/scraper-orchestrator/main.py`) - Coordinating search → scrape → persistence pipeline
- **Target Track Searcher** - Finding playlists containing target tracks from `target_track_searches` table
- **Pipeline Architecture** - Validation → Enrichment → API Enrichment → Persistence

---

## 1. Scraper Orchestrator Architecture

### 1.1 Core Components

#### **Location:** `/home/marku/Documents/programming/songnodes/services/scraper-orchestrator/`

**Primary Files:**
- `main.py` - Enhanced orchestrator with circuit breakers, health monitoring, structured logging
- `target_track_searcher.py` - 2025 best practices implementation for multi-platform search
- `redis_queue_consumer.py` - Task queue consumer for distributed scraping
- `direct_scrapers.py` - Direct CSS selector-based scrapers (no browser automation)
- `browser_collector_fallback.py` - Browser automation fallback for JavaScript-heavy sites

### 1.2 Orchestrator Endpoints

**Base URL:** `http://scraper-orchestrator:8014` (internal service)

#### **Health & Monitoring**
```
GET  /health          - Health check with connection status
GET  /metrics         - Prometheus metrics endpoint
GET  /queue/stats     - Queue statistics (pending, running, failed)
```

#### **Target Track Search**
```
POST /search/start    - Initiate automated search for target tracks
     Params:
       - force_rescrape (bool): Bypass 24-hour rate limit
       - clear_last_searched (bool): Reset timestamps
       - track_id (UUID): Search specific track
       - artist (str): Filter by artist
       - title (str): Filter by title
       - limit (int): Max tracks to process (default: 20)

GET  /search/status   - Get current search operation status
```

#### **Manual Scraping**
```
POST /scrape          - Manually trigger scraper for specific URL
     Body: {"scraper": "mixesdb", "url": "...", "priority": "high"}

POST /scrape/batch    - Queue multiple scraping tasks
     Body: [{"scraper": "...", "url": "..."}, ...]
```

#### **Queue Management**
```
GET  /queue/pending   - List pending tasks
GET  /queue/failed    - List failed tasks
POST /queue/retry     - Retry failed task by ID
POST /queue/cleanup-expired - Remove tasks older than 3 days (automated: daily @ 3 AM UTC)
```

---

## 2. Unified Scraper API

### 2.1 Service Configuration

**Location:** `/home/marku/Documents/programming/songnodes/scrapers/unified_scraper_api.py`

**Purpose:** Consolidates 12 separate scraper deployments into a single service

**Port:** 8000 (internal), exposed as `unified-scraper` service in Kubernetes

### 2.2 Supported Sources

```python
SPIDER_MAP = {
    "1001tracklists": "1001tracklists",
    "mixesdb": "mixesdb",
    "setlistfm": "setlistfm",
    "reddit": "reddit",
    "bbc_sounds": "bbc_sounds_rave_forever",
    "internetarchive": "generic_archive",
    "livetracklist": "watchthedj",
    "mixcloud": "generic_archive",
    "soundcloud": "generic_archive",
    "youtube": "generic_archive",
    "residentadvisor": "generic_archive",
}
```

### 2.3 API Endpoints

**Base URL:** `http://unified-scraper:8000`

```
GET  /health          - Health check
GET  /metrics         - Prometheus metrics
GET  /sources         - List all supported sources

POST /scrape          - Execute scraping task
     Body (MixesDB example):
     {
       "source": "mixesdb",
       "search_query": "Deadmau5 Strobe",  // Preferred: Combined search
       "artist_name": "Deadmau5",          // Fallback: Artist-only search
       "start_urls": "https://...",        // Direct URL scraping
       "limit": 5
     }

     Response:
     {
       "status": "success",
       "source": "mixesdb",
       "task_id": "mixesdb_20251115_143022",
       "items_processed": 42,
       "items_scraped": 45,
       "duration_seconds": 67.23
     }
```

### 2.4 Scraping Workflow

```mermaid
graph TD
    A[Orchestrator] -->|POST /scrape| B[Unified Scraper API]
    B -->|Build Command| C[scrapy crawl spider_name -a params]
    C -->|Execute| D[Spider Process]
    D -->|Extract| E[Raw Items]
    E -->|Pipeline| F[Validation Pipeline Priority 100]
    F -->|Pipeline| G[Enrichment Pipeline Priority 200]
    G -->|Pipeline| H[API Enrichment Priority 250]
    H -->|Pipeline| I[Persistence Pipeline Priority 300]
    I -->|Upsert| J[(PostgreSQL Database)]
    D -->|Logs| K[Parse Stats]
    K -->|Extract| B
    B -->|Response| A
```

---

## 3. Available Spiders

### 3.1 Spider Implementations

**Location:** `/home/marku/Documents/programming/songnodes/scrapers/spiders/`

| Spider File | Name | Status | Purpose |
|-------------|------|--------|---------|
| `mixesdb_spider.py` | mixesdb | **ENABLED** | MixesDB tracklists (underground electronic) |
| `1001tracklists_spider.py` | 1001tracklists | **ENABLED** | 1001tracklists DJ sets |
| `setlistfm_spider.py` | setlistfm | **ENABLED** | Setlist.fm live performances (rock/pop) |
| `reddit_spider.py` | reddit | **ENABLED** | Reddit music discussions |
| `bbc_sounds_rave_forever_spider.py` | bbc_sounds_rave_forever | **ENABLED** | BBC Sounds radio tracklists |
| `generic_archive_spider.py` | generic_archive | **ENABLED** | Internet Archive, Mixcloud, SoundCloud |
| `watchthedj_spider.py` | watchthedj | **ENABLED** | WatchTheDJ live tracklists |
| `musicbrainz_spider.py` | musicbrainz | DISABLED | Foundational metadata (Section 1.1) |
| `applemusic_spider.py` | applemusic | DISABLED | Apple Music API integration |
| `jambase_spider.py` | jambase | DISABLED | Live music events |

### 3.2 MixesDB Spider Configuration (Primary Source)

**Location:** `/home/marku/Documents/programming/songnodes/scrapers/spiders/mixesdb_spider.py:49-76`

```python
custom_settings = {
    'DOWNLOAD_DELAY': 15.0,  # 15 seconds between requests
    'RANDOMIZE_DOWNLOAD_DELAY': 0.3,  # Range: 10.5-19.5 seconds
    'CONCURRENT_REQUESTS': 1,
    'CONCURRENT_REQUESTS_PER_DOMAIN': 1,
    'AUTOTHROTTLE_ENABLED': True,
    'AUTOTHROTTLE_START_DELAY': 15,
    'AUTOTHROTTLE_MAX_DELAY': 60,  # Up to 1 minute if needed
    'AUTOTHROTTLE_TARGET_CONCURRENCY': 0.2,
    'RETRY_TIMES': 3,
    'DOWNLOAD_TIMEOUT': 30,
    'ITEM_PIPELINES': {
        'pipelines.raw_data_storage_pipeline.RawDataStoragePipeline': 50,
        'pipelines.validation_pipeline.ValidationPipeline': 100,
        'pipelines.enrichment_pipeline.EnrichmentPipeline': 200,
        'pipelines.api_enrichment_pipeline.APIEnrichmentPipeline': 250,
        'pipelines.persistence_pipeline.PersistencePipeline': 300,
    }
}
```

**Key Parameters:**
- **search_query** (preferred): Combined "Artist Track" search (e.g., "Deadmau5 Strobe")
- **artist_name** (fallback): Artist-only search
- **start_urls** (direct): Specific mix page URLs for targeted scraping
- **limit**: Max results per search (default: 5 via `MIXESDB_MAX_RESULTS_PER_SEARCH` env)

**Search URL Generation:**
```python
# MediaWiki Special:Search syntax
search_url = f"https://www.mixesdb.com/w/index.php?title=Special:Search&search={quote(search_query)}"

# Example: "Deadmau5 Strobe" →
# https://www.mixesdb.com/w/index.php?title=Special:Search&search=Deadmau5+Strobe
```

---

## 4. Target Track Searches Integration

### 4.1 Database Schema

**Location:** `/home/marku/Documents/programming/songnodes/sql/init/01-schema.sql:468-477`

```sql
CREATE TABLE IF NOT EXISTS musicdb.target_track_searches (
    search_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    target_title VARCHAR(500),
    target_artist VARCHAR(255),
    search_query TEXT,              -- Combined "Artist Track"
    scraper_name VARCHAR(50),       -- Which scraper performed search
    results_found INTEGER,          -- Total search results
    playlists_containing INTEGER,   -- Playlists containing target track
    search_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 4.2 Search Workflow

**Implementation:** `/home/marku/Documents/programming/songnodes/services/scraper-orchestrator/target_track_searcher.py:401-467`

```mermaid
graph TD
    A[Load target_tracks table] -->|WHERE is_active = true| B[Filter by criteria]
    B -->|track_id, artist, title, limit| C[Build search_query]
    C -->|For each track| D[Multi-Platform Search]
    D -->|1001tracklists| E1[Artist DJ Page]
    D -->|mixesdb| E2[insource: MediaWiki Query]
    D -->|setlistfm| E3[REST API Search]
    D -->|livetracklist| E4[Scraper Service]
    D -->|residentadvisor| E5[Scraper Service]
    E1 --> F[Aggregate URLs]
    E2 --> F
    E3 --> F
    E4 --> F
    E5 --> F
    F -->|Validate URLs| G[Filter Navigation/Social Links]
    G -->|Store Results| H[Insert target_track_searches]
    H -->|Update Stats| I[Update target_tracks.last_searched]
    F -->|Create Tasks| J[Queue Scraping Tasks]
    J -->|Redis + RabbitMQ| K[Scraper Workers]
```

### 4.3 Search Strategy Per Platform

**1001tracklists:**
```python
# Strategy: Browse DJ/artist page directly (no generic search)
# Location: target_track_searcher.py:598-672

artist_slug = track['artist'].lower().replace(' ', '-')
artist_page_url = f"https://www.1001tracklists.com/dj/{artist_slug}/"

# Extract tracklist URLs from artist page using CSS selectors
# Avoids search which returns navigation/social links
```

**MixesDB:**
```python
# Strategy: MediaWiki insource: operator for surgical lookup
# Location: target_track_searcher.py:674-745

insource_query = f'insource:"{track["artist"]} - {track["title"]}"'
search_url = f"https://www.mixesdb.com/w/index.php?search={quote(insource_query)}"

# Example: insource:"Calvin Harris - Summer"
# Returns ONLY pages containing that exact track in content
```

**Setlist.fm:**
```python
# Strategy: Official REST API (2025 best practice)
# Location: target_track_searcher.py:747-837

search_url = "https://api.setlist.fm/rest/1.0/search/setlists"
params = {
    'songName': track['title'],
    'artistName': track['artist'],
    'p': 1
}
headers = {'x-api-key': api_key, 'Accept': 'application/json'}

# Returns structured JSON with pre-formatted URLs
# No browser scraping or LLM parsing needed
```

### 4.4 Rate Limiting & Quotas

**Implementation:** `/home/marku/Documents/programming/songnodes/services/scraper-orchestrator/target_track_searcher.py:1327-1337`

```python
# Default: Randomized 50-70 minute interval per track
# Allows ~10 tracks/hour without overwhelming sources

import random
random_minutes = random.randint(50, 70)
where_conditions.append(
    f"(last_searched IS NULL OR last_searched < NOW() - INTERVAL '{random_minutes} minutes')"
)

# Override with force_rescrape flag to bypass rate limit
if force_rescrape:
    # Scrape all active tracks immediately
```

**Redis State Management:**
```python
# Location: mixesdb_spider.py:167-197

# Daily quota enforcement (prevents duplicate runs within 24 hours)
SCRAPER_RUN_TTL_HOURS = 24  # Default
SCRAPER_FORCE_RUN = 0       # Set to 1 to override

# Redis key: "scraped:setlists:mixesdb:last_run"
# Stores timestamp of last successful run
```

---

## 5. Scraper Output & Database Insertion

### 5.1 Pipeline Architecture

**Global Configuration:** `/home/marku/Documents/programming/songnodes/scrapers/settings.py:90-98`

```python
ITEM_PIPELINES = {
   'pipelines.validation_pipeline.ValidationPipeline': 100,
   'pipelines.enrichment_pipeline.EnrichmentPipeline': 200,
   'pipelines.api_enrichment_pipeline.APIEnrichmentPipeline': 250,
   'nlp_fallback_pipeline.NLPFallbackPipeline': 260,
   'pipelines.persistence_pipeline.PersistencePipeline': 300,
   'pipelines.discogs_enrichment_pipeline.DiscogsEnrichmentPipeline': 400,
   'pipelines.reddit_validation_pipeline.RedditValidationPipeline': 450,
}
```

### 5.2 Item Types & Structure

**Location:** `/home/marku/Documents/programming/songnodes/scrapers/items.py`

**Primary Items:**
```python
class EnhancedSetlistItem:
    # Playlist/setlist metadata
    setlist_id: str
    setlist_name: str
    event_date: datetime
    venue_name: str
    dj_name: str  # May be NULL for compilation mixes
    source: str   # "mixesdb", "1001tracklists", etc.
    source_url: str

class EnhancedTrackItem:
    # Track metadata
    track_id: str
    title: str
    normalized_title: str
    isrc: str
    spotify_id: str
    bpm: Decimal
    key: str
    energy: Decimal

class PlaylistItem:
    # Used for persistence and graph edges
    name: str
    source: str
    source_url: str
    playlist_type: str  # "DJ Set", "Radio Show", "Compilation"
    tracks: List[TrackItem]  # Sequential track list
    tracklist_raw: str  # Original HTML/text
```

### 5.3 Persistence Pipeline Flow

**Location:** `/home/marku/Documents/programming/songnodes/scrapers/pipelines/persistence_pipeline.py`

```python
class PersistencePipeline:
    """Priority 300 - Final stage: Database upserts"""

    # Connection pool (asyncpg)
    pool_size = 5
    max_overflow = 10
    pool_timeout = 30

    # Batch processing
    batch_size = 50
    flush_interval = 10  # seconds

    # Persistent background thread for flushing
    # Bypasses Scrapy/Twisted async incompatibility
```

**Batch Management:**
```python
item_batches = {
    'bronze_tracks': [],      # Raw track data (archival)
    'bronze_playlists': [],   # Raw playlist data (archival)
    'artists': [],            # Silver layer: normalized artists
    'tracks': [],             # Silver layer: enriched tracks
    'playlists': [],          # Silver layer: validated playlists
    'playlist_tracks': [],    # Track positions in playlists
}

# Note: adjacency table auto-populated by DB triggers
# Source: playlist_tracks → track_adjacency (graph edges)
```

### 5.4 Database Upsert Logic

**Implementation:** `persistence_pipeline.py:272-300`

```python
async def process_item(self, item: Dict[str, Any], spider: Spider):
    """
    Route item to appropriate handler:
    - artist → _process_artist_item()
    - track → _process_track_item()
    - playlist → _process_playlist_item()

    Each handler:
    1. Adds to batch
    2. Triggers flush if batch_size reached
    3. Uses INSERT ... ON CONFLICT DO UPDATE for upserts
    """
```

**Artist Upsert:**
```sql
INSERT INTO artists (id, name, normalized_name, spotify_id, metadata)
VALUES ($1, $2, $3, $4, $5)
ON CONFLICT (normalized_name)
DO UPDATE SET
    name = EXCLUDED.name,
    spotify_id = COALESCE(EXCLUDED.spotify_id, artists.spotify_id),
    metadata = artists.metadata || EXCLUDED.metadata,
    updated_at = CURRENT_TIMESTAMP
```

**Track Upsert:**
```sql
INSERT INTO tracks (id, title, normalized_title, isrc, spotify_id, bpm, key, metadata)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
ON CONFLICT (isrc)
DO UPDATE SET
    title = EXCLUDED.title,
    bpm = COALESCE(EXCLUDED.bpm, tracks.bpm),
    key = COALESCE(EXCLUDED.key, tracks.key),
    spotify_id = COALESCE(EXCLUDED.spotify_id, tracks.spotify_id),
    metadata = tracks.metadata || EXCLUDED.metadata,
    updated_at = CURRENT_TIMESTAMP
```

**Playlist → Track Adjacency (Graph Edges):**
```sql
-- Step 1: Insert playlist_tracks (sequential positions)
INSERT INTO playlist_tracks (playlist_id, track_id, position)
VALUES ($1, $2, $3)
ON CONFLICT (playlist_id, track_id) DO NOTHING

-- Step 2: Auto-generate track_adjacency via DB trigger
-- Trigger: playlist_tracks INSERT/UPDATE
-- Logic: For consecutive tracks in same playlist:
--   INSERT INTO track_adjacency (from_track_id, to_track_id, weight)
--   VALUES (track_n, track_n+1, 1)
--   ON CONFLICT (from_track_id, to_track_id)
--   DO UPDATE SET weight = track_adjacency.weight + 1
```

### 5.5 Data Format Examples

**Spider Output (Before Pipelines):**
```python
# mixesdb_spider.py yields:
{
    'type': 'playlist',
    'name': '2019-06-15 - Deadmau5 @ Ultra Music Festival',
    'source': 'mixesdb',
    'source_url': 'https://www.mixesdb.com/w/2019-06-15_Deadmau5_Ultra',
    'tracklist': [
        {
            'artist': 'deadmau5',
            'title': 'Ghosts n Stuff',
            'position': 1,
            'bpm': 128,
            'key': 'A Minor'
        },
        {
            'artist': 'deadmau5',
            'title': 'Strobe',
            'position': 2,
            'bpm': 128,
            'key': 'Db Major'
        },
        # ... more tracks
    ]
}
```

**After Validation Pipeline (Priority 100):**
```python
# Validated with Pydantic models
# - Required fields present
# - Types correct
# - Artist names non-empty/non-"Unknown"
# - Track positions sequential
```

**After Enrichment Pipeline (Priority 200):**
```python
{
    # Added normalized fields
    'normalized_artist': 'deadmau5',
    'normalized_title': 'ghosts n stuff',

    # Detected remix/mashup
    'is_remix': False,
    'is_mashup': False,
    'is_live': False,

    # Parsed components
    'remix_artist': None,
    'mashup_components': None,

    # Genre normalization
    'genre': 'Progressive House',
    'subgenre': 'Electro House'
}
```

**After API Enrichment (Priority 250):**
```python
{
    # Added external IDs
    'spotify_id': '3KFUGJHWffGTyGsy3MoeA0',
    'isrc': 'USCA20900345',

    # Audio features from Spotify API
    'bpm': 128.04,
    'key': 'Ab',
    'energy': 0.89,
    'danceability': 0.68,
    'valence': 0.43,

    # Metadata from MusicBrainz
    'mbid': '...',
    'release_date': '2009-06-15',
    'label': 'Ultra Records'
}
```

**Final Database Insert (Priority 300):**
```python
# Upserted to PostgreSQL:
# - artists: deadmau5
# - tracks: Ghosts n Stuff, Strobe, ...
# - playlists: 2019-06-15 Deadmau5 @ Ultra
# - playlist_tracks: (playlist_id, track_id, position)
# - track_adjacency: (Ghosts n Stuff → Strobe, weight=1)
```

---

## 6. Error Handling & Retry Mechanisms

### 6.1 Spider-Level Error Handling

**Location:** `mixesdb_spider.py:461-518`

```python
def parse_mix_page(self, response):
    """Parse individual mix page with CSS selector-based extraction"""
    try:
        # Extract setlist metadata
        setlist_data = self.extract_enhanced_setlist_data(response)
        if setlist_data:
            yield EnhancedSetlistItem(**setlist_data)

        # Extract tracks
        tracks_data = self.extract_enhanced_tracks(response, setlist_data)

        if not tracks_data:
            # Yield parsing failure item for retry tracking
            yield PlaylistItem(
                name=setlist_data.get('setlist_name', 'Unknown'),
                source='mixesdb',
                source_url=response.url,
                playlist_type='DJ Set',
                tracklist=[],
                parsing_failed=True,
                parsing_error='No tracks extracted via CSS selectors'
            )
    except Exception as e:
        self.logger.error(f"Parse error: {e}", exc_info=True)
```

**Error Callback:**
```python
def handle_error(self, failure):
    """Handle request failures"""
    self.logger.error(
        f"Request failed: {failure.request.url}",
        exc_info=failure
    )
```

### 6.2 Pipeline-Level Error Handling

**Validation Pipeline (Priority 100):**
```python
def process_item(self, item, spider):
    """Validate using Pydantic models"""
    try:
        if item.get('type') == 'playlist':
            validated = PlaylistItemValidator(**item)
        elif item.get('type') == 'track':
            validated = TrackItemValidator(**item)
        else:
            raise DropItem(f"Unknown item type: {item.get('type')}")

        return dict(validated)
    except ValidationError as e:
        spider.logger.warning(f"Validation failed: {e}")
        raise DropItem(f"Validation error: {e}")
```

**Enrichment Pipeline (Priority 200):**
```python
def process_item(self, item, spider):
    """Enrich with metadata - graceful degradation"""
    try:
        # Attempt enrichment
        enriched = self.enrich_metadata(item)
        return enriched
    except Exception as e:
        spider.logger.warning(f"Enrichment failed: {e}")
        # Return original item, don't drop
        return item
```

**Persistence Pipeline (Priority 300):**
```python
async def process_item(self, item, spider):
    """Persist to database with retry logic"""
    try:
        await self._persist_item(item)
    except Exception as e:
        self.stats['failed_items'] += 1
        spider.logger.error(f"Persistence failed: {e}")

        # Add to retry queue if retries < max_retries
        if item.get('retry_count', 0) < 3:
            item['retry_count'] = item.get('retry_count', 0) + 1
            await self._add_to_retry_queue(item)
        else:
            raise DropItem(f"Max retries exceeded: {e}")
```

### 6.3 Orchestrator-Level Error Handling

**Circuit Breaker Pattern:**
```python
# Location: target_track_searcher.py:53-128

class AsyncCircuitBreaker:
    """
    States: CLOSED → OPEN → HALF_OPEN → CLOSED

    CLOSED: Normal operation
    OPEN: Failures >= threshold, block requests
    HALF_OPEN: Recovery timeout elapsed, test with limited traffic
    """

    failure_threshold = 3      # Open after 3 failures
    recovery_timeout = 30.0    # Retest after 30 seconds

    async def call(self, func, *args, **kwargs):
        if self.state == CircuitState.OPEN:
            if time.time() - self.last_failure_time < recovery_timeout:
                # Block request, return fallback
                if self.config.fallback_function:
                    return await self.config.fallback_function(*args, **kwargs)
                raise Exception("Circuit breaker OPEN")
```

**Per-Platform Circuit Breakers:**
```python
# Location: target_track_searcher.py:284-376

self.circuit_breakers = {
    '1001tracklists': AsyncCircuitBreaker(...),
    'mixesdb': AsyncCircuitBreaker(...),
    'setlistfm': AsyncCircuitBreaker(...),
    'livetracklist': AsyncCircuitBreaker(...),
    'residentadvisor': AsyncCircuitBreaker(...),
    'youtube': AsyncCircuitBreaker(...),
    'soundcloud': AsyncCircuitBreaker(...),
    'mixcloud': AsyncCircuitBreaker(...),
    'reddit': AsyncCircuitBreaker(...),
    'internetarchive': AsyncCircuitBreaker(...),
    'database': AsyncCircuitBreaker(failure_threshold=3, recovery_timeout=60.0),
}
```

### 6.4 Retry Configuration

**Scrapy Settings:**
```python
# Location: settings.py:139-140

RETRY_TIMES = 3
RETRY_HTTP_CODES = [500, 502, 503, 504, 522, 524, 408, 429]
```

**Unified Scraper API Retry:**
```python
# Location: unified_scraper_api.py:115-168

async def _run_spider(cmd: list[str], timeout: int = 900):
    """Execute spider with timeout"""
    try:
        stdout, stderr = await asyncio.wait_for(
            process.communicate(),
            timeout=timeout
        )
    except asyncio.TimeoutError:
        process.kill()
        return {
            "status": "timeout",
            "stderr": f"Spider timeout after {timeout} seconds"
        }
```

**Task Queue Retry:**
```python
# Location: main.py (orchestrator)

class ScrapingTask(BaseModel):
    retry_count: int = 0
    max_retries: int = 3

    # Failed tasks stored in Redis "failed_queue"
    # Manual retry via POST /queue/retry/{task_id}
    # Automated cleanup: Daily @ 3 AM UTC (removes tasks >3 days old)
```

---

## 7. Monitoring & Observability

### 7.1 Prometheus Metrics

**Unified Scraper API Metrics:**
```python
# Location: unified_scraper_api.py:41-58

scrape_requests_total = Counter(
    'unified_scraper_requests_total',
    'Total scrape requests',
    ['source', 'status']  # Labels: source=mixesdb, status=success/error/timeout
)

scrape_duration_seconds = Histogram(
    'unified_scraper_duration_seconds',
    'Scrape request duration',
    ['source', 'status'],
    buckets=[1, 5, 15, 30, 60, 120, 300, 600, 900]  # Up to 15 minutes
)

items_scraped_total = Counter(
    'unified_scraper_items_total',
    'Total items scraped',
    ['source']
)
```

**Orchestrator Metrics:**
```python
# Location: main.py:70-76

scraping_tasks_total = Counter('scraping_tasks_total', 'Total scraping tasks', ['scraper', 'status'])
active_scrapers = Gauge('active_scrapers', 'Active scrapers', ['scraper'])
scraping_duration = Histogram('scraping_duration_seconds', 'Task duration', ['scraper'])
queue_size = Gauge('scraping_queue_size', 'Queue size', ['priority'])
circuit_breaker_state = Gauge('circuit_breaker_state', 'Circuit breaker states', ['service', 'state'])
database_operations = Counter('database_operations_total', 'Database operations', ['operation', 'status'])
search_operations = Counter('search_operations_total', 'Search operations', ['platform', 'status'])
```

**Persistence Pipeline Metrics:**
```python
# Location: persistence_pipeline.py:42-59

playlists_created = Counter(
    'playlists_created_total',
    'Total playlists created',
    ['source', 'tracklist_count']
)

silent_failures = Counter(
    'silent_scraping_failures_total',
    'Playlists with 0 tracks and no error',
    ['source', 'parsing_version']
)

tracks_extracted = Counter(
    'tracks_extracted_total',
    'Total tracks extracted',
    ['source']
)
```

### 7.2 Structured Logging

**Configuration:**
```python
# Location: main.py:42-53

structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,  # Correlation IDs
        structlog.processors.add_log_level,
        structlog.processors.StackInfoRenderer(),
        structlog.dev.set_exc_info,
        structlog.processors.JSONRenderer()       # Machine-readable logs
    ],
    wrapper_class=structlog.make_filtering_bound_logger(20),  # INFO level
    logger_factory=structlog.WriteLoggerFactory(),
)
```

**Correlation ID Tracking:**
```python
# Every request/operation gets unique correlation_id
# Propagated through:
# - HTTP headers: x-correlation-id
# - Log context: correlation_id field
# - Database queries: tagged with correlation_id
# - External API calls: passed as header

correlation_id = str(uuid.uuid4())[:8]  # 8-char short ID
structlog.contextvars.bind_contextvars(
    correlation_id=correlation_id,
    operation="search_for_target_tracks"
)
```

### 7.3 Health Checks

**Orchestrator Health Check:**
```
GET /health

Response:
{
  "status": "healthy",
  "timestamp": "2025-11-15T14:30:22Z",
  "connections": {
    "database": "healthy",
    "redis": "healthy",
    "http_client": "healthy"
  },
  "circuit_breakers": {
    "mixesdb": {"state": "closed", "failure_count": 0},
    "1001tracklists": {"state": "closed", "failure_count": 0},
    ...
  }
}
```

**Unified Scraper Health Check:**
```
GET /health

Response:
{
  "status": "healthy",
  "service": "unified_scraper",
  "supported_sources": ["mixesdb", "1001tracklists", ...]
}
```

---

## 8. Configuration Files

### 8.1 Environment Variables

**Orchestrator Configuration:**
```bash
# Database (via secrets_manager)
DATABASE_URL=postgresql+asyncpg://user:pass@host:port/db

# Redis (via secrets_manager)
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=...

# External API Keys
SETLISTFM_API_KEY=...
SPOTIFY_CLIENT_ID=...
SPOTIFY_CLIENT_SECRET=...

# Search Configuration
SEARCH_TIMEOUT=30                    # Seconds per track search
SEARCH_MAX_CONCURRENT=5              # Max concurrent platform searches
SEARCH_RATE_LIMIT_MINUTES=60         # Min interval between searches

# Queue Configuration
QUEUE_CLEANUP_INTERVAL=86400         # Daily cleanup (seconds)
QUEUE_EXPIRED_THRESHOLD_DAYS=3       # Remove tasks older than 3 days
```

**Spider Configuration:**
```bash
# MixesDB Settings
MIXESDB_MAX_RESULTS_PER_SEARCH=5     # Max results per search query
MIXESDB_MAX_RESULTS_PER_CATEGORY=5   # Max results per category page
MIXESDB_MAX_RESULTS_PER_RECENT=5     # Max results from recent changes
MIXESDB_URL_BATCH_SIZE=50            # URLs processed per run
MIXESDB_ARTIST_BATCH_SIZE=20         # Artists searched per run
MIXESDB_URL_ROTATION=<date>          # Rotation seed (auto: date-based)
MIXESDB_ARTIST_ROTATION=<date>       # Rotation seed (auto: date-based)

# Rate Limiting
SCRAPER_STATE_PREFIX_MIXESDB=scraped:setlists:mixesdb
SCRAPER_SOURCE_TTL_DAYS=30           # Redis key TTL
SCRAPER_RUN_TTL_HOURS=24             # Prevent duplicate runs
SCRAPER_FORCE_RUN=0                  # Override quota (1=force)

# Download Settings (global)
DOWNLOAD_DELAY=2                     # Seconds between requests
RANDOMIZE_DOWNLOAD_DELAY=0.5         # Randomization factor
CONCURRENT_REQUESTS=8                # Max concurrent requests
DOWNLOAD_TIMEOUT=30                  # Request timeout

# Playwright (browser automation)
TRACKLISTS_1001_HEADLESS=True        # Headless browser
PLAYWRIGHT_BROWSER_TYPE=chromium
```

### 8.2 Docker Compose Configuration

**Unified Scraper Service:**
```yaml
services:
  unified-scraper:
    build: ./scrapers
    environment:
      DATABASE_URL: postgresql://user:pass@postgres:5432/musicdb
      REDIS_HOST: redis
      REDIS_PORT: 6379
      MIXESDB_MAX_RESULTS_PER_SEARCH: 5
      SCRAPER_RUN_TTL_HOURS: 24
    ports:
      - "8000:8000"
    depends_on:
      - postgres
      - redis
```

**Scraper Orchestrator Service:**
```yaml
services:
  scraper-orchestrator:
    build: ./services/scraper-orchestrator
    environment:
      DATABASE_URL: postgresql+asyncpg://user:pass@postgres:5432/musicdb
      REDIS_HOST: redis
      SETLISTFM_API_KEY: ${SETLISTFM_API_KEY}
      SPOTIFY_CLIENT_ID: ${SPOTIFY_CLIENT_ID}
      SPOTIFY_CLIENT_SECRET: ${SPOTIFY_CLIENT_SECRET}
    ports:
      - "8014:8014"
    depends_on:
      - postgres
      - redis
      - unified-scraper
```

---

## 9. Key Insights & Recommendations

### 9.1 Architecture Strengths

1. **Unified Scraper Design** - Consolidating 12 scrapers into 1 service reduces resource usage by ~92% (12 pods → 1 pod)

2. **Pipeline Separation of Concerns** - Clear boundaries between validation, enrichment, and persistence

3. **Circuit Breaker Protection** - Prevents cascade failures when external services are down

4. **2025 Best Practices** - Async/await, structured logging, correlation IDs, comprehensive monitoring

5. **Rate Limiting** - Intelligent randomization (50-70 min intervals) prevents overwhelming sources

### 9.2 Potential Issues

1. **Silent Failures** - Playlists with 0 tracks may not generate errors, only metrics
   - **Mitigation:** `silent_failures` counter tracks this, alerts should be configured

2. **Search Strategy Dependency** - 1001tracklists relies on artist page scraping
   - **Risk:** If artist slug format changes, entire search fails
   - **Mitigation:** Circuit breaker opens, fallback to other platforms

3. **Database Connection Pool Lifecycle** - Persistent thread manages pool
   - **Risk:** Thread death = connection pool lost
   - **Mitigation:** Health checks detect pool issues, restart pod

4. **Quota Enforcement** - Daily quota stored in Redis
   - **Risk:** Redis flush loses quota state
   - **Mitigation:** `SCRAPER_FORCE_RUN=1` override available

### 9.3 Configuration Recommendations

1. **Increase MixesDB Result Limits for High-Priority Tracks:**
   ```bash
   MIXESDB_MAX_RESULTS_PER_SEARCH=10  # Increase from 5 to 10
   ```

2. **Enable Force Rescrape for Urgent Tracks:**
   ```bash
   POST /search/start
   {
     "force_rescrape": true,
     "track_id": "uuid-of-urgent-track",
     "limit": 1
   }
   ```

3. **Monitor Circuit Breaker States:**
   ```promql
   circuit_breaker_state{state="open"} > 0
   ```

4. **Set Up Alerts for Silent Failures:**
   ```promql
   rate(silent_scraping_failures_total[5m]) > 0.1
   ```

---

## 10. File Path Reference

### Orchestration
- `/home/marku/Documents/programming/songnodes/services/scraper-orchestrator/main.py` - Enhanced orchestrator
- `/home/marku/Documents/programming/songnodes/services/scraper-orchestrator/target_track_searcher.py` - Multi-platform search
- `/home/marku/Documents/programming/songnodes/services/scraper-orchestrator/redis_queue_consumer.py` - Queue consumer

### Unified Scraper
- `/home/marku/Documents/programming/songnodes/scrapers/unified_scraper_api.py` - Consolidated scraper API
- `/home/marku/Documents/programming/songnodes/scrapers/settings.py` - Global Scrapy settings

### Spiders
- `/home/marku/Documents/programming/songnodes/scrapers/spiders/mixesdb_spider.py` - MixesDB implementation
- `/home/marku/Documents/programming/songnodes/scrapers/spiders/1001tracklists_spider.py` - 1001tracklists
- `/home/marku/Documents/programming/songnodes/scrapers/spiders/setlistfm_spider.py` - Setlist.fm

### Pipelines
- `/home/marku/Documents/programming/songnodes/scrapers/pipelines/validation_pipeline.py` - Priority 100
- `/home/marku/Documents/programming/songnodes/scrapers/pipelines/enrichment_pipeline.py` - Priority 200
- `/home/marku/Documents/programming/songnodes/scrapers/pipelines/api_enrichment_pipeline.py` - Priority 250
- `/home/marku/Documents/programming/songnodes/scrapers/pipelines/persistence_pipeline.py` - Priority 300

### Database
- `/home/marku/Documents/programming/songnodes/sql/init/01-schema.sql` - Schema definitions
  - Line 468: `target_track_searches` table
  - Line 19: `artists` table
  - Line 38: `tracks` table
  - Line 74: `track_artists` relationship

### Configuration
- `/home/marku/Documents/programming/songnodes/scrapers/scraper_service.py` - Legacy framework scraper
- `/home/marku/Documents/programming/songnodes/scrapers/items.py` - Scrapy item definitions

---

## Conclusion

The SongNodes scraping system implements a sophisticated **search → scrape → validate → enrich → persist** pipeline with:

- **Centralized orchestration** via scraper-orchestrator service
- **Unified scraper API** consolidating 12 sources into 1 service
- **Target-driven workflow** using `target_track_searches` table
- **Multi-platform search** across 1001tracklists, MixesDB, Setlist.fm, etc.
- **Resilient architecture** with circuit breakers, retry logic, graceful degradation
- **Comprehensive monitoring** via Prometheus metrics and structured logging
- **Rate limiting** to prevent overwhelming external sources (50-70 min intervals)

The system prioritizes **data quality** through validation pipelines and **operational resilience** through circuit breakers, making it suitable for production deployment at scale.
