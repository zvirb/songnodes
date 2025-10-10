-- Migration: Add Spotify-equivalent audio features column
-- Date: 2025-10-10
-- Description: Adds spotify_features JSONB column to replace deprecated Spotify Audio Features API
--
-- This migration adds self-hosted Spotify-equivalent features:
-- - danceability: Rhythm regularity + beat strength (0-1)
-- - acousticness: Acoustic vs electronic instrument detection (0-1)
-- - instrumentalness: Likelihood of no vocals (0-1)
-- - liveness: Audience/crowd noise presence (0-1)
-- - speechiness: Spoken word content detection (0-1)
-- - key: Musical key (0-11, where 0=C, 1=C#, ..., 11=B)
-- - mode: Major (1) or Minor (0)

-- Set search path to match base schema
SET search_path TO musicdb, public;

-- Add spotify_features column
ALTER TABLE tracks_audio_analysis
ADD COLUMN IF NOT EXISTS spotify_features JSONB;

-- Create indexes for efficient querying of Spotify-equivalent features
CREATE INDEX IF NOT EXISTS idx_audio_danceability ON tracks_audio_analysis ((spotify_features->>'danceability'));
CREATE INDEX IF NOT EXISTS idx_audio_acousticness ON tracks_audio_analysis ((spotify_features->>'acousticness'));
CREATE INDEX IF NOT EXISTS idx_audio_key ON tracks_audio_analysis ((spotify_features->>'key'));
CREATE INDEX IF NOT EXISTS idx_audio_mode ON tracks_audio_analysis ((spotify_features->>'mode'));

-- Add comment explaining the field
COMMENT ON COLUMN tracks_audio_analysis.spotify_features IS 'Self-hosted Spotify-equivalent features: danceability, acousticness, instrumentalness, liveness, speechiness, key, mode. Replaces deprecated Spotify Audio Features API.';

-- Example queries for Spotify-equivalent features:
--
-- Find highly danceable tracks:
-- SELECT track_id, spotify_features->>'danceability' as danceability
-- FROM tracks_audio_analysis
-- WHERE (spotify_features->>'danceability')::float > 0.7;
--
-- Find acoustic tracks in C major:
-- SELECT track_id, spotify_features->>'key', spotify_features->>'mode'
-- FROM tracks_audio_analysis
-- WHERE (spotify_features->>'acousticness')::float > 0.5
-- AND (spotify_features->>'key')::int = 0  -- C
-- AND (spotify_features->>'mode')::int = 1  -- Major
--
-- Find instrumental tracks (no vocals):
-- SELECT track_id, spotify_features->>'instrumentalness'
-- FROM tracks_audio_analysis
-- WHERE (spotify_features->>'instrumentalness')::float > 0.8;
