# SongNodes: Developer Guide

## Application Purpose & Vision

**SongNodes** is a data-driven DJ setlist building tool that leverages real-world transition data from thousands of professional DJ mixes and playlists. Unlike algorithmic recommendations based solely on BPM or harmonic key matching, SongNodes captures and visualizes **proven track pairings** used by DJs in actual performances.

### Core Value Proposition

**Track transitions are the foundation of SongNodes.** Each transition represents:
- A validated pairing from a real DJ mix or curated playlist
- Implicit DJ mixing knowledge (harmonic compatibility, energy flow, BPM progression)
- Community consensus when multiple DJs use the same transition
- Real-world proof that two tracks work well together

**Example:** If 50 DJs have transitioned from "Deadmau5 - Strobe" to "Eric Prydz - Opus" in their sets, this represents a **high-confidence pairing** validated by the DJ community, not just algorithmic similarity.

### Why Transitions Matter

Traditional DJ software suggests tracks based on:
- BPM matching (±3 BPM range)
- Harmonic key compatibility (Camelot wheel)
- Genre classification
- Release year or energy level

**SongNodes goes further** by answering: "What do professional DJs actually play after this track?"

**Value Over Algorithms:**
- **Real Data vs. Theory:** BPM compatibility doesn't guarantee a good transition — DJs know which tracks flow well through experience
- **Proven Pairings:** Multiple occurrences of the same transition indicate a "classic" combination
- **Pattern Discovery:** Graph visualization reveals mixing patterns invisible in track lists
- **Contextual Knowledge:** Transitions capture momentum, crowd energy, and set progression

**Graph Visualization Benefits:**
- **Nodes (Tracks):** Size represents popularity (playlist appearances)
- **Edges (Transitions):** Thickness represents frequency (occurrence count)
- **Pathfinding:** Build setlists by following high-weight edges
- **Discovery:** Explore new tracks through graph traversal from known favorites

### Complete Data Pipeline (Medallion Architecture)

SongNodes implements a four-layer medallion architecture to transform raw scraped playlists into an interactive graph database:

```
┌─────────────┐      ┌─────────────┐      ┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│   Scraper   │─────▶│   Bronze    │─────▶│   Silver    │─────▶│    Gold     │─────▶│ Operational │─────▶ Frontend
│  (Unified)  │      │ (Raw Data)  │      │ (Validated) │      │ (Analytics) │      │  (Graph DB) │       (PIXI.js)
└─────────────┘      └─────────────┘      └─────────────┘      └─────────────┘      └─────────────┘
      │                     │                     │                     │                     │
      │                     │                     │                     │                     │
  Complete          Raw playlists        Track transitions      Aggregated             Nodes + Edges
  setlists          with positions       (sequential pairs)      analytics             (rendered graph)
  from DJs          preserved as          occurrence counts      quality scores        DJ sees proven
                    bronze_scraped_       in silver_track_       in gold_track_        track pairings
                    playlists +           transitions            analytics
                    bronze_scraped_
                    tracks
```

#### Bronze Layer: Raw Data Capture

**Purpose:** Preserve complete raw data from scraping sources for reproducibility and reprocessing

**Tables:**
- `bronze_scraped_playlists`: Playlist/setlist metadata (source, URL, event, artist, date, venue)
- `bronze_scraped_tracks`: Individual tracks with sequential positions (1, 2, 3, ...)

**Key Features:**
- Raw JSON preserved in `raw_metadata` JSONB column
- Track positions captured from list order (critical for transitions)
- Deduplication via `UNIQUE(source, source_url)`
- ALL source data retained, no filtering

**Example Bronze Data:**
```sql
-- bronze_scraped_playlists
id: uuid-1234
source: '1001tracklists'
source_url: 'https://1001tracklists.com/tracklist/...'
event_name: 'Carl Cox @ Space Ibiza 2024'
artist_name: 'Carl Cox'
event_date: '2024-08-15'

-- bronze_scraped_tracks (4 rows)
{playlist_id: uuid-1234, position: 1, artist: 'Adam Beyer', title: 'Your Mind', raw_metadata: {...}}
{playlist_id: uuid-1234, position: 2, artist: 'Amelie Lens', title: 'Contradictions', raw_metadata: {...}}
{playlist_id: uuid-1234, position: 3, artist: 'Charlotte de Witte', title: 'Selected', raw_metadata: {...}}
{playlist_id: uuid-1234, position: 4, artist: 'Reinier Zonneveld', title: 'Pattern Burst', raw_metadata: {...}}
```

#### Silver Layer: Validated & Enriched Data

**Purpose:** Create canonical tracks and transitions with metadata enrichment

**ETL Process (Bronze → Silver):**
1. Match bronze tracks to canonical silver tracks (deduplication via Spotify ID, ISRC, or fuzzy matching)
2. Enrich tracks with metadata (BPM, harmonic key, energy, Spotify ID, ISRC) via `metadata-enrichment` service
3. **Create transitions** from sequential track positions: `position N → position N+1`
4. Calculate transition quality metrics (BPM delta, key compatibility, energy progression)

**Tables:**
- `silver_enriched_tracks`: Canonical tracks with full metadata
- `silver_enriched_playlists`: Validated playlists
- `silver_track_transitions`: **CORE TABLE** — transition edges with occurrence tracking

**Transition Creation Example:**
```sql
-- Input: Bronze tracks at positions 1, 2, 3, 4
-- Output: Silver transitions (edges)

Transition 1: Adam Beyer - Your Mind → Amelie Lens - Contradictions
  source_track_id: canonical-track-123
  target_track_id: canonical-track-456
  occurrence_count: 1  (first time seeing this transition)
  playlist_occurrences: ['uuid-1234']
  transition_metadata: {
    bpm_delta: +2,  (128 BPM → 130 BPM)
    key_compatibility: 'perfect_match',  (A Minor → A Minor)
    energy_progression: +5%
  }

Transition 2: Amelie Lens - Contradictions → Charlotte de Witte - Selected
  source_track_id: canonical-track-456
  target_track_id: canonical-track-789
  occurrence_count: 1
  transition_metadata: {
    bpm_delta: +2,  (130 BPM → 132 BPM)
    key_compatibility: 'compatible',  (A Minor → D Minor, relative keys)
    energy_progression: +15%
  }

-- If 20 other DJs also use "Adam Beyer → Amelie Lens", occurrence_count becomes 21
-- This HIGH OCCURRENCE COUNT signals a proven, reliable transition
```

**Silver Layer Validation:**
- Artist attribution required (no NULL/Unknown artists in transitions)
- BPM and key data enriched via Spotify/MusicBrainz APIs
- Duplicate transitions merged (same source + target + playlist = single row)
- Position integrity verified (no gaps: 1→2→3, not 1→3→5)

#### Gold Layer: Analytics & Aggregations

