# Serato Integration

Extract BPM, key, and other metadata from Serato Pro-analyzed audio files.

## Overview

This integration extracts DJ-grade metadata directly from audio files that have been analyzed by Serato DJ Pro. Serato stores metadata in ID3 GEOB tags within your music files, including:

- **BPM**: Sub-beat accurate BPM from Serato's beatgrid analysis
- **Key**: Musical key detection (Camelot notation + full key names)
- **Auto-Gain**: Recommended volume adjustment for consistent playback
- **Beatgrid**: Detailed beatgrid markers for precise BPM mapping
- **Cue Points**: DJ performance markers with colors and labels
- **Loops**: Saved loop markers for creative mixing

## Architecture

```
Audio File (with Serato tags)
    ↓
SeratoFileParser
    ↓ Extract ID3 GEOB tags
SeratoTrackMetadata
    ↓
Database (tracks table)
```

### Two Usage Modes

1. **Batch Import**: Scan your entire music library and import all Serato metadata at once
2. **Real-Time Enrichment**: Extract Serato metadata during track enrichment (if file_path provided)

## Prerequisites

1. **Serato DJ Pro**: You must have analyzed your tracks with Serato Pro
2. **File Access**: The service needs read access to your music library
3. **Database Migration**: Run migration 009 to add Serato metadata fields

### Apply Database Migration

```bash
# Apply the Serato metadata fields migration
cat sql/migrations/009_serato_metadata_fields_up.sql | docker compose exec -T postgres psql -U musicdb_user -d musicdb
```

## Usage

### 1. Batch Import (Recommended)

Scan your entire music library and import all Serato metadata:

```bash
# Dry run (test without database changes)
docker compose run --rm serato-integration python batch_import.py \
  --music-dir /path/to/music \
  --limit 100 \
  --dry-run

# Full import (all files)
docker compose run --rm serato-integration python batch_import.py \
  --music-dir /path/to/music

# Import with limit (for testing)
docker compose run --rm serato-integration python batch_import.py \
  --music-dir /path/to/music \
  --limit 1000
```

**Important**: Update `docker-compose.yml` to mount your music directory:

```yaml
serato-integration:
  volumes:
    - /path/to/your/music:/music:ro  # Uncomment and set your music path
```

### 2. Real-Time Enrichment

The enrichment pipeline automatically extracts Serato metadata when a `file_path` is provided:

```bash
# Enrich track with file_path
curl -X POST http://localhost:8022/enrich \
  -H "Content-Type: application/json" \
  -d '{
    "track_id": "550e8400-e29b-41d4-a716-446655440001",
    "artist_name": "Deadmau5",
    "track_title": "Strobe",
    "file_path": "/music/Deadmau5/For Lack of a Better Name/Strobe.mp3"
  }'
```

## Configuration

### Docker Compose

```yaml
serato-integration:
  build:
    context: ./services/serato-integration
  environment:
    DATABASE_URL: postgresql+asyncpg://...
    POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
  volumes:
    - /path/to/music:/music:ro  # Mount your music library
  depends_on:
    - postgres
    - db-connection-pool
  networks:
    - musicdb-backend
  profiles:
    - tools  # Optional - only starts when explicitly requested
```

### Batch Import Options

```
--music-dir PATH       Root directory of music library to scan (required)
--serato-dir PATH      Serato library directory (future use)
--limit N              Maximum number of files to process (for testing)
--dry-run              Scan files but do not update database
--db-host HOST         Database host (default: localhost)
--db-port PORT         Database port (default: 5433)
--db-name NAME         Database name (default: musicdb)
--db-user USER         Database user (default: musicdb_user)
--db-password PASS     Database password
```

## Database Schema

The migration adds the following columns to the `tracks` table:

```sql
-- Serato metadata columns
serato_bpm NUMERIC(6,2)              -- DJ-grade BPM detection
serato_key VARCHAR(50)               -- Musical key (e.g., "A Minor")
serato_key_text VARCHAR(10)          -- Camelot notation (e.g., "8A")
serato_auto_gain NUMERIC(6,2)        -- Auto-gain in dB (-60 to +60)
serato_beatgrid JSONB                -- Beatgrid markers
serato_cues JSONB                    -- Cue points array
serato_loops JSONB                   -- Loop markers array
serato_analyzed_at TIMESTAMP         -- When Serato analyzed the track
```

### Query Examples

