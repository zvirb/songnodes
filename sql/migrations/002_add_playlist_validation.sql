-- Migration: Add Playlist Validation and Silent Failure Detection
-- Version: 002
-- Date: 2025-10-06
-- Purpose: Prevent silent scraping failures by adding validation columns and constraints

-- ===========================================
-- STEP 1: Add Missing Validation Columns
-- ===========================================

ALTER TABLE playlists
  ADD COLUMN IF NOT EXISTS tracklist_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS scrape_error TEXT,
  ADD COLUMN IF NOT EXISTS last_scrape_attempt TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS parsing_version VARCHAR(50);

-- ===========================================
-- STEP 2: Backfill Existing Playlists
-- ===========================================

-- Calculate tracklist_count from existing playlist_tracks
UPDATE playlists p
SET tracklist_count = COALESCE((
  SELECT COUNT(*)
  FROM playlist_tracks pt
  WHERE pt.playlist_id = p.playlist_id
), 0)
WHERE tracklist_count IS NULL OR tracklist_count = 0;

-- Set last_scrape_attempt to created_at for existing records
UPDATE playlists
SET last_scrape_attempt = created_at
WHERE last_scrape_attempt IS NULL;

-- Mark existing 0-track playlists as potential silent failures
UPDATE playlists
SET scrape_error = 'Legacy record - created before validation was implemented',
    parsing_version = 'pre_validation'
WHERE tracklist_count = 0
  AND scrape_error IS NULL;

-- ===========================================
-- STEP 3: Add Validation Constraints
-- ===========================================

-- Primary validation constraint: Either have tracks OR have an error explanation
ALTER TABLE playlists
  ADD CONSTRAINT chk_tracklist_count_valid
  CHECK (
    (tracklist_count > 0) OR
    (scrape_error IS NOT NULL AND last_scrape_attempt IS NOT NULL)
  );

-- Ensure tracklist_count is never negative
ALTER TABLE playlists
  ADD CONSTRAINT chk_tracklist_count_non_negative
  CHECK (tracklist_count >= 0);

-- ===========================================
-- STEP 4: Create Monitoring Indexes
-- ===========================================

-- Index for finding failed scrapes
CREATE INDEX IF NOT EXISTS idx_playlists_failed_scrapes
  ON playlists(source, last_scrape_attempt DESC)
  WHERE scrape_error IS NOT NULL;

-- Index for finding suspicious 0-track playlists
CREATE INDEX IF NOT EXISTS idx_playlists_zero_tracks_suspicious
  ON playlists(source, created_at DESC)
  WHERE tracklist_count = 0 AND scrape_error IS NULL;

-- Index for monitoring recent scrapes
CREATE INDEX IF NOT EXISTS idx_playlists_recent_scrapes
  ON playlists(source, last_scrape_attempt DESC)
  WHERE last_scrape_attempt IS NOT NULL;

-- Index for finding playlists by parsing version
CREATE INDEX IF NOT EXISTS idx_playlists_parsing_version
  ON playlists(parsing_version)
  WHERE parsing_version IS NOT NULL;

-- ===========================================
-- STEP 5: Create Monitoring Views
-- ===========================================

-- Scraping health view for daily monitoring
CREATE OR REPLACE VIEW v_scraping_health AS
SELECT
  source,
  DATE(created_at) as scrape_date,
  COUNT(*) as total_playlists,
  SUM(CASE WHEN tracklist_count = 0 THEN 1 ELSE 0 END) as zero_track_playlists,
  SUM(CASE WHEN scrape_error IS NOT NULL THEN 1 ELSE 0 END) as error_playlists,
  ROUND(AVG(tracklist_count), 2) as avg_tracks_per_playlist,
  MIN(tracklist_count) as min_tracks,
  MAX(tracklist_count) as max_tracks,
  COUNT(DISTINCT parsing_version) as parsing_versions_used
FROM playlists
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY source, DATE(created_at)
ORDER BY scrape_date DESC, source;

-- Silent failure detection view
CREATE OR REPLACE VIEW v_silent_failures AS
SELECT
  playlist_id,
  name,
  source,
  source_url,
  created_at,
  last_scrape_attempt,
  parsing_version,
  scrape_error
FROM playlists
WHERE tracklist_count = 0
  AND scrape_error IS NOT NULL
  AND created_at >= NOW() - INTERVAL '30 days'
ORDER BY created_at DESC;

