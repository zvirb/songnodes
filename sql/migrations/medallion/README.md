# Medallion Architecture: Bronze → Silver → Gold

This directory contains database migration files implementing the **Medallion Architecture** (also known as the Bronze-Silver-Gold pattern) for the SongNodes data enrichment pipeline.

## Architecture Overview

The Medallion Architecture is a data design pattern used to logically organize data in a lakehouse/database with the goal of incrementally improving the quality and structure of data as it flows through each layer:

```
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│   BRONZE    │ ───> │   SILVER    │ ───> │    GOLD     │
│  (Raw Data) │      │ (Validated) │      │ (Business)  │
└─────────────┘      └─────────────┘      └─────────────┘
```

### Layer Definitions

#### 🥉 Bronze Layer (Raw/Immutable)
- **Purpose**: Preserve raw scraped data exactly as collected
- **Characteristics**:
  - Immutable (never updated, only appended)
  - Complete source data preserved in `raw_json` JSONB field
  - Full data lineage with source URLs and scraper versions
  - Supports replay and debugging
- **Tables**:
  - `bronze_scraped_tracks` - Raw track data from scrapers
  - `bronze_scraped_playlists` - Raw playlist/setlist data
  - `bronze_scraped_artists` - Raw artist data
  - `bronze_api_enrichments` - Raw API responses from enrichment providers

#### 🥈 Silver Layer (Validated/Enriched)
- **Purpose**: Clean, validated, and enriched data with quality scoring
- **Characteristics**:
  - References bronze sources for lineage
  - Data quality scoring and validation status
  - Enrichment metadata with provider confidence
  - Deduplication and canonical naming
- **Tables**:
  - `silver_enriched_tracks` - Validated and enriched tracks
  - `silver_enriched_artists` - Deduplicated artists with canonical names
  - `silver_enriched_playlists` - Validated playlists
  - `silver_playlist_tracks` - Track-playlist relationships

#### 🥇 Gold Layer (Business-Ready)
- **Purpose**: Denormalized, query-optimized data for analytics
- **Characteristics**:
  - Precomputed aggregations and metrics
  - Optimized for business intelligence queries
  - Materialized views for common query patterns
  - Harmonic mixing recommendations precomputed
- **Tables**:
  - `gold_track_analytics` - Denormalized track analytics
  - `gold_artist_analytics` - Artist statistics and popularity
  - `gold_playlist_analytics` - Playlist analysis with harmonic flow
- **Materialized Views**:
  - `gold_top_tracks_by_genre` - Top tracks per genre leaderboard
  - `gold_artist_collaboration_network` - Collaboration graph
  - `gold_harmonic_mixing_recommendations` - DJ mixing recommendations

## Configuration-Driven Waterfall Enrichment

The enrichment process uses a **configurable waterfall model** where each metadata field has prioritized providers with confidence thresholds:

```sql
-- Example: BPM enrichment waterfall
Priority 1: Beatport (min confidence: 0.98)
Priority 2: Spotify (min confidence: 0.85)
Priority 3: AcousticBrainz (min confidence: 0.75)
Priority 4: MixesDB (min confidence: 0.60)
```

### Key Configuration Tables

- **`metadata_enrichment_config`**: Defines provider priority and confidence thresholds per field
- **`enrichment_providers`**: Registry of available providers with capabilities
- **`provider_performance_history`**: Historical performance for adaptive optimization

### Example Waterfall Query

```sql
-- Get provider priority for 'bpm' field, excluding failed providers
SELECT * FROM get_provider_priority('bpm', ARRAY['mixesdb']);

-- Returns:
-- priority | provider        | min_confidence
-- ---------|-----------------|---------------
-- 1        | beatport        | 0.98
-- 2        | spotify         | 0.85
-- 3        | acousticbrainz  | 0.75
```

## Pipeline Replay & Data Lineage

Every enrichment operation is tracked for **full replayability and debugging**:

### Lineage Tables

- **`enrichment_pipeline_runs`**: Audit log of pipeline executions with config snapshots
- **`enrichment_transformations`**: Detailed log of each transformation (field-level)
- **`field_provenance`**: Complete transformation history per field
- **`pipeline_replay_queue`**: Queue for replaying enrichment on specific records

### Replay Capabilities

