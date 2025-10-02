-- Migration 001: Add MusicBrainz IDs and Camelot Keys (Framework Compliance)
-- ============================================================================
--
-- Framework Requirements:
-- 1. MusicBrainz IDs as canonical identifiers (Section 1.1)
-- 2. Camelot keys for harmonic mixing (Section 1.2)
-- 3. UNIQUE constraints on MBID for entity resolution
-- 4. Additional metadata fields for enrichment pipelines

-- ============================================================================
-- Part 1: Add MusicBrainz IDs and UNIQUE constraints
-- ============================================================================

-- Artists table: Add MBID with UNIQUE constraint
ALTER TABLE artists
ADD COLUMN IF NOT EXISTS musicbrainz_id VARCHAR(100) UNIQUE;

-- Create index for fast MBID lookups
CREATE INDEX IF NOT EXISTS idx_artists_musicbrainz_id
ON artists(musicbrainz_id) WHERE musicbrainz_id IS NOT NULL;

-- Songs table: Add MBID with UNIQUE constraint
ALTER TABLE songs
ADD COLUMN IF NOT EXISTS musicbrainz_id VARCHAR(100) UNIQUE;

-- Create index for fast MBID lookups
CREATE INDEX IF NOT EXISTS idx_songs_musicbrainz_id
ON songs(musicbrainz_id) WHERE musicbrainz_id IS NOT NULL;

-- Add ISRC (International Standard Recording Code) if not exists
ALTER TABLE songs
ADD COLUMN IF NOT EXISTS isrc VARCHAR(20);

-- Create index for ISRC lookups (used for MusicBrainz → Spotify linking)
CREATE INDEX IF NOT EXISTS idx_songs_isrc
ON songs(isrc) WHERE isrc IS NOT NULL;

-- ============================================================================
-- Part 2: Add Camelot Wheel keys for harmonic mixing
-- ============================================================================

-- Songs table: Add Camelot key field
ALTER TABLE songs
ADD COLUMN IF NOT EXISTS camelot_key VARCHAR(3);

-- Create index for harmonic compatibility queries
CREATE INDEX IF NOT EXISTS idx_songs_camelot_key
ON songs(camelot_key) WHERE camelot_key IS NOT NULL;

-- Add Spotify key and mode fields (if not exists)
ALTER TABLE songs
ADD COLUMN IF NOT EXISTS spotify_key INTEGER CHECK (spotify_key >= 0 AND spotify_key <= 11);

ALTER TABLE songs
ADD COLUMN IF NOT EXISTS spotify_mode INTEGER CHECK (spotify_mode IN (0, 1));

-- ============================================================================
-- Part 3: Add additional enrichment fields
-- ============================================================================

-- Beatport ID for DJ-centric data
ALTER TABLE songs
ADD COLUMN IF NOT EXISTS beatport_id VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_songs_beatport_id
ON songs(beatport_id) WHERE beatport_id IS NOT NULL;

-- Chart position tracking
ALTER TABLE songs
ADD COLUMN IF NOT EXISTS chart_position INTEGER;

ALTER TABLE songs
ADD COLUMN IF NOT EXISTS chart_genre VARCHAR(100);

ALTER TABLE songs
ADD COLUMN IF NOT EXISTS chart_date DATE;

-- DJ-centric genre (from Beatport)
ALTER TABLE songs
ADD COLUMN IF NOT EXISTS dj_genre VARCHAR(100);

-- Discogs release ID
ALTER TABLE songs
ADD COLUMN IF NOT EXISTS discogs_id VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_songs_discogs_id
ON songs(discogs_id) WHERE discogs_id IS NOT NULL;

-- Catalog number (for Discogs linking)
ALTER TABLE songs
ADD COLUMN IF NOT EXISTS catalog_number VARCHAR(50);

-- ============================================================================
-- Part 4: Add streaming platform IDs (comprehensive coverage)
-- ============================================================================

ALTER TABLE songs
ADD COLUMN IF NOT EXISTS tidal_id VARCHAR(100);

ALTER TABLE songs
ADD COLUMN IF NOT EXISTS apple_music_id VARCHAR(100);

ALTER TABLE songs
ADD COLUMN IF NOT EXISTS soundcloud_id VARCHAR(100);

ALTER TABLE songs
ADD COLUMN IF NOT EXISTS deezer_id VARCHAR(100);

ALTER TABLE songs
ADD COLUMN IF NOT EXISTS youtube_music_id VARCHAR(100);

-- Create composite index for platform ID lookups
CREATE INDEX IF NOT EXISTS idx_songs_platform_ids
ON songs(spotify_id, apple_music_id, tidal_id)
WHERE spotify_id IS NOT NULL OR apple_music_id IS NOT NULL OR tidal_id IS NOT NULL;

