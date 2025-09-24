-- Compatibility Views and Tables for legacy code

SET search_path TO musicdb, public;

-- Create a view named 'songs' that maps to the 'tracks' table
CREATE OR REPLACE VIEW songs AS
SELECT
    id AS song_id,
    title,
    normalized_title,
    isrc,
    spotify_id,
    apple_music_id,
    duration_ms,
    bpm,
    key,
    release_date,
    genre,
    subgenre,
    created_at,
    updated_at,
    metadata
FROM tracks;

-- Create the missing song_adjacency table
CREATE TABLE IF NOT EXISTS song_adjacency (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_track_id UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    target_track_id UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    weight FLOAT DEFAULT 1.0 CHECK (weight >= 0),
    source VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(source_track_id, target_track_id)
);

CREATE INDEX IF NOT EXISTS idx_song_adjacency_source_track_id ON song_adjacency(source_track_id);
CREATE INDEX IF NOT EXISTS idx_song_adjacency_target_track_id ON song_adjacency(target_track_id);

-- Grant permissions to the app user
GRANT SELECT ON songs TO musicdb_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON song_adjacency TO musicdb_app;
