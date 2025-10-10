-- ============================================================================
-- Migration: 002 - Silver Layer (Validated and Enriched Data)
-- Description: Create tables for validated, cleaned, and enriched data with
--              references to bronze sources for lineage tracking
-- ============================================================================

-- ============================================================================
-- Silver Enriched Tracks
-- Cleaned, validated, and enriched track data with quality scoring
-- ============================================================================
CREATE TABLE IF NOT EXISTS silver_enriched_tracks (
    -- Primary identifier
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Lineage: Reference to bronze source(s)
    bronze_id UUID REFERENCES bronze_scraped_tracks(id) ON DELETE CASCADE,
    additional_bronze_ids UUID[],           -- For tracks merged from multiple sources

    -- Validated core fields
    artist_name TEXT NOT NULL,
    track_title TEXT NOT NULL,

    -- Enriched metadata
    spotify_id TEXT,
    isrc TEXT,
    release_date DATE,
    duration_ms INTEGER,

    -- Musical attributes
    bpm DECIMAL(6,2),
    key TEXT,                               -- Camelot or Open Key notation
    genre TEXT[],
    energy DECIMAL(3,2),                    -- 0.00-1.00
    valence DECIMAL(3,2),                   -- 0.00-1.00
    danceability DECIMAL(3,2),              -- 0.00-1.00

    -- Data quality tracking
    validation_status TEXT NOT NULL,        -- 'valid', 'warning', 'needs_review'
    data_quality_score DECIMAL(3,2),        -- 0.00-1.00 overall quality score
    validation_errors JSONB,                -- Array of validation issues
    validation_warnings JSONB,              -- Array of non-critical issues

    -- Enrichment metadata
    enrichment_metadata JSONB NOT NULL,     -- Provider info, confidence scores, etc.
    enrichment_run_id UUID,                 -- Links to enrichment_pipeline_runs

    -- Field-level confidence scores
    field_confidence JSONB,                 -- Per-field confidence from enrichment

    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    validated_at TIMESTAMP,
    enriched_at TIMESTAMP,

    -- Constraints
    CONSTRAINT silver_tracks_quality_score CHECK (data_quality_score >= 0 AND data_quality_score <= 1),
    CONSTRAINT silver_tracks_bpm_range CHECK (bpm IS NULL OR (bpm >= 20 AND bpm <= 300)),
    CONSTRAINT silver_tracks_validation_status CHECK (validation_status IN ('valid', 'warning', 'needs_review', 'failed'))
);

-- Indexes for performance
CREATE INDEX idx_silver_tracks_bronze_id ON silver_enriched_tracks(bronze_id);
CREATE INDEX idx_silver_tracks_artist_name ON silver_enriched_tracks(artist_name);
CREATE INDEX idx_silver_tracks_track_title ON silver_enriched_tracks(track_title);
CREATE INDEX idx_silver_tracks_spotify_id ON silver_enriched_tracks(spotify_id) WHERE spotify_id IS NOT NULL;
CREATE INDEX idx_silver_tracks_isrc ON silver_enriched_tracks(isrc) WHERE isrc IS NOT NULL;
CREATE INDEX idx_silver_tracks_validation_status ON silver_enriched_tracks(validation_status);
CREATE INDEX idx_silver_tracks_quality_score ON silver_enriched_tracks(data_quality_score DESC);
CREATE INDEX idx_silver_tracks_enrichment_run ON silver_enriched_tracks(enrichment_run_id) WHERE enrichment_run_id IS NOT NULL;
CREATE INDEX idx_silver_tracks_genre ON silver_enriched_tracks USING gin(genre);
CREATE INDEX idx_silver_tracks_enrichment_metadata ON silver_enriched_tracks USING gin(enrichment_metadata);
CREATE INDEX idx_silver_tracks_updated_at ON silver_enriched_tracks(updated_at DESC);

-- Full-text search index
CREATE INDEX idx_silver_tracks_search ON silver_enriched_tracks
    USING gin(to_tsvector('english', artist_name || ' ' || track_title));

-- Comments
COMMENT ON TABLE silver_enriched_tracks IS 'Silver layer: Validated and enriched track data with quality scoring and lineage.';
COMMENT ON COLUMN silver_enriched_tracks.bronze_id IS 'Primary bronze source for data lineage and replay';
COMMENT ON COLUMN silver_enriched_tracks.additional_bronze_ids IS 'Additional bronze sources if track was merged/reconciled';
COMMENT ON COLUMN silver_enriched_tracks.data_quality_score IS 'Composite score: field completeness × enrichment confidence × validation pass rate';
COMMENT ON COLUMN silver_enriched_tracks.enrichment_metadata IS 'JSON: {field: {provider, confidence, fetched_at, raw_value}}';
COMMENT ON COLUMN silver_enriched_tracks.field_confidence IS 'JSON: {field_name: confidence_score} for each enriched field';

