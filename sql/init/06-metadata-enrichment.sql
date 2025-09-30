-- Metadata Enrichment Schema Extensions
-- Adds fields and tables for comprehensive metadata enrichment pipeline
-- Version: 1.0.0

-- ===========================================
-- ENRICHMENT STATUS TABLE
-- ===========================================

-- Track enrichment status tracking
CREATE TABLE IF NOT EXISTS enrichment_status (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    track_id UUID NOT NULL UNIQUE REFERENCES tracks(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'partial', 'failed')),
    sources_enriched INTEGER DEFAULT 0,
    last_attempt TIMESTAMP WITH TIME ZONE,
    retry_count INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_enrichment_status_track_id ON enrichment_status(track_id);
CREATE INDEX idx_enrichment_status_status ON enrichment_status(status);
CREATE INDEX idx_enrichment_status_last_attempt ON enrichment_status(last_attempt DESC);
CREATE INDEX idx_enrichment_status_pending ON enrichment_status(status) WHERE status IN ('pending', 'partial');

-- Trigger for updated_at
CREATE TRIGGER update_enrichment_status_updated_at
    BEFORE UPDATE ON enrichment_status
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===========================================
-- API RESPONSE CACHE TABLE
-- ===========================================

-- Cache API responses to minimize external calls and respect rate limits
CREATE TABLE IF NOT EXISTS api_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cache_key VARCHAR(500) NOT NULL UNIQUE,
    api_source VARCHAR(50) NOT NULL CHECK (api_source IN ('spotify', 'musicbrainz', 'discogs', 'beatport', 'lastfm')),
    endpoint VARCHAR(255) NOT NULL,
    request_params JSONB,
    response_data JSONB NOT NULL,
    status_code INTEGER NOT NULL,
    ttl_seconds INTEGER NOT NULL DEFAULT 604800, -- 7 days default
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    hit_count INTEGER DEFAULT 0,
    last_accessed TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_api_cache_key ON api_cache(cache_key);
CREATE INDEX idx_api_cache_source ON api_cache(api_source);
CREATE INDEX idx_api_cache_expires_at ON api_cache(expires_at);
CREATE INDEX idx_api_cache_endpoint ON api_cache(api_source, endpoint);

-- Function to auto-delete expired cache entries
CREATE OR REPLACE FUNCTION delete_expired_cache()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM api_cache WHERE expires_at < CURRENT_TIMESTAMP;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger to clean up expired cache (runs on insert)
CREATE TRIGGER cleanup_expired_cache
    AFTER INSERT ON api_cache
    EXECUTE FUNCTION delete_expired_cache();

-- ===========================================
-- ENHANCED METADATA FIELDS FOR TRACKS
-- ===========================================

