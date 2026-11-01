GR1: Graph anchor, link bands and no stored camera (follow-up to #502)

Base: main at 33dcc5a. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md and CLAUDE.md; the design system (design-system/, GraphStyles DR-034/DR-035) decides every UI question. Open one PR titled "GR1: Graph anchor, link bands and no stored camera" on a branch starting with "gr1-". Edit only the lines inside your own STATUS.md slot (SLOT:GR1). This brief sorts before GR1_graph_node_spacing.md (merged in #502), so the scope guard reads this one.

## Job
Finish the ring layout on /graph: seat tracks around the right anchor, keep seats on live updates, draw link strength in the four width bands, and stop persisting a camera that warns on every load.

## Context
docs/integration/REAL-DATA-TEST-2026-11-02.md, section 2 and problem 1 (tested at 62795a7, before #502). #502 replaced d3-force with `SN.ringLayout` seats and a fit on load. Still missing on main at 33dcc5a:
- Anchor is now playing, else the most-linked track; GraphStyles says now playing, else the selected track, else the most-linked track. With no anchor given, a live update that changes the most-linked track re-seats everything (GraphStyles: "a live update re-seats nobody").
- Link width is `0.5 + min(weight / 10, 1)` px, not the DR-035 bands (`SN.edgeBand`, `graph-edge-w-1…4`, `graph-edge-op-1…4`).
- `store/useStore.ts` persists `viewState.pan`/`zoom`; old pans (−56,522 / 45,250) trip "Detected extreme viewport values" on every load.

## Owned paths
- frontend/src/lib/graphLayout.ts
- frontend/src/lib/graphLayout.test.ts
- frontend/src/components/GraphVisualization.tsx
- frontend/src/store/useStore.ts
- frontend/src/store/useStore.persist.test.ts
- plan/agents/GR1_anchor_edge_bands.md
- STATUS.md (SLOT:GR1 only)

## Do
1. `graphLayout.ts`: `pickAnchor` (now playing → first selected → anchor in use), `seatTracks` takes the anchor, `edgeBandStyles` (tokens, spec fallback) and `edgeBandOf` (occurrence counts scaled by the strongest link, then `SN.edgeBand`).
2. `GraphVisualization.tsx`: seat with `pickAnchor`; re-seat and fit only when the anchor changes (now playing or selection); links drawn with band width and opacity, path links at least 3px.
3. `useStore.ts`: persist pan 0,0 and the default zoom; drop a stored camera on rehydrate without a warning.
4. Tests: anchor choice, band mapping, a 463-track / 23-component graph with weights 1–3 (every track seated, only the anchor at 0,0, median nearest neighbour 30–90px), store persistence.

## Done when (reviewer check)
Open /graph?mode=plan at 1440×900 with nothing selected: every linked track is drawn, none at (0,0) except the anchor, links show up to four line weights, and the console has no "extreme viewport" warning. Select a track: everything re-seats around it and the view fits.

## Checks
`cd frontend && npx tsc --noEmit -p . && npx oxlint src && npx vitest run src && npx vite build`; `PYTHONUTF8=1 bash scripts/sync-design-system.sh --check`; `python scripts/check_design_system.py --check`; `python scripts/scope_guard.py --base origin/main --head HEAD --title "GR1: Graph anchor, link bands and no stored camera" --branch gr1-anchor-edge-bands`. E2E (`scripts/e2e-docker.sh`) needs Docker on the host.
