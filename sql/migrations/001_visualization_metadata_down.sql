-- ========================================================
-- ROLLBACK: 001_visualization_metadata_down.sql
-- PURPOSE: Rollback visualization metadata tables for SongNodes
-- AUTHOR: SongNodes Development Team
-- VERSION: 1.0.0
-- DATE: 2025-01-22
-- ========================================================

-- Set search path
SET search_path TO musicdb, public;

BEGIN;

-- ========================================================
-- 1. REMOVE MATERIALIZED VIEWS
-- ========================================================

DROP MATERIALIZED VIEW IF EXISTS layout_performance_metrics CASCADE;
DROP MATERIALIZED VIEW IF EXISTS popular_clusters CASCADE;

-- ========================================================
-- 2. REMOVE TRIGGERS AND FUNCTIONS
-- ========================================================

-- Drop triggers
DROP TRIGGER IF EXISTS update_layout_usage_trigger ON user_preferences;
DROP TRIGGER IF EXISTS update_user_preferences_updated_at ON user_preferences;
DROP TRIGGER IF EXISTS update_graph_layouts_updated_at ON graph_layouts;
DROP TRIGGER IF EXISTS update_visualization_metadata_updated_at ON visualization_metadata;

-- Drop trigger functions
DROP FUNCTION IF EXISTS update_layout_usage() CASCADE;

-- Drop utility functions
DROP FUNCTION IF EXISTS get_cluster_statistics(VARCHAR, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS update_user_preferences(VARCHAR, JSONB) CASCADE;
DROP FUNCTION IF EXISTS get_nodes_in_viewport(FLOAT, FLOAT, FLOAT, FLOAT, VARCHAR, INTEGER, INTEGER) CASCADE;

-- ========================================================
-- 3. REMOVE TABLES (IN REVERSE DEPENDENCY ORDER)
-- ========================================================

-- Remove user_preferences table
DROP TABLE IF EXISTS user_preferences CASCADE;

-- Remove graph_layouts table  
DROP TABLE IF EXISTS graph_layouts CASCADE;

-- Remove visualization_metadata table
DROP TABLE IF EXISTS visualization_metadata CASCADE;

-- ========================================================
-- 4. CLEANUP PERMISSIONS
-- ========================================================

-- Revoke permissions from application user
REVOKE ALL ON visualization_metadata FROM musicdb_app;
REVOKE ALL ON graph_layouts FROM musicdb_app;
REVOKE ALL ON user_preferences FROM musicdb_app;
REVOKE ALL ON popular_clusters FROM musicdb_app;
REVOKE ALL ON layout_performance_metrics FROM musicdb_app;

-- Revoke permissions from read-only user
REVOKE ALL ON visualization_metadata FROM musicdb_readonly;
REVOKE ALL ON graph_layouts FROM musicdb_readonly;
REVOKE ALL ON user_preferences FROM musicdb_readonly;
REVOKE ALL ON popular_clusters FROM musicdb_readonly;
REVOKE ALL ON layout_performance_metrics FROM musicdb_readonly;

-- ========================================================
-- 5. REMOVE MIGRATION RECORD
-- ========================================================

DELETE FROM schema_migrations WHERE version = '001_visualization_metadata';

COMMIT;

-- ========================================================
-- ROLLBACK COMPLETION MESSAGE
-- ========================================================
DO $$
BEGIN
    RAISE NOTICE 'Successfully rolled back migration 001_visualization_metadata';
    RAISE NOTICE 'All visualization metadata tables, indexes, functions, and triggers have been removed';
END $$;