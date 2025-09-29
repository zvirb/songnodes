-- Fix adjacency logic to only create edges between consecutive tracks
-- This corrects the issue where tracks appear without edges

-- Drop and recreate the adjacency function to only process consecutive tracks
CREATE OR REPLACE FUNCTION update_song_adjacency(p_playlist_id UUID)
RETURNS void AS $$
DECLARE
    v_song_pair RECORD;
BEGIN
    -- Find ONLY consecutive pairs of songs in the playlist (distance = 1)
    FOR v_song_pair IN
        SELECT
            LEAST(ps1.song_id, ps2.song_id) as song_id_1,
            GREATEST(ps1.song_id, ps2.song_id) as song_id_2,
            1 as distance  -- Always 1 for consecutive tracks
        FROM playlist_songs ps1
        JOIN playlist_songs ps2 ON ps1.playlist_id = ps2.playlist_id
        WHERE ps1.playlist_id = p_playlist_id
        AND ps1.song_id != ps2.song_id
        AND ABS(ps1.position - ps2.position) = 1  -- ONLY consecutive tracks
    LOOP
        INSERT INTO song_adjacency (song_id_1, song_id_2, occurrence_count, avg_distance)
        VALUES (v_song_pair.song_id_1, v_song_pair.song_id_2, 1, 1.0)  -- Distance always 1.0
        ON CONFLICT (song_id_1, song_id_2) DO UPDATE
        SET
            occurrence_count = song_adjacency.occurrence_count + 1,
            avg_distance = 1.0;  -- Keep distance at 1.0 for consecutive-only edges
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Create a function to process existing playlist data and create consecutive adjacencies
CREATE OR REPLACE FUNCTION rebuild_consecutive_adjacencies()
RETURNS void AS $$
DECLARE
    playlist_record RECORD;
    adjacency_count INTEGER := 0;
    total_playlists INTEGER := 0;
BEGIN
    -- Clear existing adjacencies (they may include non-consecutive relationships)
    DELETE FROM song_adjacency;
    RAISE NOTICE 'Cleared existing song adjacencies';

    -- Process all playlists and rebuild with consecutive-only logic
    FOR playlist_record IN
        SELECT DISTINCT playlist_id FROM playlist_songs
    LOOP
        PERFORM update_song_adjacency(playlist_record.playlist_id);
        total_playlists := total_playlists + 1;
    END LOOP;

    -- Get final count
    SELECT COUNT(*) INTO adjacency_count FROM song_adjacency;

    RAISE NOTICE 'Rebuilt adjacencies: % playlists processed, % consecutive adjacencies created',
                 total_playlists, adjacency_count;
END;
$$ LANGUAGE plpgsql;

-- Create a function to import tracklist adjacencies from setlist data
CREATE OR REPLACE FUNCTION import_tracklist_adjacencies(
    tracklist_data JSONB
)
RETURNS void AS $$
DECLARE
    setlist_record JSONB;
    track_record JSONB;
    prev_track JSONB := NULL;
    song_id_1 UUID;
    song_id_2 UUID;
    adjacency_count INTEGER := 0;
BEGIN
    -- Process each setlist in the data
    FOR setlist_record IN
        SELECT value FROM jsonb_array_elements(tracklist_data->'setlists')
    LOOP
        prev_track := NULL;

        -- Process each track in the setlist
        FOR track_record IN
            SELECT value FROM jsonb_array_elements(setlist_record->'tracks')
            ORDER BY (value->>'position')::INTEGER
        LOOP
            -- If we have a previous track, create adjacency
            IF prev_track IS NOT NULL THEN
                -- Look up song IDs by title and artist
                SELECT song_id INTO song_id_1
                FROM songs
                WHERE LOWER(TRIM(title)) = LOWER(TRIM(prev_track->>'title'))
                LIMIT 1;

                SELECT song_id INTO song_id_2
                FROM songs
                WHERE LOWER(TRIM(title)) = LOWER(TRIM(track_record->>'title'))
                LIMIT 1;

                -- Create adjacency if both songs exist and are different
                IF song_id_1 IS NOT NULL AND song_id_2 IS NOT NULL AND song_id_1 != song_id_2 THEN
                    -- Ensure song_id_1 < song_id_2 for constraint
                    IF song_id_1 > song_id_2 THEN
                        -- Swap them
                        song_id_1 := song_id_2;
                        song_id_2 := song_id_1;
                    END IF;

                    INSERT INTO song_adjacency (song_id_1, song_id_2, occurrence_count, avg_distance)
                    VALUES (song_id_1, song_id_2, 1, 1.0)
                    ON CONFLICT (song_id_1, song_id_2) DO UPDATE
                    SET occurrence_count = song_adjacency.occurrence_count + 1;

                    adjacency_count := adjacency_count + 1;
                END IF;
            END IF;

            prev_track := track_record;
        END LOOP;
    END LOOP;

    RAISE NOTICE 'Imported % consecutive adjacencies from tracklist data', adjacency_count;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION update_song_adjacency(UUID) TO musicdb_user;
GRANT EXECUTE ON FUNCTION rebuild_consecutive_adjacencies() TO musicdb_user;
GRANT EXECUTE ON FUNCTION import_tracklist_adjacencies(JSONB) TO musicdb_user;