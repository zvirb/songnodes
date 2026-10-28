#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_dir"

echo "Checking running Postgres version..."
current_version=$(docker compose -f compose.dev.yaml exec -T postgres psql -U songnodes -tAc "SELECT current_setting('server_version_num');" 2>/dev/null || echo "")

if [[ -z "$current_version" ]]; then
    echo "Error: Could not connect to Postgres. Make sure it is running."
    exit 1
fi

if [[ "$current_version" -ge 180000 ]]; then
    echo "Postgres is already running version 18 or newer."
    exit 0
fi

echo "Getting counts before migration..."
count_artists_16=$(docker compose -f compose.dev.yaml exec -T postgres psql -U songnodes -d songnodes -tAc "SELECT count(*) FROM bronze_scraped_artists;" || echo "0")
count_tracks_16=$(docker compose -f compose.dev.yaml exec -T postgres psql -U songnodes -d songnodes -tAc "SELECT count(*) FROM bronze_scraped_tracks;" || echo "0")
count_playlists_16=$(docker compose -f compose.dev.yaml exec -T postgres psql -U songnodes -d songnodes -tAc "SELECT count(*) FROM bronze_scraped_playlists;" || echo "0")

echo "Before upgrade counts:"
echo "bronze_scraped_artists: $count_artists_16"
echo "bronze_scraped_tracks: $count_tracks_16"
echo "bronze_scraped_playlists: $count_playlists_16"

# Create a temporary directory for the dump
dump_dir=$(mktemp -d)
trap 'rm -rf "$dump_dir"' EXIT
dump_file="$dump_dir/dump.sql"

echo "Dumping data from Postgres 16..."
docker compose -f compose.dev.yaml exec -T postgres pg_dumpall -U songnodes --clean > "$dump_file"

echo "Stopping Postgres 16..."
docker compose -f compose.dev.yaml rm -sf postgres

echo "Starting Postgres 18..."
docker compose -f compose.dev.yaml up -d --wait --wait-timeout 120 postgres

echo "Waiting for Postgres 18 to be ready..."
timeout=60
while [ $timeout -gt 0 ]; do
    if docker compose -f compose.dev.yaml exec -T postgres pg_isready -U songnodes -d songnodes >/dev/null 2>&1; then
        break
    fi
    sleep 2
    timeout=$((timeout - 2))
done
if [ $timeout -le 0 ]; then
    echo "Error: Postgres 18 failed to become ready."
    exit 1
fi

echo "Checking if volume is already populated..."
# If there's already data from a previous upgrade, avoid overwriting
has_data=$(docker compose -f compose.dev.yaml exec -T postgres psql -U songnodes -d songnodes -tAc "SELECT count(*) FROM bronze_scraped_artists;" 2>/dev/null || echo "0")
if [[ "$has_data" -gt 0 ]]; then
    echo "Error: The new Postgres 18 volume already has data. Refusing to restore over it."
    exit 1
fi

echo "Restoring data into Postgres 18..."
# Restore data
docker compose -f compose.dev.yaml exec -T postgres psql -U songnodes -d postgres < "$dump_file" >/dev/null

echo "Running migrations check..."
python3 scripts/check_migrations.py

echo "Getting counts after migration..."
count_artists_18=$(docker compose -f compose.dev.yaml exec -T postgres psql -U songnodes -d songnodes -tAc "SELECT count(*) FROM bronze_scraped_artists;" || echo "0")
count_tracks_18=$(docker compose -f compose.dev.yaml exec -T postgres psql -U songnodes -d songnodes -tAc "SELECT count(*) FROM bronze_scraped_tracks;" || echo "0")
count_playlists_18=$(docker compose -f compose.dev.yaml exec -T postgres psql -U songnodes -d songnodes -tAc "SELECT count(*) FROM bronze_scraped_playlists;" || echo "0")

echo "After upgrade counts:"
echo "bronze_scraped_artists: $count_artists_18"
echo "bronze_scraped_tracks: $count_tracks_18"
echo "bronze_scraped_playlists: $count_playlists_18"

echo "Upgrade complete!"
