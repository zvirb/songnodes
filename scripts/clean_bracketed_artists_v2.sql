-- Clean Artist Names - Remove Tracklist Formatting Artifacts
-- Version 2: Handles unique constraint by merging BEFORE cleaning

\echo '============================================================'
\echo 'Artist Name Cleanup - Before Statistics'
\echo '============================================================'

SELECT
    COUNT(*) as total_artists,
    COUNT(*) FILTER (WHERE name ~ '^\[\d{1,2}:\d{2}\]') as with_timestamps,
    COUNT(*) FILTER (WHERE name ~ '^[+*-] ') as with_special_chars,
    COUNT(*) FILTER (WHERE name ~ '^\[') as with_any_brackets
FROM artists;

\echo ''
\echo '============================================================'
\echo 'Step 1: Identify artists that will collide after cleaning'
\echo '============================================================'

-- Create temporary table with cleaned names and collision detection
CREATE TEMP TABLE artist_cleanup_plan AS
SELECT
    artist_id,
    name as original_name,
    TRIM(
        regexp_replace(
            regexp_replace(
                regexp_replace(
                    regexp_replace(
                        regexp_replace(
                            regexp_replace(
                                regexp_replace(
                                    regexp_replace(name,
                                        '^\[\d{1,2}:\d{2}\]\s*', '', 'g'),
                                    '^\[\?+:\?+:\?+\]\s*', '', 'g'),
                                '^\[\?+:\?+\]\s*', '', 'g'),
                            '^\[\?+\]\s*', '', 'g'),
                        '^\+\s*#\s*', '', 'g'),
                    '^\+\s+', '', 'g'),
                '^-\s+', '', 'g'),
            '^\*\s+', '', 'g')
    ) as cleaned_name,
    created_at
FROM artists
WHERE name ~ '^\[' OR name ~ '^[+*-] ';

\echo 'Artists to clean:'
SELECT COUNT(*) FROM artist_cleanup_plan;

\echo ''
\echo 'Checking for collisions with existing artists...'

-- Find which cleaned names already exist
CREATE TEMP TABLE artist_collisions AS
SELECT
    acp.cleaned_name,
    acp.artist_id as duplicate_id,
    a.artist_id as existing_id,
    acp.original_name as duplicate_name,
    a.name as existing_name
FROM artist_cleanup_plan acp
JOIN artists a ON LOWER(TRIM(a.name)) = LOWER(TRIM(acp.cleaned_name))
WHERE acp.artist_id != a.artist_id;

SELECT COUNT(*) as collision_count FROM artist_collisions;

\echo ''
\echo 'Sample collisions (first 10):'
SELECT duplicate_name, existing_name, cleaned_name
FROM artist_collisions
LIMIT 10;

\echo ''
\echo '============================================================'
\echo 'Step 2: Merge colliding artists'
\echo '============================================================'

-- Merge track_artists for collisions
DO $$
DECLARE
    collision_record RECORD;
    updated_count INT;
    total_updated INT := 0;
    total_merged INT := 0;
BEGIN
    FOR collision_record IN SELECT * FROM artist_collisions LOOP
        -- Update track_artists to point to existing artist
        UPDATE track_artists
        SET artist_id = collision_record.existing_id,
            updated_at = CURRENT_TIMESTAMP
        WHERE artist_id = collision_record.duplicate_id;

        GET DIAGNOSTICS updated_count = ROW_COUNT;
        total_updated := total_updated + updated_count;
        total_merged := total_merged + 1;

        -- Delete duplicate artist record
        DELETE FROM artists WHERE artist_id = collision_record.duplicate_id;
    END LOOP;

    RAISE NOTICE 'Merged % duplicate artists', total_merged;
    RAISE NOTICE 'Updated % track_artists rows', total_updated;
END $$;

\echo ''
\echo '============================================================'
\echo 'Step 3: Clean remaining artist names (no collisions)'
\echo '============================================================'

-- Now clean names that won't collide
UPDATE artists a
SET name = acp.cleaned_name,
    updated_at = CURRENT_TIMESTAMP
FROM artist_cleanup_plan acp
WHERE a.artist_id = acp.artist_id
  AND NOT EXISTS (
      SELECT 1 FROM artist_collisions ac
      WHERE ac.duplicate_id = acp.artist_id
  );

\echo 'Cleaned names updated!'

\echo ''
\echo '============================================================'
\echo 'Step 4: Find remaining duplicates (same name, different IDs)'
\echo '============================================================'

CREATE TEMP TABLE remaining_duplicates AS
SELECT
    LOWER(TRIM(name)) as normalized_name,
    array_agg(artist_id ORDER BY created_at) as artist_ids,
    COUNT(*) as duplicate_count
FROM artists
GROUP BY LOWER(TRIM(name))
HAVING COUNT(*) > 1;

SELECT
    COUNT(*) as duplicate_groups,
    SUM(duplicate_count - 1) as artists_to_merge
FROM remaining_duplicates;

\echo ''
\echo '============================================================'
\echo 'Step 5: Merge remaining duplicates'
\echo '============================================================'

DO $$
DECLARE
    dup_record RECORD;
    keep_id UUID;
    merge_ids UUID[];
    updated_count INT;
    total_updated INT := 0;
    total_merged INT := 0;
BEGIN
    FOR dup_record IN SELECT * FROM remaining_duplicates LOOP
        keep_id := dup_record.artist_ids[1];
        merge_ids := dup_record.artist_ids[2:array_length(dup_record.artist_ids, 1)];

        UPDATE track_artists
        SET artist_id = keep_id,
            updated_at = CURRENT_TIMESTAMP
        WHERE artist_id = ANY(merge_ids);

        GET DIAGNOSTICS updated_count = ROW_COUNT;
        total_updated := total_updated + updated_count;
        total_merged := total_merged + array_length(merge_ids, 1);

        DELETE FROM artists WHERE artist_id = ANY(merge_ids);
    END LOOP;

    RAISE NOTICE 'Merged % remaining duplicate artists', total_merged;
    RAISE NOTICE 'Updated % track_artists rows', total_updated;
END $$;

\echo ''
\echo '============================================================'
\echo 'Cleanup Complete - After Statistics'
\echo '============================================================'

SELECT
    COUNT(*) as total_artists,
    COUNT(*) FILTER (WHERE name ~ '^\[\d{1,2}:\d{2}\]') as with_timestamps,
    COUNT(*) FILTER (WHERE name ~ '^[+*-] ') as with_special_chars,
    COUNT(*) FILTER (WHERE name ~ '^\[') as with_any_brackets
FROM artists;

\echo ''
\echo '============================================================'
\echo 'NEXT STEP: Rebuild graph nodes view'
\echo '============================================================'
\echo 'Run: REFRESH MATERIALIZED VIEW CONCURRENTLY graph_nodes;'
\echo '============================================================'
