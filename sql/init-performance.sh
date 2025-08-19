#!/bin/bash

# Database Performance Initialization Script
# Configures PostgreSQL for high-volume music data processing

set -e

echo "Initializing PostgreSQL performance configuration..."

# Database connection parameters
DB_HOST=${POSTGRES_HOST:-localhost}
DB_PORT=${POSTGRES_PORT:-5432}
DB_NAME=${POSTGRES_DB:-musicdb}
DB_USER=${POSTGRES_USER:-musicdb_user}
DB_PASSWORD=${POSTGRES_PASSWORD:-musicdb_secure_pass}

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to be available..."
until PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c '\q' 2>/dev/null; do
    echo "PostgreSQL is unavailable - sleeping"
    sleep 2
done

echo "PostgreSQL is ready!"

# Apply performance optimizations
echo "Applying performance optimizations..."

PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME << 'EOF'

-- Enable required extensions if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS btree_gin;

-- Configure performance settings
ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';
ALTER SYSTEM SET track_activities = on;
ALTER SYSTEM SET track_counts = on;
ALTER SYSTEM SET track_io_timing = on;
ALTER SYSTEM SET track_functions = all;

-- Memory configuration
ALTER SYSTEM SET shared_buffers = '2GB';
ALTER SYSTEM SET work_mem = '32MB';
ALTER SYSTEM SET maintenance_work_mem = '512MB';
ALTER SYSTEM SET effective_cache_size = '6GB';

-- WAL configuration
ALTER SYSTEM SET wal_buffers = '64MB';
ALTER SYSTEM SET max_wal_size = '4GB';
ALTER SYSTEM SET min_wal_size = '1GB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;

-- Connection configuration
ALTER SYSTEM SET max_connections = 200;

-- Autovacuum optimization
ALTER SYSTEM SET autovacuum = on;
ALTER SYSTEM SET autovacuum_max_workers = 6;
ALTER SYSTEM SET autovacuum_naptime = '30s';
ALTER SYSTEM SET autovacuum_vacuum_threshold = 50;
ALTER SYSTEM SET autovacuum_vacuum_scale_factor = 0.1;
ALTER SYSTEM SET autovacuum_analyze_threshold = 50;
ALTER SYSTEM SET autovacuum_analyze_scale_factor = 0.05;

-- Parallel processing
ALTER SYSTEM SET max_parallel_workers = 8;
ALTER SYSTEM SET max_parallel_workers_per_gather = 4;
ALTER SYSTEM SET max_parallel_maintenance_workers = 4;

-- Query optimization
ALTER SYSTEM SET random_page_cost = 1.1;
ALTER SYSTEM SET seq_page_cost = 1.0;

-- Logging
ALTER SYSTEM SET log_min_duration_statement = 100;
ALTER SYSTEM SET log_statement = 'mod';
ALTER SYSTEM SET log_checkpoints = on;
ALTER SYSTEM SET log_lock_waits = on;

-- Reload configuration
SELECT pg_reload_conf();

EOF

echo "Performance configuration applied successfully!"

# Create performance monitoring functions
echo "Creating performance monitoring functions..."

PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME << 'EOF'

-- Function to check database performance metrics
CREATE OR REPLACE FUNCTION get_performance_metrics()
RETURNS TABLE (
    metric_name TEXT,
    metric_value NUMERIC,
    unit TEXT,
    status TEXT
) AS $$
BEGIN
    RETURN QUERY
    WITH metrics AS (
        SELECT 'active_connections' as name, 
               COUNT(*)::NUMERIC as value, 
               'connections' as unit,
               CASE WHEN COUNT(*) > 150 THEN 'WARNING' ELSE 'OK' END as status
        FROM pg_stat_activity WHERE state = 'active'
        
        UNION ALL
        
        SELECT 'avg_query_time_ms' as name,
               COALESCE(AVG(mean_exec_time), 0) as value,
               'milliseconds' as unit,
               CASE WHEN AVG(mean_exec_time) > 50 THEN 'WARNING' ELSE 'OK' END as status
        FROM pg_stat_statements
        WHERE calls > 10
        
        UNION ALL
        
        SELECT 'database_size_gb' as name,
               pg_database_size('musicdb')::NUMERIC / (1024*1024*1024) as value,
               'gigabytes' as unit,
               'INFO' as status
        
        UNION ALL
        
        SELECT 'cache_hit_ratio' as name,
               CASE WHEN (blks_hit + blks_read) > 0 
                    THEN (blks_hit::NUMERIC / (blks_hit + blks_read)) * 100 
                    ELSE 0 END as value,
               'percent' as unit,
               CASE WHEN (blks_hit::NUMERIC / NULLIF(blks_hit + blks_read, 0)) * 100 < 95 
                    THEN 'WARNING' ELSE 'OK' END as status
        FROM pg_stat_database WHERE datname = 'musicdb'
    )
    SELECT * FROM metrics;
