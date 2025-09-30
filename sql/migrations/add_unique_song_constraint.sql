-- Migration: Add unique constraint to songs table
-- Prevents duplicate (title, primary_artist_id) combinations
-- Enables ON CONFLICT deduplication in database_pipeline.py
-- Date: 2025-09-30
-- Author: Claude Code (implementing 2025 best practices)

-- Step 1: Remove any existing duplicates before adding constraint
-- (This should already be done, but ensures clean state)

DO $$
BEGIN
    -- Log current state
    RAISE NOTICE 'Checking for duplicate (title, primary_artist_id) combinations...';

    -- Check if duplicates exist
    IF EXISTS (
        SELECT title, primary_artist_id, COUNT(*)
        FROM songs
        GROUP BY title, primary_artist_id
        HAVING COUNT(*) > 1
    ) THEN
        RAISE NOTICE 'Found duplicates - will keep only the oldest entry for each (title, artist) pair';

        -- Delete duplicates, keeping only the oldest (first inserted) record
        DELETE FROM songs
        WHERE song_id IN (
            SELECT song_id
            FROM (
                SELECT song_id,
                       ROW_NUMBER() OVER (
                           PARTITION BY title, primary_artist_id
                           ORDER BY created_at ASC, song_id ASC
                       ) AS rn
                FROM songs
            ) AS ranked
            WHERE rn > 1
        );

        RAISE NOTICE 'Duplicate songs removed successfully';
    ELSE
        RAISE NOTICE 'No duplicates found - proceeding with constraint creation';
    END IF;
END $$;

-- Step 2: Add unique constraint
-- This enables database-level deduplication
ALTER TABLE songs
ADD CONSTRAINT unique_song_title_artist
UNIQUE (title, primary_artist_id);

-- Step 3: Add check constraint to prevent generic artist names
-- (Artist table constraint to prevent creation of placeholder artists)
ALTER TABLE artists
ADD CONSTRAINT check_not_generic_artist
CHECK (artist_name NOT IN ('Various Artists', 'Unknown Artist', 'Various', 'Unknown'));

-- Step 4: Verify constraints were added successfully
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'unique_song_title_artist'
    ) THEN
        RAISE NOTICE '✓ Unique constraint "unique_song_title_artist" added successfully';
    ELSE
        RAISE EXCEPTION '❌ Failed to add unique constraint';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'check_not_generic_artist'
    ) THEN
        RAISE NOTICE '✓ Check constraint "check_not_generic_artist" added successfully';
    ELSE
        RAISE EXCEPTION '❌ Failed to add check constraint';
    END IF;
END $$;

-- Step 5: Refresh materialized views with clean data
REFRESH MATERIALIZED VIEW CONCURRENTLY graph_nodes;
REFRESH MATERIALIZED VIEW CONCURRENTLY graph_edges;

-- Final verification
SELECT
    'songs' AS table_name,
    COUNT(*) AS total_songs,
    COUNT(DISTINCT (title, primary_artist_id)) AS unique_title_artist_pairs
FROM songs;

SELECT
    'Constraint verification' AS status,
    'unique_song_title_artist' AS constraint_name,
    CASE
        WHEN COUNT(*) = COUNT(DISTINCT (title, primary_artist_id))
        THEN '✓ PASS - No duplicates'
        ELSE '❌ FAIL - Duplicates still exist'
    END AS result
FROM songs;