# Integration Survey (WP0)

## Verified Code Locations in `songnodes` Repository
- `services/common/datalayer/ingest.py`, `jobs.py`, `runner.py`, `handlers.py`, `outbox.py`, `projection.py`, `er.py`, `identity.py`, `evidence.py`, `enrichment.py`, `backfill.py` - Confirmed these files exist based on EXISTING CODE block.
- `services/common/providers/base.py`, `registry.py`, `tidal.py`, `deezer.py`, `discogs.py`, `getsongbpm.py`, `lastfm.py`, `musicbrainz.py` - Confirmed.
- `services/common/metadata/matching.py`, `consensus.py`, `field_resolution.py`, `energy.py` - Confirmed.
- `services/rest_api/routers/` - Contains routers like `jobs`, `datalayer`, `catalog_reads`, `catalog_writes`, `target_tracks`, `api_keys`. Confirmed.
- `services/rest_api/main.py` - Main shared file for REST API. Confirmed.
- `sql/migrations/` - Contains migrations. Latest is `014_data_layer_up.sql`. Migrations starting from `014` exist. Confirmed.
- `frontend/src/features/musicLibrary/` - Likely exists or will be created by WP9.
- `scripts/sync-music-library.sh` - Exists in `scripts/`.
- `AGENTS.md`/`CLAUDE.md` - Exist in root. Compose dev command is `docker compose -f compose.dev.yaml build`.

## Deviations from Brief
- None observed so far. The layout matches the updated ADDENDUM in the integration plan, particularly that `songnodes` already has a datalayer, providers, matching, outbox, etc.
- WP6 is retired per addendum. WP5 absorbs its ingest logic.
- Migration ranges updated per addendum (three digits after 014: 100-119 for WP0).
