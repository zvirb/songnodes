-- Simplified Graph Visualization Schema
-- Without PostGIS dependency for initial validation

-- Set search path
SET search_path TO musicdb, public;

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===========================================
-- GRAPH TABLES
-- ===========================================

-- Graph nodes table with simple X,Y coordinates
CREATE TABLE IF NOT EXISTS nodes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    track_id UUID NOT NULL,
    x_position FLOAT NOT NULL DEFAULT 0,
    y_position FLOAT NOT NULL DEFAULT 0,
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key to tracks table
    CONSTRAINT fk_nodes_track_id FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_nodes_track_id ON nodes(track_id);
CREATE INDEX IF NOT EXISTS idx_nodes_position ON nodes(x_position, y_position);
CREATE INDEX IF NOT EXISTS idx_nodes_metadata ON nodes USING gin(metadata);

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
CREATE INDEX IF NOT EXISTS idx_edges_source_target ON edges(source_id, target_id);
CREATE INDEX IF NOT EXISTS idx_edges_target_source ON edges(target_id, source_id);
CREATE INDEX IF NOT EXISTS idx_edges_type ON edges(edge_type);
CREATE INDEX IF NOT EXISTS idx_edges_weight ON edges(weight DESC);

-- ===========================================
-- FUNCTIONS
-- ===========================================

-- Bulk node insertion function
CREATE OR REPLACE FUNCTION bulk_insert_nodes(
    node_data JSONB
) RETURNS INTEGER AS $$
DECLARE
    inserted_count INTEGER;
BEGIN
    WITH bulk_insert AS (
        INSERT INTO nodes (track_id, x_position, y_position, metadata)
        SELECT 
            (value->>'track_id')::UUID,
            COALESCE((value->>'x')::FLOAT, 0),
            COALESCE((value->>'y')::FLOAT, 0),
            COALESCE(value->'metadata', '{}'::JSONB)
        FROM jsonb_array_elements(node_data) AS value
        ON CONFLICT (track_id) DO UPDATE SET
            x_position = EXCLUDED.x_position,
            y_position = EXCLUDED.y_position,
            metadata = EXCLUDED.metadata,
            updated_at = NOW()
        RETURNING 1
    )
    SELECT COUNT(*) INTO inserted_count FROM bulk_insert;
    RETURN inserted_count;
END;
$$ LANGUAGE plpgsql;

-- Insert some sample data
INSERT INTO nodes (track_id, x_position, y_position, metadata) 
SELECT 
    t.id,
    RANDOM() * 1000 - 500,  -- X position between -500 and 500
    RANDOM() * 1000 - 500,  -- Y position between -500 and 500
    jsonb_build_object(
        'genre', t.genre,
        'title', t.title,
        'sample_node', true
    )
FROM tracks t 
LIMIT 100
ON CONFLICT (track_id) DO NOTHING;

-- Insert sample edges (connecting random nodes)
INSERT INTO edges (source_id, target_id, weight, edge_type)
SELECT 
    n1.id as source_id,
    n2.id as target_id,
    RANDOM() as weight,
    'similarity' as edge_type
FROM nodes n1
CROSS JOIN nodes n2
WHERE n1.id != n2.id
AND RANDOM() < 0.05  -- 5% chance of connection
LIMIT 200
ON CONFLICT (source_id, target_id, edge_type) DO NOTHING;

COMMIT;