TX1C: Remove the saved set's TIDAL weekly-run flag

Base: main at 2427bf9. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md (one job, owned paths only, about 400 changed lines at most, verify then commit, two attempts then stop, rebase before the PR) and CLAUDE.md; the design system rules apply to any UI change. No access to the user's laptop, local data or secrets; work from the repo and fixtures. Open one PR against main titled "TX1C: Remove the saved set's TIDAL weekly-run flag" on a branch starting with "tx1c-"; do not merge it. Edit only the lines inside your own STATUS.md slot (SLOT:TX1C BEGIN/END, added at the end of the file if missing). Depends on: TX1 (#394, merged). If a dependency is not merged on main yet, stop and say so instead of working around it. Never merge or rebuild your branch from an older base: before opening or updating the PR, run `git fetch origin main && git diff --diff-filter=D --name-only origin/main...HEAD`; it must list only your owned paths, otherwise stop and say so (the scope guard fails the PR anyway). New pages register through frontend/src/routes (G2) and new REST routers expose register(app) (G3); never edit App.tsx or services/rest_api/main.py unless your brief owns them.

## Job
Remove the set-level `tidal` flag from SavedSet and the set builder draft.

## Context (verified on main 2427bf9, 1 Nov 2026)
TX1 replaced "Send to TIDAL on the weekly run" with an instant Send to TIDAL dialog (frontend/src/features/setBuilder/sendToTidal.ts). The old boolean still exists: `SavedSet.tidal` (frontend/src/features/musicLibrary/data.ts, about line 155), `Draft.tidal` and its three copies in frontend/src/features/musicLibrary/setBuilder.ts (about lines 271, 279, 476, 485, 502), and the copy in frontend/src/features/musicLibrary/SetBuilderPage.tsx (about line 209). Keep `SavedSetTrack.tidal` and `LibraryTrack.tidal`: they are the track's TIDAL link and Send to TIDAL and the exporters use them. The weekly run that read the flag lives in the owner's musicLibrary folder, not in this repo (pipeline/run_weekly.py has no TIDAL set step), so removing that step is the owner's follow-up.

## Owned paths
- frontend/src/features/musicLibrary/data.ts (the SavedSet interface only)
- frontend/src/features/musicLibrary/setBuilder.ts (the Draft type and its mappings only)
- frontend/src/features/musicLibrary/SetBuilderPage.tsx (the copy-set line only)
- frontend/src/pages/HomePage.tsx (the Sets launcher figure only: it was the flag's only reader)
- frontend/tests/e2e/visual.spec.ts-snapshots/home-*-phone-chromium-linux.png (the Sets card loses its figure)
- frontend/src/features/musicLibrary/data.test.ts
- frontend/src/features/musicLibrary/setBuilder.test.ts
- frontend/src/features/setBuilder/ExportDialog.test.tsx
- frontend/src/features/setBuilder/exporters.test.ts
- frontend/src/features/setBuilder/sendToTidal.test.ts

(Complete list. Anything else is read-only for you. You may also add a dated note under docs/integration/TX1C/ if you need to record a decision.)

## Do
1. Remove the set-level `tidal` field from SavedSet and Draft and every place that sets or copies it. Old stored sets that still carry `tidal` load without error (the field is ignored).
2. In the test files, change only the set-level `tidal:` lines; track-level `tidal` stays.
3. Say in the PR that the owner removes the weekly run's TIDAL step in the musicLibrary folder.

## Done when (the reviewer's under-10-minute check; put it in the PR)
`git grep -n "tidal: false\|tidal: true\|tidal: !!" frontend/src` finds nothing; on /sets, save, copy, open and Send to TIDAL still work.

## Checks
`cd frontend && npx tsc --noEmit -p . && npx oxlint src && npx vitest run src && npx vite build`; `PYTHONUTF8=1 bash scripts/sync-design-system.sh --check`; `python3 scripts/check_design_system.py --check`; `python3 scripts/check_feature_imports.py --check`. Report failures in files you do not own; do not fix them.

## Hand-back
The one job done, files added/changed/deleted, checks run and not run, the reviewer check, follow-ups.
