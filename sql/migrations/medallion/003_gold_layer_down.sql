-- ============================================================================
-- Rollback Migration: 003 - Gold Layer
-- Description: Drop all gold layer tables, materialized views, and functions
-- ============================================================================

-- Drop triggers
DROP TRIGGER IF EXISTS update_gold_playlists_updated_at ON gold_playlist_analytics;
DROP TRIGGER IF EXISTS update_gold_artists_updated_at ON gold_artist_analytics;
DROP TRIGGER IF EXISTS update_gold_tracks_updated_at ON gold_track_analytics;

-- Drop functions
DROP FUNCTION IF EXISTS refresh_gold_materialized_views();

-- Drop materialized views
DROP MATERIALIZED VIEW IF EXISTS gold_harmonic_mixing_recommendations CASCADE;
DROP MATERIALIZED VIEW IF EXISTS gold_artist_collaboration_network CASCADE;
DROP MATERIALIZED VIEW IF EXISTS gold_top_tracks_by_genre CASCADE;

-- Drop tables
DROP TABLE IF EXISTS gold_playlist_analytics CASCADE;
DROP TABLE IF EXISTS gold_artist_analytics CASCADE;
DROP TABLE IF EXISTS gold_track_analytics CASCADE;
