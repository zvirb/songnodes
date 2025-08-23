-- ========================================================
-- ROLLBACK: 002_spatial_optimization_down.sql
-- PURPOSE: Remove spatial optimization features
-- AUTHOR: SongNodes Development Team
-- VERSION: 1.0.0
-- DATE: 2025-01-22
-- ========================================================

-- Set search path
SET search_path TO musicdb, public;

BEGIN;

-- ========================================================
-- 1. REMOVE FUNCTIONS
-- ========================================================

DROP FUNCTION IF EXISTS maintain_spatial_indexes() CASCADE;
DROP FUNCTION IF EXISTS update_spatial_statistics() CASCADE;
DROP FUNCTION IF EXISTS get_viewport_nodes_lod(FLOAT, FLOAT, FLOAT, FLOAT, FLOAT, VARCHAR, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS analyze_spatial_clusters(VARCHAR, INTEGER, FLOAT) CASCADE;
DROP FUNCTION IF EXISTS get_nearest_nodes(FLOAT, FLOAT, FLOAT, INTEGER, VARCHAR, INTEGER) CASCADE;

-- ========================================================
-- 2. REMOVE TABLES AND VIEWS
-- ========================================================

DROP TABLE IF EXISTS spatial_query_performance CASCADE;
DROP MATERIALIZED VIEW IF EXISTS spatial_grid_aggregation CASCADE;

-- ========================================================
-- 3. REMOVE INDEXES
-- ========================================================

DROP INDEX CONCURRENTLY IF EXISTS idx_visualization_metadata_centrality_spatial;
DROP INDEX CONCURRENTLY IF EXISTS idx_visualization_metadata_spatial_cluster;
DROP INDEX CONCURRENTLY IF EXISTS idx_visualization_metadata_3d_position;

-- ========================================================
-- 4. REVOKE PERMISSIONS
-- ========================================================

REVOKE ALL ON spatial_query_performance FROM musicdb_app;
REVOKE ALL ON spatial_grid_aggregation FROM musicdb_app;
REVOKE ALL ON spatial_query_performance FROM musicdb_readonly;
REVOKE ALL ON spatial_grid_aggregation FROM musicdb_readonly;

-- ========================================================
-- 5. REMOVE MIGRATION RECORD
-- ========================================================

DELETE FROM schema_migrations WHERE version = '002_spatial_optimization';

COMMIT;

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Successfully rolled back spatial optimization migration';
END $$;