1. **Time-travel replay**: Replay with historical configuration
2. **Partial replay**: Replay specific fields or records
3. **Debug replay**: Trace transformation chain for any field value
4. **Cost tracking**: Monitor API costs per run

### Example: Replay with Historical Config

```sql
-- Queue a replay using configuration from a previous run
INSERT INTO pipeline_replay_queue (
    bronze_ids,
    target_layer,
    use_historical_config,
    config_snapshot_run_id,
    requested_by,
    reason
) VALUES (
    ARRAY['uuid-of-track-1', 'uuid-of-track-2'],
    'silver',
    TRUE,
    'uuid-of-historical-run',
    'user@example.com',
    'Debug BPM mismatch with old Beatport API version'
);
```

## Migration Files

| File | Description | Dependencies |
|------|-------------|--------------|
| `001_bronze_layer_up.sql` | Create bronze (raw) tables | None |
| `001_bronze_layer_down.sql` | Rollback bronze layer | - |
| `002_silver_layer_up.sql` | Create silver (validated) tables | 001_bronze_layer |
| `002_silver_layer_down.sql` | Rollback silver layer | - |
| `003_gold_layer_up.sql` | Create gold (business) tables + views | 002_silver_layer |
| `003_gold_layer_down.sql` | Rollback gold layer | - |
| `004_waterfall_configuration_up.sql` | Waterfall enrichment config | None (independent) |
| `004_waterfall_configuration_down.sql` | Rollback waterfall config | - |
| `005_pipeline_replay_support_up.sql` | Pipeline replay & lineage tracking | 001-004 |
| `005_pipeline_replay_support_down.sql` | Rollback replay support | - |

## Applying Migrations

### Method 1: Sequential Application (Recommended)

```bash
# Connect to database
psql -h localhost -p 5433 -U musicdb_user -d musicdb

# Apply migrations in order
\i sql/migrations/medallion/001_bronze_layer_up.sql
\i sql/migrations/medallion/002_silver_layer_up.sql
\i sql/migrations/medallion/003_gold_layer_up.sql
\i sql/migrations/medallion/004_waterfall_configuration_up.sql
\i sql/migrations/medallion/005_pipeline_replay_support_up.sql
```

### Method 2: Docker Exec

```bash
# Copy migrations to container
docker cp sql/migrations/medallion postgres:/tmp/medallion/

# Execute in container
docker exec -i postgres psql -U musicdb_user -d musicdb << EOF
\i /tmp/medallion/001_bronze_layer_up.sql
\i /tmp/medallion/002_silver_layer_up.sql
\i /tmp/medallion/003_gold_layer_up.sql
\i /tmp/medallion/004_waterfall_configuration_up.sql
\i /tmp/medallion/005_pipeline_replay_support_up.sql
EOF
```

### Method 3: Combined Script

```bash
# Create and run combined migration
cat sql/migrations/medallion/*_up.sql > /tmp/medallion_all.sql
psql -h localhost -p 5433 -U musicdb_user -d musicdb -f /tmp/medallion_all.sql
```

## Rolling Back Migrations

To rollback migrations, execute the `_down.sql` files in **reverse order**:

```bash
psql -h localhost -p 5433 -U musicdb_user -d musicdb << EOF
\i sql/migrations/medallion/005_pipeline_replay_support_down.sql
\i sql/migrations/medallion/004_waterfall_configuration_down.sql
\i sql/migrations/medallion/003_gold_layer_down.sql
\i sql/migrations/medallion/002_silver_layer_down.sql
\i sql/migrations/medallion/001_bronze_layer_down.sql
EOF
```

## Data Flow Example

### 1. Bronze: Scrape Raw Data

```python
# Scraper inserts raw data
INSERT INTO bronze_scraped_tracks (
    source, source_url, scraper_version, raw_json, artist_name, track_title
) VALUES (
    '1001tracklists',
    'https://1001tracklists.com/tracklist/...',
    '1001tracklists-v2.1.0',
    '{"artist": "Deadmau5", "title": "Strobe", ...}'::jsonb,
    'Deadmau5',
    'Strobe'
);
```

### 2. Silver: Validate & Enrich

