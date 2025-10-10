-- ============================================================================
-- Migration: 003 - Gold Layer (Business-Ready Aggregated Data)
-- Description: Create denormalized tables and materialized views optimized
--              for analytics and business intelligence queries
-- ============================================================================

-- ============================================================================
-- Gold Track Analytics
-- Denormalized, query-optimized track data for analytics
-- ============================================================================
CREATE TABLE IF NOT EXISTS gold_track_analytics (
    -- Primary identifier
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Source references (for drill-down)
    silver_track_id UUID REFERENCES silver_enriched_tracks(id) ON DELETE CASCADE,

    -- Denormalized track data
    artist_name TEXT NOT NULL,
    track_title TEXT NOT NULL,
    full_track_name TEXT NOT NULL,         -- "Artist - Track Title" for display

    -- Identifiers (denormalized for joins)
    spotify_id TEXT,
    isrc TEXT,

    -- Musical attributes (denormalized)
    bpm DECIMAL(6,2),
    key TEXT,
    genre_primary TEXT,                     -- Most prominent genre
    genres TEXT[],                          -- All genres
    energy DECIMAL(3,2),
    valence DECIMAL(3,2),
    danceability DECIMAL(3,2),

    -- Aggregated metrics
    play_count INTEGER DEFAULT 0,
    playlist_appearances INTEGER DEFAULT 0,
    last_played_at TIMESTAMP,
    first_seen_at TIMESTAMP,

    -- Harmonic mixing compatibility (precomputed)
    compatible_keys TEXT[],                -- Keys that mix well with this track
    key_family TEXT,                       -- Major/Minor classification

    -- Quality and enrichment
    data_quality_score DECIMAL(3,2),
    enrichment_completeness DECIMAL(3,2), -- % of fields successfully enriched

    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    last_analyzed_at TIMESTAMP,

    -- Constraints
    CONSTRAINT gold_tracks_quality_score CHECK (data_quality_score >= 0 AND data_quality_score <= 1),
    CONSTRAINT gold_tracks_enrichment_completeness CHECK (enrichment_completeness >= 0 AND enrichment_completeness <= 1)
);

-- Indexes optimized for analytics queries
CREATE INDEX idx_gold_tracks_silver_id ON gold_track_analytics(silver_track_id);
CREATE INDEX idx_gold_tracks_artist_name ON gold_track_analytics(artist_name);
CREATE INDEX idx_gold_tracks_spotify_id ON gold_track_analytics(spotify_id) WHERE spotify_id IS NOT NULL;
CREATE INDEX idx_gold_tracks_bpm ON gold_track_analytics(bpm) WHERE bpm IS NOT NULL;
CREATE INDEX idx_gold_tracks_key ON gold_track_analytics(key) WHERE key IS NOT NULL;
CREATE INDEX idx_gold_tracks_genre_primary ON gold_track_analytics(genre_primary) WHERE genre_primary IS NOT NULL;
CREATE INDEX idx_gold_tracks_genres ON gold_track_analytics USING gin(genres);
CREATE INDEX idx_gold_tracks_compatible_keys ON gold_track_analytics USING gin(compatible_keys);
CREATE INDEX idx_gold_tracks_energy ON gold_track_analytics(energy) WHERE energy IS NOT NULL;
CREATE INDEX idx_gold_tracks_playlist_appearances ON gold_track_analytics(playlist_appearances DESC);
CREATE INDEX idx_gold_tracks_quality_score ON gold_track_analytics(data_quality_score DESC);

-- Full-text search optimized
CREATE INDEX idx_gold_tracks_full_search ON gold_track_analytics
    USING gin(to_tsvector('english', full_track_name));

COMMENT ON TABLE gold_track_analytics IS 'Gold layer: Denormalized track data optimized for analytics and reporting.';
COMMENT ON COLUMN gold_track_analytics.compatible_keys IS 'Precomputed Camelot wheel compatible keys for DJ mixing';
COMMENT ON COLUMN gold_track_analytics.enrichment_completeness IS 'Percentage of enrichable fields that have been successfully populated';

