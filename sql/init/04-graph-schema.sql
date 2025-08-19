-- Graph Visualization Schema Extension
-- Optimized for high-performance graph queries and spatial indexing
-- Target: <50ms query response times

-- Enable PostGIS extension for spatial operations
CREATE EXTENSION IF NOT EXISTS "postgis";

-- Set search path
SET search_path TO musicdb, public;

-- ===========================================
-- GRAPH TABLES
-- ===========================================

-- Graph nodes table with spatial indexing
CREATE TABLE IF NOT EXISTS nodes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    track_id VARCHAR(255) NOT NULL,
    position POINT NOT NULL,
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key to tracks table
    CONSTRAINT fk_nodes_track_id FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
);

-- Spatial index for position-based queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_nodes_position ON nodes USING GIST(position);

-- Track ID index for fast lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_nodes_track_id ON nodes(track_id);

-- JSONB index for metadata queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_nodes_metadata ON nodes USING gin(metadata);

-- Composite index for spatial + time queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_nodes_position_created ON nodes USING GIST(position, created_at);

-- Graph edges table for relationships
CREATE TABLE IF NOT EXISTS edges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    target_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    weight FLOAT DEFAULT 1.0 CHECK (weight >= 0),
    edge_type VARCHAR(50) NOT NULL DEFAULT 'similarity',
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure no self-loops
    CONSTRAINT no_self_loops CHECK (source_id != target_id),
    
    -- Unique constraint to prevent duplicate edges
    CONSTRAINT unique_edge UNIQUE (source_id, target_id, edge_type)
);

