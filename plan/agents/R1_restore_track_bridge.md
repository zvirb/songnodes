R1: Restore the unified track data bridge

Base: main at BASE_SHA. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md (one job, owned paths only, about 400 changed lines at most, verify then commit, two attempts then stop, rebase before the PR) and CLAUDE.md; the design system rules apply to any UI change. No access to the user's laptop, local data or secrets; work from the repo and fixtures. Open one PR against main titled "R1: Restore the unified track data bridge" on a branch starting with "r1-"; do not merge it. Edit only the lines inside your own STATUS.md slot (SLOT:R1 BEGIN/END). Depends on: nothing. If a dependency is not merged on main yet, stop and say so instead of working around it.

## Job
Bring back the FE1 track bridge files that a later merge deleted, so pages can share one track hook again.

## Context (verified on main 2026-10-26)
FE1 (PR #91, commit 541ee5e) added frontend/src/hooks/useUnifiedTracks.ts, frontend/src/services/trackSyncAdapter.ts, frontend/src/services/unifiedTrackService.ts (+ .test.ts) and frontend/src/types/unifiedTrack.ts. The stale duplicate WP0 merge (PR #93, d4ca595) deleted the first four; types/unifiedTrack.ts survived and has changed since. Pages now carry local copies (features/aiSetlists/TEMP_useUnifiedTracks.ts, features/camelot/TEMP_useUnifiedTracks.ts, features/pathfinder/useUnifiedTracks.ts once R2 lands); do not touch them, P1 to P3 switch them over.

## Owned paths
- frontend/src/hooks/useUnifiedTracks.ts
- frontend/src/services/trackSyncAdapter.ts
- frontend/src/services/unifiedTrackService.ts
- frontend/src/services/unifiedTrackService.test.ts
- frontend/src/types/unifiedTrack.ts (reconcile only; keep every field now on main)

(Complete list. Anything else is read-only for you. You may also add a dated note under docs/integration/R1/ if you need to record a decision.)

## Do
1. `git checkout 541ee5e -- frontend/src/hooks/useUnifiedTracks.ts frontend/src/services/trackSyncAdapter.ts frontend/src/services/unifiedTrackService.ts frontend/src/services/unifiedTrackService.test.ts`.
2. Diff 541ee5e:frontend/src/types/unifiedTrack.ts against main; keep main's version and adapt the restored files to it. Never remove a field.
3. Fix only compile errors inside the owned files. If an import target no longer exists anywhere, stop and report it.
4. Commit the restore and the reconciliation as two commits.

## Done when (the reviewer's under-10-minute check; put it in the PR)
`npx vitest run src/services/unifiedTrackService.test.ts` passes; `git show --stat HEAD~1` shows only the four restored files.

## Checks
`cd frontend && npm ci && npx tsc --noEmit -p . && npx vitest run src && npx vite build`. If `npm ci` fails on the lockfile (QA2 not merged yet), use `npm install --no-package-lock` instead, say so, and never commit package-lock.json. Report failures in files you do not own; do not fix them. Playwright cannot run in your sandbox; say so.

## Hand-back
The one job done, files added/changed/deleted, checks run and not run, the reviewer check, follow-ups.
