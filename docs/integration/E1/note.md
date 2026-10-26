# E1: Local MusicBrainz Provider in Enrichment Waterfall

- Implemented `MusicBrainzLocalProvider` using `MusicBrainzResolver` and `RefMBSettings`.
- Mapped output to match requirements: `confidence` derived from match bucket/type, `matched_by` set to method. Added `dump_version` and `licence` (CC0).
- Registered provider dynamically in `registry.py` contingent on `MB_LOCAL_ENABLED=true`, inserting it before the web-based `musicbrainz` provider.
- Created `160_musicbrainz_local_waterfall_up.sql` to inject `musicbrainz_local` before `musicbrainz` in `metadata_enrichment_config` for fields: isrc, musicbrainz_id, release_date, duration_ms, artist_name, and track_title.
- Created unit tests using mocked async pool to test behavior when provider is enabled and disabled.