-- ============================================================================
-- Silver Enriched Artists
-- Deduplicated and enriched artist data
-- ============================================================================
CREATE TABLE IF NOT EXISTS silver_enriched_artists (
    -- Primary identifier
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Lineage
    bronze_ids UUID[] NOT NULL,             -- All bronze sources for this artist

    -- Canonical fields
    canonical_name TEXT NOT NULL UNIQUE,    -- Deduplicated canonical artist name
    aliases TEXT[],                         -- All known variations
    normalized_name TEXT NOT NULL,          -- Lowercase, stripped for matching

    -- Enriched metadata
    spotify_id TEXT,
    musicbrainz_id TEXT,
    discogs_id TEXT,
    beatport_id TEXT,

    -- Artist details
    genres TEXT[],
    country TEXT,
    bio TEXT,
    image_url TEXT,

    -- Data quality
    validation_status TEXT NOT NULL,
    data_quality_score DECIMAL(3,2),
    enrichment_metadata JSONB NOT NULL,

    -- Deduplication metadata
    deduplication_strategy TEXT,           -- 'manual', 'fuzzy_match', 'id_match'
    merged_artist_ids UUID[],              -- Previous silver IDs that were merged

    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    validated_at TIMESTAMP,
    enriched_at TIMESTAMP,

    -- Constraints
    CONSTRAINT silver_artists_quality_score CHECK (data_quality_score >= 0 AND data_quality_score <= 1),
    CONSTRAINT silver_artists_validation_status CHECK (validation_status IN ('valid', 'warning', 'needs_review', 'failed'))
);

-- Indexes
CREATE INDEX idx_silver_artists_canonical_name ON silver_enriched_artists(canonical_name);
CREATE INDEX idx_silver_artists_normalized_name ON silver_enriched_artists(normalized_name);
CREATE INDEX idx_silver_artists_aliases ON silver_enriched_artists USING gin(aliases);
CREATE INDEX idx_silver_artists_spotify_id ON silver_enriched_artists(spotify_id) WHERE spotify_id IS NOT NULL;
CREATE INDEX idx_silver_artists_musicbrainz_id ON silver_enriched_artists(musicbrainz_id) WHERE musicbrainz_id IS NOT NULL;
CREATE INDEX idx_silver_artists_genres ON silver_enriched_artists USING gin(genres);
CREATE INDEX idx_silver_artists_quality_score ON silver_enriched_artists(data_quality_score DESC);

COMMENT ON TABLE silver_enriched_artists IS 'Silver layer: Deduplicated and enriched artist data with canonical names.';
COMMENT ON COLUMN silver_enriched_artists.normalized_name IS 'Lowercase, trimmed, for fuzzy matching and deduplication';
COMMENT ON COLUMN silver_enriched_artists.merged_artist_ids IS 'Silver artist IDs that were merged into this canonical record';

-- ============================================================================
-- Silver Enriched Playlists
-- Validated and enriched playlist/setlist data
-- ============================================================================
CREATE TABLE IF NOT EXISTS silver_enriched_playlists (
    -- Primary identifier
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Lineage
    bronze_id UUID REFERENCES bronze_scraped_playlists(id) ON DELETE CASCADE,

    -- Validated fields
    playlist_name TEXT NOT NULL,
    artist_id UUID REFERENCES silver_enriched_artists(id) ON DELETE SET NULL,
    artist_name TEXT NOT NULL,

    -- Event details
    event_name TEXT,
    event_date DATE,
    event_location TEXT,
    event_venue TEXT,

    -- Playlist metadata
    track_count INTEGER,
    total_duration_ms BIGINT,

    -- Data quality
    validation_status TEXT NOT NULL,
    data_quality_score DECIMAL(3,2),
    enrichment_metadata JSONB NOT NULL,

    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    validated_at TIMESTAMP,
    enriched_at TIMESTAMP,

    -- Constraints
    CONSTRAINT silver_playlists_quality_score CHECK (data_quality_score >= 0 AND data_quality_score <= 1),
    CONSTRAINT silver_playlists_validation_status CHECK (validation_status IN ('valid', 'warning', 'needs_review', 'failed'))
);

-- Indexes
CREATE INDEX idx_silver_playlists_bronze_id ON silver_enriched_playlists(bronze_id);
CREATE INDEX idx_silver_playlists_artist_id ON silver_enriched_playlists(artist_id) WHERE artist_id IS NOT NULL;
CREATE INDEX idx_silver_playlists_event_date ON silver_enriched_playlists(event_date) WHERE event_date IS NOT NULL;
CREATE INDEX idx_silver_playlists_quality_score ON silver_enriched_playlists(data_quality_score DESC);

COMMENT ON TABLE silver_enriched_playlists IS 'Silver layer: Validated and enriched playlist/setlist data.';

-- ============================================================================
-- Silver Track-Playlist Junction
-- Many-to-many relationship between tracks and playlists with ordering
-- ============================================================================
CREATE TABLE IF NOT EXISTS silver_playlist_tracks (
    -- Composite primary key
    playlist_id UUID REFERENCES silver_enriched_playlists(id) ON DELETE CASCADE,
    track_id UUID REFERENCES silver_enriched_tracks(id) ON DELETE CASCADE,

    -- Track position in playlist
    position INTEGER NOT NULL,

    -- Timing information (if available)
    cue_time_ms BIGINT,                    -- When track starts in mix

    -- Metadata
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),

    PRIMARY KEY (playlist_id, track_id, position)
);

CREATE INDEX idx_silver_playlist_tracks_playlist ON silver_playlist_tracks(playlist_id, position);
CREATE INDEX idx_silver_playlist_tracks_track ON silver_playlist_tracks(track_id);

COMMENT ON TABLE silver_playlist_tracks IS 'Silver layer: Track ordering within playlists with timing metadata.';

-- ============================================================================
-- Trigger: Auto-update updated_at timestamp
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_silver_tracks_updated_at BEFORE UPDATE ON silver_enriched_tracks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_silver_artists_updated_at BEFORE UPDATE ON silver_enriched_artists
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_silver_playlists_updated_at BEFORE UPDATE ON silver_enriched_playlists
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
