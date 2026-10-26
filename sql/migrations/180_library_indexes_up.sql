-- Migration 180_library_indexes_up.sql
-- Add indexes for library schema

CREATE INDEX IF NOT EXISTS idx_appearances_track_id ON library.appearances (track_id);
CREATE INDEX IF NOT EXISTS idx_rotation_history_track_id ON library.rotation_history (track_id);
CREATE INDEX IF NOT EXISTS idx_chart_positions_track_id ON library.chart_positions (track_id);
CREATE INDEX IF NOT EXISTS idx_pending_track_id ON library.pending (track_id);
CREATE INDEX IF NOT EXISTS idx_rejected_track_id ON library.rejected (track_id);
CREATE INDEX IF NOT EXISTS idx_beatport_check_track_id ON library.beatport_check (track_id);
CREATE INDEX IF NOT EXISTS idx_set_tracks_track_id ON library.set_tracks (track_id);
CREATE INDEX IF NOT EXISTS idx_track_tags_tag ON library.track_tags (tag);
CREATE INDEX IF NOT EXISTS idx_track_xref_canonical_id ON library.track_xref (canonical_id);
