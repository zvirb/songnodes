-- 08-extraction-tracking.sql
-- Database schema for tracking extraction methods used by scrapers
-- Part of NLP fallback redundancy implementation
-- This allows monitoring which extraction methods are successful/failing

-- Add extraction method tracking columns to playlists table
ALTER TABLE playlists
ADD COLUMN IF NOT EXISTS extraction_method VARCHAR(20),
ADD COLUMN IF NOT EXISTS extraction_confidence FLOAT DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS extraction_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Create index for extraction method queries
CREATE INDEX IF NOT EXISTS idx_playlists_extraction_method
ON playlists(extraction_method);

-- Create index for extraction confidence queries (for data quality monitoring)
CREATE INDEX IF NOT EXISTS idx_playlists_extraction_confidence
ON playlists(extraction_confidence);

-- Create a dedicated table for extraction method statistics
CREATE TABLE IF NOT EXISTS extraction_method_stats (
    id SERIAL PRIMARY KEY,
    scraper_name VARCHAR(50) NOT NULL,
    extraction_method VARCHAR(50) NOT NULL,
    success_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    avg_tracks_extracted FLOAT DEFAULT 0.0,
    last_used TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(scraper_name, extraction_method)
);

-- Create indexes for extraction stats
CREATE INDEX IF NOT EXISTS idx_extraction_stats_scraper
ON extraction_method_stats(scraper_name);

CREATE INDEX IF NOT EXISTS idx_extraction_stats_method
ON extraction_method_stats(extraction_method);

CREATE INDEX IF NOT EXISTS idx_extraction_stats_last_used
ON extraction_method_stats(last_used DESC);

-- Create view for extraction method effectiveness
CREATE OR REPLACE VIEW extraction_method_effectiveness AS
SELECT
    scraper_name,
    extraction_method,
    success_count,
    failure_count,
    ROUND(
        (success_count::FLOAT / NULLIF(success_count + failure_count, 0)) * 100,
        2
    ) as success_rate_pct,
    avg_tracks_extracted,
    last_used,
    CASE
        WHEN extraction_method = 'api' THEN 1.0
        WHEN extraction_method = 'json' THEN 0.95
        WHEN extraction_method = 'structured_html' THEN 0.9
        WHEN extraction_method = 'nlp' THEN 0.7
        WHEN extraction_method = 'regex' THEN 0.5
        ELSE 0.5
    END as expected_confidence
FROM extraction_method_stats
ORDER BY scraper_name, success_rate_pct DESC;

-- Function to update extraction stats
CREATE OR REPLACE FUNCTION update_extraction_stats(
    p_scraper_name VARCHAR(50),
    p_extraction_method VARCHAR(50),
    p_success BOOLEAN,
    p_tracks_count INTEGER DEFAULT 0
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO extraction_method_stats (
        scraper_name,
        extraction_method,
        success_count,
        failure_count,
        avg_tracks_extracted,
        last_used,
        updated_at
    ) VALUES (
        p_scraper_name,
        p_extraction_method,
        CASE WHEN p_success THEN 1 ELSE 0 END,
        CASE WHEN p_success THEN 0 ELSE 1 END,
        p_tracks_count,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    )
    ON CONFLICT (scraper_name, extraction_method) DO UPDATE SET
        success_count = extraction_method_stats.success_count + CASE WHEN p_success THEN 1 ELSE 0 END,
        failure_count = extraction_method_stats.failure_count + CASE WHEN p_success THEN 0 ELSE 1 END,
        avg_tracks_extracted = (
            (extraction_method_stats.avg_tracks_extracted * (extraction_method_stats.success_count + extraction_method_stats.failure_count) + p_tracks_count)
            / (extraction_method_stats.success_count + extraction_method_stats.failure_count + 1)
        ),
        last_used = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- Create view for recent extraction failures (for debugging)
CREATE OR REPLACE VIEW recent_extraction_failures AS
SELECT
    p.id,
    p.name as playlist_name,
    p.source_url,
    p.platform,
    p.extraction_method,
    p.extraction_confidence,
    p.extraction_timestamp,
    COUNT(pt.id) as tracks_count
FROM playlists p
LEFT JOIN playlist_tracks pt ON p.id = pt.playlist_id
WHERE p.extraction_confidence < 0.8
  OR p.extraction_method IN ('regex', 'nlp')
GROUP BY p.id, p.name, p.source_url, p.platform, p.extraction_method, p.extraction_confidence, p.extraction_timestamp
ORDER BY p.extraction_timestamp DESC
LIMIT 100;

-- Create view for scraper health monitoring
CREATE OR REPLACE VIEW scraper_health_summary AS
SELECT
    scraper_name,
    COUNT(*) as total_attempts,
    SUM(success_count) as total_successes,
    SUM(failure_count) as total_failures,
    ROUND(
        (SUM(success_count)::FLOAT / NULLIF(SUM(success_count + failure_count), 0)) * 100,
        2
    ) as overall_success_rate_pct,
    MAX(last_used) as last_activity,
    STRING_AGG(DISTINCT extraction_method, ', ' ORDER BY extraction_method) as methods_used
FROM extraction_method_stats
GROUP BY scraper_name
ORDER BY overall_success_rate_pct DESC;

-- Add comment describing the purpose
COMMENT ON TABLE extraction_method_stats IS
'Tracks success/failure rates of different extraction methods (API, NLP, regex) for each scraper to monitor fallback effectiveness';

COMMENT ON COLUMN playlists.extraction_method IS
'Method used to extract this playlist: api, json, structured_html, nlp, regex, manual';

COMMENT ON COLUMN playlists.extraction_confidence IS
'Confidence score (0-1) for the extraction method used, affects data quality metrics';

COMMENT ON VIEW extraction_method_effectiveness IS
'Shows success rates and effectiveness of each extraction method per scraper';

COMMENT ON VIEW scraper_health_summary IS
'Overall health status of each scraper including success rates and methods used';