-- ===================================================================
-- Migration 011 ROLLBACK: Remove Album Artwork URLs from Track Tables
-- ===================================================================
-- Date: 2025-11-18
-- Purpose: Rollback migration 011 - remove album artwork columns
-- ===================================================================

-- Drop materialized view for artwork coverage statistics
DROP MATERIALIZED VIEW IF EXISTS album_artwork_coverage_stats CASCADE;

-- Drop artwork index
DROP INDEX IF EXISTS idx_silver_tracks_has_artwork;

-- Remove album artwork URL columns from silver_enriched_tracks
ALTER TABLE silver_enriched_tracks
  DROP COLUMN IF EXISTS album_artwork_small,
  DROP COLUMN IF EXISTS album_artwork_medium,
  DROP COLUMN IF EXISTS album_artwork_large;

-- Recreate musicdb.tracks view WITHOUT album artwork columns (restore to migration 010 state)
DROP VIEW IF EXISTS musicdb.tracks CASCADE;

CREATE OR REPLACE VIEW musicdb.tracks AS
SELECT
    silver_enriched_tracks.id,
    silver_enriched_tracks.track_title AS title,
    lower(regexp_replace(silver_enriched_tracks.track_title, '[^a-zA-Z0-9 ]'::text, ''::text, 'g'::text)) AS normalized_title,
    silver_enriched_tracks.isrc,
    silver_enriched_tracks.spotify_id,
    silver_enriched_tracks.apple_music_id,
    silver_enriched_tracks.tidal_id,
    silver_enriched_tracks.beatport_id,
    silver_enriched_tracks.soundcloud_id,
    silver_enriched_tracks.deezer_id,
    silver_enriched_tracks.youtube_music_id,
    silver_enriched_tracks.musicbrainz_id,
    silver_enriched_tracks.duration_ms,
    silver_enriched_tracks.bpm,
    silver_enriched_tracks.key,
    silver_enriched_tracks.energy,
    silver_enriched_tracks.danceability,
    silver_enriched_tracks.valence,
    silver_enriched_tracks.release_date,
    CASE
        WHEN ((silver_enriched_tracks.genre IS NOT NULL) AND (array_length(silver_enriched_tracks.genre, 1) > 0))
        THEN silver_enriched_tracks.genre[1]
        ELSE NULL::text
    END AS genre,
    NULL::character varying(100) AS subgenre,
    NULL::jsonb AS mashup_components,
    false AS is_remix,
    false AS is_mashup,
    false AS is_live,
    false AS is_cover,
    silver_enriched_tracks.created_at,
    silver_enriched_tracks.updated_at,
    silver_enriched_tracks.enrichment_metadata AS metadata,
    to_tsvector('english'::regconfig, ((silver_enriched_tracks.artist_name || ' '::text) || silver_enriched_tracks.track_title)) AS search_vector
FROM silver_enriched_tracks;

-- Recreate public.tracks view WITHOUT album artwork columns
DROP VIEW IF EXISTS public.tracks CASCADE;

CREATE OR REPLACE VIEW public.tracks AS
SELECT
    tracks.id,
    tracks.title,
    tracks.normalized_title,
    tracks.isrc,
    tracks.spotify_id,
    tracks.apple_music_id,
    tracks.tidal_id,
    tracks.beatport_id,
    tracks.soundcloud_id,
    tracks.deezer_id,
    tracks.youtube_music_id,
    tracks.musicbrainz_id,
    tracks.duration_ms,
    tracks.bpm,
    tracks.key,
    tracks.energy,
    tracks.danceability,
    tracks.valence,
    tracks.release_date,
    tracks.genre,
    tracks.subgenre,
    tracks.mashup_components,
    tracks.is_remix,
    tracks.is_mashup,
    tracks.is_live,
    tracks.is_cover,
    tracks.created_at,
    tracks.updated_at,
    tracks.metadata,
    tracks.search_vector
FROM musicdb.tracks;

-- Recreate graph_nodes view WITHOUT album artwork columns
DROP VIEW IF EXISTS graph_nodes CASCADE;

