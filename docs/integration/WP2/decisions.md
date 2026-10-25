# WP2 Decisions

## D1: Extraction Approach
- Stream extract tables using `tarfile` and `gzip`. Process everything once sequentially, saving the output to TSV files, but also maintaining sets of canonical tracking data to apply slimming criteria.

## D2: Slimming Filter
- We retain only rows from `recording` and `track` tables if they are referenced either via `isrc` OR if their MBID is present in `canonical_musicbrainz_data.csv.gz` or `canonical_recording_redirect.csv.gz`. This effectively slims the tables and ensures efficiency for track lookups.

## D3: Database Operations
- Insert idempotently by using `TRUNCATE CASCADE` and reloading via `COPY` from stdin (`cursor.copy_expert`).
- Execute indexing only after the data is fully loaded for performance.
