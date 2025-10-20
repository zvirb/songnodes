
DROP TRIGGER IF EXISTS update_track_transitions_on_track_update ON silver_enriched_tracks;
DROP TRIGGER IF EXISTS update_track_playlist_metadata ON silver_playlist_tracks;

DROP FUNCTION IF EXISTS trigger_update_transition_metrics();
DROP FUNCTION IF EXISTS update_transition_metrics(UUID);
DROP FUNCTION IF EXISTS trigger_update_track_playlist_metadata();
DROP FUNCTION IF EXISTS update_track_playlist_metadata(UUID);

DROP MATERIALIZED VIEW IF EXISTS gold_track_graph;

DROP TABLE IF EXISTS silver_track_transitions;

DO $$
BEGIN
    RAISE NOTICE '✅ Rollback 006 complete: Track adjacency edges removed';
END $$;
