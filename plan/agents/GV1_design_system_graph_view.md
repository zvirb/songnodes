GV1: Design system 1.9.0 adds the graph View choice

Base: main at 5811742d. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md and CLAUDE.md. Change the design system at source (`design-system/source/*`, then `build_tokens.py` and `build_bundle.py`), bump the version per `design-system/17-governance.md`, re-sync with `scripts/sync-design-system.sh`. Open one PR titled "GV1: Design system 1.9.0 adds the graph View choice" on a branch starting with "gv1-". Edit only the lines inside your own STATUS.md slot (SLOT:GV1).

## Job
Write Markus's 2 Nov 2026 decision into the design system: the graph offers two views, the anchor's neighbourhood (default) and the whole library.

## Context
Markus, 2 Nov 2026, on the graph PRs (GR1 zvirb/songnodes#509, GR2 zvirb/songnodes#513): "the library is expected to grow exponentially", then picked "A and B as view options". A: the anchor's neighbourhood, Fit covers it; B: the whole library, Fit allowed below 25%. Measured with the ring layout: 200 tracks fit at 30% or more in the 754×761 Plan canvas; 4,000 tracks need about 2% to fit. Neighbourhood size: the proposed default (3 links, 200 tracks); Markus did not set other values.

## Owned paths
- design-system/**
- frontend/src/styles/design-system/**
- plan/agents/GV1_design_system_graph_view.md
- STATUS.md (SLOT:GV1 only)

## Do
1. Tokens `graph-hood-steps` (3), `graph-hood-max` (200); version 1.9.0.
2. Helper `SongNodes.neighbourhood(nodes, links, {anchor, steps, max})`, strongest link first, binary heap (n log n); types.
3. GraphControls README: View segmented control (spec, table, count, InfoTip, live line, responsive), Fit below 25% in Whole library; GraphStyles Layout View row; GraphControls preview gains the control; `GraphControlsProps.view`/`onViewChange`.
4. Governance: 1.9.0 change log entry, DR-057.

## Done when (reviewer check)
Open `design-system/components/GraphControls/preview.html`: a View control (Neighbourhood, Whole library) sits above Colour by and announces the change. In a browser console with the bundle: `SongNodes.neighbourhood(nodes, links, {anchor})` returns at most 200 ids within 3 links.

## Checks
`python3 design-system/source/build_tokens.py && python3 design-system/source/build_bundle.py`; `PYTHONUTF8=1 bash scripts/sync-design-system.sh --check`; `python scripts/check_design_system.py --check`; frontend `npx tsc --noEmit -p . && npx oxlint src && npx vitest run src && npx vite build`; scope guard.

## Follow-ups (not this package)
- GV2: frontend View control on /graph (after GR1 #509 and GR2 #513 merge).
- GV3: graph API serves one anchor's neighbourhood instead of the whole graph.
- GV4: `SongNodes.ringLayout` picks the next track from a heap (n log n; 4,000 tracks take 1.4 s today).
