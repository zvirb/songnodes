-- ============================================================================
-- Migration: 004 - Waterfall Configuration (Configuration-Driven Enrichment)
-- Description: Create tables for managing enrichment provider priorities
--              and confidence thresholds in a data-driven, configurable way
-- ============================================================================

-- ============================================================================
-- Metadata Enrichment Configuration
-- Defines provider priority and confidence thresholds for each metadata field
-- ============================================================================
CREATE TABLE IF NOT EXISTS metadata_enrichment_config (
    -- Primary key
    metadata_field TEXT PRIMARY KEY,        -- e.g., 'spotify_id', 'bpm', 'genre', 'key'

    -- Provider waterfall priority (Priority 1 = highest)
    priority_1_provider TEXT,
    priority_1_confidence DECIMAL(3,2),     -- Minimum confidence to accept

    priority_2_provider TEXT,
    priority_2_confidence DECIMAL(3,2),

    priority_3_provider TEXT,
    priority_3_confidence DECIMAL(3,2),

    priority_4_provider TEXT,               -- Optional 4th fallback
    priority_4_confidence DECIMAL(3,2),

    -- Configuration metadata
    enabled BOOLEAN DEFAULT TRUE,           -- Can disable enrichment for specific fields
    retry_on_low_confidence BOOLEAN DEFAULT TRUE,  -- Retry with next provider if confidence too low
    min_acceptable_confidence DECIMAL(3,2) DEFAULT 0.50,  -- Global minimum threshold

    -- Field metadata
    field_type TEXT,                        -- 'identifier', 'musical_attribute', 'metadata', 'text'
    field_description TEXT,
    required_for_gold BOOLEAN DEFAULT FALSE, -- Must have this field to promote to gold

    -- Validation rules (JSON schema or custom rules)
    validation_rules JSONB,

    -- Audit
    last_updated TIMESTAMP DEFAULT NOW(),
    updated_by TEXT,                        -- User/system that last modified

    -- Constraints
    CONSTRAINT config_priority_1_conf CHECK (priority_1_confidence IS NULL OR (priority_1_confidence >= 0 AND priority_1_confidence <= 1)),
    CONSTRAINT config_priority_2_conf CHECK (priority_2_confidence IS NULL OR (priority_2_confidence >= 0 AND priority_2_confidence <= 1)),
    CONSTRAINT config_priority_3_conf CHECK (priority_3_confidence IS NULL OR (priority_3_confidence >= 0 AND priority_3_confidence <= 1)),
    CONSTRAINT config_priority_4_conf CHECK (priority_4_confidence IS NULL OR (priority_4_confidence >= 0 AND priority_4_confidence <= 1)),
    CONSTRAINT config_min_conf CHECK (min_acceptable_confidence >= 0 AND min_acceptable_confidence <= 1),
    CONSTRAINT config_field_type CHECK (field_type IN ('identifier', 'musical_attribute', 'metadata', 'text', 'date', 'numeric'))
);

-- Indexes
CREATE INDEX idx_enrichment_config_enabled ON metadata_enrichment_config(enabled) WHERE enabled = TRUE;
CREATE INDEX idx_enrichment_config_field_type ON metadata_enrichment_config(field_type);
CREATE INDEX idx_enrichment_config_required ON metadata_enrichment_config(required_for_gold) WHERE required_for_gold = TRUE;

-- Comments
COMMENT ON TABLE metadata_enrichment_config IS 'Configuration table defining provider waterfall priorities and confidence thresholds for metadata enrichment.';
COMMENT ON COLUMN metadata_enrichment_config.priority_1_provider IS 'Highest priority provider (e.g., "spotify", "beatport", "musicbrainz")';
COMMENT ON COLUMN metadata_enrichment_config.priority_1_confidence IS 'Minimum confidence score to accept from priority 1 provider';
COMMENT ON COLUMN metadata_enrichment_config.retry_on_low_confidence IS 'If TRUE, try next provider if current provider confidence below threshold';
COMMENT ON COLUMN metadata_enrichment_config.required_for_gold IS 'If TRUE, records missing this field cannot be promoted to gold layer';

