-- Migration 009: Add Serato metadata fields to tracks table
-- Serato Integration: DJ-Grade BPM/Key Detection
--
-- Adds Serato-specific metadata fields for professional DJ workflow integration.
-- Serato Pro provides highly accurate BPM and key detection optimized for DJ mixing,
-- often more accurate than algorithmic analysis from other sources.
--
-- Data Sources:
-- - Serato file tags (ID3 GEOB tags embedded in audio files)
-- - Serato beatgrid analysis (sub-beat accuracy)
-- - Serato Autotags (auto-gain, key detection)
-- - Serato cue points and loops (DJ performance markers)

-- Add Serato analysis metadata fields to tracks table
ALTER TABLE tracks
ADD COLUMN IF NOT EXISTS serato_bpm NUMERIC(6,2),
ADD COLUMN IF NOT EXISTS serato_key VARCHAR(50),
ADD COLUMN IF NOT EXISTS serato_key_text VARCHAR(10),
ADD COLUMN IF NOT EXISTS serato_auto_gain NUMERIC(6,2),
ADD COLUMN IF NOT EXISTS serato_beatgrid JSONB,
ADD COLUMN IF NOT EXISTS serato_cues JSONB,
ADD COLUMN IF NOT EXISTS serato_loops JSONB,
ADD COLUMN IF NOT EXISTS serato_analyzed_at TIMESTAMP WITH TIME ZONE;

-- Add indexes for efficient Serato data queries
CREATE INDEX IF NOT EXISTS idx_tracks_serato_analyzed_at
ON tracks(serato_analyzed_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_tracks_serato_bpm
ON tracks(serato_bpm)
WHERE serato_bpm IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tracks_serato_key_text
ON tracks(serato_key_text)
WHERE serato_key_text IS NOT NULL;

-- Composite index for Serato-enriched tracks
CREATE INDEX IF NOT EXISTS idx_tracks_serato_enriched
ON tracks(serato_analyzed_at, serato_bpm, serato_key_text)
WHERE serato_analyzed_at IS NOT NULL;

-- GIN index for JSONB cue points and loops (for querying cue/loop properties)
CREATE INDEX IF NOT EXISTS idx_tracks_serato_cues_gin
ON tracks USING gin(serato_cues)
WHERE serato_cues IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tracks_serato_loops_gin
ON tracks USING gin(serato_loops)
WHERE serato_loops IS NOT NULL;

-- Add constraints for data validation
DO $$
BEGIN
    -- Add BPM range constraint
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'tracks_serato_bpm_range'
    ) THEN
        ALTER TABLE tracks
        ADD CONSTRAINT tracks_serato_bpm_range
        CHECK (serato_bpm IS NULL OR (serato_bpm >= 20.0 AND serato_bpm <= 300.0));
    END IF;

    -- Add auto-gain range constraint
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'tracks_serato_auto_gain_range'
    ) THEN
        ALTER TABLE tracks
        ADD CONSTRAINT tracks_serato_auto_gain_range
        CHECK (serato_auto_gain IS NULL OR (serato_auto_gain >= -60.0 AND serato_auto_gain <= 60.0));
    END IF;

    -- Add Camelot key format constraint
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'tracks_serato_key_text_format'
    ) THEN
        ALTER TABLE tracks
        ADD CONSTRAINT tracks_serato_key_text_format
        CHECK (serato_key_text IS NULL OR serato_key_text ~ '^(1[0-2]|[1-9])[AB]$');
    END IF;

    -- Add cue points schema constraint
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'tracks_serato_cues_schema'
    ) THEN
        ALTER TABLE tracks
        ADD CONSTRAINT tracks_serato_cues_schema
        CHECK (
            serato_cues IS NULL OR
            (jsonb_typeof(serato_cues) = 'array')
        );
    END IF;

    -- Add loops schema constraint
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'tracks_serato_loops_schema'
    ) THEN
        ALTER TABLE tracks
        ADD CONSTRAINT tracks_serato_loops_schema
        CHECK (
            serato_loops IS NULL OR
            (jsonb_typeof(serato_loops) = 'array')
        );
    END IF;
