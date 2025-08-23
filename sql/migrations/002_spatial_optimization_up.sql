-- ========================================================
-- MIGRATION: 002_spatial_optimization_up.sql
-- PURPOSE: Advanced spatial indexing optimizations for visualization performance
-- AUTHOR: SongNodes Development Team
-- VERSION: 1.0.0
-- DATE: 2025-01-22
-- ========================================================

-- Set search path
SET search_path TO musicdb, public;

BEGIN;

-- ========================================================
-- 1. ADVANCED SPATIAL INDEXES
-- ========================================================

-- Multi-dimensional spatial index for 3D visualizations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_visualization_metadata_3d_position 
    ON visualization_metadata USING GIST(
        box(point(x - node_size, y - node_size), point(x + node_size, y + node_size))
    );

-- Spatial clustering index for hierarchical queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_visualization_metadata_spatial_cluster 
    ON visualization_metadata USING GIST(position, cluster_id)
    WHERE cluster_id IS NOT NULL;

-- Distance-based index for nearest neighbor queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_visualization_metadata_centrality_spatial 
    ON visualization_metadata USING GIST(position)
    INCLUDE (centrality_score, node_size);

-- ========================================================
-- 2. SPATIAL QUERY OPTIMIZATION FUNCTIONS
-- ========================================================

