-- Migration 009 DOWN: Revert Serato metadata fields
-- Removes Serato integration fields and related infrastructure

-- Drop helper functions
DROP FUNCTION IF EXISTS find_tracks_needing_serato_analysis(INTEGER);
DROP FUNCTION IF EXISTS compare_bpm_sources(UUID);

-- Drop view
DROP VIEW IF EXISTS serato_enrichment_coverage;

-- Restore the trigger to original version (without Serato fields)
CREATE OR REPLACE FUNCTION update_enrichment_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    -- If any enrichment-related field is updated, update enrichment timestamp
    IF (NEW.spotify_id IS DISTINCT FROM OLD.spotify_id) OR
       (NEW.musicbrainz_id IS DISTINCT FROM OLD.musicbrainz_id) OR
       (NEW.bpm IS DISTINCT FROM OLD.bpm) OR
       (NEW.key IS DISTINCT FROM OLD.key) OR
       (NEW.energy IS DISTINCT FROM OLD.energy) OR
       (NEW.danceability IS DISTINCT FROM OLD.danceability) OR
       (NEW.valence IS DISTINCT FROM OLD.valence) OR
       (NEW.acousticness IS DISTINCT FROM OLD.acousticness) OR
       (NEW.instrumentalness IS DISTINCT FROM OLD.instrumentalness) OR
       (NEW.liveness IS DISTINCT FROM OLD.liveness) OR
       (NEW.speechiness IS DISTINCT FROM OLD.speechiness) OR
       (NEW.popularity_score IS DISTINCT FROM OLD.popularity_score) THEN
        NEW.enrichment_timestamp := CURRENT_TIMESTAMP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop indexes
DROP INDEX IF EXISTS idx_tracks_serato_analyzed_at;
DROP INDEX IF EXISTS idx_tracks_serato_bpm;
DROP INDEX IF EXISTS idx_tracks_serato_key_text;
DROP INDEX IF EXISTS idx_tracks_serato_enriched;
DROP INDEX IF EXISTS idx_tracks_serato_cues_gin;
DROP INDEX IF EXISTS idx_tracks_serato_loops_gin;

-- Drop constraints
ALTER TABLE tracks DROP CONSTRAINT IF EXISTS tracks_serato_bpm_range;
ALTER TABLE tracks DROP CONSTRAINT IF EXISTS tracks_serato_auto_gain_range;
ALTER TABLE tracks DROP CONSTRAINT IF EXISTS tracks_serato_key_text_format;
ALTER TABLE tracks DROP CONSTRAINT IF EXISTS tracks_serato_cues_schema;
ALTER TABLE tracks DROP CONSTRAINT IF EXISTS tracks_serato_loops_schema;

-- Drop columns
ALTER TABLE tracks
DROP COLUMN IF EXISTS serato_bpm,
DROP COLUMN IF EXISTS serato_key,
DROP COLUMN IF EXISTS serato_key_text,
DROP COLUMN IF EXISTS serato_auto_gain,
DROP COLUMN IF EXISTS serato_beatgrid,
DROP COLUMN IF EXISTS serato_cues,
DROP COLUMN IF EXISTS serato_loops,
DROP COLUMN IF EXISTS serato_analyzed_at;

-- Log migration rollback
DO $$
BEGIN
    RAISE NOTICE 'Migration 009 DOWN: Serato metadata fields removed';
END
$$;
