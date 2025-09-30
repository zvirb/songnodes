-- Migration: Create track_sources table for multi-source aggregation
-- Date: 2025-09-30
-- Purpose: Track which sources (platforms) have each track for cross-source popularity aggregation
--          Enables:
--          - Track which platforms have this track (1001tracklists, Spotify, MixesDB, etc.)
--          - Aggregate popularity across sources
--          - Verify data consistency between sources
--          - Track discovery timeline

CREATE TABLE IF NOT EXISTS track_sources (
    track_id VARCHAR(16) NOT NULL,  -- References songs.track_id (deterministic hash)
    source VARCHAR(50) NOT NULL,    -- Platform name: '1001tracklists', 'spotify', 'mixesdb', 'setlistfm', etc.
    source_track_id VARCHAR(255),   -- Platform-specific ID (e.g., Spotify track URI, MusicBrainz ID)
    source_url TEXT,                -- URL to track on source platform
    discovered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,  -- When we first found this track on this source
    last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,   -- When we last confirmed track still exists on source

    -- Metadata from source
    play_count INTEGER,             -- Play count from source (if available)
    popularity_score FLOAT,         -- Popularity score from source (normalized 0-100)
    chart_position INTEGER,         -- Chart position if track is charting
    source_metadata JSONB,          -- Additional source-specific metadata

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    PRIMARY KEY (track_id, source),

    -- Foreign key to songs table (track_id)
    -- Note: This assumes track_id is populated in songs table
    -- Uncomment after track_id backfill is complete:
    -- FOREIGN KEY (track_id) REFERENCES songs(track_id) ON DELETE CASCADE,

    -- Check constraints
    CONSTRAINT check_valid_source CHECK (source IN (
        '1001tracklists', 'mixesdb', 'setlistfm', 'spotify', 'apple_music',
        'soundcloud', 'youtube_music', 'beatport', 'tidal', 'deezer',
        'musicbrainz', 'discogs', 'reddit', 'jambase', 'watchthedj'
    ))
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_track_sources_track_id ON track_sources(track_id);
CREATE INDEX IF NOT EXISTS idx_track_sources_source ON track_sources(source);
CREATE INDEX IF NOT EXISTS idx_track_sources_discovered_at ON track_sources(discovered_at DESC);
CREATE INDEX IF NOT EXISTS idx_track_sources_popularity ON track_sources(popularity_score DESC NULLS LAST);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_track_sources_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    NEW.last_seen_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_track_sources_updated_at
    BEFORE UPDATE ON track_sources
    FOR EACH ROW
    EXECUTE FUNCTION update_track_sources_updated_at();

-- Verification queries:
-- 1. Check table exists
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_name = 'track_sources'
ORDER BY ordinal_position;

-- 2. Check indexes
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'track_sources';

-- 3. Check constraints
SELECT conname, contype, conrelid::regclass
FROM pg_constraint
WHERE conrelid = 'track_sources'::regclass;

-- Example usage queries:

-- Get all sources for a specific track
-- SELECT track_id, source, source_url, popularity_score, play_count
-- FROM track_sources
-- WHERE track_id = 'abc123def4567890'
-- ORDER BY discovered_at;

-- Find tracks available on multiple platforms
-- SELECT track_id, COUNT(DISTINCT source) as source_count
-- FROM track_sources
-- GROUP BY track_id
-- HAVING COUNT(DISTINCT source) >= 3
-- ORDER BY source_count DESC;

-- Get most popular tracks aggregated across all sources
-- SELECT track_id,
--        COUNT(DISTINCT source) as platform_count,
--        AVG(popularity_score) as avg_popularity,
--        SUM(play_count) as total_plays
-- FROM track_sources
-- GROUP BY track_id
-- ORDER BY avg_popularity DESC NULLS LAST
-- LIMIT 100;

-- Find tracks recently discovered on new platforms
-- SELECT t.track_id, t.source, t.discovered_at, s.title, a.name as artist_name
-- FROM track_sources t
-- JOIN songs s ON t.track_id = s.track_id
-- JOIN artists a ON s.primary_artist_id = a.artist_id
-- WHERE t.discovered_at > NOW() - INTERVAL '7 days'
-- ORDER BY t.discovered_at DESC;