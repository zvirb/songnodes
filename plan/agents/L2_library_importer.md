L2: Library importer: SQLite into silver and the overlay

Base: main at BASE_SHA. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md (one job, owned paths only, about 400 changed lines at most, verify then commit, two attempts then stop, rebase before the PR) and CLAUDE.md; the design system rules apply to any UI change. No access to the user's laptop, local data or secrets; work from the repo and fixtures. Open one PR against main titled "L2: Library importer: SQLite into silver and the overlay" on a branch starting with "l2-"; do not merge it. Edit only the lines inside your own STATUS.md slot (SLOT:L2 BEGIN/END). Depends on: L1. If a dependency is not merged on main yet, stop and say so instead of working around it.

## Job
Add `python -m library.importer --sqlite <path>`: an idempotent import of the musicLibrary SQLite into silver plus the overlay.

## Context (verified on main 2026-10-26)
Use the existing datalayer helpers: datalayer.ingest (resolve_artist, upsert_track) and datalayer.evidence.record for ISRC, TIDAL/Deezer ids, genre, label and release year as evidence from source musiclibrary; never overwrite stronger values. Identifiers: (source_system='musiclibrary', source_id=track_id) and norm_key, per contracts/ids.md. Real counts on 24 Oct 2026 (owner-side check only): tracks 319, appearances 325, chart_positions 10, rotation_history 319.

## Owned paths
- services/library/importer/**
- tests/library_importer/**
- sql/migrations/19[0-9]_* (only if needed)

(Complete list. Anything else is read-only for you. You may also add a dated note under docs/integration/L2/ if you need to record a decision.)

## Do
1. One transaction per chunk; per-table counts printed; refuse if the SQLite integrity check fails; a second run changes 0 rows.
2. Tests on the WP0 library fixture; the real file is an owner step: give the exact command in the PR.

## Done when (the reviewer's under-10-minute check; put it in the PR)
Run the importer twice on the fixture: counts match, second run reports 0 changes.

## Checks
`python -m pytest` for the paths you own, from the repo root. Report failures in files you do not own; do not fix them.

## Hand-back
The one job done, files added/changed/deleted, checks run and not run, the reviewer check, follow-ups.
