-- ========================================================
-- ROLLBACK: 000_schema_migrations_down.sql
-- PURPOSE: Remove schema migrations tracking table
-- AUTHOR: SongNodes Development Team
-- VERSION: 1.0.0
-- DATE: 2025-01-22
-- ========================================================

-- Set search path
SET search_path TO musicdb, public;

BEGIN;

-- ========================================================
-- REMOVE SCHEMA MIGRATIONS TABLE
-- ========================================================

-- Revoke permissions
REVOKE ALL ON schema_migrations FROM musicdb_app;
REVOKE ALL ON schema_migrations FROM musicdb_readonly;

-- Drop table
DROP TABLE IF EXISTS schema_migrations CASCADE;

COMMIT;

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Schema migrations tracking table removed successfully';
END $$;