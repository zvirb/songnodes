-- Enhanced Observability Schema for SongNodes Pipeline
-- Based on 2025 Data Pipeline Observability Best Practices
-- Implements the 5 pillars: Freshness, Volume, Schema, Distribution, Lineage

-- =====================================================
-- PIPELINE METRICS & OBSERVABILITY TABLES
-- =====================================================

-- Enhanced pipeline execution metrics
CREATE TABLE IF NOT EXISTS pipeline_execution_metrics (
    metric_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID REFERENCES scraping_runs(run_id) ON DELETE CASCADE,
    stage VARCHAR(50) NOT NULL, -- ingestion, transformation, validation, loading
    metric_name VARCHAR(100) NOT NULL, -- throughput, latency, error_rate, etc.
    metric_value DECIMAL(15,6) NOT NULL,
    metric_unit VARCHAR(20) NOT NULL, -- ms, records/sec, percentage, count
    measurement_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    tags JSONB DEFAULT '{}', -- Additional metadata tags

    INDEX(run_id, stage),
    INDEX(metric_name, measurement_timestamp)
);

-- Data lineage tracking - tracks data flow through pipeline
CREATE TABLE IF NOT EXISTS data_lineage (
    lineage_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID REFERENCES scraping_runs(run_id) ON DELETE CASCADE,
    source_type VARCHAR(50) NOT NULL, -- url, api, file, database
    source_identifier TEXT NOT NULL, -- actual URL, file path, etc.
    source_checksum VARCHAR(64), -- for detecting changes
    extraction_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    records_extracted INTEGER DEFAULT 0,
    records_processed INTEGER DEFAULT 0,
    records_loaded INTEGER DEFAULT 0,
    processing_metadata JSONB DEFAULT '{}',

    INDEX(run_id),
    INDEX(source_type, extraction_timestamp)
);

-- Graph structure validation results
CREATE TABLE IF NOT EXISTS graph_validation_results (
    validation_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID REFERENCES scraping_runs(run_id) ON DELETE CASCADE,
    playlist_id UUID REFERENCES playlists(playlist_id) ON DELETE CASCADE,
    expected_nodes INTEGER NOT NULL,
    actual_nodes INTEGER NOT NULL,
    expected_edges INTEGER NOT NULL, -- expected_nodes - 1 (minus same-artist exceptions)
    actual_edges INTEGER NOT NULL,
    same_artist_exceptions INTEGER DEFAULT 0,
    validation_passed BOOLEAN NOT NULL,
    validation_message TEXT,
    validation_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX(run_id, validation_passed),
    INDEX(playlist_id)
);

-- Data quality metrics per the 5 pillars
CREATE TABLE IF NOT EXISTS data_quality_metrics (
    quality_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID REFERENCES scraping_runs(run_id) ON DELETE CASCADE,
    pillar VARCHAR(20) NOT NULL CHECK (pillar IN ('freshness', 'volume', 'schema', 'distribution', 'lineage')),
    metric_name VARCHAR(100) NOT NULL,
    expected_value DECIMAL(15,6),
    actual_value DECIMAL(15,6) NOT NULL,
    quality_score DECIMAL(5,4) NOT NULL CHECK (quality_score >= 0 AND quality_score <= 1),
    threshold_min DECIMAL(15,6),
    threshold_max DECIMAL(15,6),
    status VARCHAR(20) NOT NULL CHECK (status IN ('pass', 'warn', 'fail')),
    measured_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX(run_id, pillar),
    INDEX(metric_name, measured_at)
);

-- Source tracking - detailed information about what was scraped
CREATE TABLE IF NOT EXISTS source_extraction_log (
    extraction_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID REFERENCES scraping_runs(run_id) ON DELETE CASCADE,
    source_url TEXT NOT NULL,
    website_domain VARCHAR(100) NOT NULL,
    scraper_used VARCHAR(50) NOT NULL,
    http_status_code INTEGER,
    response_time_ms INTEGER,
    content_length INTEGER,
    extraction_method VARCHAR(50), -- css_selector, api, xpath, llm_assisted
    success BOOLEAN NOT NULL DEFAULT FALSE,
    error_message TEXT,
    extracted_elements JSONB DEFAULT '{}', -- what elements were successfully extracted
    retry_count INTEGER DEFAULT 0,
    extraction_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX(run_id, website_domain),
    INDEX(source_url, extraction_timestamp),
    INDEX(success, extraction_timestamp)
);

-- Track impact of new data on existing graph relationships
CREATE TABLE IF NOT EXISTS graph_impact_analysis (
    impact_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID REFERENCES scraping_runs(run_id) ON DELETE CASCADE,
    analysis_type VARCHAR(50) NOT NULL, -- node_centrality, edge_strength, community_detection
    entity_type VARCHAR(20) NOT NULL CHECK (entity_type IN ('song', 'artist', 'adjacency')),
    entity_id UUID NOT NULL, -- song_id, artist_id, or adjacency composite key
    metric_name VARCHAR(100) NOT NULL, -- betweenness_centrality, closeness_centrality, occurrence_count
    value_before DECIMAL(15,6),
    value_after DECIMAL(15,6) NOT NULL,
    change_magnitude DECIMAL(15,6),
    change_percentage DECIMAL(8,4),
    significance_level VARCHAR(20) CHECK (significance_level IN ('low', 'medium', 'high', 'critical')),
    analysis_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX(run_id, entity_type),
    INDEX(analysis_type, analysis_timestamp)
);

