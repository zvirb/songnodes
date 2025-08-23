-- ========================================================
-- MIGRATION: 001_visualization_metadata_up.sql
-- PURPOSE: Add visualization metadata tables for SongNodes
-- AUTHOR: SongNodes Development Team
-- VERSION: 1.0.0
-- DATE: 2025-01-22
-- ========================================================

-- Ensure required extensions are available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- Set search path
SET search_path TO musicdb, public;

BEGIN;

-- ========================================================
-- 1. VISUALIZATION_METADATA TABLE
-- ========================================================
-- Store node positions, clustering, and centrality data
CREATE TABLE IF NOT EXISTS visualization_metadata (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    node_id UUID NOT NULL,
    
    -- Position coordinates (2D space)
    x FLOAT NOT NULL,
    y FLOAT NOT NULL,
    
    -- Optional z-coordinate for 3D visualizations
    z FLOAT DEFAULT 0.0,
    
    -- Clustering information
    cluster_id INTEGER,
    cluster_algorithm VARCHAR(50) DEFAULT 'louvain',
    cluster_score FLOAT DEFAULT 0.0 CHECK (cluster_score >= 0.0 AND cluster_score <= 1.0),
    
    -- Community detection
    community_id INTEGER,
    community_algorithm VARCHAR(50) DEFAULT 'modularity',
    community_score FLOAT DEFAULT 0.0 CHECK (community_score >= 0.0 AND community_score <= 1.0),
    
    -- Centrality measures
    centrality_score FLOAT DEFAULT 0.0 CHECK (centrality_score >= 0.0 AND centrality_score <= 1.0),
    betweenness_centrality FLOAT DEFAULT 0.0,
    closeness_centrality FLOAT DEFAULT 0.0,
    eigenvector_centrality FLOAT DEFAULT 0.0,
    pagerank_score FLOAT DEFAULT 0.0,
    
    -- Visual properties
    node_size FLOAT DEFAULT 1.0 CHECK (node_size > 0),
    node_color VARCHAR(7) DEFAULT '#3B82F6', -- Hex color
    node_opacity FLOAT DEFAULT 1.0 CHECK (node_opacity >= 0.0 AND node_opacity <= 1.0),
    
    -- Layout information
    layout_algorithm VARCHAR(50) DEFAULT 'force_directed',
    layout_version INTEGER DEFAULT 1,
    
    -- Spatial indexing point
    position POINT GENERATED ALWAYS AS (POINT(x, y)) STORED,
    
    -- Additional metadata
    metadata JSONB DEFAULT '{}'::JSONB,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key constraints
    CONSTRAINT fk_visualization_metadata_node_id 
        FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE,
    
    -- Unique constraint per layout algorithm
    CONSTRAINT unique_node_layout 
        UNIQUE (node_id, layout_algorithm, layout_version)
);

