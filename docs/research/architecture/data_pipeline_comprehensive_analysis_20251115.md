# SongNodes Data Collection Pipeline - Comprehensive Architecture Analysis

**Date:** 2025-11-15
**Analyst:** Claude (Codebase Research Analyst)
**Status:** Complete
**Version:** 1.0

---

## Executive Summary

This document provides a complete architectural analysis of the SongNodes data collection, transformation, and consumption pipeline. The system implements a **Medallion Architecture** (Bronze → Silver → Gold → Operational) with scraping orchestration, metadata enrichment, ETL processing, pathfinding algorithms, and frontend visualization.

**Key Finding:** The pipeline is a sophisticated, multi-stage data engineering system designed to:
1. **Discover** playlists/setlists containing target tracks
2. **Extract** track metadata and transitions from web sources
3. **Enrich** track data with musical attributes (BPM, key, genre, energy)
4. **Transform** raw data through quality gates (Bronze → Silver → Gold)
5. **Generate** graph edges representing track transitions
6. **Enable** intelligent DJ setlist pathfinding based on harmonic compatibility

---

## 1. Scraping Pipeline Architecture

### 1.1 Target Track Search System

**Purpose:** Find playlists/setlists containing target tracks (NOT individual tracks)

**Entry Point:**
`/home/marku/Documents/programming/songnodes/services/scraper-orchestrator/target_track_searcher.py`

**Database Table:**
`target_track_searches` - Defined in `/home/marku/Documents/programming/songnodes/sql/init/01-schema.sql`

**Table Schema:**
```sql
CREATE TABLE target_track_searches (
    search_id SERIAL PRIMARY KEY,
    target_title TEXT NOT NULL,
    target_artist TEXT,
    search_query TEXT,              -- Combined "Artist - Title" search term
    scraper_name TEXT,
    results_found INTEGER,
    playlists_containing INTEGER,
    search_timestamp TIMESTAMP DEFAULT NOW()
);
```

**Workflow:**
```
target_track_searches table → TargetTrackSearcher2025 → Multi-platform search → Playlist URLs
       ↓
   (search_query: "Deadmau5 Strobe")
       ↓
   Search platforms: 1001tracklists, MixesDB, Setlist.fm, LiveTrackList, ResidentAdvisor
       ↓
   Find: "2019-06-15 Deadmau5 @ Ultra" (contains target track)
       ↓
   Extract: Playlist URL
       ↓
   Queue for scraping
```

**Circuit Breaker Pattern:**
Lines 40-376 in `target_track_searcher.py`
- Each platform has dedicated circuit breaker (failure_threshold=2, recovery_timeout=30s)
- Platforms: `1001tracklists`, `mixesdb`, `setlistfm`, `youtube`, `soundcloud`, `mixcloud`, `reddit`, `internetarchive`, `livetracklist`, `residentadvisor`

**Search Strategy:**
- **1001tracklists:** Browse artist/DJ page → extract tracklist URLs (lines 598-673)
- **MixesDB:** Use MediaWiki `insource:"Artist - Track"` queries (lines 674-745)
- **Setlist.fm:** REST API search (lines 747-837)
- **Media platforms:** YouTube/SoundCloud/Mixcloud for tracklist descriptions (lines 877-930)

**Validation:** Lines 528-596 - Filter out non-tracklist URLs (search pages, navigation, social links)

### 1.2 Spider Inventory

**Total Spiders:** 20 specialized scrapers

**Location:** `/home/marku/Documents/programming/songnodes/scrapers/spiders/`

**Primary Spiders:**
1. **1001tracklists_spider.py** (72KB) - Electronic music DJ sets
2. **mixesdb_spider.py** (51KB) - MediaWiki-based tracklist database
3. **setlistfm_spider.py** - Rock/pop concert setlists
4. **generic_archive_spider.py** (26KB) - Internet Archive audio collections
5. **bbc_sounds_rave_forever_spider.py** (18KB) - BBC radio tracklists
6. **musicbrainz_spider.py** (18KB) - MusicBrainz metadata enrichment
7. **reddit_spider.py** / **reddit_monitor_spider.py** - Community-submitted tracklists
8. **jambase_spider.py** - Live concert data
9. **watchthedj_spider.py** - DJ performance tracking

**Store Spiders (Metadata Enrichment):**
- `stores/spotify_spider.py` - Spotify API integration
- `stores/discogs_spider.py` - Discogs music database
- `stores/beatport_spider.py` - Electronic music store

**Execution:**
```bash
# CORRECT (loads project context)
scrapy crawl mixesdb -a artist_name='Deadmau5' -a limit=1

# WRONG (breaks relative imports)
scrapy runspider spiders/mixesdb_spider.py -a artist_name='Artist'
```

### 1.3 Enrichment Delegation Architecture

**Service:** `metadata-enrichment` (microservice)
**Location:** `/home/marku/Documents/programming/songnodes/services/metadata-enrichment/`

**API Endpoint:**
```
POST http://metadata-enrichment:8020/enrich
{
  "track_id": "uuid",
  "artist_name": "Artist Name",
  "track_title": "Track Title",
  "existing_spotify_id": "optional",
  "existing_isrc": "optional"
}
```