-- ============================================================================
-- Provider Configuration
-- Defines available enrichment providers and their capabilities
-- ============================================================================
CREATE TABLE IF NOT EXISTS enrichment_providers (
    -- Primary key
    provider_name TEXT PRIMARY KEY,         -- e.g., 'spotify', 'beatport', 'musicbrainz'

    -- Provider details
    provider_type TEXT NOT NULL,            -- 'api', 'scraper', 'manual'
    base_url TEXT,
    api_version TEXT,

    -- Capabilities
    supported_fields TEXT[] NOT NULL,       -- Fields this provider can enrich
    rate_limit_per_second INTEGER,
    rate_limit_per_day INTEGER,

    -- Quality metrics (historical)
    avg_confidence_score DECIMAL(3,2),      -- Historical average confidence
    avg_response_time_ms INTEGER,           -- Average API response time
    success_rate DECIMAL(3,2),              -- % of successful requests

    -- Status
    enabled BOOLEAN DEFAULT TRUE,
    health_status TEXT DEFAULT 'healthy',   -- 'healthy', 'degraded', 'down'
    last_health_check TIMESTAMP,

    -- Credentials (reference to secrets, not stored here)
    requires_auth BOOLEAN DEFAULT FALSE,
    auth_type TEXT,                         -- 'api_key', 'oauth', 'basic'

    -- Audit
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    -- Constraints
    CONSTRAINT provider_type_check CHECK (provider_type IN ('api', 'scraper', 'manual')),
    CONSTRAINT provider_health_check CHECK (health_status IN ('healthy', 'degraded', 'down')),
    CONSTRAINT provider_avg_conf CHECK (avg_confidence_score IS NULL OR (avg_confidence_score >= 0 AND avg_confidence_score <= 1)),
    CONSTRAINT provider_success_rate CHECK (success_rate IS NULL OR (success_rate >= 0 AND success_rate <= 1))
);

-- Indexes
CREATE INDEX idx_providers_enabled ON enrichment_providers(enabled) WHERE enabled = TRUE;
CREATE INDEX idx_providers_health ON enrichment_providers(health_status);
CREATE INDEX idx_providers_supported_fields ON enrichment_providers USING gin(supported_fields);

COMMENT ON TABLE enrichment_providers IS 'Registry of enrichment providers with capabilities and health metrics.';
COMMENT ON COLUMN enrichment_providers.supported_fields IS 'Array of metadata fields this provider can populate';

-- ============================================================================
-- Seed Initial Configuration
-- ============================================================================

-- Insert provider definitions
INSERT INTO enrichment_providers (provider_name, provider_type, supported_fields, requires_auth, auth_type) VALUES
    ('spotify', 'api', ARRAY['spotify_id', 'isrc', 'release_date', 'duration_ms', 'bpm', 'key', 'energy', 'valence', 'danceability', 'genre'], TRUE, 'oauth'),
    ('beatport', 'api', ARRAY['beatport_id', 'bpm', 'key', 'genre', 'release_date'], TRUE, 'api_key'),
    ('musicbrainz', 'api', ARRAY['musicbrainz_id', 'isrc', 'release_date', 'artist_name', 'track_title'], FALSE, NULL),
    ('lastfm', 'api', ARRAY['genre', 'play_count', 'tags'], TRUE, 'api_key'),
    ('acousticbrainz', 'api', ARRAY['bpm', 'key', 'energy', 'danceability'], FALSE, NULL),
    ('discogs', 'api', ARRAY['discogs_id', 'release_date', 'genre', 'artist_name'], TRUE, 'oauth'),
    ('1001tracklists', 'scraper', ARRAY['artist_name', 'track_title', 'playlist_context'], FALSE, NULL),
    ('mixesdb', 'scraper', ARRAY['artist_name', 'track_title', 'bpm', 'key'], FALSE, NULL)
ON CONFLICT (provider_name) DO NOTHING;

