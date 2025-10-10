-- ============================================================================
-- Rollback Migration: 005 - Pipeline Replay Support
-- Description: Drop all pipeline replay and lineage tracking tables/functions
-- ============================================================================

-- Drop triggers (if implemented)
-- DROP TRIGGER IF EXISTS update_field_provenance_trigger ON silver_enriched_tracks;

-- Drop functions
DROP FUNCTION IF EXISTS update_field_provenance();
DROP FUNCTION IF EXISTS log_transformation(UUID, TEXT, TEXT, TEXT, JSONB, JSONB, BOOLEAN, DECIMAL, UUID, UUID, TEXT, INTEGER);
DROP FUNCTION IF EXISTS complete_pipeline_run(UUID, TEXT, JSONB);
DROP FUNCTION IF EXISTS start_pipeline_run(TEXT, TEXT, TEXT, TEXT[], TIMESTAMP, TIMESTAMP);

-- Drop tables in reverse order of creation
DROP TABLE IF EXISTS data_quality_metrics CASCADE;
DROP TABLE IF EXISTS pipeline_replay_queue CASCADE;
DROP TABLE IF EXISTS field_provenance CASCADE;
DROP TABLE IF EXISTS enrichment_transformations CASCADE;
DROP TABLE IF EXISTS enrichment_pipeline_runs CASCADE;
