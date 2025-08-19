-- Enhanced Performance Indexes for High-Volume Music Data Processing
-- Optimized for 20,000+ tracks/hour processing target

-- ===========================================
-- COMPOSITE INDEXES FOR COMMON QUERY PATTERNS
-- ===========================================

-- Track queries by artist and genre
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tracks_artist_genre 
ON tracks(genre, release_date DESC) 
WHERE genre IS NOT NULL;

-- Track queries by date range and genre
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tracks_date_genre_composite 
ON tracks(release_date DESC, genre, normalized_title) 
WHERE release_date IS NOT NULL;

-- Setlist track queries with performance stats
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_setlist_tracks_performance 
ON setlist_tracks(track_id, transition_rating DESC, bpm_live) 
WHERE track_id IS NOT NULL;

-- Artist collaboration queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_track_artists_collaboration 
ON track_artists(track_id, role, artist_id) 
WHERE role IN ('primary', 'featured');

-- ===========================================
-- PARTIAL INDEXES FOR DATA QUALITY
-- ===========================================

-- Tracks with missing metadata
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tracks_missing_spotify 
ON tracks(normalized_title, created_at DESC) 
WHERE spotify_id IS NULL;

-- Tracks with missing genre information
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tracks_missing_genre 
ON tracks(normalized_title, release_date DESC) 
WHERE genre IS NULL;

-- Unresolved track IDs in setlists
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_setlist_tracks_unresolved 
ON setlist_tracks(id_text, setlist_id) 
WHERE is_id = TRUE AND track_id IS NULL;

-- Duplicate detection indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tracks_duplicate_detection 
ON tracks(normalized_title, duration_ms, isrc) 
WHERE isrc IS NOT NULL;

-- ===========================================
-- PERFORMANCE INDEXES FOR MATERIALIZED VIEWS
-- ===========================================

-- Popular tracks by genre
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tracks_genre_popularity 
ON tracks(genre, normalized_title) 
WHERE genre IS NOT NULL;

-- Artist popularity metrics
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_artists_popularity_metrics 
ON artists(normalized_name, created_at DESC);

-- Setlist frequency analysis
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_setlists_frequency_analysis 
ON setlists(set_date DESC, performer_id, source) 
WHERE set_date IS NOT NULL;

-- ===========================================
-- COVERING INDEXES FOR COMMON QUERIES
-- ===========================================

-- Track search with metadata
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tracks_search_covering 
ON tracks(normalized_title, genre, release_date, spotify_id, duration_ms) 
WHERE spotify_id IS NOT NULL;

-- Artist search with track count
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_artists_search_covering 
ON artists(normalized_name, spotify_id, created_at);

-- Setlist browsing with track info
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_setlist_browsing 
ON setlist_tracks(setlist_id, position, track_id, transition_rating);

-- ===========================================
-- HASH INDEXES FOR EXACT MATCHES
-- ===========================================

-- External ID lookups (faster for exact matches)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tracks_spotify_hash 
ON tracks USING hash(spotify_id) 
WHERE spotify_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_artists_spotify_hash 
ON artists USING hash(spotify_id) 
WHERE spotify_id IS NOT NULL;

-- Source ID lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_setlists_source_hash 
ON setlists USING hash(source_id) 
WHERE source_id IS NOT NULL;

-- ===========================================
-- EXPRESSION INDEXES FOR COMPUTED QUERIES
-- ===========================================

-- Year-based queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tracks_release_year 
ON tracks(EXTRACT(YEAR FROM release_date), genre) 
WHERE release_date IS NOT NULL;

-- Duration-based categories
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tracks_duration_category 
ON tracks(
    CASE 
        WHEN duration_ms < 180000 THEN 'short'
        WHEN duration_ms < 300000 THEN 'medium'
        ELSE 'long'
    END,
    genre
) WHERE duration_ms IS NOT NULL;

-- Artist name length for normalization analysis
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_artists_name_length 
ON artists(LENGTH(name), normalized_name) 
WHERE LENGTH(name) > 50;

-- ===========================================
-- SPECIALIZED INDEXES FOR HIGH-FREQUENCY OPERATIONS
-- ===========================================

-- Bulk insert optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tracks_bulk_processing 
ON tracks(created_at DESC, id) 
WHERE created_at > CURRENT_DATE - INTERVAL '7 days';

-- Data validation queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_data_quality_active 
ON data_quality_issues(entity_type, severity, created_at DESC) 
WHERE is_resolved = FALSE;

-- Scraping job monitoring
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_scraping_jobs_monitoring 
ON scraping_jobs(status, created_at DESC, source) 
WHERE status IN ('running', 'pending', 'failed');

-- ===========================================
-- GIN INDEXES FOR ARRAY AND JSONB OPERATIONS
-- ===========================================

-- Artist aliases search
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_artists_aliases_gin 
ON artists USING gin(aliases) 
WHERE aliases IS NOT NULL AND array_length(aliases, 1) > 0;

-- Track metadata advanced search
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tracks_metadata_advanced 
ON tracks USING gin(metadata jsonb_path_ops) 
WHERE metadata != '{}'::jsonb;

-- Mashup components search
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tracks_mashup_gin 
ON tracks USING gin(mashup_components jsonb_path_ops) 
WHERE is_mashup = TRUE;

-- Setlist metadata search
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_setlists_metadata_gin 
ON setlists USING gin(metadata jsonb_path_ops) 
WHERE metadata != '{}'::jsonb;

-- ===========================================
-- PERFORMANCE MONITORING INDEXES
-- ===========================================

-- Query performance tracking
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tracks_performance_tracking 
ON tracks(updated_at DESC, id) 
WHERE updated_at > CURRENT_TIMESTAMP - INTERVAL '1 hour';

-- Connection monitoring
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_setlist_tracks_connection_monitoring 
ON setlist_tracks(created_at DESC, setlist_id) 
WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '15 minutes';

-- ===========================================
-- CLUSTERING FOR PHYSICAL OPTIMIZATION
-- ===========================================

-- Cluster frequently accessed tables by most common access pattern
-- (Run these during maintenance windows)

-- Note: CLUSTER commands commented out as they require maintenance window
-- CLUSTER tracks USING idx_tracks_normalized_title;
-- CLUSTER artists USING idx_artists_normalized_name;
-- CLUSTER setlist_tracks USING idx_setlist_tracks_setlist_id;

-- ===========================================
-- INDEX MAINTENANCE FUNCTIONS
-- ===========================================

-- Function to refresh materialized views efficiently
CREATE OR REPLACE FUNCTION refresh_performance_views()
RETURNS void AS $$
BEGIN
    -- Refresh materialized views concurrently
    REFRESH MATERIALIZED VIEW CONCURRENTLY popular_tracks;
    REFRESH MATERIALIZED VIEW CONCURRENTLY artist_collaborations;
    
    -- Update table statistics
    ANALYZE tracks;
    ANALYZE artists;
    ANALYZE setlist_tracks;
    ANALYZE setlists;
    
    -- Log completion
    RAISE NOTICE 'Performance views refreshed at %', CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;