-- Database Optimization Scripts for High-Volume Processing
-- Target: 20,000+ tracks/hour, <50ms query time, <100ms API response

-- ===========================================
-- PERFORMANCE CONFIGURATION
-- ===========================================

-- Enable query plan caching
SET shared_preload_libraries = 'pg_stat_statements';

-- Configure automatic statistics collection
ALTER SYSTEM SET track_activities = on;
ALTER SYSTEM SET track_counts = on;
ALTER SYSTEM SET track_io_timing = on;
ALTER SYSTEM SET track_functions = all;

-- Optimize for SSD storage
ALTER SYSTEM SET random_page_cost = 1.1;
ALTER SYSTEM SET seq_page_cost = 1.0;

-- ===========================================
-- MEMORY OPTIMIZATION
-- ===========================================

-- Configure memory settings for high-volume processing
ALTER SYSTEM SET shared_buffers = '2GB';
ALTER SYSTEM SET work_mem = '32MB';
ALTER SYSTEM SET maintenance_work_mem = '512MB';
ALTER SYSTEM SET effective_cache_size = '6GB';

-- ===========================================
-- WAL AND CHECKPOINT OPTIMIZATION
-- ===========================================

-- Optimize WAL for high write loads
ALTER SYSTEM SET wal_buffers = '64MB';
ALTER SYSTEM SET max_wal_size = '4GB';
ALTER SYSTEM SET min_wal_size = '1GB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;

-- ===========================================
-- CONNECTION AND CONCURRENCY OPTIMIZATION
-- ===========================================

-- Optimize for connection pooling
ALTER SYSTEM SET max_connections = 200;

-- Parallel processing optimization
ALTER SYSTEM SET max_parallel_workers = 8;
ALTER SYSTEM SET max_parallel_workers_per_gather = 4;
ALTER SYSTEM SET max_parallel_maintenance_workers = 4;

-- ===========================================
-- AUTOVACUUM OPTIMIZATION FOR HIGH VOLUME
-- ===========================================

-- Aggressive autovacuum for high insert workload
ALTER SYSTEM SET autovacuum = on;
ALTER SYSTEM SET autovacuum_max_workers = 6;
ALTER SYSTEM SET autovacuum_naptime = '30s';
ALTER SYSTEM SET autovacuum_vacuum_threshold = 50;
ALTER SYSTEM SET autovacuum_vacuum_scale_factor = 0.1;
ALTER SYSTEM SET autovacuum_analyze_threshold = 50;
ALTER SYSTEM SET autovacuum_analyze_scale_factor = 0.05;

-- ===========================================
-- LOGGING OPTIMIZATION
-- ===========================================

-- Log slow queries for optimization
ALTER SYSTEM SET log_min_duration_statement = 100;
ALTER SYSTEM SET log_statement = 'mod';
ALTER SYSTEM SET log_checkpoints = on;
ALTER SYSTEM SET log_lock_waits = on;

-- ===========================================
-- TABLE-SPECIFIC OPTIMIZATIONS
-- ===========================================

-- Set autovacuum parameters for high-volume tables
ALTER TABLE tracks SET (
    autovacuum_vacuum_threshold = 100,
    autovacuum_vacuum_scale_factor = 0.05,
    autovacuum_analyze_threshold = 100,
    autovacuum_analyze_scale_factor = 0.025
);

ALTER TABLE setlist_tracks SET (
    autovacuum_vacuum_threshold = 50,
    autovacuum_vacuum_scale_factor = 0.05,
    autovacuum_analyze_threshold = 50,
    autovacuum_analyze_scale_factor = 0.025
);

ALTER TABLE track_artists SET (
    autovacuum_vacuum_threshold = 50,
    autovacuum_vacuum_scale_factor = 0.05,
    autovacuum_analyze_threshold = 50,
    autovacuum_analyze_scale_factor = 0.025
);

-- ===========================================
-- PARTITIONING FOR LARGE TABLES
-- ===========================================

-- Create partitioned table for scraping jobs (by date)
CREATE TABLE scraping_jobs_partitioned (
    LIKE scraping_jobs INCLUDING ALL
) PARTITION BY RANGE (created_at);

-- Create monthly partitions for the current year
DO $$
DECLARE
    start_date date := date_trunc('year', CURRENT_DATE);
    end_date date;
    partition_name text;
