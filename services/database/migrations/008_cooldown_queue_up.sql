-- Migration 008: Cool-Down Queue System
-- Add support for temporal re-enrichment strategy

-- Add columns for cool-down queue management
ALTER TABLE enrichment_status
ADD COLUMN IF NOT EXISTS retry_after TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS cooldown_reason TEXT,
ADD COLUMN IF NOT EXISTS cooldown_strategy VARCHAR(20) DEFAULT 'adaptive';

-- Create index for efficient cool-down queue queries
CREATE INDEX IF NOT EXISTS idx_enrichment_cooldown_ready
ON enrichment_status(retry_after)
WHERE status = 'pending_re_enrichment' AND retry_after IS NOT NULL;

-- Add new status for tracks waiting in cool-down queue
-- Note: We're using the existing status column, adding 'pending_re_enrichment' as a valid value

-- Create view for cool-down queue monitoring
CREATE OR REPLACE VIEW cooldown_queue_summary AS
SELECT
    COALESCE(cooldown_strategy, 'unknown') as strategy,
    COUNT(*) as track_count,
    COUNT(*) FILTER (WHERE retry_after <= CURRENT_TIMESTAMP) as ready_now,
    COUNT(*) FILTER (WHERE retry_after > CURRENT_TIMESTAMP) as waiting,
    AVG(retry_count) as avg_retry_attempts,
    MIN(retry_after) as next_retry,
    MAX(retry_after) as last_retry
FROM enrichment_status
WHERE status = 'pending_re_enrichment'
GROUP BY cooldown_strategy;

COMMENT ON VIEW cooldown_queue_summary IS
'Summary of tracks in cool-down queue grouped by retry strategy (fixed/exponential/adaptive)';

-- Create function to get tracks ready for retry
CREATE OR REPLACE FUNCTION get_cooldown_tracks_ready(
    max_tracks INTEGER DEFAULT 100
)
RETURNS TABLE (
    track_id UUID,
    track_title VARCHAR(500),
    retry_count INTEGER,
    cooldown_days INTEGER,
    ready_since INTERVAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        t.id,
        t.title,
        es.retry_count,
        EXTRACT(DAY FROM (es.retry_after - es.last_attempt))::INTEGER as cooldown_days,
        (CURRENT_TIMESTAMP - es.retry_after) as ready_since
    FROM tracks t
    JOIN enrichment_status es ON t.id = es.track_id
    WHERE
        es.status = 'pending_re_enrichment'
        AND es.retry_after <= CURRENT_TIMESTAMP
    ORDER BY es.retry_after ASC
    LIMIT max_tracks;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_cooldown_tracks_ready IS
'Get tracks that have completed their cool-down period and are ready for re-enrichment';

-- Create function to automatically migrate old failed tracks to cool-down queue
CREATE OR REPLACE FUNCTION migrate_failed_to_cooldown(
    cooldown_days INTEGER DEFAULT 90,
    max_tracks INTEGER DEFAULT 100
)
RETURNS TABLE (
    migrated_count INTEGER
) AS $$
DECLARE
    updated_rows INTEGER;
BEGIN
    -- Move non-retriable failed tracks to cool-down queue
    UPDATE enrichment_status
    SET
        status = 'pending_re_enrichment',
        retry_after = CURRENT_TIMESTAMP + (cooldown_days || ' days')::INTERVAL,
        cooldown_strategy = 'adaptive',
        cooldown_reason = COALESCE(error_message, 'No matching data found'),
        updated_at = CURRENT_TIMESTAMP
    WHERE track_id IN (
        SELECT track_id
        FROM enrichment_status
        WHERE
            status = 'failed'
            AND is_retriable = false
            AND (retry_count < 5 OR retry_count IS NULL)
        LIMIT max_tracks
    );

    GET DIAGNOSTICS updated_rows = ROW_COUNT;

    RETURN QUERY SELECT updated_rows;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION migrate_failed_to_cooldown IS
'Migrate non-retriable failed tracks to cool-down queue for future retry';

-- Log migration completion
DO $$
BEGIN
    RAISE NOTICE 'Migration 008 completed: Cool-down queue system installed';
    RAISE NOTICE 'New columns added: retry_after, cooldown_reason, cooldown_strategy';
    RAISE NOTICE 'New view created: cooldown_queue_summary';
    RAISE NOTICE 'Helper functions created: get_cooldown_tracks_ready, migrate_failed_to_cooldown';
END $$;