-- Create indexes for visualization_metadata
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_visualization_metadata_node_id 
    ON visualization_metadata(node_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_visualization_metadata_position 
    ON visualization_metadata USING GIST(position);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_visualization_metadata_cluster 
    ON visualization_metadata(cluster_id, cluster_algorithm) 
    WHERE cluster_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_visualization_metadata_community 
    ON visualization_metadata(community_id, community_algorithm) 
    WHERE community_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_visualization_metadata_centrality 
    ON visualization_metadata(centrality_score DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_visualization_metadata_layout 
    ON visualization_metadata(layout_algorithm, layout_version);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_visualization_metadata_metadata 
    ON visualization_metadata USING GIN(metadata);

-- Spatial radius queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_visualization_metadata_spatial_radius 
    ON visualization_metadata USING GIST(position, cluster_id);

-- ========================================================
-- 2. GRAPH_LAYOUTS TABLE
-- ========================================================
-- Store precomputed layout configurations
CREATE TABLE IF NOT EXISTS graph_layouts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Layout identification
    name VARCHAR(255) NOT NULL,
    algorithm VARCHAR(50) NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    
    -- Layout parameters
    parameters JSONB NOT NULL DEFAULT '{}'::JSONB,
    
    -- Performance metrics
    computation_time_ms INTEGER,
    node_count INTEGER NOT NULL,
    edge_count INTEGER NOT NULL,
    
    -- Quality metrics
    stress_value FLOAT,
    modularity_score FLOAT,
    crossing_count INTEGER,
    
    -- Layout bounds
    min_x FLOAT NOT NULL,
    max_x FLOAT NOT NULL,
    min_y FLOAT NOT NULL,
    max_y FLOAT NOT NULL,
    min_z FLOAT DEFAULT 0.0,
    max_z FLOAT DEFAULT 0.0,
    
    -- Status and validation
    is_active BOOLEAN DEFAULT TRUE,
    is_validated BOOLEAN DEFAULT FALSE,
    validation_errors JSONB DEFAULT '[]'::JSONB,
    
    -- Usage tracking
    usage_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMP WITH TIME ZONE,
    
    -- Additional metadata
    description TEXT,
    tags TEXT[],
    metadata JSONB DEFAULT '{}'::JSONB,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT unique_layout_version 
        UNIQUE (name, algorithm, version),
    CONSTRAINT valid_bounds 
        CHECK (min_x <= max_x AND min_y <= max_y AND min_z <= max_z)
);

-- Create indexes for graph_layouts
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_graph_layouts_name 
    ON graph_layouts(name);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_graph_layouts_algorithm 
    ON graph_layouts(algorithm);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_graph_layouts_active 
    ON graph_layouts(is_active) WHERE is_active = TRUE;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_graph_layouts_node_count 
    ON graph_layouts(node_count DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_graph_layouts_usage 
    ON graph_layouts(usage_count DESC, last_used_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_graph_layouts_parameters 
    ON graph_layouts USING GIN(parameters);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_graph_layouts_tags 
    ON graph_layouts USING GIN(tags);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_graph_layouts_metadata 
    ON graph_layouts USING GIN(metadata);

-- ========================================================
-- 3. USER_PREFERENCES TABLE
-- ========================================================
-- Store user-specific visualization preferences and collaborative features
CREATE TABLE IF NOT EXISTS user_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- User identification (can be session-based or account-based)
    user_id VARCHAR(255) NOT NULL,
    session_id VARCHAR(255),
    
    -- Preference categories
    preference_type VARCHAR(50) NOT NULL DEFAULT 'visualization',
    
    -- Layout preferences
    preferred_layout_algorithm VARCHAR(50) DEFAULT 'force_directed',
    preferred_layout_id UUID REFERENCES graph_layouts(id) ON DELETE SET NULL,
    
    -- Visual preferences
    node_size_multiplier FLOAT DEFAULT 1.0 CHECK (node_size_multiplier > 0),
    edge_opacity FLOAT DEFAULT 0.7 CHECK (edge_opacity >= 0.0 AND edge_opacity <= 1.0),
    show_labels BOOLEAN DEFAULT TRUE,
    label_threshold FLOAT DEFAULT 0.5,
    
    -- Color scheme preferences
    color_scheme VARCHAR(50) DEFAULT 'default',
    custom_colors JSONB DEFAULT '{}'::JSONB,
    
    -- Interaction preferences
    zoom_sensitivity FLOAT DEFAULT 1.0 CHECK (zoom_sensitivity > 0),
    pan_sensitivity FLOAT DEFAULT 1.0 CHECK (pan_sensitivity > 0),
    hover_behavior VARCHAR(20) DEFAULT 'highlight' CHECK (hover_behavior IN ('highlight', 'tooltip', 'none')),
    
    -- Filter preferences
    saved_filters JSONB DEFAULT '[]'::JSONB,
    default_filter VARCHAR(255),
    
    -- Performance preferences
    max_visible_nodes INTEGER DEFAULT 1000 CHECK (max_visible_nodes > 0),
    enable_gpu_acceleration BOOLEAN DEFAULT TRUE,
    frame_rate_limit INTEGER DEFAULT 60 CHECK (frame_rate_limit > 0),
    
    -- Collaborative features
    is_public BOOLEAN DEFAULT FALSE,
    shared_with TEXT[] DEFAULT '{}',
    collaboration_permissions JSONB DEFAULT '{"view": true, "edit": false, "share": false}'::JSONB,
    
    -- Bookmarks and saved views
    saved_views JSONB DEFAULT '[]'::JSONB,
    bookmarked_nodes UUID[],
    
    -- Additional metadata
    metadata JSONB DEFAULT '{}'::JSONB,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT unique_user_preference_type 
        UNIQUE (user_id, preference_type)
);

-- Create indexes for user_preferences
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_preferences_user_id 
    ON user_preferences(user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_preferences_session_id 
    ON user_preferences(session_id) WHERE session_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_preferences_type 
    ON user_preferences(preference_type);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_preferences_layout_id 
    ON user_preferences(preferred_layout_id) WHERE preferred_layout_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_preferences_public 
    ON user_preferences(is_public) WHERE is_public = TRUE;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_preferences_last_accessed 
    ON user_preferences(last_accessed_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_preferences_shared_with 
    ON user_preferences USING GIN(shared_with);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_preferences_bookmarks 
    ON user_preferences USING GIN(bookmarked_nodes);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_preferences_metadata 
    ON user_preferences USING GIN(metadata);

-- ========================================================
-- 4. PERFORMANCE OPTIMIZATION INDEXES
-- ========================================================

-- Composite indexes for common spatial queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_visualization_spatial_cluster_centrality 
    ON visualization_metadata USING GIST(position, cluster_id) 
    INCLUDE (centrality_score);

-- Index for layout-specific queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_visualization_layout_active 
    ON visualization_metadata(layout_algorithm, layout_version) 
    WHERE layout_algorithm IS NOT NULL;

-- Index for user collaboration queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_preferences_collaboration 
    ON user_preferences(user_id, is_public) 
    INCLUDE (collaboration_permissions);

-- ========================================================
-- 5. FUNCTIONS FOR VISUALIZATION OPERATIONS
-- ========================================================

-- Function to get nodes within viewport bounds
CREATE OR REPLACE FUNCTION get_nodes_in_viewport(
    min_x FLOAT,
    min_y FLOAT,
    max_x FLOAT,
    max_y FLOAT,
    layout_algorithm VARCHAR(50) DEFAULT 'force_directed',
    layout_version INTEGER DEFAULT 1,
    max_nodes INTEGER DEFAULT 1000
) RETURNS TABLE(
    node_id UUID,
    track_id VARCHAR,
    x FLOAT,
    y FLOAT,
    cluster_id INTEGER,
    centrality_score FLOAT,
    node_size FLOAT,
    node_color VARCHAR,
    metadata JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        vm.node_id,
        n.track_id,
        vm.x,
        vm.y,
        vm.cluster_id,
        vm.centrality_score,
        vm.node_size,
        vm.node_color,
        vm.metadata
    FROM visualization_metadata vm
    JOIN nodes n ON vm.node_id = n.id
    WHERE vm.x >= min_x 
      AND vm.x <= max_x 
      AND vm.y >= min_y 
      AND vm.y <= max_y
      AND vm.layout_algorithm = get_nodes_in_viewport.layout_algorithm
      AND vm.layout_version = get_nodes_in_viewport.layout_version
    ORDER BY vm.centrality_score DESC
    LIMIT max_nodes;
END;
$$ LANGUAGE plpgsql;

-- Function to update user preferences with validation
CREATE OR REPLACE FUNCTION update_user_preferences(
    user_id_param VARCHAR(255),
    preferences_data JSONB
) RETURNS UUID AS $$
DECLARE
    preference_id UUID;
BEGIN
    INSERT INTO user_preferences (user_id, metadata, last_accessed_at)
    VALUES (user_id_param, preferences_data, NOW())
    ON CONFLICT (user_id, preference_type) 
    DO UPDATE SET
        metadata = preferences_data,
        updated_at = NOW(),
        last_accessed_at = NOW()
    RETURNING id INTO preference_id;
    
    RETURN preference_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get cluster statistics
CREATE OR REPLACE FUNCTION get_cluster_statistics(
    layout_algorithm_param VARCHAR(50) DEFAULT 'force_directed',
    layout_version_param INTEGER DEFAULT 1
) RETURNS TABLE(
    cluster_id INTEGER,
    node_count BIGINT,
    avg_centrality FLOAT,
    cluster_bounds JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        vm.cluster_id,
        COUNT(*) as node_count,
        AVG(vm.centrality_score) as avg_centrality,
        jsonb_build_object(
            'min_x', MIN(vm.x),
            'max_x', MAX(vm.x),
            'min_y', MIN(vm.y),
            'max_y', MAX(vm.y),
            'center_x', AVG(vm.x),
            'center_y', AVG(vm.y)
        ) as cluster_bounds
    FROM visualization_metadata vm
    WHERE vm.cluster_id IS NOT NULL
      AND vm.layout_algorithm = layout_algorithm_param
      AND vm.layout_version = layout_version_param
    GROUP BY vm.cluster_id
    ORDER BY node_count DESC;
END;
$$ LANGUAGE plpgsql;

-- ========================================================
-- 6. TRIGGERS FOR AUTOMATIC MAINTENANCE
-- ========================================================

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_visualization_metadata_updated_at 
    BEFORE UPDATE ON visualization_metadata
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_graph_layouts_updated_at 
    BEFORE UPDATE ON graph_layouts
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_preferences_updated_at 
    BEFORE UPDATE ON user_preferences
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger to update layout usage statistics
CREATE OR REPLACE FUNCTION update_layout_usage()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE graph_layouts 
    SET usage_count = usage_count + 1,
        last_used_at = NOW()
    WHERE id = NEW.preferred_layout_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_layout_usage_trigger
    AFTER INSERT OR UPDATE OF preferred_layout_id ON user_preferences
    FOR EACH ROW 
    WHEN (NEW.preferred_layout_id IS NOT NULL)
    EXECUTE FUNCTION update_layout_usage();

-- ========================================================
-- 7. MATERIALIZED VIEWS FOR PERFORMANCE
-- ========================================================

-- View for popular clusters
CREATE MATERIALIZED VIEW IF NOT EXISTS popular_clusters AS
SELECT 
    vm.cluster_id,
    vm.layout_algorithm,
    vm.layout_version,
    COUNT(*) as node_count,
    AVG(vm.centrality_score) as avg_centrality,
    MIN(vm.x) as min_x,
    MAX(vm.x) as max_x,
    MIN(vm.y) as min_y,
    MAX(vm.y) as max_y,
    AVG(vm.x) as center_x,
    AVG(vm.y) as center_y
FROM visualization_metadata vm
WHERE vm.cluster_id IS NOT NULL
GROUP BY vm.cluster_id, vm.layout_algorithm, vm.layout_version
ORDER BY node_count DESC;

CREATE UNIQUE INDEX IF NOT EXISTS idx_popular_clusters_unique 
    ON popular_clusters(cluster_id, layout_algorithm, layout_version);

CREATE INDEX IF NOT EXISTS idx_popular_clusters_node_count 
    ON popular_clusters(node_count DESC);

-- View for layout performance metrics
CREATE MATERIALIZED VIEW IF NOT EXISTS layout_performance_metrics AS
SELECT 
    gl.id as layout_id,
    gl.name,
    gl.algorithm,
    gl.version,
    gl.node_count,
    gl.edge_count,
    gl.computation_time_ms,
    gl.stress_value,
    gl.modularity_score,
    gl.usage_count,
    gl.last_used_at,
    COUNT(DISTINCT vm.node_id) as positioned_nodes,
    AVG(vm.centrality_score) as avg_node_centrality
FROM graph_layouts gl
LEFT JOIN visualization_metadata vm ON (
    vm.layout_algorithm = gl.algorithm AND 
    vm.layout_version = gl.version
)
WHERE gl.is_active = TRUE
GROUP BY gl.id, gl.name, gl.algorithm, gl.version, 
         gl.node_count, gl.edge_count, gl.computation_time_ms, 
         gl.stress_value, gl.modularity_score, gl.usage_count, gl.last_used_at
ORDER BY gl.usage_count DESC, gl.last_used_at DESC;

CREATE UNIQUE INDEX IF NOT EXISTS idx_layout_performance_metrics_layout_id 
    ON layout_performance_metrics(layout_id);

-- ========================================================
-- 8. PERMISSIONS
-- ========================================================

-- Grant permissions to application user
GRANT SELECT, INSERT, UPDATE, DELETE ON visualization_metadata TO musicdb_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON graph_layouts TO musicdb_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_preferences TO musicdb_app;

-- Grant select on materialized views
GRANT SELECT ON popular_clusters TO musicdb_app;
GRANT SELECT ON layout_performance_metrics TO musicdb_app;

-- Grant execute on functions
GRANT EXECUTE ON FUNCTION get_nodes_in_viewport(FLOAT, FLOAT, FLOAT, FLOAT, VARCHAR, INTEGER, INTEGER) TO musicdb_app;
GRANT EXECUTE ON FUNCTION update_user_preferences(VARCHAR, JSONB) TO musicdb_app;
GRANT EXECUTE ON FUNCTION get_cluster_statistics(VARCHAR, INTEGER) TO musicdb_app;

-- Grant permissions to read-only user
GRANT SELECT ON visualization_metadata TO musicdb_readonly;
GRANT SELECT ON graph_layouts TO musicdb_readonly;
GRANT SELECT ON user_preferences TO musicdb_readonly;
GRANT SELECT ON popular_clusters TO musicdb_readonly;
GRANT SELECT ON layout_performance_metrics TO musicdb_readonly;

COMMIT;

-- ========================================================
-- MIGRATION COMPLETION LOG
-- ========================================================
INSERT INTO schema_migrations (version, applied_at) 
VALUES ('001_visualization_metadata', NOW())
ON CONFLICT (version) DO NOTHING;