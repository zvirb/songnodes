-- MusicDB PostgreSQL Schema
-- Version: 1.0.0
-- Description: Comprehensive schema for music tracklist data

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- Create schema
CREATE SCHEMA IF NOT EXISTS musicdb;
SET search_path TO musicdb, public;

-- ===========================================
-- CORE TABLES
-- ===========================================

-- Artists table
CREATE TABLE IF NOT EXISTS artists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    normalized_name VARCHAR(255) NOT NULL,
    aliases TEXT[],
    spotify_id VARCHAR(100),
    apple_music_id VARCHAR(100),
    soundcloud_id VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}'::JSONB
);

CREATE UNIQUE INDEX idx_artists_normalized_name ON artists(normalized_name);
CREATE INDEX idx_artists_name_trgm ON artists USING gin(name gin_trgm_ops);
CREATE INDEX idx_artists_spotify_id ON artists(spotify_id) WHERE spotify_id IS NOT NULL;
CREATE INDEX idx_artists_metadata ON artists USING gin(metadata);

-- Tracks table
CREATE TABLE IF NOT EXISTS tracks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(500) NOT NULL,
    normalized_title VARCHAR(500) NOT NULL,
    isrc VARCHAR(12),
    spotify_id VARCHAR(100),
    apple_music_id VARCHAR(100),
    tidal_id VARCHAR(100),
    duration_ms INTEGER,
    bpm DECIMAL(5,2),
    key VARCHAR(10),
    energy DECIMAL(3,2),
    danceability DECIMAL(3,2),
    valence DECIMAL(3,2),
    release_date DATE,
    genre VARCHAR(100),
    subgenre VARCHAR(100),
    mashup_components JSONB,
    is_remix BOOLEAN DEFAULT FALSE,
    is_mashup BOOLEAN DEFAULT FALSE,
    is_live BOOLEAN DEFAULT FALSE,
    is_cover BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}'::JSONB
);

CREATE UNIQUE INDEX idx_tracks_isrc ON tracks(isrc) WHERE isrc IS NOT NULL;
CREATE INDEX idx_tracks_normalized_title ON tracks(normalized_title);
CREATE INDEX idx_tracks_title_trgm ON tracks USING gin(title gin_trgm_ops);
CREATE INDEX idx_tracks_spotify_id ON tracks(spotify_id) WHERE spotify_id IS NOT NULL;
CREATE INDEX idx_tracks_genre ON tracks(genre) WHERE genre IS NOT NULL;
CREATE INDEX idx_tracks_release_date ON tracks(release_date) WHERE release_date IS NOT NULL;
CREATE INDEX idx_tracks_mashup_components ON tracks USING gin(mashup_components) WHERE mashup_components IS NOT NULL;
CREATE INDEX idx_tracks_metadata ON tracks USING gin(metadata);

-- Track-Artist relationship table
CREATE TABLE IF NOT EXISTS track_artists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    track_id UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    artist_id UUID NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL CHECK (role IN ('primary', 'featured', 'remixer', 'producer', 'vocalist')),
    position INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(track_id, artist_id, role)
);

CREATE INDEX idx_track_artists_track_id ON track_artists(track_id);
CREATE INDEX idx_track_artists_artist_id ON track_artists(artist_id);
CREATE INDEX idx_track_artists_role ON track_artists(role);

-- Albums table
CREATE TABLE IF NOT EXISTS albums (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    artist_id UUID REFERENCES artists(id),
    release_date DATE,
    label VARCHAR(255),
    spotify_id VARCHAR(100),
    apple_music_id VARCHAR(100),
    total_tracks INTEGER,
    album_type VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}'::JSONB
);

CREATE INDEX idx_albums_artist_id ON albums(artist_id) WHERE artist_id IS NOT NULL;
CREATE INDEX idx_albums_release_date ON albums(release_date) WHERE release_date IS NOT NULL;
CREATE INDEX idx_albums_spotify_id ON albums(spotify_id) WHERE spotify_id IS NOT NULL;

