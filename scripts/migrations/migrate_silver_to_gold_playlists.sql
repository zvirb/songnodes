-- Migration: Copy 581 playlists from silver to gold layer
-- Purpose: Increase song adjacency graph coverage
-- Author: Schema Database Expert Agent
-- Date: 2025-10-19

-- Prerequisites:
-- 1. silver_enriched_playlists must exist with data
-- 2. silver_playlist_tracks must exist with track relationships
-- 3. tracks (gold) table must have normalized_title populated
-- 4. artists (gold) table must exist

BEGIN;

-- Step 1: Create temporary mapping table for silver→gold track IDs
DROP TABLE IF EXISTS temp_track_id_mapping;
CREATE TEMP TABLE temp_track_id_mapping AS
SELECT DISTINCT
    st.id as silver_track_id,
    t.id as gold_track_id,
    st.spotify_id,
    st.track_title,
    st.artist_name
FROM silver_enriched_tracks st
INNER JOIN tracks t ON (
    -- Primary match: Spotify ID (most reliable)
    (st.spotify_id IS NOT NULL AND st.spotify_id = t.spotify_id)
    OR
    -- Secondary match: Normalized title + artist (via track_artists)
    (
        LOWER(TRIM(st.track_title)) = t.normalized_title
        AND EXISTS (
            SELECT 1 FROM track_artists ta
            INNER JOIN artists a ON ta.artist_id = a.artist_id
            WHERE ta.track_id = t.id
            AND LOWER(TRIM(a.name)) = LOWER(TRIM(st.artist_name))
        )
    )
);

CREATE INDEX idx_temp_silver_track ON temp_track_id_mapping(silver_track_id);
CREATE INDEX idx_temp_gold_track ON temp_track_id_mapping(gold_track_id);

-- Report mapping statistics
DO $$
DECLARE
    v_total_silver_tracks INTEGER;
    v_mapped_tracks INTEGER;
    v_mapping_rate NUMERIC;
BEGIN
    SELECT COUNT(DISTINCT id) INTO v_total_silver_tracks
    FROM silver_enriched_tracks st
    WHERE EXISTS (
        SELECT 1 FROM silver_playlist_tracks spt WHERE spt.track_id = st.id
    );

    SELECT COUNT(*) INTO v_mapped_tracks FROM temp_track_id_mapping;

    v_mapping_rate := ROUND((v_mapped_tracks::NUMERIC / NULLIF(v_total_silver_tracks, 0) * 100), 2);

    RAISE NOTICE '═══════════════════════════════════════════════════════════';
    RAISE NOTICE 'Track ID Mapping Statistics:';
    RAISE NOTICE '  Total silver tracks in playlists: %', v_total_silver_tracks;
    RAISE NOTICE '  Successfully mapped to gold: %', v_mapped_tracks;
    RAISE NOTICE '  Mapping rate: % percent', v_mapping_rate;
    RAISE NOTICE '═══════════════════════════════════════════════════════════';
END $$;

-- Step 2: Create temporary mapping for artist names to artist_id (gold)
DROP TABLE IF EXISTS temp_artist_mapping;
CREATE TEMP TABLE temp_artist_mapping AS
SELECT DISTINCT
    sp.artist_name,
    a.artist_id
FROM silver_enriched_playlists sp
LEFT JOIN artists a ON LOWER(TRIM(sp.artist_name)) = LOWER(TRIM(a.name))
WHERE sp.artist_name IS NOT NULL
  AND sp.artist_name != '';

CREATE INDEX idx_temp_artist_name ON temp_artist_mapping(artist_name);

-- Step 3: Insert playlists from silver to gold
-- Only migrate playlists that:
-- 1. Have tracks in silver_playlist_tracks
-- 2. Don't already exist in gold (by source)
-- 3. Have at least some mappable tracks