**Purpose:** Pre-compute analytics for fast queries and reporting

**ETL Process (Silver → Gold):**
1. Aggregate track statistics (total playlist appearances, average BPM, genre distribution)
2. Calculate transition quality scores (weighted by occurrence count, BPM compatibility, key compatibility)
3. Compute artist analytics (track count, collaboration networks)
4. Generate confidence ratings for transitions (high occurrence = high confidence)

**Tables:**
- `gold_track_analytics`: Track-level metrics (popularity, average transition quality)
- `gold_transition_analytics`: Transition-level metrics (weighted quality scores, confidence ratings)
- `gold_artist_analytics`: Artist-level metrics (track count, genre distribution)

**Example Gold Analytics:**
```sql
-- gold_track_analytics
track_id: canonical-track-456  (Amelie Lens - Contradictions)
total_playlist_appearances: 127
average_bpm: 130.2
most_common_key: 'A Minor'
average_energy: 0.82
incoming_transitions_count: 89  (89 tracks transition TO this track)
outgoing_transitions_count: 103  (103 tracks transition FROM this track)
popularity_score: 0.91  (high popularity)

-- gold_transition_analytics
transition_id: transition-abc-123  (Adam Beyer → Amelie Lens)
occurrence_count: 21  (21 DJs used this transition)
confidence_rating: 0.87  (high confidence due to multiple occurrences)
average_bpm_delta: +2.1
key_compatibility_rate: 0.95  (95% of occurrences had compatible keys)
weighted_quality_score: 0.89  (high-quality transition)
```

**Quality Scoring Formula:**
```
weighted_quality_score = (
  occurrence_weight * 0.4 +  // More occurrences = higher weight
  bpm_compatibility * 0.2 +   // BPM delta < 3 = compatible
  key_compatibility * 0.2 +   // Harmonic key match
  energy_progression * 0.2    // Smooth energy transition
)
```

#### Operational Layer: Graph Database

**Purpose:** Optimized graph structure for fast traversal and visualization

**ETL Process (Gold → Operational):**
1. Create graph nodes from gold tracks (include all metadata)
2. Create graph edges from gold transitions (weight = occurrence count)
3. Pre-compute graph metrics (PageRank, centrality, clustering coefficients)
4. Index for fast neighbor queries and pathfinding

**Graph Structure:**
- **Nodes:** Tracks with attributes (artist, title, BPM, key, energy, popularity)
- **Edges:** Directed transitions with weights (occurrence_count)
- **Properties:** Edge weight = transition frequency (higher weight = more popular pairing)

**Example Graph Representation:**
```json
// Node (Track)
{
  "id": "canonical-track-456",
  "label": "Amelie Lens - Contradictions",
  "properties": {
    "artist": "Amelie Lens",
    "title": "Contradictions",
    "bpm": 130,
    "key": "A Minor",
    "energy": 0.82,
    "popularity": 0.91,
    "total_playlists": 127
  }
}

// Edge (Transition)
{
  "source": "canonical-track-123",  // Adam Beyer - Your Mind
  "target": "canonical-track-456",  // Amelie Lens - Contradictions
  "weight": 21,  // 21 occurrences = thick edge in visualization
  "properties": {
    "occurrence_count": 21,
    "confidence": 0.87,
    "quality_score": 0.89,
    "avg_bpm_delta": +2.1,
    "key_compatibility": "perfect_match"
  }
}
```

**Graph API Delivery:**
- REST endpoint: `GET /api/graph/nodes?artist=Amelie%20Lens`
- WebSocket: Real-time updates when new transitions are scraped
- Response includes nodes + edges for visualization
- Frontend renders with PIXI.js force-directed layout

#### Frontend: Interactive Visualization

**Purpose:** Render interactive graph for DJ setlist building

**PIXI.js Rendering:**
- Nodes sized by popularity (playlist appearances)
- Edges sized by weight (occurrence count)
- Force-directed layout (D3.js simulation)
- Interactive features: drag, zoom, click, multi-select

**User Workflow:**
1. Search for starting track (e.g., "Deadmau5 - Strobe")
2. View graph of connected tracks (tracks that transition TO/FROM Strobe)
3. Click edge to see transition details (occurrence count, quality score, BPM/key info)
4. Follow high-weight edges to discover proven pairings
5. Build setlist by adding tracks along graph paths

**Example User Flow:**
```
User clicks: "Deadmau5 - Strobe" node
  → Graph shows 50 outgoing edges (tracks DJs play AFTER Strobe)
  → Thickest edge: "Eric Prydz - Opus" (weight: 23 occurrences)
  → User clicks edge to see transition details:
      - 23 DJs used this transition
      - BPM: 124 → 126 (+2, compatible)
      - Key: A Minor → A Minor (perfect match)
      - Energy: 0.75 → 0.80 (+5%, smooth build)
      - Confidence: 0.92 (high)
  → User adds "Eric Prydz - Opus" to setlist
  → Graph updates to show edges FROM "Opus"
  → User continues building setlist by following proven transitions
```

### Transition Capture Detailed Example

**Input Playlist:** "Carl Cox @ Space Ibiza 2024"

**Scraped Tracklist:**
```
Position 1: Adam Beyer - Your Mind (128 BPM, A Minor)
Position 2: Amelie Lens - Contradictions (130 BPM, A Minor) ← harmonic match!
Position 3: Charlotte de Witte - Selected (132 BPM, D Minor) ← energy progression
Position 4: Reinier Zonneveld - Pattern Burst (135 BPM, D Minor)
```

**Bronze Layer Storage:**
- Full playlist metadata stored in `bronze_scraped_playlists`
- 4 track rows stored in `bronze_scraped_tracks` with positions 1-4
- Raw JSON from scraper preserved in `raw_metadata` for reprocessing

**Silver Layer Transition Creation:**
```
Transition 1: Adam Beyer - Your Mind → Amelie Lens - Contradictions
  - occurrence_count: 1 (first time seeing this)
  - bpm_delta: +2 (128→130, smooth acceleration)
  - key_compatibility: 'perfect' (A Minor → A Minor)
  - playlist_id: uuid-1234

Transition 2: Amelie Lens - Contradictions → Charlotte de Witte - Selected
  - occurrence_count: 1
  - bpm_delta: +2 (130→132, continuing acceleration)
  - key_compatibility: 'compatible' (A Minor → D Minor, relative keys)
  - energy_delta: +15% (building intensity)

Transition 3: Charlotte de Witte - Selected → Reinier Zonneveld - Pattern Burst
  - occurrence_count: 1
  - bpm_delta: +3 (132→135)
  - key_compatibility: 'perfect' (D Minor → D Minor)
```

**What Happens When More DJs Use Same Transitions:**

