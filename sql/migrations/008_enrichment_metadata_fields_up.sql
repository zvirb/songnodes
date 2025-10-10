-- Migration 008: Add enrichment metadata fields to tracks table
-- Blueprint Section 5.2: Metadata-Driven Re-Enrichment
--
-- Adds critical metadata fields for tracking enrichment source, timing, and API versions
-- to enable time-based and source-specific re-enrichment strategies.

-- Add enrichment metadata fields to tracks table
ALTER TABLE tracks
ADD COLUMN IF NOT EXISTS enrichment_timestamp TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS enrichment_source_api VARCHAR(50),
ADD COLUMN IF NOT EXISTS source_data_version VARCHAR(100);

-- Add Camelot key for DJ-specific harmonic mixing features (Blueprint Section 9)
ALTER TABLE tracks
ADD COLUMN IF NOT EXISTS camelot_key VARCHAR(3),
ADD COLUMN IF NOT EXISTS tempo_confidence NUMERIC(3,2);

-- Add indexes for efficient re-enrichment queries
CREATE INDEX IF NOT EXISTS idx_tracks_enrichment_timestamp
ON tracks(enrichment_timestamp DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_tracks_enrichment_source_api
ON tracks(enrichment_source_api)
WHERE enrichment_source_api IS NOT NULL;

-- Composite index for staleness queries (Blueprint Section 5.3)
CREATE INDEX IF NOT EXISTS idx_tracks_stale_enrichment
ON tracks(enrichment_source_api, enrichment_timestamp)
WHERE enrichment_timestamp IS NOT NULL;

-- Index for Camelot wheel queries (harmonic mixing)
CREATE INDEX IF NOT EXISTS idx_tracks_camelot_key
ON tracks(camelot_key)
WHERE camelot_key IS NOT NULL;

-- Add trigger to auto-update enrichment_timestamp when enrichment data changes
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

DROP TRIGGER IF EXISTS auto_update_enrichment_timestamp ON tracks;
CREATE TRIGGER auto_update_enrichment_timestamp
BEFORE UPDATE ON tracks
FOR EACH ROW
EXECUTE FUNCTION update_enrichment_timestamp();

-- Add constraint for Camelot key format validation (1A-12B)
ALTER TABLE tracks
ADD CONSTRAINT IF NOT EXISTS tracks_camelot_key_format
CHECK (camelot_key ~ '^(1[0-2]|[1-9])[AB]$');

-- Add constraint for tempo_confidence range (0.0-1.0)
ALTER TABLE tracks
ADD CONSTRAINT IF NOT EXISTS tracks_tempo_confidence_range
CHECK (tempo_confidence IS NULL OR (tempo_confidence >= 0.0 AND tempo_confidence <= 1.0));

-- Add comments for documentation
COMMENT ON COLUMN tracks.enrichment_timestamp IS
'UTC timestamp when track was last enriched via external API (Spotify/MusicBrainz/Last.fm). Used for staleness detection and re-enrichment scheduling.';

COMMENT ON COLUMN tracks.enrichment_source_api IS
'API source used for last enrichment: spotify, musicbrainz, lastfm, discogs, beatport, acousticbrainz. Enables source-specific re-enrichment.';

COMMENT ON COLUMN tracks.source_data_version IS
'Version identifier from API response (ETag, version number, schema version). Enables version-based re-enrichment when APIs change.';

COMMENT ON COLUMN tracks.camelot_key IS
'Camelot wheel notation (1A-12B) for harmonic mixing. Derived from musical key field for DJ workflow optimization.';

COMMENT ON COLUMN tracks.tempo_confidence IS
'Confidence score (0.0-1.0) for BPM detection accuracy. Higher values indicate more reliable tempo data.';

-- Create materialized view for enrichment coverage statistics
CREATE MATERIALIZED VIEW IF NOT EXISTS enrichment_coverage_stats AS
SELECT
    COUNT(*) as total_tracks,
    COUNT(spotify_id) as with_spotify,
    COUNT(musicbrainz_id) as with_musicbrainz,
    COUNT(bpm) as with_bpm,
    COUNT(energy) as with_audio_features,
    COUNT(enrichment_timestamp) as enriched_tracks,
    COUNT(CASE WHEN enrichment_timestamp < CURRENT_TIMESTAMP - INTERVAL '90 days' THEN 1 END) as stale_tracks_90d,
    COUNT(CASE WHEN enrichment_timestamp < CURRENT_TIMESTAMP - INTERVAL '30 days' THEN 1 END) as stale_tracks_30d,
    ROUND(AVG(CASE WHEN spotify_id IS NOT NULL THEN 1 ELSE 0 END) * 100, 2) as spotify_coverage_pct,
    ROUND(AVG(CASE WHEN musicbrainz_id IS NOT NULL THEN 1 ELSE 0 END) * 100, 2) as musicbrainz_coverage_pct,
    ROUND(AVG(CASE WHEN bpm IS NOT NULL THEN 1 ELSE 0 END) * 100, 2) as audio_features_coverage_pct,
    ROUND(AVG(CASE WHEN enrichment_timestamp IS NOT NULL THEN 1 ELSE 0 END) * 100, 2) as enrichment_rate_pct
FROM tracks;

CREATE UNIQUE INDEX IF NOT EXISTS idx_enrichment_coverage_stats_refresh
ON enrichment_coverage_stats((1));

COMMENT ON MATERIALIZED VIEW enrichment_coverage_stats IS
'Aggregate statistics for enrichment coverage and staleness. Refresh periodically to monitor data quality.';

-- Log migration completion
DO $$
BEGIN
    RAISE NOTICE 'Migration 008: Enrichment metadata fields added successfully';
    RAISE NOTICE 'Blueprint Section 5.2: Metadata-driven re-enrichment now enabled';
    RAISE NOTICE 'Run: REFRESH MATERIALIZED VIEW enrichment_coverage_stats; to populate statistics';
END
$$;
