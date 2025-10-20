-- ============================================================================
-- Fix Song Adjacency Pipeline
-- ============================================================================
-- ISSUE: update_song_adjacency function references non-existent 'playlist_songs' table
-- ACTUAL TABLE: 'playlist_tracks'
-- RESULT: 14,832 tracks with valid artists have ZERO edges in song_adjacency
-- ============================================================================

-- Step 1: Drop the broken function
DROP FUNCTION IF EXISTS update_song_adjacency(uuid);

-- Step 2: Create corrected function using playlist_tracks table
CREATE OR REPLACE FUNCTION update_song_adjacency(p_playlist_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    v_song_pair RECORD;
BEGIN
    -- Find ONLY consecutive pairs of songs in the playlist (distance = 1)
    -- CORRECTED: Use playlist_tracks instead of playlist_songs
    FOR v_song_pair IN
        SELECT
            LEAST(pt1.song_id, pt2.song_id) as song_id_1,
            GREATEST(pt1.song_id, pt2.song_id) as song_id_2,
            1 as distance  -- Always 1 for consecutive tracks
        FROM playlist_tracks pt1
        JOIN playlist_tracks pt2 ON pt1.playlist_id = pt2.playlist_id
        WHERE pt1.playlist_id = p_playlist_id
        AND pt1.song_id != pt2.song_id
        AND ABS(pt1.position - pt2.position) = 1  -- ONLY consecutive tracks
    LOOP
        INSERT INTO song_adjacency (song_id_1, song_id_2, occurrence_count, avg_distance)
        VALUES (v_song_pair.song_id_1, v_song_pair.song_id_2, 1, 1.0)  -- Distance always 1.0
        ON CONFLICT (song_id_1, song_id_2) DO UPDATE
        SET
            occurrence_count = song_adjacency.occurrence_count + 1,
            avg_distance = 1.0;  -- Keep distance at 1.0 for consecutive-only edges
    END LOOP;
END;
$$;

COMMENT ON FUNCTION update_song_adjacency IS 'Creates song_adjacency edges from consecutive tracks in playlist_tracks. Fixed to use playlist_tracks instead of non-existent playlist_songs table.';

-- Step 3: Create trigger to auto-populate adjacencies on new playlists
CREATE OR REPLACE FUNCTION trigger_update_adjacency_on_playlist()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- When a playlist_tracks entry is inserted, update adjacencies for that playlist
    PERFORM update_song_adjacency(NEW.playlist_id);
    RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS auto_update_adjacency_on_playlist_track ON playlist_tracks;

-- Create trigger that fires after INSERT on playlist_tracks
-- Use a statement-level trigger that fires once per playlist
CREATE TRIGGER auto_update_adjacency_on_playlist_track
    AFTER INSERT ON playlist_tracks
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_adjacency_on_playlist();

COMMENT ON TRIGGER auto_update_adjacency_on_playlist_track ON playlist_tracks IS 'Auto-populates song_adjacency when new playlist tracks are inserted';

-- Step 4: Backfill all missing adjacencies from existing playlist_tracks
DO $$
DECLARE
    v_playlist_id UUID;
    v_playlist_count INTEGER := 0;
    v_edge_count_before INTEGER;
    v_edge_count_after INTEGER;
    v_start_time TIMESTAMP;
BEGIN
    v_start_time := clock_timestamp();

    -- Get initial edge count
    SELECT COUNT(*) INTO v_edge_count_before FROM song_adjacency;

    RAISE NOTICE '============================================================';
    RAISE NOTICE 'BACKFILLING SONG ADJACENCIES FROM PLAYLIST_TRACKS';
    RAISE NOTICE '============================================================';
    RAISE NOTICE 'Initial edge count: %', v_edge_count_before;
    RAISE NOTICE 'Processing playlists...';

    -- Loop through all playlists that have tracks
    FOR v_playlist_id IN
        SELECT DISTINCT playlist_id
        FROM playlist_tracks
        ORDER BY playlist_id
    LOOP
        -- Update adjacencies for this playlist
        PERFORM update_song_adjacency(v_playlist_id);
        v_playlist_count := v_playlist_count + 1;

        -- Progress logging every 100 playlists
        IF v_playlist_count % 100 = 0 THEN
            RAISE NOTICE 'Processed % playlists...', v_playlist_count;
        END IF;
    END LOOP;

    -- Get final edge count
    SELECT COUNT(*) INTO v_edge_count_after FROM song_adjacency;

    RAISE NOTICE '============================================================';
    RAISE NOTICE 'BACKFILL COMPLETE';
    RAISE NOTICE '============================================================';
    RAISE NOTICE 'Playlists processed: %', v_playlist_count;
    RAISE NOTICE 'Edges before: %', v_edge_count_before;
    RAISE NOTICE 'Edges after: %', v_edge_count_after;
    RAISE NOTICE 'New edges created: %', v_edge_count_after - v_edge_count_before;
    RAISE NOTICE 'Duration: %', clock_timestamp() - v_start_time;
    RAISE NOTICE '============================================================';
END;
$$;

-- Step 5: Verify the fix
DO $$
DECLARE
    v_total_tracks INTEGER;
    v_tracks_with_edges INTEGER;
    v_isolated_tracks INTEGER;
    v_total_edges INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_total_tracks
    FROM tracks t
    WHERE EXISTS (
        SELECT 1 FROM track_artists ta
        JOIN artists a ON ta.artist_id = a.artist_id
        WHERE ta.track_id = t.id
        AND a.name IS NOT NULL
        AND a.name != ''
        AND a.name NOT IN ('Unknown', 'Unknown Artist', 'Various Artists', 'VA')
    );

    SELECT COUNT(DISTINCT t.id) INTO v_tracks_with_edges
    FROM tracks t
    WHERE EXISTS (
        SELECT 1 FROM song_adjacency sa
        WHERE sa.song_id_1 = t.id OR sa.song_id_2 = t.id
    );

    v_isolated_tracks := v_total_tracks - v_tracks_with_edges;

    SELECT COUNT(*) INTO v_total_edges FROM song_adjacency;

    RAISE NOTICE '';
    RAISE NOTICE '============================================================';
    RAISE NOTICE 'VERIFICATION RESULTS';
    RAISE NOTICE '============================================================';
    RAISE NOTICE 'Total tracks with valid artists: %', v_total_tracks;
    RAISE NOTICE 'Tracks with edges: % (%.1f%%)', v_tracks_with_edges, (v_tracks_with_edges::float / NULLIF(v_total_tracks, 0) * 100);
    RAISE NOTICE 'Isolated tracks (no edges): % (%.1f%%)', v_isolated_tracks, (v_isolated_tracks::float / NULLIF(v_total_tracks, 0) * 100);
    RAISE NOTICE 'Total edges in song_adjacency: %', v_total_edges;
    RAISE NOTICE '============================================================';
END;
$$;
