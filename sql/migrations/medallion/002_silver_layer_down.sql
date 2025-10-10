-- ============================================================================
-- Rollback Migration: 002 - Silver Layer
-- Description: Drop all silver layer tables and triggers
-- ============================================================================

-- Drop triggers
DROP TRIGGER IF EXISTS update_silver_playlists_updated_at ON silver_enriched_playlists;
DROP TRIGGER IF EXISTS update_silver_artists_updated_at ON silver_enriched_artists;
DROP TRIGGER IF EXISTS update_silver_tracks_updated_at ON silver_enriched_tracks;

-- Drop function
DROP FUNCTION IF EXISTS update_updated_at_column();

-- Drop tables in reverse order of creation
DROP TABLE IF EXISTS silver_playlist_tracks CASCADE;
DROP TABLE IF EXISTS silver_enriched_playlists CASCADE;
DROP TABLE IF EXISTS silver_enriched_artists CASCADE;
DROP TABLE IF EXISTS silver_enriched_tracks CASCADE;