END;
$$ LANGUAGE plpgsql;

-- Function to analyze slow queries
CREATE OR REPLACE FUNCTION get_slow_queries(limit_count INTEGER DEFAULT 10)
RETURNS TABLE (
    query_text TEXT,
    calls BIGINT,
    total_time_ms NUMERIC,
    mean_time_ms NUMERIC,
    rows_per_call NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        LEFT(query, 100) as query_text,
        calls,
        total_exec_time as total_time_ms,
        mean_exec_time as mean_time_ms,
        CASE WHEN calls > 0 THEN rows::NUMERIC / calls ELSE 0 END as rows_per_call
    FROM pg_stat_statements
    WHERE calls > 5
    ORDER BY mean_exec_time DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Function to check index usage
CREATE OR REPLACE FUNCTION get_index_usage()
RETURNS TABLE (
    schemaname TEXT,
    tablename TEXT,
    indexname TEXT,
    idx_scan BIGINT,
    usage_ratio NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.schemaname,
        s.tablename,
        s.indexname,
        s.idx_scan,
        CASE 
            WHEN s.idx_scan = 0 THEN 0 
            ELSE ROUND((s.idx_tup_fetch::NUMERIC / NULLIF(s.idx_scan, 0)), 2) 
        END as usage_ratio
    FROM pg_stat_user_indexes s
    WHERE s.schemaname = 'musicdb'
    ORDER BY s.idx_scan DESC;
END;
$$ LANGUAGE plpgsql;

-- Create materialized view for performance dashboard
CREATE MATERIALIZED VIEW IF NOT EXISTS performance_dashboard AS
SELECT 
    'connections' as metric_type,
    COUNT(*)::NUMERIC as current_value,
    200::NUMERIC as max_value,
    (COUNT(*)::NUMERIC / 200) * 100 as utilization_percent,
    CURRENT_TIMESTAMP as last_updated
FROM pg_stat_activity WHERE state = 'active'

UNION ALL

SELECT 
    'cache_hit_ratio' as metric_type,
    CASE WHEN (blks_hit + blks_read) > 0 
         THEN (blks_hit::NUMERIC / (blks_hit + blks_read)) * 100 
         ELSE 0 END as current_value,
    100::NUMERIC as max_value,
    CASE WHEN (blks_hit + blks_read) > 0 
         THEN (blks_hit::NUMERIC / (blks_hit + blks_read)) * 100 
         ELSE 0 END as utilization_percent,
    CURRENT_TIMESTAMP as last_updated
FROM pg_stat_database WHERE datname = 'musicdb'

UNION ALL

SELECT 
    'database_size_mb' as metric_type,
    pg_database_size('musicdb')::NUMERIC / (1024*1024) as current_value,
    50000::NUMERIC as max_value,  -- 50GB limit
    (pg_database_size('musicdb')::NUMERIC / (1024*1024)) / 50000 * 100 as utilization_percent,
    CURRENT_TIMESTAMP as last_updated;

CREATE UNIQUE INDEX IF NOT EXISTS idx_performance_dashboard_metric 
ON performance_dashboard(metric_type);

EOF

echo "Performance monitoring functions created!"

# Test database performance
echo "Running basic performance test..."

PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME << 'EOF'

-- Test query performance
\timing on

-- Test 1: Simple select
SELECT 'Test 1: Simple select' as test_name;
SELECT COUNT(*) FROM tracks;

-- Test 2: Index usage
SELECT 'Test 2: Index-based query' as test_name;
SELECT * FROM tracks WHERE genre = 'Electronic' LIMIT 10;

-- Test 3: Join performance
SELECT 'Test 3: Join query' as test_name;
SELECT t.title, a.name 
FROM tracks t 
JOIN track_artists ta ON t.id = ta.track_id 
JOIN artists a ON ta.artist_id = a.id 
LIMIT 10;

-- Test 4: Full-text search
SELECT 'Test 4: Full-text search' as test_name;
SELECT title FROM tracks WHERE search_vector @@ plainto_tsquery('music') LIMIT 5;

\timing off

-- Show current performance metrics
SELECT 'Current Performance Metrics:' as info;
SELECT * FROM get_performance_metrics();

-- Show database size and table sizes
SELECT 'Database Size Information:' as info;
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
WHERE schemaname = 'musicdb'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 10;

EOF

echo "Performance initialization completed successfully!"
echo ""
echo "Summary:"
echo "- PostgreSQL performance configuration applied"
echo "- Monitoring functions created"
echo "- Basic performance tests executed"
echo ""
echo "Next steps:"
echo "1. Restart PostgreSQL to apply all configuration changes"
echo "2. Run comprehensive performance tests with: python3 sql/performance-test.py"
echo "3. Monitor performance metrics in Grafana dashboard"