-- Anomaly detection results
CREATE TABLE IF NOT EXISTS anomaly_detection (
    anomaly_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID REFERENCES scraping_runs(run_id) ON DELETE CASCADE,
    anomaly_type VARCHAR(50) NOT NULL, -- volume_spike, quality_drop, pattern_break
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
    metric_name VARCHAR(100) NOT NULL,
    expected_range_min DECIMAL(15,6),
    expected_range_max DECIMAL(15,6),
    actual_value DECIMAL(15,6) NOT NULL,
    confidence_score DECIMAL(5,4) NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
    description TEXT NOT NULL,
    suggested_actions JSONB DEFAULT '[]',
    detection_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_by VARCHAR(100),
    acknowledged_at TIMESTAMP,

    INDEX(run_id, severity),
    INDEX(anomaly_type, detection_timestamp),
    INDEX(acknowledged, severity)
);

-- =====================================================
-- VIEWS FOR EASY QUERYING
-- =====================================================

-- Comprehensive scraping run summary view
CREATE OR REPLACE VIEW scraping_run_summary AS
SELECT
    sr.run_id,
    sr.scraper_name,
    sr.start_time,
    sr.end_time,
    sr.status,
    sr.tracks_searched,
    sr.playlists_found,
    sr.songs_added,
    sr.artists_added,
    sr.errors_count,

    -- Quality metrics aggregation
    COALESCE(dq.avg_quality_score, 0) as avg_quality_score,
    COALESCE(dq.quality_issues, 0) as quality_issues,

    -- Graph validation summary
    COALESCE(gv.total_playlists_validated, 0) as playlists_validated,
    COALESCE(gv.validation_failures, 0) as validation_failures,

    -- Source tracking summary
    COALESCE(sel.sources_attempted, 0) as sources_attempted,
    COALESCE(sel.sources_successful, 0) as sources_successful,
    COALESCE(sel.avg_response_time, 0) as avg_response_time_ms,

    -- Anomaly summary
    COALESCE(ad.critical_anomalies, 0) as critical_anomalies,
    COALESCE(ad.warning_anomalies, 0) as warning_anomalies

FROM scraping_runs sr
LEFT JOIN (
    SELECT
        run_id,
        AVG(quality_score) as avg_quality_score,
        COUNT(*) FILTER (WHERE status = 'fail') as quality_issues
    FROM data_quality_metrics
    GROUP BY run_id
) dq ON sr.run_id = dq.run_id
LEFT JOIN (
    SELECT
        run_id,
        COUNT(*) as total_playlists_validated,
        COUNT(*) FILTER (WHERE NOT validation_passed) as validation_failures
    FROM graph_validation_results
    GROUP BY run_id
) gv ON sr.run_id = gv.run_id
LEFT JOIN (
    SELECT
        run_id,
        COUNT(*) as sources_attempted,
        COUNT(*) FILTER (WHERE success) as sources_successful,
        AVG(response_time_ms) as avg_response_time
    FROM source_extraction_log
    GROUP BY run_id
) sel ON sr.run_id = sel.run_id
LEFT JOIN (
    SELECT
        run_id,
        COUNT(*) FILTER (WHERE severity = 'critical') as critical_anomalies,
        COUNT(*) FILTER (WHERE severity = 'warning') as warning_anomalies
    FROM anomaly_detection
    GROUP BY run_id
) ad ON sr.run_id = ad.run_id;

-- Recent pipeline health view
CREATE OR REPLACE VIEW pipeline_health_dashboard AS
SELECT
    DATE_TRUNC('hour', start_time) as time_bucket,
    COUNT(*) as total_runs,
    COUNT(*) FILTER (WHERE status = 'completed') as successful_runs,
    COUNT(*) FILTER (WHERE status = 'failed') as failed_runs,
    AVG(EXTRACT(EPOCH FROM (end_time - start_time))) as avg_duration_seconds,
    SUM(songs_added) as total_songs_added,
    SUM(artists_added) as total_artists_added,
    AVG(avg_quality_score) as avg_quality_score,
    SUM(critical_anomalies) as total_critical_anomalies
FROM scraping_run_summary
WHERE start_time >= NOW() - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', start_time)
ORDER BY time_bucket DESC;

-- Create indexes for performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pipeline_metrics_timestamp
ON pipeline_execution_metrics(measurement_timestamp DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_quality_metrics_timestamp
ON data_quality_metrics(measured_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_source_log_timestamp
ON source_extraction_log(extraction_timestamp DESC);

-- Trigger to automatically update end_time when scraping_runs status changes to completed/failed
CREATE OR REPLACE FUNCTION update_scraping_run_end_time()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status IN ('completed', 'failed') AND OLD.status NOT IN ('completed', 'failed') THEN
        NEW.end_time = CURRENT_TIMESTAMP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_scraping_run_end_time_trigger
    BEFORE UPDATE ON scraping_runs
    FOR EACH ROW
    EXECUTE FUNCTION update_scraping_run_end_time();

COMMENT ON TABLE pipeline_execution_metrics IS 'Tracks detailed performance metrics throughout the data pipeline execution';
COMMENT ON TABLE data_lineage IS 'Tracks data flow and provenance through the pipeline stages';
COMMENT ON TABLE graph_validation_results IS 'Validates graph structure rules (n nodes, n-1 edges with same-artist exceptions)';
COMMENT ON TABLE data_quality_metrics IS 'Implements the 5 pillars of data observability';
COMMENT ON TABLE source_extraction_log IS 'Detailed log of all source extraction attempts and results';
COMMENT ON TABLE graph_impact_analysis IS 'Tracks how new data affects existing graph relationships and metrics';
COMMENT ON TABLE anomaly_detection IS 'Real-time anomaly detection results with severity levels and suggested actions';