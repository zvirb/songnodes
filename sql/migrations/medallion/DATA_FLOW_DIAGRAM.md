# Medallion Architecture: Data Flow Diagram

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           DATA SOURCES                                   │
├─────────────────────────────────────────────────────────────────────────┤
│  Scrapers: 1001tracklists | MixesDB | Beatport                         │
│  APIs: Spotify | MusicBrainz | Last.fm | AcousticBrainz | Discogs      │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         🥉 BRONZE LAYER (Raw)                            │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────┐  ┌───────────────────────┐                   │
│  │ bronze_scraped_tracks│  │ bronze_scraped_playlists│                  │
│  │ - raw_json (JSONB)   │  │ - raw_json (JSONB)     │                  │
│  │ - source_url         │  │ - source_url           │                  │
│  │ - scraper_version    │  │ - scraper_version      │                  │
│  └──────────────────────┘  └────────────────────────┘                  │
│  ┌──────────────────────┐  ┌───────────────────────┐                   │
│  │ bronze_scraped_artists│ │ bronze_api_enrichments │                  │
│  │ - raw_json (JSONB)   │  │ - raw_response (JSONB) │                  │
│  │ - source_artist_id   │  │ - api_provider         │                  │
│  └──────────────────────┘  └────────────────────────┘                  │
│                                                                          │
│  Characteristics: IMMUTABLE, APPEND-ONLY, FULL LINEAGE                 │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    ⚙️  WATERFALL ENRICHMENT ENGINE                       │
├─────────────────────────────────────────────────────────────────────────┤
│  Configuration Tables:                                                   │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ metadata_enrichment_config                                       │   │
│  │ Field: bpm                                                       │   │
│  │   Priority 1: beatport (confidence: 0.98)                       │   │
│  │   Priority 2: spotify (confidence: 0.85)                        │   │
│  │   Priority 3: acousticbrainz (confidence: 0.75)                │   │
│  │   Priority 4: mixesdb (confidence: 0.60)                        │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  Pipeline Execution:                                                     │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ 1. Start Run → Snapshot Config                                  │   │
│  │ 2. For Each Bronze Record:                                       │   │
│  │    a. For Each Field (bpm, key, genre, etc.):                   │   │
│  │       - Get Provider Priority List                              │   │
│  │       - Try Priority 1 Provider                                 │   │
│  │       - Check Confidence >= Threshold                           │   │
│  │       - If OK: Accept & Log | If NOT: Try Priority 2           │   │
│  │    b. Calculate Quality Score                                    │   │
│  │    c. Insert to Silver                                           │   │
│  │ 3. Complete Run → Update Stats                                   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  Tracking:                                                              │
│  - enrichment_pipeline_runs (audit log)                                │
│  - enrichment_transformations (field-level log)                        │
│  - field_provenance (transformation chain)                             │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      🥈 SILVER LAYER (Validated)                         │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────┐  ┌──────────────────────────────┐    │
│  │ silver_enriched_tracks       │  │ silver_enriched_artists      │    │
│  │ - bronze_id (FK)             │  │ - bronze_ids[] (FK)          │    │
│  │ - spotify_id, isrc, bpm, key │  │ - canonical_name (unique)    │    │
│  │ - validation_status          │  │ - aliases[]                  │    │
│  │ - data_quality_score         │  │ - deduplication_strategy     │    │
│  │ - enrichment_metadata (JSONB)│  │ - data_quality_score         │    │
│  │ - field_confidence (JSONB)   │  └──────────────────────────────┘    │
│  └──────────────────────────────┘                                      │
│  ┌──────────────────────────────┐  ┌──────────────────────────────┐    │
│  │ silver_enriched_playlists    │  │ silver_playlist_tracks       │    │
│  │ - bronze_id (FK)             │  │ - playlist_id, track_id      │    │
│  │ - artist_id (FK)             │  │ - position, cue_time_ms      │    │
│  │ - validation_status          │  └──────────────────────────────┘    │
│  └──────────────────────────────┘                                      │
│                                                                          │
│  Characteristics: VALIDATED, ENRICHED, QUALITY-SCORED, DEDUPLICATED    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      📊 AGGREGATION & ANALYSIS                           │
├─────────────────────────────────────────────────────────────────────────┤
│  - Denormalization for query performance                                │
│  - Precomputation of expensive calculations                             │
│  - Camelot wheel harmonic compatibility                                 │
│  - Genre distribution analysis                                          │
│  - Collaboration network graph                                          │
│  - Popularity and trending scores                                       │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       🥇 GOLD LAYER (Business)                           │
├─────────────────────────────────────────────────────────────────────────┤
│  Analytics Tables:                                                       │
│  ┌──────────────────────────────────────────────────────────────┐      │
│  │ gold_track_analytics                                          │      │
│  │ - full_track_name ("Artist - Title")                         │      │
│  │ - compatible_keys[] (Camelot wheel precomputed)              │      │
│  │ - playlist_appearances, play_count                           │      │
│  │ - enrichment_completeness                                     │      │
│  └──────────────────────────────────────────────────────────────┘      │
│  ┌──────────────────────────────────────────────────────────────┐      │
│  │ gold_artist_analytics                                         │      │
│  │ - total_tracks, total_playlists                              │      │
│  │ - avg_bpm, avg_energy, most_common_key                       │      │
│  │ - popularity_score, trending_score                           │      │
│  └──────────────────────────────────────────────────────────────┘      │
│  ┌──────────────────────────────────────────────────────────────┐      │
│  │ gold_playlist_analytics                                       │      │
│  │ - genre_distribution (JSONB)                                 │      │
│  │ - harmonic_flow_score (key transitions)                      │      │
│  │ - energy_curve (progression analysis)                        │      │
│  └──────────────────────────────────────────────────────────────┘      │
│                                                                          │
│  Materialized Views (Precomputed Queries):                              │
│  ┌──────────────────────────────────────────────────────────────┐      │
│  │ gold_top_tracks_by_genre                                      │      │
│  │ - Leaderboard of top tracks per genre                        │      │
│  └──────────────────────────────────────────────────────────────┘      │
│  ┌──────────────────────────────────────────────────────────────┐      │
│  │ gold_artist_collaboration_network                             │      │
│  │ - Precomputed artist-to-artist collaboration graph          │      │
│  └──────────────────────────────────────────────────────────────┘      │
│  ┌──────────────────────────────────────────────────────────────┐      │
│  │ gold_harmonic_mixing_recommendations                          │      │
│  │ - DJ mixing suggestions (key, BPM, energy compatible)        │      │
│  └──────────────────────────────────────────────────────────────┘      │
│                                                                          │
│  Characteristics: DENORMALIZED, FAST QUERIES, BUSINESS-READY           │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         📡 APPLICATIONS & APIs                           │
├─────────────────────────────────────────────────────────────────────────┤
│  - REST API (track search, analytics)                                   │
│  - Graph Visualization (artist collaboration network)                   │
│  - DJ Tools (harmonic mixing recommendations)                           │
│  - Analytics Dashboards (Grafana)                                       │
│  - ML Feature Store (training data)                                     │
└─────────────────────────────────────────────────────────────────────────┘
```

## Waterfall Enrichment Flow Detail

```
┌─────────────────────────────────────────────────────────────────┐
│                   Waterfall Enrichment Process                  │
│                          (Example: BPM)                         │
└─────────────────────────────────────────────────────────────────┘