If 20 other DJs also use "Adam Beyer - Your Mind → Amelie Lens - Contradictions" in their sets:
- `occurrence_count` increases from 1 to 21
- `playlist_occurrences` array contains 21 playlist IDs
- Gold layer calculates `confidence_rating: 0.87` (high confidence)
- Operational layer creates thick edge with `weight: 21`
- Frontend renders thick line between nodes, signaling **proven high-quality transition**

**Graph Visualization Result:**
- User searching for "Adam Beyer - Your Mind" sees thick edge to "Amelie Lens - Contradictions"
- Hover tooltip shows: "21 DJs used this transition | BPM: +2 | Key: Perfect Match | Confidence: 87%"
- User knows this is a **validated pairing** used by professionals, not just algorithmic suggestion

### Why This Architecture Exists

**Separation of Concerns (Medallion Layers):**
- **Bronze:** Raw data preservation enables reprocessing when enrichment APIs improve
- **Silver:** Canonical tracks prevent duplicates (same track from multiple sources)
- **Gold:** Pre-computed analytics enable fast queries (no aggregation at query time)
- **Operational:** Graph-optimized structure for visualization and pathfinding

**Transitions as First-Class Citizens:**
- Dedicated `silver_track_transitions` table (not derived on-the-fly)
- Occurrence counting reveals community knowledge ("wisdom of the DJs")
- Quality metrics enable filtering low-confidence transitions
- Graph structure enables setlist pathfinding algorithms

**Real Data Beats Algorithms:**
- BPM matching alone doesn't guarantee good transitions (e.g., 128 BPM techno → 128 BPM house may clash)
- Harmonic key theory is useful but doesn't capture DJ intuition
- Real playlists include energy flow, crowd momentum, set narrative
- **21 DJs using the same transition** is stronger evidence than any algorithm

**Scalability Through Layers:**
- Bronze grows linearly with scrapes (append-only)
- Silver deduplicates and enriches (slower writes, optimized reads)
- Gold aggregates for dashboards (updated periodically, not real-time)
- Operational serves frontend (optimized for graph queries, indexed for speed)

**Data Quality Enforcement:**
- Artist attribution required at silver layer (no Unknown Artists in graph)
- Position integrity validated (no gaps in track sequences)
- Transition metrics calculated consistently (BPM delta, key compatibility)
- Confidence ratings filter noise (low occurrence = low confidence)

## Guiding Principles

- **Modularity:** Components are discrete, reusable units with single responsibilities
- **Resilience:** Adaptive anti-detection, robust error handling, comprehensive validation
- **Scalability:** Cloud-native architecture with distributed deployment support
- **Data Integrity:** Structured extraction, validation, and canonical enrichment workflow
- **GitOps-First:** All changes flow through Git → Flux → Kubernetes. Manual kubectl operations forbidden in production

---

## Critical Requirements

### Artist Attribution (MANDATORY)

Graph visualization **REQUIRES** valid artist attribution on **BOTH** endpoints of every track transition. NULL/empty/"Unknown Artist" tracks **MUST NOT** appear.

**Valid:** Non-empty strings excluding "Unknown", "Unknown Artist", "Various Artists", "VA", or similar patterns
**Stack Enforcement:** Database view (NULL for missing `track_artists`) → API (filter NULL/Unknown) → Frontend (validate non-empty) → ETL (create entries only for valid artists)

**Data Quality Strategy:**
1. Metadata enrichment via Spotify/MusicBrainz APIs
2. NLP pipeline enhancement
3. Manual curation tools (ArtistAttributionManager)

**DO NOT:** Relax filters, allow temporary Unknown Artists, create UI toggles, or modify API to accept NULL artists

### Scraper Workflow (MANDATORY)

**Target:** Find **setlists/playlists** containing target tracks (not individual tracks/artists)

**Core Objective:** Scrape complete playlists to capture **track transitions** — the sequential ordering of tracks that forms the foundation of the graph visualization. Each transition represents an edge in the graph, connecting tracks that were played consecutively by DJs/artists.

**Workflow Steps:**

1. **Source Identification:**
   - Query `target_track_searches` table for search targets
   - Table columns: `search_query`, `target_artist`, `target_title`
   - Example row: `search_query="Deadmau5 Strobe"`, `target_artist="Deadmau5"`, `target_title="Strobe"`

2. **Search Execution:**
   - Use **combined** `search_query` (e.g., "Deadmau5 Strobe") — NOT artist/title separately
   - Search across sources: MixesDB, 1001Tracklists, Beatport, etc.
   - Goal: Locate setlists/playlists **containing** the target track

3. **Setlist Discovery:**
   - Find playlists where target track appears in tracklist
   - Example: "2019-06-15 Deadmau5 @ Ultra Music Festival" contains "Strobe" at position 7

4. **Complete Setlist Extraction:**
   - Scrape **ENTIRE** playlist, not just target track
   - Extract ALL tracks with their sequential positions
   - Capture playlist metadata (date, venue, DJ/artist, event name, source URL)
   - Preserve track ordering (critical for transitions)

5. **Bronze Layer Persistence:**
   - Write raw scraped data to medallion architecture bronze layer
   - Tables:
     - `bronze_scraped_playlists`: Playlist metadata (source, date, artist, venue, URL)
     - `bronze_scraped_tracks`: Individual tracks with positions and raw metadata
   - Track fields: `position`, `artist_name`, `track_title`, `playlist_id`, `raw_metadata` (JSONB)
   - Preserve ALL raw data for downstream enrichment

6. **Transition Edge Creation:**
   - **Automatic:** ETL pipeline processes bronze data to create transitions
   - For each consecutive track pair in playlist:
     - Create transition edge: `track[N] → track[N+1]`
     - Store in `track_transitions` table with metadata
   - Transition metadata includes:
     - `source_track_id`: Previous track (edge source)
     - `target_track_id`: Next track (edge target)
     - `playlist_id`: Source playlist reference
     - `position_in_playlist`: Sequential position
     - `transition_metadata`: JSONB (BPM compatibility, key compatibility, energy flow)

**Example Workflow:**

