-- Rollback migration: drop non-partial unique index on playlists.source_url
DROP INDEX IF EXISTS public.idx_playlists_source_url_unique_full;
