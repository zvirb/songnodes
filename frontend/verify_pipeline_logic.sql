-- Verification script to ensure proper pipeline separation
-- This verifies that target_tracks remain separate from visualization data

BEGIN;

-- Check current state: target_tracks should exist but NOT be in songs table
SELECT 'CURRENT PIPELINE STATE:' as status;

SELECT 'target_tracks' as table_name, COUNT(*) as count FROM target_tracks
UNION ALL
SELECT 'songs' as table_name, COUNT(*) as count FROM songs
UNION ALL
SELECT 'artists' as table_name, COUNT(*) as count FROM artists
UNION ALL
SELECT 'song_adjacency' as table_name, COUNT(*) as count FROM song_adjacency
UNION ALL
SELECT 'playlists' as table_name, COUNT(*) as count FROM playlists
UNION ALL
SELECT 'playlist_songs' as table_name, COUNT(*) as count FROM playlist_songs;

-- Verify target_tracks are NOT appearing as visualization nodes
SELECT 'VERIFICATION: Target tracks should NOT appear in songs table' as check_name;

WITH target_titles AS (
  SELECT DISTINCT LOWER(TRIM(title)) as title, LOWER(TRIM(artist)) as artist
  FROM target_tracks
),
song_titles AS (
  SELECT LOWER(TRIM(s.title)) as title, LOWER(TRIM(a.name)) as artist
  FROM songs s
  LEFT JOIN artists a ON s.primary_artist_id = a.artist_id
)
SELECT
  CASE
    WHEN COUNT(*) = 0 THEN '✅ PASS: No target tracks found in songs table'
    ELSE '❌ FAIL: ' || COUNT(*) || ' target tracks incorrectly imported as songs'
  END as result
FROM target_titles tt
JOIN song_titles st ON tt.title = st.title AND tt.artist = st.artist;

-- Show sample target tracks (these should remain as search targets only)
SELECT 'SAMPLE TARGET TRACKS (search targets only):' as info;
SELECT title, artist, priority, is_active
FROM target_tracks
WHERE is_active = true
ORDER BY priority DESC, title
LIMIT 10;

-- Verify rich metadata fields are available for when tracks ARE scraped
SELECT 'SONGS TABLE SCHEMA (ready for rich metadata):' as info;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'songs'
AND table_schema = 'public'
AND column_name IN ('bpm', 'key', 'genre', 'duration_seconds', 'release_year', 'spotify_id', 'musicbrainz_id')
ORDER BY column_name;

-- Verify adjacency function will work correctly when tracklists are scraped
SELECT 'ADJACENCY FUNCTION STATUS:' as info;
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_name = 'update_song_adjacency';

COMMIT;

SELECT 'PIPELINE VERIFICATION COMPLETE!' as result;