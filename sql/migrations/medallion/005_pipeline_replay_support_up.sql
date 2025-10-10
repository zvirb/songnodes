-- ============================================================================
-- Migration: 005 - Pipeline Replay Support (Data Lineage & Replayability)
-- Description: Create tables to track enrichment pipeline executions and
--              transformations for debugging, auditing, and replay
-- ============================================================================

-- ============================================================================
-- Enrichment Pipeline Runs
-- Track each execution of the enrichment pipeline for audit and replay
-- ============================================================================
CREATE TABLE IF NOT EXISTS enrichment_pipeline_runs (
    -- Primary identifier
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Run metadata
    run_type TEXT NOT NULL,                 -- 'full', 'incremental', 'manual', 'replay'
    run_status TEXT NOT NULL DEFAULT 'running',  -- 'running', 'completed', 'failed', 'partial'

    -- Scope
    source_filter TEXT[],                   -- Filter by sources (e.g., ['spotify', 'beatport'])
    date_filter_start TIMESTAMP,            -- Process records from this date
    date_filter_end TIMESTAMP,              -- Process records until this date

    -- Configuration snapshot (for replay)
    waterfall_config_snapshot JSONB,        -- Copy of metadata_enrichment_config at run time
    provider_config_snapshot JSONB,         -- Copy of enrichment_providers at run time

    -- Statistics
    total_records_processed INTEGER DEFAULT 0,
    successful_enrichments INTEGER DEFAULT 0,
    failed_enrichments INTEGER DEFAULT 0,
    skipped_records INTEGER DEFAULT 0,

    -- Error tracking
    error_summary JSONB,                    -- Aggregated error counts by type
    critical_errors TEXT[],                 -- Critical errors that stopped the run

    -- Performance metrics
    total_api_calls INTEGER DEFAULT 0,
    total_api_cost_usd DECIMAL(10,4) DEFAULT 0,  -- Track API costs
    avg_processing_time_ms INTEGER,

    -- Timing
    started_at TIMESTAMP NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP,
    duration_seconds INTEGER GENERATED ALWAYS AS (
        EXTRACT(EPOCH FROM (completed_at - started_at))::INTEGER
    ) STORED,

    -- Execution context
    triggered_by TEXT,                      -- 'scheduler', 'user:email', 'api', 'manual'
    execution_environment TEXT,             -- 'production', 'staging', 'development'

    -- Audit
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT pipeline_run_status CHECK (run_status IN ('running', 'completed', 'failed', 'partial', 'cancelled')),
    CONSTRAINT pipeline_run_type CHECK (run_type IN ('full', 'incremental', 'manual', 'replay', 'backfill'))
);

-- Indexes
CREATE INDEX idx_pipeline_runs_status ON enrichment_pipeline_runs(run_status);
CREATE INDEX idx_pipeline_runs_started ON enrichment_pipeline_runs(started_at DESC);
CREATE INDEX idx_pipeline_runs_type ON enrichment_pipeline_runs(run_type);
CREATE INDEX idx_pipeline_runs_triggered_by ON enrichment_pipeline_runs(triggered_by);

COMMENT ON TABLE enrichment_pipeline_runs IS 'Audit log of enrichment pipeline executions for tracking and replay.';
COMMENT ON COLUMN enrichment_pipeline_runs.waterfall_config_snapshot IS 'Snapshot of enrichment configuration at execution time for exact replay';
COMMENT ON COLUMN enrichment_pipeline_runs.total_api_cost_usd IS 'Cumulative API costs for cost tracking and optimization';

-- ============================================================================
-- Enrichment Transformations
-- Detailed log of each transformation applied during enrichment
-- ============================================================================
CREATE TABLE IF NOT EXISTS enrichment_transformations (
    -- Primary identifier
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Link to pipeline run
    run_id UUID NOT NULL REFERENCES enrichment_pipeline_runs(id) ON DELETE CASCADE,

    -- Source data reference
    bronze_id UUID REFERENCES bronze_scraped_tracks(id) ON DELETE SET NULL,
    silver_id UUID REFERENCES silver_enriched_tracks(id) ON DELETE SET NULL,

    -- Transformation details
    transformation_type TEXT NOT NULL,      -- 'enrichment', 'validation', 'normalization', 'deduplication'
    metadata_field TEXT,                    -- Field being transformed (e.g., 'bpm', 'genre')

    -- Provider information
    provider_used TEXT,
    provider_confidence DECIMAL(3,2),

    -- Data changes (for replay and debugging)
    input_value JSONB,                      -- Value before transformation
    output_value JSONB,                     -- Value after transformation
    transformation_rules JSONB,             -- Rules/logic applied

    -- Execution metadata
    success BOOLEAN NOT NULL,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    processing_time_ms INTEGER,

    -- API tracking
    api_endpoint_called TEXT,
    api_response_code INTEGER,
    api_cost_usd DECIMAL(8,4),

    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT transformation_type_check CHECK (
        transformation_type IN ('enrichment', 'validation', 'normalization', 'deduplication', 'merge', 'correction')
    ),
    CONSTRAINT provider_confidence_check CHECK (
        provider_confidence IS NULL OR (provider_confidence >= 0 AND provider_confidence <= 1)
    )
);

