#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_dir"
# Some cloud machines have a read-only home directory.
export DOCKER_CONFIG="${DOCKER_CONFIG:-$repo_dir/.local-dev/docker}"
mkdir -p "$DOCKER_CONFIG"

# Cloud checkouts may give SQL files mode 600; Postgres initializes as its own user.
chmod a+r sql/migrations/medallion/{001_bronze_layer_up,002_silver_layer_up,006_track_adjacency_edges_up}.sql
chmod a+r sql/migrations/012_target_tracks_up.sql sql/migrations/013_ingestion_jobs_up.sql sql/migrations/014_data_layer_up.sql

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
docker build "${build_args[@]}" -f services/worker/Dockerfile -t songnodes-dev-worker .
docker build "${build_args[@]}" -f scrapers/Dockerfile.unified -t songnodes-dev-unified-scraper scrapers/
docker build "${build_args[@]}" -t songnodes-dev-frontend frontend/
docker compose -f compose.dev.yaml up -d --wait --wait-timeout 120 postgres redis
# Add the work queue to existing volumes too; this migration preserves existing rows.
docker compose -f compose.dev.yaml exec -T postgres psql -U songnodes -d songnodes -v ON_ERROR_STOP=1 < sql/migrations/012_target_tracks_up.sql
docker compose -f compose.dev.yaml exec -T postgres psql -U songnodes -d songnodes -v ON_ERROR_STOP=1 < sql/migrations/013_ingestion_jobs_up.sql
docker compose -f compose.dev.yaml exec -T postgres psql -U songnodes -d songnodes -v ON_ERROR_STOP=1 < sql/migrations/014_data_layer_up.sql
# The library overlay schema is not idempotent: apply it once, then the (idempotent) search indexes.
if [ -z "$(docker compose -f compose.dev.yaml exec -T postgres psql -U songnodes -d songnodes -tAc "SELECT to_regclass('library.tracks')" | tr -d '[:space:]')" ]; then
  docker compose -f compose.dev.yaml exec -T postgres psql -U songnodes -d songnodes -v ON_ERROR_STOP=1 < sql/migrations/101_library_schema_up.sql
fi
if [ -z "$(docker compose -f compose.dev.yaml exec -T postgres psql -U songnodes -d songnodes -tAc "SELECT to_regclass('web_call_log')" | tr -d '[:space:]')" ]; then
  docker compose -f compose.dev.yaml exec -T postgres psql -U songnodes -d songnodes -v ON_ERROR_STOP=1 < sql/migrations/170_web_call_log_up.sql
fi
docker compose -f compose.dev.yaml exec -T postgres psql -U songnodes -d songnodes -v ON_ERROR_STOP=1 < sql/migrations/180_library_indexes_up.sql
docker compose -f compose.dev.yaml exec -T postgres psql -U songnodes -d songnodes -v ON_ERROR_STOP=1 < sql/migrations/181_insert_reconciliation_reports_up.sql
if [ -z "$(docker compose -f compose.dev.yaml exec -T postgres psql -U songnodes -d songnodes -tAc "SELECT column_name FROM information_schema.columns WHERE table_schema='library' AND table_name='track_xref' AND column_name='norm_key'" | tr -d '[:space:]')" ]; then
  docker compose -f compose.dev.yaml exec -T postgres psql -U songnodes -d songnodes -v ON_ERROR_STOP=1 < sql/migrations/182_update_views_and_model_up.sql
fi
docker compose -f compose.dev.yaml exec -T postgres psql -U songnodes -d songnodes -v ON_ERROR_STOP=1 < sql/migrations/183_energy_model_up.sql
docker compose -f compose.dev.yaml exec -T postgres psql -U songnodes -d songnodes -v ON_ERROR_STOP=1 < sql/migrations/184_library_views_v_crates_etc_up.sql
docker compose -f compose.dev.yaml exec -T postgres psql -U songnodes -d songnodes -v ON_ERROR_STOP=1 < sql/migrations/185_reconcile_view_mbid_up.sql
docker compose -f compose.dev.yaml exec -T postgres psql -U songnodes -d songnodes -v ON_ERROR_STOP=1 < sql/migrations/220_graph_consumer_up.sql
docker compose -f compose.dev.yaml exec -T postgres psql -U songnodes -d songnodes -v ON_ERROR_STOP=1 < sql/migrations/240_library_search_indexes_up.sql
docker compose -f compose.dev.yaml up -d --no-build --force-recreate --wait --wait-timeout 120 graph-api rest-api worker unified-scraper frontend
curl --fail --silent --show-error http://127.0.0.1:8084/api/graph/data
printf '\nBackend ready. In frontend/, run npm ci and npm run dev.\n'