-- Parser version performance view
CREATE OR REPLACE VIEW v_parser_performance AS
SELECT
  parsing_version,
  source,
  COUNT(*) as total_playlists,
  SUM(CASE WHEN tracklist_count = 0 THEN 1 ELSE 0 END) as failures,
  ROUND(AVG(tracklist_count), 2) as avg_tracks,
  ROUND(
    100.0 * SUM(CASE WHEN tracklist_count = 0 THEN 1 ELSE 0 END) / COUNT(*),
    2
  ) as failure_rate_percent,
  MIN(created_at) as first_used,
  MAX(created_at) as last_used
FROM playlists
WHERE parsing_version IS NOT NULL
  AND created_at >= NOW() - INTERVAL '30 days'
GROUP BY parsing_version, source
ORDER BY source, failure_rate_percent DESC;

-- ===========================================
-- STEP 6: Create Helper Functions
-- ===========================================

-- Function to detect recent silent failures
CREATE OR REPLACE FUNCTION detect_recent_silent_failures(hours_back INTEGER DEFAULT 24)
RETURNS TABLE(
  playlist_id UUID,
  playlist_name VARCHAR,
  source VARCHAR,
  source_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  error TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.name,
    p.source,
    p.source_url,
    p.created_at,
    p.scrape_error
  FROM playlists p
  WHERE p.tracklist_count = 0
    AND p.scrape_error IS NOT NULL
    AND p.created_at >= NOW() - (hours_back || ' hours')::INTERVAL
  ORDER BY p.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to get scraping health summary
CREATE OR REPLACE FUNCTION get_scraping_health_summary(days_back INTEGER DEFAULT 7)
RETURNS TABLE(
  source VARCHAR,
  total_playlists BIGINT,
  successful_playlists BIGINT,
  failed_playlists BIGINT,
  success_rate_percent NUMERIC,
  avg_tracks_per_playlist NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.source,
    COUNT(*) as total_playlists,
    SUM(CASE WHEN p.tracklist_count > 0 THEN 1 ELSE 0 END) as successful_playlists,
    SUM(CASE WHEN p.tracklist_count = 0 THEN 1 ELSE 0 END) as failed_playlists,
    ROUND(
      100.0 * SUM(CASE WHEN p.tracklist_count > 0 THEN 1 ELSE 0 END) / COUNT(*),
      2
    ) as success_rate_percent,
    ROUND(AVG(CASE WHEN p.tracklist_count > 0 THEN p.tracklist_count ELSE NULL END), 2) as avg_tracks_per_playlist
  FROM playlists p
  WHERE p.created_at >= NOW() - (days_back || ' days')::INTERVAL
  GROUP BY p.source
  ORDER BY success_rate_percent ASC;
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- STEP 7: Add Comments for Documentation
-- ===========================================

COMMENT ON COLUMN playlists.tracklist_count IS 'Number of tracks in playlist. Must be > 0 unless scrape_error is set';
COMMENT ON COLUMN playlists.scrape_error IS 'Error message if scraping failed. Required if tracklist_count = 0';
COMMENT ON COLUMN playlists.last_scrape_attempt IS 'Timestamp of last scraping attempt. Required if scrape_error is set';
COMMENT ON COLUMN playlists.parsing_version IS 'Version of parser used (e.g., mixesdb_v1.0, 1001tracklists_v2.0)';

COMMENT ON VIEW v_scraping_health IS 'Daily scraping health metrics for monitoring dashboard';
COMMENT ON VIEW v_silent_failures IS 'Playlists that failed to extract tracks with error details';
COMMENT ON VIEW v_parser_performance IS 'Performance comparison of different parser versions';

COMMENT ON FUNCTION detect_recent_silent_failures(INTEGER) IS 'Finds playlists with 0 tracks created in last N hours';
COMMENT ON FUNCTION get_scraping_health_summary(INTEGER) IS 'Summary of scraping success rates by source for last N days';

-- ===========================================
-- VERIFICATION QUERIES
-- ===========================================

-- These queries can be used to verify the migration worked correctly:

-- 1. Check constraint is working (should return 0 rows - all playlists should be valid)
-- SELECT * FROM playlists WHERE tracklist_count = 0 AND scrape_error IS NULL;

-- 2. View scraping health for last 7 days
-- SELECT * FROM v_scraping_health ORDER BY scrape_date DESC LIMIT 20;

-- 3. Find recent silent failures
-- SELECT * FROM detect_recent_silent_failures(24);

-- 4. Get health summary
-- SELECT * FROM get_scraping_health_summary(7);

-- 5. Check parser performance
-- SELECT * FROM v_parser_performance;