```
Step 1-2: Search Query
  → search_query: "Deadmau5 Strobe"

Step 3: Setlist Discovery
  → Found: "2019-06-15 Deadmau5 @ Ultra Music Festival"
  → Tracklist preview shows "Strobe" at position 7

Step 4: Complete Extraction
  → Scrape FULL tracklist:
     Position 1: "Ghosts 'n' Stuff" - Deadmau5
     Position 2: "Strobe" - Deadmau5 ← TARGET TRACK
     Position 3: "I Remember" - Deadmau5 & Kaskade
     Position 4: "Some Chords" - Deadmau5
     Position 5: "Professional Griefers" - Deadmau5
     ...

Step 5: Bronze Persistence
  → bronze_scraped_playlists:
     playlist_id: uuid-1234
     source: "1001tracklists"
     event_name: "Ultra Music Festival 2019"
     artist: "Deadmau5"
     date: "2019-06-15"

  → bronze_scraped_tracks (5 rows):
     {playlist_id: uuid-1234, position: 1, artist: "Deadmau5", title: "Ghosts 'n' Stuff"}
     {playlist_id: uuid-1234, position: 2, artist: "Deadmau5", title: "Strobe"}
     {playlist_id: uuid-1234, position: 3, artist: "Deadmau5 & Kaskade", title: "I Remember"}
     {playlist_id: uuid-1234, position: 4, artist: "Deadmau5", title: "Some Chords"}
     {playlist_id: uuid-1234, position: 5, artist: "Deadmau5", title: "Professional Griefers"}

Step 6: Transition Edge Creation (ETL Automatic)
  → track_transitions table:
     Edge 1: Ghosts 'n' Stuff → Strobe (position 1→2, playlist uuid-1234)
     Edge 2: Strobe → I Remember (position 2→3, playlist uuid-1234)
     Edge 3: I Remember → Some Chords (position 3→4, playlist uuid-1234)
     Edge 4: Some Chords → Professional Griefers (position 4→5, playlist uuid-1234)
```

**Graph Visualization Impact:**
- Each transition becomes an **edge** in the graph
- Tracks with many transitions (e.g., "Strobe" appears in 50+ playlists) become **hub nodes**
- Edge weight increases with transition frequency (multiple DJs playing same sequence)
- Visualization reveals common track pairings, DJ mixing patterns, harmonic progressions

**Critical Requirements:**
- **Complete playlists only:** Partial tracklists invalidate transition data
- **Position preservation:** Track order is essential for edge directionality
- **All tracks captured:** Missing tracks create gaps in transition chains
- **Raw metadata storage:** Bronze layer preserves original data for auditing/reprocessing

### Unified Scraper Deployment (MANDATORY)

**Deployment:** `unified-scraper` is the ONLY scraper pod allowed in production and development

**Forbidden:** Individual scraper deployments (`scraper-1001tracklists`, `scraper-mixesdb`, `scraper-beatport`, etc.) are **strictly prohibited**

**Architecture:** All spider types (mixesdb, 1001tracklists, beatport, etc.) run through the unified-scraper API (`POST http://unified-scraper:8012/scrape`)

**Benefits:**
- Memory efficiency: Single 1GB pod vs. 12+ individual pods (12GB+)
- Centralized resilience: Shared proxy rotation, rate limiting, retry logic
- Simplified management: One deployment to monitor, update, and scale
- Unified configuration: Single source of truth for all scraping parameters

**DO NOT:** Create separate Kubernetes deployments for individual spiders (e.g., Helm chart entries for `scraper-mixesdb-deployment`)

---

## 1. Setup

### Prerequisites
- Kubernetes cluster (K3s recommended), kubectl, Flux CLI, Skaffold, Helm 3.x
- Optional: Local registry (K3s includes `localhost:5000`)

### Secrets Configuration
```bash
kubectl create namespace songnodes
kubectl create secret generic songnodes-secrets \
  --from-literal=POSTGRES_PASSWORD=your_password \
  --from-literal=REDIS_PASSWORD=your_password \
  --from-literal=RABBITMQ_PASSWORD=your_password \
  --from-literal=ANTHROPIC_API_KEY=your_key \
  --from-literal=SPOTIFY_CLIENT_ID=your_id \
  --from-literal=SPOTIFY_CLIENT_SECRET=your_secret \
  -n songnodes
```

### Deployment
```bash
# GitOps (automatic)
flux get kustomizations
flux reconcile source git songnodes
flux reconcile helmrelease songnodes -n flux-system

# Development (Skaffold)
skaffold dev  # Watch mode with hot-reload
skaffold run  # One-time deployment
```

### Verification
```bash
kubectl get pods -n songnodes
kubectl logs -f deployment/rest-api -n songnodes
kubectl exec -n songnodes postgres-0 -- psql -U musicdb_user -d musicdb -c "SELECT COUNT(*) FROM tracks;"
```

---

## 2. Architecture

### Services
| Service | Port | Description |
|---------|------|-------------|
| Frontend | 3006 | React/TypeScript SPA with PIXI.js graph visualization |
| REST API | 8082 | FastAPI backend for business logic and audio analysis |
| Graph API | 8084 | Graph data for visualization |
| WebSocket API | 8083 | Real-time updates via RabbitMQ |
| NLP Processor | 8086 | Tracklist extraction with Claude/Anthropic |
| Scrapers | N/A | Scrapy-based data acquisition (Section 5.1) |
| PostgreSQL | 5433 | Primary database with PostGIS and JSONB |
| Redis | 6380 | Cache, sessions, task queue broker |
| RabbitMQ | 5672/15672 | Async message bus |
| Prometheus | 9091 | Metrics collection |
| Grafana | 3001 | Monitoring dashboards |

### Technology Stack
- **Frontend:** React 18.3.1, TypeScript 5.5.4, PIXI.js v8.5.2, D3.js, Vite, Zustand 4.5.5
- **Backend:** Python 3.11+, FastAPI, SQLAlchemy 2.0, Pydantic v2
- **Scraping:** Scrapy 2.11+, scrapy-playwright
- **Infrastructure:** Kubernetes (production), Docker Compose (local dev only)

---

## 3. Development Workflow

### Branching Strategy
- **main:** Production-ready (direct commits forbidden)
- **develop:** Integration branch for all features/bugfixes
- **Feature branches:** `feature/[ticket-id]-[description]` (from `develop`)
- **Bugfix branches:** `bugfix/[ticket-id]-[description]` (from `develop`)

### Commit Convention
**Format:** `type(scope): description`
**Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

**Examples:**
```bash
git commit -m "feat(camelot-wheel): add harmonic compatibility visualization"
git commit -m "fix(graph): resolve PIXI.js memory leak in node cleanup"
```

### Pull Request Process
1. Create branch: `git checkout -b feature/SN-123-my-feature`
2. Develop with conventional commits
3. Run tests: `npm test`, `pytest`, **`npm run test:e2e` (MANDATORY)**
4. Push and create PR to `develop`
5. Pass CI checks, get code review
6. Merge using "Squash and Merge"

### GitOps Deployment (CRITICAL)

**Correct Workflow:**
```
Code Change → Git Commit → Push → Flux Reconcile → K8s Apply → Verify
```

**Forbidden Commands (bypass GitOps):**
```bash
❌ kubectl edit deployment/rest-api -n songnodes
❌ kubectl patch deployment/rest-api -n songnodes --patch '...'
❌ kubectl apply -f local-manifest.yaml -n songnodes
❌ kubectl set image deployment/rest-api rest-api=new-image:latest -n songnodes
```

