-- ========================================================
-- MIGRATION: 003_compatibility_validation_up.sql
-- PURPOSE: Validate compatibility with existing schema and add constraints
-- AUTHOR: SongNodes Development Team
-- VERSION: 1.0.0
-- DATE: 2025-01-22
-- ========================================================

-- Set search path
SET search_path TO musicdb, public;

BEGIN;

-- ========================================================
-- 1. VALIDATE EXISTING SCHEMA COMPATIBILITY
-- ========================================================

-- Verify that required base tables exist
DO $$
BEGIN
    -- Check for nodes table
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'musicdb' AND table_name = 'nodes') THEN
        RAISE EXCEPTION 'Base table "nodes" not found. Please ensure graph schema is applied first.';
    END IF;
    
    -- Check for tracks table
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'musicdb' AND table_name = 'tracks') THEN
        RAISE EXCEPTION 'Base table "tracks" not found. Please ensure main schema is applied first.';
    END IF;
    
    -- Check for edges table
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'musicdb' AND table_name = 'edges') THEN
        RAISE EXCEPTION 'Base table "edges" not found. Please ensure graph schema is applied first.';
    END IF;
    
    RAISE NOTICE 'Base schema compatibility validated successfully';
END $$;

-- ========================================================
-- 2. ENHANCED FOREIGN KEY CONSTRAINTS
-- ========================================================

-- Ensure proper referential integrity between new and existing tables
-- (The constraints are already defined in the main migration, this validates them)

-- Validate that all nodes referenced in visualization_metadata exist
DO $$
DECLARE
    orphaned_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO orphaned_count
    FROM visualization_metadata vm
    LEFT JOIN nodes n ON vm.node_id = n.id
    WHERE n.id IS NULL;
    
    IF orphaned_count > 0 THEN
        RAISE EXCEPTION 'Found % orphaned visualization_metadata records', orphaned_count;
    END IF;
    
    RAISE NOTICE 'Foreign key integrity validated successfully';
END $$;

-- ========================================================
-- 3. DATA CONSISTENCY CHECKS
-- ========================================================

-- Create function to validate data consistency
CREATE OR REPLACE FUNCTION validate_visualization_data_consistency()
RETURNS TABLE(
    check_name VARCHAR,
    status VARCHAR,
    issues_found INTEGER,
    description TEXT
) AS $$
BEGIN
    -- Check for duplicate node positions within same layout
    RETURN QUERY
    SELECT 
        'duplicate_positions'::VARCHAR as check_name,
        CASE 
            WHEN COUNT(*) > 0 THEN 'FAIL'::VARCHAR
            ELSE 'PASS'::VARCHAR
        END as status,
        COUNT(*)::INTEGER as issues_found,
        'Nodes with identical positions in same layout'::TEXT as description
    FROM (
        SELECT vm1.node_id, vm1.layout_algorithm, vm1.layout_version
        FROM visualization_metadata vm1
        JOIN visualization_metadata vm2 ON (
            vm1.x = vm2.x AND 
            vm1.y = vm2.y AND 
            vm1.layout_algorithm = vm2.layout_algorithm AND
            vm1.layout_version = vm2.layout_version AND
            vm1.node_id != vm2.node_id
        )
    ) duplicates;
    
    -- Check for invalid centrality scores
    RETURN QUERY
    SELECT 
        'invalid_centrality'::VARCHAR as check_name,
        CASE 
            WHEN COUNT(*) > 0 THEN 'FAIL'::VARCHAR
            ELSE 'PASS'::VARCHAR
        END as status,
        COUNT(*)::INTEGER as issues_found,
        'Centrality scores outside valid range [0,1]'::TEXT as description
    FROM visualization_metadata 
    WHERE centrality_score < 0.0 OR centrality_score > 1.0;
    
    -- Check for nodes without corresponding tracks
    RETURN QUERY
    SELECT 
        'missing_tracks'::VARCHAR as check_name,
        CASE 
            WHEN COUNT(*) > 0 THEN 'FAIL'::VARCHAR
            ELSE 'PASS'::VARCHAR
        END as status,
        COUNT(*)::INTEGER as issues_found,
        'Nodes without corresponding track records'::TEXT as description
    FROM nodes n
    LEFT JOIN tracks t ON n.track_id = t.id
    WHERE t.id IS NULL;
    
    -- Check for invalid color codes
    RETURN QUERY
    SELECT 
        'invalid_colors'::VARCHAR as check_name,
        CASE 
            WHEN COUNT(*) > 0 THEN 'FAIL'::VARCHAR
            ELSE 'PASS'::VARCHAR
        END as status,
        COUNT(*)::INTEGER as issues_found,
        'Invalid hex color codes'::TEXT as description
    FROM visualization_metadata 
    WHERE node_color !~ '^#[0-9A-Fa-f]{6}$';
    
