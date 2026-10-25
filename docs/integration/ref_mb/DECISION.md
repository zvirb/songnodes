# Decision: `ref_mb` Deployment

This document records the decision to change the deployment model for the `ref_mb` (MusicBrainz reference data) database from plan D2 to a separate database, rather than a schema inside the `songnodes` app database.

## Rationale
- **Size:** The loaded reference database is about 24 to 30 GB. Adding this to the `dev-postgres` volume would bloat every volume backup by that amount.
- **Reloading:** A redeploy that recreates the `dev-postgres` volume would force a 30-minute reload of the reference data.
- **Tuning:** The reference database requires its own Postgres tuning parameters (e.g., `pg_trgm`, `random_page_cost`) which may not be suitable for the main app database.
- **Isolation:** Nothing in the main repository loads the data (there is no ETL code), so keeping it in a separate database simplifies management and lifecycle.

## Implementation Details
- `ref_mb` will be hosted in its own permanent Postgres container (`127.0.0.1:55433`).
- **Database:** `ref_mb`
- **Schema:** `ref_mb`
- **User:** `ref_mb_reader` (read-only)
- **Fallback:** If a single Postgres server is ever mandated by infrastructure constraints, a separate database named `mbref` on the same server should be used. **Never** use a `ref_mb` schema inside the `songnodes` app database.

## Reload Procedure
- To avoid downtime or impacting running services, reloads will write to a new schema (e.g., `ref_mb_YYYYMMDD`).
- Once loading and indexing are complete, an atomic `ALTER SCHEMA ... RENAME` swap will make it the active schema.
- The dump ID and reload metadata must be recorded in the `dump_meta` table.