**Emergency Only:** Document immediately, create follow-up PR to codify changes

### Image Pull Policy (CRITICAL)

**Helm Template Required:**
```yaml
imagePullPolicy: {{ if eq .Values.image.tag "latest" }}Always{{ else }}IfNotPresent{{ end }}
```

**Why:** Kubernetes caches `:latest` tags; `IfNotPresent` causes stale code. `Always` forces registry check on pod start.

### Redeployment After Code Changes

**Development (`:latest` tags):**
```bash
# 1. Commit changes
git add scrapers/spiders/mixesdb_spider.py
git commit -m "fix(scrapers): fix artist_name bug"

# 2. Build and push
docker build -t localhost:5000/songnodes_scrapers:latest scrapers/
docker push localhost:5000/songnodes_scrapers:latest

# 3. Force pods to pull fresh image
kubectl delete pods -n songnodes -l app=unified-scraper

# 4. Verify
kubectl get pods -n songnodes -l app=unified-scraper
kubectl logs -n songnodes -l app=unified-scraper --tail=50
```

**Why delete pods?** Flux doesn't detect `:latest` changes; `kubectl rollout restart` may use cached images. Deleting forces fresh pull with `imagePullPolicy: Always`.

**Production (versioned tags):**
```bash
# 1. Update Helm values: image.tag: "v1.2.3"
# 2. Commit and push
git add deploy/helm/songnodes/values.yaml
git commit -m "chore(helm): bump rest-api to v1.2.3"
git push origin main

# 3. Build versioned image
docker build -t localhost:5000/songnodes_rest-api:v1.2.3 services/rest_api
docker push localhost:5000/songnodes_rest-api:v1.2.3

# 4. Flux auto-deploys
flux reconcile source git songnodes
flux reconcile helmrelease songnodes -n flux-system
```

**Frontend Build Requirements:**
```bash
# ✅ CORRECT
cd frontend && npm run build  # Create fresh dist/
cd .. && docker build -t localhost:5000/songnodes-frontend:latest frontend/
docker push localhost:5000/songnodes-frontend:latest

# ❌ WRONG - Copies stale dist/
docker build -t localhost:5000/songnodes-frontend:latest frontend/
```

### File Management Rules
- **ALWAYS EDIT** existing files — never create new unless absolutely necessary
- **NO DUPLICATE CONFIGS** — Single source of truth in Helm charts
- **USE KUSTOMIZE OVERLAYS** — For environment-specific configurations

---

## 4. Testing Strategy

| Test Type | Command | When |
|-----------|---------|------|
| Frontend Unit | `npm test` | Frontend development |
| Backend Unit | `pytest` | Backend development |
| **E2E (MANDATORY)** | `npm run test:e2e` | **Before PR merge** |
| Graph | `npm run test:graph` | PIXI.js graph changes |
| PIXI.js | `npm run test:pixi` | PIXI.js component changes |
| Performance | `npm run test:performance` | Before production deploy |

### E2E Test Requirements
- **Zero console errors** before merge (JavaScript, React, TypeScript, reference errors)
- All components render correctly
- **DO NOT deploy** if tests fail or console errors present

### Test Execution (CRITICAL)
**Sequential execution required** to prevent resource conflicts:
```bash
npx playwright test --workers=1  # REQUIRED: Single worker
npx playwright test tests/e2e/design-system/button.spec.ts --workers=1
npx playwright test -g "should render all variants" --workers=1
```

**Why:** Prevents browser resource conflicts, ensures consistent results, avoids memory issues with PIXI.js/WebGL

---

## 5. Key Systems

### 5.1. Scraping Subsystem (Scrapy)

**Architecture:** Chained Item Pipeline
1. **Extraction (Spiders):** Raw data extraction with `ItemLoaders`
2. **Validation Pipeline:** Holistic checks (required fields, types)
3. **Enrichment Pipeline:** Delegates to `metadata-enrichment` microservice (Section 5.1.5)
4. **Persistence Pipeline:** Upsert to PostgreSQL bronze layer (prevent duplicates)

**Resilience Features:**
- Intelligent proxy rotation (health-aware pool)
- Dynamic header management (realistic browser headers)
- Adaptive rate limiting (responds to 429/503)
- FREE Ollama CAPTCHA solving (self-hosted AI vision)
- Retry logic with exponential backoff + jitter

**Dynamic Content:** `scrapy-playwright` for JavaScript-heavy sites

**Testing Spiders:**
```bash
# ✅ CORRECT - search_query combines artist + track (how spiders actually work)
scrapy crawl mixesdb -a search_query='Deadmau5 Strobe' -a limit=1
curl -X POST http://localhost:8012/scrape -H "Content-Type: application/json" \
  -d '{"source": "mixesdb", "search_query": "Deadmau5 Strobe", "limit": 1}'

# ✅ CORRECT - Direct URL for testing specific mix pages
curl -X POST http://localhost:8012/scrape -H "Content-Type: application/json" \
  -d '{"source": "mixesdb", "start_urls": "https://mixesdb.com/db/index.php/...", "limit": 1}'

# ❌ WRONG - Artist name only (doesn't match real search behavior)
curl -X POST http://localhost:8012/scrape -d '{"source": "mixesdb", "search_query": "Deadmau5"}'

# ❌ WRONG - Fails with relative imports
scrapy runspider spiders/mixesdb_spider.py -a artist_name='Artist'
```

**CRITICAL: search_query Format**
- **Correct:** `"search_query": "Artist Name Track Title"` (e.g., "Deadmau5 Strobe", "Carl Cox Space")
- **Purpose:** Scraper finds setlists/playlists CONTAINING the target track, then scrapes the ENTIRE playlist with all track positions
- **Why not just artist?** Searching for only "Deadmau5" returns too many results and doesn't target specific tracks for transition discovery
- **Result:** Complete setlist → bronze_scraped_playlists + bronze_scraped_tracks with positions → transitions created from sequential positions

**Why:** `scrapy crawl` loads spider through project structure, maintains package hierarchy, resolves relative imports. `runspider` executes file directly, breaks imports.

#### 5.1.1. Bronze Layer Data Model (CRITICAL)

**Purpose:** Raw scraped data persistence for medallion architecture (Bronze → Silver → Gold)

**Schema:**