END;
$$ LANGUAGE plpgsql;

-- ========================================================
-- 4. PERFORMANCE VALIDATION FUNCTIONS
-- ========================================================

-- Function to test spatial query performance
CREATE OR REPLACE FUNCTION test_spatial_query_performance(
    test_iterations INTEGER DEFAULT 100
) RETURNS TABLE(
    query_type VARCHAR,
    avg_execution_time_ms FLOAT,
    max_execution_time_ms INTEGER,
    min_execution_time_ms INTEGER,
    success_rate FLOAT
) AS $$
DECLARE
    i INTEGER;
    start_time TIMESTAMP;
    end_time TIMESTAMP;
    execution_time INTEGER;
    success_count INTEGER := 0;
    total_time INTEGER := 0;
    min_time INTEGER := 999999;
    max_time INTEGER := 0;
BEGIN
    -- Test viewport queries
    FOR i IN 1..test_iterations LOOP
        BEGIN
            start_time := clock_timestamp();
            
            PERFORM COUNT(*) FROM get_nodes_in_viewport(
                (random() * 1000)::FLOAT,  -- min_x
                (random() * 1000)::FLOAT,  -- min_y
                (random() * 1000 + 1000)::FLOAT,  -- max_x
                (random() * 1000 + 1000)::FLOAT,  -- max_y
                'force_directed',
                1,
                100
            );
            
            end_time := clock_timestamp();
            execution_time := EXTRACT(MILLISECONDS FROM (end_time - start_time))::INTEGER;
            
            total_time := total_time + execution_time;
            min_time := LEAST(min_time, execution_time);
            max_time := GREATEST(max_time, execution_time);
            success_count := success_count + 1;
            
        EXCEPTION WHEN OTHERS THEN
            -- Query failed, continue
            NULL;
        END;
    END LOOP;
    
    RETURN QUERY
    SELECT 
        'viewport_queries'::VARCHAR as query_type,
        (total_time::FLOAT / NULLIF(success_count, 0)) as avg_execution_time_ms,
        max_time as max_execution_time_ms,
        CASE WHEN success_count > 0 THEN min_time ELSE 0 END as min_execution_time_ms,
        (success_count::FLOAT / test_iterations) as success_rate;
END;
$$ LANGUAGE plpgsql;

-- ========================================================
-- 5. MIGRATION VALIDATION REPORT
-- ========================================================

-- Create table to store validation results
CREATE TABLE IF NOT EXISTS migration_validation_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    migration_version VARCHAR(255) NOT NULL,
    validation_type VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL,
    issues_found INTEGER DEFAULT 0,
    execution_time_ms INTEGER,
    details JSONB DEFAULT '{}'::JSONB,
    validated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_migration_validation_results_migration 
    ON migration_validation_results(migration_version);

CREATE INDEX IF NOT EXISTS idx_migration_validation_results_status 
    ON migration_validation_results(status);

-- Function to run all validation checks
CREATE OR REPLACE FUNCTION run_migration_validation(
    migration_version VARCHAR(255)
) RETURNS VOID AS $$
DECLARE
    start_time TIMESTAMP;
    end_time TIMESTAMP;
    check_result RECORD;
    perf_result RECORD;
