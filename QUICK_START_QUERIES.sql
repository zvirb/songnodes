-- ============================================================================
-- SongNodes Database - Quick Start Query Examples
-- ============================================================================
-- Use these queries to test the loaded data and understand the schema
-- ============================================================================

SET search_path TO musicdb, public;

-- ============================================================================
-- 1. VERIFY DATABASE STATUS
-- ============================================================================

-- Total counts
SELECT
  COUNT(DISTINCT t.id) as total_tracks,
  COUNT(DISTINCT a.id) as total_artists,
  COUNT(DISTINCT p.id) as total_playlists,
  COUNT(DISTINCT n.id) as total_nodes,
  COUNT(DISTINCT e.id) as total_edges
FROM musicdb.tracks t
CROSS JOIN musicdb.artists a
CROSS JOIN musicdb.playlists p
CROSS JOIN musicdb.nodes n
CROSS JOIN musicdb.edges e;

-- Artist attribution coverage
SELECT
  COUNT(*) as tracks_with_artists,
  (SELECT COUNT(*) FROM musicdb.tracks) as total_tracks,
  ROUND(100.0 * COUNT(*) / (SELECT COUNT(*) FROM musicdb.tracks), 1) as coverage_percent
FROM musicdb.tracks t
WHERE EXISTS (SELECT 1 FROM musicdb.track_artists WHERE track_id = t.id);

-- ============================================================================
-- 2. EXPLORE TRACKS AND ARTISTS
-- ============================================================================

-- Get all tracks for a specific artist
SELECT
  t.title,
  t.genre,
  t.bpm,
  t.key,
  ROUND(t.energy::numeric, 2) as energy,
  ROUND(t.danceability::numeric, 2) as danceability
FROM musicdb.tracks t
JOIN musicdb.track_artists ta ON ta.track_id = t.id
JOIN musicdb.artists a ON a.id = ta.artist_id
WHERE a.name = 'Deadmau5'
ORDER BY t.title;

-- Show all artists and their track counts
SELECT
  a.name,
  COUNT(DISTINCT ta.track_id) as track_count,
  COUNT(DISTINCT t.genre) as genres_covered,
  ROUND(AVG(t.bpm::numeric), 1) as avg_bpm,
  ROUND(AVG(t.energy::numeric), 2) as avg_energy
FROM musicdb.artists a
LEFT JOIN musicdb.track_artists ta ON ta.artist_id = a.id
LEFT JOIN musicdb.tracks t ON t.id = ta.track_id
GROUP BY a.id, a.name
HAVING COUNT(DISTINCT ta.track_id) > 0
ORDER BY COUNT(DISTINCT ta.track_id) DESC;

-- Genre distribution
SELECT
  genre,
  COUNT(*) as track_count,
  ROUND(AVG(bpm::numeric), 1) as avg_bpm,
  ROUND(AVG(energy::numeric), 2) as avg_energy,
  ROUND(AVG(danceability::numeric), 2) as avg_danceability
FROM musicdb.tracks
WHERE genre IS NOT NULL
GROUP BY genre
ORDER BY track_count DESC;

-- ============================================================================
-- 3. EXPLORE PLAYLISTS AND TRANSITIONS
-- ============================================================================

-- List all playlists with track counts
SELECT
  p.name,
  p.curator,
  COUNT(pt.id) as tracks_in_playlist,
  COUNT(DISTINCT t.genre) as unique_genres,
  ROUND(AVG(t.bpm::numeric), 1) as avg_bpm
FROM musicdb.playlists p
LEFT JOIN musicdb.playlist_tracks pt ON pt.playlist_id = p.id
LEFT JOIN musicdb.tracks t ON t.id = pt.track_id
GROUP BY p.id, p.name, p.curator
ORDER BY COUNT(pt.id) DESC;

-- Show all transitions in a specific playlist
SELECT
  pt1.position,
  t1.title as from_track,
  a1.name as from_artist,
  t2.title as to_track,
  a2.name as to_artist,
  ROUND((t1.bpm::numeric - t2.bpm::numeric), 1) as bpm_change
FROM musicdb.playlist_tracks pt1
JOIN musicdb.playlist_tracks pt2
  ON pt1.playlist_id = pt2.playlist_id
  AND pt1.position + 1 = pt2.position