-- Album-Track relationship
CREATE TABLE IF NOT EXISTS album_tracks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    album_id UUID NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
    track_id UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    track_number INTEGER,
    disc_number INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(album_id, track_id)
);

CREATE INDEX idx_album_tracks_album_id ON album_tracks(album_id);
CREATE INDEX idx_album_tracks_track_id ON album_tracks(track_id);

-- ===========================================
-- SETLIST & EVENT TABLES
-- ===========================================

-- DJs/Performers table
CREATE TABLE IF NOT EXISTS performers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    normalized_name VARCHAR(255) NOT NULL,
    artist_id UUID REFERENCES artists(id),
    bio TEXT,
    country VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}'::JSONB
);

CREATE UNIQUE INDEX idx_performers_normalized_name ON performers(normalized_name);
CREATE INDEX idx_performers_artist_id ON performers(artist_id) WHERE artist_id IS NOT NULL;

-- Venues table
CREATE TABLE IF NOT EXISTS venues (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    city VARCHAR(100),
    state VARCHAR(100),
    country VARCHAR(100),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    capacity INTEGER,
    venue_type VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}'::JSONB
);

CREATE INDEX idx_venues_location ON venues(country, state, city);
CREATE INDEX idx_venues_geo ON venues(latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Events/Festivals table
CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    venue_id UUID REFERENCES venues(id),
    event_date DATE,
    event_type VARCHAR(50),
    source VARCHAR(50),
    source_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}'::JSONB
);

CREATE INDEX idx_events_venue_id ON events(venue_id) WHERE venue_id IS NOT NULL;
CREATE INDEX idx_events_event_date ON events(event_date) WHERE event_date IS NOT NULL;
CREATE INDEX idx_events_source ON events(source) WHERE source IS NOT NULL;

-- Setlists table
CREATE TABLE IF NOT EXISTS setlists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    performer_id UUID REFERENCES performers(id),
    event_id UUID REFERENCES events(id),
    set_date TIMESTAMP WITH TIME ZONE,
    set_length_minutes INTEGER,
    source VARCHAR(50) NOT NULL,
    source_url TEXT,
    source_id VARCHAR(255),
    is_complete BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}'::JSONB
);

CREATE INDEX idx_setlists_performer_id ON setlists(performer_id) WHERE performer_id IS NOT NULL;
CREATE INDEX idx_setlists_event_id ON setlists(event_id) WHERE event_id IS NOT NULL;
CREATE INDEX idx_setlists_set_date ON setlists(set_date) WHERE set_date IS NOT NULL;
CREATE INDEX idx_setlists_source ON setlists(source);
CREATE UNIQUE INDEX idx_setlists_source_id ON setlists(source, source_id) WHERE source_id IS NOT NULL;

-- Setlist-Track relationship
CREATE TABLE IF NOT EXISTS setlist_tracks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    setlist_id UUID NOT NULL REFERENCES setlists(id) ON DELETE CASCADE,
    track_id UUID REFERENCES tracks(id),
    position INTEGER NOT NULL,
    track_key VARCHAR(10),
    bpm_live DECIMAL(5,2),
    transition_rating INTEGER CHECK (transition_rating >= 1 AND transition_rating <= 10),
    is_id BOOLEAN DEFAULT FALSE,
    id_text VARCHAR(500),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(setlist_id, position)
);

CREATE INDEX idx_setlist_tracks_setlist_id ON setlist_tracks(setlist_id);
CREATE INDEX idx_setlist_tracks_track_id ON setlist_tracks(track_id) WHERE track_id IS NOT NULL;
CREATE INDEX idx_setlist_tracks_position ON setlist_tracks(setlist_id, position);
CREATE INDEX idx_setlist_tracks_is_id ON setlist_tracks(is_id) WHERE is_id = TRUE;

-- ===========================================
-- PLAYLIST TABLES
-- ===========================================

-- Playlists table
CREATE TABLE IF NOT EXISTS playlists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    source VARCHAR(50),
    source_id VARCHAR(255),
    source_url TEXT,
    curator VARCHAR(255),
    follower_count INTEGER,
    is_public BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}'::JSONB
);