-- Add additional metadata fields if they don't exist
DO $$
BEGIN
    -- Audio features
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tracks' AND column_name='acousticness') THEN
        ALTER TABLE tracks ADD COLUMN acousticness DECIMAL(3,2);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tracks' AND column_name='instrumentalness') THEN
        ALTER TABLE tracks ADD COLUMN instrumentalness DECIMAL(3,2);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tracks' AND column_name='liveness') THEN
        ALTER TABLE tracks ADD COLUMN liveness DECIMAL(3,2);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tracks' AND column_name='speechiness') THEN
        ALTER TABLE tracks ADD COLUMN speechiness DECIMAL(3,2);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tracks' AND column_name='loudness') THEN
        ALTER TABLE tracks ADD COLUMN loudness DECIMAL(6,3);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tracks' AND column_name='tempo_confidence') THEN
        ALTER TABLE tracks ADD COLUMN tempo_confidence DECIMAL(3,2);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tracks' AND column_name='time_signature') THEN
        ALTER TABLE tracks ADD COLUMN time_signature INTEGER;
    END IF;

    -- Harmonic mixing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tracks' AND column_name='camelot_key') THEN
        ALTER TABLE tracks ADD COLUMN camelot_key VARCHAR(3);
    END IF;

    -- Identifiers
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tracks' AND column_name='musicbrainz_id') THEN
        ALTER TABLE tracks ADD COLUMN musicbrainz_id VARCHAR(100);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tracks' AND column_name='discogs_id') THEN
        ALTER TABLE tracks ADD COLUMN discogs_id VARCHAR(100);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tracks' AND column_name='beatport_id') THEN
        ALTER TABLE tracks ADD COLUMN beatport_id VARCHAR(100);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tracks' AND column_name='lastfm_url') THEN
        ALTER TABLE tracks ADD COLUMN lastfm_url TEXT;
    END IF;

    -- Release metadata
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tracks' AND column_name='label') THEN
        ALTER TABLE tracks ADD COLUMN label VARCHAR(255);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tracks' AND column_name='catalog_number') THEN
        ALTER TABLE tracks ADD COLUMN catalog_number VARCHAR(100);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tracks' AND column_name='release_country') THEN
        ALTER TABLE tracks ADD COLUMN release_country VARCHAR(100);
    END IF;

    -- Popularity metrics
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tracks' AND column_name='spotify_popularity') THEN
        ALTER TABLE tracks ADD COLUMN spotify_popularity INTEGER;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tracks' AND column_name='lastfm_playcount') THEN
        ALTER TABLE tracks ADD COLUMN lastfm_playcount INTEGER;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tracks' AND column_name='lastfm_listeners') THEN
        ALTER TABLE tracks ADD COLUMN lastfm_listeners INTEGER;
    END IF;

    -- Relationships
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tracks' AND column_name='remix_of_track_id') THEN
        ALTER TABLE tracks ADD COLUMN remix_of_track_id UUID REFERENCES tracks(id);
    END IF;

    -- Preview/sample URLs
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tracks' AND column_name='preview_url') THEN
        ALTER TABLE tracks ADD COLUMN preview_url TEXT;
    END IF;

    -- Structural analysis
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tracks' AND column_name='intro_duration_ms') THEN
        ALTER TABLE tracks ADD COLUMN intro_duration_ms INTEGER;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tracks' AND column_name='outro_duration_ms') THEN
        ALTER TABLE tracks ADD COLUMN outro_duration_ms INTEGER;
    END IF;

    -- Enrichment tracking
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tracks' AND column_name='enriched_at') THEN
        ALTER TABLE tracks ADD COLUMN enriched_at TIMESTAMP WITH TIME ZONE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tracks' AND column_name='enrichment_sources') THEN
        ALTER TABLE tracks ADD COLUMN enrichment_sources TEXT[];
    END IF;
END$$;

-- ===========================================
-- INDEXES FOR NEW FIELDS
-- ===========================================

CREATE INDEX IF NOT EXISTS idx_tracks_musicbrainz_id ON tracks(musicbrainz_id) WHERE musicbrainz_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tracks_discogs_id ON tracks(discogs_id) WHERE discogs_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tracks_beatport_id ON tracks(beatport_id) WHERE beatport_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tracks_camelot_key ON tracks(camelot_key) WHERE camelot_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tracks_label ON tracks(label) WHERE label IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tracks_spotify_popularity ON tracks(spotify_popularity DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_tracks_enriched_at ON tracks(enriched_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_tracks_remix_of ON tracks(remix_of_track_id) WHERE remix_of_track_id IS NOT NULL;

-- ===========================================
-- ARTIST ENRICHMENT FIELDS
-- ===========================================

DO $$
BEGIN
    -- MusicBrainz artist ID
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='artists' AND column_name='musicbrainz_id') THEN
        ALTER TABLE artists ADD COLUMN musicbrainz_id VARCHAR(100);
    END IF;

    -- Discogs artist ID
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='artists' AND column_name='discogs_id') THEN
        ALTER TABLE artists ADD COLUMN discogs_id VARCHAR(100);
    END IF;

    -- Artist country
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='artists' AND column_name='country') THEN
        ALTER TABLE artists ADD COLUMN country VARCHAR(100);
    END IF;

    -- Artist genres
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='artists' AND column_name='genres') THEN
        ALTER TABLE artists ADD COLUMN genres TEXT[];
    END IF;

    -- Artist image URL
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='artists' AND column_name='image_url') THEN
        ALTER TABLE artists ADD COLUMN image_url TEXT;
    END IF;

    -- Spotify popularity
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='artists' AND column_name='spotify_popularity') THEN
        ALTER TABLE artists ADD COLUMN spotify_popularity INTEGER;
    END IF;

    -- Spotify followers
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='artists' AND column_name='spotify_followers') THEN
        ALTER TABLE artists ADD COLUMN spotify_followers INTEGER;
    END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_artists_musicbrainz_id ON artists(musicbrainz_id) WHERE musicbrainz_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_artists_discogs_id ON artists(discogs_id) WHERE discogs_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_artists_country ON artists(country) WHERE country IS NOT NULL;