BEGIN
    FOR i IN 0..11 LOOP
        end_date := start_date + interval '1 month';
        partition_name := 'scraping_jobs_' || to_char(start_date, 'YYYY_MM');
        
        EXECUTE format('
            CREATE TABLE IF NOT EXISTS %I PARTITION OF scraping_jobs_partitioned
            FOR VALUES FROM (%L) TO (%L)',
            partition_name, start_date, end_date);
        
        start_date := end_date;
    END LOOP;
END $$;

-- ===========================================
-- DUPLICATE DETECTION OPTIMIZATION
-- ===========================================

-- Function for efficient duplicate detection
CREATE OR REPLACE FUNCTION find_duplicate_tracks(
    similarity_threshold DECIMAL DEFAULT 0.95
) RETURNS TABLE (
    track1_id UUID,
    track2_id UUID,
    similarity_score DECIMAL,
    match_type TEXT
) AS $$
BEGIN
    RETURN QUERY
    WITH track_pairs AS (
        SELECT 
            t1.id as track1_id,
            t2.id as track2_id,
            CASE 
                WHEN t1.isrc IS NOT NULL AND t2.isrc IS NOT NULL AND t1.isrc = t2.isrc 
                THEN 1.0
                ELSE similarity(t1.normalized_title, t2.normalized_title)
            END as similarity_score,
            CASE 
                WHEN t1.isrc IS NOT NULL AND t2.isrc IS NOT NULL AND t1.isrc = t2.isrc 
                THEN 'isrc_match'
                WHEN similarity(t1.normalized_title, t2.normalized_title) >= similarity_threshold
                THEN 'title_similarity'
                ELSE 'no_match'
            END as match_type
        FROM tracks t1
        JOIN tracks t2 ON t1.id < t2.id
        WHERE (
            (t1.isrc IS NOT NULL AND t2.isrc IS NOT NULL AND t1.isrc = t2.isrc) OR
            (similarity(t1.normalized_title, t2.normalized_title) >= similarity_threshold)
        )
    )
    SELECT * FROM track_pairs WHERE match_type != 'no_match';
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- DATA QUALITY FUNCTIONS
-- ===========================================

