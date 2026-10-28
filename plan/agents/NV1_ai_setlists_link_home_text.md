NV1: Link to AI setlists and refresh the Home text

Base: main at BASE_SHA. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md (one job, owned paths only, about 400 changed lines at most, verify then commit, two attempts then stop, rebase before the PR) and CLAUDE.md; the design system rules apply to any UI change. No access to the user's laptop, local data or secrets; work from the repo and fixtures. Open one PR against main titled "NV1: Link to AI setlists and refresh the Home text" on a branch starting with "nv1-"; do not merge it. Edit only the lines inside your own STATUS.md slot (SLOT:NV1 BEGIN/END). Depends on: nothing. If a dependency is not merged on main yet, stop and say so instead of working around it. Never merge or rebuild your branch from an older base: before opening or updating the PR, run `git fetch origin main && git diff --diff-filter=D --name-only origin/main...HEAD`; it must list only your owned paths, otherwise stop and say so (the scope guard fails the PR anyway). New pages register through frontend/src/routes (G2) and new REST routers expose register(app) (G3); never edit App.tsx or services/rest_api/main.py unless your brief owns them.

## Job
Make the AI setlists import page (/sources/import) reachable from the app, and correct the Home page's out-of-date Pipeline text.

## Context (verified on main 2026-10-28)
/sources/import is registered only in frontend/src/features/aiSetlists/route.tsx:7 (AISetlistsPage, header "Sources: Import tracklist", current 'sources'); no link anywhere in the app points to it. The NavDrawer (frontend/src/shell/AppShell.tsx 30-35 and 60-70) renders one row per module from MODULE_ROUTES (frontend/src/lib/songnodes.tsx 29-38), and design-system/components/NavDrawer/README.md fixes the rows: module rows only, "Do keep the group order and row order fixed". So the drawer keeps its single Sources row (which highlights on /sources/import already); the way in is from the Sources module. /sources redirects to /sources/targets, rendered by SourcesPage in frontend/src/pages/ModulePages.tsx 12-22. frontend/src/pages/HomePage.tsx:53 says "live job and worker telemetry is not connected", which is false now: /pipeline reads /api/v1/jobs and /api/v1/outbox/status (frontend/src/features/pipeline/usePipelineTelemetry). HomePage.tsx:50 Sources summary does not mention imports. Do not touch aiSetlists/**, AppShell.tsx or lib/songnodes.tsx. Design system: read design-system/README.md and the cards in design-system/api/components/ for every component you use; UI copy is en-AU, sentence case, no emoji, missing values an en dash (`sn-none`), numbers, durations and dates through `SN.format`, keys through `SN.camelot`/`keyName`; tokens (`var(--…)`) and `sn-*` classes only, no hex, rgb(), named colours, px font sizes or raw z-index; never `alert`/`confirm`, one primary button per view.

## Owned paths
- frontend/src/pages/HomePage.tsx
- frontend/src/pages/ModulePages.tsx (SourcesPage only)
- frontend/src/pages/HomePage.test.tsx (new)
- frontend/src/pages/ModulePages.test.tsx (new)

(Complete list. Anything else is read-only for you. You may also add a dated note under docs/integration/NV1/ if you need to record a decision.)

## Do
1. SourcesPage: add a link in the PageHeader `desc` or `actions` (a react-router Link styled as the design-system TextLink, `sn-link sn-m-sources`, with the `file-input` icon (design-system/14-identity-icons.md:92, through `SnIcon`) plus words): "Import a tracklist with AI" to /sources/import. Not a primary button and not a tab.
2. HomePage Sources LauncherCard (line 47-52): the fallback summary becomes "Target tracks, tracklist imports and AI setlists." and keep the weekly-run summary when there is one.
3. HomePage Pipeline LauncherCard (line 53): replace the summary with true text, for example "Queue scrapes and watch jobs, workers and the medallion stages live."
4. Record in docs/integration/NV1/ that a separate drawer row was not added because the NavDrawer rows are fixed module rows; a dedicated row would be a design-system change under design-system/17-governance.md.
5. Tests (jsdom, MemoryRouter): SourcesPage has a link named "Import a tracklist with AI" whose href is /sources/import; HomePage no longer contains "not connected".

## Done when (the reviewer's under-10-minute check; put it in the PR)
Open http://127.0.0.1:3006/, open the menu, choose Sources: the Target tracks page shows "Import a tracklist with AI"; following it opens the Import tracklist page with Sources marked current in the drawer. Back on Home, the Pipeline card no longer says telemetry is not connected.

## Checks
`cd frontend && npx tsc --noEmit -p . && npx oxlint src && npx vitest run src && npx vite build` and `PYTHONUTF8=1 bash scripts/sync-design-system.sh --check`. Report failures in files you do not own; do not fix them.

## Hand-back
The one job done, files added/changed/deleted, checks run and not run, the reviewer check, follow-ups.
