-- 240_library_search_indexes_down.sql
DROP INDEX IF EXISTS trgm_idx_silver_artist_aliases;
DROP INDEX IF EXISTS trgm_idx_mix_name;
DROP INDEX IF EXISTS trgm_idx_artist_name;
DROP INDEX IF EXISTS trgm_idx_track_title;
DROP FUNCTION IF EXISTS immutable_array_to_string(text[], text);