Bronze Record: {"artist": "Deadmau5", "title": "Strobe", "bpm": null}
                                │
                                ▼
        ┌───────────────────────────────────────────┐
        │ Load Waterfall Config for Field: "bpm"   │
        │                                           │
        │ Priority 1: Beatport (min conf: 0.98)   │
        │ Priority 2: Spotify  (min conf: 0.85)   │
        │ Priority 3: AcousticBrainz (min: 0.75)  │
        │ Priority 4: MixesDB  (min conf: 0.60)   │
        └───────────────────────────────────────────┘
                                │
                                ▼
        ┌───────────────────────────────────────────┐
        │ Try Priority 1: Beatport API              │
        │ Request: GET /track/search?q=Deadmau5...  │
        └───────────────────────────────────────────┘
                                │
                      ┌─────────┴─────────┐
                      │                   │
                 SUCCESS               FAILURE
                (bpm: 128)         (404 Not Found)
               confidence: 0.98          │
                      │                   │
                      ▼                   ▼
        ┌─────────────────────┐   ┌──────────────────────────┐
        │ 0.98 >= 0.98? ✓     │   │ Log: Beatport Failed     │
        │ ACCEPT VALUE        │   │ Try Priority 2: Spotify  │
        │ Stop Waterfall      │   └──────────────────────────┘
        └─────────────────────┘                │
                      │                         ▼
                      │            ┌─────────────────────────┐
                      │            │ Spotify API Call        │
                      │            │ Result: bpm=128         │
                      │            │ Confidence: 0.85        │
                      │            └─────────────────────────┘
                      │                         │
                      │                         ▼
                      │            ┌─────────────────────────┐
                      │            │ 0.85 >= 0.85? ✓        │
                      │            │ ACCEPT VALUE           │
                      │            │ Stop Waterfall         │
                      │            └─────────────────────────┘
                      │                         │
                      └────────┬────────────────┘
                               │
                               ▼
        ┌───────────────────────────────────────────────┐
        │ Log Transformation:                           │
        │ - run_id: uuid                                │
        │ - transformation_type: "enrichment"           │
        │ - metadata_field: "bpm"                       │
        │ - provider_used: "beatport" (or "spotify")    │
        │ - input_value: {"bpm": null}                  │
        │ - output_value: {"bpm": 128}                  │
        │ - provider_confidence: 0.98 (or 0.85)         │
        │ - success: TRUE                               │
        └───────────────────────────────────────────────┘
                               │
                               ▼
        ┌───────────────────────────────────────────────┐
        │ Insert to Silver:                             │
        │ silver_enriched_tracks:                       │
        │   bpm: 128                                    │
        │   enrichment_metadata: {                      │
        │     "bpm": {                                  │
        │       "provider": "beatport",                 │
        │       "confidence": 0.98,                     │
        │       "fetched_at": "2025-10-10T13:30:00Z"   │
        │     }                                          │
        │   }                                           │
        │   field_confidence: {"bpm": 0.98}            │
        └───────────────────────────────────────────────┘