CREATE INDEX idx_playlists_source ON playlists(source) WHERE source IS NOT NULL;
CREATE UNIQUE INDEX idx_playlists_source_id ON playlists(source, source_id) WHERE source_id IS NOT NULL;
CREATE INDEX idx_playlists_curator ON playlists(curator) WHERE curator IS NOT NULL;

-- Playlist-Track relationship
CREATE TABLE IF NOT EXISTS playlist_tracks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    playlist_id UUID NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
    track_id UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    position INTEGER,
    added_at TIMESTAMP WITH TIME ZONE,
    added_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(playlist_id, track_id)
);

CREATE INDEX idx_playlist_tracks_playlist_id ON playlist_tracks(playlist_id);
CREATE INDEX idx_playlist_tracks_track_id ON playlist_tracks(track_id);
CREATE INDEX idx_playlist_tracks_position ON playlist_tracks(playlist_id, position);

-- ===========================================
-- SCRAPING & DATA QUALITY TABLES
-- ===========================================

-- Scraping jobs table
CREATE TABLE IF NOT EXISTS scraping_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source VARCHAR(50) NOT NULL,
    job_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    items_scraped INTEGER DEFAULT 0,
    items_failed INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_scraping_jobs_source ON scraping_jobs(source);
CREATE INDEX idx_scraping_jobs_status ON scraping_jobs(status);
CREATE INDEX idx_scraping_jobs_created_at ON scraping_jobs(created_at DESC);

