-- ============================================================================
-- Rollback Migration: 001 - Bronze Layer
-- Description: Drop all bronze layer tables
-- ============================================================================

-- Drop tables in reverse order of creation
DROP TABLE IF EXISTS bronze_api_enrichments CASCADE;
DROP TABLE IF EXISTS bronze_scraped_artists CASCADE;
DROP TABLE IF EXISTS bronze_scraped_playlists CASCADE;
DROP TABLE IF EXISTS bronze_scraped_tracks CASCADE;

-- Note: We don't drop the uuid-ossp extension as it may be used by other tables