```python
# Enrichment pipeline creates silver record
run_id = start_pipeline_run('incremental', 'scheduler')

# Waterfall enrichment
for field in ['spotify_id', 'bpm', 'key', 'genre']:
    for provider in get_provider_priority(field):
        result = enrich_field(track, field, provider)

        log_transformation(
            run_id, 'enrichment', field, provider,
            input_value=original_value,
            output_value=result.value,
            success=result.success,
            confidence=result.confidence
        )

        if result.confidence >= provider.min_confidence:
            break  # Accept this value, stop waterfall

# Insert to silver with quality score
INSERT INTO silver_enriched_tracks (
    bronze_id, artist_name, track_title, spotify_id, bpm, key,
    data_quality_score, enrichment_metadata, validation_status
) VALUES (...);
```

### 3. Gold: Aggregate & Optimize

```python
# Populate gold analytics
INSERT INTO gold_track_analytics (
    silver_track_id,
    full_track_name,
    compatible_keys,  -- Precomputed via Camelot wheel
    playlist_appearances,
    enrichment_completeness
)
SELECT
    s.id,
    s.artist_name || ' - ' || s.track_title,
    calculate_compatible_keys(s.key),
    COUNT(pt.playlist_id),
    calculate_enrichment_completeness(s.*)
FROM silver_enriched_tracks s
LEFT JOIN silver_playlist_tracks pt ON pt.track_id = s.id
GROUP BY s.id;

-- Refresh materialized views
SELECT refresh_gold_materialized_views();
```

## Performance Considerations

### Indexing Strategy

- **Bronze**: Indexes on source, scraped_at, and raw_json (GIN)
- **Silver**: Indexes on validation_status, quality_score, identifiers, full-text search
- **Gold**: Indexes optimized for analytics queries (BPM ranges, genre, popularity)

### Maintenance Tasks

```sql
-- Refresh gold materialized views (run hourly/daily)
SELECT refresh_gold_materialized_views();

-- Vacuum and analyze after large imports
VACUUM ANALYZE bronze_scraped_tracks;
VACUUM ANALYZE silver_enriched_tracks;
VACUUM ANALYZE gold_track_analytics;

-- Update provider performance metrics (run daily)
INSERT INTO provider_performance_history (
    provider_name, metadata_field, request_count, success_count,
    avg_confidence, period_start, period_end
)
SELECT
    provider_used,
    metadata_field,
    COUNT(*),
    COUNT(*) FILTER (WHERE success),
    AVG(provider_confidence),
    DATE_TRUNC('day', NOW() - INTERVAL '1 day'),
    DATE_TRUNC('day', NOW())
FROM enrichment_transformations
WHERE created_at >= NOW() - INTERVAL '1 day'
GROUP BY provider_used, metadata_field;
```

## Key Design Decisions

### 1. **Immutable Bronze Layer**
- **Decision**: Bronze tables are append-only, never updated
- **Rationale**: Enables exact replay, debugging, and audit trail
- **Trade-off**: Higher storage cost, but disk is cheap compared to re-scraping

### 2. **JSONB for Raw Storage**
- **Decision**: Store complete raw data in JSONB columns
- **Rationale**: Flexibility for schema evolution, full data preservation
- **Trade-off**: Slightly slower queries, but GIN indexes mitigate this

### 3. **Configuration-Driven Waterfall**
- **Decision**: Waterfall priorities in database tables, not hardcoded
- **Rationale**: Change priorities without code deployment, A/B test providers
- **Trade-off**: Additional database complexity, but massive operational flexibility

### 4. **Field-Level Provenance**
- **Decision**: Track transformation history per field, not per record
- **Rationale**: Granular debugging (e.g., "why is this BPM value wrong?")
- **Trade-off**: Higher storage and complexity, but essential for data quality

### 5. **Materialized Views for Gold**
- **Decision**: Precompute expensive aggregations as materialized views
- **Rationale**: Sub-second query response for analytics dashboards
- **Trade-off**: Must refresh periodically, but queries are 10-100x faster

### 6. **Snapshot-Based Replay**
- **Decision**: Capture config snapshot at each pipeline run
- **Rationale**: Exact reproducibility even after config changes
- **Trade-off**: Duplicate config storage, but critical for debugging

### 7. **Separate Playlist-Track Junction**
- **Decision**: `silver_playlist_tracks` junction table with ordering
- **Rationale**: Many-to-many relationship with track position and timing
- **Trade-off**: Additional join complexity, but necessary for playlist analysis