-- ============================================================================
-- Part 5: Add audio feature fields (Spotify enrichment)
-- ============================================================================

-- Audio features for DJ analysis
ALTER TABLE songs
ADD COLUMN IF NOT EXISTS energy DECIMAL(3,2) CHECK (energy >= 0 AND energy <= 1);

ALTER TABLE songs
ADD COLUMN IF NOT EXISTS danceability DECIMAL(3,2) CHECK (danceability >= 0 AND danceability <= 1);

ALTER TABLE songs
ADD COLUMN IF NOT EXISTS valence DECIMAL(3,2) CHECK (valence >= 0 AND valence <= 1);

ALTER TABLE songs
ADD COLUMN IF NOT EXISTS acousticness DECIMAL(3,2) CHECK (acousticness >= 0 AND acousticness <= 1);

ALTER TABLE songs
ADD COLUMN IF NOT EXISTS instrumentalness DECIMAL(3,2) CHECK (instrumentalness >= 0 AND instrumentalness <= 1);

ALTER TABLE songs
ADD COLUMN IF NOT EXISTS liveness DECIMAL(3,2) CHECK (liveness >= 0 AND liveness <= 1);

ALTER TABLE songs
ADD COLUMN IF NOT EXISTS speechiness DECIMAL(3,2) CHECK (speechiness >= 0 AND speechiness <= 1);

ALTER TABLE songs
ADD COLUMN IF NOT EXISTS loudness DECIMAL(5,2);

-- Popularity score
ALTER TABLE songs
ADD COLUMN IF NOT EXISTS popularity_score INTEGER CHECK (popularity_score >= 0 AND popularity_score <= 100);

-- ============================================================================
-- Part 6: Add track characteristics flags
-- ============================================================================

ALTER TABLE songs
ADD COLUMN IF NOT EXISTS is_remix BOOLEAN DEFAULT FALSE;

ALTER TABLE songs
ADD COLUMN IF NOT EXISTS is_mashup BOOLEAN DEFAULT FALSE;

ALTER TABLE songs
ADD COLUMN IF NOT EXISTS is_live BOOLEAN DEFAULT FALSE;

ALTER TABLE songs
ADD COLUMN IF NOT EXISTS is_cover BOOLEAN DEFAULT FALSE;

ALTER TABLE songs
ADD COLUMN IF NOT EXISTS is_instrumental BOOLEAN DEFAULT FALSE;

ALTER TABLE songs
ADD COLUMN IF NOT EXISTS is_explicit BOOLEAN DEFAULT FALSE;

-- Remix/version type
ALTER TABLE songs
ADD COLUMN IF NOT EXISTS remix_type VARCHAR(100);

-- ============================================================================
-- Part 7: Add normalized title field for fuzzy matching
-- ============================================================================

ALTER TABLE songs
ADD COLUMN IF NOT EXISTS normalized_title VARCHAR(500);

-- Create trigram index for fuzzy matching (requires pg_trgm extension)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_songs_normalized_title_trgm
ON songs USING gin(normalized_title gin_trgm_ops);

-- ============================================================================
-- Part 8: Add track ID field for cross-source deduplication
-- ============================================================================

-- Deterministic track ID (generated from artist + title + remix type)
ALTER TABLE songs
ADD COLUMN IF NOT EXISTS track_id VARCHAR(16);

-- Create index for fast track_id lookups
CREATE INDEX IF NOT EXISTS idx_songs_track_id
ON songs(track_id) WHERE track_id IS NOT NULL;

-- ============================================================================
-- Part 9: Update playlists table
-- ============================================================================

-- Add playlist type
ALTER TABLE playlists
ADD COLUMN IF NOT EXISTS playlist_type VARCHAR(50);

-- Add external IDs for playlists
ALTER TABLE playlists
ADD COLUMN IF NOT EXISTS spotify_playlist_id VARCHAR(100);

ALTER TABLE playlists
ADD COLUMN IF NOT EXISTS beatport_playlist_id VARCHAR(100);

-- ============================================================================
-- Part 10: Add track_sources table for multi-source tracking
-- ============================================================================

CREATE TABLE IF NOT EXISTS track_sources (
    source_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    song_id UUID REFERENCES songs(song_id) ON DELETE CASCADE,
    source_name VARCHAR(50) NOT NULL,  -- 'spotify', 'musicbrainz', 'beatport', 'mixesdb'
    source_track_id VARCHAR(100),  -- ID in source system
    source_url TEXT,
    confidence_score DECIMAL(3,2),  -- Matching confidence (0.0-1.0)
    discovered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(song_id, source_name, source_track_id)
);

CREATE INDEX IF NOT EXISTS idx_track_sources_song_id
ON track_sources(song_id);

