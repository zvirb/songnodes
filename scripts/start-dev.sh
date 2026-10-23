#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_dir"
# Some cloud machines have a read-only home directory.
export DOCKER_CONFIG="${DOCKER_CONFIG:-$repo_dir/.local-dev/docker}"
mkdir -p "$DOCKER_CONFIG"

# Cloud checkouts may give SQL files mode 600; Postgres initializes as its own user.
chmod a+r sql/migrations/medallion/{001_bronze_layer_up,002_silver_layer_up,006_track_adjacency_edges_up}.sql
chmod a+r sql/migrations/012_target_tracks_up.sql

build_args=(--build-arg HTTP_PROXY --build-arg HTTPS_PROXY --build-arg NO_PROXY)
if [[ -n "${CODEX_PROXY_CERT:-}" ]]; then
  build_args+=(--network host --secret "id=proxy_ca,src=$CODEX_PROXY_CERT")
  # Docker's build network does not inherit the cloud machine's host aliases.
  proxy_host="$(python3 -c 'import os, urllib.parse; print(urllib.parse.urlsplit(os.environ.get("HTTPS_PROXY", "")).hostname or "")')"
  if [[ -n "$proxy_host" ]]; then
    proxy_ip="$(getent ahostsv4 "$proxy_host" | awk 'NR==1 {print $1}')"
    [[ -n "$proxy_ip" ]] || { echo 'Cannot resolve cloud proxy' >&2; exit 1; }
    build_args+=(--add-host "$proxy_host:$proxy_ip")
  fi
fi

docker build "${build_args[@]}" -f services/graph-visualization-api/Dockerfile -t songnodes-dev-graph-api .
docker build "${build_args[@]}" -f services/rest_api/Dockerfile -t songnodes-dev-rest-api .
docker compose -f compose.dev.yaml up -d --wait --wait-timeout 120 postgres redis
# Add the work queue to existing volumes too; this migration preserves existing rows.
docker compose -f compose.dev.yaml exec -T postgres psql -U songnodes -d songnodes -v ON_ERROR_STOP=1 < sql/migrations/012_target_tracks_up.sql
docker compose -f compose.dev.yaml up -d --no-build --wait --wait-timeout 120
curl --fail --silent --show-error http://127.0.0.1:8084/api/graph/data
printf '\nBackend ready. In frontend/, run npm ci and npm run dev.\n'