```

## Replay Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                      Pipeline Replay Process                     │
└─────────────────────────────────────────────────────────────────┘

User discovers: "Track BPM is wrong (showed 130, should be 128)"
                                │
                                ▼
        ┌───────────────────────────────────────────┐
        │ Query: Which run enriched this track?     │
        │ SELECT run_id FROM enrichment_transformations│
        │ WHERE silver_id = 'track-uuid'             │
        │   AND metadata_field = 'bpm'               │
        │ Result: run_id = 'abc-123'                 │
        └───────────────────────────────────────────┘
                                │
                                ▼
        ┌───────────────────────────────────────────┐
        │ View Config Snapshot from that run        │
        │ SELECT waterfall_config_snapshot           │
        │ FROM enrichment_pipeline_runs              │
        │ WHERE id = 'abc-123'                       │
        │                                            │
        │ Found: Beatport was Priority 1 at that time│
        │        (Now it's been changed to Priority 2)│
        └───────────────────────────────────────────┘
                                │
                                ▼
        ┌───────────────────────────────────────────┐
        │ Queue Replay with Historical Config       │
        │                                            │
        │ INSERT INTO pipeline_replay_queue:         │
        │   bronze_ids: ['bronze-uuid']              │
        │   target_layer: 'silver'                   │
        │   use_historical_config: TRUE              │
        │   config_snapshot_run_id: 'abc-123'        │
        │   fields_to_replay: ['bpm']                │
        │   reason: "Debug BPM mismatch"             │
        └───────────────────────────────────────────┘
                                │
                                ▼
        ┌───────────────────────────────────────────┐
        │ Replay Worker Picks Up Job                │
        │                                            │
        │ 1. Load Historical Config (run abc-123)   │
        │ 2. Re-run Enrichment with OLD config      │
        │ 3. Compare Results:                        │
        │    - Old run: Beatport (130) conf=0.89    │
        │    - New run: Spotify (128) conf=0.95     │
        │                                            │
        │ Finding: Beatport had confidence 0.89     │
        │          which was < threshold (0.98)     │
        │          so it should have tried Spotify  │
        │          but waterfall stopped early!      │
        │                                            │
        │ Root Cause: Bug in waterfall logic        │
        └───────────────────────────────────────────┘
                                │
                                ▼
        ┌───────────────────────────────────────────┐
        │ Fix Applied:                               │
        │ - Corrected waterfall logic                │
        │ - Updated silver record with correct BPM   │
        │ - Logged correction transformation         │
        └───────────────────────────────────────────┘
```

## Data Lineage Example