```sql
-- Playlist/Setlist metadata
CREATE TABLE bronze_scraped_playlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source VARCHAR(100) NOT NULL,  -- 'mixesdb', '1001tracklists', 'beatport'
  source_url TEXT NOT NULL UNIQUE,  -- Original URL for deduplication
  playlist_external_id VARCHAR(255),  -- External ID from source
  event_name TEXT,
  artist_name VARCHAR(500),
  venue TEXT,
  event_date DATE,
  scraped_at TIMESTAMP DEFAULT NOW(),
  raw_metadata JSONB,  -- ALL source data preserved
  CONSTRAINT unique_source_playlist UNIQUE(source, source_url)
);

-- Individual tracks with positions (CRITICAL for transitions)
CREATE TABLE bronze_scraped_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id UUID NOT NULL REFERENCES bronze_scraped_playlists(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,  -- Sequential position in playlist (1-based)
  artist_name VARCHAR(500),
  track_title VARCHAR(500),
  track_duration INTERVAL,  -- If available from source
  raw_metadata JSONB,  -- Original track data from source
  scraped_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT unique_playlist_position UNIQUE(playlist_id, position),
  CONSTRAINT valid_position CHECK(position > 0)
);

CREATE INDEX idx_bronze_tracks_playlist ON bronze_scraped_tracks(playlist_id);
CREATE INDEX idx_bronze_tracks_position ON bronze_scraped_tracks(playlist_id, position);
CREATE INDEX idx_bronze_playlists_source ON bronze_scraped_playlists(source);
CREATE INDEX idx_bronze_playlists_artist ON bronze_scraped_playlists(artist_name);
```

**Pipeline Implementation:**

```python
# scrapers/pipelines/persistence_pipeline.py
class BronzePersistencePipeline:
    async def process_item(self, item, spider):
        # 1. Upsert playlist metadata
        playlist_id = await self.upsert_playlist({
            'source': spider.name,
            'source_url': item['playlist_url'],
            'event_name': item.get('event_name'),
            'artist_name': item.get('artist_name'),
            'event_date': item.get('event_date'),
            'raw_metadata': item.get('raw_playlist_metadata')
        })

        # 2. Insert tracks with positions (CRITICAL: preserve order)
        for position, track in enumerate(item['tracks'], start=1):
            await self.insert_track({
                'playlist_id': playlist_id,
                'position': position,  # Sequential position for transitions
                'artist_name': track.get('artist'),
                'track_title': track.get('title'),
                'track_duration': track.get('duration'),
                'raw_metadata': track  # Preserve ALL source data
            })

        return item
```

#### 5.1.2. Transition Extraction (ETL Bronze → Silver)

**ETL Process:** Automated pipeline processes bronze layer to create silver layer transitions

```sql
-- Silver layer: Canonical transitions (graph edges)
INSERT INTO silver_track_transitions (
  source_track_id,
  target_track_id,
  playlist_id,
  position_in_playlist,
  transition_metadata
)
SELECT
  t1.canonical_track_id AS source_track_id,  -- Previous track
  t2.canonical_track_id AS target_track_id,  -- Next track
  t1.playlist_id,
  t1.position AS position_in_playlist,
  jsonb_build_object(
    'source_artist', t1.artist_name,
    'target_artist', t2.artist_name,
    'source_title', t1.track_title,
    'target_title', t2.track_title,
    'bronze_source_id', p.source
  ) AS transition_metadata
FROM bronze_scraped_tracks t1
JOIN bronze_scraped_tracks t2 ON t1.playlist_id = t2.playlist_id
  AND t2.position = t1.position + 1  -- Next track in sequence
JOIN bronze_scraped_playlists p ON t1.playlist_id = p.id
WHERE t1.canonical_track_id IS NOT NULL
  AND t2.canonical_track_id IS NOT NULL
ON CONFLICT (source_track_id, target_track_id, playlist_id) DO NOTHING;
```

**Key Requirements:**
- **Position integrity:** Tracks MUST have sequential positions (no gaps)
- **Canonical matching:** Bronze tracks matched to silver canonical tracks via enrichment
- **Deduplication:** Same transition from same playlist = single edge (composite unique constraint)
- **Metadata preservation:** Raw source data retained in bronze for auditing/reprocessing

**Spider Output Contract:**

```python
# scrapers/items.py
class PlaylistItem(scrapy.Item):
    playlist_url = scrapy.Field()  # REQUIRED: Source URL for deduplication
    event_name = scrapy.Field()
    artist_name = scrapy.Field()
    event_date = scrapy.Field()
    tracks = scrapy.Field()  # REQUIRED: List of TrackItems with positions preserved
    raw_playlist_metadata = scrapy.Field()

class TrackItem(scrapy.Item):
    # Position is implicit from list order (enumerate in pipeline)
    artist = scrapy.Field()  # REQUIRED
    title = scrapy.Field()   # REQUIRED
    duration = scrapy.Field()
    # DO NOT add position field — pipeline assigns from list index
```

**Transition Quality Metrics:**
- Tracks per playlist (target: 10-50 tracks)
- Position coverage (no gaps in sequence)
- Canonical match rate (% bronze tracks matched to silver)
- Edge creation rate (% bronze tracks → silver transitions)

#### 5.1.3. Unified Scraper API Usage

**Endpoint:** `POST http://unified-scraper:8012/scrape`

**Purpose:** Single API gateway for ALL spider types (replaces individual scraper deployments)

**Request Format:**

```json
{
  "spider_name": "mixesdb",  // 'mixesdb', '1001tracklists', 'beatport'
  "search_params": {
    "search_query": "Deadmau5 Strobe",  // Combined search query (REQUIRED)
    "target_artist": "Deadmau5",        // For tracking purposes
    "target_title": "Strobe",           // For tracking purposes
    "limit": 10                         // Max playlists to scrape
  },
  "scrape_options": {
    "enable_enrichment": true,  // Delegate to metadata-enrichment service
    "max_retries": 3,
    "timeout": 300
  }
}
```

**Response Format:**

```json
{
  "status": "completed",
  "spider_name": "mixesdb",
  "playlists_scraped": 5,
  "tracks_extracted": 247,
  "transitions_created": 235,
  "errors": [],
  "bronze_playlist_ids": [
    "uuid-1234",
    "uuid-5678"
  ],
  "execution_time_seconds": 45.2
}
```

**Usage Examples:**

```bash
# Search for playlists containing "Strobe" by Deadmau5
curl -X POST http://unified-scraper:8012/scrape \
  -H "Content-Type: application/json" \
  -d '{
    "spider_name": "mixesdb",
    "search_params": {
      "search_query": "Deadmau5 Strobe",
      "target_artist": "Deadmau5",
      "target_title": "Strobe",
      "limit": 5
    }
  }'

# Search 1001Tracklists for Armin van Buuren sets
curl -X POST http://unified-scraper:8012/scrape \
  -H "Content-Type: application/json" \
  -d '{
    "spider_name": "1001tracklists",
    "search_params": {
      "search_query": "Armin van Buuren Shivers",
      "target_artist": "Armin van Buuren",
      "target_title": "Shivers",
      "limit": 10
    }
  }'

# From Python code
import httpx

async def scrape_playlists(search_query: str, target_artist: str, target_title: str):
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "http://unified-scraper:8012/scrape",
            json={
                "spider_name": "mixesdb",
                "search_params": {
                    "search_query": search_query,
                    "target_artist": target_artist,
                    "target_title": target_title,
                    "limit": 10
                }
            },
            timeout=600.0  # 10 minutes for large scrapes
        )
        return response.json()
```

