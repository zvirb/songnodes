#!/usr/bin/env bash
# sync-music-library.sh: copy the music library's weekly export into the SongNodes frontend.
#
# Source: $MUSIC_LIBRARY_DIR/outputs/artifact/library.json, written by the weekly run
#         (`python3 pipeline/run_weekly.py db`). MUSIC_LIBRARY_DIR defaults to ../musicLibrary
#         relative to this repo's root.
# Target: frontend/public/data/music-library.json, read by the Library and Set builder pages
#         (frontend/src/features/musicLibrary/data.ts).
#
# The file is validated before it replaces the current copy: it must be JSON with a `tracks`
# array. Prints the track count on success. Usage: scripts/sync-music-library.sh
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
lib_dir="${MUSIC_LIBRARY_DIR:-$repo_root/../musicLibrary}"
src="$lib_dir/outputs/artifact/library.json"
dest="$repo_root/frontend/public/data/music-library.json"

if [[ ! -f "$src" ]]; then
  echo "sync-music-library: no library export at $src" >&2
  echo "Run the weekly run (python3 pipeline/run_weekly.py db) or set MUSIC_LIBRARY_DIR." >&2
  exit 1
fi

tmp="$(mktemp "${dest}.XXXXXX")"
trap 'rm -f "$tmp"' EXIT
cp "$src" "$tmp"

count="$(python3 - "$tmp" <<'PY'
import json, sys
path = sys.argv[1]
try:
    with open(path, encoding="utf-8") as fh:
        data = json.load(fh)
except (OSError, ValueError) as exc:
    sys.exit(f"sync-music-library: {path} is not valid JSON: {exc}")
tracks = data.get("tracks") if isinstance(data, dict) else None
if not isinstance(tracks, list):
    sys.exit("sync-music-library: the export has no `tracks` array")
print(len(tracks))
PY
)"

mkdir -p "$(dirname "$dest")"
mv "$tmp" "$dest"
trap - EXIT
echo "sync-music-library: copied $count tracks from $src to frontend/public/data/music-library.json"
