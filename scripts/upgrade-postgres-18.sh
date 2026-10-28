#!/usr/bin/env bash
# Copy the SongNodes database from Postgres 16 (volume dev-postgres) into Postgres 18 (volume dev-postgres-18).
#
#   bash scripts/upgrade-postgres-18.sh
#
# Run it while the stack is on Postgres 16 (the compose default). The running database is never stopped,
# changed or deleted: the script dumps it, restores the dump into a temporary Postgres 18 container on the
# new volume, compares row counts, removes the temporary container (not the volume) and prints the three
# .env lines that switch the stack to 18. Nothing switches until you add those lines. See
# docs/upgrades/postgres-18.md for the steps and the roll back.
set -euo pipefail

repo_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_dir"
export MSYS_NO_PATHCONV=1   # Git Bash on Windows would rewrite the container paths below

compose=(docker compose -f compose.dev.yaml)
project="songnodes-dev"
new_volume="${project}_dev-postgres-18"
temp="songnodes-pg18-upgrade"
image="postgres:18-alpine"
pgdata="/var/lib/postgresql/data/pgdata"

# Tables whose row counts must match after the restore (missing tables print as "-").
tables=(bronze_scraped_playlists bronze_scraped_tracks silver_enriched_playlists silver_playlist_tracks
        silver_enriched_tracks silver_enriched_artists silver_track_transitions target_track_searches
        library.tracks)

old_psql() { "${compose[@]}" exec -T postgres psql -U songnodes -d songnodes -v ON_ERROR_STOP=1 "$@"; }
new_psql() { docker exec -i "$temp" psql -U songnodes -d songnodes -v ON_ERROR_STOP=1 "$@"; }

counts() {  # $1 = old|new; prints "table count" lines
  local run="${1}_psql" t n
  for t in "${tables[@]}"; do
    if [ -n "$($run -tAc "SELECT to_regclass('$t')" | tr -d '[:space:]')" ]; then
      n=$($run -tAc "SELECT count(*) FROM $t" | tr -d '[:space:]')
    else
      n="-"
    fi
    echo "$t $n"
  done
}

echo "== Checking the running database"
major=$(old_psql -tAc "SELECT current_setting('server_version_num')::int / 10000" | tr -d '[:space:]') || {
  echo "Cannot reach the postgres service. Start the stack on Postgres 16 first (bash scripts/start-dev.sh)." >&2; exit 1; }
if [ "$major" != "16" ]; then
  echo "The running postgres service is version $major, not 16." >&2
  echo "Remove POSTGRES_MAJOR, POSTGRES_VOLUME and POSTGRES_PGDATA from .env, then run:" >&2
  echo "  docker compose -f compose.dev.yaml up -d --force-recreate postgres" >&2
  echo "so the stack is back on your data in dev-postgres, and run this script again." >&2
  exit 1
fi

if docker ps -a --format '{{.Names}}' | grep -qx "$temp"; then
  echo "A container named $temp already exists (an earlier run stopped part way). Remove it with" >&2
  echo "  docker rm -f $temp" >&2
  echo "and run this script again. Its volume $new_volume is kept." >&2
  exit 1
fi

echo "== Row counts on Postgres 16"
before=$(counts old); echo "$before"

mkdir -p backups
dump="backups/songnodes-pg16-$(date +%Y%m%d-%H%M).dump"
echo "== Dumping to $dump (kept; nothing deletes it)"
"${compose[@]}" exec -T postgres pg_dump -U songnodes -Fc songnodes > "$dump"
size=$(wc -c < "$dump" | tr -d '[:space:]')
if [ "$size" -lt 10000 ]; then echo "The dump is only $size bytes; stopping." >&2; exit 1; fi
echo "Dump size: $size bytes"

echo "== Starting a temporary Postgres 18 on volume $new_volume"
docker volume create "$new_volume" >/dev/null
docker run -d --name "$temp" \
  -e POSTGRES_USER=songnodes -e POSTGRES_DB=songnodes -e POSTGRES_HOST_AUTH_METHOD=trust -e PGDATA="$pgdata" \
  -v "$new_volume:/var/lib/postgresql/data" "$image" >/dev/null
cleanup() { docker rm -f "$temp" >/dev/null 2>&1 || true; }
trap cleanup EXIT

for _ in $(seq 1 60); do
  if docker exec "$temp" pg_isready -U songnodes -d songnodes >/dev/null 2>&1 \
     && docker exec "$temp" psql -U songnodes -d songnodes -tAc "SELECT 1" >/dev/null 2>&1; then break; fi
  sleep 2
done
docker exec "$temp" psql -U songnodes -d songnodes -tAc "SELECT version()"

echo "== Checking the new volume holds no data"
user_tables="FROM pg_tables WHERE schemaname NOT IN ('pg_catalog', 'information_schema')"
existing=$(new_psql -tAc "SELECT count(*) $user_tables" | tr -d '[:space:]')
restore_opts=(--exit-on-error)
if [ "$existing" != "0" ]; then
  # The stack may already have started Postgres 18 on this volume: the init scripts then made empty tables.
  rows=$(new_psql -tAc "SELECT coalesce(sum((xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM %I.%I', schemaname, tablename), false, true, '')))[1]::text::bigint), 0) $user_tables" | tr -d '[:space:]')
  if [ "$rows" != "0" ]; then
    echo "$new_volume already holds $rows rows in $existing tables (the stack ran on Postgres 18 and wrote data)." >&2
    echo "Nothing was restored. Check what is in it before going on; your Postgres 16 data is untouched." >&2
    exit 1
  fi
  echo "$new_volume has $existing empty tables from an earlier start on Postgres 18; the restore replaces them."
  restore_opts=(--clean --if-exists --exit-on-error)
fi

echo "== Restoring into Postgres 18"
docker exec -i "$temp" pg_restore -U songnodes -d songnodes "${restore_opts[@]}" < "$dump"

echo "== Row counts on Postgres 18"
after=$(counts new); echo "$after"

if [ "$before" != "$after" ]; then
  echo "Row counts differ (see above). Do not switch; your Postgres 16 data is untouched." >&2
  diff <(echo "$before") <(echo "$after") >&2 || true
  exit 1
fi

cat <<EOF

Row counts match. Postgres 18 on $new_volume now holds a copy of your data.
To switch the stack to Postgres 18, add these three lines to .env next to compose.dev.yaml:

  POSTGRES_MAJOR=18
  POSTGRES_VOLUME=dev-postgres-18
  POSTGRES_PGDATA=$pgdata

then run:  bash scripts/start-dev.sh
To go back to 16, remove the three lines and run start-dev.sh again. The dev-postgres volume and the dump
$dump are kept. Anything written while on 18 is not copied back to 16.
EOF
