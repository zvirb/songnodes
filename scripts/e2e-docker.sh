#!/usr/bin/env bash
# Run the Playwright E2E suite in the official Linux image against the development
# Compose stack (scripts/start-dev.sh). This is the canonical E2E run and the only
# environment that may create screenshot baselines (docs: frontend/tests/README.md).
#
#   scripts/e2e-docker.sh                      # full suite, all browsers, one worker
#   scripts/e2e-docker.sh --project=chromium   # any extra Playwright arguments
#   scripts/e2e-docker.sh visual --update-snapshots   # (re)create baselines; review them first
set -euo pipefail

repo_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
image="mcr.microsoft.com/playwright:v1.64.1-noble"   # keep in step with @playwright/test
network="${E2E_NETWORK:-songnodes-dev_default}"
base_url="${E2E_BASE_URL:-http://frontend:8080}"

docker network inspect "$network" >/dev/null 2>&1 || {
  echo "Docker network $network not found; start the stack with scripts/start-dev.sh" >&2
  exit 1
}

# Git Bash on Windows would rewrite the container paths below.
export MSYS_NO_PATHCONV=1

docker run --rm --ipc=host --network "$network" \
  -e CI=1 -e PLAYWRIGHT_BASE_URL="$base_url" \
  -v "$repo_dir/frontend:/work" \
  -v songnodes-e2e-node-modules:/work/node_modules \
  -w /work "$image" \
  bash -c 'npm ci --no-audit --no-fund --loglevel=error && npx playwright test --workers=1 "$@"' _ "$@"
