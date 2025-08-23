# SongNodes Sample Data Populator

## Overview

The `populate_sample_data.py` script generates realistic sample music data for the SongNodes database, creating 100 music nodes (songs) and 500 weighted edges (relationships) with comprehensive metadata for performance testing and graph visualization.

## Features

- **Production-Ready**: Comprehensive error handling, logging, connection pooling
- **Realistic Data**: Generated music metadata including BPM, key, genre, audio features
- **Weighted Relationships**: Intelligent edge weighting based on musical similarity
- **Graph Optimization**: Creates appropriate indexes for graph traversal
- **Flexible Configuration**: Command-line arguments and environment variables
- **Statistics**: Comprehensive generation statistics and performance metrics

## Requirements

- Python 3.7+
- asyncpg
- PostgreSQL database with SongNodes schema
- Environment variable `POSTGRES_PASSWORD` (optional, has fallback)

## Installation

```bash
# Install dependencies
pip install asyncpg

# Make script executable
chmod +x populate_sample_data.py
```

## Usage

### Basic Usage

```bash
# Default: localhost:5432, database 'songnodes', user 'songnodes_user'
python populate_sample_data.py

# With password from environment
POSTGRES_PASSWORD=your_password python populate_sample_data.py
```

### Advanced Usage

```bash
# Custom database connection
python populate_sample_data.py --host postgres --port 5432 --database musicdb --user musicdb_user

# Clear existing sample data before generating new
python populate_sample_data.py --clear-existing

# Verbose logging
python populate_sample_data.py --verbose
```

### Docker Environment Usage

For the SongNodes Docker setup:

```bash
# Using default Docker configuration (port 5433 external, 5432 internal)
POSTGRES_PASSWORD=musicdb_secure_pass python populate_sample_data.py --port 5433 --database musicdb --user musicdb_user

# Using connection pool (recommended)
POSTGRES_PASSWORD=musicdb_secure_pass python populate_sample_data.py --host localhost --port 6433 --database musicdb --user musicdb_user
```

## Generated Data Structure

### Songs (100 nodes)
- **Metadata**: Title, BPM (110-140), musical key, genre, audio features
- **Attributes**: Energy, danceability, valence, duration, release date
- **IDs**: Spotify ID, ISRC, Apple Music ID (realistic simulation)

### Artists (40-60 nodes)
- **Names**: Realistic DJ/artist names with prefixes and combinations
- **Metadata**: Genre preferences, followers, country, active years
- **Relationships**: Multiple songs per artist for realistic distribution

### Relationships (500 edges)
- **Types**: Primary artist, featured artist, remixer, producer
- **Weights**: Based on musical similarity (BPM, key, genre compatibility)
- **Similarity Factors**:
  - BPM difference (±2 BPM = 0.9 similarity)
  - Musical key compatibility (perfect fifths, major/minor relationships)
  - Genre similarity (predefined genre relationship matrix)
  - Audio feature similarity (energy, danceability)

## Musical Realism

### BPM Distribution
- Range: 110-140 BPM (typical for electronic music)
- Weighted similarity: Songs with similar BPM get higher edge weights

### Key Compatibility
- 17 musical keys with major/minor modes
- Perfect fifth relationships (C→G, D→A, etc.) have high compatibility
- Same key = 1.0 similarity, related keys = 0.6-0.8

### Genre Relationships
```
Techno ↔ Tech House (0.8), Minimal Techno (0.9), Electro (0.7)
House ↔ Deep House (0.9), Tech House (0.8), Progressive House (0.8)
Trance ↔ Progressive Trance (0.9), Progressive House (0.7)
```

### Audio Features
- **Energy**: 0.3-1.0 (electronic music typically high energy)
- **Danceability**: 0.4-1.0 (dance music focus)
- **Valence**: 0.1-0.9 (full emotional range)
- **Acousticness**: 0.0-0.2 (electronic, not acoustic)
- **Instrumentalness**: 0.5-1.0 (often instrumental)

## Performance Optimizations

### Database Indexes
```sql
-- Graph traversal optimization
CREATE INDEX idx_sample_track_artists_graph ON track_artists (track_id, artist_id);

-- Similarity query optimization  
CREATE INDEX idx_sample_tracks_similarity ON tracks (genre, bpm, key);

-- Full-text search vectors updated
UPDATE tracks SET search_vector = to_tsvector('english', title);
```

### Connection Pooling
- Min connections: 5
- Max connections: 20
- Command timeout: 30 seconds
- Optimized for concurrent access

## Output Statistics

The script provides comprehensive statistics:

```
SAMPLE DATA GENERATION COMPLETED
============================================================
✓ Songs: 100
✓ Artists: 52  
✓ Relationships: 500
✓ Total Nodes: 152
✓ Node-Edge Ratio: 1:3.29
✓ Generation Time: 2.34 seconds

Top Genres:
  • Techno: 18 songs
  • House: 15 songs  
  • Progressive House: 12 songs
  • Trance: 11 songs
  • Deep House: 9 songs

BPM Range: 110.2 - 139.8
============================================================
```

## Testing

Run the test script to validate generated data:

```bash
python test_sample_data.py
```

Expected output:
```
✓ Connected to database
✓ Found 52 sample artists
✓ Found 100 sample tracks  
✓ Found 500 sample relationships
✓ Sample track: 'Euphoria Nights (Extended Mix)' (Progressive House, 128.5 BPM, Am)
✓ Track relationships: 2
  • DJ Solar Pulse (primary)
  • Digital Storm (featured)
✓ Test completed successfully
```

## Error Handling

### Common Issues

1. **Connection Failed**
   ```
   POSTGRES_PASSWORD=your_password python populate_sample_data.py
   ```

2. **Permission Denied**
   ```bash
   # Ensure user has CREATE privileges
   GRANT ALL ON SCHEMA musicdb TO songnodes_user;
   ```

3. **Schema Not Found**
   ```bash
   # Run schema initialization first
   docker-compose exec postgres psql -U musicdb_user -d musicdb -f /docker-entrypoint-initdb.d/01-schema.sql
   ```

### Logging

Logs are written to:
- Console (INFO level)
- `/tmp/populate_sample_data.log` (all levels)

Use `--verbose` for DEBUG level logging.

## Integration with SongNodes

This script is designed to work seamlessly with the SongNodes ecosystem:

1. **Graph Visualization**: Generated data optimized for D3.js force-directed graphs
2. **API Compatibility**: All data follows existing REST/GraphQL API schemas  
3. **Performance Testing**: 100+ nodes and 500+ edges ideal for performance benchmarks
4. **Monitoring**: Compatible with Prometheus/Grafana monitoring stack

## Development Notes

### Extending the Script

To add new data types:

1. **New Entity Types**: Add generation functions following the pattern
2. **New Relationships**: Extend the weighted relationship logic
3. **New Similarity Metrics**: Add to similarity calculation functions
4. **New Indexes**: Add to `create_graph_indexes()` function

### Musical Theory Integration

The script implements simplified music theory for realistic relationships:
- Circle of fifths for key compatibility
- Genre similarity matrices based on actual music relationships
- BPM ranges typical for electronic music subgenres
- Audio feature distributions matching real Spotify data patterns

This ensures the generated graph represents realistic musical relationships that would be found in actual music databases.