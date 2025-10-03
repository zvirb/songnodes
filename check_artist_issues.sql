-- Check for tracks with missing or unknown artist information
-- Generated: 2025-10-03

SET search_path TO musicdb, public;

-- ===========================================
-- 1. Tracks with NO artists at all
-- ===========================================
SELECT
    '1. TRACKS WITH NO ARTISTS' AS issue_type,
    COUNT(*) AS count
FROM tracks t
WHERE NOT EXISTS (
    SELECT 1 FROM track_artists ta WHERE ta.track_id = t.id
);

SELECT
    t.id,
    t.title,
    t.normalized_title,
    t.spotify_id,
    t.created_at
FROM tracks t
WHERE NOT EXISTS (
    SELECT 1 FROM track_artists ta WHERE ta.track_id = t.id
)
ORDER BY t.created_at DESC
LIMIT 50;

-- ===========================================
-- 2. Tracks with NO primary artist
-- ===========================================
SELECT
    '2. TRACKS WITH NO PRIMARY ARTIST' AS issue_type,
    COUNT(*) AS count
FROM tracks t
WHERE NOT EXISTS (
    SELECT 1 FROM track_artists ta
    WHERE ta.track_id = t.id AND ta.role = 'primary'
);

SELECT
    t.id,
    t.title,
    t.normalized_title,
    STRING_AGG(DISTINCT ta.role, ', ' ORDER BY ta.role) AS roles_present,
    t.spotify_id,
    t.created_at
FROM tracks t
LEFT JOIN track_artists ta ON ta.track_id = t.id
WHERE NOT EXISTS (
    SELECT 1 FROM track_artists ta2
    WHERE ta2.track_id = t.id AND ta2.role = 'primary'
)
GROUP BY t.id, t.title, t.normalized_title, t.spotify_id, t.created_at
ORDER BY t.created_at DESC
LIMIT 50;

-- ===========================================
-- 3. Artists with "unknown" or similar names
-- ===========================================
SELECT
    '3. ARTISTS WITH GENERIC/UNKNOWN NAMES' AS issue_type,
    COUNT(*) AS count
FROM artists a
WHERE LOWER(a.name) IN ('unknown', 'unknown artist', 'various artists', 'various', 'va', 'n/a', 'none')
   OR LOWER(a.normalized_name) IN ('unknown', 'unknown artist', 'various artists', 'various', 'va', 'n/a', 'none')
   OR a.name ~* '^unknown|^various|^va$|^n/a$';

SELECT
    a.id,
    a.name,
    a.normalized_name,
    a.spotify_id,
    COUNT(ta.track_id) AS track_count,
    a.created_at
FROM artists a
LEFT JOIN track_artists ta ON ta.artist_id = a.id
WHERE LOWER(a.name) IN ('unknown', 'unknown artist', 'various artists', 'various', 'va', 'n/a', 'none')
   OR LOWER(a.normalized_name) IN ('unknown', 'unknown artist', 'various artists', 'various', 'va', 'n/a', 'none')
   OR a.name ~* '^unknown|^various|^va$|^n/a$'
GROUP BY a.id, a.name, a.normalized_name, a.spotify_id, a.created_at
ORDER BY track_count DESC, a.created_at DESC;

-- ===========================================
-- 4. Tracks with generic/unknown names
-- ===========================================
SELECT
    '4. TRACKS WITH GENERIC/UNKNOWN NAMES' AS issue_type,
    COUNT(*) AS count
FROM tracks t
WHERE LOWER(t.title) IN ('unknown', 'unknown track', 'id - id', 'id', 'untitled', 'n/a')
   OR LOWER(t.normalized_title) IN ('unknown', 'unknown track', 'id - id', 'id', 'untitled', 'n/a')
   OR t.title ~* '^unknown|^id$|^untitled|^n/a$';

SELECT
    t.id,
    t.title,
    t.normalized_title,
    t.spotify_id,
    COUNT(ta.artist_id) AS artist_count,
    t.created_at
FROM tracks t
LEFT JOIN track_artists ta ON ta.track_id = t.id
WHERE LOWER(t.title) IN ('unknown', 'unknown track', 'id - id', 'id', 'untitled', 'n/a')
   OR LOWER(t.normalized_title) IN ('unknown', 'unknown track', 'id - id', 'id', 'untitled', 'n/a')
   OR t.title ~* '^unknown|^id$|^untitled|^n/a$'
GROUP BY t.id, t.title, t.normalized_title, t.spotify_id, t.created_at
ORDER BY artist_count, t.created_at DESC
LIMIT 50;

-- ===========================================
-- 5. Tracks where primary artist has generic name
-- ===========================================
SELECT
    '5. TRACKS WITH PRIMARY ARTIST HAVING GENERIC NAME' AS issue_type,
    COUNT(DISTINCT t.id) AS count
FROM tracks t
JOIN track_artists ta ON ta.track_id = t.id AND ta.role = 'primary'
JOIN artists a ON a.id = ta.artist_id
WHERE LOWER(a.name) IN ('unknown', 'unknown artist', 'various artists', 'various', 'va', 'n/a', 'none')
   OR LOWER(a.normalized_name) IN ('unknown', 'unknown artist', 'various artists', 'various', 'va', 'n/a', 'none')
   OR a.name ~* '^unknown|^various|^va$|^n/a$';

SELECT
    t.id AS track_id,
    t.title AS track_title,
    a.id AS artist_id,
    a.name AS artist_name,
    a.normalized_name AS artist_normalized_name,
    t.spotify_id AS track_spotify_id,
    a.spotify_id AS artist_spotify_id,
    t.created_at
FROM tracks t
JOIN track_artists ta ON ta.track_id = t.id AND ta.role = 'primary'
JOIN artists a ON a.id = ta.artist_id
WHERE LOWER(a.name) IN ('unknown', 'unknown artist', 'various artists', 'various', 'va', 'n/a', 'none')
   OR LOWER(a.normalized_name) IN ('unknown', 'unknown artist', 'various artists', 'various', 'va', 'n/a', 'none')
   OR a.name ~* '^unknown|^various|^va$|^n/a$'
ORDER BY t.created_at DESC
LIMIT 50;

-- ===========================================
-- SUMMARY REPORT
-- ===========================================
SELECT
    'SUMMARY REPORT' AS report_type,
    (SELECT COUNT(*) FROM tracks) AS total_tracks,
    (SELECT COUNT(*) FROM artists) AS total_artists,
    (SELECT COUNT(*) FROM track_artists) AS total_relationships,
    (SELECT COUNT(*) FROM tracks t WHERE NOT EXISTS (SELECT 1 FROM track_artists ta WHERE ta.track_id = t.id)) AS tracks_with_no_artists,
    (SELECT COUNT(*) FROM tracks t WHERE NOT EXISTS (SELECT 1 FROM track_artists ta WHERE ta.track_id = t.id AND ta.role = 'primary')) AS tracks_with_no_primary_artist,
    (SELECT COUNT(*) FROM artists a WHERE LOWER(a.name) IN ('unknown', 'unknown artist', 'various artists', 'various', 'va', 'n/a', 'none') OR a.name ~* '^unknown|^various|^va$|^n/a$') AS artists_with_generic_names,
    (SELECT COUNT(*) FROM tracks t WHERE LOWER(t.title) IN ('unknown', 'unknown track', 'id - id', 'id', 'untitled', 'n/a') OR t.title ~* '^unknown|^id$|^untitled|^n/a$') AS tracks_with_generic_names;
