-- Music Data Schema for SongNodes
-- This schema creates all necessary tables for storing scraped music data
-- and their relationships for graph visualization

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===========================================
-- CORE ENTITY TABLES
-- ===========================================

-- Artists table
CREATE TABLE IF NOT EXISTS artists (
    artist_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    spotify_id VARCHAR(100),
    musicbrainz_id VARCHAR(100),
    genres TEXT[],
    country VARCHAR(100),
    aliases TEXT[],
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(name)
);

-- Songs/Tracks table
CREATE TABLE IF NOT EXISTS songs (
    song_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(500) NOT NULL,
    primary_artist_id UUID REFERENCES artists(artist_id),
    release_year INTEGER,
    genre VARCHAR(100),
    bpm INTEGER,
    key VARCHAR(10),
    duration_seconds INTEGER,
    spotify_id VARCHAR(100),
    musicbrainz_id VARCHAR(100),
    isrc VARCHAR(20),
    label VARCHAR(255),
    remix_of UUID REFERENCES songs(song_id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Playlists/Setlists table
CREATE TABLE IF NOT EXISTS playlists (
    playlist_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(500) NOT NULL,
    source VARCHAR(100) NOT NULL, -- '1001tracklists', 'mixesdb', 'setlistfm', etc.
    source_url TEXT,
    playlist_type VARCHAR(50), -- 'dj_mix', 'live_set', 'radio_show', 'playlist'
    dj_artist_id UUID REFERENCES artists(artist_id),
    event_name VARCHAR(500),
    venue_id UUID,
    event_date DATE,
    duration_minutes INTEGER,
    tracklist_count INTEGER,
    play_count INTEGER,
    like_count INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Venues table
CREATE TABLE IF NOT EXISTS venues (
    venue_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    city VARCHAR(100),
    country VARCHAR(100),
    capacity INTEGER,
    venue_type VARCHAR(50),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(name, city, country)
);

-- ===========================================
-- RELATIONSHIP TABLES
-- ===========================================

-- Song Artists (many-to-many for features/collaborations)
CREATE TABLE IF NOT EXISTS song_artists (
    song_id UUID REFERENCES songs(song_id) ON DELETE CASCADE,
    artist_id UUID REFERENCES artists(artist_id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'performer', -- 'primary', 'featured', 'remixer', 'producer'
    PRIMARY KEY (song_id, artist_id, role)
);

-- Playlist Songs (tracks in playlists with position)
CREATE TABLE IF NOT EXISTS playlist_songs (
    playlist_id UUID REFERENCES playlists(playlist_id) ON DELETE CASCADE,
    song_id UUID REFERENCES songs(song_id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    transition_rating INTEGER, -- Quality of transition to next track
    energy_level INTEGER, -- Energy level at this point in set
    crowd_reaction VARCHAR(50),
    PRIMARY KEY (playlist_id, position)
);

-- Song Adjacency (which songs appear together frequently)
CREATE TABLE IF NOT EXISTS song_adjacency (
    song_id_1 UUID REFERENCES songs(song_id) ON DELETE CASCADE,
    song_id_2 UUID REFERENCES songs(song_id) ON DELETE CASCADE,
    occurrence_count INTEGER DEFAULT 1,
    avg_distance DECIMAL(3,2), -- Average number of tracks between them
    PRIMARY KEY (song_id_1, song_id_2),
    CHECK (song_id_1 < song_id_2) -- Ensure one-way relationship
);

-- Artist Collaborations
CREATE TABLE IF NOT EXISTS artist_collaborations (
    artist_id_1 UUID REFERENCES artists(artist_id) ON DELETE CASCADE,
    artist_id_2 UUID REFERENCES artists(artist_id) ON DELETE CASCADE,
    collaboration_count INTEGER DEFAULT 1,
    collaboration_type VARCHAR(50), -- 'feature', 'remix', 'b2b', 'versus'
    PRIMARY KEY (artist_id_1, artist_id_2),
    CHECK (artist_id_1 < artist_id_2)
);

-- ===========================================
-- SCRAPING METADATA TABLES
-- ===========================================

-- Scraping runs tracking
CREATE TABLE IF NOT EXISTS scraping_runs (
    run_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scraper_name VARCHAR(50) NOT NULL,
    start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP,
    status VARCHAR(20) DEFAULT 'running',
    tracks_searched INTEGER,
    playlists_found INTEGER,
    songs_added INTEGER,
    artists_added INTEGER,
    errors_count INTEGER DEFAULT 0,
    error_details JSONB
);

-- Target track search results
CREATE TABLE IF NOT EXISTS target_track_searches (
    search_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    target_title VARCHAR(500),
    target_artist VARCHAR(255),
    search_query TEXT,
    scraper_name VARCHAR(50),
    results_found INTEGER,
    playlists_containing INTEGER,
    search_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    run_id UUID REFERENCES scraping_runs(run_id)
);

-- ===========================================
-- GRAPH VISUALIZATION VIEWS
-- ===========================================

-- View for node data (songs and artists)
CREATE OR REPLACE VIEW graph_nodes AS
SELECT
    'song_' || song_id::text as node_id,
    title as label,
    'song' as node_type,
    genre as category,
    release_year,
    COALESCE(
        (SELECT COUNT(*) FROM playlist_songs WHERE song_id = songs.song_id),
        0
    ) as appearance_count
FROM songs
UNION ALL
SELECT
    'artist_' || artist_id::text as node_id,
    name as label,
    'artist' as node_type,
    COALESCE(genres[1], 'Unknown') as category,
    NULL as release_year,
    COALESCE(
        (SELECT COUNT(*) FROM song_artists WHERE artist_id = artists.artist_id),
        0
    ) as appearance_count
FROM artists;

-- View for edge data (relationships)
CREATE OR REPLACE VIEW graph_edges AS
-- Song to Artist edges
SELECT
    'song_' || s.song_id::text as source,
    'artist_' || sa.artist_id::text as target,
    sa.role as edge_type,
    1 as weight
FROM songs s
JOIN song_artists sa ON s.song_id = sa.song_id
UNION ALL
-- Song adjacency edges
SELECT
    'song_' || song_id_1::text as source,
    'song_' || song_id_2::text as target,
    'appears_with' as edge_type,
    occurrence_count as weight
FROM song_adjacency
WHERE occurrence_count > 1
UNION ALL
-- Artist collaboration edges
SELECT
    'artist_' || artist_id_1::text as source,
    'artist_' || artist_id_2::text as target,
    collaboration_type as edge_type,
    collaboration_count as weight
FROM artist_collaborations;

-- ===========================================
-- INDEXES FOR PERFORMANCE
-- ===========================================

CREATE INDEX idx_songs_primary_artist ON songs(primary_artist_id);
CREATE INDEX idx_songs_genre ON songs(genre);
CREATE INDEX idx_songs_year ON songs(release_year);
CREATE INDEX idx_playlists_source ON playlists(source);
CREATE INDEX idx_playlists_dj ON playlists(dj_artist_id);
CREATE INDEX idx_playlists_date ON playlists(event_date);
CREATE INDEX idx_playlist_songs_song ON playlist_songs(song_id);
CREATE INDEX idx_playlist_songs_playlist ON playlist_songs(playlist_id);
CREATE INDEX idx_song_adjacency_counts ON song_adjacency(occurrence_count DESC);

-- ===========================================
-- UTILITY FUNCTIONS
-- ===========================================

-- Function to update song adjacency when a playlist is added
CREATE OR REPLACE FUNCTION update_song_adjacency(p_playlist_id UUID)
RETURNS void AS $$
DECLARE
    v_song_pair RECORD;
BEGIN
    -- Find all pairs of songs in the playlist within 3 positions
    FOR v_song_pair IN
        SELECT
            LEAST(ps1.song_id, ps2.song_id) as song_id_1,
            GREATEST(ps1.song_id, ps2.song_id) as song_id_2,
            ABS(ps1.position - ps2.position) as distance
        FROM playlist_songs ps1
        JOIN playlist_songs ps2 ON ps1.playlist_id = ps2.playlist_id
        WHERE ps1.playlist_id = p_playlist_id
        AND ps1.song_id != ps2.song_id
        AND ABS(ps1.position - ps2.position) <= 3
    LOOP
        INSERT INTO song_adjacency (song_id_1, song_id_2, occurrence_count, avg_distance)
        VALUES (v_song_pair.song_id_1, v_song_pair.song_id_2, 1, v_song_pair.distance)
        ON CONFLICT (song_id_1, song_id_2) DO UPDATE
        SET
            occurrence_count = song_adjacency.occurrence_count + 1,
            avg_distance = (
                (song_adjacency.avg_distance * song_adjacency.occurrence_count + v_song_pair.distance) /
                (song_adjacency.occurrence_count + 1)
            );
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_artists_updated_at BEFORE UPDATE ON artists
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_songs_updated_at BEFORE UPDATE ON songs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_playlists_updated_at BEFORE UPDATE ON playlists
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===========================================
-- INITIAL DATA / STATS VIEW
-- ===========================================

CREATE OR REPLACE VIEW database_stats AS
SELECT
    'songs' as entity_type,
    COUNT(*) as count
FROM songs
UNION ALL
SELECT
    'artists' as entity_type,
    COUNT(*) as count
FROM artists
UNION ALL
SELECT
    'playlists' as entity_type,
    COUNT(*) as count
FROM playlists
UNION ALL
SELECT
    'venues' as entity_type,
    COUNT(*) as count
FROM venues
UNION ALL
SELECT
    'edges' as entity_type,
    (SELECT COUNT(*) FROM song_adjacency) +
    (SELECT COUNT(*) FROM song_artists) +
    (SELECT COUNT(*) FROM artist_collaborations) as count;

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO musicdb_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO musicdb_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO musicdb_user;