-- Function to identify tracks with missing metadata
CREATE OR REPLACE FUNCTION identify_incomplete_tracks()
RETURNS TABLE (
    track_id UUID,
    title TEXT,
    missing_fields TEXT[]
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.id,
        t.title,
        ARRAY(
            SELECT field_name 
            FROM (
                VALUES 
                    ('spotify_id', t.spotify_id IS NULL),
                    ('genre', t.genre IS NULL),
                    ('release_date', t.release_date IS NULL),
                    ('duration_ms', t.duration_ms IS NULL),
                    ('isrc', t.isrc IS NULL)
            ) AS checks(field_name, is_missing)
            WHERE is_missing
        ) as missing_fields
    FROM tracks t
    WHERE (
        t.spotify_id IS NULL OR
        t.genre IS NULL OR
        t.release_date IS NULL OR
        t.duration_ms IS NULL OR
        t.isrc IS NULL
    );
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- PERFORMANCE MONITORING FUNCTIONS
-- ===========================================

-- Function to analyze query performance
CREATE OR REPLACE FUNCTION analyze_query_performance()
RETURNS TABLE (
    query_text TEXT,
    calls BIGINT,
    total_time_ms NUMERIC,
    mean_time_ms NUMERIC,
    stddev_time_ms NUMERIC,
    rows BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        query,
        calls,
        total_exec_time as total_time_ms,
        mean_exec_time as mean_time_ms,
        stddev_exec_time as stddev_time_ms,
        rows
    FROM pg_stat_statements
    WHERE calls > 10
    ORDER BY total_exec_time DESC
    LIMIT 20;
END;
$$ LANGUAGE plpgsql;

-- Function to check index usage
CREATE OR REPLACE FUNCTION check_index_usage()
RETURNS TABLE (
    schemaname TEXT,
    tablename TEXT,
    indexname TEXT,
    idx_scan BIGINT,
    idx_tup_read BIGINT,
    idx_tup_fetch BIGINT,
    usage_ratio NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.schemaname,
        s.tablename,
        s.indexname,
        s.idx_scan,
        s.idx_tup_read,
        s.idx_tup_fetch,
        CASE 
            WHEN s.idx_scan = 0 THEN 0 
            ELSE ROUND((s.idx_tup_fetch::NUMERIC / s.idx_scan), 2) 
        END as usage_ratio
    FROM pg_stat_user_indexes s
    JOIN pg_index i ON s.indexrelid = i.indexrelid
    WHERE s.schemaname = 'musicdb'
    ORDER BY s.idx_scan DESC;
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- BULK PROCESSING OPTIMIZATION
-- ===========================================

-- Function for efficient bulk track insertion
CREATE OR REPLACE FUNCTION bulk_insert_tracks(
    track_data JSONB[]
) RETURNS TABLE (
    inserted_count INTEGER,
    skipped_count INTEGER,
    error_count INTEGER
) AS $$
DECLARE
    inserted_cnt INTEGER := 0;
    skipped_cnt INTEGER := 0;
    error_cnt INTEGER := 0;
    track_item JSONB;
BEGIN
    -- Disable autovacuum temporarily for bulk operations
    SET LOCAL autovacuum_enabled = off;
    
    FOREACH track_item IN ARRAY track_data
    LOOP
        BEGIN
            INSERT INTO tracks (
                title, normalized_title, spotify_id, genre, 
                release_date, duration_ms, isrc, metadata
            )
            SELECT 
                track_item->>'title',
                normalize_text(track_item->>'title'),
                track_item->>'spotify_id',
                track_item->>'genre',
                (track_item->>'release_date')::DATE,
                (track_item->>'duration_ms')::INTEGER,
                track_item->>'isrc',
                track_item->'metadata'
            WHERE NOT EXISTS (
                SELECT 1 FROM tracks 
                WHERE (track_item->>'isrc' IS NOT NULL AND isrc = track_item->>'isrc')
                   OR (track_item->>'spotify_id' IS NOT NULL AND spotify_id = track_item->>'spotify_id')
            );
            
            IF FOUND THEN
                inserted_cnt := inserted_cnt + 1;
            ELSE
                skipped_cnt := skipped_cnt + 1;
            END IF;
            
        EXCEPTION WHEN OTHERS THEN
            error_cnt := error_cnt + 1;
            -- Log the error but continue processing
            INSERT INTO data_quality_issues (
                entity_type, issue_type, severity, description
            ) VALUES (
                'track', 'bulk_insert_error', 'medium',
                'Error inserting track: ' || SQLERRM
            );
        END;
    END LOOP;
    
    RETURN QUERY SELECT inserted_cnt, skipped_cnt, error_cnt;
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- MAINTENANCE PROCEDURES
-- ===========================================

-- Procedure to refresh all materialized views
CREATE OR REPLACE PROCEDURE refresh_all_materialized_views()
LANGUAGE plpgsql AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY popular_tracks;
    REFRESH MATERIALIZED VIEW CONCURRENTLY artist_collaborations;
    
    -- Update table statistics
    ANALYZE tracks;
    ANALYZE artists;
    ANALYZE setlist_tracks;
    ANALYZE setlists;
    
    RAISE NOTICE 'All materialized views refreshed at %', CURRENT_TIMESTAMP;
END $$;

-- Procedure to cleanup old data
CREATE OR REPLACE PROCEDURE cleanup_old_data(
    retention_days INTEGER DEFAULT 90
)
LANGUAGE plpgsql AS $$
BEGIN
    -- Clean up old scraping jobs
    DELETE FROM scraping_jobs 
    WHERE created_at < CURRENT_DATE - retention_days * INTERVAL '1 day'
    AND status IN ('completed', 'failed');
    
    -- Clean up resolved data quality issues
    DELETE FROM data_quality_issues
    WHERE is_resolved = TRUE 
    AND resolved_at < CURRENT_DATE - retention_days * INTERVAL '1 day';
    
    RAISE NOTICE 'Cleanup completed at %', CURRENT_TIMESTAMP;
END $$;

-- ===========================================
-- APPLY CONFIGURATION
-- ===========================================

-- Reload configuration to apply changes
SELECT pg_reload_conf();

-- Initial statistics collection
ANALYZE;