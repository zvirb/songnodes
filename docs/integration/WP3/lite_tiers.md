# Lite SQL Tiers for musicLibrary pipeline

As specified in the WP3 brief, the offline DJ pipeline requires simple SQLite-compatible queries for the first two tiers of resolution since it does not have Postgres `pg_trgm` or complex normalisation available without stdlib implementations.

## Setup tables (db/mb_lookup.sqlite)
```sql
CREATE TABLE IF NOT EXISTS isrc_recording (
    isrc TEXT,
    mbid TEXT,
    title TEXT,
    artist TEXT,
    duration INTEGER
);
CREATE INDEX idx_isrc ON isrc_recording(isrc);

CREATE TABLE IF NOT EXISTS canonical_lookup (
    combined_lookup TEXT,
    recording_mbid TEXT,
    recording_name TEXT,
    score INTEGER
);
CREATE INDEX idx_lookup ON canonical_lookup(combined_lookup);
```

## Tier 1: ISRC Exact
When an ISRC is present on a file, query the `isrc_recording` table:
```sql
SELECT mbid, title, artist, duration
FROM isrc_recording
WHERE isrc = ?
```
Tie-breaks: If multiple MBIDs return, use duration and mix-class matching in Python to resolve the best match.

## Tier 2: Exact Combined Lookup
The DJ pipeline python stdlib `normalise.py` provides the normalized text. Apply it to get the lookup key.

### Pass 1: With Mix
```sql
SELECT recording_mbid, recording_name, score
FROM canonical_lookup
WHERE combined_lookup = ?
ORDER BY score DESC
```
**Parameter**: `combined_lookup(artist, title + mix)`

### Pass 2: Without Mix (Variant)
If pass 1 fails, and the mix is known to be an original/extended mix, try again without the mix:
```sql
SELECT recording_mbid, recording_name, score
FROM canonical_lookup
WHERE combined_lookup = ?
ORDER BY score DESC
```
**Parameter**: `combined_lookup(artist, title)`

Tie-breaks: Use highest score.

## Missing Tiers
Tier 3 (Fuzzy pg_trgm + RapidFuzz) runs exclusively in the server (Postgres) side. Unmatched items in offline lookup will be handled via fuzzy matching by the central service.
