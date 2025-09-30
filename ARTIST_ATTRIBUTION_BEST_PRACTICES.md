# 🎵 Artist Attribution Best Practices (2025 Industry Standards)

**Date**: September 30, 2025
**Status**: Implementation Guidelines
**Priority**: CRITICAL - Affects Royalties & Discovery

---

## 📋 Executive Summary

Proper artist attribution is **MANDATORY** for:
1. **Royalty Payments** - Incorrect metadata = unclaimed royalties
2. **Music Discovery** - Search algorithms require accurate artist names
3. **Platform Requirements** - Spotify/Apple Music require extended credits (2025)
4. **Legal Compliance** - Licensing and copyright attribution

**NEVER** use generic placeholders like "Various Artists" or "Unknown Artist" except for actual compilation albums.

---

## 🏆 Industry Standards (2025)

### 1. Spotify Metadata Guidelines

**Primary Artist**:
- Single artist or band name per field
- Consistent spelling across all releases
- NO abbreviations or extra punctuation

**Featured Artists**:
- Appear on BOTH artist profiles
- Get Release Radar exposure to both audiences
- Eligible for playlisting on both profiles
- Format: `Track Name (feat. Artist Name)` with lowercase 'feat.' + period

**Remixer Credits**:
- Track may only appear on main artist's profile
- Less likely to reach remixer's followers
- Must be credited in track title: `Track Name (Artist Remix)`

---

### 2. Apple Music Standards

**Primary Artist Role**:
- Reserved for primary (lead) artists ONLY
- NEVER used for supporting artists or contributors
- Extended credit metadata REQUIRED for every release (2025)

**Multiple Artists**:
- Can enter multiple primary artists separately
- Use "join field" for connectors: 'And', 'Featuring', '/', ','
- If no join used, default to comma

**Remix Attribution**:
- Remixer credited in track title
- Original artist MUST be credited as Primary Artist
- Sped up/slowed down/lo-fi versions included in remixes (2025)

---

### 3. MusicBrainz Relationship Types (Schema v30)

**Database Structure**:
- Typed relationships between entities (artist-recording, artist-release)
- Specific relationship roles: primary, featured, remixer, producer, etc.
- Relationships capture complete liner notes data
- Avoid redundant relationships - use most specific level

**Relationship Guidelines**:
- NOT capturing personal life details of artists
- NOT tracking fine-grained economic details
- Focus on creative contribution roles
- Link entities at most appropriate level

**Artist-Recording Relationships**:
- Primary performer
- Featured artist
- Remixer
- Producer
- Composer
- Mix engineer
- Mastering engineer

---

## ⚠️ Common Anti-Patterns to AVOID

### 1. ❌ Generic Placeholders

```json
{
  "artist": "Various Artists"  // ❌ WRONG - Breaks attribution
}
```

**Impact**:
- Multiple tracks appear to be by same artist
- Search results polluted
- Royalties cannot be distributed
- Platform algorithms fail to categorize

**Correct Approach**:
```json
{
  "primary_artist": "Deadmau5",
  "track_name": "Strobe"
}
```

---

### 2. ❌ Missing Artist Extraction

```python
# ❌ WRONG: Track name without artist
track_string = "Strobe"
# Result: "Unknown Artist" - Strobe

# ✅ CORRECT: Proper format with artist
track_string = "Deadmau5 - Strobe"
# Result: "Deadmau5" - "Strobe"
```

---

### 3. ❌ Inconsistent Spelling

```python
# ❌ WRONG: Multiple variations
artists = [
    "deadmau5",
    "Deadmau5",
    "Dead Mau5",
    "DeadMau5"
]

# ✅ CORRECT: Single canonical form
artist = "Deadmau5"  # Always use exact official spelling
```

---

### 4. ❌ Featured Artists in Title Only

```json
{
  "track_name": "Track Name feat. Artist B",  // ❌ Only in title
  "primary_artist": "Artist A",
  "featured_artists": []  // ❌ Missing structured data
}
```

**Correct Approach**:
```json
{
  "track_name": "Track Name",
  "primary_artist": "Artist A",
  "featured_artists": ["Artist B"],  // ✅ Structured relationship
  "display_title": "Track Name (feat. Artist B)"
}
```

---

## 🔧 Implementation in SongNodes

### Current Issue

**Problem**: Raw scraped data contains tracks without artist prefixes:

```json
{
  "tracks": [
    {
      "track": {
        "name": "Strobe",        // ❌ No artist prefix
        "artist": "Various Artists"  // ❌ Generic placeholder
      }
    }
  ]
}
```

**Root Cause**: Scraper not extracting artist from track HTML or using fallback placeholder.

---

### Solution Strategy

#### Phase 1: Fix Existing Data

```sql
-- Delete all tracks with generic artist attribution
DELETE FROM songs WHERE song_id IN (
    SELECT s.song_id
    FROM songs s
    JOIN artists a ON s.primary_artist_id = a.artist_id
    WHERE a.artist_name IN ('Various Artists', 'Unknown Artist')
);
```

#### Phase 2: Fix Scraper (1001tracklists_spider.py)

**Current Code (lines 696-733)**: Uses LLM extraction which may return generic artists