INSERT INTO playlists (
    playlist_id,
    name,
    source,
    source_url,
    playlist_type,
    dj_artist_id,
    event_name,
    event_date,
    tracklist_count,
    created_at,
    updated_at
)
SELECT
    sp.id,  -- Use silver ID as gold playlist_id for traceability
    sp.playlist_name,
    'silver_' || sp.id::text as source,  -- Unique source identifier
    NULL as source_url,
    'dj_set' as playlist_type,
    tam.artist_id as dj_artist_id,
    sp.event_name,
    sp.event_date,
    -- Ensure tracklist_count is at least 1 to satisfy constraint
    GREATEST(COALESCE(sp.track_count, 1), 1) as tracklist_count,
    sp.created_at,
    sp.updated_at
FROM silver_enriched_playlists sp
LEFT JOIN temp_artist_mapping tam ON sp.artist_name = tam.artist_name
WHERE
    -- Must have tracks
    EXISTS (
        SELECT 1 FROM silver_playlist_tracks spt
        WHERE spt.playlist_id = sp.id
    )
    -- Not already in gold
    AND NOT EXISTS (
        SELECT 1 FROM playlists p
        WHERE p.source = 'silver_' || sp.id::text
    )
    -- At least 50% of tracks must be mappable to gold
    AND (
        SELECT COUNT(*)
        FROM silver_playlist_tracks spt
        INNER JOIN temp_track_id_mapping ttm ON spt.track_id = ttm.silver_track_id
        WHERE spt.playlist_id = sp.id
    ) >= (
        SELECT COUNT(*) * 0.5
        FROM silver_playlist_tracks spt
        WHERE spt.playlist_id = sp.id
    )
ON CONFLICT (playlist_id) DO NOTHING;

-- Get count of inserted playlists
DO $$
DECLARE
    v_inserted_count INTEGER;
BEGIN
    GET DIAGNOSTICS v_inserted_count = ROW_COUNT;
    RAISE NOTICE '═══════════════════════════════════════════════════════════';
    RAISE NOTICE 'Playlists Migration:';
    RAISE NOTICE '  Playlists inserted: %', v_inserted_count;
    RAISE NOTICE '═══════════════════════════════════════════════════════════';
END $$;

-- Step 4: Insert playlist_tracks relationships
-- Map silver track IDs to gold track IDs and create relationships

INSERT INTO playlist_tracks (
    playlist_id,
    position,
    song_id,
    added_at
)
SELECT DISTINCT
    spt.playlist_id,  -- This is now the same as playlists.playlist_id (we used silver ID)
    spt.position,
    ttm.gold_track_id as song_id,
    spt.created_at as added_at
FROM silver_playlist_tracks spt
INNER JOIN temp_track_id_mapping ttm ON spt.track_id = ttm.silver_track_id
WHERE EXISTS (
    SELECT 1 FROM playlists p
    WHERE p.playlist_id = spt.playlist_id
    AND p.source LIKE 'silver_%'
)
ON CONFLICT (playlist_id, position) DO NOTHING;

-- Get count of inserted track relationships
DO $$
DECLARE
    v_tracks_inserted INTEGER;
BEGIN
    GET DIAGNOSTICS v_tracks_inserted = ROW_COUNT;
    RAISE NOTICE '═══════════════════════════════════════════════════════════';
    RAISE NOTICE 'Playlist Tracks Migration:';
    RAISE NOTICE '  Track relationships inserted: %', v_tracks_inserted;
    RAISE NOTICE '═══════════════════════════════════════════════════════════';
END $$;

-- Step 5: Validation and final statistics
DO $$
DECLARE
    v_total_playlists INTEGER;
    v_playlists_with_tracks INTEGER;
    v_orphaned_playlists INTEGER;
    v_total_relationships INTEGER;
    v_avg_tracks_per_playlist NUMERIC;