**Benefits vs. Individual Deployments:**

| Individual Scrapers | Unified Scraper |
|---------------------|-----------------|
| 12+ separate pods (12GB+ memory) | Single pod (1GB memory) |
| Duplicate proxy pools per spider | Shared proxy rotation |
| 12+ separate configurations | Single source of truth |
| Inconsistent retry logic | Centralized resilience |
| Hard to monitor/debug | Single log stream |
| Resource contention | Efficient resource sharing |

**Monitoring:**

```bash
# Health check
curl http://unified-scraper:8012/health

# Spider statistics
curl http://unified-scraper:8012/stats

# Active scrape jobs
curl http://unified-scraper:8012/jobs

# View logs
kubectl logs -f deployment/unified-scraper -n songnodes
```

### 5.1.5. Enrichment Delegation Architecture

**Pattern:** Thin client delegates ALL enrichment to `metadata-enrichment` microservice

**Benefits:**
- Single source of truth for enrichment logic
- Shared resilience (circuit breaker, caching, retries, DLQ)
- 62% code reduction (1000 → 380 lines)
- 70% cost savings (cache hit: 40% → 70-80%)
- Centralized API key management

**API Contract:**
```json
POST http://metadata-enrichment:8020/enrich
{
  "track_id": "uuid",
  "artist_name": "Artist Name",
  "track_title": "Track Title",
  "existing_spotify_id": "optional",
  "existing_isrc": "optional"
}

Response:
{
  "track_id": "uuid",
  "status": "completed|partial|failed",
  "sources_used": ["spotify", "musicbrainz"],
  "metadata_acquired": {"spotify_id": "...", "isrc": "...", "bpm": 128, "key": "A Minor"},
  "cached": false,
  "timestamp": "2025-10-10T..."
}
```

**Configuration:**
```yaml
# docker-compose.yml
scraper-mixesdb:
  environment:
    METADATA_ENRICHMENT_URL: http://metadata-enrichment:8020
  depends_on:
    - metadata-enrichment
```

**Monitoring:** `curl http://localhost:8022/stats` (cache hit rate >70% target)

### 5.2. Secrets Management

**Single Source of Truth:** `.env` file for local dev, Kubernetes secrets for production

**Correct Pattern:**
```python
from common.secrets_manager import get_database_url, validate_secrets

if not validate_secrets(['POSTGRES_PASSWORD', 'REDIS_PASSWORD']):
    sys.exit(1)

db_url = get_database_url(async_driver=True, use_connection_pool=True)
```

**Incorrect Patterns:**
```python
❌ password = "musicdb_pass"  # Hardcoded
❌ password = os.getenv('POSTGRES_PASSWORD', 'wrong_default')  # Wrong default
❌ password = os.environ['POSTGRES_PASSWORD']  # No fallback
```

**Priority Order:** Docker Secrets → Environment Variables → Default Values (non-sensitive only)

### 5.3. Resource & Memory Management

**Connection Pooling (REQUIRED):**
```python
# Database
engine = create_async_engine(
    db_url,
    pool_size=5, max_overflow=10, pool_timeout=30,
    pool_recycle=3600, pool_pre_ping=True
)

# Redis
pool = redis.ConnectionPool(
    host='redis', port=6379, max_connections=50,
    health_check_interval=30, socket_keepalive=True, socket_timeout=5
)
```

**Container Resource Limits:**
```yaml
deploy:
  resources:
    limits: {memory: 512M, cpus: '1.0'}
    reservations: {memory: 256M, cpus: '0.5'}
```

**Allocation Guidelines:** Databases (1-2GB), APIs (512MB), Scrapers (1GB), Frontend (256MB), AI/Ollama (8GB)

**Frontend Cleanup (PIXI.js):**
```tsx
useEffect(() => {
  const app = new PIXI.Application({ ... });
  const ticker = new PIXI.Ticker();

  return () => {
    ticker.destroy();
    app.stage.removeChildren();
    app.stage.destroy({ children: true, texture: true, baseTexture: true });
    app.renderer.destroy(true);
    app.destroy(true);
  };
}, []);
```

**Monitoring:** Prometheus scrapes `db_pool_connections`, `redis_memory_usage`, `websocket_connections`, `process_memory`. Grafana alerts for >85% memory or >80% pool exhaustion.

### 5.4. Graph Node Interactions (PIXI.js v8.5.2 + D3.js)

**Event Handling:** Use `pointerdown`/`pointerup` (NOT `click` — unreliable during animations). Differentiate clicks from drags:
```tsx
sprite.on('pointerdown', (event) => { dragStart = event.global.clone(); });
sprite.on('pointerup', (event) => {
  if (dragStart && Math.hypot(event.global.x - dragStart.x, event.global.y - dragStart.y) < 5) {
    handleNodeClick(node);  // Click, not drag
  }
  dragStart = null;
});
```

**Multi-Select:** Ctrl+click (toggle), Shift+click (range), regular click (single-select)

**Keyboard Shortcuts:** D (debug), H (help), Space (pause), Escape (clear selection), Ctrl+A (select all)

**Best Practices:** Debounce clicks (150ms), visual feedback, extended hit areas (+10px), proper cleanup in useEffect

---

## 6. Deployment Architecture

### 6.1. GitOps with Flux
```bash
flux get all -n flux-system
kubectl get helmrelease songnodes -n flux-system
flux reconcile source git songnodes && flux reconcile helmrelease songnodes -n flux-system
```

### 6.2. Skaffold Development
```bash
skaffold dev  # Hot-reload
skaffold run  # One-time
skaffold run -p production  # Specific profile
```

### 6.3. Production Features
- **Infrastructure:** StatefulSets (PostgreSQL, Redis, RabbitMQ), HorizontalPodAutoscalers, NetworkPolicies, resource limits
- **Data Persistence:** PostgreSQL (20Gi, 15,137 tracks), Redis (5Gi), RabbitMQ (10Gi)
- **High Availability:** 3 frontend replicas, health checks, auto-restart, rolling updates
- **Monitoring:** Prometheus metrics, Grafana dashboards, resource tracking

---

## 7. Troubleshooting

| Issue | Solution |
|-------|----------|
| Service connection errors | `kubectl get pods -n songnodes` |
| Import errors | Verify images built/pushed to `localhost:5000` |
| Frontend can't reach API | `kubectl port-forward svc/rest-api 8082:8082 -n songnodes` |
| Pod crashes | `kubectl logs -f <pod-name> -n songnodes` |
| Memory leaks | Check useEffect cleanup, verify connection pool limits |
| ImagePullBackOff | Verify local registry running, images pushed |
| Spider ImportError | Use `scrapy crawl [spider_name]` NOT `runspider` |
| Flux sync issues | `flux reconcile source git songnodes` |
| Stale code | Check imagePullPolicy (`Always` for `:latest`) |