-- ============================================================================
-- Gold Artist Analytics
-- Denormalized artist data with aggregated statistics
-- ============================================================================
CREATE TABLE IF NOT EXISTS gold_artist_analytics (
    -- Primary identifier
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Source reference
    silver_artist_id UUID REFERENCES silver_enriched_artists(id) ON DELETE CASCADE,

    -- Denormalized artist data
    artist_name TEXT NOT NULL,
    aliases TEXT[],
    primary_genre TEXT,
    genres TEXT[],

    -- Identifiers
    spotify_id TEXT,
    musicbrainz_id TEXT,
    beatport_id TEXT,

    -- Aggregated statistics
    total_tracks INTEGER DEFAULT 0,
    total_playlists INTEGER DEFAULT 0,
    total_appearances INTEGER DEFAULT 0,    -- Appearances in other artists' playlists
    collaboration_count INTEGER DEFAULT 0,   -- Number of unique collaborators

    -- Musical profile (aggregated from tracks)
    avg_bpm DECIMAL(6,2),
    avg_energy DECIMAL(3,2),
    avg_danceability DECIMAL(3,2),
    most_common_key TEXT,

    -- Popularity metrics
    popularity_score DECIMAL(3,2),          -- Composite popularity metric
    trending_score DECIMAL(3,2),            -- Recent activity trend

    -- Time-based metrics
    first_appearance_date DATE,
    last_appearance_date DATE,
    most_active_year INTEGER,

    -- Quality
    data_quality_score DECIMAL(3,2),

    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    last_calculated_at TIMESTAMP,

    -- Constraints
    CONSTRAINT gold_artists_quality_score CHECK (data_quality_score >= 0 AND data_quality_score <= 1),
    CONSTRAINT gold_artists_popularity_score CHECK (popularity_score >= 0 AND popularity_score <= 1),
    CONSTRAINT gold_artists_trending_score CHECK (trending_score >= 0 AND trending_score <= 1)
);

-- Indexes
CREATE INDEX idx_gold_artists_silver_id ON gold_artist_analytics(silver_artist_id);
CREATE INDEX idx_gold_artists_artist_name ON gold_artist_analytics(artist_name);
CREATE INDEX idx_gold_artists_spotify_id ON gold_artist_analytics(spotify_id) WHERE spotify_id IS NOT NULL;
CREATE INDEX idx_gold_artists_primary_genre ON gold_artist_analytics(primary_genre) WHERE primary_genre IS NOT NULL;
CREATE INDEX idx_gold_artists_total_tracks ON gold_artist_analytics(total_tracks DESC);
CREATE INDEX idx_gold_artists_popularity ON gold_artist_analytics(popularity_score DESC);
CREATE INDEX idx_gold_artists_trending ON gold_artist_analytics(trending_score DESC);

COMMENT ON TABLE gold_artist_analytics IS 'Gold layer: Denormalized artist data with aggregated statistics and popularity metrics.';
COMMENT ON COLUMN gold_artist_analytics.trending_score IS 'Calculated from recent appearance velocity and growth rate';

-- ============================================================================
-- Gold Playlist Analytics
-- Denormalized playlist data with aggregated metrics
-- ============================================================================
CREATE TABLE IF NOT EXISTS gold_playlist_analytics (
    -- Primary identifier
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Source reference
    silver_playlist_id UUID REFERENCES silver_enriched_playlists(id) ON DELETE CASCADE,

    -- Denormalized data
    playlist_name TEXT NOT NULL,
    artist_name TEXT NOT NULL,
    event_name TEXT,
    event_date DATE,
    event_location TEXT,

    -- Aggregated track metrics
    track_count INTEGER DEFAULT 0,
    total_duration_ms BIGINT,
    avg_bpm DECIMAL(6,2),
    avg_energy DECIMAL(3,2),

    -- Genre distribution
    genre_distribution JSONB,               -- {genre: count} for genre breakdown
    primary_genre TEXT,

    -- Key progression analysis
    key_changes INTEGER,                    -- Number of key changes
    harmonic_flow_score DECIMAL(3,2),      -- 0-1: how well keys flow
    energy_curve JSONB,                     -- Energy progression through playlist

    -- Collaboration metrics
    featured_artists TEXT[],                -- All artists in playlist
    collaboration_count INTEGER,            -- Number of different artists

    -- Quality metrics
    data_quality_score DECIMAL(3,2),
    track_identification_rate DECIMAL(3,2), -- % of tracks successfully identified

    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    last_analyzed_at TIMESTAMP,

    -- Constraints
    CONSTRAINT gold_playlists_quality_score CHECK (data_quality_score >= 0 AND data_quality_score <= 1),
    CONSTRAINT gold_playlists_harmonic_flow CHECK (harmonic_flow_score >= 0 AND harmonic_flow_score <= 1),
    CONSTRAINT gold_playlists_track_id_rate CHECK (track_identification_rate >= 0 AND track_identification_rate <= 1)
);

