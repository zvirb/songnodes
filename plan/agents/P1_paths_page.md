P1: Route /paths to the route finder page

Base: main at BASE_SHA. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md (one job, owned paths only, about 400 changed lines at most, verify then commit, two attempts then stop, rebase before the PR) and CLAUDE.md; the design system rules apply to any UI change. No access to the user's laptop, local data or secrets; work from the repo and fixtures. Open one PR against main titled "P1: Route /paths to the route finder page" on a branch starting with "p1-"; do not merge it. Edit only the lines inside your own STATUS.md slot (SLOT:P1 BEGIN/END). Depends on: G2, R1, R2. If a dependency is not merged on main yet, stop and say so instead of working around it.

## Job
Make /paths open the restored route finder page, using the shared track hook.

## Context (verified on main 2026-10-26)
After R2 the page is back in features/pathfinder with a local useUnifiedTracks.ts; after R1 the shared hook is at frontend/src/hooks/useUnifiedTracks.ts; after G2 a feature registers its route in its own route.tsx.

## Owned paths
- frontend/src/features/pathfinder/**

(Complete list. Anything else is read-only for you. You may also add a dated note under docs/integration/P1/ if you need to record a decision.)

## Do
1. Add features/pathfinder/route.tsx exporting the /paths route (it replaces the static placeholder through the registry).
2. Switch the page to the shared hook and delete the local useUnifiedTracks.ts.
3. Check the page's empty and error states are honest (no data: say so and point to the library; API error: name it).

## Done when (the reviewer's under-10-minute check; put it in the PR)
Open /paths: the route finder renders; with the backend down it shows an error that names the cause, not an empty result.

## Checks
`cd frontend && npm ci && npx tsc --noEmit -p . && npx vitest run src && npx vite build`. If `npm ci` fails on the lockfile (QA2 not merged yet), use `npm install --no-package-lock` instead, say so, and never commit package-lock.json. Report failures in files you do not own; do not fix them. Playwright cannot run in your sandbox; say so.

## Hand-back
The one job done, files added/changed/deleted, checks run and not run, the reviewer check, follow-ups.