BEGIN
    start_time := clock_timestamp();
    
    -- Clear previous validation results for this migration
    DELETE FROM migration_validation_results 
    WHERE migration_version = run_migration_validation.migration_version;
    
    -- Run data consistency checks
    FOR check_result IN SELECT * FROM validate_visualization_data_consistency() LOOP
        INSERT INTO migration_validation_results (
            migration_version,
            validation_type,
            status,
            issues_found,
            execution_time_ms,
            details
        ) VALUES (
            run_migration_validation.migration_version,
            check_result.check_name,
            check_result.status,
            check_result.issues_found,
            0,  -- Individual check time not measured
            jsonb_build_object('description', check_result.description)
        );
    END LOOP;
    
    -- Run performance validation if spatial functions exist
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_nodes_in_viewport') THEN
        FOR perf_result IN SELECT * FROM test_spatial_query_performance(10) LOOP
            INSERT INTO migration_validation_results (
                migration_version,
                validation_type,
                status,
                issues_found,
                execution_time_ms,
                details
            ) VALUES (
                run_migration_validation.migration_version,
                perf_result.query_type,
                CASE 
                    WHEN perf_result.success_rate >= 0.95 AND perf_result.avg_execution_time_ms < 100 
                    THEN 'PASS' 
                    ELSE 'WARN' 
                END,
                0,
                perf_result.avg_execution_time_ms::INTEGER,
                jsonb_build_object(
                    'avg_time_ms', perf_result.avg_execution_time_ms,
                    'max_time_ms', perf_result.max_execution_time_ms,
                    'min_time_ms', perf_result.min_execution_time_ms,
                    'success_rate', perf_result.success_rate
                )
            );
        END LOOP;
    END IF;
    
    end_time := clock_timestamp();
    
    -- Log overall validation completion
    INSERT INTO migration_validation_results (
        migration_version,
        validation_type,
        status,
        execution_time_ms,
        details
    ) VALUES (
        run_migration_validation.migration_version,
        'validation_complete',
        'PASS',
        EXTRACT(MILLISECONDS FROM (end_time - start_time))::INTEGER,
        jsonb_build_object(
            'total_checks', (
                SELECT COUNT(*) 
                FROM migration_validation_results 
                WHERE migration_version = run_migration_validation.migration_version
            ),
            'validation_timestamp', NOW()
        )
    );
END;
$$ LANGUAGE plpgsql;

-- ========================================================
-- 6. AUTOMATIC INDEX ANALYSIS
-- ========================================================

-- Function to analyze index usage and effectiveness
CREATE OR REPLACE FUNCTION analyze_visualization_indexes()
RETURNS TABLE(
    index_name VARCHAR,
    table_name VARCHAR,
    index_size TEXT,
    index_scans BIGINT,
    tuples_read BIGINT,
    tuples_fetched BIGINT,
    effectiveness_score FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        i.indexname::VARCHAR as index_name,
        i.tablename::VARCHAR as table_name,
        pg_size_pretty(pg_relation_size(i.schemaname||'.'||i.indexname)) as index_size,
        s.idx_scan as index_scans,
        s.idx_tup_read as tuples_read,
        s.idx_tup_fetch as tuples_fetched,
        CASE 
            WHEN s.idx_scan > 0 THEN (s.idx_tup_fetch::FLOAT / s.idx_scan)
            ELSE 0.0
        END as effectiveness_score
    FROM pg_indexes i
    JOIN pg_stat_user_indexes s ON (
        i.schemaname = s.schemaname AND 
        i.indexname = s.indexname
    )
    WHERE i.schemaname = 'musicdb'
      AND (
          i.tablename IN ('visualization_metadata', 'graph_layouts', 'user_preferences') OR
          i.indexname LIKE '%spatial%'
      )
    ORDER BY s.idx_scan DESC, effectiveness_score DESC;
END;
$$ LANGUAGE plpgsql;

-- ========================================================
-- 7. RUN VALIDATION ON THIS MIGRATION
-- ========================================================

-- Run validation checks for this migration
SELECT run_migration_validation('003_compatibility_validation');

-- ========================================================
-- 8. PERMISSIONS
-- ========================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON migration_validation_results TO musicdb_app;
GRANT SELECT ON migration_validation_results TO musicdb_readonly;

GRANT EXECUTE ON FUNCTION validate_visualization_data_consistency() TO musicdb_app;
GRANT EXECUTE ON FUNCTION test_spatial_query_performance(INTEGER) TO musicdb_app;
GRANT EXECUTE ON FUNCTION run_migration_validation(VARCHAR) TO musicdb_app;
GRANT EXECUTE ON FUNCTION analyze_visualization_indexes() TO musicdb_app;

COMMIT;

-- ========================================================
-- MIGRATION COMPLETION LOG
-- ========================================================
INSERT INTO schema_migrations (version, applied_at, description) 
VALUES ('003_compatibility_validation', NOW(), 'Schema compatibility validation and testing framework')
ON CONFLICT (version) DO NOTHING;

-- Display validation results
DO $$
DECLARE
    result_summary TEXT;
BEGIN
    SELECT string_agg(
        validation_type || ': ' || status || 
        CASE WHEN issues_found > 0 THEN ' (' || issues_found || ' issues)' ELSE '' END,
        E'\n'
    ) INTO result_summary
    FROM migration_validation_results 
    WHERE migration_version = '003_compatibility_validation'
    AND validation_type != 'validation_complete';
    
    RAISE NOTICE E'Migration Validation Results:\n%', COALESCE(result_summary, 'No validation results found');
END $$;