**Response:**
```json
{
  "track_id": "uuid",
  "status": "completed|partial|failed",
  "sources_used": ["spotify", "musicbrainz"],
  "metadata_acquired": {
    "spotify_id": "...",
    "isrc": "...",
    "bpm": 128,
    "key": "A Minor"
  },
  "cached": false,
  "timestamp": "2025-10-10T..."
}
```

**Benefits:**
- **Single source of truth** for enrichment logic
- **Shared resilience:** Circuit breaker, caching, retries, DLQ
- **62% code reduction:** 1000 → 380 lines in scrapers
- **70% cost savings:** Cache hit rate: 40% → 70-80%

---

## 2. ETL Pipeline (Medallion Architecture)

### 2.1 Bronze Layer (Raw Scraped Data)

**Purpose:** Immutable landing zone for raw scraped data

**Schema Location:**
`/home/marku/Documents/programming/songnodes/sql/migrations/medallion/001_bronze_layer_up.sql`

**Tables:**
```sql
bronze_scraped_tracks (
    id UUID PRIMARY KEY,
    source_url TEXT,
    scraper_name TEXT,
    raw_data JSONB,             -- Complete raw scraping output
    scraped_at TIMESTAMP,
    -- Extracted fields
    artist_name TEXT,
    track_title TEXT,
    -- Lineage
    scrape_job_id UUID
)

bronze_scraped_playlists (
    id UUID PRIMARY KEY,
    source_url TEXT UNIQUE,
    raw_data JSONB,
    playlist_name TEXT,
    artist_name TEXT,
    event_date DATE,
    scraped_at TIMESTAMP
)

bronze_playlist_tracks (
    playlist_id UUID REFERENCES bronze_scraped_playlists(id),
    track_id UUID REFERENCES bronze_scraped_tracks(id),
    position INTEGER,
    PRIMARY KEY (playlist_id, track_id, position)
)
```

**Data Flow:**
```
Scrapy Spider → Item Pipeline → Validation → bronze_scraped_* tables
```

### 2.2 Silver Layer (Validated & Enriched Data)

**Purpose:** Clean, validated, deduplicated data with quality scoring

**Schema Location:**
`/home/marku/Documents/programming/songnodes/sql/migrations/medallion/002_silver_layer_up.sql`

**Key Tables:**

**silver_enriched_tracks:**
```sql
CREATE TABLE silver_enriched_tracks (
    id UUID PRIMARY KEY,
    bronze_id UUID REFERENCES bronze_scraped_tracks(id),

    -- Validated core fields
    artist_name TEXT NOT NULL,
    track_title TEXT NOT NULL,

    -- Enriched metadata
    spotify_id TEXT,
    isrc TEXT,
    bpm DECIMAL(6,2),
    key TEXT,                           -- Camelot notation
    genre TEXT[],
    energy DECIMAL(3,2),                -- 0.00-1.00
    valence DECIMAL(3,2),
    danceability DECIMAL(3,2),

    -- Data quality
    validation_status TEXT,             -- 'valid', 'warning', 'needs_review'
    data_quality_score DECIMAL(3,2),    -- 0.00-1.00
    enrichment_metadata JSONB,          -- Provider info, confidence scores

    -- Timestamps
    enriched_at TIMESTAMP,
    validated_at TIMESTAMP
);
```

**silver_enriched_playlists:**
```sql
CREATE TABLE silver_enriched_playlists (
    id UUID PRIMARY KEY,
    bronze_id UUID REFERENCES bronze_scraped_playlists(id),

    playlist_name TEXT NOT NULL,
    artist_id UUID REFERENCES silver_enriched_artists(id),
    artist_name TEXT NOT NULL,

    event_name TEXT,
    event_date DATE,
    event_location TEXT,

    track_count INTEGER,
    data_quality_score DECIMAL(3,2),
    validation_status TEXT
);
```

**silver_playlist_tracks (Junction Table):**
```sql
CREATE TABLE silver_playlist_tracks (
    playlist_id UUID REFERENCES silver_enriched_playlists(id),
    track_id UUID REFERENCES silver_enriched_tracks(id),
    position INTEGER NOT NULL,
    cue_time_ms BIGINT,                 -- When track starts in mix
    PRIMARY KEY (playlist_id, track_id, position)
);
```

**silver_track_transitions (CRITICAL for Graph):**
```sql
CREATE TABLE silver_track_transitions (
    id UUID PRIMARY KEY,
    from_track_id UUID REFERENCES silver_enriched_tracks(id),
    to_track_id UUID REFERENCES silver_enriched_tracks(id),
    occurrence_count INTEGER DEFAULT 1,
    playlists_containing UUID[],        -- Array of playlist IDs
    transition_metadata JSONB,
    created_at TIMESTAMP
);
```

**ETL Process (Bronze → Silver):**
`/home/marku/Documents/programming/songnodes/services/data-transformer/silver_playlists_to_gold_etl.py`

Lines 287-451: Transform workflow
1. Map DJ artist from silver to gold artists
2. Get tracks from `silver_playlist_tracks`
3. Map each track from silver to gold
4. Create playlist in `gold_playlist_analytics`
5. Link tracks via relationships

### 2.3 Gold Layer (Business Analytics)

**Purpose:** Denormalized, query-optimized tables for BI and graph generation

**Schema Location:**
`/home/marku/Documents/programming/songnodes/sql/migrations/medallion/003_gold_layer_up.sql`

**Key Tables:**

