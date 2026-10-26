L1: Library overlay: models and views

Base: main at BASE_SHA. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md (one job, owned paths only, about 400 changed lines at most, verify then commit, two attempts then stop, rebase before the PR) and CLAUDE.md; the design system rules apply to any UI change. No access to the user's laptop, local data or secrets; work from the repo and fixtures. Open one PR against main titled "L1: Library overlay: models and views" on a branch starting with "l1-"; do not merge it. Edit only the lines inside your own STATUS.md slot (SLOT:L1 BEGIN/END). Depends on: nothing. If a dependency is not merged on main yet, stop and say so instead of working around it.

## Job
Add the models and views for the WP0 library overlay schema, with no importer and no endpoints.

## Context (verified on main 2026-10-26)
WP0 created the library overlay schema (sql/migrations/101_library_schema_up.sql) and the library fixture under contracts/. The musicLibrary SQLite views being replaced are v_crates, v_source_yield, v_review_queue and v_buy_list. Library-only concepts: rotation status and locks, crate, energy score with auto and override parts, tier, tags, source appearances, chart positions, saved sets. Migrations 180-189 are yours (WP5's range was 180-219; L2, L4 use 190-209).

## Owned paths
- services/library/__init__.py
- services/library/model/**
- sql/migrations/18[0-9]_*
- tests/library_model/**

(Complete list. Anything else is read-only for you. You may also add a dated note under docs/integration/L1/ if you need to record a decision.)

## Do
1. Repositories for the overlay tables (read and write) following the datalayer conventions in services/common/datalayer.
2. Views equivalent to the four SQLite views as migrations 180-189, up and down.
3. An energy_model field and registry with only a passthrough of today's score (a later package plugs in a new model).
4. Tests on the WP0 fixture against a throwaway Postgres if your sandbox can start one; otherwise say so and test the SQL text.

## Done when (the reviewer's under-10-minute check; put it in the PR)
Views return the same crate counts as the fixture's v_crates; up/down migrations apply cleanly.

## Checks
`python -m pytest` for the paths you own, from the repo root. Report failures in files you do not own; do not fix them.

## Hand-back
The one job done, files added/changed/deleted, checks run and not run, the reviewer check, follow-ups.
