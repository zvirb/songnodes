# Decision Record: WP5 - Library overlay model

## Context and Problem Statement
We need to import the DJ library SQLite database (`db/dj_library.sqlite`) into the SongNodes Postgres database without losing data, while utilizing the existing ingest, outbox, and durable jobs machinery. The library tracks must link to `silver_enriched_tracks` (canonical id), and library specific tables live in a `library` schema.

## Decisions
1.  **Datalayer re-use**: We will reuse `datalayer.ingest.upsert_track`, `datalayer.evidence.record`, and `datalayer.jobs` heavily. `library.tracks` will have an `id` that matches `silver_enriched_tracks.id`.
2.  **Identifiers**: Identifier cross-referencing maps `bp:<id>` or `h:<sha1>` and `norm_key` from the source `dj_library` system to `silver_enriched_tracks.id` using `library.track_xref`.
3.  **Idempotency**: Importer will only insert/update if incoming data differs, wrapping changes in transactions. An `Idempotency-Key` handles identical payloads on the API level.
4.  **Events**: We will emit `library.track.upserted.v1`, `library.set.saved.v1`, `library.track.rotation_changed.v1` as outbox events inside the same transaction when tracks or sets are altered.

## References
- `contracts/library_ingest.md`
- `contracts/ids.md`
- `AGENTS.md`
