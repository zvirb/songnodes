-- load-library-targets.sql: make every music-library track a scrape target (TGT1).
-- Run through scripts/load-library-targets.sh, which sets :priority and :finish (COMMIT, or ROLLBACK for --dry-run).
--
-- Reads library.tracks joined to silver_enriched_tracks for artist and title. A track becomes one row in
-- target_tracks (active, never searched, so SC2's hourly scheduler picks it up). It is skipped when:
--   * it has no usable artist or title (CLAUDE.md: no NULL or "Unknown Artist" may reach the graph), or
--   * a target with the same artist and title already exists (case and outer spaces ignored).
-- Nothing else in target_tracks changes, so the script is safe to run again after each library import.
BEGIN;

CREATE TEMP TABLE library_candidates ON COMMIT DROP AS
SELECT DISTINCT ON (lower(btrim(s.artist_name)), lower(btrim(s.track_title)))
       btrim(s.artist_name) AS artist,
       btrim(s.track_title) AS title,
       COALESCE(s.genre, '{}') AS genres
FROM library.tracks lt
JOIN silver_enriched_tracks s ON s.id = lt.id
ORDER BY lower(btrim(s.artist_name)), lower(btrim(s.track_title)), s.id;

WITH valid AS (
    SELECT * FROM library_candidates
    WHERE artist <> '' AND title <> ''
      AND lower(artist) NOT IN ('unknown', 'unknown artist', 'various artists', 'va')
), fresh AS (
    SELECT v.* FROM valid v
    WHERE NOT EXISTS (
        SELECT 1 FROM target_tracks t
        WHERE lower(btrim(t.artist)) = lower(v.artist) AND lower(btrim(t.title)) = lower(v.title)
    )
), added AS (
    INSERT INTO target_tracks (title, artist, priority, genres)
    SELECT title, artist, :'priority', genres FROM fresh
    RETURNING 1
)
SELECT (SELECT count(*) FROM library.tracks) AS library_tracks,
       (SELECT count(*) FROM library.tracks) - (SELECT count(*) FROM library_candidates) AS same_track_twice,
       (SELECT count(*) FROM library_candidates) - (SELECT count(*) FROM valid) AS skipped_no_artist,
       (SELECT count(*) FROM valid) - (SELECT count(*) FROM added) AS already_targets,
       (SELECT count(*) FROM added) AS added;

:finish;
