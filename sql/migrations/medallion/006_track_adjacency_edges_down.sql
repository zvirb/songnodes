-- ============================================================================
-- Migration Rollback: 006 - Track Adjacency Edges
-- ============================================================================

-- Drop triggers
DROP TRIGGER IF EXISTS update_track_transitions_on_track_update ON silver_enriched_tracks;

-- Drop functions
DROP FUNCTION IF EXISTS trigger_update_transition_metrics();
DROP FUNCTION IF EXISTS update_transition_metrics(UUID);

-- Drop materialized view
DROP MATERIALIZED VIEW IF EXISTS gold_track_graph;

-- Drop main table
DROP TABLE IF EXISTS silver_track_transitions;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ Rollback 006 complete: Track adjacency edges removed';
END $$;