END $$;

-- Update the enrichment trigger to include Serato fields
-- This extends the trigger from migration 008 to track Serato enrichments
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
       (NEW.popularity_score IS DISTINCT FROM OLD.popularity_score) OR
       -- NEW: Serato metadata fields
       (NEW.serato_bpm IS DISTINCT FROM OLD.serato_bpm) OR
       (NEW.serato_key IS DISTINCT FROM OLD.serato_key) OR
       (NEW.serato_key_text IS DISTINCT FROM OLD.serato_key_text) OR
       (NEW.serato_auto_gain IS DISTINCT FROM OLD.serato_auto_gain) OR
       (NEW.serato_beatgrid IS DISTINCT FROM OLD.serato_beatgrid) OR
       (NEW.serato_cues IS DISTINCT FROM OLD.serato_cues) OR
       (NEW.serato_loops IS DISTINCT FROM OLD.serato_loops) THEN
        NEW.enrichment_timestamp := CURRENT_TIMESTAMP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add documentation comments
COMMENT ON COLUMN tracks.serato_bpm IS
'BPM detected by Serato Pro DJ software. Often more accurate than algorithmic detection due to DJ-grade beatgrid analysis. May differ from bpm column which aggregates multiple sources.';

COMMENT ON COLUMN tracks.serato_key IS
'Musical key detected by Serato (full key name, e.g., "A Minor", "F# Major"). Used for harmonic mixing compatibility.';

COMMENT ON COLUMN tracks.serato_key_text IS
'Camelot wheel notation from Serato (1A-12B). Standard DJ notation for harmonic mixing. Derived from serato_key field.';

COMMENT ON COLUMN tracks.serato_auto_gain IS
'Serato auto-gain value in dB. Recommended gain adjustment for consistent playback volume. Range: -60dB to +60dB.';

COMMENT ON COLUMN tracks.serato_beatgrid IS
'Serato beatgrid data structure (JSONB). Contains markers array with position/beat_number pairs for sub-beat accuracy. Format: {"markers": [{"position": 0.5, "beat_number": 1}], "terminal_count": 1, "non_terminal_count": 128}';

COMMENT ON COLUMN tracks.serato_cues IS
'Serato cue points (JSONB array). DJ performance markers for quick navigation. Format: [{"position_ms": 1000, "color": "#FF0000", "label": "Drop"}]';

COMMENT ON COLUMN tracks.serato_loops IS
'Serato loop markers (JSONB array). DJ performance loops for creative mixing. Format: [{"start_ms": 1000, "end_ms": 5000, "color": "#00FF00", "label": "Intro Loop"}]';

COMMENT ON COLUMN tracks.serato_analyzed_at IS
'UTC timestamp when track was analyzed by Serato Pro. Indicates freshness of Serato metadata. NULL if never analyzed by Serato.';

-- Create view for Serato enrichment coverage
CREATE OR REPLACE VIEW serato_enrichment_coverage AS
SELECT
    COUNT(*) as total_tracks,
    COUNT(serato_bpm) as with_serato_bpm,
    COUNT(serato_key) as with_serato_key,
    COUNT(serato_key_text) as with_serato_camelot,
    COUNT(serato_beatgrid) as with_serato_beatgrid,
    COUNT(serato_cues) as with_serato_cues,
    COUNT(serato_loops) as with_serato_loops,
    COUNT(serato_analyzed_at) as serato_analyzed_tracks,
    ROUND(AVG(CASE WHEN serato_bpm IS NOT NULL THEN 1 ELSE 0 END) * 100, 2) as serato_bpm_coverage_pct,
    ROUND(AVG(CASE WHEN serato_key IS NOT NULL THEN 1 ELSE 0 END) * 100, 2) as serato_key_coverage_pct,
    ROUND(AVG(CASE WHEN serato_analyzed_at IS NOT NULL THEN 1 ELSE 0 END) * 100, 2) as serato_coverage_pct,
    -- Compare Serato BPM vs other sources (useful for accuracy validation)
    COUNT(CASE WHEN serato_bpm IS NOT NULL AND bpm IS NOT NULL THEN 1 END) as tracks_with_both_bpm,
    ROUND(AVG(CASE WHEN serato_bpm IS NOT NULL AND bpm IS NOT NULL AND ABS(serato_bpm - bpm) > 2.0 THEN 1 ELSE 0 END) * 100, 2) as bpm_mismatch_pct
