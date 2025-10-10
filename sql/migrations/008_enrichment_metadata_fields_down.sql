-- Migration 008 DOWN: Revert enrichment metadata fields
-- Removes enrichment tracking fields and related infrastructure

-- Drop materialized view
DROP MATERIALIZED VIEW IF EXISTS enrichment_coverage_stats;

-- Drop trigger and function
DROP TRIGGER IF EXISTS auto_update_enrichment_timestamp ON tracks;
DROP FUNCTION IF EXISTS update_enrichment_timestamp();

-- Drop indexes
DROP INDEX IF EXISTS idx_tracks_enrichment_timestamp;
DROP INDEX IF EXISTS idx_tracks_enrichment_source_api;
DROP INDEX IF EXISTS idx_tracks_stale_enrichment;
DROP INDEX IF EXISTS idx_tracks_camelot_key;

-- Drop constraints
ALTER TABLE tracks DROP CONSTRAINT IF EXISTS tracks_camelot_key_format;
ALTER TABLE tracks DROP CONSTRAINT IF EXISTS tracks_tempo_confidence_range;

-- Drop columns
ALTER TABLE tracks
DROP COLUMN IF EXISTS enrichment_timestamp,
DROP COLUMN IF EXISTS enrichment_source_api,
DROP COLUMN IF EXISTS source_data_version,
DROP COLUMN IF EXISTS camelot_key,
DROP COLUMN IF EXISTS tempo_confidence;

-- Log migration rollback
DO $$
BEGIN
    RAISE NOTICE 'Migration 008 DOWN: Enrichment metadata fields removed';
END
$$;