-- Optimized indexes for edge queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_edges_source_target ON edges(source_id, target_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_edges_target_source ON edges(target_id, source_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_edges_type ON edges(edge_type);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_edges_weight ON edges(weight DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_edges_metadata ON edges USING gin(metadata);

-- Composite index for graph traversal
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_edges_traversal ON edges(source_id, edge_type, weight DESC);

-- ===========================================
-- GRAPH ANALYSIS TABLES
-- ===========================================

-- Audio analysis data with partitioning for time-series performance
CREATE TABLE IF NOT EXISTS audio_analysis (
    id UUID DEFAULT uuid_generate_v4(),
    track_id VARCHAR(255) NOT NULL,
    analysis_data JSONB NOT NULL,
    features_vector FLOAT[] NOT NULL,
    tempo FLOAT,
    key_signature VARCHAR(10),
    energy FLOAT CHECK (energy >= 0 AND energy <= 1),
    danceability FLOAT CHECK (danceability >= 0 AND danceability <= 1),
    valence FLOAT CHECK (valence >= 0 AND valence <= 1),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY (id, created_at),
    CONSTRAINT fk_audio_analysis_track_id FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
) PARTITION BY RANGE (created_at);

-- Create monthly partitions for audio analysis
CREATE TABLE IF NOT EXISTS audio_analysis_2024_01 PARTITION OF audio_analysis
FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE TABLE IF NOT EXISTS audio_analysis_2024_02 PARTITION OF audio_analysis
FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');

CREATE TABLE IF NOT EXISTS audio_analysis_2024_03 PARTITION OF audio_analysis
FOR VALUES FROM ('2024-03-01') TO ('2024-04-01');

CREATE TABLE IF NOT EXISTS audio_analysis_2024_04 PARTITION OF audio_analysis
FOR VALUES FROM ('2024-04-01') TO ('2024-05-01');

CREATE TABLE IF NOT EXISTS audio_analysis_2024_05 PARTITION OF audio_analysis
FOR VALUES FROM ('2024-05-01') TO ('2024-06-01');

CREATE TABLE IF NOT EXISTS audio_analysis_2024_06 PARTITION OF audio_analysis
FOR VALUES FROM ('2024-06-01') TO ('2024-07-01');

CREATE TABLE IF NOT EXISTS audio_analysis_2024_07 PARTITION OF audio_analysis
FOR VALUES FROM ('2024-07-01') TO ('2024-08-01');

CREATE TABLE IF NOT EXISTS audio_analysis_2024_08 PARTITION OF audio_analysis
FOR VALUES FROM ('2024-08-01') TO ('2024-09-01');

CREATE TABLE IF NOT EXISTS audio_analysis_2024_09 PARTITION OF audio_analysis
FOR VALUES FROM ('2024-09-01') TO ('2024-10-01');

CREATE TABLE IF NOT EXISTS audio_analysis_2024_10 PARTITION OF audio_analysis
FOR VALUES FROM ('2024-10-01') TO ('2024-11-01');

CREATE TABLE IF NOT EXISTS audio_analysis_2024_11 PARTITION OF audio_analysis
FOR VALUES FROM ('2024-11-01') TO ('2024-12-01');

CREATE TABLE IF NOT EXISTS audio_analysis_2024_12 PARTITION OF audio_analysis
FOR VALUES FROM ('2024-12-01') TO ('2025-01-01');

-- Indexes on audio analysis
CREATE INDEX IF NOT EXISTS idx_audio_analysis_track_id ON audio_analysis(track_id);
CREATE INDEX IF NOT EXISTS idx_audio_analysis_features ON audio_analysis USING gin(features_vector);
CREATE INDEX IF NOT EXISTS idx_audio_analysis_tempo ON audio_analysis(tempo);
CREATE INDEX IF NOT EXISTS idx_audio_analysis_energy ON audio_analysis(energy);

-- Graph clusters table for community detection
CREATE TABLE IF NOT EXISTS graph_clusters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cluster_id INTEGER NOT NULL,
    node_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    cluster_score FLOAT DEFAULT 0.0,
    algorithm VARCHAR(50) NOT NULL DEFAULT 'louvain',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(cluster_id, node_id, algorithm)
);

CREATE INDEX IF NOT EXISTS idx_graph_clusters_cluster_id ON graph_clusters(cluster_id);
CREATE INDEX IF NOT EXISTS idx_graph_clusters_node_id ON graph_clusters(node_id);
CREATE INDEX IF NOT EXISTS idx_graph_clusters_algorithm ON graph_clusters(algorithm);

-- ===========================================
-- HIGH-PERFORMANCE FUNCTIONS
-- ===========================================

-- Bulk node insertion function with conflict resolution
CREATE OR REPLACE FUNCTION bulk_insert_nodes(
    node_data JSONB
) RETURNS INTEGER AS $$
DECLARE
    inserted_count INTEGER;
BEGIN
    WITH bulk_insert AS (
        INSERT INTO nodes (track_id, position, metadata)
        SELECT 
            (value->>'track_id')::VARCHAR,
            POINT((value->>'x')::FLOAT, (value->>'y')::FLOAT),
            COALESCE(value->'metadata', '{}'::JSONB)
        FROM jsonb_array_elements(node_data) AS value
        ON CONFLICT (track_id) DO UPDATE SET
            position = EXCLUDED.position,
            metadata = EXCLUDED.metadata,
            updated_at = NOW()
        RETURNING 1
    )
    SELECT COUNT(*) INTO inserted_count FROM bulk_insert;
    RETURN inserted_count;
END;
$$ LANGUAGE plpgsql;

-- Bulk edge insertion function
CREATE OR REPLACE FUNCTION bulk_insert_edges(
    edge_data JSONB
) RETURNS INTEGER AS $$
DECLARE
    inserted_count INTEGER;
BEGIN
    WITH bulk_insert AS (
        INSERT INTO edges (source_id, target_id, weight, edge_type, metadata)
        SELECT 
            (value->>'source_id')::UUID,
            (value->>'target_id')::UUID,
            COALESCE((value->>'weight')::FLOAT, 1.0),
            COALESCE(value->>'edge_type', 'similarity'),
            COALESCE(value->'metadata', '{}'::JSONB)
        FROM jsonb_array_elements(edge_data) AS value
        ON CONFLICT (source_id, target_id, edge_type) DO UPDATE SET
            weight = EXCLUDED.weight,
            metadata = EXCLUDED.metadata
        RETURNING 1
    )
    SELECT COUNT(*) INTO inserted_count FROM bulk_insert;
    RETURN inserted_count;
END;
$$ LANGUAGE plpgsql;

-- Graph traversal function for finding connected components
CREATE OR REPLACE FUNCTION get_connected_nodes(
    center_node_id UUID,
    max_depth INTEGER DEFAULT 3,
    max_nodes INTEGER DEFAULT 100
) RETURNS TABLE(
    node_id UUID,
    track_id VARCHAR,
    position POINT,
    metadata JSONB,
    depth INTEGER
) AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE connected_nodes AS (
        -- Start with center node
        SELECT n.id, n.track_id, n.position, n.metadata, 0 as depth
        FROM nodes n 
        WHERE n.id = center_node_id
        
        UNION ALL
        
        -- Recursively find connected nodes
        SELECT n.id, n.track_id, n.position, n.metadata, cn.depth + 1
        FROM nodes n
        JOIN edges e ON (e.source_id = n.id OR e.target_id = n.id)
        JOIN connected_nodes cn ON (
            (cn.node_id = e.source_id AND n.id = e.target_id) OR
            (cn.node_id = e.target_id AND n.id = e.source_id)
        )
        WHERE cn.depth < max_depth 
        AND n.id != cn.node_id  -- Avoid cycles
    )
    SELECT DISTINCT 
        cn.node_id, 
        cn.track_id, 
        cn.position, 
        cn.metadata, 
        cn.depth
    FROM connected_nodes cn
    ORDER BY cn.depth, cn.node_id
    LIMIT max_nodes;
END;
$$ LANGUAGE plpgsql;

-- Function to find nodes within spatial radius
CREATE OR REPLACE FUNCTION get_nodes_in_radius(
    center_x FLOAT,
    center_y FLOAT,
    radius FLOAT,
    max_nodes INTEGER DEFAULT 100
) RETURNS TABLE(
    node_id UUID,
    track_id VARCHAR,
    position POINT,
    metadata JSONB,
    distance FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        n.id,
        n.track_id,
        n.position,
        n.metadata,
        point_distance(n.position, POINT(center_x, center_y)) as distance
    FROM nodes n
    WHERE point_distance(n.position, POINT(center_x, center_y)) <= radius
    ORDER BY distance
    LIMIT max_nodes;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate graph metrics
CREATE OR REPLACE FUNCTION calculate_graph_metrics()
RETURNS TABLE(
    total_nodes BIGINT,
    total_edges BIGINT,
    avg_degree FLOAT,
    density FLOAT,
    calculated_at TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
    node_count BIGINT;
    edge_count BIGINT;
    max_possible_edges BIGINT;
BEGIN
    SELECT COUNT(*) INTO node_count FROM nodes;
    SELECT COUNT(*) INTO edge_count FROM edges;
    
    -- Calculate maximum possible edges for undirected graph
    max_possible_edges := node_count * (node_count - 1) / 2;
    
    RETURN QUERY
    SELECT 
        node_count,
        edge_count,
        CASE 
            WHEN node_count > 0 THEN (2.0 * edge_count / node_count)
            ELSE 0.0 
        END as avg_degree,
        CASE 
            WHEN max_possible_edges > 0 THEN (edge_count::FLOAT / max_possible_edges)
            ELSE 0.0 
        END as density,
        NOW();
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- MATERIALIZED VIEWS FOR PERFORMANCE
-- ===========================================

-- Popular tracks in graph context
CREATE MATERIALIZED VIEW IF NOT EXISTS graph_popular_tracks AS
SELECT 
    t.id,
    t.title,
    t.normalized_title,
    t.genre,
    COUNT(DISTINCT n.id) as node_count,
    COUNT(DISTINCT e.id) as edge_count,
    AVG(e.weight) as avg_edge_weight,
    MAX(n.updated_at) as last_updated
FROM tracks t
JOIN nodes n ON t.id = n.track_id
LEFT JOIN edges e ON (n.id = e.source_id OR n.id = e.target_id)
GROUP BY t.id, t.title, t.normalized_title, t.genre
ORDER BY node_count DESC, edge_count DESC;

CREATE UNIQUE INDEX IF NOT EXISTS idx_graph_popular_tracks_id ON graph_popular_tracks(id);
CREATE INDEX IF NOT EXISTS idx_graph_popular_tracks_node_count ON graph_popular_tracks(node_count DESC);

-- Graph centrality metrics
CREATE MATERIALIZED VIEW IF NOT EXISTS node_centrality AS
SELECT 
    n.id as node_id,
    n.track_id,
    COUNT(DISTINCT e1.id) as degree_centrality,
    COUNT(DISTINCT e1.id) + COUNT(DISTINCT e2.id) as total_connections,
    AVG(e1.weight) as avg_outgoing_weight,
    AVG(e2.weight) as avg_incoming_weight
FROM nodes n
LEFT JOIN edges e1 ON n.id = e1.source_id
LEFT JOIN edges e2 ON n.id = e2.target_id
GROUP BY n.id, n.track_id
ORDER BY degree_centrality DESC;

CREATE UNIQUE INDEX IF NOT EXISTS idx_node_centrality_node_id ON node_centrality(node_id);
CREATE INDEX IF NOT EXISTS idx_node_centrality_degree ON node_centrality(degree_centrality DESC);

-- ===========================================
-- TRIGGERS FOR AUTOMATIC MAINTENANCE
-- ===========================================

-- Update trigger for nodes
CREATE TRIGGER update_nodes_updated_at 
    BEFORE UPDATE ON nodes
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Function to refresh materialized views
CREATE OR REPLACE FUNCTION refresh_graph_views()
RETURNS VOID AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY graph_popular_tracks;
    REFRESH MATERIALIZED VIEW CONCURRENTLY node_centrality;
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- PERFORMANCE OPTIMIZATION SETTINGS
-- ===========================================

-- Enable parallel query execution for graph operations
SET max_parallel_workers_per_gather = 4;
SET parallel_tuple_cost = 0.1;
SET parallel_setup_cost = 1000.0;

-- Optimize for graph workloads
SET effective_cache_size = '4GB';
SET shared_buffers = '1GB';
SET work_mem = '256MB';
SET maintenance_work_mem = '512MB';

-- Enable optimizations for JSONB operations
SET gin_fuzzy_search_limit = 0;

-- ===========================================
-- PERMISSIONS
-- ===========================================

-- Grant permissions to application user
GRANT SELECT, INSERT, UPDATE, DELETE ON nodes TO musicdb_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON edges TO musicdb_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON audio_analysis TO musicdb_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON graph_clusters TO musicdb_app;

-- Grant select on materialized views
GRANT SELECT ON graph_popular_tracks TO musicdb_app;
GRANT SELECT ON node_centrality TO musicdb_app;

-- Grant execute on functions
GRANT EXECUTE ON FUNCTION bulk_insert_nodes(JSONB) TO musicdb_app;
GRANT EXECUTE ON FUNCTION bulk_insert_edges(JSONB) TO musicdb_app;
GRANT EXECUTE ON FUNCTION get_connected_nodes(UUID, INTEGER, INTEGER) TO musicdb_app;
GRANT EXECUTE ON FUNCTION get_nodes_in_radius(FLOAT, FLOAT, FLOAT, INTEGER) TO musicdb_app;
GRANT EXECUTE ON FUNCTION calculate_graph_metrics() TO musicdb_app;
GRANT EXECUTE ON FUNCTION refresh_graph_views() TO musicdb_app;

-- Grant permissions to read-only user
GRANT SELECT ON nodes TO musicdb_readonly;
GRANT SELECT ON edges TO musicdb_readonly;
GRANT SELECT ON audio_analysis TO musicdb_readonly;
GRANT SELECT ON graph_clusters TO musicdb_readonly;
GRANT SELECT ON graph_popular_tracks TO musicdb_readonly;
GRANT SELECT ON node_centrality TO musicdb_readonly;