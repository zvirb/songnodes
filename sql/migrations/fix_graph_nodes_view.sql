-- ===================================================================
-- Fix graph_nodes VIEW - Add ALL Missing Columns
-- ===================================================================
-- Date: 2025-10-18
-- Issue: Graph API expects artist_name, bpm, musical_key, and many other
--        fields that don't exist in the current graph_nodes VIEW
-- Impact: EDGE-FIRST graph queries fail with "column does not exist" errors
-- ===================================================================

-- Drop existing incomplete VIEW
DROP VIEW IF EXISTS graph_nodes CASCADE;

-- Create COMPLETE graph_nodes VIEW with ALL fields expected by Graph API
CREATE OR REPLACE VIEW graph_nodes AS
-- SONG NODES - with complete metadata
SELECT
    'song_' || t.id::text as node_id,
    t.title as label,
    'song' as node_type,
    t.genre as category,
    EXTRACT(YEAR FROM t.release_date)::integer as release_year,

    -- ✅ CRITICAL FIX: Add artist_name (required by graph API)
    COALESCE(
        (SELECT a.name
         FROM track_artists ta
         INNER JOIN artists a ON ta.artist_id = a.artist_id
         WHERE ta.track_id = t.id
           AND ta.role = 'primary'
           AND a.name IS NOT NULL
         LIMIT 1),
        'Unknown'
    ) as artist_name,

    -- Appearance count (how many playlists contain this track)
    COALESCE(
        (SELECT COUNT(*) FROM playlist_tracks pt WHERE pt.song_id = t.id),
        0
    ) as appearance_count,

    -- ✅ CRITICAL FIX: Add DJ-critical audio features
    t.bpm,
    t.key as musical_key,  -- Database uses 'key', API expects 'musical_key'
    t.energy,
    t.danceability,
    t.valence,
    t.acousticness,
    t.instrumentalness,
    t.liveness,
    t.speechiness,
    t.loudness,

    -- Duration and timing
    t.duration_ms,
    t.release_date,

    -- ✅ CRITICAL FIX: Add streaming platform IDs
    t.spotify_id,
    t.apple_music_id,
    t.beatport_id,
    t.isrc,
    t.soundcloud_id,
    t.youtube_music_id,
    t.musicbrainz_id,
    t.deezer_id,
    t.tidal_id,

    -- ✅ CRITICAL FIX: Add track characteristics
    t.is_remix,
    t.is_mashup,
    t.is_live,
    t.is_cover,
    t.is_instrumental,
    t.is_explicit,

    -- Popularity and engagement
    t.popularity_score,
    t.play_count,

    -- Additional metadata
    t.subgenre,
    t.mashup_components,
    t.metadata,

    -- System fields
    t.created_at,
    t.updated_at

FROM tracks t

UNION ALL

-- ARTIST NODES - with complete metadata
SELECT
    'artist_' || artist_id::text as node_id,
    name as label,
    'artist' as node_type,
    COALESCE(genres[1], 'Unknown') as category,  -- First genre as category
    NULL::integer as release_year,

    -- For artist nodes, artist_name = label
    name as artist_name,

    -- Appearance count (how many tracks by this artist)
    COALESCE(
        (SELECT COUNT(*) FROM track_artists ta WHERE ta.artist_id = artists.artist_id),
        0
    ) as appearance_count,

    -- Audio features - NULL for artist nodes
    NULL::numeric as bpm,
    NULL::varchar as musical_key,
    NULL::numeric as energy,
    NULL::numeric as danceability,
    NULL::numeric as valence,
    NULL::numeric as acousticness,
    NULL::numeric as instrumentalness,
    NULL::numeric as liveness,
    NULL::numeric as speechiness,
    NULL::numeric as loudness,

    -- Duration and timing - NULL for artist nodes
    NULL::integer as duration_ms,
    NULL::date as release_date,

    -- Streaming platform IDs - artist versions
    spotify_id,
    apple_music_id,
    beatport_id,
    NULL::varchar as isrc,  -- ISRCs are track-specific
    NULL::varchar as soundcloud_id,  -- Not in artist table
    youtube_music_id,
    musicbrainz_id,
    deezer_id,
    tidal_id,

    -- Track characteristics - NULL for artist nodes
    NULL::boolean as is_remix,
    NULL::boolean as is_mashup,
    NULL::boolean as is_live,
    NULL::boolean as is_cover,
    NULL::boolean as is_instrumental,
    NULL::boolean as is_explicit,

    -- Popularity
    popularity_score,
    NULL::bigint as play_count,  -- Artists don't have play_count

    -- Additional metadata
    NULL::varchar as subgenre,  -- Artist-level genre in 'category'
    NULL::jsonb as mashup_components,  -- Not applicable to artists
    metadata,

    -- System fields
    created_at,
    updated_at

FROM artists;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_graph_nodes_node_id ON tracks(('song_' || id::text));
CREATE INDEX IF NOT EXISTS idx_graph_nodes_artist_id ON artists(('artist_' || artist_id::text));
CREATE INDEX IF NOT EXISTS idx_graph_nodes_artist_name_tracks ON track_artists(track_id, artist_id) WHERE role = 'primary';

-- Add helpful comment
COMMENT ON VIEW graph_nodes IS 'Complete graph nodes VIEW combining tracks and artists with ALL metadata fields expected by Graph API. Updated 2025-10-18 to fix missing columns (artist_name, bpm, musical_key, etc.)';

-- ===================================================================
-- Verification Queries
-- ===================================================================

-- Test that all expected columns exist
SELECT
    node_id,
    label,
    artist_name,  -- Should now exist
    bpm,          -- Should now exist
    musical_key,  -- Should now exist
    energy,
    danceability
FROM graph_nodes
WHERE node_type = 'song'
LIMIT 1;

SELECT
    COUNT(*) as total_nodes,
    SUM(CASE WHEN node_type = 'song' THEN 1 ELSE 0 END) as song_nodes,
    SUM(CASE WHEN node_type = 'artist' THEN 1 ELSE 0 END) as artist_nodes,
    SUM(CASE WHEN artist_name IS NOT NULL AND artist_name != 'Unknown' THEN 1 ELSE 0 END) as nodes_with_artists
FROM graph_nodes;
