-- Migration: Add track_id column to songs table for cross-source deduplication
-- Date: 2025-09-30
-- Purpose: Enable deterministic track identification across different sources (1001tracklists, Spotify, MixesDB, etc.)
--          Same track from different sources → same track_id
--          Different remixes → different track_ids

-- Step 1: Add track_id column (VARCHAR 16-char hex string from SHA-256 hash)
ALTER TABLE songs
ADD COLUMN IF NOT EXISTS track_id VARCHAR(16);

-- Step 2: Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_songs_track_id ON songs(track_id);

-- Step 3: Backfill track_id for existing songs (optional - can be done in application code)
-- This requires the track_id_generator Python module, so it's better to do in application code
-- Example Python code to backfill:
--
-- from track_id_generator import generate_track_id
-- for song in songs:
--     track_id = generate_track_id(
--         title=song['title'],
--         primary_artist=song['primary_artist_name'],
--         is_remix=song['is_remix'],
--         remix_type=song['remix_type']
--     )
--     UPDATE songs SET track_id = track_id WHERE song_id = song['song_id']

-- Step 4: Add unique constraint on track_id (after backfilling)
-- This prevents duplicate track_ids in the database
-- ALTER TABLE songs ADD CONSTRAINT unique_track_id UNIQUE (track_id);
-- NOTE: Commented out for now - apply after backfill is complete

-- Verification queries:
-- 1. Check track_id column exists
SELECT column_name, data_type, character_maximum_length
FROM information_schema.columns
WHERE table_name = 'songs' AND column_name = 'track_id';

-- 2. Check index exists
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'songs' AND indexname = 'idx_songs_track_id';

-- 3. Sample track_id values
SELECT song_id, title, primary_artist_id, track_id
FROM songs
LIMIT 10;

-- 4. Check for duplicates (should be 0 after proper implementation)
SELECT track_id, COUNT(*) as count
FROM songs
WHERE track_id IS NOT NULL
GROUP BY track_id
HAVING COUNT(*) > 1;