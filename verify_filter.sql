-- Verify the artist filter matches what the API is using
-- This should match the graph_nodes view with filters
SELECT COUNT(*) as tracks_with_valid_artists
FROM graph_nodes
WHERE node_type = 'song'
  AND artist_name IS NOT NULL
  AND artist_name != ''
  AND artist_name != 'Unknown';
