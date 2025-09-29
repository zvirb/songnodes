-- Comprehensive database cleanup - preserve only target_tracks table
-- This removes all scraped/imported data while keeping user configuration

BEGIN;

-- First, let's see what target_tracks data we're preserving
SELECT 'PRESERVING TARGET_TRACKS DATA:' as status;
SELECT
    COUNT(*) as total_targets,
    COUNT(CASE WHEN active = true THEN 1 END) as active_targets
FROM target_tracks;

-- Show sample target tracks being preserved
SELECT track_title, artist_name, search_terms, priority, active
FROM target_tracks
ORDER BY priority DESC, created_at DESC
LIMIT 5;

-- Clean up all data tables (preserve schema and target_tracks)
TRUNCATE TABLE song_adjacency CASCADE;
TRUNCATE TABLE playlist_songs CASCADE;
TRUNCATE TABLE artist_collaborations CASCADE;
TRUNCATE TABLE song_artists CASCADE;
TRUNCATE TABLE songs CASCADE;
TRUNCATE TABLE artists CASCADE;
TRUNCATE TABLE playlists CASCADE;
TRUNCATE TABLE venues CASCADE;

-- Clean up scraping and processing tables
TRUNCATE TABLE scraping_runs CASCADE;
TRUNCATE TABLE source_extraction_log CASCADE;
TRUNCATE TABLE normalized_tracks CASCADE;
TRUNCATE TABLE transformation_results CASCADE;
TRUNCATE TABLE data_lineage CASCADE;

-- Clean up validation and quality tables
TRUNCATE TABLE validation_results CASCADE;
TRUNCATE TABLE validation_issues CASCADE;
TRUNCATE TABLE data_quality_metrics CASCADE;
TRUNCATE TABLE graph_validation_results CASCADE;
TRUNCATE TABLE graph_impact_analysis CASCADE;

-- Clean up analysis and discovery tables
TRUNCATE TABLE playlist_discovery CASCADE;
TRUNCATE TABLE anomaly_detection CASCADE;
TRUNCATE TABLE pipeline_execution_metrics CASCADE;

-- Keep target_tracks and target_track_searches as these are user configuration
-- TRUNCATE TABLE target_tracks CASCADE; -- DON'T DELETE THIS
-- TRUNCATE TABLE target_track_searches CASCADE; -- DON'T DELETE THIS

-- Reset sequences for fresh start
SELECT setval('songs_song_id_seq', 1, false);
SELECT setval('artists_artist_id_seq', 1, false);
SELECT setval('playlists_playlist_id_seq', 1, false);
SELECT setval('venues_venue_id_seq', 1, false);

-- Show final state
SELECT 'DATABASE CLEANUP COMPLETE:' as status;

SELECT
    'target_tracks' as table_name,
    COUNT(*) as preserved_records
FROM target_tracks
UNION ALL
SELECT
    'target_track_searches' as table_name,
    COUNT(*) as preserved_records
FROM target_track_searches
UNION ALL
SELECT
    'songs' as table_name,
    COUNT(*) as remaining_records
FROM songs
UNION ALL
SELECT
    'artists' as table_name,
    COUNT(*) as remaining_records
FROM artists
UNION ALL
SELECT
    'song_adjacency' as table_name,
    COUNT(*) as remaining_records
FROM song_adjacency;

COMMIT;

SELECT 'SUCCESS: Database cleaned - target_tracks preserved!' as result;