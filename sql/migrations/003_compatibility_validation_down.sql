-- ========================================================
-- ROLLBACK: 003_compatibility_validation_down.sql
-- PURPOSE: Remove compatibility validation framework
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

DROP FUNCTION IF EXISTS analyze_visualization_indexes() CASCADE;
DROP FUNCTION IF EXISTS run_migration_validation(VARCHAR) CASCADE;
DROP FUNCTION IF EXISTS test_spatial_query_performance(INTEGER) CASCADE;
DROP FUNCTION IF EXISTS validate_visualization_data_consistency() CASCADE;

-- ========================================================
-- 2. REMOVE TABLES
-- ========================================================

DROP TABLE IF EXISTS migration_validation_results CASCADE;

-- ========================================================
-- 3. REVOKE PERMISSIONS
-- ========================================================

REVOKE ALL ON migration_validation_results FROM musicdb_app;
REVOKE ALL ON migration_validation_results FROM musicdb_readonly;

-- ========================================================
-- 4. REMOVE MIGRATION RECORD
-- ========================================================

DELETE FROM schema_migrations WHERE version = '003_compatibility_validation';

COMMIT;

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Successfully rolled back compatibility validation migration';
END $$;