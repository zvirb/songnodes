L7: Library ingest: accept musicLibrary run rows

Base: main at BASE_SHA. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md (one job, owned paths only, about 400 changed lines at most, verify then commit, two attempts then stop, rebase before the PR) and CLAUDE.md; the design system rules apply to any UI change. No access to the user's laptop, local data or secrets; work from the repo and fixtures. Open one PR against main titled "L7: Library ingest: accept musicLibrary run rows" on a branch starting with "l7-"; do not merge it. Edit only the lines inside your own STATUS.md slot (SLOT:L7 BEGIN/END). Depends on: L6. If a dependency is not merged on main yet, stop and say so instead of working around it. Never merge or rebuild your branch from an older base: before opening or updating the PR, run `git fetch origin main && git diff --diff-filter=D --name-only origin/main...HEAD`; it must list only your owned paths, otherwise stop and say so (the scope guard fails the PR anyway). New pages register through frontend/src/routes (G2) and new REST routers expose register(app) (G3); never edit App.tsx or services/rest_api/main.py unless your brief owns them.

## Job
Make the library importer's runs loop accept the run rows the musicLibrary export actually sends, so POST /api/v1/library/ingest no longer fails and the library imports.

## Context (verified on main 2026-10-26)
On the owner's laptop on 28 Oct 2026, POST /api/v1/library/ingest with the musicLibrary export (outputs/artifact/library.json, 339 tracks) queued a job that died after 3 attempts:
`NotNullViolationError: null value in column "run_date" of relation "runs" violates not-null constraint` (failing row `(3, null, null, {}, 2026-10-28 04:35:31+00)`). The import is one transaction, so nothing was written and library.tracks is still 0.

services/library/importer/import_library.py, the `for run in payload.get('runs', [])` loop, reads run_date, status and metrics. The export sends runs like this (real rows):
```json
"runs": [
  {"date": "2026-10-24", "added": 25, "demoted": 0, "archived": 0, "promoted": 0, "rejected": 234, "review_queue": 319},
  {"date": "2026-10-27", "added": 20, "demoted": 0, "archived": 0, "promoted": 0, "rejected": 7, "review_queue": 339}
]
```
library.runs (sql/migrations/101_library_schema_up.sql) requires run_date timestamptz NOT NULL and status text NOT NULL; metrics jsonb is optional.

## Owned paths
- services/library/importer/import_library.py (the runs loop and one small helper next to it only)
- tests/library_importer/test_import_library.py (add tests; do not change existing ones)
- contracts/library_ingest.md (one short paragraph on the accepted run shapes)

(Complete list. Anything else is read-only for you. You may also add a dated note under docs/integration/L7/ if you need to record a decision.)

## Do
1. run_date = run['run_date'], else run['date']. A date-only value such as 2026-10-24 is a Melbourne calendar date: store it as midnight Australia/Melbourne (zoneinfo).
2. status = run['status'], else 'completed'.
3. metrics = run['metrics'] if present, else every remaining key of the run except date, run_date, status, metrics, created_at (so the counts above land in metrics).
4. A run with no usable date is skipped, counted in a new stats['runs']['skipped'] (initialise it next to inserted/unchanged), and logged at warning level with its index. It must not fail the import.
5. Keep the existing idempotency (WHERE NOT EXISTS ... run_date = $1) so re-posting the same export inserts nothing new. Do not change any other section of _process_payload; if other sections' keys look mismatched with the export, list them under Follow-ups in the PR.
6. Tests, in the existing mock_conn style, asserting on the fetchval arguments: (1) the two export rows give two inserts at Melbourne midnight, status 'completed', metrics holding added, demoted, archived, promoted, rejected, review_queue; (2) the canonical shape (run_date, status, metrics) passes through unchanged; (3) a run with neither date nor run_date is skipped and counted while the others import.

## Done when (the reviewer's under-10-minute check; put it in the PR)
`python -m pytest tests/library_importer -q` passes with the three new tests. In the PR, the laptop step: rebuild and restart rest-api and worker, re-post the export with a new Idempotency-Key, then `SELECT count(*) FROM library.runs;` returns 2 and library.tracks returns 339.

## Checks
`python -m pytest tests/library_importer tests/contracts -q` from the repo root; `ruff check services/library/importer tests/library_importer` if ruff is configured. Report failures in files you do not own; do not fix them.

## Hand-back
The one job done, files added/changed/deleted, checks run and not run, the reviewer check, follow-ups.
