-- SongNodes Database Schema Synchronization
-- This script syncs tracks/artists data to nodes/edges for graph visualization

\echo 'Starting SongNodes database synchronization...'

-- Step 1: Create nodes from tracks
INSERT INTO musicdb.nodes (
    id, 
    track_id, 
    title, 
    artist, 
    genre, 
    position, 
    metadata, 
    created_at, 
    updated_at
)
SELECT 
    t.id,
    t.id as track_id,
    t.title,
    a.name as artist,
    t.genre,
    POINT(random() * 1000, random() * 1000) as position,
    jsonb_build_object(
        'bpm', COALESCE(t.bpm, 120),
        'musical_key', COALESCE(t.key, 'C'),
        'energy', COALESCE(t.energy, 0.5),
        'danceability', COALESCE(t.danceability, 0.5),
        'valence', COALESCE(t.valence, 0.5)
    ) as metadata,
    COALESCE(t.created_at, NOW()) as created_at,
    COALESCE(t.updated_at, NOW()) as updated_at
FROM musicdb.tracks t
LEFT JOIN musicdb.track_artists ta ON t.id = ta.track_id AND ta.role = 'primary'
LEFT JOIN musicdb.artists a ON ta.artist_id = a.id
WHERE t.title IS NOT NULL
ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    artist = EXCLUDED.artist,
    genre = EXCLUDED.genre,
    metadata = EXCLUDED.metadata,
    updated_at = NOW();

\echo 'Created nodes from tracks...'

-- Step 2: Create nodes from artists
-- This step is no longer needed as we are not creating artist nodes

-- Step 3: Create edges between tracks and artists
-- This step is no longer needed as we are not creating artist nodes

-- Step 4: Create similarity edges between tracks (based on genre and BPM)
INSERT INTO musicdb.edges (
    source_id,
    target_id,
    edge_type,
    weight,
    metadata,
    created_at,
    updated_at
)
SELECT 
    t1.id as source_id,
    t2.id as target_id,
    'similar_to' as edge_type,
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
WHERE t1.id < t2.id  -- Avoid duplicates and self-loops
  AND t1.title IS NOT NULL 
  AND t2.title IS NOT NULL
  AND (t1.genre = t2.genre OR ABS(COALESCE(t1.bpm, 120) - COALESCE(t2.bpm, 120)) < 15)
LIMIT 500  -- Limit to prevent excessive relationships
ON CONFLICT (source_id, target_id, edge_type) DO NOTHING;

\echo 'Created similarity edges between tracks...'

-- Step 5: Display summary statistics
\echo 'Database synchronization complete! Summary:'

SELECT 
    'Total Nodes' as metric,
    COUNT(*) as count
FROM musicdb.nodes
UNION ALL
SELECT 
    'Total Edges' as metric,
    COUNT(*) as count
FROM musicdb.edges
UNION ALL
SELECT 
    'Similarity Edges' as metric,
    COUNT(*) as count
FROM musicdb.edges 
WHERE edge_type = 'similar_to';

\echo 'Graph database ready for visualization!'