FROM tracks;

COMMENT ON VIEW serato_enrichment_coverage IS
'Serato enrichment coverage statistics. Monitors how many tracks have Serato metadata and compares BPM accuracy vs other sources. Refresh: SELECT * FROM serato_enrichment_coverage;';

-- Create function to compare BPM sources
CREATE OR REPLACE FUNCTION compare_bpm_sources(track_id_param UUID)
RETURNS TABLE(
    source TEXT,
    bpm_value NUMERIC,
    confidence TEXT,
    notes TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        'Serato' as source,
        t.serato_bpm as bpm_value,
        'High' as confidence,
        'DJ-grade beatgrid analysis' as notes
    FROM tracks t
    WHERE t.track_id = track_id_param AND t.serato_bpm IS NOT NULL

    UNION ALL

    SELECT
        'Spotify' as source,
        t.bpm as bpm_value,
        CASE
            WHEN t.tempo_confidence >= 0.8 THEN 'High'
            WHEN t.tempo_confidence >= 0.5 THEN 'Medium'
            ELSE 'Low'
        END as confidence,
        'Algorithmic analysis' as notes
    FROM tracks t
    WHERE t.track_id = track_id_param AND t.bpm IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION compare_bpm_sources IS
'Compare BPM values from different enrichment sources (Serato vs Spotify/MusicBrainz). Usage: SELECT * FROM compare_bpm_sources(''track-uuid'');';

-- Create function to find tracks needing Serato analysis
CREATE OR REPLACE FUNCTION find_tracks_needing_serato_analysis(limit_count INTEGER DEFAULT 100)
RETURNS TABLE(
    track_id UUID,
    artist_name TEXT,
    track_name TEXT,
    has_bpm BOOLEAN,
    has_key BOOLEAN,
    enrichment_age_days INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        t.track_id,
        t.artist_name,
        t.track_name,
        (t.bpm IS NOT NULL) as has_bpm,
        (t.key IS NOT NULL) as has_key,
        EXTRACT(DAY FROM (CURRENT_TIMESTAMP - t.enrichment_timestamp))::INTEGER as enrichment_age_days
    FROM tracks t
    WHERE t.serato_analyzed_at IS NULL
    AND t.file_path IS NOT NULL  -- Only tracks with local file paths can be analyzed by Serato
    ORDER BY
        CASE WHEN t.bpm IS NULL OR t.key IS NULL THEN 0 ELSE 1 END,  -- Prioritize tracks missing BPM/key
        t.enrichment_timestamp NULLS FIRST,
        t.created_at DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION find_tracks_needing_serato_analysis IS
'Find tracks that need Serato analysis. Prioritizes tracks missing BPM/key and tracks never enriched. Usage: SELECT * FROM find_tracks_needing_serato_analysis(100);';

-- Log migration completion
DO $$
BEGIN
    RAISE NOTICE 'Migration 009: Serato metadata fields added successfully';
    RAISE NOTICE 'Serato Integration: DJ-grade BPM/key detection now supported';
    RAISE NOTICE 'Run: SELECT * FROM serato_enrichment_coverage; to check coverage';
    RAISE NOTICE 'Run: SELECT * FROM find_tracks_needing_serato_analysis(100); to find tracks for batch import';
END
$$;
