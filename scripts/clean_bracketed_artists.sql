-- Clean Artist Names - Remove Tracklist Formatting Artifacts
-- This script removes timestamp prefixes and special characters from artist names

-- Step 1: Show statistics BEFORE cleanup
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
\echo 'Sample artists with timestamps:'
SELECT name FROM artists WHERE name ~ '^\[\d{1,2}:\d{2}\]' LIMIT 10;

\echo ''
\echo 'Sample artists with special chars:'
SELECT name FROM artists WHERE name ~ '^[+*-] ' LIMIT 10;

\echo ''
\echo '============================================================'
\echo 'Cleaning artist names...'
\echo '============================================================'

-- Step 2: Clean artist names in-place
-- This uses PostgreSQL regex_replace to remove patterns

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
                                    '^\[\d{1,2}:\d{2}\]\s*', '', 'g'),  -- Remove [MM:SS]
                                '^\[\?+:\?+:\?+\]\s*', '', 'g'),        -- Remove [?:??:??]
                            '^\[\?+:\?+\]\s*', '', 'g'),                -- Remove [??:??]
                        '^\[\?+\]\s*', '', 'g'),                        -- Remove [??]
                    '^\+\s*#\s*', '', 'g'),                             -- Remove + #
                '^\+\s+', '', 'g'),                                     -- Remove +
            '^-\s+', '', 'g'),                                          -- Remove -
        '^\*\s+', '', 'g')                                              -- Remove *
    ),
    updated_at = CURRENT_TIMESTAMP
WHERE name ~ '^\[' OR name ~ '^[+*-] ';

\echo 'Artist names cleaned!'
\echo ''

-- Step 3: Find and merge duplicate artists
\echo '============================================================'
\echo 'Finding duplicate artists...'
\echo '============================================================'

-- Create temporary table with duplicates
CREATE TEMP TABLE artist_duplicates AS
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
FROM artist_duplicates;

\echo ''
\echo 'Sample duplicates:'
SELECT normalized_name, duplicate_count FROM artist_duplicates LIMIT 10;

\echo ''
\echo '============================================================'
\echo 'Merging duplicate artists...'
\echo '============================================================'

-- For each duplicate group, keep the first (oldest) and merge others
DO $$
DECLARE
    dup_record RECORD;
    keep_id UUID;
    merge_ids UUID[];
    updated_count INT;
    total_updated INT := 0;
BEGIN
    FOR dup_record IN SELECT * FROM artist_duplicates LOOP
        -- Keep first artist_id (oldest)
        keep_id := dup_record.artist_ids[1];

        -- Get array of IDs to merge (all except first)
        merge_ids := dup_record.artist_ids[2:array_length(dup_record.artist_ids, 1)];

        -- Update track_artists to point to keep_id
        UPDATE track_artists
        SET artist_id = keep_id,
            updated_at = CURRENT_TIMESTAMP
        WHERE artist_id = ANY(merge_ids);

        GET DIAGNOSTICS updated_count = ROW_COUNT;
        total_updated := total_updated + updated_count;

        -- Delete merged artist records
        DELETE FROM artists WHERE artist_id = ANY(merge_ids);
    END LOOP;

    RAISE NOTICE 'Total track_artists rows updated: %', total_updated;
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
\echo 'IMPORTANT: Rebuild graph nodes view'
\echo '============================================================'
\echo 'Run this command next:'
\echo '  REFRESH MATERIALIZED VIEW CONCURRENTLY graph_nodes;'
\echo '============================================================'
