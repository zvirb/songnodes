PF1: Paths: make Find route work

Base: main at BASE_SHA. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md (one job, owned paths only, about 400 changed lines at most, verify then commit, two attempts then stop, rebase before the PR) and CLAUDE.md; the design system rules apply to any UI change. No access to the user's laptop, local data or secrets; work from the repo and fixtures. Open one PR against main titled "PF1: Paths: make Find route work" on a branch starting with "pf1-"; do not merge it. Edit only the lines inside your own STATUS.md slot (SLOT:PF1 BEGIN/END). Depends on: nothing. If a dependency is not merged on main yet, stop and say so instead of working around it. Never merge or rebuild your branch from an older base: before opening or updating the PR, run `git fetch origin main && git diff --diff-filter=D --name-only origin/main...HEAD`; it must list only your owned paths, otherwise stop and say so (the scope guard fails the PR anyway). New pages register through frontend/src/routes (G2) and new REST routers expose register(app) (G3); never edit App.tsx or services/rest_api/main.py unless your brief owns them.

## Job
Make the Find route button on /paths return a route: send the graph's tracks and edges with the request, and show the server's error as readable text instead of "[object Object]".

## Context (verified on main 2026-10-28)
/paths renders frontend/src/features/pathfinder/PathfinderPage.tsx, which drives the XState machine in frontend/src/components/PathfinderPanel/pathfinder.machine.ts through usePathfinder() (PathfinderPanel/hooks.ts). calculatePath() (machine lines 30-62) builds the body at lines 34-46 without `tracks` or `edges`; services/rest_api/routers/pathfinder.py lines 84-85 declare both required, so FastAPI answers 422 with `detail` as an array, and line 58 does `new Error(errorData.detail)`, which renders "[object Object]" in the ErrorPanel at PathfinderPage.tsx 202-205. The Graph page's Pathfinder tab works: frontend/src/components/PathfinderPanel.tsx lines 81-101 sends `tracks: routeTracksFromNodes(graphData.nodes)` (frontend/src/utils/trackMetadata.ts:115, throws when a duration is unknown) and edges mapped `{from_id: edge.source, to_id: edge.target, weight: edge.weight || 1.0, connection_type: edge.type || 'sequential'}`. The hook's `availableTracks` is `graphData.nodes` from the store (hooks.ts:94), which only fills when something calls frontend/src/hooks/useDataLoader.ts (today only DJInterface does), so on a cold load of /paths the pickers may find no graph node to select. Design system: read design-system/README.md and the cards in design-system/api/components/ for every component you use; UI copy is en-AU, sentence case, no emoji, missing values an en dash (`sn-none`), numbers, durations and dates through `SN.format`, keys through `SN.camelot`/`keyName`; tokens (`var(--…)`) and `sn-*` classes only, no hex, rgb(), named colours, px font sizes or raw z-index; never `alert`/`confirm`, one primary button per view.

## Owned paths
- frontend/src/components/PathfinderPanel/pathfinder.machine.ts
- frontend/src/components/PathfinderPanel/pathfinder.machine.test.ts
- frontend/src/components/PathfinderPanel/types.ts (the CALCULATE_PATH event and context fields only)
- frontend/src/components/PathfinderPanel/hooks.ts
- frontend/src/features/pathfinder/PathfinderPage.tsx
- frontend/src/features/pathfinder/PathfinderPage.test.tsx

(Complete list. Anything else is read-only for you. You may also add a dated note under docs/integration/PF1/ if you need to record a decision.)

## Do
1. CALCULATE_PATH carries `tracks` and `edges` (the server's TrackNode and GraphEdge shapes); the machine keeps them in context and calculatePath sends them. PathfinderRequest does not declare min_bpm, max_bpm, allowed_keys or max_energy_change (Pydantic ignores them); remove them from the body so it matches the server. Leave pathfinder.py untouched.
2. hooks.ts exposes `calculate()`: builds tracks from graphData.nodes with routeTracksFromNodes, skipping nodes whose duration is unknown (count them), and edges with the same mapping as PathfinderPanel.tsx 85-90, then sends CALCULATE_PATH. No graph nodes: set a plain error "The graph has not loaded yet." instead of calling the server.
3. PathfinderPage calls useDataLoader() when the store has no graph nodes, uses `pf.calculate()` for the Find route button, and shows the skipped count with SN.format.count ("12 tracks left out: no duration").
4. errorMessage(): a string `detail` is used as is; an array `detail` becomes the `msg` values joined with "; "; anything else becomes "Pathfinding failed (HTTP <status>)". Never render an object.
5. Tests: the machine posts `tracks` and `edges`; a 422 with array detail gives a readable message; the page shows the error text; nodes without duration are skipped and counted.

## Done when (the reviewer's under-10-minute check; put it in the PR)
With the stack running, open http://127.0.0.1:3006/paths fresh (no Graph visit first), pick a start and an end track, press Find route: a route with tracks, total duration and transitions appears, or a sentence such as "No path found…" from the server. Never "[object Object]"; the network tab shows the POST body with non-empty `tracks` and `edges`.

## Checks
`cd frontend && npx tsc --noEmit -p . && npx oxlint src && npx vitest run src && npx vite build` and `PYTHONUTF8=1 bash scripts/sync-design-system.sh --check`. Report failures in files you do not own; do not fix them.

## Hand-back
The one job done, files added/changed/deleted, checks run and not run, the reviewer check, follow-ups.
