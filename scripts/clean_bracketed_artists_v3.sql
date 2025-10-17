-- Clean Artist Names - Remove Tracklist Formatting Artifacts
-- Version 3: Handles all constraints properly

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
\echo 'Step 1: Merge artists that will collide after cleaning'
\echo '============================================================'

-- Find collisions and merge them
DO $$
DECLARE
    collision_record RECORD;
    updated_count INT;
    deleted_count INT;
    total_updated INT := 0;
    total_merged INT := 0;
BEGIN
    -- Find artists whose cleaned names match existing artists
    FOR collision_record IN
        SELECT
            a_dup.artist_id as duplicate_id,
            a_existing.artist_id as existing_id,
            a_dup.name as duplicate_name,
            a_existing.name as existing_name
        FROM artists a_dup
        JOIN artists a_existing ON
            LOWER(TRIM(
                regexp_replace(
                    regexp_replace(
                        regexp_replace(
                            regexp_replace(
                                regexp_replace(
                                    regexp_replace(
                                        regexp_replace(
                                            regexp_replace(a_dup.name,
                                                '^\[\d{1,2}:\d{2}\]\s*', '', 'g'),
                                            '^\[\?+:\?+:\?+\]\s*', '', 'g'),
                                        '^\[\?+:\?+\]\s*', '', 'g'),
                                    '^\[\?+\]\s*', '', 'g'),
                                '^\+\s*#\s*', '', 'g'),
                            '^\+\s+', '', 'g'),
                        '^-\s+', '', 'g'),
                    '^\*\s+', '', 'g')
            )) = LOWER(TRIM(a_existing.name))
        WHERE a_dup.artist_id != a_existing.artist_id
          AND (a_dup.name ~ '^\[' OR a_dup.name ~ '^[+*-] ')
    LOOP
        -- Delete conflicting track_artists relationships
        -- (where track already has relationship with existing artist)
        DELETE FROM track_artists ta_dup
        WHERE ta_dup.artist_id = collision_record.duplicate_id
          AND EXISTS (
              SELECT 1 FROM track_artists ta_existing
              WHERE ta_existing.track_id = ta_dup.track_id
                AND ta_existing.artist_id = collision_record.existing_id
                AND ta_existing.role = ta_dup.role
          );

        GET DIAGNOSTICS deleted_count = ROW_COUNT;

        -- Update remaining track_artists to point to existing artist
        UPDATE track_artists
        SET artist_id = collision_record.existing_id
        WHERE artist_id = collision_record.duplicate_id;

        GET DIAGNOSTICS updated_count = ROW_COUNT;
        total_updated := total_updated + updated_count;
        total_merged := total_merged + 1;

        -- Delete duplicate artist record
        DELETE FROM artists WHERE artist_id = collision_record.duplicate_id;
    END LOOP;

    RAISE NOTICE 'Merged % artists with collisions', total_merged;
    RAISE NOTICE 'Updated % track_artists rows', total_updated;
END $$;

\echo ''
\echo '============================================================'
\echo 'Step 2: Clean remaining artist names'
\echo '============================================================'

-- Now clean names that won't collide
UPDATE artists
SET name = TRIM(
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
    )
WHERE name ~ '^\[' OR name ~ '^[+*-] ';

\echo 'Cleaned names updated!'

\echo ''
\echo '============================================================'
\echo 'Step 3: Find and merge remaining duplicates'
\echo '============================================================'

DO $$
DECLARE
    dup_record RECORD;
    keep_id UUID;
    merge_id UUID;
    deleted_count INT;
    updated_count INT;
    total_updated INT := 0;
    total_merged INT := 0;
BEGIN
    -- Find remaining duplicates (same name, different artist_id)
    FOR dup_record IN
        SELECT
            LOWER(TRIM(name)) as normalized_name,
            array_agg(artist_id ORDER BY created_at) as artist_ids
        FROM artists
        GROUP BY LOWER(TRIM(name))
        HAVING COUNT(*) > 1
    LOOP
        -- Keep first (oldest) artist
        keep_id := dup_record.artist_ids[1];

        -- Merge each duplicate
        FOR i IN 2..array_length(dup_record.artist_ids, 1) LOOP
            merge_id := dup_record.artist_ids[i];

            -- Delete conflicting track_artists
            DELETE FROM track_artists ta_dup
            WHERE ta_dup.artist_id = merge_id
              AND EXISTS (
                  SELECT 1 FROM track_artists ta_keep
                  WHERE ta_keep.track_id = ta_dup.track_id
                    AND ta_keep.artist_id = keep_id
                    AND ta_keep.role = ta_dup.role
              );

            GET DIAGNOSTICS deleted_count = ROW_COUNT;

            -- Update remaining track_artists
            UPDATE track_artists
            SET artist_id = keep_id
            WHERE artist_id = merge_id;

            GET DIAGNOSTICS updated_count = ROW_COUNT;
            total_updated := total_updated + updated_count;

            -- Delete duplicate artist
            DELETE FROM artists WHERE artist_id = merge_id;
            total_merged := total_merged + 1;
        END LOOP;
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
\echo 'Sample cleaned artists (first 20):'
SELECT name FROM artists WHERE name NOT LIKE '[%' AND name NOT LIKE '+%' ORDER BY created_at DESC LIMIT 20;

\echo ''
\echo '============================================================'
\echo 'SUCCESS! Next step:'
\echo 'REFRESH MATERIALIZED VIEW CONCURRENTLY graph_nodes;'
\echo '============================================================'
