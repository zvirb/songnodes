-- Target-track work queue used by the management UI. Safe to reapply in development.
-- This table is separate from canonical catalog identity/entity-resolution work.
BEGIN;
CREATE TABLE IF NOT EXISTS target_tracks (
    track_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL CHECK (length(trim(title)) > 0),
    artist TEXT NOT NULL CHECK (length(trim(artist)) > 0),
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    genres TEXT[] NOT NULL DEFAULT '{}',
    search_terms TEXT[] NOT NULL DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    archived BOOLEAN NOT NULL DEFAULT FALSE,
    completion_percentage INTEGER NOT NULL DEFAULT 0 CHECK (completion_percentage BETWEEN 0 AND 100),
    last_searched TIMESTAMPTZ,
    playlists_found INTEGER NOT NULL DEFAULT 0,
    adjacencies_found INTEGER NOT NULL DEFAULT 0,
    added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_target_tracks_queue ON target_tracks (archived, is_active, added_at DESC);
COMMIT;
