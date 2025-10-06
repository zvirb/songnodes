-- Migration 008 Rollback: Cool-Down Queue System

-- Drop helper functions
DROP FUNCTION IF EXISTS migrate_failed_to_cooldown;
DROP FUNCTION IF EXISTS get_cooldown_tracks_ready;

-- Drop view
DROP VIEW IF EXISTS cooldown_queue_summary;

-- Drop index
DROP INDEX IF EXISTS idx_enrichment_cooldown_ready;

-- Remove columns (be careful - this will lose data!)
-- Commented out by default for safety
-- ALTER TABLE enrichment_status
-- DROP COLUMN IF EXISTS retry_after,
-- DROP COLUMN IF EXISTS cooldown_reason,
-- DROP COLUMN IF EXISTS cooldown_strategy;

-- Reset tracks that were in cool-down queue back to failed
UPDATE enrichment_status
SET status = 'failed'
WHERE status = 'pending_re_enrichment';

-- Log rollback completion
DO $$
BEGIN
    RAISE NOTICE 'Migration 008 rolled back: Cool-down queue system removed';
    RAISE NOTICE 'Note: Columns not removed to preserve data. Drop manually if needed.';
END $$;
