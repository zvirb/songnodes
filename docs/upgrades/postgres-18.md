# Upgrading to Postgres 18

This document outlines the steps to upgrade the SongNodes Postgres database from version 16 to 18. Because Postgres data files are not compatible across major versions, this upgrade requires a data dump and restore into a new volume (`dev-postgres-18`).

**Note**: Do not delete the old `dev-postgres` volume. It is kept as a rollback safeguard.

## Prerequisites
- The local development stack must be running with the old Postgres 16 database.
- You must have this repository checked out on the `u7-prepare-postgres-18` branch.
- You must have `docker compose` available.

## Upgrade Steps (Owner only)

The upgrade is fully automated by the `upgrade-postgres-18.sh` script. It will:
1. Dump all data from the running Postgres 16 container.
2. Stop the old Postgres 16 container.
3. Start the new Postgres 18 container (which uses the new `dev-postgres-18` volume).
4. Restore the dumped data into Postgres 18.
5. Run the schema and migration checks.
6. Print the row counts of the main tables before and after to verify data integrity.

Run the script from the repository root:

```bash
bash scripts/upgrade-postgres-18.sh
```

## How to Verify
- Read the output of the upgrade script. The "Before upgrade counts" should match the "After upgrade counts".
- You can manually verify the running version and counts:
  ```bash
  docker compose -f compose.dev.yaml exec postgres psql -U songnodes -c "SELECT version();"
  docker compose -f compose.dev.yaml exec postgres psql -U songnodes -c "SELECT count(*) FROM bronze_scraped_tracks;"
  ```
- Run the full suite of checks to ensure the stack works normally:
  ```bash
  bash scripts/comprehensive_health_check.sh
  ```

## How to Roll Back
If the upgrade fails or if you need to revert to Postgres 16:
1. Stop the Postgres 18 container:
   ```bash
   docker compose -f compose.dev.yaml stop postgres
   ```
2. Revert the `compose.dev.yaml` changes:
   Change `image: postgres:18-alpine` back to `image: postgres:16-alpine`.
   Remove `PGDATA: /var/lib/postgresql/data/pgdata` from the environment block.
   Change the volume mount back from `dev-postgres-18:/var/lib/postgresql/data` to `dev-postgres:/var/lib/postgresql/data`.
3. Restart Postgres:
   ```bash
   docker compose -f compose.dev.yaml up -d postgres
   ```
4. Verify you are back on Postgres 16 and your old data is present.