JOIN musicdb.tracks t1 ON t1.id = pt1.track_id
JOIN musicdb.tracks t2 ON t2.id = pt2.track_id
LEFT JOIN musicdb.track_artists ta1 ON ta1.track_id = t1.id AND ta1.role = 'primary'
LEFT JOIN musicdb.artists a1 ON a1.id = ta1.artist_id
LEFT JOIN musicdb.track_artists ta2 ON ta2.track_id = t2.id AND ta2.role = 'primary'
LEFT JOIN musicdb.artists a2 ON a2.id = ta2.artist_id
WHERE pt1.playlist_id = (SELECT id FROM musicdb.playlists WHERE name LIKE '%Awakenings%' LIMIT 1)
ORDER BY pt1.position;

-- ============================================================================
-- 4. GRAPH ANALYSIS
-- ============================================================================

-- Show most connected nodes (tracks with most outgoing transitions)
SELECT
  n.title,
  a.name as artist,
  COUNT(e.id) as outgoing_edges,
  STRING_AGG(DISTINCT t2.title, ', ') as next_tracks
FROM musicdb.nodes n
LEFT JOIN musicdb.edges e ON e.source_id = n.id
LEFT JOIN musicdb.nodes n2 ON n2.id = e.target_id
LEFT JOIN musicdb.tracks t2 ON t2.id = n2.track_id
LEFT JOIN musicdb.track_artists ta ON ta.track_id = n.track_id AND ta.role = 'primary'
LEFT JOIN musicdb.artists a ON a.id = ta.artist_id
GROUP BY n.id, n.title, a.name
HAVING COUNT(e.id) > 0
ORDER BY COUNT(e.id) DESC
LIMIT 10;

-- Analyze genre transition patterns
SELECT
  t1.genre as from_genre,
  t2.genre as to_genre,
  COUNT(*) as transition_count,
  ROUND(AVG(ABS(t1.energy::numeric - t2.energy::numeric)), 2) as avg_energy_delta,
  ROUND(AVG(ABS(t1.bpm::numeric - t2.bpm::numeric)), 1) as avg_bpm_delta
FROM musicdb.playlist_tracks pt1
JOIN musicdb.playlist_tracks pt2
  ON pt1.playlist_id = pt2.playlist_id
  AND pt1.position + 1 = pt2.position
JOIN musicdb.tracks t1 ON t1.id = pt1.track_id
JOIN musicdb.tracks t2 ON t2.id = pt2.track_id
WHERE t1.genre IS NOT NULL AND t2.genre IS NOT NULL
GROUP BY t1.genre, t2.genre
ORDER BY transition_count DESC;

-- ============================================================================
-- 5. PATHFINDING PREPARATION QUERIES
-- ============================================================================

-- Find all possible next tracks from a given track
SELECT DISTINCT
  t2.title,
  a2.name as artist,
  t2.genre,
  t2.bpm,
  t2.energy,
  COUNT(DISTINCT p.id) as in_playlists
FROM musicdb.playlist_tracks pt1
JOIN musicdb.playlist_tracks pt2
  ON pt1.playlist_id = pt2.playlist_id
  AND pt1.position + 1 = pt2.position
JOIN musicdb.tracks t1 ON t1.id = pt1.track_id
JOIN musicdb.tracks t2 ON t2.id = pt2.track_id
LEFT JOIN musicdb.track_artists ta2 ON ta2.track_id = t2.id AND ta2.role = 'primary'
LEFT JOIN musicdb.artists a2 ON a2.id = ta2.artist_id
JOIN musicdb.playlists p ON p.id = pt1.playlist_id
WHERE t1.title = 'Call on Me'
GROUP BY t2.id, t2.title, a2.name, t2.genre, t2.bpm, t2.energy
ORDER BY COUNT(DISTINCT p.id) DESC;