-- Indexes
CREATE INDEX idx_transformations_run_id ON enrichment_transformations(run_id);
CREATE INDEX idx_transformations_bronze_id ON enrichment_transformations(bronze_id) WHERE bronze_id IS NOT NULL;
CREATE INDEX idx_transformations_silver_id ON enrichment_transformations(silver_id) WHERE silver_id IS NOT NULL;
CREATE INDEX idx_transformations_field ON enrichment_transformations(metadata_field) WHERE metadata_field IS NOT NULL;
CREATE INDEX idx_transformations_provider ON enrichment_transformations(provider_used) WHERE provider_used IS NOT NULL;
CREATE INDEX idx_transformations_success ON enrichment_transformations(success);
CREATE INDEX idx_transformations_created ON enrichment_transformations(created_at DESC);

COMMENT ON TABLE enrichment_transformations IS 'Detailed transformation log for each enrichment operation - enables replay and debugging.';
COMMENT ON COLUMN enrichment_transformations.input_value IS 'Original value before transformation (JSON for complex types)';
COMMENT ON COLUMN enrichment_transformations.output_value IS 'Resulting value after transformation';
COMMENT ON COLUMN enrichment_transformations.transformation_rules IS 'JSON snapshot of rules/config used for this transformation';

-- ============================================================================
-- Field-Level Provenance
-- Track the source and transformation history for each field
-- ============================================================================
CREATE TABLE IF NOT EXISTS field_provenance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Target record
    silver_track_id UUID REFERENCES silver_enriched_tracks(id) ON DELETE CASCADE,
    metadata_field TEXT NOT NULL,

    -- Provenance chain
    original_bronze_id UUID REFERENCES bronze_scraped_tracks(id) ON DELETE SET NULL,
    original_source TEXT,                   -- e.g., '1001tracklists', 'spotify'
    original_value JSONB,

    -- Transformation chain (ordered)
    transformation_chain UUID[],            -- Array of enrichment_transformations.id in order
    final_transformation_id UUID REFERENCES enrichment_transformations(id) ON DELETE SET NULL,

    -- Current value metadata
    current_value JSONB,
    current_confidence DECIMAL(3,2),
    current_provider TEXT,

    -- Lineage metadata
    total_transformations INTEGER DEFAULT 0,
    last_modified_run_id UUID REFERENCES enrichment_pipeline_runs(id) ON DELETE SET NULL,

    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

    -- Constraints
    UNIQUE(silver_track_id, metadata_field),
    CONSTRAINT provenance_confidence CHECK (current_confidence >= 0 AND current_confidence <= 1)
);

-- Indexes
CREATE INDEX idx_provenance_silver_track ON field_provenance(silver_track_id);
CREATE INDEX idx_provenance_field ON field_provenance(metadata_field);
CREATE INDEX idx_provenance_provider ON field_provenance(current_provider) WHERE current_provider IS NOT NULL;
CREATE INDEX idx_provenance_bronze ON field_provenance(original_bronze_id) WHERE original_bronze_id IS NOT NULL;
CREATE INDEX idx_provenance_transformation_chain ON field_provenance USING gin(transformation_chain);

COMMENT ON TABLE field_provenance IS 'Field-level data lineage tracking - shows complete transformation history for each field.';
COMMENT ON COLUMN field_provenance.transformation_chain IS 'Ordered array of transformation IDs showing complete enrichment path';

