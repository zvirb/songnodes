-- Migration Rollback: tracks/track_artists → songs/song_artists
-- Version: 005
-- Description: Rollback migration from modern schema back to legacy schema
-- Date: 2025-10-02

BEGIN;

-- ============================================================================
-- STEP 1: Restore foreign key constraints to original state
-- ============================================================================

-- Restore playlist_tracks constraints
ALTER TABLE playlist_tracks DROP CONSTRAINT IF EXISTS playlist_tracks_track_id_fkey;
ALTER TABLE playlist_tracks ADD CONSTRAINT playlist_tracks_song_id_fkey
    FOREIGN KEY (song_id) REFERENCES songs(song_id) ON DELETE CASCADE;

-- Restore song_adjacency constraints
ALTER TABLE song_adjacency DROP CONSTRAINT IF EXISTS song_adjacency_track_id_1_fkey;
ALTER TABLE song_adjacency DROP CONSTRAINT IF EXISTS song_adjacency_track_id_2_fkey;
ALTER TABLE song_adjacency ADD CONSTRAINT song_adjacency_song_id_1_fkey
    FOREIGN KEY (song_id_1) REFERENCES songs(song_id) ON DELETE CASCADE;
ALTER TABLE song_adjacency ADD CONSTRAINT song_adjacency_song_id_2_fkey
    FOREIGN KEY (song_id_2) REFERENCES songs(song_id) ON DELETE CASCADE;

-- ============================================================================
-- STEP 2: Drop compatibility views
-- ============================================================================

DROP VIEW IF EXISTS songs_compat;

-- ============================================================================
-- STEP 3: Drop new tables (in correct dependency order)
-- ============================================================================

DROP TABLE IF EXISTS album_tracks CASCADE;
DROP TABLE IF EXISTS track_artists CASCADE;
DROP TABLE IF EXISTS albums CASCADE;
DROP TABLE IF EXISTS tracks CASCADE;

-- ============================================================================
-- STEP 4: Remove migration record
-- ============================================================================

DELETE FROM schema_migrations WHERE version = '005_migrate_songs_to_tracks';

COMMIT;

-- ============================================================================
-- Rollback Summary
-- ============================================================================
-- This rollback:
-- 1. Restored original foreign key constraints
-- 2. Dropped compatibility views
-- 3. Dropped new tables (tracks, track_artists, albums, album_tracks)
-- 4. Removed migration record
--
-- After this rollback:
-- - System returns to using songs/song_artists schema
-- - All new data in tracks/track_artists is LOST
-- - Original songs data is preserved
-- ============================================================================
