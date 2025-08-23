# SongNodes Database Migrations

This directory contains PostgreSQL database migration scripts for the SongNodes visualization metadata extensions.

## Overview

The migration system adds comprehensive visualization metadata capabilities to the existing SongNodes database schema, including:

- **Node positioning and layout management**
- **Clustering and community detection**
- **User preferences and collaborative features**
- **Spatial indexing for high-performance queries**
- **Validation and performance monitoring**

## Migration Structure

### Core Migrations

1. **`000_schema_migrations`** - Migration tracking table
2. **`001_visualization_metadata`** - Core visualization tables and indexes
3. **`002_spatial_optimization`** - Advanced spatial indexing and performance functions
4. **`003_compatibility_validation`** - Schema validation and testing framework

### Files

- `*_up.sql` - Forward migration scripts
- `*_down.sql` - Rollback scripts
- `run_migrations.py` - Python migration runner with safety checks

## Tables Added

### visualization_metadata
Stores node positions, clustering, and centrality data:
- Position coordinates (x, y, z)
- Cluster and community assignments
- Centrality measures (betweenness, closeness, eigenvector, PageRank)
- Visual properties (size, color, opacity)
- Layout algorithm information

### graph_layouts
Precomputed layout configurations:
- Layout parameters and metadata
- Performance metrics (computation time, quality scores)
- Usage tracking and validation status
- Spatial bounds information

### user_preferences
User-specific visualization preferences:
- Layout and visual preferences
- Interaction settings (zoom, pan sensitivity)
- Collaborative features (sharing, permissions)
- Saved views and bookmarks

## Key Features

### Spatial Indexing
- **GiST indexes** for efficient spatial queries
- **Viewport-based queries** for rendering optimization
- **Level-of-detail (LOD)** support for zoom-based rendering
- **Nearest neighbor search** with distance filtering

### Performance Optimization
- **Materialized views** for popular clusters and layouts
- **Query performance tracking** with execution time monitoring
- **Spatial grid aggregation** for large dataset handling
- **Automatic statistics updates** and index maintenance

### Data Validation
- **Foreign key integrity** checks
- **Data consistency validation** (duplicate positions, invalid values)
- **Performance benchmarking** with configurable test iterations
- **Index effectiveness analysis**

## Usage

### Prerequisites

1. **PostgreSQL 13+** with required extensions:
   ```sql
   CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
   CREATE EXTENSION IF NOT EXISTS "postgis";
   CREATE EXTENSION IF NOT EXISTS "btree_gin";
   CREATE EXTENSION IF NOT EXISTS "pg_trgm";
   ```

2. **Python 3.8+** with psycopg2:
   ```bash
   pip install psycopg2-binary
   ```

3. **Existing SongNodes schema** (01-schema.sql, 04-graph-schema.sql)

### Running Migrations

#### Forward Migration (Apply All)
```bash
python run_migrations.py up --host localhost --database musicdb --user musicdb_app
```

#### Forward Migration (To Specific Version)
```bash
python run_migrations.py up --version 002_spatial_optimization --host localhost --database musicdb --user musicdb_app
```

#### Rollback Migration
```bash
python run_migrations.py down --version 001_visualization_metadata --host localhost --database musicdb --user musicdb_app
```

#### Check Status
```bash
python run_migrations.py status --host localhost --database musicdb --user musicdb_app
```

#### Validate Migrations
```bash
python run_migrations.py validate --host localhost --database musicdb --user musicdb_app
```

### Environment Variables

Set database password via environment variable:
```bash
export DB_PASSWORD="your_password"
python run_migrations.py up --host localhost --database musicdb --user musicdb_app
```

### Docker Usage

If running in Docker environment:
```bash
# Connect to database container
docker exec -it songNodes-postgres-1 bash

# Run migrations
python /path/to/migrations/run_migrations.py up \
  --host localhost \
  --database musicdb \
  --user musicdb_app \
  --password your_password
```

## API Functions

### Spatial Queries

#### Get Nodes in Viewport
```sql
SELECT * FROM get_nodes_in_viewport(
    min_x := 0.0,
    min_y := 0.0, 
    max_x := 1000.0,
    max_y := 1000.0,
    layout_algorithm := 'force_directed',
    layout_version := 1,
    max_nodes := 1000
);
```

#### Nearest Neighbor Search
```sql
SELECT * FROM get_nearest_nodes(
    center_x := 500.0,
    center_y := 500.0,
    max_distance := 100.0,
    max_nodes := 50,
    layout_algorithm := 'force_directed',
    layout_version := 1
);
```

#### Level-of-Detail Viewport Query
```sql
SELECT * FROM get_viewport_nodes_lod(
    min_x := 0.0,
    min_y := 0.0,
    max_x := 1000.0,
    max_y := 1000.0,
    zoom_level := 1.5,
    layout_algorithm := 'force_directed',
    layout_version := 1
);
```

### Analytics Functions

#### Cluster Statistics
```sql
SELECT * FROM get_cluster_statistics(
    layout_algorithm := 'force_directed',
    layout_version := 1
);
```

