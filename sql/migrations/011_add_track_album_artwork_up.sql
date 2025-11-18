-- ===================================================================
-- Migration 011: Add Album Artwork URLs to Track Tables
-- ===================================================================
-- Date: 2025-11-18
-- Issue: No storage for freely available track imagery (album covers, single artwork, vinyl art)
-- Impact: Silver-to-gold medallion layer lacks visual metadata from Spotify/MusicBrainz APIs
-- Purpose: Enable rich visual presentation of tracks in UI/graph visualization
-- ===================================================================

-- Add album artwork URL columns to silver_enriched_tracks (silver layer)
ALTER TABLE silver_enriched_tracks
  ADD COLUMN IF NOT EXISTS album_artwork_small VARCHAR(500),
  ADD COLUMN IF NOT EXISTS album_artwork_medium VARCHAR(500),
  ADD COLUMN IF NOT EXISTS album_artwork_large VARCHAR(500);

-- Add album artwork URL columns to musicdb.tracks table (if it's a physical table, not a view)
-- Check first if tracks is a table in musicdb schema
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'musicdb'
          AND table_name = 'tracks'
          AND table_type = 'BASE TABLE'
    ) THEN
        ALTER TABLE musicdb.tracks
          ADD COLUMN IF NOT EXISTS album_artwork_small VARCHAR(500),
          ADD COLUMN IF NOT EXISTS album_artwork_medium VARCHAR(500),
          ADD COLUMN IF NOT EXISTS album_artwork_large VARCHAR(500);
        RAISE NOTICE 'Added artwork columns to musicdb.tracks table';
    ELSE
        RAISE NOTICE 'musicdb.tracks is a view, will update in view recreation';
    END IF;
END $$;

-- Create indexes for artwork URLs (useful for NULL checks and filtering)
CREATE INDEX IF NOT EXISTS idx_silver_tracks_has_artwork
  ON silver_enriched_tracks(id) WHERE album_artwork_large IS NOT NULL;

-- Drop and recreate musicdb.tracks view to include album artwork columns
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
    -- Album artwork URLs (new)
    silver_enriched_tracks.album_artwork_small,
    silver_enriched_tracks.album_artwork_medium,
    silver_enriched_tracks.album_artwork_large,
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

-- Recreate public.tracks view to include album artwork columns
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
    -- Album artwork URLs (new)
    tracks.album_artwork_small,
    tracks.album_artwork_medium,
    tracks.album_artwork_large,
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

-- Update graph_nodes view to include album artwork columns
DROP VIEW IF EXISTS graph_nodes CASCADE;

CREATE OR REPLACE VIEW graph_nodes AS
-- SONG NODES - with complete metadata including album artwork
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

    -- Appearance count (how many playlists contain this track)
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

    -- Album artwork URLs (new)
    t.album_artwork_small,
    t.album_artwork_medium,
    t.album_artwork_large,

    -- Track characteristics
    t.is_remix,
    t.is_mashup,
    t.is_live,
    t.is_cover,
    false as is_instrumental,
    false as is_explicit,

    -- Popularity and engagement
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

-- ARTIST NODES - with complete metadata (no artwork for artists in this migration)
SELECT
    'artist_' || id::text as node_id,
    name as label,
    'artist' as node_type,
    COALESCE(genres[1], 'Unknown') as category,
    NULL::integer as release_year,

    -- For artist nodes, artist_name = label
    name as artist_name,

    -- Appearance count (how many tracks by this artist)
    COALESCE(
        (SELECT COUNT(*) FROM musicdb.track_artists ta WHERE ta.artist_id = musicdb.artists.id),
        0
    ) as appearance_count,

    -- Audio features - NULL for artist nodes
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

    -- Duration and timing - NULL for artist nodes
    NULL::integer as duration_ms,
    NULL::date as release_date,

    -- Streaming platform IDs - artist versions
    spotify_id,
    apple_music_id,
    beatport_id,
    NULL::text as isrc,
    soundcloud_id,
    youtube_music_id,
    musicbrainz_id,
    deezer_id,
    CAST(tidal_id AS text) as tidal_id,

    -- Album artwork - NULL for artist nodes
    NULL::VARCHAR(500) as album_artwork_small,
    NULL::VARCHAR(500) as album_artwork_medium,
    NULL::VARCHAR(500) as album_artwork_large,

    -- Track characteristics - NULL for artist nodes
    NULL::boolean as is_remix,
    NULL::boolean as is_mashup,
    NULL::boolean as is_live,
    NULL::boolean as is_cover,
    NULL::boolean as is_instrumental,
    NULL::boolean as is_explicit,

    -- Popularity
    popularity_score,
    NULL::bigint as play_count,

    -- Additional metadata
    NULL::character varying as subgenre,
    NULL::jsonb as mashup_components,
    metadata,

    -- System fields
    created_at,
    updated_at

FROM musicdb.artists;

