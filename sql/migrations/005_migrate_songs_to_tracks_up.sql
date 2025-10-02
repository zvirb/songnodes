-- Migration: songs/song_artists → tracks/track_artists
-- Version: 005
-- Description: Migrate from legacy schema to modern musicdb schema (01-schema.sql)
-- Date: 2025-10-02

-- This migration transforms the existing songs/song_artists schema to the modern
-- tracks/track_artists schema with proper many-to-many artist relationships.

BEGIN;

-- ============================================================================
-- STEP 0: Ensure required extensions are enabled
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- ============================================================================
-- STEP 1: Drop existing views and create new tables
-- ============================================================================

-- Drop existing tracks view if it exists (will be replaced with table)
DROP VIEW IF EXISTS tracks CASCADE;

-- Tracks table (replaces songs)
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
    acousticness DECIMAL(3,2),
    instrumentalness DECIMAL(3,2),
    liveness DECIMAL(3,2),
    speechiness DECIMAL(3,2),
    loudness DECIMAL(6,2),
    release_date DATE,
    genre VARCHAR(100),
    subgenre VARCHAR(100),
    mashup_components JSONB,
    is_remix BOOLEAN DEFAULT FALSE,
    is_mashup BOOLEAN DEFAULT FALSE,
    is_live BOOLEAN DEFAULT FALSE,
    is_cover BOOLEAN DEFAULT FALSE,
    is_instrumental BOOLEAN DEFAULT FALSE,
    is_explicit BOOLEAN DEFAULT FALSE,
    popularity_score INTEGER,
    play_count BIGINT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}'::JSONB,

    -- Legacy columns for data mapping
    legacy_song_id UUID,

    -- Constraints
    CONSTRAINT tracks_energy_check CHECK (energy >= 0 AND energy <= 1),
    CONSTRAINT tracks_danceability_check CHECK (danceability >= 0 AND danceability <= 1),
    CONSTRAINT tracks_valence_check CHECK (valence >= 0 AND valence <= 1),
    CONSTRAINT tracks_acousticness_check CHECK (acousticness >= 0 AND acousticness <= 1),
    CONSTRAINT tracks_instrumentalness_check CHECK (instrumentalness >= 0 AND instrumentalness <= 1),
    CONSTRAINT tracks_liveness_check CHECK (liveness >= 0 AND liveness <= 1),
    CONSTRAINT tracks_speechiness_check CHECK (speechiness >= 0 AND speechiness <= 1),
    CONSTRAINT tracks_popularity_check CHECK (popularity_score >= 0 AND popularity_score <= 100)
);

-- Track-Artist relationship table (replaces song_artists with enhanced roles)
CREATE TABLE IF NOT EXISTS track_artists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    track_id UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    artist_id UUID NOT NULL REFERENCES artists(artist_id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL DEFAULT 'primary'
        CHECK (role IN ('primary', 'featured', 'remixer', 'producer', 'vocalist')),
    position INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(track_id, artist_id, role)
);