-- Insert enrichment configuration with waterfall priorities
INSERT INTO metadata_enrichment_config (
    metadata_field,
    priority_1_provider, priority_1_confidence,
    priority_2_provider, priority_2_confidence,
    priority_3_provider, priority_3_confidence,
    priority_4_provider, priority_4_confidence,
    field_type, field_description, required_for_gold, min_acceptable_confidence
) VALUES
    -- Identifiers (highest confidence required)
    ('spotify_id', 'spotify', 1.00, NULL, NULL, NULL, NULL, NULL, NULL, 'identifier', 'Spotify track identifier', TRUE, 0.95),

    ('isrc', 'spotify', 0.95, 'musicbrainz', 0.90, NULL, NULL, NULL, NULL, 'identifier', 'International Standard Recording Code', FALSE, 0.85),

    ('musicbrainz_id', 'musicbrainz', 1.00, NULL, NULL, NULL, NULL, NULL, NULL, 'identifier', 'MusicBrainz recording identifier', FALSE, 0.90),

    ('beatport_id', 'beatport', 1.00, NULL, NULL, NULL, NULL, NULL, NULL, 'identifier', 'Beatport track identifier', FALSE, 0.90),

    -- Musical Attributes (multiple sources with confidence thresholds)
    ('bpm', 'beatport', 0.98, 'spotify', 0.85, 'acousticbrainz', 0.75, 'mixesdb', 0.60, 'musical_attribute', 'Beats per minute', TRUE, 0.70),

    ('key', 'beatport', 0.95, 'spotify', 0.85, 'acousticbrainz', 0.70, 'mixesdb', 0.60, 'musical_attribute', 'Musical key (Camelot notation)', TRUE, 0.70),

    ('energy', 'spotify', 0.90, 'acousticbrainz', 0.75, NULL, NULL, NULL, NULL, 'musical_attribute', 'Energy level (0-1)', FALSE, 0.60),

    ('danceability', 'spotify', 0.90, 'acousticbrainz', 0.75, NULL, NULL, NULL, NULL, 'musical_attribute', 'Danceability score (0-1)', FALSE, 0.60),

    ('valence', 'spotify', 0.90, NULL, NULL, NULL, NULL, NULL, NULL, 'musical_attribute', 'Musical positivity (0-1)', FALSE, 0.60),

    -- Genre (multiple sources, varying quality)
    ('genre', 'beatport', 0.90, 'spotify', 0.85, 'lastfm', 0.70, 'discogs', 0.65, 'metadata', 'Music genre classification', TRUE, 0.60),

    -- Release metadata
    ('release_date', 'musicbrainz', 0.90, 'spotify', 0.88, 'beatport', 0.85, 'discogs', 0.80, 'date', 'Track release date', FALSE, 0.75),

    ('duration_ms', 'spotify', 0.95, 'musicbrainz', 0.85, NULL, NULL, NULL, NULL, 'numeric', 'Track duration in milliseconds', FALSE, 0.80),

    -- Artist/Track names (for validation/correction)
    ('artist_name', 'spotify', 0.95, 'musicbrainz', 0.90, 'beatport', 0.85, '1001tracklists', 0.70, 'text', 'Canonical artist name', TRUE, 0.70),

    ('track_title', 'spotify', 0.95, 'musicbrainz', 0.90, 'beatport', 0.85, '1001tracklists', 0.70, 'text', 'Canonical track title', TRUE, 0.70)

ON CONFLICT (metadata_field) DO NOTHING;

-- ============================================================================
-- Provider Performance Tracking
-- Track historical performance of providers for adaptive optimization
-- ============================================================================
CREATE TABLE IF NOT EXISTS provider_performance_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    provider_name TEXT NOT NULL REFERENCES enrichment_providers(provider_name) ON DELETE CASCADE,
    metadata_field TEXT NOT NULL REFERENCES metadata_enrichment_config(metadata_field) ON DELETE CASCADE,

    -- Performance metrics
    request_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    avg_confidence DECIMAL(3,2),
    avg_response_time_ms INTEGER,

    -- Time window
    period_start TIMESTAMP NOT NULL,
    period_end TIMESTAMP NOT NULL,

    -- Calculated metrics
    success_rate DECIMAL(3,2) GENERATED ALWAYS AS (
        CASE WHEN request_count > 0
        THEN (success_count::DECIMAL / request_count::DECIMAL)
        ELSE 0 END
    ) STORED,

    created_at TIMESTAMP DEFAULT NOW(),

    -- Constraints
    UNIQUE(provider_name, metadata_field, period_start, period_end),
    CONSTRAINT perf_success_count CHECK (success_count <= request_count),
    CONSTRAINT perf_avg_confidence CHECK (avg_confidence IS NULL OR (avg_confidence >= 0 AND avg_confidence <= 1))
);