**gold_track_analytics:**
```sql
CREATE TABLE gold_track_analytics (
    id UUID PRIMARY KEY,
    silver_track_id UUID REFERENCES silver_enriched_tracks(id),

    -- Denormalized track data
    artist_name TEXT NOT NULL,
    track_title TEXT NOT NULL,
    full_track_name TEXT,               -- "Artist - Track Title"

    spotify_id TEXT,
    isrc TEXT,
    bpm DECIMAL(6,2),
    key TEXT,
    genre_primary TEXT,
    genres TEXT[],
    energy DECIMAL(3,2),

    -- Aggregated metrics
    play_count INTEGER DEFAULT 0,
    playlist_appearances INTEGER,       -- How many playlists contain this track
    last_played_at TIMESTAMP,

    -- Precomputed harmonic compatibility
    compatible_keys TEXT[],             -- Camelot wheel compatible keys
    key_family TEXT,                    -- Major/Minor

    data_quality_score DECIMAL(3,2),
    enrichment_completeness DECIMAL(3,2)
);
```

**gold_playlist_analytics:**
```sql
CREATE TABLE gold_playlist_analytics (
    id UUID PRIMARY KEY,
    silver_playlist_id UUID REFERENCES silver_enriched_playlists(id),

    playlist_name TEXT NOT NULL,
    artist_name TEXT NOT NULL,
    event_date DATE,

    -- Aggregated metrics
    track_count INTEGER,
    avg_bpm DECIMAL(6,2),
    avg_energy DECIMAL(3,2),

    -- Musical analysis
    key_changes INTEGER,                -- Number of key changes
    harmonic_flow_score DECIMAL(3,2),   -- 0-1: Camelot wheel flow quality
    energy_curve JSONB,                 -- Energy progression through playlist

    genre_distribution JSONB,           -- {genre: count}
    primary_genre TEXT,

    data_quality_score DECIMAL(3,2),
    track_identification_rate DECIMAL(3,2)
);
```

**Materialized Views:**

1. **gold_top_tracks_by_genre:** Leaderboards per genre (lines 217-235)
2. **gold_artist_collaboration_network:** Artist collaboration graph (lines 240-266)
3. **gold_harmonic_mixing_recommendations:** DJ mixing recommendations based on key/BPM/energy (lines 271-309)

**ETL Process (Silver → Gold):**
`/home/marku/Documents/programming/songnodes/services/data-transformer/silver_playlists_to_gold_etl.py`

Lines 453-544: Main ETL execution
- Processes un-transformed silver playlists
- Creates/updates gold playlist analytics
- Maps tracks and relationships

### 2.4 Operational Layer (Graph & API)

**Purpose:** OLTP tables optimized for real-time API queries and graph traversal

**ETL Service:**
`/home/marku/Documents/programming/songnodes/services/gold-to-operational-etl/gold_to_operational_etl.py`

**Critical Tables:**

**artists:**
```sql
CREATE TABLE artists (
    artist_id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    normalized_name TEXT UNIQUE,
    spotify_id TEXT,
    musicbrainz_id TEXT
);
```

**tracks:**
```sql
CREATE TABLE tracks (
    id UUID PRIMARY KEY,
    title TEXT NOT NULL,
    normalized_title TEXT UNIQUE,
    spotify_id TEXT,
    isrc TEXT,
    bpm DECIMAL(6,2),
    key TEXT,
    energy DECIMAL(3,2),
    danceability DECIMAL(3,2),
    valence DECIMAL(3,2),
    genre TEXT,
    metadata JSONB                      -- Contains gold_track_id, silver_track_id
);
```

**track_artists (Junction):**
```sql
CREATE TABLE track_artists (
    track_id UUID REFERENCES tracks(id),
    artist_id UUID REFERENCES artists(artist_id),
    role TEXT DEFAULT 'primary',
    PRIMARY KEY (track_id, artist_id, role)
);
```

**song_adjacency (GRAPH EDGES):**
```sql
CREATE TABLE song_adjacency (
    adjacency_id UUID PRIMARY KEY,
    song_id_1 UUID REFERENCES tracks(id),       -- Source track
    song_id_2 UUID REFERENCES tracks(id),       -- Target track
    source_track_id UUID,                       -- Same as song_id_1
    target_track_id UUID,                       -- Same as song_id_2
    occurrence_count INTEGER DEFAULT 1,
    weight FLOAT,                               -- Graph edge weight
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    UNIQUE(song_id_1, song_id_2)
);
```

**ETL Workflow (Gold → Operational):**
Lines 466-540 in `gold_to_operational_etl.py`

**Phase 1: Migrate Artists** (lines 151-224)
```python
INSERT INTO artists (name, normalized_name)
SELECT DISTINCT
    TRIM(artist_name), LOWER(TRIM(artist_name))
FROM gold_track_analytics
WHERE data_quality_score >= 0.5
  AND artist_name NOT IN ('Unknown', 'Various Artists', 'VA')
ON CONFLICT DO NOTHING
```

**Phase 2: Migrate Tracks** (lines 226-305)
```python
INSERT INTO tracks (title, normalized_title, spotify_id, bpm, key, ...)
SELECT DISTINCT
    TRIM(track_title), LOWER(TRIM(track_title)), spotify_id, bpm, key, ...
FROM gold_track_analytics
WHERE data_quality_score >= 0.5
  AND artist_name IS NOT NULL
```

