#!/usr/bin/env bash
# import-music-library.sh: load the music library's weekly export into the running SongNodes stack.
#
#   bash scripts/import-music-library.sh [path/to/library.json]
#
# Default file: $MUSIC_LIBRARY_DIR/outputs/artifact/library.json (MUSIC_LIBRARY_DIR defaults to
# ../musicLibrary next to this repo, which is E:\musicLibrary on the laptop). The file is posted to
# POST /api/v1/library/ingest with Idempotency-Key "import-<md5 of the file>", so the same file never imports
# twice; the worker writes it into library.tracks. The script waits for the job and prints the result.
# API: SONGNODES_API (default http://127.0.0.1:8082). Needs curl and python3 (Git Bash on Windows).
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
lib_dir="${MUSIC_LIBRARY_DIR:-$repo_root/../musicLibrary}"
src="${1:-$lib_dir/outputs/artifact/library.json}"
api="${SONGNODES_API:-http://127.0.0.1:8082}"
py=""
for c in python3 python py; do   # the Windows Store "python3" stub exists but does not run
  if command -v "$c" >/dev/null 2>&1 && "$c" -c 'import sys' >/dev/null 2>&1; then py="$c"; break; fi
done
[[ -n "$py" ]] || { echo "import-music-library: needs Python 3 on PATH" >&2; exit 1; }

if [[ ! -f "$src" ]]; then
  echo "import-music-library: no library export at $src" >&2
  echo "Run the weekly run in the musicLibrary folder, set MUSIC_LIBRARY_DIR, or pass the file path." >&2
  exit 1
fi

read -r count key < <("$py" - "$src" <<'PY' | tr -d '\r'
import hashlib, json, sys
path = sys.argv[1]
raw = open(path, 'rb').read()
try:
    data = json.loads(raw)
except ValueError as exc:
    sys.exit(f"import-music-library: {path} is not valid JSON: {exc}")
tracks = data.get('tracks') if isinstance(data, dict) else None
if not isinstance(tracks, list):
    sys.exit("import-music-library: the export has no `tracks` array")
print(len(tracks), 'import-' + hashlib.md5(raw).hexdigest())
PY
)
echo "Importing $count tracks from $src"

response="$(curl -sS --fail-with-body -X POST "$api/api/v1/library/ingest" \
  -H 'Content-Type: application/json' -H "Idempotency-Key: $key" --data-binary "@$src")"
job_id="$("$py" -c 'import json,sys; r=json.load(sys.stdin); print(r["job_id"]); sys.stderr.write(("New import job " if r.get("created") else "This file was already submitted; job ") + r["job_id"] + "\n")' <<<"$response" | tr -d '\r')"

first="$(curl -sS "$api/api/v1/jobs/$job_id" | "$py" -c 'import json,sys; print(json.load(sys.stdin)["status"])' | tr -d '\r')"
if [[ "$first" == "dead" ]]; then
  echo "That earlier import of this file failed; retrying it."
  curl -sS --fail-with-body -X POST "$api/api/v1/jobs/$job_id/retry" >/dev/null
fi

for _ in $(seq 1 120); do
  job="$(curl -sS "$api/api/v1/jobs/$job_id")"
  status="$("$py" -c 'import json,sys; print(json.load(sys.stdin)["status"])' <<<"$job" | tr -d '\r')"
  case "$status" in
    succeeded)
      "$py" -c 'import json,sys; j=json.load(sys.stdin); print("Import finished:", json.dumps(j.get("result") or {}, indent=2))' <<<"$job"
      in_db="$(curl -sS "$api/api/v1/library/search?limit=5000" | "$py" -c 'import json,sys; print(len(json.load(sys.stdin)))' | tr -d '\r')"
      echo "Library tracks now in the database: $in_db"
      exit 0 ;;
    dead)
      "$py" -c 'import json,sys; j=json.load(sys.stdin); print("Import failed after", j["attempts"], "attempts:", j.get("last_error"))' <<<"$job" >&2
      exit 1 ;;
  esac
  sleep 5
done
echo "The import job $job_id is still $status after 10 minutes; check GET $api/api/v1/jobs/$job_id" >&2
exit 1
