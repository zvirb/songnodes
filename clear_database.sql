-- Clear all database tables except credentials and target tracks
-- This script uses a transaction to ensure safety

BEGIN;

-- Show row counts before clearing
SELECT 'BEFORE CLEARING - Row Counts:' as status;
SELECT 'api_keys' as table_name, COUNT(*) as rows FROM api_keys
UNION ALL SELECT 'api_key_audit_log', COUNT(*) FROM api_key_audit_log
UNION ALL SELECT 'target_tracks', COUNT(*) FROM target_tracks
UNION ALL SELECT 'albums', COUNT(*) FROM albums
UNION ALL SELECT 'artists', COUNT(*) FROM artists
UNION ALL SELECT 'tracks', COUNT(*) FROM tracks
UNION ALL SELECT 'playlists', COUNT(*) FROM playlists;

-- Disable foreign key constraints temporarily for faster truncation
SET CONSTRAINTS ALL DEFERRED;

-- Clear all tables EXCEPT credentials and target tracks
-- Using TRUNCATE for better performance and to reset sequences
TRUNCATE TABLE album_tracks CASCADE;
TRUNCATE TABLE albums CASCADE;
TRUNCATE TABLE anomaly_detection CASCADE;
TRUNCATE TABLE artists CASCADE;
TRUNCATE TABLE browser_interaction_logs CASCADE;
TRUNCATE TABLE collection_sessions CASCADE;
TRUNCATE TABLE collector_templates CASCADE;
TRUNCATE TABLE data_quality_metrics CASCADE;
TRUNCATE TABLE enrichment_status CASCADE;
TRUNCATE TABLE graph_impact_analysis CASCADE;
TRUNCATE TABLE graph_validation_results CASCADE;
TRUNCATE TABLE normalized_tracks CASCADE;
TRUNCATE TABLE ollama_extraction_jobs CASCADE;
TRUNCATE TABLE playlist_tracks CASCADE;
TRUNCATE TABLE playlists CASCADE;
TRUNCATE TABLE raw_collected_data CASCADE;
TRUNCATE TABLE raw_scrape_data CASCADE;
TRUNCATE TABLE schema_migrations CASCADE;
TRUNCATE TABLE scraping_runs CASCADE;
TRUNCATE TABLE song_adjacency CASCADE;
TRUNCATE TABLE source_extraction_log CASCADE;
TRUNCATE TABLE target_track_searches CASCADE;
TRUNCATE TABLE track_artists CASCADE;
TRUNCATE TABLE tracks CASCADE;
TRUNCATE TABLE transformation_results CASCADE;
TRUNCATE TABLE validation_issues CASCADE;
TRUNCATE TABLE validation_results CASCADE;
TRUNCATE TABLE venues CASCADE;

-- Re-enable foreign key constraints
SET CONSTRAINTS ALL IMMEDIATE;

-- Show row counts after clearing
SELECT 'AFTER CLEARING - Row Counts (Preserved tables):' as status;
SELECT 'api_keys' as table_name, COUNT(*) as rows FROM api_keys
UNION ALL SELECT 'api_key_audit_log', COUNT(*) FROM api_key_audit_log
UNION ALL SELECT 'target_tracks', COUNT(*) FROM target_tracks;

SELECT 'Cleared 28 tables successfully. Preserved: api_keys, api_key_audit_log, target_tracks' as summary;

COMMIT;
