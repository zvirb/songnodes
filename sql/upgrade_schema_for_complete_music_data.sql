-- ========================================
-- SongNodes Database Schema Upgrade
-- Add missing columns for complete music data
-- ========================================

BEGIN;

-- Clear existing incomplete data
TRUNCATE TABLE track_artists CASCADE;
TRUNCATE TABLE tracks CASCADE;
TRUNCATE TABLE artists CASCADE;

-- Add missing columns to tracks table
ALTER TABLE tracks
ADD COLUMN IF NOT EXISTS isrc VARCHAR(12),
ADD COLUMN IF NOT EXISTS spotify_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS apple_music_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS youtube_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS soundcloud_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS bpm DECIMAL(6,2),
ADD COLUMN IF NOT EXISTS musical_key VARCHAR(10),
ADD COLUMN IF NOT EXISTS energy DECIMAL(4,3),
ADD COLUMN IF NOT EXISTS danceability DECIMAL(4,3),
ADD COLUMN IF NOT EXISTS valence DECIMAL(4,3),
ADD COLUMN IF NOT EXISTS acousticness DECIMAL(4,3),
ADD COLUMN IF NOT EXISTS instrumentalness DECIMAL(4,3),
ADD COLUMN IF NOT EXISTS liveness DECIMAL(4,3),
ADD COLUMN IF NOT EXISTS speechiness DECIMAL(4,3),
ADD COLUMN IF NOT EXISTS loudness DECIMAL(6,2),
ADD COLUMN IF NOT EXISTS release_date DATE,
ADD COLUMN IF NOT EXISTS genre VARCHAR(100),
ADD COLUMN IF NOT EXISTS subgenre VARCHAR(100),
ADD COLUMN IF NOT EXISTS record_label VARCHAR(255),
ADD COLUMN IF NOT EXISTS is_remix BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_mashup BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_live BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_cover BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_instrumental BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_explicit BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS remix_type VARCHAR(100),
ADD COLUMN IF NOT EXISTS original_artist VARCHAR(255),
ADD COLUMN IF NOT EXISTS remixer VARCHAR(255),
ADD COLUMN IF NOT EXISTS popularity_score INTEGER,
ADD COLUMN IF NOT EXISTS play_count BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS metadata JSONB,
ADD COLUMN IF NOT EXISTS search_vector tsvector,
ADD COLUMN IF NOT EXISTS external_urls JSONB,
ADD COLUMN IF NOT EXISTS audio_features JSONB,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Add missing columns to artists table
ALTER TABLE artists
ADD COLUMN IF NOT EXISTS aliases TEXT[],
ADD COLUMN IF NOT EXISTS spotify_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS apple_music_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS youtube_channel_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS soundcloud_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS genre_preferences TEXT[],
ADD COLUMN IF NOT EXISTS country VARCHAR(3),
ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS follower_count BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS monthly_listeners BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS popularity_score INTEGER,
ADD COLUMN IF NOT EXISTS metadata JSONB,
ADD COLUMN IF NOT EXISTS external_urls JSONB,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Enhance track_artists relationship table
ALTER TABLE track_artists
ADD COLUMN IF NOT EXISTS id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'primary',
ADD COLUMN IF NOT EXISTS position INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS contribution_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tracks_genre ON tracks(genre);
CREATE INDEX IF NOT EXISTS idx_tracks_bpm ON tracks(bpm);
CREATE INDEX IF NOT EXISTS idx_tracks_energy ON tracks(energy);
CREATE INDEX IF NOT EXISTS idx_tracks_release_date ON tracks(release_date);
CREATE INDEX IF NOT EXISTS idx_tracks_is_remix ON tracks(is_remix);
CREATE INDEX IF NOT EXISTS idx_tracks_spotify_id ON tracks(spotify_id);
CREATE INDEX IF NOT EXISTS idx_tracks_search_vector ON tracks USING gin(search_vector);

CREATE INDEX IF NOT EXISTS idx_artists_genre_preferences ON artists USING gin(genre_preferences);
CREATE INDEX IF NOT EXISTS idx_artists_spotify_id ON artists(spotify_id);
CREATE INDEX IF NOT EXISTS idx_artists_country ON artists(country);

CREATE INDEX IF NOT EXISTS idx_track_artists_role ON track_artists(role);
CREATE INDEX IF NOT EXISTS idx_track_artists_track_id ON track_artists(track_id);
CREATE INDEX IF NOT EXISTS idx_track_artists_artist_id ON track_artists(artist_id);

-- Create function to update search vectors
CREATE OR REPLACE FUNCTION update_track_search_vector() RETURNS trigger AS $$
BEGIN
    NEW.search_vector := to_tsvector('english',
        COALESCE(NEW.title, '') || ' ' ||
        COALESCE(NEW.genre, '') || ' ' ||
        COALESCE(NEW.subgenre, '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic search vector updates
DROP TRIGGER IF EXISTS update_tracks_search_vector ON tracks;
CREATE TRIGGER update_tracks_search_vector
    BEFORE INSERT OR UPDATE ON tracks
    FOR EACH ROW EXECUTE FUNCTION update_track_search_vector();

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION update_modified_column() RETURNS trigger AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
DROP TRIGGER IF EXISTS update_tracks_updated_at ON tracks;
CREATE TRIGGER update_tracks_updated_at
    BEFORE UPDATE ON tracks
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();

DROP TRIGGER IF EXISTS update_artists_updated_at ON artists;
CREATE TRIGGER update_artists_updated_at
    BEFORE UPDATE ON artists
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- Add constraints
ALTER TABLE tracks
ADD CONSTRAINT chk_energy_range CHECK (energy IS NULL OR (energy >= 0 AND energy <= 1)),
ADD CONSTRAINT chk_danceability_range CHECK (danceability IS NULL OR (danceability >= 0 AND danceability <= 1)),
ADD CONSTRAINT chk_valence_range CHECK (valence IS NULL OR (valence >= 0 AND valence <= 1)),
ADD CONSTRAINT chk_bpm_range CHECK (bpm IS NULL OR (bpm >= 60 AND bpm <= 200)),
ADD CONSTRAINT chk_popularity_range CHECK (popularity_score IS NULL OR (popularity_score >= 0 AND popularity_score <= 100));

ALTER TABLE artists
ADD CONSTRAINT chk_artist_popularity_range CHECK (popularity_score IS NULL OR (popularity_score >= 0 AND popularity_score <= 100));

COMMIT;

-- Verify the upgrade
SELECT 'Schema upgrade completed successfully' as status;
SELECT COUNT(*) as test_artists_count FROM artists;
