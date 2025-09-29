-- Migration: Add streaming platform IDs to tracks table
-- Version: 004
-- Description: Add missing streaming platform ID columns for enhanced music discovery

-- Add missing streaming platform ID columns to tracks table
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS beatport_id VARCHAR(100);
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS soundcloud_id VARCHAR(100);
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS deezer_id VARCHAR(100);
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS youtube_music_id VARCHAR(100);
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS musicbrainz_id VARCHAR(100);

-- Update tidal_id column to INTEGER type to match TIDAL's integer IDs
-- First check if the column has any data and back it up
DO $$
BEGIN
    -- Check if tidal_id column exists and has data
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tracks' AND column_name = 'tidal_id'
    ) THEN
        -- Create a backup column for existing data
        ALTER TABLE tracks ADD COLUMN IF NOT EXISTS tidal_id_backup VARCHAR(100);

        -- Copy existing data to backup
        UPDATE tracks SET tidal_id_backup = tidal_id WHERE tidal_id IS NOT NULL;

        -- Drop the old column and recreate as INTEGER
        ALTER TABLE tracks DROP COLUMN tidal_id;
        ALTER TABLE tracks ADD COLUMN tidal_id INTEGER;

        -- Try to migrate numeric values back
        UPDATE tracks
        SET tidal_id = CAST(tidal_id_backup AS INTEGER)
        WHERE tidal_id_backup IS NOT NULL
        AND tidal_id_backup ~ '^[0-9]+$';

        -- Keep backup column for manual review of non-numeric values
    ELSE
        -- Column doesn't exist, create it as INTEGER
        ALTER TABLE tracks ADD COLUMN tidal_id INTEGER;
    END IF;
END $$;

-- Create indexes for the new streaming platform ID columns for fast lookups
CREATE INDEX IF NOT EXISTS idx_tracks_beatport_id ON tracks(beatport_id) WHERE beatport_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tracks_soundcloud_id ON tracks(soundcloud_id) WHERE soundcloud_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tracks_deezer_id ON tracks(deezer_id) WHERE deezer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tracks_youtube_music_id ON tracks(youtube_music_id) WHERE youtube_music_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tracks_musicbrainz_id ON tracks(musicbrainz_id) WHERE musicbrainz_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tracks_tidal_id ON tracks(tidal_id) WHERE tidal_id IS NOT NULL;

-- Add the same streaming platform IDs to artists table for consistency
ALTER TABLE artists ADD COLUMN IF NOT EXISTS beatport_id VARCHAR(100);
ALTER TABLE artists ADD COLUMN IF NOT EXISTS deezer_id VARCHAR(100);
ALTER TABLE artists ADD COLUMN IF NOT EXISTS youtube_music_id VARCHAR(100);
ALTER TABLE artists ADD COLUMN IF NOT EXISTS musicbrainz_id VARCHAR(100);
ALTER TABLE artists ADD COLUMN IF NOT EXISTS tidal_id INTEGER;

-- Create indexes for artist streaming platform IDs
CREATE INDEX IF NOT EXISTS idx_artists_beatport_id ON artists(beatport_id) WHERE beatport_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_artists_deezer_id ON artists(deezer_id) WHERE deezer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_artists_youtube_music_id ON artists(youtube_music_id) WHERE youtube_music_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_artists_musicbrainz_id ON artists(musicbrainz_id) WHERE musicbrainz_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_artists_tidal_id ON artists(tidal_id) WHERE tidal_id IS NOT NULL;

-- Create a materialized view for streaming platform coverage analysis
CREATE MATERIALIZED VIEW IF NOT EXISTS streaming_platform_coverage AS
SELECT
    t.id,
    t.title,
    t.normalized_title,
    -- Platform coverage flags
    (spotify_id IS NOT NULL) as has_spotify,
    (apple_music_id IS NOT NULL) as has_apple_music,
    (tidal_id IS NOT NULL) as has_tidal,
    (beatport_id IS NOT NULL) as has_beatport,
    (soundcloud_id IS NOT NULL) as has_soundcloud,
    (deezer_id IS NOT NULL) as has_deezer,
    (youtube_music_id IS NOT NULL) as has_youtube_music,
    (musicbrainz_id IS NOT NULL) as has_musicbrainz,
    -- Count of platforms with IDs
    (
        CASE WHEN spotify_id IS NOT NULL THEN 1 ELSE 0 END +
        CASE WHEN apple_music_id IS NOT NULL THEN 1 ELSE 0 END +
        CASE WHEN tidal_id IS NOT NULL THEN 1 ELSE 0 END +
        CASE WHEN beatport_id IS NOT NULL THEN 1 ELSE 0 END +
        CASE WHEN soundcloud_id IS NOT NULL THEN 1 ELSE 0 END +
        CASE WHEN deezer_id IS NOT NULL THEN 1 ELSE 0 END +
        CASE WHEN youtube_music_id IS NOT NULL THEN 1 ELSE 0 END +
        CASE WHEN musicbrainz_id IS NOT NULL THEN 1 ELSE 0 END
    ) as platform_count,
    -- All platform IDs in JSON format for easy API responses
    jsonb_build_object(
        'spotify_id', spotify_id,
        'apple_music_id', apple_music_id,
        'tidal_id', tidal_id,
        'beatport_id', beatport_id,
        'soundcloud_id', soundcloud_id,
        'deezer_id', deezer_id,
        'youtube_music_id', youtube_music_id,
        'musicbrainz_id', musicbrainz_id
    ) as platform_ids
FROM tracks t
ORDER BY platform_count DESC, t.title;

CREATE UNIQUE INDEX IF NOT EXISTS idx_streaming_platform_coverage_id ON streaming_platform_coverage(id);
CREATE INDEX IF NOT EXISTS idx_streaming_platform_coverage_count ON streaming_platform_coverage(platform_count DESC);

-- Create a function to refresh the materialized view
CREATE OR REPLACE FUNCTION refresh_streaming_platform_coverage()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW streaming_platform_coverage;
END;
$$ LANGUAGE plpgsql;

-- Add a comment to document the migration
COMMENT ON TABLE tracks IS 'Enhanced with streaming platform IDs: Spotify, Apple Music, TIDAL (integer), Beatport, SoundCloud, Deezer, YouTube Music, MusicBrainz';

-- Log the migration completion
DO $$
BEGIN
    RAISE NOTICE 'Migration 004: Streaming platform IDs added successfully';
    RAISE NOTICE 'Added columns: beatport_id, soundcloud_id, deezer_id, youtube_music_id, musicbrainz_id';
    RAISE NOTICE 'Updated tidal_id to INTEGER type with backup of existing data';
    RAISE NOTICE 'Created streaming_platform_coverage materialized view for analytics';
END $$;