-- Add helpful comments
COMMENT ON COLUMN silver_enriched_tracks.album_artwork_small IS 'Small album artwork URL (64x64 or similar) from Spotify/MusicBrainz/etc - suitable for thumbnails';
COMMENT ON COLUMN silver_enriched_tracks.album_artwork_medium IS 'Medium album artwork URL (300x300 or similar) from Spotify/MusicBrainz/etc - suitable for lists';
COMMENT ON COLUMN silver_enriched_tracks.album_artwork_large IS 'Large album artwork URL (640x640 or similar) from Spotify/MusicBrainz/etc - suitable for detail views';

COMMENT ON VIEW musicdb.tracks IS 'Track view exposing silver_enriched_tracks with album artwork URLs and all streaming platform IDs';
COMMENT ON VIEW public.tracks IS 'Public track view with complete streaming platform integration and album artwork';
COMMENT ON VIEW graph_nodes IS 'Complete graph nodes VIEW combining tracks and artists with ALL metadata fields including album artwork URLs. Updated 2025-11-18 to include album artwork from metadata enrichment.';

-- Create materialized view for artwork coverage statistics
CREATE MATERIALIZED VIEW IF NOT EXISTS album_artwork_coverage_stats AS
SELECT
    COUNT(*) as total_tracks,
    COUNT(album_artwork_small) as with_artwork_small,
    COUNT(album_artwork_medium) as with_artwork_medium,
    COUNT(album_artwork_large) as with_artwork_large,
    COUNT(CASE WHEN album_artwork_large IS NOT NULL THEN 1 END) as with_any_artwork,
    ROUND(AVG(CASE WHEN album_artwork_large IS NOT NULL THEN 1 ELSE 0 END) * 100, 2) as artwork_coverage_pct,
    COUNT(CASE WHEN album_artwork_large IS NOT NULL AND spotify_id IS NOT NULL THEN 1 END) as artwork_from_spotify,
    COUNT(CASE WHEN album_artwork_large IS NOT NULL AND musicbrainz_id IS NOT NULL AND spotify_id IS NULL THEN 1 END) as artwork_from_musicbrainz
FROM silver_enriched_tracks;

CREATE UNIQUE INDEX IF NOT EXISTS idx_artwork_coverage_stats_refresh
ON album_artwork_coverage_stats((1));

COMMENT ON MATERIALIZED VIEW album_artwork_coverage_stats IS
'Aggregate statistics for album artwork coverage. Refresh periodically to monitor enrichment progress.';

-- Verification query
DO $$
DECLARE
    col_count INTEGER;
    artwork_count INTEGER;
BEGIN
    -- Verify album_artwork_large exists in silver_enriched_tracks
    SELECT COUNT(*) INTO col_count
    FROM information_schema.columns
    WHERE table_name = 'silver_enriched_tracks'
      AND column_name = 'album_artwork_large';

    IF col_count > 0 THEN
        RAISE NOTICE 'SUCCESS: album_artwork_large column added to silver_enriched_tracks';
    ELSE
        RAISE WARNING 'FAILED: album_artwork_large column not found in silver_enriched_tracks';
    END IF;

    -- Verify musicdb.tracks view includes album_artwork_large
    SELECT COUNT(*) INTO col_count
    FROM information_schema.columns
    WHERE table_name = 'tracks'
      AND table_schema = 'musicdb'
      AND column_name = 'album_artwork_large';

    IF col_count > 0 THEN
        RAISE NOTICE 'SUCCESS: album_artwork_large column exposed in musicdb.tracks view';
    ELSE
        RAISE WARNING 'FAILED: album_artwork_large column not found in musicdb.tracks view';
    END IF;

    -- Verify public.tracks view includes album_artwork_large
    SELECT COUNT(*) INTO col_count
    FROM information_schema.columns
    WHERE table_name = 'tracks'
      AND table_schema = 'public'
      AND column_name = 'album_artwork_large';

    IF col_count > 0 THEN
        RAISE NOTICE 'SUCCESS: album_artwork_large column exposed in public.tracks view';
    ELSE
        RAISE WARNING 'FAILED: album_artwork_large column not found in public.tracks view';
    END IF;

    -- Verify graph_nodes view includes album_artwork_large
    SELECT COUNT(*) INTO col_count
    FROM information_schema.columns
    WHERE table_name = 'graph_nodes'
      AND column_name = 'album_artwork_large';

    IF col_count > 0 THEN
        RAISE NOTICE 'SUCCESS: album_artwork_large column available in graph_nodes view';
    ELSE
        RAISE WARNING 'FAILED: album_artwork_large column not found in graph_nodes view';
    END IF;

    -- Show current artwork coverage
    SELECT COUNT(*) INTO artwork_count
    FROM silver_enriched_tracks
    WHERE album_artwork_large IS NOT NULL;

    RAISE NOTICE 'Current tracks with album artwork: % (will increase as enrichment runs)', artwork_count;

    RAISE NOTICE 'Migration 011: Album artwork URLs migration completed';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '  1. Update metadata enrichment API clients to extract album artwork URLs';
    RAISE NOTICE '  2. Update enrichment pipeline to store artwork in database';
    RAISE NOTICE '  3. Run: REFRESH MATERIALIZED VIEW album_artwork_coverage_stats;';
END $$;