```
Track: "Deadmau5 - Strobe" - Complete Lineage
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🥉 BRONZE (Source)
├─ ID: bronze-abc-123
├─ Source: 1001tracklists
├─ URL: https://1001tracklists.com/tracklist/xyz
├─ Scraped: 2025-10-01 12:30:00
├─ Raw JSON: {
│    "artist": "Deadmau5",
│    "title": "Strobe",
│    "played_at": "2024-09-15"
│  }
└─ Fields Extracted: artist_name, track_title

        │
        │ WATERFALL ENRICHMENT (Run: run-def-456)
        │ Config Snapshot: 2025-10-01 14:00:00
        ▼

⚙️  ENRICHMENT TRANSFORMATIONS
├─ spotify_id:
│  ├─ Priority 1: Spotify API ✓
│  │  ├─ Input: null
│  │  ├─ Output: "spotify:track:0Qsk...'
│  │  ├─ Confidence: 1.00
│  │  └─ Accepted (≥ 0.95)
│  └─ Provider: Spotify
│
├─ bpm:
│  ├─ Priority 1: Beatport API ✗ (404 Not Found)
│  ├─ Priority 2: Spotify API ✓
│  │  ├─ Input: null
│  │  ├─ Output: 128.00
│  │  ├─ Confidence: 0.85
│  │  └─ Accepted (≥ 0.85)
│  └─ Provider: Spotify
│
├─ key:
│  ├─ Priority 1: Beatport API ✓
│  │  ├─ Input: null
│  │  ├─ Output: "6A"
│  │  ├─ Confidence: 0.95
│  │  └─ Accepted (≥ 0.95)
│  └─ Provider: Beatport
│
└─ genre:
   ├─ Priority 1: Beatport API ✓
   │  ├─ Input: null
   │  ├─ Output: ["Progressive House"]
   │  ├─ Confidence: 0.90
   │  └─ Accepted (≥ 0.90)
   └─ Provider: Beatport

        │
        │ VALIDATION & QUALITY SCORING
        │ Score: 0.92 (4/4 critical fields × avg confidence)
        ▼

🥈 SILVER (Validated)
├─ ID: silver-ghi-789
├─ Bronze Reference: bronze-abc-123
├─ Artist: "deadmau5" (normalized)
├─ Title: "Strobe"
├─ Spotify ID: "spotify:track:0Qsk..."
├─ BPM: 128.00 (from Spotify, conf: 0.85)
├─ Key: "6A" (from Beatport, conf: 0.95)
├─ Genre: ["Progressive House"] (from Beatport, conf: 0.90)
├─ Validation Status: "valid"
├─ Quality Score: 0.92
├─ Enrichment Metadata: {
│    "spotify_id": {"provider": "spotify", "confidence": 1.00},
│    "bpm": {"provider": "spotify", "confidence": 0.85},
│    "key": {"provider": "beatport", "confidence": 0.95},
│    "genre": {"provider": "beatport", "confidence": 0.90}
│  }
└─ Enrichment Run: run-def-456

        │
        │ AGGREGATION & DENORMALIZATION
        ▼

🥇 GOLD (Business)
├─ ID: gold-jkl-012
├─ Silver Reference: silver-ghi-789
├─ Full Name: "deadmau5 - Strobe"
├─ BPM: 128.00
├─ Key: "6A"
├─ Compatible Keys: ["6A", "6B", "5A", "7A"] (Camelot precomputed)
├─ Genre Primary: "Progressive House"
├─ Playlist Appearances: 147
├─ Enrichment Completeness: 0.88 (88% of fields populated)
├─ Quality Score: 0.92
└─ Last Analyzed: 2025-10-10 13:00:00

        │
        │ MATERIALIZED VIEW: Harmonic Recommendations
        ▼

📊 RECOMMENDATIONS (Precomputed)
For Track: "deadmau5 - Strobe" (Key: 6A, BPM: 128)
├─ Recommendation 1:
│  ├─ Track: "Eric Prydz - Opus"
│  ├─ Key: 6A (same key) → +0.5
│  ├─ BPM: 126 (±2) → +0.3
│  ├─ Energy: 0.83 vs 0.85 (±0.1) → +0.2
│  └─ Compatibility Score: 1.0
│
├─ Recommendation 2:
│  ├─ Track: "Yotto - Hyperfall"
│  ├─ Key: 6B (Camelot neighbor) → +0.5
│  ├─ BPM: 129 (±1) → +0.3
│  ├─ Energy: 0.81 vs 0.85 (±0.15) → +0.1
│  └─ Compatibility Score: 0.9
│
└─ [More recommendations...]
```

## Performance Characteristics

```
QUERY PERFORMANCE (1M Tracks)
─────────────────────────────────────────────────

Bronze Layer:
├─ Lookup by ID: < 1ms (B-tree index)
├─ Filter by source: < 5ms (indexed)
├─ JSONB field search: < 50ms (GIN index)
└─ Full table scan: ~2-3s (avoid!)

Silver Layer:
├─ Track by Spotify ID: < 1ms (unique index)
├─ Full-text search: < 50ms (GIN tsvector)
├─ Filter by quality score: < 10ms (indexed)
├─ Join bronze→silver: < 5ms (FK indexed)
└─ Complex validation queries: < 100ms

Gold Layer:
├─ Artist analytics: < 5ms (denormalized)
├─ Genre leaderboard: < 5ms (materialized view)
├─ Harmonic recommendations: < 10ms (precomputed)
├─ Collaboration network: < 20ms (materialized)
└─ Complex aggregations: < 50ms (precomputed)

Materialized View Refresh:
├─ gold_top_tracks_by_genre: ~500ms (100k tracks)
├─ gold_artist_collaboration: ~2s (cross join)
├─ gold_harmonic_recommendations: ~5s (compatibility calc)
└─ All views: ~10s total (run hourly)

Pipeline Operations:
├─ Bronze insert: < 5ms per record
├─ Waterfall enrichment: 500-1000ms (4-6 API calls)
├─ Silver insert: < 10ms per record
├─ Gold aggregation: < 20ms per record
└─ Full pipeline (1 track): ~1-2 seconds
```

---

**This diagram is a living document. Update as the architecture evolves.**