**Phase 3: Track-Artist Relationships** (lines 307-348)
```python
INSERT INTO track_artists (track_id, artist_id, role)
SELECT t.id, a.id, 'primary'
FROM gold_track_analytics gta
JOIN tracks t ON LOWER(t.title) = LOWER(gta.track_title)
JOIN artists a ON LOWER(a.name) = LOWER(gta.artist_name)
WHERE gta.data_quality_score >= 0.5
```

**Phase 4: Song Adjacencies (Graph Edges)** (lines 350-464)
```python
INSERT INTO song_adjacency (song_id_1, song_id_2, occurrence_count, weight)
SELECT
    t1.id, t2.id, stt.occurrence_count, stt.occurrence_count::float
FROM silver_track_transitions stt
JOIN gold_track_analytics gta1 ON stt.from_track_id = gta1.silver_track_id
JOIN gold_track_analytics gta2 ON stt.to_track_id = gta2.silver_track_id
JOIN tracks t1 ON LOWER(t1.title) = LOWER(gta1.track_title)
JOIN tracks t2 ON LOWER(t2.title) = LOWER(gta2.track_title)
-- ✅ CRITICAL: Both endpoints MUST have valid artist attribution
JOIN track_artists ta1 ON t1.id = ta1.track_id
JOIN artists a1 ON ta1.artist_id = a1.id
JOIN track_artists ta2 ON t2.id = ta2.track_id
JOIN artists a2 ON ta2.artist_id = a2.id
WHERE gta1.data_quality_score >= 0.5
  AND gta2.data_quality_score >= 0.5
  AND a1.name IS NOT NULL AND a1.name != ''
  AND a2.name IS NOT NULL AND a2.name != ''
```

**Data Quality Gates:**
- Only tracks with `data_quality_score >= 0.5`
- Artist names must be valid (not "Unknown", "Various Artists", etc.) - Lines 65-149
- **BOTH endpoints** of graph edges must have valid artist attribution (CLAUDE.md requirement)

---

## 3. Database Schema Relationships

### 3.1 Track Data Flow

```
bronze_scraped_tracks (raw)
    ↓ (enrichment + validation)
silver_enriched_tracks (validated)
    ↓ (aggregation + analytics)
gold_track_analytics (denormalized)
    ↓ (quality filtering)
tracks (operational)
    ↓ (artist relationships)
track_artists → artists
```

### 3.2 Playlist Data Flow

```
bronze_scraped_playlists (raw)
    ↓
silver_enriched_playlists (validated)
    ↓
gold_playlist_analytics (analytics)
    ↓
playlists (operational, legacy table)
```

### 3.3 Graph Edge Generation

```
silver_playlist_tracks (track sequences)
    ↓ (calculate transitions)
silver_track_transitions (track A → track B occurrences)
    ↓ (map to gold tracks)
gold_track_analytics (with silver_track_id mapping)
    ↓ (map to operational tracks + validate artists)
song_adjacency (graph edges for API)
```

**Graph Generation Service:**
`/home/marku/Documents/programming/songnodes/services/data-transformer/setlist_graph_generator.py`

Lines 178-200: Extract track sequences from playlists
```python
SELECT pt.position, pt.song_id, t.title, t.normalized_title,
       (SELECT a.name FROM track_artists ta
        JOIN artists a ON ta.artist_id = a.artist_id
        WHERE ta.track_id = t.id LIMIT 1) as primary_artist
FROM playlist_tracks pt
JOIN tracks t ON pt.song_id = t.id
WHERE pt.playlist_id = %s
ORDER BY pt.position ASC
```

**Transition Calculation:**
For each consecutive pair `(track[i], track[i+1])` in a playlist:
- Create or update `silver_track_transitions` entry
- Increment `occurrence_count`
- Append playlist ID to `playlists_containing` array

---

## 4. Frontend Data Flow

### 4.1 Graph Visualization Component

**Main Component:**
`/home/marku/Documents/programming/songnodes/frontend/src/components/GraphVisualization.tsx`
(147KB - Large complex component)

**Supporting Components:**
- `GraphFilterPanel.tsx` - Filters by genre, BPM, energy, key
- `Graph3D.tsx` - 3D force-directed graph using PIXI.js
- `GraphMiniMap.tsx` - Overview navigation
- `GraphModeToggle.tsx` - 2D/3D mode switching

### 4.2 API Endpoints

**Graph Data API:**
Service: `graph-visualization-api` (port 8084)

**REST API:**
Service: `rest_api` (port 8082)

**Typical Data Flow:**
```
Frontend Component
    ↓ HTTP GET
Graph API: GET /api/graph/nodes?filters=...
    ↓ Query
song_adjacency + tracks + track_artists + artists (PostgreSQL)
    ↓ Response
GraphData { nodes: [...], edges: [...] }
    ↓ Render
PIXI.js Force-Directed Graph
```

**Graph Data Structure:**
```typescript
interface GraphData {
  nodes: GraphNode[];      // Tracks with metadata
  edges: GraphEdge[];      // Song adjacencies
}

interface GraphNode {
  id: string;
  name: string;           // Track title
  artist: string;
  bpm?: number;
  key?: string;
  camelotKey?: string;
  energy?: number;
  genre?: string;
  duration?: number;
}

interface GraphEdge {
  source: string;         // Track ID
  target: string;         // Track ID
  weight: number;         // Lower = stronger connection
}
```