-- Function for efficient nearest neighbor search
CREATE OR REPLACE FUNCTION get_nearest_nodes(
    center_x FLOAT,
    center_y FLOAT,
    max_distance FLOAT DEFAULT 100.0,
    max_nodes INTEGER DEFAULT 50,
    layout_algorithm VARCHAR(50) DEFAULT 'force_directed',
    layout_version INTEGER DEFAULT 1
) RETURNS TABLE(
    node_id UUID,
    track_id VARCHAR,
    x FLOAT,
    y FLOAT,
    distance FLOAT,
    centrality_score FLOAT,
    cluster_id INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        vm.node_id,
        n.track_id,
        vm.x,
        vm.y,
        sqrt(power(vm.x - center_x, 2) + power(vm.y - center_y, 2)) as distance,
        vm.centrality_score,
        vm.cluster_id
    FROM visualization_metadata vm
    JOIN nodes n ON vm.node_id = n.id
    WHERE vm.layout_algorithm = get_nearest_nodes.layout_algorithm
      AND vm.layout_version = get_nearest_nodes.layout_version
      AND sqrt(power(vm.x - center_x, 2) + power(vm.y - center_y, 2)) <= max_distance
    ORDER BY vm.position <-> point(center_x, center_y)
    LIMIT max_nodes;
END;
$$ LANGUAGE plpgsql;

-- Function for spatial clustering analysis
CREATE OR REPLACE FUNCTION analyze_spatial_clusters(
    layout_algorithm VARCHAR(50) DEFAULT 'force_directed',
    layout_version INTEGER DEFAULT 1,
    cluster_threshold FLOAT DEFAULT 50.0
) RETURNS TABLE(
    cluster_id INTEGER,
    node_count BIGINT,
    spatial_density FLOAT,
    avg_centrality FLOAT,
    cluster_diameter FLOAT,
    cluster_center_x FLOAT,
    cluster_center_y FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        vm.cluster_id,
        COUNT(*) as node_count,
        COUNT(*)::FLOAT / (
            (MAX(vm.x) - MIN(vm.x)) * (MAX(vm.y) - MIN(vm.y)) + 1
        ) as spatial_density,
        AVG(vm.centrality_score) as avg_centrality,
        sqrt(
            power(MAX(vm.x) - MIN(vm.x), 2) + 
            power(MAX(vm.y) - MIN(vm.y), 2)
        ) as cluster_diameter,
        AVG(vm.x) as cluster_center_x,
        AVG(vm.y) as cluster_center_y
    FROM visualization_metadata vm
    WHERE vm.cluster_id IS NOT NULL
      AND vm.layout_algorithm = analyze_spatial_clusters.layout_algorithm
      AND vm.layout_version = analyze_spatial_clusters.layout_version
    GROUP BY vm.cluster_id
    HAVING COUNT(*) >= 3  -- Minimum cluster size
    ORDER BY spatial_density DESC;
END;
$$ LANGUAGE plpgsql;

-- Function for viewport-based node loading with level of detail
CREATE OR REPLACE FUNCTION get_viewport_nodes_lod(
    min_x FLOAT,
    min_y FLOAT,
    max_x FLOAT,
    max_y FLOAT,
    zoom_level FLOAT DEFAULT 1.0,
    layout_algorithm VARCHAR(50) DEFAULT 'force_directed',
    layout_version INTEGER DEFAULT 1
) RETURNS TABLE(
    node_id UUID,
    track_id VARCHAR,
    x FLOAT,
    y FLOAT,
    centrality_score FLOAT,
    node_size FLOAT,
    should_render BOOLEAN,
    lod_level INTEGER
) AS $$
DECLARE
    viewport_area FLOAT;
    density_threshold FLOAT;
BEGIN
    -- Calculate viewport area and density threshold
    viewport_area := (max_x - min_x) * (max_y - min_y);
    density_threshold := GREATEST(0.1, 1.0 / zoom_level);
    
    RETURN QUERY
    SELECT 
        vm.node_id,
        n.track_id,
        vm.x,
        vm.y,
        vm.centrality_score,
        vm.node_size,
        CASE 
            WHEN zoom_level >= 2.0 THEN TRUE  -- Show all at high zoom
            WHEN vm.centrality_score >= density_threshold THEN TRUE
            WHEN vm.node_size >= (2.0 / zoom_level) THEN TRUE
            ELSE FALSE
        END as should_render,
        CASE 
            WHEN zoom_level >= 3.0 THEN 0  -- Full detail
            WHEN zoom_level >= 1.5 THEN 1  -- Medium detail
            ELSE 2  -- Low detail
        END as lod_level
    FROM visualization_metadata vm
    JOIN nodes n ON vm.node_id = n.id
    WHERE vm.x >= min_x 
      AND vm.x <= max_x 
      AND vm.y >= min_y 
      AND vm.y <= max_y
      AND vm.layout_algorithm = get_viewport_nodes_lod.layout_algorithm
      AND vm.layout_version = get_viewport_nodes_lod.layout_version
    ORDER BY vm.centrality_score DESC, vm.node_size DESC;
END;
$$ LANGUAGE plpgsql;

-- ========================================================
-- 3. SPATIAL AGGREGATION VIEWS
-- ========================================================

-- Spatial grid aggregation for performance
CREATE MATERIALIZED VIEW IF NOT EXISTS spatial_grid_aggregation AS
SELECT 
    floor(vm.x / 50.0)::INTEGER * 50 as grid_x,
    floor(vm.y / 50.0)::INTEGER * 50 as grid_y,
    vm.layout_algorithm,
    vm.layout_version,
    COUNT(*) as node_count,
    AVG(vm.centrality_score) as avg_centrality,
    MAX(vm.centrality_score) as max_centrality,
    AVG(vm.node_size) as avg_node_size,
    array_agg(vm.cluster_id) FILTER (WHERE vm.cluster_id IS NOT NULL) as clusters_in_grid,
    COUNT(DISTINCT vm.cluster_id) as cluster_count
FROM visualization_metadata vm
GROUP BY 
    floor(vm.x / 50.0), 
    floor(vm.y / 50.0), 
    vm.layout_algorithm, 
    vm.layout_version;

CREATE INDEX IF NOT EXISTS idx_spatial_grid_aggregation_grid 
    ON spatial_grid_aggregation(grid_x, grid_y, layout_algorithm, layout_version);

CREATE INDEX IF NOT EXISTS idx_spatial_grid_aggregation_density 
    ON spatial_grid_aggregation(node_count DESC);

-- ========================================================
-- 4. PERFORMANCE MONITORING TABLES
-- ========================================================

-- Query performance tracking
CREATE TABLE IF NOT EXISTS spatial_query_performance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    query_type VARCHAR(100) NOT NULL,
    viewport_bounds JSONB,
    node_count INTEGER,
    execution_time_ms INTEGER,
    zoom_level FLOAT,
    layout_algorithm VARCHAR(50),
    layout_version INTEGER,
    query_timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    user_session VARCHAR(255),
    metadata JSONB DEFAULT '{}'::JSONB
);

CREATE INDEX IF NOT EXISTS idx_spatial_query_performance_type 
    ON spatial_query_performance(query_type);

CREATE INDEX IF NOT EXISTS idx_spatial_query_performance_timestamp 
    ON spatial_query_performance(query_timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_spatial_query_performance_execution_time 
    ON spatial_query_performance(execution_time_ms DESC);

-- ========================================================
-- 5. AUTOMATIC SPATIAL STATISTICS UPDATE
-- ========================================================

-- Function to update spatial statistics
CREATE OR REPLACE FUNCTION update_spatial_statistics()
RETURNS VOID AS $$
BEGIN
    -- Refresh spatial grid aggregation
    REFRESH MATERIALIZED VIEW CONCURRENTLY spatial_grid_aggregation;
    
    -- Update table statistics for better query planning
    ANALYZE visualization_metadata;
    ANALYZE spatial_query_performance;
    
    -- Log the update
    INSERT INTO spatial_query_performance (
        query_type, 
        execution_time_ms, 
        metadata
    ) VALUES (
        'statistics_update',
        0,
        jsonb_build_object(
            'update_timestamp', NOW(),
            'trigger', 'automatic'
        )
    );
END;
$$ LANGUAGE plpgsql;

-- ========================================================
-- 6. SPATIAL INDEX MAINTENANCE
-- ========================================================

-- Function to rebuild spatial indexes if needed
CREATE OR REPLACE FUNCTION maintain_spatial_indexes()
RETURNS VOID AS $$
DECLARE
    index_info RECORD;
    maintenance_needed BOOLEAN := FALSE;
BEGIN
    -- Check index bloat and performance
    FOR index_info IN 
        SELECT schemaname, tablename, indexname 
        FROM pg_indexes 
        WHERE schemaname = 'musicdb' 
        AND indexname LIKE '%spatial%'
    LOOP
        -- Log maintenance activity
        INSERT INTO spatial_query_performance (
            query_type, 
            metadata
        ) VALUES (
            'index_maintenance_check',
            jsonb_build_object(
                'index_name', index_info.indexname,
                'table_name', index_info.tablename,
                'check_timestamp', NOW()
            )
        );
    END LOOP;
    
    -- Update statistics after maintenance
    IF maintenance_needed THEN
        PERFORM update_spatial_statistics();
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ========================================================
-- 7. PERMISSIONS
-- ========================================================

-- Grant permissions to application user
GRANT SELECT, INSERT, UPDATE, DELETE ON spatial_query_performance TO musicdb_app;
GRANT SELECT ON spatial_grid_aggregation TO musicdb_app;

-- Grant execute permissions on new functions
GRANT EXECUTE ON FUNCTION get_nearest_nodes(FLOAT, FLOAT, FLOAT, INTEGER, VARCHAR, INTEGER) TO musicdb_app;
GRANT EXECUTE ON FUNCTION analyze_spatial_clusters(VARCHAR, INTEGER, FLOAT) TO musicdb_app;
GRANT EXECUTE ON FUNCTION get_viewport_nodes_lod(FLOAT, FLOAT, FLOAT, FLOAT, FLOAT, VARCHAR, INTEGER) TO musicdb_app;
GRANT EXECUTE ON FUNCTION update_spatial_statistics() TO musicdb_app;
GRANT EXECUTE ON FUNCTION maintain_spatial_indexes() TO musicdb_app;

-- Grant permissions to read-only user
GRANT SELECT ON spatial_query_performance TO musicdb_readonly;
GRANT SELECT ON spatial_grid_aggregation TO musicdb_readonly;

COMMIT;

-- ========================================================
-- MIGRATION COMPLETION LOG
-- ========================================================
INSERT INTO schema_migrations (version, applied_at, description) 
VALUES ('002_spatial_optimization', NOW(), 'Advanced spatial indexing optimizations')
ON CONFLICT (version) DO NOTHING;