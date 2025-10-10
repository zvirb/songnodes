-- ============================================================================
-- Medallion Architecture: Quick Reference SQL Queries
-- ============================================================================

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check all medallion tables exist
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE tablename LIKE 'bronze_%'
   OR tablename LIKE 'silver_%'
   OR tablename LIKE 'gold_%'
   OR tablename IN ('metadata_enrichment_config', 'enrichment_providers',
                     'enrichment_pipeline_runs', 'enrichment_transformations')
ORDER BY tablename;

-- View waterfall configuration summary
SELECT * FROM enrichment_waterfall_summary
ORDER BY
    CASE field_type
        WHEN 'identifier' THEN 1
        WHEN 'musical_attribute' THEN 2
        WHEN 'metadata' THEN 3
        ELSE 4
    END,
    metadata_field;

-- Check provider registry
SELECT
    provider_name,
    provider_type,
    array_length(supported_fields, 1) as supported_field_count,
    enabled,
    health_status
FROM enrichment_providers
ORDER BY provider_name;

-- ============================================================================
-- DATA FLOW EXAMPLES
-- ============================================================================

-- 1. Insert Bronze Data (Scraper Output)
INSERT INTO bronze_scraped_tracks (
    source,
    source_url,
    source_track_id,
    scraper_version,
    raw_json,
    artist_name,
    track_title
) VALUES (
    '1001tracklists',
    'https://1001tracklists.com/tracklist/example',
    'track-123',
    '1001tracklists-v2.1.0',
    jsonb_build_object(
        'artist', 'Deadmau5',
        'title', 'Strobe',
        'bpm', 128,
        'key', '6A'
    ),
    'Deadmau5',
    'Strobe'
);

-- 2. Enrich to Silver (with waterfall metadata)
INSERT INTO silver_enriched_tracks (
    bronze_id,
    artist_name,
    track_title,
    spotify_id,
    bpm,
    key,
    genre,
    validation_status,
    data_quality_score,
    enrichment_metadata,
    field_confidence
) VALUES (
    (SELECT id FROM bronze_scraped_tracks WHERE source_track_id = 'track-123' LIMIT 1),
    'deadmau5',  -- Normalized
    'Strobe',
    'spotify:track:xyz123',
    128.00,
    '6A',
    ARRAY['Progressive House', 'Electronic'],
    'valid',
    0.92,
    jsonb_build_object(
        'spotify_id', jsonb_build_object('provider', 'spotify', 'confidence', 1.00),
        'bpm', jsonb_build_object('provider', 'beatport', 'confidence', 0.98),
        'key', jsonb_build_object('provider', 'beatport', 'confidence', 0.95),
        'genre', jsonb_build_object('provider', 'beatport', 'confidence', 0.90)
    ),
    jsonb_build_object(
        'spotify_id', 1.00,
        'bpm', 0.98,
        'key', 0.95,
        'genre', 0.90
    )
);

-- 3. Promote to Gold (Analytics Layer)
INSERT INTO gold_track_analytics (
    silver_track_id,
    artist_name,
    track_title,
    full_track_name,
    spotify_id,
    bpm,
    key,
    genre_primary,
    genres,
    compatible_keys,
    data_quality_score,
    enrichment_completeness
) VALUES (
    (SELECT id FROM silver_enriched_tracks WHERE track_title = 'Strobe' LIMIT 1),
    'deadmau5',
    'Strobe',
    'deadmau5 - Strobe',
    'spotify:track:xyz123',
    128.00,
    '6A',
    'Progressive House',
    ARRAY['Progressive House', 'Electronic'],
    ARRAY['6A', '6B', '5A', '7A'],  -- Camelot wheel compatible keys
    0.92,
    0.88  -- 88% of enrichable fields populated
);

-- ============================================================================
-- WATERFALL ENRICHMENT QUERIES
-- ============================================================================

-- Get provider priority for a specific field
SELECT * FROM get_provider_priority('bpm');

-- Get provider priority excluding failed providers
SELECT * FROM get_provider_priority('bpm', ARRAY['mixesdb', 'acousticbrainz']);

