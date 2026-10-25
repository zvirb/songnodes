E3: Enrichment replay and coverage report

Base: main at BASE_SHA. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md (one job, owned paths only, about 400 changed lines at most, verify then commit, two attempts then stop, rebase before the PR) and CLAUDE.md; the design system rules apply to any UI change. No access to the user's laptop, local data or secrets; work from the repo and fixtures. Open one PR against main titled "E3: Enrichment replay and coverage report" on a branch starting with "e3-"; do not merge it. Edit only the lines inside your own STATUS.md slot (SLOT:E3 BEGIN/END). Depends on: E1, E2. If a dependency is not merged on main yet, stop and say so instead of working around it.

## Job
Run the library fixture through enrichment twice (local provider off, then on) and report coverage and web calls per field.

## Context (verified on main 2026-10-26)
E1 adds the local provider; E2 logs web calls. Real data (the owner's resolved items file) is an owner step.

## Owned paths
- tests/enrichment_local/replay/**
- docs/integration/WP4/replay.md

(Complete list. Anything else is read-only for you. You may also add a dated note under docs/integration/E3/ if you need to record a decision.)

## Do
1. Replay against recorded or stubbed HTTP; per-field coverage before and after; web calls by provider before and after.
2. Report every field, including ones that did not improve. Give the exact owner command for the real file.

## Done when (the reviewer's under-10-minute check; put it in the PR)
The replay table is in docs/integration/WP4/replay.md with fixture numbers labelled as fixture.

## Checks
`python -m pytest` for the paths you own, from the repo root. Report failures in files you do not own; do not fix them.

## Hand-back
The one job done, files added/changed/deleted, checks run and not run, the reviewer check, follow-ups.
