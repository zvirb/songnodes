-- ========================================================
-- MIGRATION: 000_schema_migrations_up.sql
-- PURPOSE: Create schema migrations tracking table
-- AUTHOR: SongNodes Development Team
-- VERSION: 1.0.0
-- DATE: 2025-01-22
-- ========================================================

-- Set search path
SET search_path TO musicdb, public;

BEGIN;

-- ========================================================
-- SCHEMA MIGRATIONS TRACKING TABLE
-- ========================================================

CREATE TABLE IF NOT EXISTS schema_migrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version VARCHAR(255) NOT NULL UNIQUE,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    rollback_sql TEXT,
    checksum VARCHAR(64),
    execution_time_ms INTEGER,
    applied_by VARCHAR(255) DEFAULT current_user,
    description TEXT,
    metadata JSONB DEFAULT '{}'::JSONB
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_schema_migrations_version ON schema_migrations(version);
CREATE INDEX IF NOT EXISTS idx_schema_migrations_applied_at ON schema_migrations(applied_at DESC);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON schema_migrations TO musicdb_app;
GRANT SELECT ON schema_migrations TO musicdb_readonly;

-- Insert initial record
INSERT INTO schema_migrations (version, description, metadata) 
VALUES (
    '000_schema_migrations', 
    'Create schema migrations tracking table',
    '{"initial": true, "system": true}'::JSONB
);

COMMIT;

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Schema migrations tracking table created successfully';
END $$;