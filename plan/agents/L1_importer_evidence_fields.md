L1: Library importer: write only allowed evidence fields

Base: main at BASE_SHA. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md (one job, owned paths only, about 400 changed lines at most, verify then commit, two attempts then stop, rebase before the PR) and CLAUDE.md; the design system rules apply to any UI change. No access to the user's laptop, local data or secrets; work from the repo and fixtures. Open one PR against main titled "L1: Library importer: write only allowed evidence fields" on a branch starting with "l1-"; do not merge it. Edit only the lines inside your own STATUS.md slot (SLOT:L1 BEGIN/END). Depends on: nothing. If a dependency is not merged on main yet, stop and say so instead of working around it. Never merge or rebuild your branch from an older base: before opening or updating the PR, run `git fetch origin main && git diff --diff-filter=D --name-only origin/main...HEAD`; it must list only your owned paths, otherwise stop and say so (the scope guard fails the PR anyway). New pages register through frontend/src/routes (G2) and new REST routers expose register(app) (G3); never edit App.tsx or services/rest_api/main.py unless your brief owns them.

## Job
Make the library importer record evidence only under field names the evidence table accepts.

## Context (verified on main 2026-10-26)
PR #158's services/library/importer/import_library.py (around line 50) records evidence for 'label' and 'release_year'. silver_track_metadata_evidence.field has a CHECK (sql/migrations/014_data_layer_up.sql line 78) that allows bpm, key, energy, isrc, duration_ms, mix_name, genre, record_label, tidal_id, deezer_id and musicbrainz_id, so an import with either field fails the whole transaction.

## Owned paths
- services/library/importer/import_library.py
- tests/library_importer/**

(Complete list. Anything else is read-only for you. You may also add a dated note under docs/integration/L1/ if you need to record a decision.)

## Do
1. Record the source's 'label' as 'record_label'.
2. Do not record 'release_year' as evidence (there is no such field); count it as skipped in the returned stats and log it once per run. Do not change the CHECK.
3. Test with a fake connection: a track with label and release_year records record_label, skips release_year, and every recorded field is in the allowed list.

## Done when (the reviewer's under-10-minute check; put it in the PR)
The test lists the fields the importer records for a fully populated fixture track; all are in the CHECK list.

## Checks
`python -m pytest` for the paths you own, from the repo root. Report failures in files you do not own; do not fix them.

## Hand-back
The one job done, files added/changed/deleted, checks run and not run, the reviewer check, follow-ups.