```sql
-- Find all tracks with Serato data
SELECT track_id, artist_name, track_name, serato_bpm, serato_key_text
FROM tracks
WHERE serato_analyzed_at IS NOT NULL;

-- Check Serato coverage
SELECT * FROM serato_enrichment_coverage;

-- Find tracks needing Serato analysis
SELECT * FROM find_tracks_needing_serato_analysis(100);

-- Compare BPM sources (Serato vs Spotify)
SELECT * FROM compare_bpm_sources('550e8400-e29b-41d4-a716-446655440001');

-- Find tracks with BPM mismatch (> 2 BPM difference)
SELECT
  track_id,
  artist_name,
  track_name,
  bpm as spotify_bpm,
  serato_bpm,
  ABS(bpm - serato_bpm) as bpm_diff
FROM tracks
WHERE serato_bpm IS NOT NULL
AND bpm IS NOT NULL
AND ABS(bpm - serato_bpm) > 2.0
ORDER BY bpm_diff DESC;
```

## JSONB Data Formats

### Beatgrid

```json
{
  "markers": [
    {"position": 0.5, "beat_number": 1},
    {"position": 1.0, "beat_number": 2}
  ],
  "bpm": 128.0,
  "terminal_count": 1,
  "non_terminal_count": 128
}
```

### Cue Points

```json
[
  {
    "position_ms": 1000,
    "color": "#FF0000",
    "label": "Drop"
  },
  {
    "position_ms": 30000,
    "color": "#00FF00",
    "label": "Break"
  }
]
```

### Loops

```json
[
  {
    "start_ms": 1000,
    "end_ms": 5000,
    "color": "#0000FF",
    "label": "Intro Loop"
  }
]
```

## Integration with Enrichment Pipeline

Serato enrichment runs as **Step 0.05** in the waterfall pipeline:

```python
# Enrichment order:
0.    Title parsing and normalization
0.05  Serato file-based extraction (NEW)
0.1   ISRC availability check
0.5   Fuzzy matching for Unknown artists
1.    Spotify enrichment
2.    Tidal enrichment
3.    MusicBrainz enrichment
...
```

### Why Serato is Step 0.05

- **Fast**: Local file read, no API calls
- **Accurate**: DJ-grade analysis, often more accurate than algorithmic detection
- **Independent**: Doesn't depend on external APIs or identifiers

## Monitoring

### Coverage Statistics

```bash
# Check Serato enrichment coverage
docker compose exec -T postgres psql -U musicdb_user -d musicdb -c \
  "SELECT * FROM serato_enrichment_coverage;"
```

Output:
```
 total_tracks | with_serato_bpm | with_serato_key | serato_coverage_pct | bpm_mismatch_pct
--------------+-----------------+-----------------+---------------------+------------------
        15137 |            2500 |            2500 |               16.52 |             8.40
```

### Batch Import Statistics

The batch import script outputs detailed statistics:

```
============================================================
SERATO BATCH IMPORT SUMMARY
============================================================
Files scanned:        15137
Files with Serato:    2500
Tracks updated:       2450
Tracks created:       50
Errors:               0
Skipped:              0
Elapsed time:         125.45 seconds
Processing rate:      120.67 files/sec
============================================================
```

## Troubleshooting

### No Serato data found

**Cause**: Files haven't been analyzed by Serato Pro

**Solution**: Open the tracks in Serato DJ Pro and let it analyze them. Serato automatically analyzes tracks when you load them.

### File not found

**Cause**: file_path in database doesn't match actual file location

**Solution**:
1. Check volume mounts in docker-compose.yml
2. Update file_path in database if files were moved
3. Use absolute paths matching Docker volume mounts

### Import errors

**Cause**: Corrupted ID3 tags or unsupported file format

**Solution**: Check logs for specific files and re-analyze in Serato Pro

### Permission denied

**Cause**: Docker container doesn't have read access to music files

**Solution**:
1. Check volume mount permissions in docker-compose.yml
2. Ensure files are readable: `chmod -R a+r /path/to/music`

## Performance

- **Scan rate**: ~120-150 files/sec (depends on storage speed)
- **Memory usage**: ~512MB for typical libraries
- **CPU usage**: Single-threaded, ~0.5-1.0 CPU cores
- **Database updates**: Batched for efficiency

## Best Practices

1. **Initial Import**: Run batch import once after setting up Serato integration
2. **Regular Updates**: Re-run batch import periodically (weekly/monthly) to catch newly analyzed tracks
3. **Dry Run First**: Always test with `--dry-run` before full import
4. **Limit Testing**: Use `--limit 100` to test on a small subset first
5. **Monitor Coverage**: Check serato_enrichment_coverage view regularly
6. **Compare Sources**: Use compare_bpm_sources() to verify accuracy

## Future Enhancements

- [ ] Serato database V2 parsing (currently uses file tags only)
- [ ] Automatic re-import when Serato analysis timestamp changes
- [ ] Serato playlist import
- [ ] Serato crate/folder structure import
- [ ] Smart crate recommendations based on Serato usage

## Related Documentation

- [Metadata Enrichment Pipeline](../metadata-enrichment/README.md)
- [Database Schema](../../sql/migrations/009_serato_metadata_fields_up.sql)
- [Tidal Integration](../metadata-enrichment/README.md#tidal-integration)
