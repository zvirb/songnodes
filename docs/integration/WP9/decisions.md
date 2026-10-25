# Decisions for WP9

1. Postgres FTS + Trigram indexes used for high performance debounced search.
2. Library & Sets pages hooked up to API via `data.ts`, with artifact fallback.
3. Provenance integrated via evidence JSON blob on `silver_track_metadata_evidence`.
4. Added MusicBrainz UI credits and attribution.