**Required Fix**:
1. Extract full track string from HTML (e.g., "Deadmau5 - Strobe")
2. Pass to `parse_track_string()` utility (already exists in utils.py)
3. Utility properly extracts artist and track name
4. If no artist found, SKIP track (don't insert with placeholder)

**Utility Function** (`scrapers/spiders/utils.py`):
```python
def parse_track_string(track_string):
    """
    Parses: "Deadmau5 - Strobe" → {"primary_artists": ["Deadmau5"], "track_name": "Strobe"}
    Parses: "Artist A ft. Artist B - Track" → {"primary_artists": ["Artist A"], "featured_artists": ["Artist B"], "track_name": "Track"}
    Parses: "Track (Artist Remix)" → {"primary_artists": [...], "remixer_artists": ["Artist"], "track_name": "Track"}

    Returns None for unidentified tracks (ID, ID Remix)
    ```

#### Phase 3: Update raw_data_processor.py

**Current Code**: Accepts any artist name from raw_data

**Required Fix**:
```python
artist_name = track_info.get('artist')

# Validate artist name
if artist_name in ['Various Artists', 'Unknown Artist', None, '']:
    # Attempt to parse from track name
    if '-' in track_name:
        parsed = parse_track_string(track_name)
        if parsed and parsed.get('primary_artists'):
            artist_name = parsed['primary_artists'][0]
            track_name = parsed['track_name']
        else:
            logger.warning(f"Skipping track with no valid artist: {track_name}")
            continue  # Skip this track
    else:
        logger.warning(f"Skipping track with no valid artist: {track_name}")
        continue
```

#### Phase 4: Database Constraints

```sql
-- Add unique constraint to prevent duplicate (title, artist) entries
ALTER TABLE songs
ADD CONSTRAINT unique_song_artist
UNIQUE (title, primary_artist_id);

-- Add check constraint to prevent generic artist names
ALTER TABLE artists
ADD CONSTRAINT check_not_generic_artist
CHECK (artist_name NOT IN ('Various Artists', 'Unknown Artist'));
```

---

## 📊 Verification Checklist

Before deploying fixes:

- [ ] **No Generic Artists**: Zero songs with "Various Artists" or "Unknown Artist"
- [ ] **All Connected**: Every song in database has at least one playlist relationship
- [ ] **Proper Attribution**: Each track has valid primary_artist_id
- [ ] **Consistent Names**: Artist names match official spellings
- [ ] **Relationship Data**: featured_artists and remixer_artists properly stored
- [ ] **Search Test**: Can find tracks by artist name
- [ ] **Royalty Test**: Each play correctly attributes to specific artist

---

## 🎯 Success Metrics

**After Implementation**:

1. ✅ **Zero Placeholder Artists**: No "Various Artists" or "Unknown Artist" entries
2. ✅ **100% Attribution**: Every track linked to specific artist(s)
3. ✅ **Proper Discovery**: Search by artist returns correct tracks
4. ✅ **Platform Ready**: Metadata meets Spotify/Apple Music 2025 standards
5. ✅ **Royalty Compliant**: All plays attributable to correct rights holders

---

## 📚 References

### Industry Documentation

1. **Spotify Music Metadata Style Guide v2.2** (September 2022)
   - https://assets.ctfassets.net/jtdj514wr91r/2MCgL0vUEcl8MJijHPcLG1/17e8114c81872a85a34dca6b9f4e5f41/Spotify_Music_Metadata_Style_Guide_V2.2.0.pdf

2. **Apple Music Style Guide** (2025)
   - https://help.apple.com/itc/musicstyleguide/en.lproj/static.html

3. **MusicBrainz Database Schema v30** (Q2 2025)
   - https://musicbrainz.org/doc/MusicBrainz_Database/Schema
   - https://musicbrainz.org/doc/Style/Relationships

4. **Music Metadata Style Guide v2.1** (Music Business Association)
   - https://www.musicbiz.org/wp-content/uploads/2016/04/MusicMetadataStyleGuide_V2.1.pdf

5. **RIAA - Building Better Digital Attribution** (2025)
   - https://www.riaa.com/music-community-calls-building-better-digital-attribution-credits-system/

---

## 🔄 Migration Path for Existing Data

### Step 1: Audit Current State

```sql
-- Count tracks with generic artists
SELECT
    a.artist_name,
    COUNT(*) as track_count
FROM songs s
JOIN artists a ON s.primary_artist_id = a.artist_id
WHERE a.artist_name IN ('Various Artists', 'Unknown Artist')
GROUP BY a.artist_name;
```

### Step 2: Attempt Recovery

```python
# For each track with generic artist:
# 1. Check if track name contains " - " separator
# 2. Parse using parse_track_string() utility
# 3. If artist extracted, update song record
# 4. If not extractable, mark for manual review or deletion
```

### Step 3: Clean Database

```sql
-- Delete unrecoverable tracks
DELETE FROM songs WHERE song_id IN (
    SELECT s.song_id
    FROM songs s
    JOIN artists a ON s.primary_artist_id = a.artist_id
    WHERE a.artist_name IN ('Various Artists', 'Unknown Artist')
);

-- Rebuild graph with correct data
REFRESH MATERIALIZED VIEW graph_nodes;
REFRESH MATERIALIZED VIEW graph_edges;
```

---

## ✅ Implementation Complete

**This document provides**:
- Industry-standard artist attribution guidelines
- Common anti-patterns to avoid
- Specific fixes for SongNodes pipeline
- Verification checklist
- Migration path for existing data

**Next Steps**:
1. Fix 1001tracklists spider to extract artists properly
2. Update raw_data_processor to validate artist names
3. Add database constraints to prevent future generic artists
4. Re-scrape data with corrected extraction
5. Verify all tracks have proper artist attribution

---

*Implementation Date: September 30, 2025*
*Based on 2025 industry standards from Spotify, Apple Music, and MusicBrainz*