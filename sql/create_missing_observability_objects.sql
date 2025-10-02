-- =====================================================================
-- Create Missing Database Objects for REST API Observability Endpoints
-- =====================================================================
-- This script creates the data_quality_metrics table and
-- scraping_run_summary view that are required by the REST API
-- =====================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================================
-- 1. Create data_quality_metrics table
-- =====================================================================
-- This table stores data quality metrics for pipeline observability
-- Used by endpoint: /api/v1/observability/runs/{run_id}/quality

CREATE TABLE IF NOT EXISTS data_quality_metrics (
    quality_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID REFERENCES scraping_runs(run_id) ON DELETE CASCADE,
    pillar VARCHAR(50) NOT NULL, -- 'freshness', 'volume', 'schema', 'distribution', 'lineage'
    metric_name VARCHAR(100) NOT NULL,
    expected_value NUMERIC(10,2),
    actual_value NUMERIC(10,2) NOT NULL,
    quality_score NUMERIC(5,2) NOT NULL, -- 0-100 quality score
    threshold_min NUMERIC(10,2),
    threshold_max NUMERIC(10,2),
    status VARCHAR(20) NOT NULL, -- 'pass', 'warning', 'fail'
    measured_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Indexes for performance
    CONSTRAINT chk_quality_score CHECK (quality_score >= 0 AND quality_score <= 100),
    CONSTRAINT chk_status CHECK (status IN ('pass', 'warning', 'fail'))
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_data_quality_metrics_run_id ON data_quality_metrics(run_id);
CREATE INDEX IF NOT EXISTS idx_data_quality_metrics_pillar ON data_quality_metrics(pillar);
CREATE INDEX IF NOT EXISTS idx_data_quality_metrics_measured_at ON data_quality_metrics(measured_at DESC);
CREATE INDEX IF NOT EXISTS idx_data_quality_metrics_status ON data_quality_metrics(status);

-- =====================================================================
-- 2. Create supporting tables needed by scraping_run_summary view
-- =====================================================================

-- Source extraction log table (if it doesn't exist)
CREATE TABLE IF NOT EXISTS source_extraction_log (
    extraction_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID REFERENCES scraping_runs(run_id) ON DELETE CASCADE,
    source_url TEXT NOT NULL,
    website_domain VARCHAR(255) NOT NULL,
    scraper_used VARCHAR(50) NOT NULL,
    http_status_code INTEGER,
    response_time_ms INTEGER,
    success BOOLEAN DEFAULT false,
    error_message TEXT,
    extracted_elements JSONB,
    retry_count INTEGER DEFAULT 0,
    extraction_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_source_extraction_log_run_id ON source_extraction_log(run_id);
CREATE INDEX IF NOT EXISTS idx_source_extraction_log_domain ON source_extraction_log(website_domain);
CREATE INDEX IF NOT EXISTS idx_source_extraction_log_timestamp ON source_extraction_log(extraction_timestamp DESC);

-- Graph validation results table (if it doesn't exist)
CREATE TABLE IF NOT EXISTS graph_validation_results (
    validation_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID REFERENCES scraping_runs(run_id) ON DELETE CASCADE,
    playlist_id UUID,
    expected_nodes INTEGER NOT NULL,
    actual_nodes INTEGER NOT NULL,
    expected_edges INTEGER NOT NULL,
    actual_edges INTEGER NOT NULL,
    same_artist_exceptions INTEGER DEFAULT 0,
    validation_passed BOOLEAN DEFAULT false,
    validation_message TEXT,
    validation_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_graph_validation_results_run_id ON graph_validation_results(run_id);
CREATE INDEX IF NOT EXISTS idx_graph_validation_results_timestamp ON graph_validation_results(validation_timestamp DESC);

-- Anomaly detection table (if it doesn't exist)
CREATE TABLE IF NOT EXISTS anomaly_detection (
    anomaly_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID REFERENCES scraping_runs(run_id) ON DELETE CASCADE,
    anomaly_type VARCHAR(50) NOT NULL, -- 'volume_spike', 'quality_drop', 'rate_anomaly', etc.
    severity VARCHAR(20) NOT NULL, -- 'critical', 'warning', 'info'
    metric_name VARCHAR(100) NOT NULL,
    expected_range_min NUMERIC(10,2),
    expected_range_max NUMERIC(10,2),
    actual_value NUMERIC(10,2) NOT NULL,
    confidence_score NUMERIC(5,2), -- 0-100
    description TEXT NOT NULL,
    suggested_actions JSONB, -- Array of suggested remediation actions
    detection_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    acknowledged BOOLEAN DEFAULT false,
    acknowledged_by VARCHAR(100),
    acknowledged_at TIMESTAMP,

    CONSTRAINT chk_anomaly_severity CHECK (severity IN ('critical', 'warning', 'info')),
    CONSTRAINT chk_anomaly_confidence CHECK (confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 100))
);

CREATE INDEX IF NOT EXISTS idx_anomaly_detection_run_id ON anomaly_detection(run_id);
CREATE INDEX IF NOT EXISTS idx_anomaly_detection_severity ON anomaly_detection(severity);
CREATE INDEX IF NOT EXISTS idx_anomaly_detection_timestamp ON anomaly_detection(detection_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_anomaly_detection_acknowledged ON anomaly_detection(acknowledged);

-- =====================================================================
-- 3. Create scraping_run_summary view
-- =====================================================================
-- This view aggregates data from multiple observability tables to provide
-- a comprehensive summary of each scraping run
-- Used by endpoints:
--   - /api/v1/observability/runs
--   - /api/v1/observability/runs/{run_id}

CREATE OR REPLACE VIEW scraping_run_summary AS
SELECT
    sr.run_id::text as run_id,
    sr.scraper_name,
    sr.start_time,
    sr.end_time,
    sr.status,
    sr.tracks_searched,
    sr.playlists_found,
    sr.songs_added,
    sr.artists_added,
    sr.errors_count,

    -- Average quality score from data_quality_metrics
    COALESCE(
        (SELECT AVG(quality_score)::numeric(5,2)
         FROM data_quality_metrics dqm
         WHERE dqm.run_id = sr.run_id),
        NULL
    ) as avg_quality_score,

    -- Count of quality issues (warnings + failures)
    COALESCE(
        (SELECT COUNT(*)::int
         FROM data_quality_metrics dqm
         WHERE dqm.run_id = sr.run_id
         AND dqm.status IN ('warning', 'fail')),
        0
    ) as quality_issues,

    -- Count of playlists validated
    COALESCE(
        (SELECT COUNT(*)::int
         FROM graph_validation_results gvr
         WHERE gvr.run_id = sr.run_id),
        0
    ) as playlists_validated,

    -- Count of validation failures
    COALESCE(
        (SELECT COUNT(*)::int
         FROM graph_validation_results gvr
         WHERE gvr.run_id = sr.run_id
         AND gvr.validation_passed = false),
        0
    ) as validation_failures,

    -- Count of sources attempted
    COALESCE(
        (SELECT COUNT(*)::int
         FROM source_extraction_log sel
         WHERE sel.run_id = sr.run_id),
        0
    ) as sources_attempted,

    -- Count of successful source extractions
    COALESCE(
        (SELECT COUNT(*)::int
         FROM source_extraction_log sel
         WHERE sel.run_id = sr.run_id
         AND sel.success = true),
        0
    ) as sources_successful,

    -- Average response time from source extractions
    COALESCE(
        (SELECT AVG(response_time_ms)::numeric(10,2)
         FROM source_extraction_log sel
         WHERE sel.run_id = sr.run_id
         AND sel.response_time_ms IS NOT NULL),
        NULL
    ) as avg_response_time_ms,

    -- Count of critical anomalies
    COALESCE(
        (SELECT COUNT(*)::int
         FROM anomaly_detection ad
         WHERE ad.run_id = sr.run_id
         AND ad.severity = 'critical'),
        0
    ) as critical_anomalies,

    -- Count of warning anomalies
    COALESCE(
        (SELECT COUNT(*)::int
         FROM anomaly_detection ad
         WHERE ad.run_id = sr.run_id
         AND ad.severity = 'warning'),
        0
    ) as warning_anomalies

FROM scraping_runs sr;

-- =====================================================================
-- 4. Create additional views needed by other observability endpoints
-- =====================================================================

-- Pipeline health dashboard view (aggregated by time bucket)
CREATE OR REPLACE VIEW pipeline_health_dashboard AS
SELECT
    DATE_TRUNC('hour', sr.start_time) as time_bucket,
    COUNT(*)::int as total_runs,
    COUNT(*) FILTER (WHERE sr.status = 'completed')::int as successful_runs,
    COUNT(*) FILTER (WHERE sr.status = 'failed')::int as failed_runs,
    AVG(EXTRACT(EPOCH FROM (sr.end_time - sr.start_time)))::numeric(10,2) as avg_duration_seconds,
    SUM(sr.songs_added)::int as total_songs_added,
    SUM(sr.artists_added)::int as total_artists_added,
    AVG(
        (SELECT AVG(quality_score)
         FROM data_quality_metrics dqm
         WHERE dqm.run_id = sr.run_id)
    )::numeric(5,2) as avg_quality_score,
    SUM(
        (SELECT COUNT(*)
         FROM anomaly_detection ad
         WHERE ad.run_id = sr.run_id
         AND ad.severity = 'critical')
    )::int as total_critical_anomalies
FROM scraping_runs sr
WHERE sr.start_time IS NOT NULL
GROUP BY DATE_TRUNC('hour', sr.start_time)
ORDER BY time_bucket DESC;

-- Graph impact analysis view (tracks new nodes and edges added)
CREATE TABLE IF NOT EXISTS graph_impact_analysis (
    analysis_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID REFERENCES scraping_runs(run_id) ON DELETE CASCADE,
    new_nodes_added INTEGER DEFAULT 0,
    new_edges_added INTEGER DEFAULT 0,
    nodes_updated INTEGER DEFAULT 0,
    edges_updated INTEGER DEFAULT 0,
    graph_density_before NUMERIC(10,6),
    graph_density_after NUMERIC(10,6),
    clustering_coefficient NUMERIC(10,6),
    analysis_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_graph_impact_analysis_run_id ON graph_impact_analysis(run_id);
CREATE INDEX IF NOT EXISTS idx_graph_impact_analysis_timestamp ON graph_impact_analysis(analysis_timestamp DESC);

-- =====================================================================
-- 5. Grant permissions to musicdb_user
-- =====================================================================

GRANT ALL PRIVILEGES ON TABLE data_quality_metrics TO musicdb_user;
GRANT ALL PRIVILEGES ON TABLE source_extraction_log TO musicdb_user;
GRANT ALL PRIVILEGES ON TABLE graph_validation_results TO musicdb_user;
GRANT ALL PRIVILEGES ON TABLE anomaly_detection TO musicdb_user;
GRANT ALL PRIVILEGES ON TABLE graph_impact_analysis TO musicdb_user;

GRANT SELECT ON scraping_run_summary TO musicdb_user;
GRANT SELECT ON pipeline_health_dashboard TO musicdb_user;

-- =====================================================================
-- 6. Insert sample/initial data (optional - for testing)
-- =====================================================================

-- This section can be uncommented if you want to insert test data
/*
-- Insert a sample scraping run
INSERT INTO scraping_runs (run_id, scraper_name, status, songs_added, artists_added)
VALUES (uuid_generate_v4(), 'test_scraper', 'completed', 100, 25);

-- Insert sample quality metrics
INSERT INTO data_quality_metrics (pillar, metric_name, actual_value, quality_score, status)
VALUES
    ('volume', 'tracks_per_hour', 100.0, 95.0, 'pass'),
    ('schema', 'completeness_pct', 85.0, 85.0, 'warning');
*/

-- =====================================================================
-- COMPLETION MESSAGE
-- =====================================================================

DO $$
BEGIN
    RAISE NOTICE '✅ Successfully created missing database objects:';
    RAISE NOTICE '   - data_quality_metrics table';
    RAISE NOTICE '   - scraping_run_summary view';
    RAISE NOTICE '   - source_extraction_log table';
    RAISE NOTICE '   - graph_validation_results table';
    RAISE NOTICE '   - anomaly_detection table';
    RAISE NOTICE '   - pipeline_health_dashboard view';
    RAISE NOTICE '   - graph_impact_analysis table';
END $$;
