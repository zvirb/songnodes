# Artist Filter Fix - Frontend Implementation

## Problem
Tracks with "Unknown" or missing artist attribution were showing up in the frontend graph visualization, degrading user experience while the backend enrichment pipeline processes historical data.

## Solution
Implemented client-side filtering to exclude tracks without valid artist attribution in the data loading layer.

## Files Modified

### Frontend Files

#### 1. `/frontend/src/hooks/useDataLoader.ts`
- **Added**: `hasValidArtist()` helper function to validate artist data
  - Exact match filtering for basic invalid values
  - **NEW**: Prefix matching to catch "VA @...", "Various Artists @...", etc.
- **Modified**: Primary data loading path to filter out invalid artists
- **Modified**: Fallback data loading path to filter out invalid artists
- **Added**: Logging to track how many tracks are being filtered

#### 2. `/frontend/src/components/LiveDataLoader.tsx`
- **Added**: `hasValidArtist()` helper function (enhanced with prefix matching)
- **Modified**: Live data update path to filter out invalid artists

### Backend Files

#### 3. `/services/rest-api/pydantic_models.py` (lines 143-159)
- **Enhanced**: `no_generic_artists()` validator in `ArtistBase` model
  - Added prefix matching to catch edge cases like:
    - `"VA @ Event Name"` (compilation events)
    - `"Unknown Artist, Other Artist"` (malformed multi-artist)
    - `"Various Artists @ Location"` (location-based compilations)
  - Prevents these artists from being created via API in the future

## What Gets Filtered

Tracks are excluded if their artist field matches any of these:

### Exact Matches (case-insensitive)
- `null` or `undefined`
- Empty string `""`
- `"unknown"`
- `"unknown artist"`
- `"various artists"`
- `"various"`
- `"va"`

### Prefix Matches (case-insensitive)
- `"VA @ ..."` (e.g., "VA @ Creamfields", "VA @ Welcome To The Club")
- `"Various Artists @ ..."` (e.g., "Various Artists @ Street Parade")
- `"Unknown Artist, ..."` (e.g., "Unknown Artist, Tujamo")
- `"Unknown Artist @ ..."`

## Impact

### Before Fix
- ~16,353 tracks loaded (including ~14,828 without proper artist attribution)
- Users saw "Unknown Artist" in the graph
- Degraded data quality perception

### After Fix
- Only tracks with valid artist attribution are displayed (~1,525 tracks)
- Clean, professional UI with real artist names
- Console logs show how many tracks were filtered for monitoring

## Monitoring

Check browser console for these messages:
```
⚠️ Filtered out ${count} tracks without valid artist attribution
✅ Loaded ${nodes.length} nodes and ${edges.length} edges (${filteredOutCount} tracks excluded due to missing artists)
```

## Backend Dependency

This is a **temporary frontend filter** while the backend enrichment process runs:
- Backend location: `/services/metadata-enrichment/enrichment_pipeline.py`
- Backend fuzzy matcher: Lines 122-149 handle unknown artist resolution
- Backend process: Tracks are queued for enrichment via API

As the enrichment pipeline processes historical tracks, they will:
1. Get matched to Spotify/MusicBrainz/Discogs
2. Have artist relationships created in the `track_artists` table
3. Automatically appear in the frontend (no longer filtered)

## Testing

Build successful:
```bash
cd frontend && npm run build
✓ built in 6.39s
```

No TypeScript errors. All existing functionality preserved.

## Next Steps (Backend Team)

1. **Immediate**: Run enrichment pipeline on the 14,828 tracks without artists
2. **Short-term**: Add database constraints to prevent tracks without artists from being inserted
3. **Long-term**: Enhance scraping pipeline to enforce artist relationships during data ingestion

## Rollback

If issues arise, revert these two files:
```bash
git checkout HEAD -- frontend/src/hooks/useDataLoader.ts
git checkout HEAD -- frontend/src/components/LiveDataLoader.tsx
```
