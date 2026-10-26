L5: Library reconciliation report

Base: main at BASE_SHA. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md (one job, owned paths only, about 400 changed lines at most, verify then commit, two attempts then stop, rebase before the PR) and CLAUDE.md; the design system rules apply to any UI change. No access to the user's laptop, local data or secrets; work from the repo and fixtures. Open one PR against main titled "L5: Library reconciliation report" on a branch starting with "l5-"; do not merge it. Edit only the lines inside your own STATUS.md slot (SLOT:L5 BEGIN/END). Depends on: L2. If a dependency is not merged on main yet, stop and say so instead of working around it. Never merge or rebuild your branch from an older base: before opening or updating the PR, run `git fetch origin main && git diff --diff-filter=D --name-only origin/main...HEAD`; it must list only your owned paths, otherwise stop and say so (the scope guard fails the PR anyway). New pages register through frontend/src/routes (G2) and new REST routers expose register(app) (G3); never edit App.tsx or services/rest_api/main.py unless your brief owns them.

## Job
Report candidate duplicate tracks between the imported library and existing silver. Never merge anything.

## Context (verified on main 2026-10-26)
Merging is identity.merge_tracks, a human decision. Match by ISRC, by norm_key and, when resolver data is present, by MBID.

## Owned paths
- services/library/reconcile/**
- tests/library_reconcile/**

(Complete list. Anything else is read-only for you. You may also add a dated note under docs/integration/L5/ if you need to record a decision.)

## Do
1. A CLI that prints and writes a CSV of candidates with the evidence for each.
2. Tests on the fixture with planted duplicates.

## Done when (the reviewer's under-10-minute check; put it in the PR)
The fixture run lists the planted duplicates and changes no rows.

## Checks
`python -m pytest` for the paths you own, from the repo root. Report failures in files you do not own; do not fix them.

## Hand-back
The one job done, files added/changed/deleted, checks run and not run, the reviewer check, follow-ups.
