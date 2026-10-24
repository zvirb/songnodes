#!/usr/bin/env bash
# Sync the SongNodes design system (repo-root design-system/) into the frontend.
#
# The design system in design-system/ is the single source of truth for every
# formatting and design decision. The frontend never edits these files: it
# consumes a synced copy in frontend/src/styles/design-system/.
#
# Copies: tokens.css, components/bundle.css, components/bundle.js,
#         components/index.d.ts, source/types/*.d.ts, fonts/*.woff2
# Writes: frontend/src/styles/design-system/VERSION
# Fails:  if the design-system version is lower than the synced one, or if
#         tokens.json and SongNodes.version (bundle.js) disagree.
#
# Usage: scripts/sync-design-system.sh [--check]
#   --check  exit 1 if the synced copy differs from design-system/ (CI gate)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$ROOT/design-system"
DEST="$ROOT/frontend/src/styles/design-system"
CHECK=0
[[ "${1:-}" == "--check" ]] && CHECK=1

ver_tokens=$(python3 -c "import json,sys;print(json.load(open(sys.argv[1]))['version'])" "$SRC/tokens.json")
ver_bundle=$(grep -oE 'version: "[0-9]+\.[0-9]+\.[0-9]+"' "$SRC/components/bundle.js" | head -1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+')
if [[ "$ver_tokens" != "$ver_bundle" ]]; then
  echo "design-system: tokens.json version $ver_tokens != SongNodes.version $ver_bundle" >&2
  exit 1
fi

files=(tokens.css components/bundle.css components/bundle.js components/index.d.ts)

if [[ $CHECK -eq 1 ]]; then
  status=0
  for f in "${files[@]}"; do
    cmp -s "$SRC/$f" "$DEST/$(basename "$f")" || { echo "out of sync: $f" >&2; status=1; }
  done
  for f in "$SRC"/fonts/*.woff2 "$SRC"/source/types/*.d.ts; do
    sub=$([[ $f == *.woff2 ]] && echo fonts || echo types)
    cmp -s "$f" "$DEST/$sub/$(basename "$f")" || { echo "out of sync: ${f#$SRC/}" >&2; status=1; }
  done
  [[ "$(cat "$DEST/VERSION" 2>/dev/null)" == "$ver_tokens" ]] || { echo "VERSION file is not $ver_tokens" >&2; status=1; }
  [[ $status -eq 0 ]] && echo "design-system $ver_tokens: frontend copy in sync"
  exit $status
fi

if [[ -f "$DEST/VERSION" ]]; then
  old=$(cat "$DEST/VERSION")
  if [[ "$(printf '%s\n%s\n' "$old" "$ver_tokens" | sort -V | head -1)" != "$old" ]]; then
    echo "design-system: refusing to go backwards ($old -> $ver_tokens)" >&2
    exit 1
  fi
fi

mkdir -p "$DEST/fonts" "$DEST/types"
for f in "${files[@]}"; do cp "$SRC/$f" "$DEST/$(basename "$f")"; done
cp "$SRC"/fonts/*.woff2 "$DEST/fonts/"
cp "$SRC"/source/types/*.d.ts "$DEST/types/"
echo "$ver_tokens" > "$DEST/VERSION"
cat > "$DEST/README.md" <<MD
# Synced design system — do not edit

Copied from \`design-system/\` (version $ver_tokens) by \`scripts/sync-design-system.sh\`.
Edit the design system at its source (the SongNodes design-system artifact, mirrored in
\`design-system/\`), then re-run the sync. See \`design-system/README.md\`.
MD
echo "design-system $ver_tokens synced to frontend/src/styles/design-system/"
