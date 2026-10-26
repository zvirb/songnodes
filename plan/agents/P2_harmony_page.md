P2: Harmony: one Camelot page

Base: main at BASE_SHA. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md (one job, owned paths only, about 400 changed lines at most, verify then commit, two attempts then stop, rebase before the PR) and CLAUDE.md; the design system rules apply to any UI change. No access to the user's laptop, local data or secrets; work from the repo and fixtures. Open one PR against main titled "P2: Harmony: one Camelot page" on a branch starting with "p2-"; do not merge it. Edit only the lines inside your own STATUS.md slot (SLOT:P2 BEGIN/END). Depends on: G2, R1. If a dependency is not merged on main yet, stop and say so instead of working around it.

## Job
Leave exactly one Camelot page at /harmony.

## Context (verified on main 2026-10-26)
Two exist: frontend/src/pages/CamelotPage.tsx (448 lines, routed at /harmony) and frontend/src/features/camelot/CamelotPage.tsx (336 lines, FE5 PR #98, unrouted, with a TEMP_useUnifiedTracks.ts).

## Owned paths
- frontend/src/pages/CamelotPage.tsx
- frontend/src/features/camelot/**
- frontend/src/routes/registry.tsx (only removing the static /harmony entry)

(Complete list. Anything else is read-only for you. You may also add a dated note under docs/integration/P2/ if you need to record a decision.)

## Do
1. Put a comparison table in the PR: features of each, data source, tests, design-system state.
2. Keep the better base (prefer the one in features/ if it is not clearly worse). Port only user-visible features the other has, within the diff budget; list the rest as follow-ups.
3. Register /harmony from features/camelot/route.tsx, remove the static entry, delete the page you did not keep, and switch to the shared hook (delete the TEMP copy).

## Done when (the reviewer's under-10-minute check; put it in the PR)
Open /harmony: one page renders; the PR table says what was kept and what was dropped.

## Checks
`cd frontend && npm ci && npx tsc --noEmit -p . && npx oxlint src && npx vitest run src && npx vite build` (Node 26, TypeScript 7, Oxlint; see frontend/LINTING.md). Lint must not get worse in files you touch. Report failures in files you do not own; do not fix them. Playwright cannot run in your sandbox; say so.

## Hand-back
The one job done, files added/changed/deleted, checks run and not run, the reviewer check, follow-ups.
