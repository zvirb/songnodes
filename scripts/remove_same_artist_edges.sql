-- Remove Same-Artist Track Transitions
-- Purpose: Clean up edges that connect tracks by the same artist
--
-- Problem: In the graph visualization, edges connecting tracks by the same
-- artist create visual clutter without providing meaningful relationship
-- information. The artist node already connects these tracks, so direct
-- track-to-track edges for the same artist are redundant.
--
-- This script identifies and removes transitions where both the source and
-- target tracks have the same artist name (case-insensitive comparison).
--
-- Usage:
--   psql -U musicdb_user -d musicdb -f scripts/remove_same_artist_edges.sql
--
-- After running this script, you MUST refresh the graph materialized view:
--   REFRESH MATERIALIZED VIEW gold_track_graph;

\echo '============================================================'
\echo 'Same-Artist Edge Cleanup - Before Statistics'
\echo '============================================================'

-- Count total transitions and same-artist transitions
SELECT
    COUNT(*) as total_transitions,
    COUNT(*) FILTER (WHERE
        EXISTS (
            SELECT 1
            FROM silver_enriched_tracks t1
            JOIN silver_enriched_tracks t2 ON t2.id = stt.to_track_id
            WHERE t1.id = stt.from_track_id
              AND LOWER(TRIM(t1.artist_name)) = LOWER(TRIM(t2.artist_name))
        )
    ) as same_artist_transitions
FROM silver_track_transitions stt;

\echo ''
\echo 'Sample same-artist edges to be removed (first 15):'
SELECT
    t1.artist_name,
    t1.track_title as from_track,
    t2.track_title as to_track,
    stt.occurrence_count
FROM silver_track_transitions stt
JOIN silver_enriched_tracks t1 ON stt.from_track_id = t1.id
JOIN silver_enriched_tracks t2 ON stt.to_track_id = t2.id
WHERE LOWER(TRIM(t1.artist_name)) = LOWER(TRIM(t2.artist_name))
ORDER BY stt.occurrence_count DESC
LIMIT 15;

\echo ''
\echo '============================================================'
\echo 'Deleting same-artist transitions...'
\echo '============================================================'

-- Delete transitions where both tracks have the same artist
DELETE FROM silver_track_transitions stt
WHERE EXISTS (
    SELECT 1
    FROM silver_enriched_tracks t1
    JOIN silver_enriched_tracks t2 ON t2.id = stt.to_track_id
    WHERE t1.id = stt.from_track_id
      AND LOWER(TRIM(t1.artist_name)) = LOWER(TRIM(t2.artist_name))
);

\echo 'Same-artist transitions deleted!'
\echo ''

\echo '============================================================'
\echo 'Cleanup Complete - After Statistics'
\echo '============================================================'

SELECT
    COUNT(*) as total_transitions,
    COUNT(*) FILTER (WHERE
        EXISTS (
            SELECT 1
            FROM silver_enriched_tracks t1
            JOIN silver_enriched_tracks t2 ON t2.id = stt.to_track_id
            WHERE t1.id = stt.from_track_id
              AND LOWER(TRIM(t1.artist_name)) = LOWER(TRIM(t2.artist_name))
        )
    ) as same_artist_transitions
FROM silver_track_transitions stt;

\echo ''
\echo '============================================================'
\echo 'Refreshing materialized view...'
\echo '============================================================'

REFRESH MATERIALIZED VIEW gold_track_graph;

\echo ''
\echo '============================================================'
\echo 'SUCCESS! Graph updated.'
\echo '============================================================'
\echo 'The frontend will now show the cleaned graph without same-artist edges.'
\echo '============================================================'
