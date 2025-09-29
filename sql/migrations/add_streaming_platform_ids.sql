-- Migration: Add streaming platform IDs to songs table
-- File: add_streaming_platform_ids.sql
-- Description: Add missing streaming platform ID columns to songs table for enhanced music discovery

-- Add streaming platform ID columns to songs table
ALTER TABLE songs ADD COLUMN tidal_id INTEGER;
ALTER TABLE songs ADD COLUMN beatport_id VARCHAR(100);
ALTER TABLE songs ADD COLUMN apple_music_id VARCHAR(100);
ALTER TABLE songs ADD COLUMN soundcloud_id VARCHAR(100);
ALTER TABLE songs ADD COLUMN deezer_id VARCHAR(100);
ALTER TABLE songs ADD COLUMN youtube_music_id VARCHAR(100);

-- Create indexes for the new streaming platform ID columns for fast lookups
CREATE INDEX IF NOT EXISTS idx_songs_tidal_id ON songs(tidal_id) WHERE tidal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_songs_beatport_id ON songs(beatport_id) WHERE beatport_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_songs_apple_music_id ON songs(apple_music_id) WHERE apple_music_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_songs_soundcloud_id ON songs(soundcloud_id) WHERE soundcloud_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_songs_deezer_id ON songs(deezer_id) WHERE deezer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_songs_youtube_music_id ON songs(youtube_music_id) WHERE youtube_music_id IS NOT NULL;

-- Add comment to document the migration
COMMENT ON COLUMN songs.tidal_id IS 'TIDAL streaming platform track ID (integer)';
COMMENT ON COLUMN songs.beatport_id IS 'Beatport track ID (string)';
COMMENT ON COLUMN songs.apple_music_id IS 'Apple Music track ID (string)';
COMMENT ON COLUMN songs.soundcloud_id IS 'SoundCloud track ID (string)';
COMMENT ON COLUMN songs.deezer_id IS 'Deezer track ID (string)';
COMMENT ON COLUMN songs.youtube_music_id IS 'YouTube Music track ID (string)';

-- Log the migration completion
DO $$
BEGIN
    RAISE NOTICE 'Migration: Streaming platform IDs added successfully to songs table';
    RAISE NOTICE 'Added columns: tidal_id, beatport_id, apple_music_id, soundcloud_id, deezer_id, youtube_music_id';
    RAISE NOTICE 'Created indexes for fast lookups on all new columns';
END $$;

-- ROLLBACK COMMANDS (for reference - not executed):
-- To rollback this migration, run:
-- DROP INDEX IF EXISTS idx_songs_tidal_id;
-- DROP INDEX IF EXISTS idx_songs_beatport_id;
-- DROP INDEX IF EXISTS idx_songs_apple_music_id;
-- DROP INDEX IF EXISTS idx_songs_soundcloud_id;
-- DROP INDEX IF EXISTS idx_songs_deezer_id;
-- DROP INDEX IF EXISTS idx_songs_youtube_music_id;
-- ALTER TABLE songs DROP COLUMN IF EXISTS tidal_id;
-- ALTER TABLE songs DROP COLUMN IF EXISTS beatport_id;
-- ALTER TABLE songs DROP COLUMN IF EXISTS apple_music_id;
-- ALTER TABLE songs DROP COLUMN IF EXISTS soundcloud_id;
-- ALTER TABLE songs DROP COLUMN IF EXISTS deezer_id;
-- ALTER TABLE songs DROP COLUMN IF EXISTS youtube_music_id;