-- Update waterfall priority for a field
UPDATE metadata_enrichment_config
SET
    priority_1_provider = 'spotify',
    priority_1_confidence = 0.95,
    priority_2_provider = 'beatport',
    priority_2_confidence = 0.90,
    last_updated = NOW()
WHERE metadata_field = 'energy';

-- Disable enrichment for a specific field
UPDATE metadata_enrichment_config
SET enabled = FALSE
WHERE metadata_field = 'valence';

-- ============================================================================
-- PIPELINE EXECUTION
-- ============================================================================

-- Start a new pipeline run
SELECT start_pipeline_run(
    'incremental',              -- run_type
    'scheduler',                -- triggered_by
    'production',               -- execution_environment
    ARRAY['spotify', 'beatport'], -- source_filter (optional)
    NOW() - INTERVAL '24 hours', -- date_filter_start (optional)
    NOW()                        -- date_filter_end (optional)
);
-- Returns: run_id (UUID)

-- Log a transformation
SELECT log_transformation(
    'run-id-uuid'::UUID,        -- run_id
    'enrichment',               -- transformation_type
    'bpm',                      -- metadata_field
    'beatport',                 -- provider_used
    '{"bpm": null}'::JSONB,     -- input_value
    '{"bpm": 128}'::JSONB,      -- output_value
    TRUE,                       -- success
    0.98,                       -- provider_confidence
    'bronze-id-uuid'::UUID,     -- bronze_id
    'silver-id-uuid'::UUID,     -- silver_id
    NULL,                       -- error_message
    150                         -- processing_time_ms
);
-- Returns: transformation_id (UUID)

-- Complete a pipeline run
SELECT complete_pipeline_run(
    'run-id-uuid'::UUID,
    'completed',
    '{"spotify_errors": 2, "beatport_errors": 0}'::JSONB
);

-- ============================================================================
-- REPLAY & DEBUGGING
-- ============================================================================

-- Queue a replay for specific tracks
INSERT INTO pipeline_replay_queue (
    bronze_ids,
    target_layer,
    replay_from_bronze,
    fields_to_replay,
    requested_by,
    reason,
    priority
) VALUES (
    ARRAY[
        'bronze-id-1'::UUID,
        'bronze-id-2'::UUID
    ],
    'silver',
    TRUE,
    ARRAY['bpm', 'key'],  -- Only replay these fields
    'admin@songnodes.com',
    'Debug BPM mismatch after Beatport API update',
    1  -- High priority
);

-- View transformation history for a track
SELECT
    t.created_at,
    t.transformation_type,
    t.metadata_field,
    t.provider_used,
    t.input_value,
    t.output_value,
    t.provider_confidence,
    t.success
FROM enrichment_transformations t
WHERE t.silver_id = 'silver-track-id-uuid'::UUID
ORDER BY t.created_at;

-- Trace field provenance
SELECT
    fp.metadata_field,
    fp.original_source,
    fp.original_value,
    fp.current_value,
    fp.current_provider,
    fp.current_confidence,
    fp.total_transformations
FROM field_provenance fp
WHERE fp.silver_track_id = 'silver-track-id-uuid'::UUID;

-- ============================================================================
-- ANALYTICS QUERIES
-- ============================================================================

-- Top tracks by genre
SELECT
    genre,
    artist_name,
    track_title,
    playlist_appearances,
    data_quality_score
FROM gold_top_tracks_by_genre
WHERE genre = 'Progressive House'
  AND rank_in_genre <= 10
ORDER BY rank_in_genre;

-- Artist collaboration network
SELECT
    artist_1,
    artist_2,
    shared_playlists,
    shared_tracks,
    last_collaboration_date
FROM gold_artist_collaboration_network
WHERE artist_1 = 'deadmau5' OR artist_2 = 'deadmau5'
ORDER BY shared_playlists DESC
LIMIT 20;

-- Harmonic mixing recommendations
SELECT
    source_track,
    source_key,
    source_bpm,
    recommended_track,
    recommended_key,
    recommended_bpm,
    compatibility_score
FROM gold_harmonic_mixing_recommendations
WHERE source_track_id = 'gold-track-id-uuid'::UUID
ORDER BY compatibility_score DESC
LIMIT 10;

