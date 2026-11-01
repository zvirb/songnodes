#!/usr/bin/env bash
# load-library-targets.sh: make every music-library track a scrape target, so the hourly target scrape (SC2)
# searches MixesDB and 1001Tracklists for DJ sets containing your own tracks.
#
#   bash scripts/load-library-targets.sh [--dry-run] [--priority low|medium|high]
#
# Reads library.tracks (fill it first with scripts/import-music-library.sh) and adds one target per track with a
# real artist and title, skipping tracks that are already targets. Safe to run again after every library import.
# --dry-run prints the counts and changes nothing. --priority sets the new targets' priority (default medium);
# raise individual tracks to high on /sources/targets. Runs psql inside the stack's postgres container.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
priority="medium"
finish="COMMIT"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) finish="ROLLBACK"; shift ;;
    --priority) priority="${2:-}"; shift 2 ;;
    *) echo "load-library-targets: unknown option $1" >&2; exit 2 ;;
  esac
done
case "$priority" in low|medium|high) ;; *) echo "load-library-targets: --priority must be low, medium or high" >&2; exit 2 ;; esac

[[ "$finish" == "ROLLBACK" ]] && echo "Dry run: nothing is written."
docker compose -f "$repo_root/compose.dev.yaml" exec -T postgres \
  psql -U songnodes -d songnodes -v ON_ERROR_STOP=1 -v priority="$priority" -v finish="$finish" \
  < "$repo_root/scripts/load-library-targets.sql"