### Orphaned Pod Detection (CRITICAL)
```bash
kubectl get pods -n songnodes -l app=rest-api  # Check for multiple hash suffixes

# Resolution
kubectl delete pod rest-api-<old-hash>-<id> -n songnodes
kubectl get pods -n songnodes -l app=rest-api  # Verify only current-gen pods
```

**Symptoms:** Multiple pods with different hashes, old pod running, new pod crashing

**Prevention:** Use `kubectl rollout restart`, monitor for multiple hash generations

### Stale Code Detection (CRITICAL)
```bash
kubectl get pods -n songnodes -o wide  # Check pod age
git log -1 --format="%ai" -- services/rest_api/  # Check last code change

# If pod age > code modification, pods are stale
kubectl get deployment/rest-api -n songnodes -o jsonpath='{.spec.template.spec.containers[0].imagePullPolicy}'  # Must be "Always"

# Force fresh image
kubectl rollout restart deployment/rest-api -n songnodes
kubectl rollout status deployment/rest-api -n songnodes
```

**Causes:** `imagePullPolicy: IfNotPresent` (wrong for `:latest`), Kubernetes cached old image, image not pushed

### Database Backup/Restore
```bash
kubectl exec -n songnodes postgres-0 -- pg_dump -U musicdb_user -Fc musicdb > backup-$(date +%Y%m%d).dump
cat backup.dump | kubectl exec -i -n songnodes postgres-0 -- pg_restore -U musicdb_user -d musicdb --clean
kubectl exec -n songnodes postgres-0 -- psql -U musicdb_user -d musicdb -c "SELECT COUNT(*) FROM tracks;"
```

---

## 8. Anti-Patterns to Avoid

### General Anti-Patterns
❌ Unbounded collections (use pagination/limits)
❌ Missing timeouts (all network calls need timeouts)
❌ No connection limits (use connection pools with max sizes)
❌ Event listener leaks (clean up in useEffect return)
❌ Hardcoded credentials (use Kubernetes secrets)
❌ Manual deployments (use Flux GitOps)
❌ kubectl edit/patch in production (bypasses GitOps, creates drift)
❌ imagePullPolicy: IfNotPresent for :latest (causes stale code)
❌ Skipping tests (E2E mandatory before merge)
❌ Force pushes to main (protected branch)
❌ Unclear commit messages (use Conventional Commits)
❌ Docker Compose for production (Kubernetes-only)
❌ Ignoring orphaned pods (check for multiple hash generations)
❌ Building frontend without `npm run build` (stale dist/)

### Scraper Anti-Patterns (CRITICAL)
❌ **Individual scraper deployments** (use unified-scraper only)
❌ **Partial tracklists** (scrape ENTIRE playlist or discard)
❌ **Searching for individual tracks** (search for playlists containing tracks)
❌ **Ignoring track positions** (positions are critical for edge creation)
❌ **Missing position gaps** (validate sequential positions: 1, 2, 3... no jumps)
❌ **Position in spider output** (pipeline assigns positions from list order)
❌ **Skipping bronze layer** (all raw data MUST persist to bronze first)
❌ **Direct silver writes** (bronze → ETL → silver, never bypass bronze)
❌ **Using `runspider`** (use `scrapy crawl [spider_name]` for correct imports)
❌ **Hardcoded metadata enrichment** (delegate to metadata-enrichment service)
❌ **Scraping artists instead of playlists** (artists don't provide transition data)
❌ **Single-track playlists** (require 2+ tracks to create transitions)
❌ **Null/Unknown artists in bronze** (preserve raw data, filter in silver layer)
❌ **Duplicate playlist URLs** (enforce UNIQUE constraint on source_url)

---

## 9. Quick Reference

| Task | Command |
|------|---------|
| Check System Status | `kubectl get pods -n songnodes` |
| Deploy with Skaffold | `skaffold dev` / `skaffold run` |
| View Logs | `kubectl logs -f deployment/[service] -n songnodes` |
| Run Tests | `npm run test:e2e` |
| **Trigger Scrape (Unified)** | `curl -X POST http://unified-scraper:8012/scrape -d '{"spider_name":"mixesdb","search_params":{"search_query":"Deadmau5 Strobe","limit":5}}'` |
| Test Spider (Direct) | `kubectl exec -n songnodes deployment/unified-scraper -- scrapy crawl [spider_name] -a search_query="Artist Track" -a limit=1` |
| View Scraper Logs | `kubectl logs -f deployment/unified-scraper -n songnodes` |
| Check Bronze Data | `kubectl exec -n songnodes postgres-0 -- psql -U musicdb_user -d musicdb -c "SELECT COUNT(*) FROM bronze_scraped_playlists;"` |
| Check Transitions | `kubectl exec -n songnodes postgres-0 -- psql -U musicdb_user -d musicdb -c "SELECT COUNT(*) FROM track_transitions;"` |
| Frontend Dev | `cd frontend && npm run dev` |
| Frontend Build | `cd frontend && npm run build` |
| Flux Status | `flux get helmreleases -n flux-system` |
| Force Flux Sync | `flux reconcile source git songnodes && flux reconcile helmrelease songnodes -n flux-system` |
| Database Backup | `kubectl exec -n songnodes postgres-0 -- pg_dump -U musicdb_user -Fc musicdb > backup.dump` |
| Port Forward | `kubectl port-forward svc/rest-api 8082:8082 -n songnodes` |
| Restart Deployment | `kubectl rollout restart deployment/[service] -n songnodes` |
| Check Orphaned Pods | `kubectl get pods -n songnodes -l app=[service-name]` |
| Verify ImagePullPolicy | `kubectl get deployment/[service] -n songnodes -o jsonpath='{.spec.template.spec.containers[0].imagePullPolicy}'` |

---

## 10. System Startup

**K3s Auto-Start:** Systemd-enabled (`systemctl is-enabled k3s`), starts on boot, restores all pods

**Data Persistence:** PostgreSQL (20Gi, 15,137 tracks), Redis (5Gi), RabbitMQ (10Gi)

**Post-Reboot Verification:**
```bash
systemctl status k3s
kubectl get pods -n songnodes
kubectl exec -n songnodes postgres-0 -- psql -U musicdb_user -d musicdb -c "SELECT COUNT(*) FROM tracks;"
kubectl get pods -n songnodes -o wide && git log -1 --format="%ai"  # Check for stale pods
```

---

**This is the only supported way to develop and deploy SongNodes.** The project has been fully migrated from Docker Compose to Kubernetes and is managed entirely through Flux GitOps.