### 4.3 Data Fetching Pattern

**Example from Graph API:**
```sql
-- Get tracks with valid artist attribution for graph nodes
SELECT
    t.id, t.title as name, a.name as artist,
    t.bpm, t.key, t.energy, t.genre, t.duration
FROM tracks t
JOIN track_artists ta ON t.id = ta.track_id
JOIN artists a ON ta.artist_id = a.artist_id
WHERE a.name IS NOT NULL
  AND a.name NOT IN ('Unknown', 'Unknown Artist', 'Various Artists')
  AND t.bpm IS NOT NULL
  AND t.key IS NOT NULL;

-- Get graph edges
SELECT
    sa.song_id_1 as source,
    sa.song_id_2 as target,
    sa.weight
FROM song_adjacency sa
WHERE sa.occurrence_count >= 1;
```

---

## 5. Pathfinding System

### 5.1 Backend Pathfinding (REST API)

**Router:**
`/home/marku/Documents/programming/songnodes/services/rest_api/routers/pathfinder.py`

**Utils:**
`/home/marku/Documents/programming/songnodes/services/rest_api/utils/pathfinder_utils.py`

**API Endpoint:**
```
POST /api/v1/pathfinder/find-path
```

**Request Model:**
```python
class PathfinderRequest(BaseModel):
    start_track_id: str                     # Required
    end_track_id: Optional[str]             # Optional
    target_duration_ms: int                 # 1 min to 4 hours
    waypoint_track_ids: List[str]           # Must-include tracks
    tracks: List[TrackNode]                 # Available tracks
    edges: List[GraphEdge]                  # Graph connections
    tolerance_ms: int = 300000              # ±5 minutes default
    prefer_key_matching: bool = True        # Camelot wheel
```

**Algorithm:** Modified A* Search (lines 269-414)

**Key Features:**

1. **Heuristic Function** (lines 137-158):
```python
def calculate_heuristic(
    current_duration: int,
    target_duration: int,
    remaining_waypoints: Set[str],
    avg_track_duration: int
) -> float:
    duration_remaining = max(0, target_duration - current_duration)
    min_waypoint_duration = len(remaining_waypoints) * avg_track_duration
    return max(duration_remaining, min_waypoint_duration) / avg_track_duration
```

2. **Edge Weight Calculation** (lines 373-383):
```python
# Base cost: edge weight (lower = stronger connection)
# - Key compatibility bonus (reduces cost)
# + BPM similarity penalty
# - Waypoint penalty (encourages visiting waypoints)

transition_cost = edge_weight - key_bonus + bpm_penalty
waypoint_penalty = -1.0 if neighbor_id in remaining_waypoints else 0
new_cost = current_cost + transition_cost + waypoint_penalty
```

3. **Camelot Wheel Harmonic Matching** (lines 20-46):
```python
CAMELOT_WHEEL = {
    '1A': {'compatible': ['12A', '2A', '1B'], ...},
    '2A': {'compatible': ['1A', '3A', '2B'], ...},
    # ... 24 keys total (12 major, 12 minor)
}

def is_key_compatible(from_key, to_key):
    return to_key in CAMELOT_WHEEL[from_key]['compatible']
```

4. **ANN (Approximate Nearest Neighbors) Fallback** (lines 163-233):
```python
def find_similar_tracks(tracks, n_neighbors=10):
    # Build Annoy index with 3 dimensions:
    # - Normalized BPM
    # - Camelot key X coordinate
    # - Camelot key Y coordinate

    # Returns synthetic edges for disconnected graph components
```

5. **Progressive Relaxation** (lines 504-545):
```python
tolerance_multipliers = [1.0, 1.5, 2.0, 3.0]
for multiplier in tolerance_multipliers:
    adjusted_tolerance = tolerance * multiplier
    path = find_path(...)
    if path:
        break

# Final fallback: Best-effort without strict waypoint requirement
if not path:
    path = find_path(waypoint_ids=set(), tolerance=tolerance * 3)
```

6. **Pivot Node Optimization** (utils/pathfinder_utils.py lines 11-53):
```python
def find_pivots(tracks, adjacency, start_id, end_id, waypoint_ids):
    # Calculate node degree (in + out edges)
    # Sort by degree descending
    # Select top N high-degree nodes as pivots
    # Always include: start, end, waypoints
    return pivots
```

**Response Model:**
```python
class PathfinderResponse(BaseModel):
    success: bool
    path: List[PathSegment]
    total_duration_ms: int
    target_duration_ms: int
    duration_difference_ms: int
    waypoints_visited: List[str]
    waypoints_missed: List[str]
    average_connection_strength: float
    key_compatibility_score: float          # 0-1
    message: str
```

### 5.2 Frontend Pathfinding

**Location:**
`/home/marku/Documents/programming/songnodes/frontend/src/utils/pathfinding.ts`

**Algorithm:** Dijkstra's with DJ-specific constraints (lines 210-492)

