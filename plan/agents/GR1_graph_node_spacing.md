GR1: Graph nodes sit at the spacing the design system defines

Base: main at 07567b3. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md (one job, owned paths only, about 400 changed lines at most, verify then commit, two attempts then stop, rebase before the PR) and CLAUDE.md; the design system rules apply. Open one PR against main titled "GR1: Graph nodes sit at the spacing the design system defines" on a branch starting with "gr1-"; do not merge it. Edit only the lines inside your own STATUS.md slot (SLOT:GR1 BEGIN/END).

## Job
Lay out the /graph canvas with the design system's ring layout and spacing, and open it fitted to the canvas, so tracks are close enough to read and every track can be found.

## Context (owner report, 2 Nov 2026)
"The distance between nodes is massive and does not at all look like what is defined in the design system. The distance is so large between nodes and they are not findable."

Verified on main 07567b3:
- design-system/components/GraphStyles/README.md ("Layout: rings around one track", DR-034) replaces the force layout with rings around one anchor track: tokens `graph-ring-first` 58px, `graph-ring-step` 40px, `graph-ring-aspect` 1.7, `graph-seat-gap` 30px, `graph-label-zoom` 1.5; `SN.ringLayout` and `SN.seatBox` in the bundle are the reference implementation. Node size: radius = clamp(4, 4 + 20 × √(links ÷ most links), 24) px.
- frontend/src/components/GraphVisualization.tsx still runs the d3 force layout: link distance 150–900px from weight (weight is the transition's occurrence count, almost always 1 → about 900px), charge −2500 with distanceMax 2500, collide radius r + 50, centre strength 0.02, plus a pre-compute pass with 180–950px links. The camera opens at 100% with no fit. `fitToContent` and `centerOnNode` add the canvas centre twice (the stage is already centred), so Fit lands the graph off to one side.
- d738d2d (memoised genre cluster lookups) only caches `getGenreCluster`; it does not change spacing, and its cluster force lives in the unused `hooks/useForceSimulation.ts`.

## Owned paths
- frontend/src/lib/graphLayout.ts
- frontend/src/lib/graphLayout.test.ts
- frontend/src/components/GraphVisualization.tsx
- plan/agents/GR1_graph_node_spacing.md
- STATUS.md (SLOT:GR1 only)

## Do
1. `lib/graphLayout.ts`: read the ring tokens, size nodes by the GraphStyles rule, seat tracks with `SN.ringLayout`/`SN.seatBox` (anchor = now playing, else the track with the most links; seats kept while the anchor stays), and a fit transform within the GraphControls zoom range (25–400%).
2. `GraphVisualization.tsx`: drop the forces and the pre-compute pass; pin every node to its seat; fit on first load and when now playing changes (duration-slow, ease-standard, a jump under reduced motion); fix the double centring in fit and centre-on-node.
3. Unit tests for the layout parameters, seating and fit.

## Done when (reviewer check)
Open /graph at 1440 wide with a few hundred tracks: the whole graph is in view on load, tracks sit a ring step apart, and clicking a track selects it.

## Checks
Frontend type, lint, unit and build; `sync-design-system.sh --check`; `check_design_system.py --check`; scope guard. E2E needs Docker.