-- Data quality issues table
CREATE TABLE IF NOT EXISTS data_quality_issues (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID,
    issue_type VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'low',
    description TEXT,
    suggested_fix TEXT,
    is_resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_data_quality_issues_entity ON data_quality_issues(entity_type, entity_id);
CREATE INDEX idx_data_quality_issues_severity ON data_quality_issues(severity) WHERE is_resolved = FALSE;
CREATE INDEX idx_data_quality_issues_unresolved ON data_quality_issues(is_resolved) WHERE is_resolved = FALSE;

-- ===========================================
-- MATERIALIZED VIEWS FOR PERFORMANCE
-- ===========================================

-- Popular tracks materialized view
CREATE MATERIALIZED VIEW popular_tracks AS
SELECT 
    t.id,
    t.title,
    t.normalized_title,
    t.genre,
    t.release_date,
    COUNT(DISTINCT st.setlist_id) as play_count,
    COUNT(DISTINCT s.performer_id) as unique_djs,
    AVG(st.transition_rating) as avg_transition_rating,
    MAX(s.set_date) as last_played,
    MIN(s.set_date) as first_played
FROM tracks t
JOIN setlist_tracks st ON t.id = st.track_id
JOIN setlists s ON st.setlist_id = s.id
GROUP BY t.id
ORDER BY play_count DESC;

CREATE UNIQUE INDEX idx_popular_tracks_id ON popular_tracks(id);
CREATE INDEX idx_popular_tracks_play_count ON popular_tracks(play_count DESC);

-- Artist collaboration network
CREATE MATERIALIZED VIEW artist_collaborations AS
SELECT 
    a1.id as artist1_id,
    a1.name as artist1_name,
    a2.id as artist2_id,
    a2.name as artist2_name,
    COUNT(DISTINCT ta1.track_id) as collaboration_count,
    array_agg(DISTINCT t.title ORDER BY t.title) as track_titles
FROM track_artists ta1
JOIN track_artists ta2 ON ta1.track_id = ta2.track_id AND ta1.artist_id < ta2.artist_id
JOIN artists a1 ON ta1.artist_id = a1.id
JOIN artists a2 ON ta2.artist_id = a2.id
JOIN tracks t ON ta1.track_id = t.id
GROUP BY a1.id, a1.name, a2.id, a2.name
ORDER BY collaboration_count DESC;

CREATE INDEX idx_artist_collaborations_count ON artist_collaborations(collaboration_count DESC);
CREATE INDEX idx_artist_collaborations_artists ON artist_collaborations(artist1_id, artist2_id);

-- ===========================================
-- FUNCTIONS & TRIGGERS
-- ===========================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER update_artists_updated_at BEFORE UPDATE ON artists
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tracks_updated_at BEFORE UPDATE ON tracks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_albums_updated_at BEFORE UPDATE ON albums
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_performers_updated_at BEFORE UPDATE ON performers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_venues_updated_at BEFORE UPDATE ON venues
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON events
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_setlists_updated_at BEFORE UPDATE ON setlists
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_playlists_updated_at BEFORE UPDATE ON playlists
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to normalize text
CREATE OR REPLACE FUNCTION normalize_text(input_text TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN LOWER(TRIM(REGEXP_REPLACE(input_text, '\s+', ' ', 'g')));
END;
$$ language 'plpgsql' IMMUTABLE;

-- Function to extract mashup components
CREATE OR REPLACE FUNCTION extract_mashup_components(mashup_text TEXT)
RETURNS JSONB AS $$
DECLARE
    components JSONB := '[]'::JSONB;
    component TEXT;
BEGIN
    -- Split by common mashup delimiters
    FOREACH component IN ARRAY string_to_array(mashup_text, ' vs. ')
    LOOP
        components := components || jsonb_build_object('track', component, 'type', 'mashup');
    END LOOP;
    RETURN components;
END;
$$ language 'plpgsql' IMMUTABLE;

-- ===========================================
-- INDEXES FOR FULL-TEXT SEARCH
-- ===========================================

-- Add full-text search capabilities
ALTER TABLE tracks ADD COLUMN search_vector tsvector;
UPDATE tracks SET search_vector = to_tsvector('english', coalesce(title, '') || ' ' || coalesce(normalized_title, ''));
CREATE INDEX idx_tracks_search ON tracks USING gin(search_vector);

ALTER TABLE artists ADD COLUMN search_vector tsvector;
UPDATE artists SET search_vector = to_tsvector('english', coalesce(name, '') || ' ' || coalesce(normalized_name, ''));
CREATE INDEX idx_artists_search ON artists USING gin(search_vector);

-- Trigger to update search vectors
CREATE OR REPLACE FUNCTION update_track_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector := to_tsvector('english', coalesce(NEW.title, '') || ' ' || coalesce(NEW.normalized_title, ''));
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_track_search_vector_trigger
BEFORE INSERT OR UPDATE ON tracks
FOR EACH ROW EXECUTE FUNCTION update_track_search_vector();

CREATE OR REPLACE FUNCTION update_artist_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector := to_tsvector('english', coalesce(NEW.name, '') || ' ' || coalesce(NEW.normalized_name, ''));
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_artist_search_vector_trigger
BEFORE INSERT OR UPDATE ON artists
FOR EACH ROW EXECUTE FUNCTION update_artist_search_vector();

-- ===========================================
-- PERMISSIONS
-- ===========================================

-- Create read-only user for analytics
CREATE USER musicdb_readonly WITH PASSWORD 'readonly_secure_pass_2024' LOGIN;
GRANT USAGE ON SCHEMA musicdb TO musicdb_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA musicdb TO musicdb_readonly;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA musicdb TO musicdb_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA musicdb GRANT SELECT ON TABLES TO musicdb_readonly;

-- Create application user with full access
CREATE ROLE musicdb_app;
GRANT ALL ON SCHEMA musicdb TO musicdb_app;
GRANT ALL ON ALL TABLES IN SCHEMA musicdb TO musicdb_app;
GRANT ALL ON ALL SEQUENCES IN SCHEMA musicdb TO musicdb_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA musicdb GRANT ALL ON TABLES TO musicdb_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA musicdb GRANT ALL ON SEQUENCES TO musicdb_app;-- Target Track Searches Table (for orchestrator search tracking)
CREATE TABLE IF NOT EXISTS musicdb.target_track_searches (
    search_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    target_title VARCHAR(500),
    target_artist VARCHAR(255),
    search_query TEXT,
    scraper_name VARCHAR(50),
    results_found INTEGER,
    playlists_containing INTEGER,
    search_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