-- Indexes
CREATE INDEX idx_gold_playlists_silver_id ON gold_playlist_analytics(silver_playlist_id);
CREATE INDEX idx_gold_playlists_artist_name ON gold_playlist_analytics(artist_name);
CREATE INDEX idx_gold_playlists_event_date ON gold_playlist_analytics(event_date) WHERE event_date IS NOT NULL;
CREATE INDEX idx_gold_playlists_primary_genre ON gold_playlist_analytics(primary_genre) WHERE primary_genre IS NOT NULL;
CREATE INDEX idx_gold_playlists_harmonic_flow ON gold_playlist_analytics(harmonic_flow_score DESC) WHERE harmonic_flow_score IS NOT NULL;
CREATE INDEX idx_gold_playlists_genre_dist ON gold_playlist_analytics USING gin(genre_distribution);

COMMENT ON TABLE gold_playlist_analytics IS 'Gold layer: Denormalized playlist data with musical analysis and quality metrics.';
COMMENT ON COLUMN gold_playlist_analytics.harmonic_flow_score IS 'Measures how well keys transition using Camelot wheel principles';
COMMENT ON COLUMN gold_playlist_analytics.energy_curve IS 'JSON array tracking energy levels throughout the playlist';

-- ============================================================================
-- Materialized View: Top Tracks by Genre
-- ============================================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS gold_top_tracks_by_genre AS
SELECT
    genre_primary as genre,
    artist_name,
    track_title,
    full_track_name,
    spotify_id,
    playlist_appearances,
    data_quality_score,
    ROW_NUMBER() OVER (PARTITION BY genre_primary ORDER BY playlist_appearances DESC, data_quality_score DESC) as rank_in_genre
FROM gold_track_analytics
WHERE genre_primary IS NOT NULL
  AND data_quality_score >= 0.7
ORDER BY genre_primary, playlist_appearances DESC;

CREATE INDEX idx_gold_top_tracks_genre ON gold_top_tracks_by_genre(genre);
CREATE INDEX idx_gold_top_tracks_rank ON gold_top_tracks_by_genre(genre, rank_in_genre);

COMMENT ON MATERIALIZED VIEW gold_top_tracks_by_genre IS 'Precomputed top tracks per genre for fast leaderboard queries';

-- ============================================================================
-- Materialized View: Artist Collaboration Network
-- ============================================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS gold_artist_collaboration_network AS
SELECT
    a1.artist_name as artist_1,
    a1.spotify_id as artist_1_spotify_id,
    a2.artist_name as artist_2,
    a2.spotify_id as artist_2_spotify_id,
    COUNT(DISTINCT p.silver_playlist_id) as shared_playlists,
    COUNT(DISTINCT t.silver_track_id) as shared_tracks,
    MAX(gp.event_date) as last_collaboration_date
