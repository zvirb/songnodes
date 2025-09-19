#!/usr/bin/env bash
set -euo pipefail

# Simple test: submit a Setlist.fm search for a song title via API gateway (fallback to orchestrator direct)
SONG_QUERY=${1:-"Titanium (Alesso Remix)"}

echo "Submitting tasks for: $SONG_QUERY"

urlencode() {
  if command -v jq >/dev/null 2>&1; then
    printf %s "$1" | jq -sRr @uri
  else
    # Fallback minimal encoder
    local LC_ALL=C
    local string="$1"
    local strlen=${#string}
    local encoded=""
    for (( pos=0 ; pos<strlen ; pos++ )); do
       c=${string:$pos:1}
       case "$c" in
          [a-zA-Z0-9.~_-]) encoded+="$c" ;;
          ' ') encoded+='%20' ;;
          '(') encoded+='%28' ;;
          ')') encoded+='%29' ;;
          *) encoded+="$c" ;;
       esac
    done
    echo "$encoded"
  fi
}

payload() {
  local q
  q=$(urlencode "$SONG_QUERY")
  cat <<JSON
{ "scraper": "setlistfm", "url": "https://www.setlist.fm/search?query=$q", "params": {"type":"song","query":"$SONG_QUERY"} }
JSON
}

submit() {
  local URL="$1"
  echo "POST $URL"
  curl -sS -X POST "$URL" \
    -H 'Content-Type: application/json' \
    -d "$(payload)" | jq .
}

if command -v curl >/dev/null 2>&1; then
  # Try API gateway first
  if curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/health | grep -qE '^(200|2..)'; then
    submit http://localhost:8080/api/v1/scrapers/tasks/submit
  else
    # Fallback to orchestrator direct
    submit http://localhost:8001/tasks/submit
  fi
else
  echo "curl not installed"
  exit 1
fi