-- ============================================================================
-- Pipeline Replay Queue
-- Queue for replaying enrichment on specific records
-- ============================================================================
CREATE TABLE IF NOT EXISTS pipeline_replay_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Target records
    bronze_ids UUID[] NOT NULL,             -- Records to replay
    target_layer TEXT NOT NULL,             -- 'silver', 'gold'

    -- Replay configuration
    replay_from_bronze BOOLEAN DEFAULT TRUE, -- Start from bronze or use current silver
    fields_to_replay TEXT[],                -- Specific fields, NULL = all fields
    force_re_enrichment BOOLEAN DEFAULT FALSE, -- Force API calls even if cached

    -- Historical replay (use old config)
    use_historical_config BOOLEAN DEFAULT FALSE,
    config_snapshot_run_id UUID REFERENCES enrichment_pipeline_runs(id) ON DELETE SET NULL,

    -- Status
    status TEXT DEFAULT 'queued',           -- 'queued', 'processing', 'completed', 'failed'
    assigned_run_id UUID REFERENCES enrichment_pipeline_runs(id) ON DELETE SET NULL,

    -- Metadata
    requested_by TEXT NOT NULL,
    reason TEXT,                            -- Why replay was requested
    priority INTEGER DEFAULT 5,             -- 1-10, lower = higher priority

    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    started_at TIMESTAMP,
    completed_at TIMESTAMP,

    -- Constraints
    CONSTRAINT replay_status CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'cancelled')),
    CONSTRAINT replay_target_layer CHECK (target_layer IN ('silver', 'gold')),
    CONSTRAINT replay_priority CHECK (priority >= 1 AND priority <= 10)
);

-- Indexes
CREATE INDEX idx_replay_queue_status ON pipeline_replay_queue(status) WHERE status IN ('queued', 'processing');
CREATE INDEX idx_replay_queue_priority ON pipeline_replay_queue(priority ASC, created_at ASC) WHERE status = 'queued';
CREATE INDEX idx_replay_queue_bronze_ids ON pipeline_replay_queue USING gin(bronze_ids);
CREATE INDEX idx_replay_queue_created ON pipeline_replay_queue(created_at DESC);

COMMENT ON TABLE pipeline_replay_queue IS 'Queue for replaying enrichment pipeline on specific records (debugging, config changes, etc.)';
COMMENT ON COLUMN pipeline_replay_queue.use_historical_config IS 'If TRUE, use configuration from config_snapshot_run_id instead of current config';

-- ============================================================================
-- Data Quality Metrics (Aggregated)
-- Track data quality evolution over time
-- ============================================================================
CREATE TABLE IF NOT EXISTS data_quality_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Time window
    metric_date DATE NOT NULL,
    metric_hour INTEGER,                    -- NULL for daily aggregates, 0-23 for hourly

    -- Layer
    data_layer TEXT NOT NULL,               -- 'bronze', 'silver', 'gold'

    -- Quality metrics
    total_records INTEGER DEFAULT 0,
    valid_records INTEGER DEFAULT 0,
    warning_records INTEGER DEFAULT 0,
    failed_records INTEGER DEFAULT 0,

    -- Field completeness (%)
    avg_field_completeness DECIMAL(5,2),    -- Average % of fields populated
    avg_quality_score DECIMAL(3,2),         -- Average quality score
    avg_enrichment_confidence DECIMAL(3,2), -- Average enrichment confidence

    -- Field-specific metrics (JSON)
    field_completeness_breakdown JSONB,     -- {field: completeness_pct}
    field_confidence_breakdown JSONB,       -- {field: avg_confidence}

    -- Provider performance
    provider_success_rates JSONB,           -- {provider: success_rate}

    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),

    -- Constraints
    UNIQUE(metric_date, metric_hour, data_layer),
    CONSTRAINT quality_metrics_layer CHECK (data_layer IN ('bronze', 'silver', 'gold')),
    CONSTRAINT quality_metrics_hour CHECK (metric_hour IS NULL OR (metric_hour >= 0 AND metric_hour <= 23)),
    CONSTRAINT quality_metrics_completeness CHECK (avg_field_completeness >= 0 AND avg_field_completeness <= 100),
    CONSTRAINT quality_metrics_quality CHECK (avg_quality_score >= 0 AND avg_quality_score <= 1),
    CONSTRAINT quality_metrics_confidence CHECK (avg_enrichment_confidence >= 0 AND avg_enrichment_confidence <= 1)
);

-- Indexes
CREATE INDEX idx_quality_metrics_date ON data_quality_metrics(metric_date DESC, metric_hour DESC NULLS LAST);
CREATE INDEX idx_quality_metrics_layer ON data_quality_metrics(data_layer, metric_date DESC);

