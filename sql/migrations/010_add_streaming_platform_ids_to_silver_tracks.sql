-- ===================================================================
-- Migration 010: Add Streaming Platform IDs to Silver Enriched Tracks
-- ===================================================================
-- Date: 2025-11-12
-- Issue: Missing youtube_music_id, beatport_id, soundcloud_id, deezer_id,
--        musicbrainz_id, apple_music_id, and tidal_id columns in silver_enriched_tracks
-- Impact: Graph API and REST API fail with "column does not exist" errors
-- ===================================================================

-- Add streaming platform ID columns to silver_enriched_tracks
ALTER TABLE silver_enriched_tracks
  ADD COLUMN IF NOT EXISTS apple_music_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS beatport_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS soundcloud_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS deezer_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS youtube_music_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS musicbrainz_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS tidal_id VARCHAR(100);

-- Add streaming platform ID columns to musicdb.artists table
ALTER TABLE musicdb.artists
  ADD COLUMN IF NOT EXISTS beatport_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS deezer_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS youtube_music_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS musicbrainz_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS tidal_id INTEGER,
  ADD COLUMN IF NOT EXISTS genres TEXT[],
  ADD COLUMN IF NOT EXISTS country VARCHAR(2),
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS popularity_score NUMERIC(5,2);

-- Create indexes for fast lookups on streaming platform IDs (tracks)
CREATE INDEX IF NOT EXISTS idx_silver_tracks_apple_music_id
  ON silver_enriched_tracks(apple_music_id) WHERE apple_music_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_silver_tracks_beatport_id
  ON silver_enriched_tracks(beatport_id) WHERE beatport_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_silver_tracks_soundcloud_id
  ON silver_enriched_tracks(soundcloud_id) WHERE soundcloud_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_silver_tracks_deezer_id
  ON silver_enriched_tracks(deezer_id) WHERE deezer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_silver_tracks_youtube_music_id
  ON silver_enriched_tracks(youtube_music_id) WHERE youtube_music_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_silver_tracks_musicbrainz_id
  ON silver_enriched_tracks(musicbrainz_id) WHERE musicbrainz_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_silver_tracks_tidal_id
  ON silver_enriched_tracks(tidal_id) WHERE tidal_id IS NOT NULL;

-- Create indexes for fast lookups on streaming platform IDs (artists)
CREATE INDEX IF NOT EXISTS idx_artists_beatport_id
  ON musicdb.artists(beatport_id) WHERE beatport_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_artists_deezer_id
  ON musicdb.artists(deezer_id) WHERE deezer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_artists_youtube_music_id
  ON musicdb.artists(youtube_music_id) WHERE youtube_music_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_artists_musicbrainz_id
  ON musicdb.artists(musicbrainz_id) WHERE musicbrainz_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_artists_tidal_id
  ON musicdb.artists(tidal_id) WHERE tidal_id IS NOT NULL;

-- Drop and recreate musicdb.tracks view to include streaming platform IDs
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

-- Recreate public.tracks view to include streaming platform IDs
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

-- Update graph_nodes view to use the correct columns from tracks view
DROP VIEW IF EXISTS graph_nodes CASCADE;

CREATE OR REPLACE VIEW graph_nodes AS
-- SONG NODES - with complete metadata from silver_enriched_tracks via tracks view
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

    -- Streaming platform IDs (now available from tracks view)
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

-- ARTIST NODES - with complete metadata
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

-- Add helpful comment
COMMENT ON TABLE silver_enriched_tracks IS 'Silver layer enriched tracks with complete streaming platform IDs: Spotify, Apple Music, TIDAL, Beatport, SoundCloud, Deezer, YouTube Music, MusicBrainz';
COMMENT ON VIEW musicdb.tracks IS 'Track view exposing silver_enriched_tracks with all streaming platform IDs';
COMMENT ON VIEW public.tracks IS 'Public track view with complete streaming platform integration';
COMMENT ON VIEW graph_nodes IS 'Complete graph nodes VIEW combining tracks and artists with ALL metadata fields including streaming platform IDs. Updated 2025-11-12 to include youtube_music_id and other platform IDs.';

-- Verification query
DO $$
DECLARE
    col_count INTEGER;
BEGIN
    -- Verify youtube_music_id exists in silver_enriched_tracks
    SELECT COUNT(*) INTO col_count
    FROM information_schema.columns
    WHERE table_name = 'silver_enriched_tracks'
      AND column_name = 'youtube_music_id';

    IF col_count > 0 THEN
        RAISE NOTICE 'SUCCESS: youtube_music_id column added to silver_enriched_tracks';
    ELSE
        RAISE WARNING 'FAILED: youtube_music_id column not found in silver_enriched_tracks';
    END IF;

    -- Verify musicdb.tracks view includes youtube_music_id
    SELECT COUNT(*) INTO col_count
    FROM information_schema.columns
    WHERE table_name = 'tracks'
      AND table_schema = 'musicdb'
      AND column_name = 'youtube_music_id';

    IF col_count > 0 THEN
        RAISE NOTICE 'SUCCESS: youtube_music_id column exposed in musicdb.tracks view';
    ELSE
        RAISE WARNING 'FAILED: youtube_music_id column not found in musicdb.tracks view';
    END IF;

    -- Verify public.tracks view includes youtube_music_id
    SELECT COUNT(*) INTO col_count
    FROM information_schema.columns
    WHERE table_name = 'tracks'
      AND table_schema = 'public'
      AND column_name = 'youtube_music_id';

    IF col_count > 0 THEN
        RAISE NOTICE 'SUCCESS: youtube_music_id column exposed in public.tracks view';
    ELSE
        RAISE WARNING 'FAILED: youtube_music_id column not found in public.tracks view';
    END IF;

    -- Verify graph_nodes view includes youtube_music_id
    SELECT COUNT(*) INTO col_count
    FROM information_schema.columns
    WHERE table_name = 'graph_nodes'
      AND column_name = 'youtube_music_id';

    IF col_count > 0 THEN
        RAISE NOTICE 'SUCCESS: youtube_music_id column available in graph_nodes view';
    ELSE
        RAISE WARNING 'FAILED: youtube_music_id column not found in graph_nodes view';
    END IF;

    RAISE NOTICE 'Migration 010: Streaming platform IDs migration completed';
END $$;