CREATE INDEX idx_perf_history_provider ON provider_performance_history(provider_name, metadata_field);
CREATE INDEX idx_perf_history_period ON provider_performance_history(period_end DESC);

COMMENT ON TABLE provider_performance_history IS 'Historical performance tracking for adaptive provider optimization.';

-- ============================================================================
-- View: Current Waterfall Configuration Summary
-- ============================================================================
CREATE OR REPLACE VIEW enrichment_waterfall_summary AS
SELECT
    c.metadata_field,
    c.field_type,
    c.required_for_gold,
    c.enabled,
    JSONB_BUILD_OBJECT(
        'priority_1', JSONB_BUILD_OBJECT('provider', c.priority_1_provider, 'confidence', c.priority_1_confidence),
        'priority_2', JSONB_BUILD_OBJECT('provider', c.priority_2_provider, 'confidence', c.priority_2_confidence),
        'priority_3', JSONB_BUILD_OBJECT('provider', c.priority_3_provider, 'confidence', c.priority_3_confidence),
        'priority_4', JSONB_BUILD_OBJECT('provider', c.priority_4_provider, 'confidence', c.priority_4_confidence)
    ) as waterfall_config,
    c.min_acceptable_confidence,
    c.last_updated
FROM metadata_enrichment_config c
WHERE c.enabled = TRUE
ORDER BY
    CASE c.field_type
        WHEN 'identifier' THEN 1
        WHEN 'musical_attribute' THEN 2
        WHEN 'metadata' THEN 3
        WHEN 'text' THEN 4
        WHEN 'date' THEN 5
        WHEN 'numeric' THEN 6
        ELSE 7
    END,
    c.metadata_field;

COMMENT ON VIEW enrichment_waterfall_summary IS 'Human-readable summary of enrichment waterfall configuration.';

-- ============================================================================
-- Function: Get Provider Priority for Field
-- ============================================================================
CREATE OR REPLACE FUNCTION get_provider_priority(
    p_metadata_field TEXT,
    p_exclude_providers TEXT[] DEFAULT ARRAY[]::TEXT[]
)
RETURNS TABLE (
    priority INTEGER,
    provider TEXT,
    min_confidence DECIMAL(3,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM (
        SELECT 1 as priority, priority_1_provider as provider, priority_1_confidence as min_confidence
        FROM metadata_enrichment_config
        WHERE metadata_field = p_metadata_field
          AND enabled = TRUE
          AND priority_1_provider IS NOT NULL
          AND NOT (priority_1_provider = ANY(p_exclude_providers))

        UNION ALL

        SELECT 2, priority_2_provider, priority_2_confidence
        FROM metadata_enrichment_config
        WHERE metadata_field = p_metadata_field
          AND enabled = TRUE
          AND priority_2_provider IS NOT NULL
          AND NOT (priority_2_provider = ANY(p_exclude_providers))

        UNION ALL

        SELECT 3, priority_3_provider, priority_3_confidence
        FROM metadata_enrichment_config
        WHERE metadata_field = p_metadata_field
          AND enabled = TRUE
          AND priority_3_provider IS NOT NULL
          AND NOT (priority_3_provider = ANY(p_exclude_providers))

        UNION ALL

        SELECT 4, priority_4_provider, priority_4_confidence
        FROM metadata_enrichment_config
        WHERE metadata_field = p_metadata_field
          AND enabled = TRUE
          AND priority_4_provider IS NOT NULL
          AND NOT (priority_4_provider = ANY(p_exclude_providers))
    ) priorities
    ORDER BY priority;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_provider_priority IS 'Get ordered provider priority list for a metadata field, optionally excluding failed providers.';