**Edge Weight Calculation** (lines 49-205):
```typescript
function calculateDJEdgeWeight(
    sourceTrack: Track,
    targetTrack: Track,
    baseWeight: number,
    constraints: PathConstraints
): PathEdgeWeight {
    // Components:
    // 1. Harmonic compatibility (Camelot wheel)
    // 2. BPM compatibility (preferred change, max change)
    // 3. Energy flow (ascending, descending, plateau, wave)
    // 4. Genre compatibility (transition matrix)
    // 5. Time compatibility (similar durations)

    const weightedScore =
        (harmonic * harmonicWeight) +
        (bpmCompatibility * bpmWeight) +
        (energyFlow * energyWeight) +
        (genreCompatibility * genreWeight) +
        (timeCompatibility * timeWeight);

    // Lower weight = better path
    totalWeight = baseWeight * (2.0 - normalizedScore);
}
```

**Constraints:**
```typescript
interface PathConstraints {
    harmonicCompatibility: {
        enabled: boolean;
        weight: number;
        strictMode: boolean;        // Penalize non-compatible keys 10x
    };
    bpmCompatibility: {
        enabled: boolean;
        weight: number;
        preferredChange: number;    // e.g., 3 BPM
        maxChange: number;          // e.g., 10 BPM
        allowAcceleration: boolean;
        allowDeceleration: boolean;
    };
    energyFlow: {
        enabled: boolean;
        weight: number;
        flowType: 'ascending' | 'descending' | 'plateau' | 'wave' | 'any';
        preferredEnergyJump: number;
        maxEnergyJump: number;
    };
    genreCompatibility: {
        enabled: boolean;
        weight: number;
        strictMode: boolean;
        genreTransitionMatrix?: Record<string, Record<string, number>>;
    };
    timing: {
        enabled: boolean;
        weight: number;
        minTrackDuration?: number;
        maxTrackDuration?: number;
    };
}
```

**Dijkstra Implementation:** Lines 293-365
```typescript
// Initialize distances
distances.set(startTrackId, 0);
queue.enqueue(startTrackId, 0);

while (!queue.isEmpty()) {
    currentId = queue.dequeue();
    visited.add(currentId);

    // Explore neighbors
    for (neighbor of adjacencyList[currentId]) {
        newDistance = currentDistance + neighbor.weight.totalWeight;

        if (newDistance < distances[neighborId]) {
            distances.set(neighborId, newDistance);
            previous.set(neighborId, currentId);
            queue.enqueue(neighborId, newDistance);
        }
    }

    if (currentId === endTrackId) break;  // Early termination
}

// Reconstruct path
while (currentId) {
    path.unshift(currentId);
    currentId = previous.get(currentId);
}
```

**Waypoint Validation:** Lines 514-591
```typescript
function validateWaypoints(
    graphData: GraphData,
    startTrackId: string,
    endTrackId: string,
    waypoints: string[]
) {
    // BFS reachability analysis
    // Check: start → waypoint AND waypoint → end
    // Calculate reachability score based on node degree
    // Suggest alternatives if unreachable
}
```

---

## 6. Data Pipeline Summary

### 6.1 Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        SCRAPING PIPELINE                            │
└─────────────────────────────────────────────────────────────────────┘
                                 │
    target_track_searches table  │  (search_query: "Artist - Title")
                ↓                │
    TargetTrackSearcher2025      │  Multi-platform search
                ↓                │
    Playlist URLs found          │  (1001tracklists, MixesDB, etc.)
                ↓                │
    Queue scraping tasks         │
                ↓                ↓
    ┌─────────────────────────────────────────────┐
    │  Scrapy Spiders (20 specialized)            │
    │  - 1001tracklists_spider.py                 │
    │  - mixesdb_spider.py                        │
    │  - setlistfm_spider.py                      │
    │  - stores/spotify_spider.py (enrichment)    │
    └─────────────────────────────────────────────┘
                ↓
    ┌─────────────────────────────────────────────┐
    │  Metadata Enrichment Service                │
    │  POST /enrich → Spotify/MusicBrainz API     │
    │  Returns: BPM, key, genre, energy, etc.     │
    └─────────────────────────────────────────────┘
                ↓

┌─────────────────────────────────────────────────────────────────────┐
│                     MEDALLION ARCHITECTURE (ETL)                    │
└─────────────────────────────────────────────────────────────────────┘

    ┌─────────────────────────────────┐
    │  BRONZE (Raw)                   │
    │  - bronze_scraped_tracks        │
    │  - bronze_scraped_playlists     │
    │  - bronze_playlist_tracks       │
    └─────────────────────────────────┘
                ↓ Validation + Enrichment
    ┌─────────────────────────────────┐
    │  SILVER (Validated)             │
    │  - silver_enriched_tracks       │
    │  - silver_enriched_playlists    │
    │  - silver_playlist_tracks       │
    │  - silver_track_transitions ⭐  │  (Track A → Track B occurrences)
    └─────────────────────────────────┘
                ↓ Aggregation + Analytics
    ┌─────────────────────────────────┐
    │  GOLD (Analytics)               │
    │  - gold_track_analytics         │
    │  - gold_playlist_analytics      │
    │  - Materialized Views:          │
    │    * top_tracks_by_genre        │
    │    * artist_collaboration       │
    │    * harmonic_recommendations   │
    └─────────────────────────────────┘
                ↓ Quality Filtering (score >= 0.5, valid artists)
    ┌─────────────────────────────────┐
    │  OPERATIONAL (OLTP)             │
    │  - artists                      │
    │  - tracks                       │
    │  - track_artists                │
    │  - song_adjacency ⭐            │  (Graph edges for API)
    └─────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                        FRONTEND & PATHFINDING                       │