CREATE INDEX IF NOT EXISTS idx_track_sources_source_name
ON track_sources(source_name);

-- ============================================================================
-- Part 11: Create view for harmonic compatibility queries
-- ============================================================================

CREATE OR REPLACE VIEW harmonic_compatible_tracks AS
SELECT
    s1.song_id as track1_id,
    s1.title as track1_title,
    s1.camelot_key as track1_key,
    s2.song_id as track2_id,
    s2.title as track2_title,
    s2.camelot_key as track2_key,
    CASE
        WHEN s1.camelot_key = s2.camelot_key THEN 1.0  -- Perfect match
        WHEN SUBSTRING(s1.camelot_key, 1, LENGTH(s1.camelot_key)-1)::INT IN (
            -- +/- 1 step on wheel
            CASE WHEN SUBSTRING(s2.camelot_key, 1, LENGTH(s2.camelot_key)-1)::INT = 1 THEN 12
                 ELSE SUBSTRING(s2.camelot_key, 1, LENGTH(s2.camelot_key)-1)::INT - 1 END,
            CASE WHEN SUBSTRING(s2.camelot_key, 1, LENGTH(s2.camelot_key)-1)::INT = 12 THEN 1
                 ELSE SUBSTRING(s2.camelot_key, 1, LENGTH(s2.camelot_key)-1)::INT + 1 END
        ) AND SUBSTRING(s1.camelot_key, LENGTH(s1.camelot_key), 1) = SUBSTRING(s2.camelot_key, LENGTH(s2.camelot_key), 1)
        THEN 0.8  -- +/- 1 step
        WHEN SUBSTRING(s1.camelot_key, 1, LENGTH(s1.camelot_key)-1) = SUBSTRING(s2.camelot_key, 1, LENGTH(s2.camelot_key)-1)
             AND SUBSTRING(s1.camelot_key, LENGTH(s1.camelot_key), 1) != SUBSTRING(s2.camelot_key, LENGTH(s2.camelot_key), 1)
        THEN 0.8  -- Relative major/minor
        ELSE 0.0
    END as compatibility_score
FROM songs s1
CROSS JOIN songs s2
WHERE s1.song_id < s2.song_id  -- Avoid duplicates
  AND s1.camelot_key IS NOT NULL
  AND s2.camelot_key IS NOT NULL;

-- ============================================================================
-- Part 12: Add function for Camelot compatibility lookup
-- ============================================================================

CREATE OR REPLACE FUNCTION get_compatible_keys(input_key VARCHAR(3))
RETURNS TABLE(camelot_key VARCHAR(3), compatibility_type VARCHAR(20)) AS $$
BEGIN
    -- Return compatible Camelot keys
    RETURN QUERY
    SELECT
        input_key as camelot_key,
        'perfect'::VARCHAR(20) as compatibility_type
    UNION
    SELECT
        CASE
            WHEN SUBSTRING(input_key, 1, LENGTH(input_key)-1)::INT = 1 THEN '12'
            ELSE (SUBSTRING(input_key, 1, LENGTH(input_key)-1)::INT - 1)::VARCHAR
        END || SUBSTRING(input_key, LENGTH(input_key), 1) as camelot_key,
        'energy_down'::VARCHAR(20) as compatibility_type
    UNION
    SELECT
        CASE
            WHEN SUBSTRING(input_key, 1, LENGTH(input_key)-1)::INT = 12 THEN '1'
            ELSE (SUBSTRING(input_key, 1, LENGTH(input_key)-1)::INT + 1)::VARCHAR
        END || SUBSTRING(input_key, LENGTH(input_key), 1) as camelot_key,
        'energy_up'::VARCHAR(20) as compatibility_type
    UNION
    SELECT
        SUBSTRING(input_key, 1, LENGTH(input_key)-1) ||
        CASE WHEN SUBSTRING(input_key, LENGTH(input_key), 1) = 'A' THEN 'B' ELSE 'A' END as camelot_key,
        'relative'::VARCHAR(20) as compatibility_type;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Validation & Cleanup
-- ============================================================================

-- Update existing songs to have normalized titles
UPDATE songs
SET normalized_title = LOWER(TRIM(title))
WHERE normalized_title IS NULL AND title IS NOT NULL;

-- Migration complete
COMMENT ON TABLE track_sources IS 'Multi-source tracking for cross-platform deduplication (Framework Section 1.1)';
COMMENT ON COLUMN songs.camelot_key IS 'Camelot Wheel notation for harmonic mixing (Framework Section 1.2)';
COMMENT ON COLUMN songs.musicbrainz_id IS 'Canonical MusicBrainz recording ID (Framework Section 1.1)';
COMMENT ON FUNCTION get_compatible_keys IS 'Returns harmonically compatible Camelot keys for DJ mixing (Framework Section 1.2)';
