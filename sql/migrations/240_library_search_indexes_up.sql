-- 240_library_search_indexes_up.sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS trgm_idx_track_title ON projection_tracks USING GIN (track_title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS trgm_idx_artist_name ON projection_tracks USING GIN (artist_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS trgm_idx_mix_name ON projection_tracks USING GIN (mix_name gin_trgm_ops);
-- array_to_string is only STABLE, so the index needs an IMMUTABLE wrapper; the search query uses the same one.
CREATE OR REPLACE FUNCTION immutable_array_to_string(text[], text) RETURNS text
    LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$ SELECT array_to_string($1, $2) $$;
CREATE INDEX IF NOT EXISTS trgm_idx_silver_artist_aliases ON silver_enriched_artists USING GIN (immutable_array_to_string(aliases, ' ') gin_trgm_ops);
