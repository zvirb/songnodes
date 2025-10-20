# Post-migration restore & promotion guide

This document explains the restoration and promotion steps we ran to repair missing track→playlist links and regenerate adjacency edges, plus instructions for continuing the rollout safely.

Files added

- `scripts/restore_and_promote.sh` — idempotent orchestration script that applies medallion migrations, runs backfill, runs the silver->gold ETL, refreshes the `gold_track_graph` materialized view, runs a unicode-dash unit test, and commits & pushes migration changes.

- `sql/migrations/medallion/007_playlists_source_url_unique_up.sql` and corresponding `_down.sql` — create/drop non-partial unique index on `public.playlists(source_url)` required by ETL's ON CONFLICT target.

- `sql/migrations/medallion/008_gold_track_graph_index_up.sql` and corresponding `_down.sql` — create/drop unique index on `public.gold_track_graph(track_id)` to allow REFRESH MATERIALIZED VIEW CONCURRENTLY.

High-level steps performed

1. Created a DB trigger/function (via migration 006) to keep `enrichment_metadata.playlist_ids` up to date when `silver_playlist_tracks` changes.

1. Backfilled `enrichment_metadata.playlist_ids` for existing tracks and populated `silver_track_transitions` from `silver_playlist_tracks` using `tmp/backfill_playlist_and_transitions.sql`.

1. Created a non-partial unique index on `playlists.source_url` so `INSERT ... ON CONFLICT (source_url)` works.

1. Ran the silver→gold ETL for a sample batch (100 playlists) to create gold `playlists` and `playlist_tracks` — successful.

1. Created a unique index on `gold_track_graph.track_id` and refreshed the materialized view concurrently.

How to run the orchestration script

1. Make the script executable (if not already):

```bash
chmod +x scripts/restore_and_promote.sh
```

1. Export required environment variables (example):

```bash
export POSTGRES_HOST=localhost
export POSTGRES_PORT=5433
export POSTGRES_DB=musicdb
export POSTGRES_USER=musicdb_user
export POSTGRES_PASSWORD='<YOUR_DB_PASSWORD>'
export ETL_LIMIT=1000  # tune as needed
export GIT_BRANCH=fix/restore-adjacency-20251021
```

1. Run the script:

```bash
./scripts/restore_and_promote.sh
```

Safety & rollback notes

- The script uses `CREATE INDEX IF NOT EXISTS` for idempotency, but in production you should prefer `CREATE INDEX CONCURRENTLY` during a maintenance window to avoid table locks. The migration files in `sql/migrations/medallion/` reflect the simple creation statements; adapt them to CONCURRENTLY if needed.

- If something goes wrong, you can drop the indexes via the corresponding `_down.sql` files.

- The script commits and attempts to push a new git branch; verify remote access/credentials before running.

Validation checklist (post-run)

- ETL logs: confirm `Errors: 0` and playlists/playlist_tracks counts increased as expected.

- Materialized view: `SELECT COUNT(*) FROM gold_track_graph;` should increase after refresh.

- A few spot checks: pick known playlists and ensure their playlist_tracks exist in `playlist_tracks` and `playlists.source_url` has expected values.

Next improvements

- Add a unit/integration test to CI that asserts the repository schema contains the `idx_playlists_source_url_unique_full` index (or equivalent constraint). This prevents ETL failures in future.

- Consider adding a migration runner or declarative schema tool to keep `sql/init/01-schema.sql` and `sql/migrations` in sync.

Contact

If you need me to continue and run the full ETL, push the migration branch to the remote, or open a PR, say which and I will proceed.