COMMENT ON TABLE data_quality_metrics IS 'Aggregated data quality metrics over time for trend analysis and alerting.';
COMMENT ON COLUMN data_quality_metrics.metric_hour IS 'NULL for daily rollups, 0-23 for hourly granularity';

-- ============================================================================
-- Functions: Pipeline Management
-- ============================================================================

-- Function: Start new pipeline run
CREATE OR REPLACE FUNCTION start_pipeline_run(
    p_run_type TEXT,
    p_triggered_by TEXT,
    p_execution_environment TEXT DEFAULT 'production',
    p_source_filter TEXT[] DEFAULT NULL,
    p_date_filter_start TIMESTAMP DEFAULT NULL,
    p_date_filter_end TIMESTAMP DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_run_id UUID;
    v_waterfall_snapshot JSONB;
    v_provider_snapshot JSONB;
BEGIN
    -- Capture current configuration
    SELECT jsonb_agg(row_to_json(c.*)) INTO v_waterfall_snapshot
    FROM metadata_enrichment_config c WHERE enabled = TRUE;

    SELECT jsonb_agg(row_to_json(p.*)) INTO v_provider_snapshot
    FROM enrichment_providers p WHERE enabled = TRUE;

    -- Create run record
    INSERT INTO enrichment_pipeline_runs (
        run_type, run_status, triggered_by, execution_environment,
        source_filter, date_filter_start, date_filter_end,
        waterfall_config_snapshot, provider_config_snapshot
    ) VALUES (
        p_run_type, 'running', p_triggered_by, p_execution_environment,
        p_source_filter, p_date_filter_start, p_date_filter_end,
        v_waterfall_snapshot, v_provider_snapshot
    ) RETURNING id INTO v_run_id;

    RETURN v_run_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION start_pipeline_run IS 'Initialize a new pipeline run with configuration snapshot for replay capability.';

-- Function: Complete pipeline run
CREATE OR REPLACE FUNCTION complete_pipeline_run(
    p_run_id UUID,
    p_status TEXT DEFAULT 'completed',
    p_error_summary JSONB DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    UPDATE enrichment_pipeline_runs
    SET
        run_status = p_status,
        completed_at = NOW(),
        error_summary = COALESCE(p_error_summary, error_summary)
    WHERE id = p_run_id;
END;
$$ LANGUAGE plpgsql;

-- Function: Log transformation
CREATE OR REPLACE FUNCTION log_transformation(
    p_run_id UUID,
    p_transformation_type TEXT,
    p_metadata_field TEXT,
    p_provider TEXT,
    p_input_value JSONB,
    p_output_value JSONB,
    p_success BOOLEAN,
    p_confidence DECIMAL DEFAULT NULL,
    p_bronze_id UUID DEFAULT NULL,
    p_silver_id UUID DEFAULT NULL,
    p_error_message TEXT DEFAULT NULL,
    p_processing_time_ms INTEGER DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_transformation_id UUID;
BEGIN
    INSERT INTO enrichment_transformations (
        run_id, transformation_type, metadata_field, provider_used,
        input_value, output_value, success, provider_confidence,
        bronze_id, silver_id, error_message, processing_time_ms
    ) VALUES (
        p_run_id, p_transformation_type, p_metadata_field, p_provider,
        p_input_value, p_output_value, p_success, p_confidence,
        p_bronze_id, p_silver_id, p_error_message, p_processing_time_ms
    ) RETURNING id INTO v_transformation_id;

    RETURN v_transformation_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION log_transformation IS 'Log a single transformation for audit trail and replay.';

-- ============================================================================
-- Trigger: Auto-update field provenance
-- ============================================================================
CREATE OR REPLACE FUNCTION update_field_provenance()
RETURNS TRIGGER AS $$
BEGIN
    -- This trigger would update field_provenance when silver_enriched_tracks is updated
    -- Implementation would track which fields changed and update provenance accordingly
    -- Simplified example:
    INSERT INTO field_provenance (
        silver_track_id, metadata_field, current_value, updated_at
    ) VALUES (
        NEW.id, 'updated_at', to_jsonb(NEW.updated_at), NOW()
    ) ON CONFLICT (silver_track_id, metadata_field)
    DO UPDATE SET
        current_value = EXCLUDED.current_value,
        updated_at = NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Note: Actual implementation would be more sophisticated, tracking individual field changes
-- This is a placeholder to demonstrate the concept
