# Track Album Artwork Feature

## Overview

This feature adds support for freely available track imagery (album covers, single artwork, vinyl art) to the silver-to-gold medallion layer of the SongNodes data pipeline.

## Implementation

### Database Schema (Migration 011)

Three new columns added to `silver_enriched_tracks`:

- `album_artwork_small` - Small image URL (64x64 or similar) - suitable for thumbnails
- `album_artwork_medium` - Medium image URL (300x300 or similar) - suitable for lists
- `album_artwork_large` - Large image URL (640x640 or similar) - suitable for detail views

These columns are exposed through:
- `musicdb.tracks` view
- `public.tracks` view
- `graph_nodes` view (for graph visualization)

### Data Sources

Album artwork is automatically fetched during metadata enrichment from:

1. **Spotify** (primary source)
   - Provides 3 image sizes (typically 640x640, 300x300, 64x64)
   - High coverage for modern tracks
   - Free access via Spotify Web API

2. **Tidal** (secondary source)
   - Provides multiple image formats
   - Good coverage for Hi-Fi/lossless tracks
   - Requires Tidal API credentials

### Enrichment Pipeline Integration

The metadata enrichment pipeline (`services/metadata-enrichment/`) automatically:

1. Extracts album artwork URLs from Spotify/Tidal API responses
2. Stores URLs in the `album_artwork_*` columns during track enrichment
3. Falls back to smaller images if larger sizes are unavailable
4. Caches results for 7-30 days to minimize API calls

### API Client Updates

**Spotify Client** (`api_clients.py:_extract_track_metadata`):
```python
# Extracts album.images array from Spotify track response
# Maps to album_artwork_large/medium/small based on image dimensions
```

**Tidal Client** (`api_clients.py:_extract_track_metadata`):
```python
# Supports multiple Tidal image formats:
# - imageCover array
# - resource.images object
# - Cover URL with size parameters
```

### Monitoring

Track artwork coverage with the materialized view:

```sql
-- Refresh statistics
REFRESH MATERIALIZED VIEW album_artwork_coverage_stats;

-- Check coverage
SELECT
    total_tracks,
    with_any_artwork,
    artwork_coverage_pct,
    artwork_from_spotify,
    artwork_from_musicbrainz
FROM album_artwork_coverage_stats;
```

## Usage

### REST API

Album artwork URLs are automatically included in track API responses:

```json
{
  "id": "uuid",
  "title": "Track Title",
  "artist_name": "Artist Name",
  "album_artwork_small": "https://i.scdn.co/image/ab67616d00004851...",
  "album_artwork_medium": "https://i.scdn.co/image/ab67616d00001e02...",
  "album_artwork_large": "https://i.scdn.co/image/ab67616d0000b273...",
  ...
}
```

### Graph Visualization

The `graph_nodes` view includes artwork URLs for rendering album art on track nodes:

```sql
SELECT
    node_id,
    label,
    artist_name,
    album_artwork_large
FROM graph_nodes
WHERE node_type = 'song'
  AND album_artwork_large IS NOT NULL;
```

### Frontend Integration

```typescript
// Example: Display album artwork in track card
<img
  src={track.album_artwork_medium}
  srcSet={`
    ${track.album_artwork_small} 64w,
    ${track.album_artwork_medium} 300w,
    ${track.album_artwork_large} 640w
  `}
  sizes="(max-width: 640px) 300px, 640px"
  alt={`${track.artist_name} - ${track.title}`}
/>
```

## Migration Guide

### Running the Migration

```bash
# Apply migration
psql -U musicdb_user -d musicdb -f sql/migrations/011_add_track_album_artwork_up.sql

# Verify migration
psql -U musicdb_user -d musicdb -c "
  SELECT column_name
  FROM information_schema.columns
  WHERE table_name = 'silver_enriched_tracks'
    AND column_name LIKE 'album_artwork%';
"

# Check initial coverage
REFRESH MATERIALIZED VIEW album_artwork_coverage_stats;
SELECT * FROM album_artwork_coverage_stats;
```

### Rollback

```bash
# Rollback migration
psql -U musicdb_user -d musicdb -f sql/migrations/011_add_track_album_artwork_down.sql
```

## Performance Considerations

- **Storage**: URLs are typically 100-200 characters, minimal storage impact
- **API Calls**: Artwork URLs are fetched as part of existing enrichment calls (no additional API requests)
- **Caching**: Redis caches enrichment results including artwork URLs for 7-30 days
- **Bandwidth**: Images are hosted by Spotify/Tidal, no local storage or bandwidth consumption

## Future Enhancements

Potential improvements:

1. **MusicBrainz Cover Art Archive**: Add support for MusicBrainz's Cover Art Archive API
2. **Fallback Images**: Generate placeholder images for tracks without artwork
3. **Local Caching**: Optional local CDN/proxy for artwork URLs
4. **Artist Images**: Extend to include artist profile images
5. **High-Res Artwork**: Support for ultra-high-resolution artwork (1200x1200+)

## Related Files

- **Migration**: `sql/migrations/011_add_track_album_artwork_up.sql`
- **Rollback**: `sql/migrations/011_add_track_album_artwork_down.sql`
- **API Clients**: `services/metadata-enrichment/api_clients.py`
- **Enrichment Pipeline**: `services/metadata-enrichment/enrichment_pipeline.py`
- **Views**: Database views updated to expose artwork columns

## References

- [Spotify Web API - Get Track](https://developer.spotify.com/documentation/web-api/reference/get-track)
- [Tidal API - Track Object](https://developer.tidal.com/documentation/api/track-api)
- [MusicBrainz Cover Art Archive](https://coverartarchive.org/)