BEGIN
    SELECT COUNT(*) INTO v_total_playlists
    FROM playlists
    WHERE source LIKE 'silver_%';

    SELECT COUNT(DISTINCT playlist_id) INTO v_playlists_with_tracks
    FROM playlist_tracks pt
    WHERE EXISTS (
        SELECT 1 FROM playlists p
        WHERE p.playlist_id = pt.playlist_id
        AND p.source LIKE 'silver_%'
    );

    v_orphaned_playlists := v_total_playlists - v_playlists_with_tracks;

    SELECT COUNT(*) INTO v_total_relationships
    FROM playlist_tracks pt
    WHERE EXISTS (
        SELECT 1 FROM playlists p
        WHERE p.playlist_id = pt.playlist_id
        AND p.source LIKE 'silver_%'
    );

    v_avg_tracks_per_playlist := ROUND(
        v_total_relationships::NUMERIC / NULLIF(v_playlists_with_tracks, 0),
        2
    );

    RAISE NOTICE '═══════════════════════════════════════════════════════════';
    RAISE NOTICE 'Migration Summary:';
    RAISE NOTICE '  Total playlists migrated: %', v_total_playlists;
    RAISE NOTICE '  Playlists with tracks: %', v_playlists_with_tracks;
    RAISE NOTICE '  Orphaned playlists (no tracks): %', v_orphaned_playlists;
    RAISE NOTICE '  Total track relationships: %', v_total_relationships;
    RAISE NOTICE '  Avg tracks per playlist: %', v_avg_tracks_per_playlist;
    RAISE NOTICE '═══════════════════════════════════════════════════════════';

    -- Validation: Check for data quality issues
    IF v_orphaned_playlists > 0 THEN
        RAISE WARNING 'Found % playlists without track relationships - these may need manual review', v_orphaned_playlists;
    END IF;

    IF v_avg_tracks_per_playlist < 5 THEN
        RAISE WARNING 'Average tracks per playlist is low (%) - track mapping may be incomplete', v_avg_tracks_per_playlist;
    END IF;
END $$;

-- Step 6: Create analytics linkage in gold_playlist_analytics
INSERT INTO gold_playlist_analytics (
    silver_playlist_id,
    playlist_name,
    artist_name,
    event_name,
    event_date,
    event_location,
    track_count,
    total_duration_ms,
    avg_bpm,
    avg_energy,
    genre_distribution,
    data_quality_score,
    created_at,
    updated_at
)
SELECT
    sp.id as silver_playlist_id,
    sp.playlist_name,
    sp.artist_name,
    sp.event_name,
    sp.event_date,
    sp.event_location,
    sp.track_count,
    sp.total_duration_ms,
    NULL as avg_bpm,  -- To be calculated later
    NULL as avg_energy,  -- To be calculated later
    '{}'::jsonb as genre_distribution,
    sp.data_quality_score,
    sp.created_at,
    sp.updated_at
FROM silver_enriched_playlists sp
WHERE EXISTS (
    SELECT 1 FROM playlists p
    WHERE p.playlist_id = sp.id
    AND p.source = 'silver_' || sp.id::text
)
AND NOT EXISTS (
    SELECT 1 FROM gold_playlist_analytics gpa
    WHERE gpa.silver_playlist_id = sp.id
);

-- Final report
DO $$
DECLARE
    v_analytics_count INTEGER;
BEGIN
    GET DIAGNOSTICS v_analytics_count = ROW_COUNT;
    RAISE NOTICE '═══════════════════════════════════════════════════════════';
    RAISE NOTICE 'Analytics Linkage:';
    RAISE NOTICE '  Analytics entries created: %', v_analytics_count;
    RAISE NOTICE '═══════════════════════════════════════════════════════════';
    RAISE NOTICE 'Migration completed successfully!';
    RAISE NOTICE '═══════════════════════════════════════════════════════════';
END $$;

COMMIT;

-- Post-migration recommendations:
-- 1. Run ANALYZE on affected tables for query planner optimization
-- 2. Consider running graph edge generation for new playlist relationships
-- 3. Update materialized views if any depend on playlist data
-- 4. Monitor song_adjacency table for new edges

ANALYZE playlists;
ANALYZE playlist_tracks;
ANALYZE gold_playlist_analytics;
