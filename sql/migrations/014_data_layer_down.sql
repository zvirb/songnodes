-- Reverses 014_data_layer_up.sql. Dropping the added columns discards values written to them after the
-- upgrade (the legacy JSONB originals are untouched). The waterfall configuration cleanup is not reverted:
-- Spotify audio features are permanently unsupported.
BEGIN;
DROP INDEX IF EXISTS uq_silver_playlists_bronze;
DROP INDEX IF EXISTS uq_bronze_tracks_playlist_position;
DROP INDEX IF EXISTS idx_bronze_tracks_playlist;
ALTER TABLE bronze_scraped_tracks DROP CONSTRAINT IF EXISTS bronze_tracks_position_positive;
ALTER TABLE bronze_scraped_tracks DROP COLUMN IF EXISTS position, DROP COLUMN IF EXISTS playlist_id;
DROP TABLE IF EXISTS backfill_checkpoints;
DROP TABLE IF EXISTS er_decisions;
DROP TABLE IF EXISTS entity_redirects;
DROP TABLE IF EXISTS entity_merge_history;
DROP TABLE IF EXISTS projection_tracks;
DROP TABLE IF EXISTS outbox_dead_letters;
DROP TABLE IF EXISTS outbox_consumers;
DROP TABLE IF EXISTS outbox_events;
DROP TABLE IF EXISTS silver_camelot_corrections;
DROP VIEW IF EXISTS v_metadata_conflicts;
DROP TABLE IF EXISTS silver_track_metadata_evidence;
ALTER TABLE silver_enriched_tracks DROP CONSTRAINT IF EXISTS silver_tracks_energy_canonical_range;
DROP INDEX IF EXISTS idx_silver_tracks_review;
DROP INDEX IF EXISTS idx_silver_tracks_tidal;
DROP INDEX IF EXISTS idx_silver_tracks_deezer;
ALTER TABLE silver_enriched_tracks
    DROP COLUMN IF EXISTS camelot_key,
    DROP COLUMN IF EXISTS record_label,
    DROP COLUMN IF EXISTS mix_name,
    DROP COLUMN IF EXISTS tidal_id,
    DROP COLUMN IF EXISTS deezer_id,
    DROP COLUMN IF EXISTS apple_music_id,
    DROP COLUMN IF EXISTS beatport_id,
    DROP COLUMN IF EXISTS musicbrainz_id,
    DROP COLUMN IF EXISTS metadata_review,
    DROP COLUMN IF EXISTS metadata_review_reasons,
    DROP COLUMN IF EXISTS energy_canonical,
    DROP COLUMN IF EXISTS energy_source,
    DROP COLUMN IF EXISTS energy_calibrated,
    DROP COLUMN IF EXISTS energy_contract_version;
COMMIT;