## Monitoring & Alerting

### Key Metrics to Monitor

```sql
-- Data quality trend (should trend upward)
SELECT
    metric_date,
    data_layer,
    avg_quality_score,
    avg_enrichment_confidence
FROM data_quality_metrics
WHERE metric_date >= NOW() - INTERVAL '30 days'
ORDER BY metric_date DESC, data_layer;

-- Provider health (alert if < 70% success rate)
SELECT
    provider_name,
    health_status,
    success_rate,
    last_health_check
FROM enrichment_providers
WHERE success_rate < 0.70 OR health_status != 'healthy';

-- Pipeline failures (alert on any failed runs)
SELECT
    run_type,
    run_status,
    started_at,
    critical_errors
FROM enrichment_pipeline_runs
WHERE run_status = 'failed'
  AND started_at >= NOW() - INTERVAL '24 hours';

-- Field completeness (alert if drops below 80%)
SELECT
    metadata_field,
    COUNT(*) as total_records,
    COUNT(*) FILTER (WHERE field_value IS NOT NULL) as populated,
    (COUNT(*) FILTER (WHERE field_value IS NOT NULL)::FLOAT / COUNT(*) * 100) as completeness_pct
FROM (
    SELECT
        'bpm' as metadata_field,
        bpm as field_value
    FROM silver_enriched_tracks
) completeness
GROUP BY metadata_field
HAVING (COUNT(*) FILTER (WHERE field_value IS NOT NULL)::FLOAT / COUNT(*) * 100) < 80;
```

## Integration with Existing System

### Migration from Current `tracks` Table

```sql
-- Step 1: Backfill bronze from existing tracks
INSERT INTO bronze_scraped_tracks (
    source, source_url, scraper_version, raw_json, artist_name, track_title, scraped_at
)
SELECT
    'legacy_migration',
    COALESCE(source_url, 'unknown'),
    'legacy-v1.0',
    jsonb_build_object(
        'artist', artist_name,
        'title', title,
        'bpm', bpm,
        'key', key
        -- ... other fields
    ),
    artist_name,
    title,
    COALESCE(created_at, NOW())
FROM tracks;

-- Step 2: Promote to silver with validation
INSERT INTO silver_enriched_tracks (
    bronze_id, artist_name, track_title, bpm, key,
    validation_status, data_quality_score, enrichment_metadata
)
SELECT
    b.id,
    b.artist_name,
    b.track_title,
    (b.raw_json->>'bpm')::DECIMAL,
    b.raw_json->>'key',
    CASE
        WHEN b.raw_json->>'bpm' IS NOT NULL AND b.raw_json->>'key' IS NOT NULL
        THEN 'valid'
        ELSE 'needs_review'
    END,
    calculate_legacy_quality_score(b.raw_json),
    jsonb_build_object('source', 'legacy_migration', 'migrated_at', NOW())
FROM bronze_scraped_tracks b
WHERE source = 'legacy_migration';

-- Step 3: Populate gold analytics
INSERT INTO gold_track_analytics (
    silver_track_id, artist_name, track_title, full_track_name,
    bpm, key, data_quality_score
)
SELECT
    s.id,
    s.artist_name,
    s.track_title,
    s.artist_name || ' - ' || s.track_title,
    s.bpm,
    s.key,
    s.data_quality_score
FROM silver_enriched_tracks s;
```

## Future Enhancements

1. **Delta Layer**: Add intermediate delta processing layer for CDC (Change Data Capture)
2. **ML Feature Store**: Extend gold layer to serve as feature store for ML models
3. **Time-Travel Queries**: Implement temporal tables for historical point-in-time queries
4. **Automated Retraining**: Use performance history to retrain waterfall priorities via ML
5. **Multi-Tenant**: Add tenant_id partitioning for multi-customer deployments

## References

- [Databricks Medallion Architecture](https://www.databricks.com/glossary/medallion-architecture)
- [Data Mesh Principles](https://martinfowler.com/articles/data-mesh-principles.html)
- [PostgreSQL Partitioning](https://www.postgresql.org/docs/current/ddl-partitioning.html)
- [JSONB Performance](https://www.postgresql.org/docs/current/datatype-json.html)

---

**Created**: 2025-10-10
**Version**: 1.0.0
**Maintainer**: SongNodes Data Engineering Team
