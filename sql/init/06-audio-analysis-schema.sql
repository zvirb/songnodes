-- Audio Analysis Schema Migration
-- Version: 1.0.0
-- Description: Schema for storing DJ-specific audio analysis features

SET search_path TO musicdb, public;

-- ===========================================
-- AUDIO ANALYSIS TABLE
-- ===========================================

-- Tracks audio analysis table
-- Stores extracted audio features for DJ mixing applications
CREATE TABLE IF NOT EXISTS tracks_audio_analysis (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    track_id UUID NOT NULL UNIQUE REFERENCES tracks(id) ON DELETE CASCADE,

    -- Structural features for mixing
    intro_duration_seconds DECIMAL(6,2),
    outro_duration_seconds DECIMAL(6,2),

    -- Breakdown analysis
    breakdown_timestamps JSONB DEFAULT '[]'::JSONB,
    -- Format: [{"timestamp": 45.2, "duration": 8.5, "depth": 0.7, "type": "major"}, ...]

    -- Vocal detection
    vocal_segments JSONB DEFAULT '[]'::JSONB,
    -- Format: [{"start_time": 10.0, "end_time": 25.0, "confidence": 0.85, "type": "vocal"}, ...]

    -- Energy curve for visualization
    energy_curve JSONB DEFAULT '[]'::JSONB,
    -- Format: [{"time": 0.0, "energy": 0.25}, {"time": 1.0, "energy": 0.35}, ...]

    -- Beat grid for precise mixing
    beat_grid JSONB DEFAULT '[]'::JSONB,
    -- Format: [{"position": 0.5, "confidence": 0.95, "beat_number": 1}, ...]

    -- Tempo analysis
    bpm DECIMAL(6,2),
    bpm_confidence DECIMAL(3,2),

    -- Analysis metadata
    analysis_version VARCHAR(20) NOT NULL,
    analyzed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    error_message TEXT,

    -- Audio source information
    audio_source VARCHAR(100),  -- 'spotify_preview', 'minio', etc.
    audio_duration_seconds DECIMAL(6,2),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_audio_analysis_track_id ON tracks_audio_analysis(track_id);
CREATE INDEX idx_audio_analysis_status ON tracks_audio_analysis(status) WHERE status != 'completed';
CREATE INDEX idx_audio_analysis_analyzed_at ON tracks_audio_analysis(analyzed_at DESC);
CREATE INDEX idx_audio_analysis_bpm ON tracks_audio_analysis(bpm) WHERE bpm IS NOT NULL;

-- GIN indexes for JSONB queries
CREATE INDEX idx_audio_analysis_breakdowns ON tracks_audio_analysis USING gin(breakdown_timestamps);
CREATE INDEX idx_audio_analysis_vocals ON tracks_audio_analysis USING gin(vocal_segments);
CREATE INDEX idx_audio_analysis_beat_grid ON tracks_audio_analysis USING gin(beat_grid);

-- ===========================================
-- ENRICHMENT STATUS TRACKING
-- ===========================================

-- Track enrichment status table
-- Tracks which enrichment processes have been applied to each track
CREATE TABLE IF NOT EXISTS track_enrichment_status (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    track_id UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,

    -- Enrichment types
    has_audio_analysis BOOLEAN DEFAULT FALSE,
    has_spotify_features BOOLEAN DEFAULT FALSE,
    has_musicbrainz_metadata BOOLEAN DEFAULT FALSE,
    has_discogs_metadata BOOLEAN DEFAULT FALSE,

    -- Timestamps
    audio_analysis_at TIMESTAMP WITH TIME ZONE,
    spotify_features_at TIMESTAMP WITH TIME ZONE,
    musicbrainz_metadata_at TIMESTAMP WITH TIME ZONE,
    discogs_metadata_at TIMESTAMP WITH TIME ZONE,

    -- Priority for processing queue
    priority INTEGER DEFAULT 0,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(track_id)
);

CREATE INDEX idx_enrichment_status_track_id ON track_enrichment_status(track_id);
CREATE INDEX idx_enrichment_status_audio_analysis ON track_enrichment_status(has_audio_analysis) WHERE has_audio_analysis = FALSE;
CREATE INDEX idx_enrichment_status_priority ON track_enrichment_status(priority DESC) WHERE priority > 0;

-- ===========================================
-- HELPER FUNCTIONS
-- ===========================================

-- Function to get tracks needing audio analysis
CREATE OR REPLACE FUNCTION get_tracks_needing_analysis(limit_count INTEGER DEFAULT 100)
RETURNS TABLE (
    track_id UUID,
    title VARCHAR,
    spotify_id VARCHAR,
    priority INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        t.id,
        t.title,
        t.spotify_id,
        COALESCE(tes.priority, 0) as priority
    FROM tracks t
    LEFT JOIN track_enrichment_status tes ON t.track_id = tes.track_id
    WHERE (tes.has_audio_analysis IS NULL OR tes.has_audio_analysis = FALSE)
      AND t.spotify_id IS NOT NULL
    ORDER BY COALESCE(tes.priority, 0) DESC, t.created_at DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate track mixability score
-- Combines intro/outro durations, energy profile, and BPM stability
CREATE OR REPLACE FUNCTION calculate_mixability_score(track_uuid UUID)
RETURNS DECIMAL(3,2) AS $$
DECLARE
    score DECIMAL(3,2) := 0.0;
    intro_dur DECIMAL;
    outro_dur DECIMAL;
    has_breakdowns BOOLEAN;
    beat_count INTEGER;
BEGIN
    -- Get analysis data
    SELECT
        intro_duration_seconds,
        outro_duration_seconds,
        jsonb_array_length(breakdown_timestamps) > 0,
        jsonb_array_length(beat_grid)
    INTO intro_dur, outro_dur, has_breakdowns, beat_count
    FROM tracks_audio_analysis
    WHERE track_id = track_uuid;

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    -- Score intro (good intros are 8-16 seconds)
    IF intro_dur >= 8 AND intro_dur <= 16 THEN
        score := score + 0.3;
    ELSIF intro_dur >= 4 AND intro_dur <= 20 THEN
        score := score + 0.15;
    END IF;

    -- Score outro (good outros are 8-16 seconds)
    IF outro_dur >= 8 AND outro_dur <= 16 THEN
        score := score + 0.3;
    ELSIF outro_dur >= 4 AND outro_dur <= 20 THEN
        score := score + 0.15;
    END IF;

    -- Bonus for clear beat grid
    IF beat_count > 50 THEN
        score := score + 0.2;
    ELSIF beat_count > 20 THEN
        score := score + 0.1;
    END IF;

    -- Bonus for having breakdown sections
    IF has_breakdowns THEN
        score := score + 0.2;
    END IF;

    RETURN LEAST(score, 1.0);
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- MATERIALIZED VIEWS
-- ===========================================

-- Mixable tracks view
-- Tracks with good intro/outro durations for mixing
CREATE MATERIALIZED VIEW mixable_tracks AS
SELECT
    t.id,
    t.title,
    t.bpm,
    t.key,
    t.genre,
    aa.intro_duration_seconds,
    aa.outro_duration_seconds,
    aa.bpm as analyzed_bpm,
    calculate_mixability_score(t.id) as mixability_score,
    jsonb_array_length(aa.breakdown_timestamps) as breakdown_count,
    jsonb_array_length(aa.vocal_segments) as vocal_segment_count
FROM tracks t
JOIN tracks_audio_analysis aa ON t.id = aa.track_id
WHERE aa.status = 'completed'
  AND aa.intro_duration_seconds >= 4
  AND aa.outro_duration_seconds >= 4
ORDER BY mixability_score DESC NULLS LAST;

CREATE UNIQUE INDEX idx_mixable_tracks_id ON mixable_tracks(id);
CREATE INDEX idx_mixable_tracks_score ON mixable_tracks(mixability_score DESC);
CREATE INDEX idx_mixable_tracks_bpm ON mixable_tracks(bpm) WHERE bpm IS NOT NULL;
CREATE INDEX idx_mixable_tracks_genre ON mixable_tracks(genre) WHERE genre IS NOT NULL;

-- Energy profile summary view
CREATE MATERIALIZED VIEW track_energy_profiles AS
SELECT
    t.id,
    t.title,
    t.genre,
    aa.bpm,
    -- Calculate energy statistics
    (SELECT AVG((value->>'energy')::DECIMAL) FROM jsonb_array_elements(aa.energy_curve) as value) as avg_energy,
    (SELECT MAX((value->>'energy')::DECIMAL) FROM jsonb_array_elements(aa.energy_curve) as value) as max_energy,
    (SELECT MIN((value->>'energy')::DECIMAL) FROM jsonb_array_elements(aa.energy_curve) as value) as min_energy,
    (SELECT STDDEV((value->>'energy')::DECIMAL) FROM jsonb_array_elements(aa.energy_curve) as value) as energy_variance,
    jsonb_array_length(aa.breakdown_timestamps) as breakdown_count
FROM tracks t
JOIN tracks_audio_analysis aa ON t.id = aa.track_id
WHERE aa.status = 'completed'
  AND jsonb_array_length(aa.energy_curve) > 0;

CREATE UNIQUE INDEX idx_energy_profiles_id ON track_energy_profiles(id);
CREATE INDEX idx_energy_profiles_avg_energy ON track_energy_profiles(avg_energy);
CREATE INDEX idx_energy_profiles_genre ON track_energy_profiles(genre) WHERE genre IS NOT NULL;

-- ===========================================
-- TRIGGERS
-- ===========================================

-- Update enrichment status when audio analysis is completed
CREATE OR REPLACE FUNCTION update_enrichment_status_on_analysis()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO track_enrichment_status (
        track_id,
        has_audio_analysis,
        audio_analysis_at
    ) VALUES (
        NEW.track_id,
        NEW.status = 'completed',
        CASE WHEN NEW.status = 'completed' THEN NEW.analyzed_at ELSE NULL END
    )
    ON CONFLICT (track_id) DO UPDATE SET
        has_audio_analysis = NEW.status = 'completed',
        audio_analysis_at = CASE WHEN NEW.status = 'completed' THEN NEW.analyzed_at ELSE track_enrichment_status.audio_analysis_at END,
        updated_at = CURRENT_TIMESTAMP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_enrichment_status
AFTER INSERT OR UPDATE ON tracks_audio_analysis
FOR EACH ROW
EXECUTE FUNCTION update_enrichment_status_on_analysis();

-- Update updated_at timestamp
CREATE TRIGGER update_audio_analysis_updated_at
BEFORE UPDATE ON tracks_audio_analysis
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_enrichment_status_updated_at
BEFORE UPDATE ON track_enrichment_status
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ===========================================
-- COMMENTS
-- ===========================================

COMMENT ON TABLE tracks_audio_analysis IS 'Stores DJ-specific audio analysis features extracted from audio files';
COMMENT ON COLUMN tracks_audio_analysis.intro_duration_seconds IS 'Length of beat-only intro section in seconds';
COMMENT ON COLUMN tracks_audio_analysis.outro_duration_seconds IS 'Length of outro section suitable for mixing in seconds';
COMMENT ON COLUMN tracks_audio_analysis.breakdown_timestamps IS 'Array of breakdown events with timestamp, duration, and depth';
COMMENT ON COLUMN tracks_audio_analysis.vocal_segments IS 'Array of vocal segments with start/end times and confidence';
COMMENT ON COLUMN tracks_audio_analysis.energy_curve IS 'Energy levels over time for visualization';
COMMENT ON COLUMN tracks_audio_analysis.beat_grid IS 'Precise beat positions for transition analysis';
COMMENT ON COLUMN tracks_audio_analysis.analysis_version IS 'Version of analysis algorithm used';

COMMENT ON TABLE track_enrichment_status IS 'Tracks which enrichment processes have been applied to each track';
COMMENT ON FUNCTION calculate_mixability_score IS 'Calculates a 0-1 score indicating how suitable a track is for DJ mixing';
COMMENT ON FUNCTION get_tracks_needing_analysis IS 'Returns tracks that need audio analysis, ordered by priority';

COMMENT ON MATERIALIZED VIEW mixable_tracks IS 'Tracks with good intro/outro characteristics for DJ mixing';
COMMENT ON MATERIALIZED VIEW track_energy_profiles IS 'Statistical summary of track energy profiles';