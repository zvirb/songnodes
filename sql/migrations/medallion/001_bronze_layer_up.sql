-- ============================================================================
-- Migration: 001 - Bronze Layer (Raw Immutable Data)
-- Description: Create tables for storing raw, immutable scraped data from
--              various sources (1001tracklists, MixesDB, Beatport, etc.)
-- ============================================================================

-- Enable extensions if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- Bronze Scraped Tracks
-- Stores raw track data exactly as scraped, with full source metadata
-- ============================================================================
CREATE TABLE IF NOT EXISTS bronze_scraped_tracks (
    -- Primary identifier
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Source metadata
    source TEXT NOT NULL,                    -- e.g., '1001tracklists', 'mixesdb', 'beatport'
    source_url TEXT NOT NULL,                -- Original URL where data was scraped
    source_track_id TEXT,                    -- ID from source system (if available)
    scraper_version TEXT NOT NULL,           -- Version of scraper that collected this data

    -- Raw data storage (immutable)
    raw_json JSONB NOT NULL,                 -- Complete raw data as scraped

    -- Extracted fields for indexing/querying (denormalized from raw_json)
    artist_name TEXT,                        -- Extracted for quick filtering
    track_title TEXT,                        -- Extracted for quick filtering

    -- Metadata
    scraped_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),

    -- Deduplication constraint
    UNIQUE(source, source_url, source_track_id)
);

-- Indexes for performance
CREATE INDEX idx_bronze_tracks_source ON bronze_scraped_tracks(source);
CREATE INDEX idx_bronze_tracks_scraped_at ON bronze_scraped_tracks(scraped_at DESC);
CREATE INDEX idx_bronze_tracks_artist_name ON bronze_scraped_tracks(artist_name) WHERE artist_name IS NOT NULL;
CREATE INDEX idx_bronze_tracks_track_title ON bronze_scraped_tracks(track_title) WHERE track_title IS NOT NULL;
CREATE INDEX idx_bronze_tracks_raw_json ON bronze_scraped_tracks USING gin(raw_json);

-- Comments
COMMENT ON TABLE bronze_scraped_tracks IS 'Bronze layer: Immutable raw track data from scrapers. Never updated, only appended.';
COMMENT ON COLUMN bronze_scraped_tracks.raw_json IS 'Complete raw JSON payload from scraper - preserved for replay and debugging';
COMMENT ON COLUMN bronze_scraped_tracks.scraper_version IS 'Version string for replay compatibility (e.g., "1001tracklists-v2.1.0")';

-- ============================================================================
-- Bronze Scraped Playlists
-- Stores raw playlist/setlist/mix data
-- ============================================================================
CREATE TABLE IF NOT EXISTS bronze_scraped_playlists (
    -- Primary identifier
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Source metadata
    source TEXT NOT NULL,                    -- e.g., '1001tracklists', 'mixesdb'
    source_url TEXT NOT NULL,                -- Original URL
    source_playlist_id TEXT,                 -- ID from source system
    scraper_version TEXT NOT NULL,

    -- Raw data storage
    raw_json JSONB NOT NULL,                 -- Complete raw playlist data

    -- Extracted fields
    playlist_name TEXT,
    artist_name TEXT,
    event_name TEXT,
    event_date DATE,

    -- Metadata
    scraped_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),

    -- Deduplication
    UNIQUE(source, source_url, source_playlist_id)
);

-- Indexes
CREATE INDEX idx_bronze_playlists_source ON bronze_scraped_playlists(source);
CREATE INDEX idx_bronze_playlists_scraped_at ON bronze_scraped_playlists(scraped_at DESC);
CREATE INDEX idx_bronze_playlists_artist_name ON bronze_scraped_playlists(artist_name) WHERE artist_name IS NOT NULL;
CREATE INDEX idx_bronze_playlists_event_date ON bronze_scraped_playlists(event_date) WHERE event_date IS NOT NULL;
CREATE INDEX idx_bronze_playlists_raw_json ON bronze_scraped_playlists USING gin(raw_json);

COMMENT ON TABLE bronze_scraped_playlists IS 'Bronze layer: Immutable raw playlist/setlist data from scrapers.';

-- ============================================================================
-- Bronze Scraped Artists
-- Stores raw artist data from various sources
-- ============================================================================
CREATE TABLE IF NOT EXISTS bronze_scraped_artists (
    -- Primary identifier
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Source metadata
    source TEXT NOT NULL,                    -- e.g., 'spotify', 'beatport', 'discogs'
    source_url TEXT,                         -- Original URL (if applicable)
    source_artist_id TEXT,                   -- ID from source system
    scraper_version TEXT NOT NULL,

    -- Raw data storage
    raw_json JSONB NOT NULL,                 -- Complete raw artist data

    -- Extracted fields
    artist_name TEXT NOT NULL,
    aliases TEXT[],                          -- Known aliases/variations

    -- Metadata
    scraped_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),

    -- Deduplication
    UNIQUE(source, source_artist_id)
);

-- Indexes
CREATE INDEX idx_bronze_artists_source ON bronze_scraped_artists(source);
CREATE INDEX idx_bronze_artists_scraped_at ON bronze_scraped_artists(scraped_at DESC);
CREATE INDEX idx_bronze_artists_artist_name ON bronze_scraped_artists(artist_name);
CREATE INDEX idx_bronze_artists_aliases ON bronze_scraped_artists USING gin(aliases);
CREATE INDEX idx_bronze_artists_raw_json ON bronze_scraped_artists USING gin(raw_json);

COMMENT ON TABLE bronze_scraped_artists IS 'Bronze layer: Immutable raw artist data from scrapers and APIs.';
COMMENT ON COLUMN bronze_scraped_artists.aliases IS 'Array of known artist name variations for matching';

-- ============================================================================
-- Bronze API Enrichments
-- Stores raw API responses from enrichment services (Spotify, MusicBrainz, etc.)
-- ============================================================================
CREATE TABLE IF NOT EXISTS bronze_api_enrichments (
    -- Primary identifier
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Link to bronze track (if applicable)
    bronze_track_id UUID REFERENCES bronze_scraped_tracks(id) ON DELETE CASCADE,

    -- API metadata
    api_provider TEXT NOT NULL,              -- e.g., 'spotify', 'musicbrainz', 'lastfm'
    api_endpoint TEXT NOT NULL,              -- Specific endpoint called
    api_version TEXT,                        -- API version used

    -- Request metadata
    request_params JSONB,                    -- Query parameters used

    -- Response data
    raw_response JSONB NOT NULL,             -- Complete API response
    response_status INTEGER NOT NULL,        -- HTTP status code

    -- Metadata
    fetched_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_bronze_api_provider ON bronze_api_enrichments(api_provider);
CREATE INDEX idx_bronze_api_track_id ON bronze_api_enrichments(bronze_track_id) WHERE bronze_track_id IS NOT NULL;
CREATE INDEX idx_bronze_api_fetched_at ON bronze_api_enrichments(fetched_at DESC);
CREATE INDEX idx_bronze_api_raw_response ON bronze_api_enrichments USING gin(raw_response);

COMMENT ON TABLE bronze_api_enrichments IS 'Bronze layer: Immutable raw API responses from enrichment providers.';
COMMENT ON COLUMN bronze_api_enrichments.raw_response IS 'Complete API response for replay and debugging';