FROM gold_artist_analytics a1
CROSS JOIN gold_artist_analytics a2
JOIN gold_playlist_analytics gp ON (
    gp.artist_name = a1.artist_name OR a1.artist_name = ANY(gp.featured_artists)
)
JOIN silver_enriched_playlists p ON p.id = gp.silver_playlist_id
LEFT JOIN silver_playlist_tracks spt ON spt.playlist_id = p.id
LEFT JOIN gold_track_analytics t ON t.silver_track_id = spt.track_id
WHERE a1.id < a2.id  -- Avoid duplicates
  AND a2.artist_name = ANY(gp.featured_artists)
GROUP BY a1.artist_name, a1.spotify_id, a2.artist_name, a2.spotify_id
HAVING COUNT(DISTINCT p.id) > 0;

CREATE INDEX idx_gold_collab_artist1 ON gold_artist_collaboration_network(artist_1);
CREATE INDEX idx_gold_collab_artist2 ON gold_artist_collaboration_network(artist_2);
CREATE INDEX idx_gold_collab_count ON gold_artist_collaboration_network(shared_playlists DESC);

COMMENT ON MATERIALIZED VIEW gold_artist_collaboration_network IS 'Precomputed artist collaboration graph for network visualization';

-- ============================================================================
-- Materialized View: Harmonic Mixing Recommendations
-- ============================================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS gold_harmonic_mixing_recommendations AS
SELECT
    t1.id as source_track_id,
    t1.full_track_name as source_track,
    t1.key as source_key,
    t1.bpm as source_bpm,
    t1.energy as source_energy,
    t2.id as recommended_track_id,
    t2.full_track_name as recommended_track,
    t2.key as recommended_key,
    t2.bpm as recommended_bpm,
    t2.energy as recommended_energy,
    -- Compatibility score based on key, BPM, and energy
    (
        CASE WHEN t2.key = ANY(t1.compatible_keys) THEN 0.5 ELSE 0.0 END +
        CASE WHEN ABS(t2.bpm - t1.bpm) <= 3 THEN 0.3
             WHEN ABS(t2.bpm - t1.bpm) <= 6 THEN 0.2
             ELSE 0.0 END +
        CASE WHEN ABS(t2.energy - t1.energy) <= 0.1 THEN 0.2
             WHEN ABS(t2.energy - t1.energy) <= 0.2 THEN 0.1
             ELSE 0.0 END
    ) as compatibility_score
FROM gold_track_analytics t1
CROSS JOIN gold_track_analytics t2
WHERE t1.id != t2.id
  AND t1.key IS NOT NULL
  AND t2.key IS NOT NULL
  AND t1.bpm IS NOT NULL
  AND t2.bpm IS NOT NULL
  AND t2.key = ANY(t1.compatible_keys)
  AND ABS(t2.bpm - t1.bpm) <= 10
  AND t1.data_quality_score >= 0.7
  AND t2.data_quality_score >= 0.7
ORDER BY t1.id, compatibility_score DESC;

CREATE INDEX idx_gold_harmonic_source ON gold_harmonic_mixing_recommendations(source_track_id, compatibility_score DESC);
CREATE INDEX idx_gold_harmonic_recommended ON gold_harmonic_mixing_recommendations(recommended_track_id);

COMMENT ON MATERIALIZED VIEW gold_harmonic_mixing_recommendations IS 'Precomputed DJ mixing recommendations based on harmonic compatibility';

-- ============================================================================
-- Functions: Refresh Materialized Views
-- ============================================================================
CREATE OR REPLACE FUNCTION refresh_gold_materialized_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY gold_top_tracks_by_genre;
    REFRESH MATERIALIZED VIEW CONCURRENTLY gold_artist_collaboration_network;
    REFRESH MATERIALIZED VIEW CONCURRENTLY gold_harmonic_mixing_recommendations;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION refresh_gold_materialized_views IS 'Refresh all gold layer materialized views (run periodically via cron/scheduler)';

-- ============================================================================
-- Trigger: Auto-update updated_at timestamp
-- ============================================================================
CREATE TRIGGER update_gold_tracks_updated_at BEFORE UPDATE ON gold_track_analytics
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_gold_artists_updated_at BEFORE UPDATE ON gold_artist_analytics
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_gold_playlists_updated_at BEFORE UPDATE ON gold_playlist_analytics
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
