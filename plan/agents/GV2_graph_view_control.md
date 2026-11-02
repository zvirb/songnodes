GV2: Graph View choice on /graph

Base: main at 884a3400 (GR1 #509, GR2 #513, GV1 #531, GV3 #533 merged). Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md and CLAUDE.md; the design system (1.9.0, GraphControls → View, DR-057) decides every UI question. Open one PR titled "GV2: Graph View choice on /graph" on a branch starting with "gv2-". Edit only the lines inside your own STATUS.md slot (SLOT:GV2).

## Job
Build the GraphControls View choice on /graph: the anchor's neighbourhood (default) or the whole library.

## Context
Markus, 2 Nov 2026: the library is expected to grow exponentially; "A and B as view options". GV1 (#531) wrote the spec: Neighbourhood draws the anchor and the tracks within `graph-hood-steps` (3) links, at most `graph-hood-max` (200), strongest link first (`SongNodes.neighbourhood`), and the count reads "200 of 1,284 nodes" with an InfoTip when cut; Whole library draws every track, Fit may go below 25% and the fitted zoom becomes the zoom-out limit, nodes at least 1.5px on screen and only focused labels below 25%; remembered per device; announced in the live line.

## Owned paths
- frontend/src/lib/graphView.ts
- frontend/src/lib/graphView.test.ts
- frontend/src/components/GraphControlsDock.tsx
- frontend/src/components/GraphControlsDock.test.tsx
- frontend/src/components/GraphVisualization.tsx
- plan/agents/GV2_graph_view_control.md
- STATUS.md (SLOT:GV2 only)

## Done when (reviewer check)
Open /graph: the View control sits top-right with Neighbourhood pressed, the count reads "N of M nodes" with an info button when the neighbourhood is cut, and the view fits it at 25% or more. Pick Whole library: every track shows, Fit goes below 25% if needed, zoom out stops there, and a reload keeps Whole library.

## Checks
`cd frontend && npx tsc --noEmit -p . && npx oxlint src && npx vitest run src && npx vite build`; `PYTHONUTF8=1 bash scripts/sync-design-system.sh --check`; `python scripts/check_design_system.py --check`; scope guard. E2E: the combined host run for 2 Nov 2026 (Markus).

## Follow-ups (not this package)
- Load the neighbourhood from `/api/graph/data?view=neighbourhood` (GV3) instead of the whole graph, once the library and plan panels no longer need every track client-side.
- Labels for every node only above zoom 1.5 (DR-037); today they show at every zoom above 25%.
- Colour by control and minimap in the same top-right panel.