-- ===========================================
-- MATERIALIZED VIEW: ENRICHMENT STATISTICS
-- ===========================================

CREATE MATERIALIZED VIEW IF NOT EXISTS enrichment_statistics AS
SELECT
    COUNT(*) as total_tracks,
    COUNT(spotify_id) as with_spotify_id,
    COUNT(isrc) as with_isrc,
    COUNT(musicbrainz_id) as with_musicbrainz_id,
    COUNT(discogs_id) as with_discogs_id,
    COUNT(bpm) as with_bpm,
    COUNT(key) as with_key,
    COUNT(camelot_key) as with_camelot_key,
    COUNT(energy) as with_energy,
    COUNT(danceability) as with_danceability,
    COUNT(valence) as with_valence,
    COUNT(acousticness) as with_acousticness,
    COUNT(label) as with_label,
    COUNT(spotify_popularity) as with_spotify_popularity,
    COUNT(lastfm_playcount) as with_lastfm_playcount,
    ROUND(AVG(CASE WHEN spotify_id IS NOT NULL THEN 1 ELSE 0 END) * 100, 2) as spotify_coverage_pct,
    ROUND(AVG(CASE WHEN musicbrainz_id IS NOT NULL THEN 1 ELSE 0 END) * 100, 2) as musicbrainz_coverage_pct,
    ROUND(AVG(CASE WHEN bpm IS NOT NULL THEN 1 ELSE 0 END) * 100, 2) as bpm_coverage_pct,
    ROUND(AVG(CASE WHEN energy IS NOT NULL THEN 1 ELSE 0 END) * 100, 2) as audio_features_coverage_pct,
    MAX(enriched_at) as last_enriched_at,
    COUNT(CASE WHEN enriched_at IS NOT NULL THEN 1 END) as tracks_enriched
FROM tracks;

CREATE UNIQUE INDEX IF NOT EXISTS idx_enrichment_statistics_refresh ON enrichment_statistics((1));

-- ===========================================
-- FUNCTION: Refresh enrichment statistics
-- ===========================================

CREATE OR REPLACE FUNCTION refresh_enrichment_statistics()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY enrichment_statistics;
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- COMMENTS FOR DOCUMENTATION
-- ===========================================

COMMENT ON TABLE enrichment_status IS 'Tracks enrichment progress and status for metadata pipeline';
COMMENT ON TABLE api_cache IS 'Cache for external API responses to minimize calls and respect rate limits';
COMMENT ON COLUMN tracks.camelot_key IS 'Camelot Wheel notation for harmonic mixing (e.g., 8A, 12B)';
COMMENT ON COLUMN tracks.musicbrainz_id IS 'MusicBrainz Recording MBID';
COMMENT ON COLUMN tracks.discogs_id IS 'Discogs release or master ID';
COMMENT ON COLUMN tracks.enrichment_sources IS 'Array of API sources used for enrichment (spotify, musicbrainz, discogs, etc.)';
COMMENT ON COLUMN tracks.remix_of_track_id IS 'Reference to original track if this is a remix';
COMMENT ON MATERIALIZED VIEW enrichment_statistics IS 'Aggregate statistics on metadata enrichment coverage';

-- ===========================================
-- GRANT PERMISSIONS
-- ===========================================

GRANT SELECT, INSERT, UPDATE, DELETE ON enrichment_status TO musicdb_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON api_cache TO musicdb_user;
GRANT SELECT ON enrichment_statistics TO musicdb_user;
GRANT SELECT ON enrichment_statistics TO musicdb_readonly;