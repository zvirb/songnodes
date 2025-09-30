-- Migration: Add advanced audio feature columns to tracks_audio_analysis table
-- Date: 2025-09-30
-- Description: Adds timbre, rhythm, mood, and genre analysis fields

-- Add new JSONB columns for advanced features
ALTER TABLE tracks_audio_analysis
ADD COLUMN IF NOT EXISTS timbre_features JSONB,
ADD COLUMN IF NOT EXISTS rhythm_features JSONB,
ADD COLUMN IF NOT EXISTS mood_features JSONB,
ADD COLUMN IF NOT EXISTS genre_prediction JSONB;

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_audio_mood_energy ON tracks_audio_analysis ((mood_features->>'energy'));
CREATE INDEX IF NOT EXISTS idx_audio_mood_valence ON tracks_audio_analysis ((mood_features->>'valence'));
CREATE INDEX IF NOT EXISTS idx_audio_genre ON tracks_audio_analysis ((genre_prediction->>'primary_genre'));
CREATE INDEX IF NOT EXISTS idx_audio_rhythm_complexity ON tracks_audio_analysis ((rhythm_features->>'rhythm_complexity'));

-- Add comments explaining the fields
COMMENT ON COLUMN tracks_audio_analysis.timbre_features IS 'Timbre characteristics: spectral centroid, zero-crossing rate, MFCCs, spectral rolloff/contrast/flatness';
COMMENT ON COLUMN tracks_audio_analysis.rhythm_features IS 'Rhythm analysis: tempogram stats, onset strength, rhythm complexity, pulse clarity, syncopation';
COMMENT ON COLUMN tracks_audio_analysis.mood_features IS 'Mood indicators: energy, valence, arousal, dynamic range, mode, mood category and scores';
COMMENT ON COLUMN tracks_audio_analysis.genre_prediction IS 'Genre classification: primary genre, confidence, and score breakdown for multiple genres';

-- Example query to find energetic tracks with high valence (happy/uplifting)
-- SELECT track_id, mood_features->>'mood_category', mood_features->>'energy'
-- FROM tracks_audio_analysis
-- WHERE (mood_features->>'energy')::float > 0.7
-- AND (mood_features->>'valence')::float > 0.5;