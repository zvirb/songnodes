-- SongNodes Database Schema Synchronization
-- This script syncs tracks/artists data to nodes/edges for graph visualization

\echo 'Starting SongNodes database synchronization...'

-- Step 1: Create nodes from tracks
INSERT INTO musicdb.nodes (
    node_id, 
    node_type, 
    title, 
    metadata, 
    x_position, 
    y_position, 
    created_at, 
    updated_at
)
SELECT 
    'track_' || track_id::text as node_id,
    'track' as node_type,
    track_name as title,
    jsonb_build_object(
        'genre', COALESCE(genre, 'Unknown'),
        'bpm', COALESCE(bpm, 120),
        'musical_key', COALESCE(musical_key, 'C'),
        'energy', COALESCE(energy, 0.5),
        'danceability', COALESCE(danceability, 0.5),
        'valence', COALESCE(valence, 0.5),
        'track_id', track_id
    ) as metadata,
    (random() * 1000)::integer as x_position,
    (random() * 1000)::integer as y_position,
    COALESCE(created_at, NOW()) as created_at,
    COALESCE(updated_at, NOW()) as updated_at
FROM musicdb.tracks
WHERE track_name IS NOT NULL
ON CONFLICT (node_id) DO UPDATE SET
    title = EXCLUDED.title,
    metadata = EXCLUDED.metadata,
    updated_at = NOW();

\echo 'Created nodes from tracks...'

-- Step 2: Create nodes from artists
INSERT INTO musicdb.nodes (
    node_id, 
    node_type, 
    title, 
    metadata, 
    x_position, 
    y_position, 
    created_at, 
    updated_at
)
SELECT DISTINCT
    'artist_' || artist_name as node_id,
    'artist' as node_type,
    artist_name as title,
    jsonb_build_object(
        'artist_name', artist_name,
        'bio', COALESCE(a.bio, 'Electronic music artist')
    ) as metadata,
    (random() * 1000)::integer as x_position,
    (random() * 1000)::integer as y_position,
    COALESCE(a.created_at, NOW()) as created_at,
    COALESCE(a.updated_at, NOW()) as updated_at
FROM musicdb.track_artists ta
LEFT JOIN musicdb.artists a ON ta.artist_name = a.artist_name
WHERE ta.artist_name IS NOT NULL
ON CONFLICT (node_id) DO UPDATE SET
    title = EXCLUDED.title,
    metadata = EXCLUDED.metadata,
    updated_at = NOW();

\echo 'Created nodes from artists...'

-- Step 3: Create edges between tracks and artists
INSERT INTO musicdb.edges (
    edge_id,
    source_node_id,
    target_node_id,
    relationship_type,
    weight,
    metadata,
    created_at,
    updated_at
)
SELECT 
    'track_artist_' || ROW_NUMBER() OVER() as edge_id,
    'track_' || (
        SELECT t.track_id::text 
        FROM musicdb.tracks t 
        WHERE t.track_name = ta.track_name 
        LIMIT 1
    ) as source_node_id,
    'artist_' || ta.artist_name as target_node_id,
    COALESCE(ta.artist_role, 'performed_by') as relationship_type,
    1.0 as weight,
    jsonb_build_object(
        'role', COALESCE(ta.artist_role, 'primary')
    ) as metadata,
    NOW() as created_at,
    NOW() as updated_at
FROM musicdb.track_artists ta
WHERE ta.track_name IS NOT NULL 
  AND ta.artist_name IS NOT NULL
  AND EXISTS (SELECT 1 FROM musicdb.tracks t WHERE t.track_name = ta.track_name)
ON CONFLICT (edge_id) DO NOTHING;

\echo 'Created edges between tracks and artists...'

-- Step 4: Create similarity edges between tracks (based on genre and BPM)
INSERT INTO musicdb.edges (
    edge_id,
    source_node_id,
    target_node_id,
    relationship_type,
    weight,
    metadata,
    created_at,
    updated_at
)
SELECT 
    'similarity_' || t1.track_id || '_' || t2.track_id as edge_id,
    'track_' || t1.track_id::text as source_node_id,
    'track_' || t2.track_id::text as target_node_id,
    'similar_to' as relationship_type,
    CASE 
        WHEN t1.genre = t2.genre AND ABS(COALESCE(t1.bpm, 120) - COALESCE(t2.bpm, 120)) < 5 THEN 0.9
        WHEN t1.genre = t2.genre THEN 0.7
        WHEN ABS(COALESCE(t1.bpm, 120) - COALESCE(t2.bpm, 120)) < 10 THEN 0.5
        ELSE 0.3
    END as weight,
    jsonb_build_object(
        'similarity_reason', 
        CASE 
            WHEN t1.genre = t2.genre AND ABS(COALESCE(t1.bpm, 120) - COALESCE(t2.bpm, 120)) < 5 
                THEN 'same_genre_similar_bpm'
            WHEN t1.genre = t2.genre THEN 'same_genre'
            WHEN ABS(COALESCE(t1.bpm, 120) - COALESCE(t2.bpm, 120)) < 10 THEN 'similar_bpm'
            ELSE 'weak_similarity'
        END,
        'bpm_difference', ABS(COALESCE(t1.bpm, 120) - COALESCE(t2.bpm, 120))
    ) as metadata,
    NOW() as created_at,
    NOW() as updated_at
FROM musicdb.tracks t1
CROSS JOIN musicdb.tracks t2
WHERE t1.track_id < t2.track_id  -- Avoid duplicates and self-loops
  AND t1.track_name IS NOT NULL 
  AND t2.track_name IS NOT NULL
  AND (t1.genre = t2.genre OR ABS(COALESCE(t1.bpm, 120) - COALESCE(t2.bpm, 120)) < 15)
LIMIT 500  -- Limit to prevent excessive relationships
ON CONFLICT (edge_id) DO NOTHING;

\echo 'Created similarity edges between tracks...'

-- Step 5: Display summary statistics
\echo 'Database synchronization complete! Summary:'

SELECT 
    'Total Nodes' as metric,
    COUNT(*) as count
FROM musicdb.nodes
UNION ALL
SELECT 
    'Track Nodes' as metric,
    COUNT(*) as count
FROM musicdb.nodes 
WHERE node_type = 'track'
UNION ALL
SELECT 
    'Artist Nodes' as metric,
    COUNT(*) as count
FROM musicdb.nodes 
WHERE node_type = 'artist'
UNION ALL
SELECT 
    'Total Edges' as metric,
    COUNT(*) as count
FROM musicdb.edges
UNION ALL
SELECT 
    'Track-Artist Edges' as metric,
    COUNT(*) as count
FROM musicdb.edges 
WHERE relationship_type IN ('performed_by', 'primary', 'featured')
UNION ALL
SELECT 
    'Similarity Edges' as metric,
    COUNT(*) as count
FROM musicdb.edges 
WHERE relationship_type = 'similar_to';

\echo 'Graph database ready for visualization!'