-- Albums table (if not exists)
CREATE TABLE IF NOT EXISTS albums (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    artist_id UUID REFERENCES artists(artist_id),
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

-- ============================================================================
-- STEP 2: Create indexes for new tables
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_tracks_isrc ON tracks(isrc) WHERE isrc IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tracks_normalized_title ON tracks(normalized_title);
CREATE INDEX IF NOT EXISTS idx_tracks_title_trgm ON tracks USING gin(title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_tracks_spotify_id ON tracks(spotify_id) WHERE spotify_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tracks_tidal_id ON tracks(tidal_id) WHERE tidal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tracks_apple_music_id ON tracks(apple_music_id) WHERE apple_music_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tracks_genre ON tracks(genre) WHERE genre IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tracks_release_date ON tracks(release_date) WHERE release_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tracks_mashup_components ON tracks USING gin(mashup_components) WHERE mashup_components IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tracks_metadata ON tracks USING gin(metadata);
CREATE INDEX IF NOT EXISTS idx_tracks_legacy_song_id ON tracks(legacy_song_id) WHERE legacy_song_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tracks_energy ON tracks(energy) WHERE energy IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tracks_danceability ON tracks(danceability) WHERE danceability IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tracks_popularity ON tracks(popularity_score) WHERE popularity_score IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_track_artists_track_id ON track_artists(track_id);
CREATE INDEX IF NOT EXISTS idx_track_artists_artist_id ON track_artists(artist_id);
CREATE INDEX IF NOT EXISTS idx_track_artists_role ON track_artists(role);

CREATE INDEX IF NOT EXISTS idx_albums_artist_id ON albums(artist_id) WHERE artist_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_albums_release_date ON albums(release_date) WHERE release_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_albums_spotify_id ON albums(spotify_id) WHERE spotify_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_album_tracks_album_id ON album_tracks(album_id);
CREATE INDEX IF NOT EXISTS idx_album_tracks_track_id ON album_tracks(track_id);

-- ============================================================================
-- STEP 2.5: Ensure artists table has normalized_name column
-- ============================================================================

-- Add normalized_name column if it doesn't exist
ALTER TABLE artists ADD COLUMN IF NOT EXISTS normalized_name VARCHAR(255);

-- Populate it with normalized values from existing names
UPDATE artists
SET normalized_name = LOWER(TRIM(REGEXP_REPLACE(name, '\s+', ' ', 'g')))
WHERE normalized_name IS NULL;

-- Make it NOT NULL after populating
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'artists' AND column_name = 'normalized_name' AND is_nullable = 'YES'
    ) THEN
        ALTER TABLE artists ALTER COLUMN normalized_name SET NOT NULL;
    END IF;
END $$;

-- Create unique index if it doesn't exist
CREATE UNIQUE INDEX IF NOT EXISTS idx_artists_normalized_name ON artists(normalized_name);

-- ============================================================================
-- STEP 3: Migrate data from songs → tracks
-- ============================================================================

INSERT INTO tracks (
    id,
    title,
    normalized_title,
    isrc,
    spotify_id,
    apple_music_id,
    tidal_id,
    duration_ms,
    bpm,
    key,
    energy,
    danceability,
    valence,
    acousticness,
    instrumentalness,
    liveness,
    speechiness,
    loudness,
    release_date,
    genre,
    is_remix,
    is_mashup,
    is_live,
    is_cover,
    is_instrumental,
    is_explicit,
    popularity_score,
    play_count,
    created_at,
    updated_at,
    legacy_song_id
)
SELECT
    song_id AS id,
    title,
    COALESCE(normalized_title, LOWER(TRIM(REGEXP_REPLACE(title, '\s+', ' ', 'g')))) AS normalized_title,
    isrc,
    spotify_id,
    apple_music_id,
    tidal_id::VARCHAR(100),
    duration_seconds * 1000 AS duration_ms,  -- Convert seconds to milliseconds
    bpm::DECIMAL(5,2),
    key,
    energy::DECIMAL(3,2),
    danceability::DECIMAL(3,2),
    valence::DECIMAL(3,2),
    acousticness::DECIMAL(3,2),
    instrumentalness::DECIMAL(3,2),
    liveness::DECIMAL(3,2),
    speechiness::DECIMAL(3,2),
    loudness::DECIMAL(6,2),
    release_date,
    genre,
    is_remix,
    is_mashup,
    is_live,
    is_cover,
    is_instrumental,
    is_explicit,
    popularity_score,
    play_count,
    created_at,
    updated_at,
    song_id AS legacy_song_id
FROM songs
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- STEP 4: Migrate primary artist relationships
-- ============================================================================

-- Create track_artists entries for primary artists
INSERT INTO track_artists (track_id, artist_id, role, position)
SELECT
    s.song_id AS track_id,
    s.primary_artist_id AS artist_id,
    'primary' AS role,
    0 AS position
FROM songs s
WHERE s.primary_artist_id IS NOT NULL
ON CONFLICT (track_id, artist_id, role) DO NOTHING;

-- ============================================================================
-- STEP 5: Migrate existing song_artists relationships (if any)
-- ============================================================================

-- Migrate existing song_artists entries (currently empty, but future-proof)
INSERT INTO track_artists (track_id, artist_id, role, position)
SELECT
    sa.song_id AS track_id,
    sa.artist_id,
    CASE
        WHEN sa.role = 'performer' THEN 'primary'
        ELSE sa.role
    END AS role,
    0 AS position
FROM song_artists sa
WHERE NOT EXISTS (
    -- Don't duplicate if already created from primary_artist_id
    SELECT 1 FROM track_artists ta
    WHERE ta.track_id = sa.song_id
    AND ta.artist_id = sa.artist_id
    AND ta.role = CASE WHEN sa.role = 'performer' THEN 'primary' ELSE sa.role END
)
ON CONFLICT (track_id, artist_id, role) DO NOTHING;

-- ============================================================================
-- STEP 6: Update triggers and functions for new tables
-- ============================================================================

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_tracks_updated_at ON tracks;
CREATE TRIGGER update_tracks_updated_at
BEFORE UPDATE ON tracks
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_albums_updated_at ON albums;
CREATE TRIGGER update_albums_updated_at
BEFORE UPDATE ON albums
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- STEP 7: Update references in dependent tables
-- ============================================================================

-- Update playlist_tracks to reference tracks instead of songs
ALTER TABLE playlist_tracks DROP CONSTRAINT IF EXISTS playlist_tracks_song_id_fkey;
ALTER TABLE playlist_tracks ADD CONSTRAINT playlist_tracks_track_id_fkey
    FOREIGN KEY (song_id) REFERENCES tracks(id) ON DELETE CASCADE;

-- Update song_adjacency to reference tracks
ALTER TABLE song_adjacency DROP CONSTRAINT IF EXISTS song_adjacency_song_id_1_fkey;
ALTER TABLE song_adjacency DROP CONSTRAINT IF EXISTS song_adjacency_song_id_2_fkey;
ALTER TABLE song_adjacency ADD CONSTRAINT song_adjacency_track_id_1_fkey
    FOREIGN KEY (song_id_1) REFERENCES tracks(id) ON DELETE CASCADE;
ALTER TABLE song_adjacency ADD CONSTRAINT song_adjacency_track_id_2_fkey
    FOREIGN KEY (song_id_2) REFERENCES tracks(id) ON DELETE CASCADE;

-- ============================================================================
-- STEP 8: Create compatibility views (optional - for backward compatibility)
-- ============================================================================

-- View to maintain backward compatibility with old 'songs' queries
CREATE OR REPLACE VIEW songs_compat AS
SELECT
    t.id AS song_id,
    t.title,
    ta.artist_id AS primary_artist_id,
    t.release_date,
    EXTRACT(YEAR FROM t.release_date)::INTEGER AS release_year,
    t.genre,
    t.bpm::INTEGER,
    t.key,
    t.duration_ms / 1000 AS duration_seconds,
    t.spotify_id,
    t.isrc,
    t.created_at,
    t.updated_at,
    t.energy,
    t.danceability,
    t.valence,
    t.normalized_title,
    t.is_remix,
    t.is_mashup,
    t.is_live,
    t.is_cover,
    t.popularity_score,
    t.play_count
FROM tracks t
LEFT JOIN track_artists ta ON t.id = ta.track_id AND ta.role = 'primary';

-- ============================================================================
-- STEP 9: Record migration metadata
-- ============================================================================

-- Create migration log table if it doesn't exist
CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(50) PRIMARY KEY,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    description TEXT
);

INSERT INTO schema_migrations (version, description)
VALUES ('005_migrate_songs_to_tracks', 'Migrated songs/song_artists to tracks/track_artists schema')
ON CONFLICT (version) DO UPDATE SET applied_at = CURRENT_TIMESTAMP;

COMMIT;

-- ============================================================================
-- Migration Summary
-- ============================================================================
-- This migration:
-- 1. Created tracks table with all features from songs + modern schema enhancements
-- 2. Created track_artists junction table with role-based relationships
-- 3. Migrated all 82 existing songs to tracks
-- 4. Created track_artists entries for all primary artists
-- 5. Updated foreign key constraints in dependent tables
-- 6. Created backward compatibility view
-- 7. Preserved legacy_song_id for data lineage
--
-- After this migration:
-- - Old tables (songs, song_artists) still exist but are deprecated
-- - All new inserts should use tracks/track_artists
-- - Backward compatibility maintained via songs_compat view
-- ============================================================================
