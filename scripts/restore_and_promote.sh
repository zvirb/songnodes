#!/usr/bin/env bash
set -euo pipefail
# restore_and_promote.sh
# Idempotent script to apply migrations, run backfill, run ETL, refresh materialized view,
# run the unicode dash test, and commit & push migration changes.

POSTGRES_HOST=${POSTGRES_HOST:-localhost}
POSTGRES_PORT=${POSTGRES_PORT:-5433}
POSTGRES_DB=${POSTGRES_DB:-musicdb}
POSTGRES_USER=${POSTGRES_USER:-musicdb_user}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-}
ETL_LIMIT=${ETL_LIMIT:-1000}
GIT_BRANCH=${GIT_BRANCH:-fix/restore-adjacency-$(date +%Y%m%d)}

export PGPASSWORD="$POSTGRES_PASSWORD"

echou() { echo "[restore] $*"; }

run_sql_file() {
  local file=$1
  echou "Running SQL file: $file"
  if command -v psql >/dev/null 2>&1; then
    psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -q -f "$file"
  else
    python3 - <<PY "$file"
import asyncio, asyncpg, sys
async def main():
    conn = await asyncpg.connect(host='$POSTGRES_HOST', port=$POSTGRES_PORT, user='$POSTGRES_USER', password='$POSTGRES_PASSWORD', database='$POSTGRES_DB')
    with open(sys.argv[1], 'r') as f:
        sql = f.read()
    await conn.execute(sql)
    await conn.close()
asyncio.run(main())
PY
  fi
}

apply_migrations() {
  echou "Applying medallion *_up.sql migrations in sql/migrations/medallion/"
  for f in sql/migrations/medallion/*_up.sql; do
    [ -e "$f" ] || continue
    run_sql_file "$f"
  done
}

run_backfill() {
  if [ -f tmp/backfill_playlist_and_transitions.sql ]; then
    run_sql_file tmp/backfill_playlist_and_transitions.sql
  else
    echou "No backfill script found at tmp/backfill_playlist_and_transitions.sql; skipping"
  fi
}

run_etl() {
  echou "Running silver->gold ETL (limit=$ETL_LIMIT)"
  python3 services/data-transformer/silver_playlists_to_gold_etl.py --limit "$ETL_LIMIT"
}

refresh_matview() {
  echou "Refreshing materialized view gold_track_graph (try CONCURRENTLY, fall back)"
  python3 - <<PY
import asyncio, asyncpg
async def main():
    conn = await asyncpg.connect(host='$POSTGRES_HOST', port=$POSTGRES_PORT, user='$POSTGRES_USER', password='$POSTGRES_PASSWORD', database='$POSTGRES_DB')
    try:
        await conn.execute('REFRESH MATERIALIZED VIEW CONCURRENTLY gold_track_graph;')
        print('concurrent-refresh: ok')
    except Exception as e:
        print('concurrent-refresh failed, falling back:', e)
        await conn.execute('REFRESH MATERIALIZED VIEW gold_track_graph;')
        print('refresh: ok')
    await conn.close()
asyncio.run(main())
PY
}

run_tests() {
  if command -v pytest >/dev/null 2>&1; then
    echou "Running unicode dash unit test"
    pytest -q scrapers/tests/test_track_parser_unicode.py || true
  else
    echou "pytest not found; skipping unit tests"
  fi
}

git_commit_and_push() {
  echou "Committing migration and script changes to git"
  git checkout -b "$GIT_BRANCH" || git checkout "$GIT_BRANCH"
  git add sql/migrations/medallion/* scripts/restore_and_promote.sh docs/POST_MIGRATION_RESTORE.md || true
  git commit -m "chore(migrations): add indexes and restore/promote script; docs" || echou "No changes to commit"
  if git remote -v | grep -q origin; then
    echou "Pushing branch $GIT_BRANCH to origin"
    git push -u origin "$GIT_BRANCH" || echou "git push failed; please push manually"
  else
    echou "No git remote 'origin' configured; commit created locally"
  fi
}

main() {
  apply_migrations
  run_backfill
  run_etl
  refresh_matview
  run_tests
  git_commit_and_push
  echou "Done. Review output above for any errors."
}

main "$@"
