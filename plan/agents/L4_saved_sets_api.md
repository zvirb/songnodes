L4: Saved sets endpoints

Base: main at BASE_SHA. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md (one job, owned paths only, about 400 changed lines at most, verify then commit, two attempts then stop, rebase before the PR) and CLAUDE.md; the design system rules apply to any UI change. No access to the user's laptop, local data or secrets; work from the repo and fixtures. Open one PR against main titled "L4: Saved sets endpoints" on a branch starting with "l4-"; do not merge it. Edit only the lines inside your own STATUS.md slot (SLOT:L4 BEGIN/END). Depends on: L1, G3. If a dependency is not merged on main yet, stop and say so instead of working around it.

## Job
Add GET /api/v1/library/sets, PUT and DELETE /api/v1/library/sets/{id} and GET /api/v1/library/sets/export.

## Context (verified on main 2026-10-26)
The document shape matches the set builder artifact's saved sets (frontend/src/features/musicLibrary/storage.ts shows it). Routers expose register(app) and are discovered by G3.

## Owned paths
- services/rest_api/routers/library_sets.py
- services/library/sets/**
- tests/library_sets/**
- sql/migrations/20[0-9]_* (only if needed)

(Complete list. Anything else is read-only for you. You may also add a dated note under docs/integration/L4/ if you need to record a decision.)

## Do
1. Repository on the L1 overlay tables; validation; 404 and 409 handling.
2. Export returns the same shape the frontend's storage.ts reads.

## Done when (the reviewer's under-10-minute check; put it in the PR)
TestClient: create, list, replace, delete and export one set.

## Checks
`python -m pytest` for the paths you own, from the repo root. Report failures in files you do not own; do not fix them.

## Hand-back
The one job done, files added/changed/deleted, checks run and not run, the reviewer check, follow-ups.
