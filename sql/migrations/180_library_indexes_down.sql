-- Migration 180_library_indexes_down.sql

DROP INDEX IF EXISTS library.idx_appearances_track_id;
DROP INDEX IF EXISTS library.idx_rotation_history_track_id;
DROP INDEX IF EXISTS library.idx_chart_positions_track_id;
DROP INDEX IF EXISTS library.idx_pending_track_id;
DROP INDEX IF EXISTS library.idx_rejected_track_id;
DROP INDEX IF EXISTS library.idx_beatport_check_track_id;
DROP INDEX IF EXISTS library.idx_set_tracks_track_id;
DROP INDEX IF EXISTS library.idx_track_tags_tag;
DROP INDEX IF EXISTS library.idx_track_xref_canonical_id;
