-- Migration: add non-partial unique index on playlists.source_url
-- Purpose: support INSERT ... ON CONFLICT (source_url) targets used by ETL
CREATE UNIQUE INDEX IF NOT EXISTS idx_playlists_source_url_unique_full ON public.playlists (source_url);