└─────────────────────────────────────────────────────────────────────┘

    ┌─────────────────────────────────┐
    │  Graph API (Port 8084)          │
    │  GET /api/graph/nodes           │
    │  → Query song_adjacency         │
    └─────────────────────────────────┘
                ↓
    ┌─────────────────────────────────┐
    │  GraphVisualization.tsx         │
    │  PIXI.js Force-Directed Graph   │
    │  Nodes: Tracks                  │
    │  Edges: Adjacencies             │
    └─────────────────────────────────┘
                ↓
    ┌─────────────────────────────────┐
    │  Pathfinding API (Port 8082)    │
    │  POST /pathfinder/find-path     │
    │  - Modified A* Algorithm        │
    │  - Camelot Wheel Matching       │
    │  - ANN Fallback                 │
    │  - Duration Constraints         │
    │  - Waypoint Requirements        │
    └─────────────────────────────────┘
                ↓
    ┌─────────────────────────────────┐
    │  Generated DJ Setlist           │
    │  [Track1] → [Track2] → [Track3] │
    │  - Harmonic compatible          │
    │  - BPM smooth transitions       │
    │  - Energy flow controlled       │
    └─────────────────────────────────┘
```

### 6.2 File Location Reference

**Scraping:**
- Target search: `services/scraper-orchestrator/target_track_searcher.py`
- Spiders: `scrapers/spiders/*.py` (20 files)
- Enrichment: `services/metadata-enrichment/`

**Database Schemas:**
- Bronze: `sql/migrations/medallion/001_bronze_layer_up.sql`
- Silver: `sql/migrations/medallion/002_silver_layer_up.sql`
- Gold: `sql/migrations/medallion/003_gold_layer_up.sql`
- Target searches: `sql/init/01-schema.sql`

**ETL Services:**
- Silver → Gold: `services/data-transformer/silver_playlists_to_gold_etl.py`
- Gold → Operational: `services/gold-to-operational-etl/gold_to_operational_etl.py`
- Graph generation: `services/data-transformer/setlist_graph_generator.py`

**Pathfinding:**
- Backend router: `services/rest_api/routers/pathfinder.py`
- Backend utils: `services/rest_api/utils/pathfinder_utils.py`
- Frontend algorithm: `frontend/src/utils/pathfinding.ts`

**Frontend:**
- Main graph: `frontend/src/components/GraphVisualization.tsx`
- Filters: `frontend/src/components/GraphFilterPanel.tsx`
- 3D view: `frontend/src/components/Graph3D.tsx`

---

## 7. Critical Requirements & Data Quality

### 7.1 Artist Attribution (MANDATORY)

**Source:** CLAUDE.md lines 16-35

**Requirement:**
> Graph visualization REQUIRES valid artist attribution on BOTH endpoints of every track transition. NULL/empty/"Unknown Artist" tracks MUST NOT appear.

**Enforcement Stack:**

1. **Database View:** NULL for missing `track_artists`
2. **API:** Filter NULL/Unknown artists
3. **Frontend:** Validate non-empty artists
4. **ETL:** Only create edges for valid artists

**Invalid Artist Patterns:**
```python
INVALID_ARTIST_PATTERNS = {
    'unknown', 'unknown artist', 'unknown artist @',
    'various', 'various artists', 'va',
    '[unknown]', '(unknown)', 'n/a', 'tba', 'tbd'
}
```

**Implementation:** `gold_to_operational_etl.py` lines 383-391
```python
JOIN track_artists ta1 ON t1.id = ta1.track_id
JOIN artists a1 ON ta1.artist_id = a1.id
JOIN track_artists ta2 ON t2.id = ta2.track_id
JOIN artists a2 ON ta2.artist_id = a2.id
WHERE a1.name IS NOT NULL AND a1.name != ''
  AND LOWER(a1.name) NOT IN ('unknown', 'unknown artist', 'various artists', 'va')
  AND a2.name IS NOT NULL AND a2.name != ''
  AND LOWER(a2.name) NOT IN ('unknown', 'unknown artist', 'various artists', 'va')
```

### 7.2 Scraper Workflow (MANDATORY)

**Source:** CLAUDE.md lines 37-61

**Target:** Find setlists/playlists containing target tracks (NOT individual tracks/artists)

**Workflow:**
1. **Source:** Query `target_track_searches` table
2. **Search:** Use combined `search_query` (e.g., "Deadmau5 Strobe")
3. **Find:** Locate setlists containing the target track
4. **Scrape:** Extract ENTIRE setlist (metadata, all tracks, positions, transitions)
5. **Store:** Save playlist + track transition data

**Example:**
```
Search: "Deadmau5 Strobe"
    ↓
Find: "2019-06-15 Deadmau5 @ Ultra"
    ↓
Scrape: Full tracklist
    - Ghosts 'n' Stuff (pos 1)
    - Strobe (pos 2) ← TARGET TRACK
    - I Remember (pos 3)
    - Some Chords (pos 4)
    ↓
Create transitions:
    - Ghosts 'n' Stuff → Strobe
    - Strobe → I Remember
    - I Remember → Some Chords
```

---

## 8. Performance & Monitoring

### 8.1 Connection Pooling

**Database:** Lines 100-109 in `silver_playlists_to_gold_etl.py`
```python
pool = await asyncpg.create_pool(
    host=db_config['host'],
    port=db_config['port'],
    database=db_config['database'],
    user=db_config['user'],
    password=db_config['password'],
    min_size=5,
    max_size=20,
    command_timeout=60,
    server_settings={'search_path': 'musicdb,public'}
)
```

### 8.2 Circuit Breakers

**Scraper Circuit Breakers:** `target_track_searcher.py` lines 283-376
- Failure threshold: 2-3 failures
- Recovery timeout: 30-60 seconds
- Per-platform isolation (prevents cascade failures)

### 8.3 Caching

**Metadata Enrichment Cache:**
- Redis-backed caching in `metadata-enrichment` service
- Target cache hit rate: 70-80%
- Reduces API costs by 70%

### 8.4 Batch Processing

**ETL Batch Sizes:**
- Artists: 1000 per batch
- Tracks: 1000 per batch
- Adjacencies: 500 per batch (complex joins)

---

## 9. Key Insights & Recommendations

### 9.1 Strengths

1. **Robust Architecture:** Medallion pattern provides data lineage, quality gates, and replayability
2. **Comprehensive Enrichment:** Multi-source metadata aggregation (Spotify, MusicBrainz, Discogs)
3. **Sophisticated Pathfinding:** A* with Camelot wheel, BPM matching, energy flow, ANN fallback
4. **Data Quality Focus:** Quality scoring, validation gates, artist attribution enforcement
5. **Scalable Design:** Circuit breakers, connection pooling, batch processing, async/await

### 9.2 Potential Improvements

1. **Materialized View Refresh:** Automate `refresh_gold_materialized_views()` with pg_cron
2. **Incremental ETL:** Implement change data capture (CDC) for real-time updates
3. **Graph Index Optimization:** Add GIN/GIST indexes on `song_adjacency` for faster pathfinding
4. **Monitoring:** Add Prometheus metrics for:
   - Scraping success/failure rates
   - ETL throughput
   - Data quality score distributions
   - Pathfinding performance
5. **Deduplication:** Implement fuzzy matching for artist/track deduplication in silver layer

### 9.3 Critical Gaps (If Any)

**Graph Edge Density:**
- Monitor: `SELECT COUNT(*) FROM song_adjacency` vs expected edges
- If sparse: Review silver_track_transitions population
- If missing: Check artist attribution filtering (may be too strict)

**ETL Lag:**
- Monitor: Time delta between `bronze.created_at` and `gold.updated_at`
- Target: < 1 hour for real-time usability

---

## 10. Conclusion

The SongNodes data pipeline is a **production-grade, multi-stage data engineering system** implementing modern best practices:

- **Medallion Architecture** for data quality and lineage
- **Circuit breaker pattern** for resilience
- **Metadata enrichment** via microservice delegation
- **Graph-based pathfinding** with DJ-specific constraints
- **Camelot wheel harmonic matching** for professional-quality setlists

The pipeline successfully transforms unstructured web data (tracklists from 20+ sources) into a **queryable graph database** powering intelligent DJ setlist generation with harmonic compatibility, BPM matching, and energy flow optimization.

**Architecture Maturity:** Production-ready with comprehensive error handling, quality gates, and monitoring capabilities.

---

## Appendix A: Quick Reference Commands

**Scraping:**
```bash
# Correct spider execution (loads project context)
scrapy crawl mixesdb -a artist_name='Deadmau5' -a limit=1

# API-based scraping
curl -X POST http://localhost:8012/scrape \
  -d '{"artist_name":"Deadmau5","limit":1}'
```

**ETL Execution:**
```bash
# Silver → Gold ETL
python services/data-transformer/silver_playlists_to_gold_etl.py --limit 100

# Gold → Operational ETL
python services/gold-to-operational-etl/gold_to_operational_etl.py --full

# Dry run
python services/gold-to-operational-etl/gold_to_operational_etl.py --dry-run --limit 10
```

**Database Queries:**
```sql
-- Check pipeline health
SELECT COUNT(*) FROM bronze_scraped_tracks;
SELECT COUNT(*) FROM silver_enriched_tracks;
SELECT COUNT(*) FROM gold_track_analytics;
SELECT COUNT(*) FROM tracks;
SELECT COUNT(*) FROM song_adjacency;

-- Check data quality
SELECT validation_status, COUNT(*)
FROM silver_enriched_tracks
GROUP BY validation_status;

-- Check artist attribution
SELECT COUNT(*) FROM song_adjacency sa
JOIN track_artists ta1 ON sa.song_id_1 = ta1.track_id
JOIN track_artists ta2 ON sa.song_id_2 = ta2.track_id;
```

**Pathfinding API:**
```bash
curl -X POST http://localhost:8082/api/v1/pathfinder/find-path \
  -H "Content-Type: application/json" \
  -d '{
    "start_track_id": "uuid1",
    "end_track_id": "uuid2",
    "target_duration_ms": 3600000,
    "waypoint_track_ids": [],
    "tracks": [...],
    "edges": [...],
    "prefer_key_matching": true
  }'
```

---

**Document Version:** 1.0
**Last Updated:** 2025-11-15
**Next Review:** 2025-12-15