-- Find tracks within 1-2 hops from a starting track
WITH RECURSIVE path_search AS (
  -- Base case: starting track
  SELECT
    t1.id,
    t1.title,
    1 as hop,
    ARRAY[t1.id] as path
  FROM musicdb.tracks t1
  WHERE t1.title = 'Call on Me'

  UNION ALL

  -- Recursive case: next tracks
  SELECT
    t2.id,
    t2.title,
    ps.hop + 1,
    ps.path || t2.id
  FROM path_search ps
  JOIN musicdb.playlist_tracks pt1
    ON (SELECT id FROM musicdb.tracks WHERE title = ps.title) = pt1.track_id
  JOIN musicdb.playlist_tracks pt2
    ON pt1.playlist_id = pt2.playlist_id
    AND pt1.position + 1 = pt2.position
  JOIN musicdb.tracks t2 ON t2.id = pt2.track_id
  WHERE ps.hop < 2
    AND NOT t2.id = ANY(ps.path)
)
SELECT
  ps.hop,
  ps.title as track,
  COUNT(*) as occurrences
FROM path_search ps
WHERE ps.hop > 1
GROUP BY ps.hop, ps.title
ORDER BY ps.hop, occurrences DESC;

-- ============================================================================
-- 6. DATA QUALITY CHECKS
-- ============================================================================

-- Verify graph consistency
SELECT
  'Nodes without edges' as check_type,
  COUNT(*) as count
FROM musicdb.nodes n
WHERE NOT EXISTS (SELECT 1 FROM musicdb.edges WHERE source_id = n.id OR target_id = n.id);

-- Check for orphaned edges
SELECT
  'Edges with missing source node' as check_type,
  COUNT(*) as count
FROM musicdb.edges e
WHERE NOT EXISTS (SELECT 1 FROM musicdb.nodes WHERE id = e.source_id);

SELECT
  'Edges with missing target node' as check_type,
  COUNT(*) as count
FROM musicdb.edges e
WHERE NOT EXISTS (SELECT 1 FROM musicdb.nodes WHERE id = e.target_id);

-- Verify all track-artist links are valid
SELECT
  'Invalid track artist links' as check_type,
  COUNT(*) as count
FROM musicdb.track_artists ta
WHERE NOT EXISTS (SELECT 1 FROM musicdb.tracks WHERE id = ta.track_id)
   OR NOT EXISTS (SELECT 1 FROM musicdb.artists WHERE id = ta.artist_id);

-- ============================================================================
-- 7. SAMPLE DJ SET GENERATION QUERIES
-- ============================================================================

-- Get a track and its immediate successors (for building a mix)
SELECT
  ROW_NUMBER() OVER (ORDER BY pt.position) as position,
  t.title,
  a.name as artist,
  t.bpm,
  t.key,
  ROUND(t.energy::numeric, 2) as energy,
  ROUND(t.danceability::numeric, 2) as danceability
FROM musicdb.playlist_tracks pt
JOIN musicdb.tracks t ON t.id = pt.track_id
LEFT JOIN musicdb.track_artists ta ON ta.track_id = t.id AND ta.role = 'primary'
LEFT JOIN musicdb.artists a ON a.id = ta.artist_id
WHERE pt.playlist_id = (SELECT id FROM musicdb.playlists WHERE name LIKE '%Berghain%' LIMIT 1)
ORDER BY pt.position
LIMIT 15;

-- Find tracks suitable for mixing into a specific track
-- (same or similar BPM and genre)
SELECT
  t2.title,
  a2.name as artist,
  t2.genre,
  t2.bpm,
  ROUND(ABS(t1.bpm::numeric - t2.bpm::numeric), 1) as bpm_delta,
  ROUND(ABS(t1.energy::numeric - t2.energy::numeric), 2) as energy_delta
FROM musicdb.tracks t1
CROSS JOIN musicdb.tracks t2
LEFT JOIN musicdb.track_artists ta2 ON ta2.track_id = t2.id AND ta2.role = 'primary'
LEFT JOIN musicdb.artists a2 ON a2.id = ta2.artist_id
WHERE t1.title = 'Teach Me'
  AND t2.id != t1.id
  AND ABS(t1.bpm::numeric - t2.bpm::numeric) <= 5
  AND t1.genre = t2.genre
ORDER BY bpm_delta, energy_delta;

-- ============================================================================
-- NOTES:
-- ============================================================================
--
-- 1. Replace playlist/track names with actual values when running
-- 2. Use LIMIT clauses to avoid large result sets
-- 3. All edges are playlist transitions (direct adjacency)
-- 4. Nodes and edges use UUID foreign keys for referential integrity
-- 5. Metadata is stored in JSONB for flexible querying
-- 6. All queries use LEFT JOIN to handle optional artist data
--
-- ============================================================================
