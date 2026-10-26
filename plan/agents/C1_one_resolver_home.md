C1: One home for the local MusicBrainz resolver

Base: main at BASE_SHA. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md (one job, owned paths only, about 400 changed lines at most, verify then commit, two attempts then stop, rebase before the PR) and CLAUDE.md; the design system rules apply to any UI change. No access to the user's laptop, local data or secrets; work from the repo and fixtures. Open one PR against main titled "C1: One home for the local MusicBrainz resolver" on a branch starting with "c1-"; do not merge it. Edit only the lines inside your own STATUS.md slot (SLOT:C1 BEGIN/END). Depends on: nothing. If a dependency is not merged on main yet, stop and say so instead of working around it. Never merge or rebuild your branch from an older base: before opening or updating the PR, run `git fetch origin main && git diff --diff-filter=D --name-only origin/main...HEAD`; it must list only your owned paths, otherwise stop and say so (the scope guard fails the PR anyway). New pages register through frontend/src/routes (G2) and new REST routers expose register(app) (G3); never edit App.tsx or services/rest_api/main.py unless your brief owns them.

## Job
Remove the duplicate copy of the WP3 resolver so there is exactly one implementation.

## Context (verified on main 2026-10-26)
WP3 (PR #142) wrote services/reference-data/resolver/resolver.py (292 lines) and services/reference_data/resolver/{__init__, loader, resolver}.py (238 lines). contracts/ownership.yaml gives wp3 the hyphenated path, but Python cannot import a hyphenated package. ref_mb lives in its own read-only database (docs/integration/ref_mb/DECISION.md, settings in services/common/refmb/settings.py, gated by MB_LOCAL_ENABLED).

## Owned paths
- services/reference-data/resolver/**
- services/reference_data/**
- tests/resolver/**
- contracts/ownership.yaml (the wp3 entry only)

(Complete list. Anything else is read-only for you. You may also add a dated note under docs/integration/C1/ if you need to record a decision.)

## Do
1. Find which copy is imported (grep imports, tests/resolver, Dockerfiles, compose files) and diff the two.
2. Keep the imported copy. Carry over anything that exists only in the other copy (list each item in the PR); then delete the other copy.
3. Point the wp3 entry in contracts/ownership.yaml at the kept path.
4. Report, do not fix: whether the kept resolver reads from the ref_mb connection settings and honours MB_LOCAL_ENABLED.

## Done when (the reviewer's under-10-minute check; put it in the PR)
One resolver folder remains; `python -m pytest tests/resolver` passes; grep shows no import of the deleted path.

## Checks
`python -m pytest` for the paths you own, from the repo root. Report failures in files you do not own; do not fix them.

## Hand-back
The one job done, files added/changed/deleted, checks run and not run, the reviewer check, follow-ups.