-- Track enrichment completeness
SELECT
    artist_name,
    track_title,
    data_quality_score,
    enrichment_completeness,
    CASE
        WHEN spotify_id IS NOT NULL THEN 1 ELSE 0 END +
        CASE WHEN bpm IS NOT NULL THEN 1 ELSE 0 END +
        CASE WHEN key IS NOT NULL THEN 1 ELSE 0 END +
        CASE WHEN genre_primary IS NOT NULL THEN 1 ELSE 0 END
    AS critical_fields_populated
FROM gold_track_analytics
WHERE enrichment_completeness < 0.7
ORDER BY enrichment_completeness DESC
LIMIT 20;

-- ============================================================================
-- QUALITY MONITORING
-- ============================================================================

-- Data quality trend over time
SELECT
    metric_date,
    data_layer,
    total_records,
    valid_records,
    (valid_records::FLOAT / NULLIF(total_records, 0) * 100) as valid_pct,
    avg_quality_score,
    avg_enrichment_confidence
FROM data_quality_metrics
WHERE metric_date >= CURRENT_DATE - INTERVAL '30 days'
  AND data_layer = 'silver'
ORDER BY metric_date DESC;

-- Provider performance comparison
SELECT
    provider_name,
    metadata_field,
    request_count,
    success_count,
    success_rate,
    avg_confidence,
    avg_response_time_ms
FROM provider_performance_history
WHERE period_end >= NOW() - INTERVAL '7 days'
ORDER BY provider_name, metadata_field;

-- Pipeline run statistics
SELECT
    run_type,
    run_status,
    started_at,
    completed_at,
    duration_seconds,
    total_records_processed,
    successful_enrichments,
    failed_enrichments,
    total_api_cost_usd,
    triggered_by
FROM enrichment_pipeline_runs
WHERE started_at >= NOW() - INTERVAL '7 days'
ORDER BY started_at DESC;

-- Field completeness by layer
SELECT
    'bronze' as layer,
    COUNT(*) as total,
    COUNT(artist_name) as has_artist,
    COUNT(track_title) as has_title,
    (COUNT(artist_name)::FLOAT / COUNT(*) * 100)::DECIMAL(5,2) as artist_completeness
FROM bronze_scraped_tracks

UNION ALL

SELECT
    'silver' as layer,
    COUNT(*) as total,
    COUNT(artist_name) as has_artist,
    COUNT(track_title) as has_title,
    (COUNT(artist_name)::FLOAT / COUNT(*) * 100)::DECIMAL(5,2) as artist_completeness
FROM silver_enriched_tracks

UNION ALL

SELECT
    'gold' as layer,
    COUNT(*) as total,
    COUNT(artist_name) as has_artist,
    COUNT(track_title) as has_title,
    (COUNT(artist_name)::FLOAT / COUNT(*) * 100)::DECIMAL(5,2) as artist_completeness
FROM gold_track_analytics;

-- ============================================================================
-- MAINTENANCE
-- ============================================================================

-- Refresh all gold materialized views
SELECT refresh_gold_materialized_views();

-- Vacuum and analyze medallion tables
VACUUM ANALYZE bronze_scraped_tracks;
VACUUM ANALYZE bronze_scraped_playlists;
VACUUM ANALYZE bronze_scraped_artists;
VACUUM ANALYZE silver_enriched_tracks;
VACUUM ANALYZE silver_enriched_artists;
VACUUM ANALYZE silver_enriched_playlists;
VACUUM ANALYZE gold_track_analytics;
VACUUM ANALYZE gold_artist_analytics;
VACUUM ANALYZE gold_playlist_analytics;

-- Update provider health status
UPDATE enrichment_providers
SET
    health_status = CASE
        WHEN success_rate < 0.5 THEN 'down'
        WHEN success_rate < 0.8 THEN 'degraded'
        ELSE 'healthy'
    END,
    last_health_check = NOW()
WHERE enabled = TRUE;

-- ============================================================================
-- MIGRATION FROM LEGACY
-- ============================================================================