CREATE OR REPLACE VIEW graph_nodes AS
-- SONG NODES - without album artwork
SELECT
    'song_' || t.id::text as node_id,
    t.title as label,
    'song' as node_type,
    COALESCE(t.genre, 'Unknown') as category,
    EXTRACT(YEAR FROM t.release_date)::integer as release_year,

    -- Artist name from track_artists
    COALESCE(
        (SELECT a.name
         FROM musicdb.track_artists ta
         INNER JOIN musicdb.artists a ON ta.artist_id = a.id
         WHERE ta.track_id = t.id
           AND ta.role = 'primary'
           AND a.name IS NOT NULL
         LIMIT 1),
        'Unknown'
    ) as artist_name,

    -- Appearance count
    COALESCE(
        (SELECT COUNT(*) FROM silver_playlist_tracks spt WHERE spt.track_id = t.id),
        0
    ) as appearance_count,

    -- DJ-critical audio features
    t.bpm,
    t.key as musical_key,
    t.energy,
    t.danceability,
    t.valence,
    NULL::numeric as acousticness,
    NULL::numeric as instrumentalness,
    NULL::numeric as liveness,
    NULL::numeric as speechiness,
    NULL::numeric as loudness,

    -- Duration and timing
    t.duration_ms,
    t.release_date,

    -- Streaming platform IDs
    t.spotify_id,
    t.apple_music_id,
    t.beatport_id,
    t.isrc,
    t.soundcloud_id,
    t.youtube_music_id,
    t.musicbrainz_id,
    t.deezer_id,
    t.tidal_id,

    -- Track characteristics
    t.is_remix,
    t.is_mashup,
    t.is_live,
    t.is_cover,
    false as is_instrumental,
    false as is_explicit,

    -- Popularity
    NULL::numeric as popularity_score,
    NULL::bigint as play_count,

    -- Additional metadata
    t.subgenre,
    t.mashup_components,
    t.metadata,

    -- System fields
    t.created_at,
    t.updated_at

FROM tracks t

UNION ALL

-- ARTIST NODES
SELECT
    'artist_' || id::text as node_id,
    name as label,
    'artist' as node_type,
    COALESCE(genres[1], 'Unknown') as category,
    NULL::integer as release_year,
    name as artist_name,
    COALESCE(
        (SELECT COUNT(*) FROM musicdb.track_artists ta WHERE ta.artist_id = musicdb.artists.id),
        0
    ) as appearance_count,
    NULL::numeric as bpm,
    NULL::text as musical_key,
    NULL::numeric as energy,
    NULL::numeric as danceability,
    NULL::numeric as valence,
    NULL::numeric as acousticness,
    NULL::numeric as instrumentalness,
    NULL::numeric as liveness,
    NULL::numeric as speechiness,
    NULL::numeric as loudness,
    NULL::integer as duration_ms,
    NULL::date as release_date,
    spotify_id,
    apple_music_id,
    beatport_id,
    NULL::text as isrc,
    soundcloud_id,
    youtube_music_id,
    musicbrainz_id,
    deezer_id,
    CAST(tidal_id AS text) as tidal_id,
    NULL::boolean as is_remix,
    NULL::boolean as is_mashup,
    NULL::boolean as is_live,
    NULL::boolean as is_cover,
    NULL::boolean as is_instrumental,
    NULL::boolean as is_explicit,
    popularity_score,
    NULL::bigint as play_count,
    NULL::character varying as subgenre,
    NULL::jsonb as mashup_components,
    metadata,
    created_at,
    updated_at
FROM musicdb.artists;

-- Restore comments
COMMENT ON VIEW musicdb.tracks IS 'Track view exposing silver_enriched_tracks with all streaming platform IDs';
COMMENT ON VIEW public.tracks IS 'Public track view with complete streaming platform integration';
COMMENT ON VIEW graph_nodes IS 'Complete graph nodes VIEW combining tracks and artists with ALL metadata fields including streaming platform IDs. Updated 2025-11-12 to include youtube_music_id and other platform IDs.';

-- Log rollback completion
DO $$
BEGIN
    RAISE NOTICE 'Migration 011 ROLLBACK: Album artwork columns removed successfully';
END $$;