#### Spatial Cluster Analysis
```sql
SELECT * FROM analyze_spatial_clusters(
    layout_algorithm := 'force_directed',
    layout_version := 1,
    cluster_threshold := 50.0
);
```

### User Preferences

#### Update User Preferences
```sql
SELECT update_user_preferences(
    user_id := 'user123',
    preferences_data := '{
        "node_size_multiplier": 1.2,
        "edge_opacity": 0.8,
        "color_scheme": "dark",
        "max_visible_nodes": 1500
    }'::JSONB
);
```

## Performance Considerations

### Recommended Settings

For optimal performance with large datasets:

```sql
-- Connection pooling (pgbouncer recommended)
-- Parallel query execution
SET max_parallel_workers_per_gather = 4;

-- Memory settings
SET work_mem = '256MB';
SET maintenance_work_mem = '512MB';
SET effective_cache_size = '4GB';
SET shared_buffers = '1GB';
```

### Index Maintenance

The system includes automatic index maintenance functions:

```sql
-- Update spatial statistics
SELECT update_spatial_statistics();

-- Maintain spatial indexes
SELECT maintain_spatial_indexes();

-- Analyze index effectiveness
SELECT * FROM analyze_visualization_indexes();
```

### Query Performance Monitoring

All spatial queries are tracked in `spatial_query_performance` table:

```sql
-- View recent query performance
SELECT 
    query_type,
    AVG(execution_time_ms) as avg_time,
    COUNT(*) as query_count
FROM spatial_query_performance 
WHERE query_timestamp > NOW() - INTERVAL '1 hour'
GROUP BY query_type
ORDER BY avg_time DESC;
```

## Troubleshooting

### Common Issues

1. **PostGIS Extension Missing**
   ```sql
   CREATE EXTENSION IF NOT EXISTS "postgis";
   ```

2. **Insufficient Permissions**
   ```sql
   GRANT ALL ON SCHEMA musicdb TO musicdb_app;
   ```

3. **Index Creation Timeout**
   - Indexes are created with `CONCURRENTLY` to avoid blocking
   - For large datasets, consider running during maintenance windows

4. **Migration Checksum Mismatch**
   ```bash
   python run_migrations.py validate
   ```

### Performance Issues

1. **Slow Spatial Queries**
   - Check index usage: `SELECT * FROM analyze_visualization_indexes();`
   - Update statistics: `SELECT update_spatial_statistics();`
   - Consider increasing `work_mem` for complex queries

2. **High Memory Usage**
   - Reduce `max_visible_nodes` in user preferences
   - Implement client-side viewport culling
   - Use level-of-detail functions for large datasets

### Data Consistency

Run validation checks:
```sql
-- Check data consistency
SELECT * FROM validate_visualization_data_consistency();

-- Run full migration validation
SELECT run_migration_validation('001_visualization_metadata');
```

## Security

### Permissions

The migration system follows principle of least privilege:

- **`musicdb_app`**: Full read/write access to visualization tables
- **`musicdb_readonly`**: Read-only access for analytics and reporting
- **Function execution**: Limited to necessary operations only

### Data Privacy

User preferences support privacy controls:
- `is_public` flag for sharing preferences
- `shared_with` array for selective sharing
- `collaboration_permissions` for fine-grained access control

## Monitoring

### Health Checks

```sql
-- Check system health
SELECT 
    'visualization_metadata' as table_name,
    COUNT(*) as row_count,
    pg_size_pretty(pg_relation_size('musicdb.visualization_metadata')) as size
FROM visualization_metadata
UNION ALL
SELECT 
    'graph_layouts',
    COUNT(*),
    pg_size_pretty(pg_relation_size('musicdb.graph_layouts'))
FROM graph_layouts;
```

### Performance Metrics

```sql
-- Query performance summary
SELECT 
    query_type,
    COUNT(*) as total_queries,
    AVG(execution_time_ms) as avg_time_ms,
    MAX(execution_time_ms) as max_time_ms,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY execution_time_ms) as p95_time_ms
FROM spatial_query_performance
WHERE query_timestamp > NOW() - INTERVAL '24 hours'
GROUP BY query_type
ORDER BY avg_time_ms DESC;
```

## Contributing

### Adding New Migrations

1. Create numbered migration files:
   ```
   004_your_feature_up.sql
   004_your_feature_down.sql
   ```

2. Follow existing patterns:
   - Use transactions (BEGIN/COMMIT)
   - Add proper error handling
   - Include rollback scripts
   - Document all changes

3. Test thoroughly:
   ```bash
   # Test forward migration
   python run_migrations.py up --version 004_your_feature
   
   # Test rollback
   python run_migrations.py down --version 003_compatibility_validation
   
   # Validate
   python run_migrations.py validate
   ```

### Code Style

- Use descriptive function and table names
- Include comprehensive comments
- Follow PostgreSQL naming conventions
- Add appropriate indexes for new queries
- Consider performance impact of new features

## Support

For issues and questions:
1. Check troubleshooting section above
2. Review migration validation results
3. Check PostgreSQL logs for detailed error messages
4. Ensure all prerequisites are met

## License

Part of the SongNodes project. See main project LICENSE for details.