-- Backfill bronze from existing tracks table
INSERT INTO bronze_scraped_tracks (
    source,
    source_url,
    scraper_version,
    raw_json,
    artist_name,
    track_title,
    scraped_at
)
SELECT
    'legacy_migration',
    COALESCE(source_url, 'unknown'),
    'legacy-v1.0',
    jsonb_build_object(
        'artist', artist_name,
        'title', title,
        'bpm', bpm,
        'key', key,
        'spotify_id', spotify_id
    ),
    artist_name,
    title,
    COALESCE(created_at, NOW())
FROM tracks
WHERE created_at >= '2024-01-01'  -- Adjust date range as needed
ON CONFLICT (source, source_url, source_track_id) DO NOTHING;

-- Promote legacy data to silver
INSERT INTO silver_enriched_tracks (
    bronze_id,
    artist_name,
    track_title,
    spotify_id,
    bpm,
    key,
    validation_status,
    data_quality_score,
    enrichment_metadata
)
SELECT
    b.id,
    b.artist_name,
    b.track_title,
    b.raw_json->>'spotify_id',
    (b.raw_json->>'bpm')::DECIMAL,
    b.raw_json->>'key',
    CASE
        WHEN b.raw_json->>'spotify_id' IS NOT NULL
         AND b.raw_json->>'bpm' IS NOT NULL
         AND b.raw_json->>'key' IS NOT NULL
        THEN 'valid'
        ELSE 'needs_review'
    END,
    -- Simple quality score calculation
    (
        CASE WHEN b.raw_json->>'spotify_id' IS NOT NULL THEN 0.25 ELSE 0 END +
        CASE WHEN b.raw_json->>'bpm' IS NOT NULL THEN 0.25 ELSE 0 END +
        CASE WHEN b.raw_json->>'key' IS NOT NULL THEN 0.25 ELSE 0 END +
        CASE WHEN b.artist_name IS NOT NULL AND b.track_title IS NOT NULL THEN 0.25 ELSE 0 END
    ),
    jsonb_build_object(
        'source', 'legacy_migration',
        'migrated_at', NOW()
    )
FROM bronze_scraped_tracks b
WHERE source = 'legacy_migration'
ON CONFLICT DO NOTHING;

-- ============================================================================
-- DEBUGGING HELPERS
-- ============================================================================

-- Find tracks with low quality scores
SELECT
    s.artist_name,
    s.track_title,
    s.data_quality_score,
    s.validation_status,
    s.enrichment_metadata
FROM silver_enriched_tracks s
WHERE s.data_quality_score < 0.6
ORDER BY s.data_quality_score ASC
LIMIT 20;

-- Find tracks missing critical fields
SELECT
    s.artist_name,
    s.track_title,
    CASE WHEN s.spotify_id IS NULL THEN 'spotify_id' END as missing_spotify,
    CASE WHEN s.bpm IS NULL THEN 'bpm' END as missing_bpm,
    CASE WHEN s.key IS NULL THEN 'key' END as missing_key,
    CASE WHEN s.genre IS NULL THEN 'genre' END as missing_genre
FROM silver_enriched_tracks s
WHERE s.spotify_id IS NULL
   OR s.bpm IS NULL
   OR s.key IS NULL
   OR s.genre IS NULL
LIMIT 20;

-- Trace enrichment path for a specific track
WITH RECURSIVE transformation_tree AS (
    -- Start with silver record
    SELECT
        s.id as silver_id,
        s.bronze_id,
        s.artist_name || ' - ' || s.track_title as track,
        1 as depth
    FROM silver_enriched_tracks s
    WHERE s.id = 'silver-track-id-uuid'::UUID

    UNION ALL

    -- Get all transformations
    SELECT
        tt.silver_id,
        t.bronze_id,
        t.metadata_field || ': ' || t.provider_used || ' (' || t.provider_confidence || ')',
        tt.depth + 1
    FROM transformation_tree tt
    JOIN enrichment_transformations t ON t.silver_id = tt.silver_id
    WHERE tt.depth < 10
)
SELECT
    depth,
    track,
    bronze_id
FROM transformation_tree
ORDER BY depth;
