-- 240_library_search_indexes_up.sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS trgm_idx_track_title ON projection_tracks USING GIN (track_title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS trgm_idx_artist_name ON projection_tracks USING GIN (artist_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS trgm_idx_mix_name ON projection_tracks USING GIN (mix_name gin_trgm_ops);
-- Using array_to_string for aliases matching the query
CREATE INDEX IF NOT EXISTS trgm_idx_silver_artist_aliases ON silver_enriched_artists USING GIN (array_to_string(aliases, ' ') gin_trgm_ops);
