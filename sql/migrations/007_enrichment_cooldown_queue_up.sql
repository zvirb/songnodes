-- ===========================================================================
-- Migration 007: Enrichment Cool-Down Queue System
-- ===========================================================================
--
-- Purpose: Add cool-down queue functionality to enrichment_status table
--
-- This migration enables temporal retry strategy for failed enrichments.
-- Instead of permanent failures, tracks can be marked for retry after a
-- cool-down period (default 30-90 days).
--
-- Strategic Value:
-- - Acknowledges music lifecycle (promo → ID → official release)
-- - Automatically recovers tracks when metadata becomes available
-- - No manual intervention required
-- - Prevents permanent data loss from temporary metadata unavailability
--
-- ===========================================================================

-- Step 1: Add cool-down queue columns to enrichment_status table
-- ---------------------------------------------------------------------------

ALTER TABLE enrichment_status
ADD COLUMN IF NOT EXISTS retry_after TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS retry_attempts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS cooldown_strategy VARCHAR(50) DEFAULT 'exponential';

COMMENT ON COLUMN enrichment_status.retry_after IS
'Timestamp when track is eligible for re-enrichment after cool-down period';

COMMENT ON COLUMN enrichment_status.retry_attempts IS
'Number of times this track has been retried (for exponential backoff calculation)';

COMMENT ON COLUMN enrichment_status.cooldown_strategy IS
'Cool-down strategy: fixed, exponential, or adaptive';

-- Step 2: Create index for cool-down queue queries
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_enrichment_retry_queue ON enrichment_status(
    status, retry_after
) WHERE status = 'pending_re_enrichment' AND retry_after IS NOT NULL;

COMMENT ON INDEX idx_enrichment_retry_queue IS
'Optimizes cool-down queue queries: "Which tracks are ready for retry?"';

-- Step 3: Create view for cool-down queue monitoring
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW cooldown_queue_status AS
SELECT
    COUNT(*) FILTER (WHERE retry_after IS NOT NULL AND retry_after > CURRENT_TIMESTAMP) AS waiting_count,
    COUNT(*) FILTER (WHERE retry_after IS NOT NULL AND retry_after <= CURRENT_TIMESTAMP) AS ready_count,
    MIN(retry_after) FILTER (WHERE retry_after > CURRENT_TIMESTAMP) AS next_retry_time,
    AVG(retry_attempts) FILTER (WHERE retry_after IS NOT NULL) AS avg_retry_attempts,
    COUNT(*) FILTER (WHERE retry_attempts >= 5) AS max_retries_count
FROM enrichment_status
WHERE status = 'pending_re_enrichment';

COMMENT ON VIEW cooldown_queue_status IS
'Real-time statistics for cool-down queue monitoring';

-- Step 4: Create helper function to migrate failed tracks to cool-down queue
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION migrate_failed_to_cooldown(
    max_tracks_param INTEGER DEFAULT 100,
    cooldown_days_param INTEGER DEFAULT 30
)
RETURNS TABLE (
    track_id UUID,
    original_status VARCHAR(50),
    retry_after_timestamp TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    UPDATE enrichment_status
    SET
        status = 'pending_re_enrichment',
        retry_after = CURRENT_TIMESTAMP + (cooldown_days_param || ' days')::INTERVAL,
        retry_attempts = COALESCE(retry_attempts, 0) + 1,
        cooldown_strategy = 'exponential',
        updated_at = CURRENT_TIMESTAMP
    WHERE id IN (
        SELECT id
        FROM enrichment_status
        WHERE status = 'failed'
          AND (retry_after IS NULL OR retry_after < CURRENT_TIMESTAMP)
          AND retry_attempts < 5  -- Max 5 retry attempts
        ORDER BY updated_at DESC
        LIMIT max_tracks_param
    )
    RETURNING
        enrichment_status.track_id,
        'failed'::VARCHAR(50) AS original_status,
        enrichment_status.retry_after AS retry_after_timestamp;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION migrate_failed_to_cooldown IS
'Helper function to migrate failed tracks to cool-down queue with retry timestamp';

-- Step 5: Create function to get tracks ready for retry
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION get_tracks_ready_for_retry(
    max_tracks_param INTEGER DEFAULT 50
)
RETURNS TABLE (
    track_id UUID,
    retry_attempts_count INTEGER,
    cooldown_strategy_value VARCHAR(50),
    retry_after_timestamp TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        e.track_id,
        e.retry_attempts AS retry_attempts_count,
        e.cooldown_strategy AS cooldown_strategy_value,
        e.retry_after AS retry_after_timestamp
    FROM enrichment_status e
    WHERE e.status = 'pending_re_enrichment'
      AND e.retry_after IS NOT NULL
      AND e.retry_after <= CURRENT_TIMESTAMP
      AND e.retry_attempts < 5  -- Max 5 retry attempts
    ORDER BY e.retry_after ASC
    LIMIT max_tracks_param;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_tracks_ready_for_retry IS
'Get tracks that are ready for re-enrichment after cool-down period';

-- Step 6: Migration completion notice
-- ---------------------------------------------------------------------------

DO $$
BEGIN
    RAISE NOTICE '✅ Migration 007 completed: Cool-down queue system installed';
    RAISE NOTICE '';
    RAISE NOTICE 'New features available:';
    RAISE NOTICE '  - Temporal retry strategy with exponential backoff + jitter';
    RAISE NOTICE '  - cooldown_queue_status view for monitoring';
    RAISE NOTICE '  - migrate_failed_to_cooldown() function';
    RAISE NOTICE '  - get_tracks_ready_for_retry() function';
    RAISE NOTICE '';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '  1. Call migrate_failed_to_cooldown() to migrate existing failed tracks';
    RAISE NOTICE '  2. Monitor via cooldown_queue_status view';
    RAISE NOTICE '  3. Process ready tracks via /enrich/cooldown/process endpoint';
END $$;
