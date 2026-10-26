L2: Reconciliation view: read MusicBrainz ids from musicbrainz_id

Base: main at BASE_SHA. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md (one job, owned paths only, about 400 changed lines at most, verify then commit, two attempts then stop, rebase before the PR) and CLAUDE.md; the design system rules apply to any UI change. No access to the user's laptop, local data or secrets; work from the repo and fixtures. Open one PR against main titled "L2: Reconciliation view: read MusicBrainz ids from musicbrainz_id" on a branch starting with "l2-"; do not merge it. Edit only the lines inside your own STATUS.md slot (SLOT:L2 BEGIN/END). Depends on: nothing. If a dependency is not merged on main yet, stop and say so instead of working around it. Never merge or rebuild your branch from an older base: before opening or updating the PR, run `git fetch origin main && git diff --diff-filter=D --name-only origin/main...HEAD`; it must list only your owned paths, otherwise stop and say so (the scope guard fails the PR anyway). New pages register through frontend/src/routes (G2) and new REST routers expose register(app) (G3); never edit App.tsx or services/rest_api/main.py unless your brief owns them.

## Job
Fix library.v_reconciliation_report so its MBID column reads the evidence field that exists.

## Context (verified on main 2026-10-26)
Migration 181 (PR #158) joins silver_track_metadata_evidence on field = 'mbid'; the allowed name is 'musicbrainz_id', so the column is always empty. 181 may already be applied somewhere, so do not edit it; replace the view in a new migration.

## Owned paths
- sql/migrations/185_reconcile_view_mbid_up.sql
- sql/migrations/185_reconcile_view_mbid_down.sql
- tests/library_model/test_reconcile_view_sql.py

(Complete list. Anything else is read-only for you. You may also add a dated note under docs/integration/L2/ if you need to record a decision.)

## Do
1. 185 up: CREATE OR REPLACE VIEW library.v_reconciliation_report with field = 'musicbrainz_id'; otherwise identical columns and filter.
2. 185 down: restore 181's definition exactly.
3. Test: parse both files; up references musicbrainz_id and not 'mbid'; down equals 181's view body. If your sandbox can start Postgres, also apply 014, 101, 181, 185 up and down.

## Done when (the reviewer's under-10-minute check; put it in the PR)
The view SQL in 185 differs from 181 only in the evidence field name.

## Checks
`python -m pytest` for the paths you own, from the repo root. Report failures in files you do not own; do not fix them.

## Hand-back
The one job done, files added/changed/deleted, checks run and not run, the reviewer check, follow-ups.
