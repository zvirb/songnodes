GR2: Graph controls dock with zoom, fit, reset and pause

Base: main at 33dcc5a. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md and CLAUDE.md; the design system (design-system/components/GraphControls) decides every UI question. Open one PR titled "GR2: Graph controls dock with zoom, fit, reset and pause" on a branch starting with "gr2-". Edit only the lines inside your own STATUS.md slot (SLOT:GR2).

## Job
Give /graph the GraphControls dock, so the view can be zoomed, fitted, reset and the layout paused, by mouse and keyboard.

## Context
docs/integration/REAL-DATA-TEST-2026-11-02.md, section 2 ("Fit / reset") and problem 2: /graph has no zoom dock, fit, reset, pause or minimap, and no `0` shortcut. In `GraphVisualization.tsx` the `+`/`−` keys do nothing and Space flips a ref nothing reads. `fitToContent` (from #502) exists but nothing calls it except on load and on a new now playing.

## Owned paths
- frontend/src/components/GraphControlsDock.tsx
- frontend/src/components/GraphControlsDock.test.tsx
- frontend/src/components/GraphVisualization.tsx
- plan/agents/GR2_graph_controls_dock.md
- STATUS.md (SLOT:GR2 only)

## Do
1. `GraphControlsDock.tsx`: the dock markup from the GraphControls anatomy (`sn-graph-controls__dock`, groups, 40px icon buttons with `aria-label` + `title`, zoom percent, count, "Layout paused" idle pill, `sn-sr` live line). Zoom ×1.25 steps, 25–400%, buttons disable at the limits.
2. `GraphVisualization.tsx`: zoom about the canvas centre, fit (`fitToContent`), reset to 100% on the anchor, pause/resume that holds every seat (new tracks wait unseated until Resume), wheel limited to 25–400%, keys `+` `−` `0` `Space` when no control or field has focus, announcements ("Zoom 125%", "Layout paused", …). Camera moves use `duration-slow` and `ease-standard`, and jump under reduced motion.
3. Tests for the dock (labels, handlers, limits, paused state, events kept from the canvas zoom) and the zoom step.

## Done when (reviewer check)
Open /graph at 1440 wide: the dock sits bottom-right; zoom in shows 125% and announces it; `0` fits; Reset returns to 100%; Space shows "Layout paused" and the button reads "Resume layout".

## Checks
`cd frontend && npx tsc --noEmit -p . && npx oxlint src && npx vitest run src && npx vite build`; `PYTHONUTF8=1 bash scripts/sync-design-system.sh --check`; `python scripts/check_design_system.py --check`; `python scripts/scope_guard.py --base origin/main --head HEAD --title "GR2: Graph controls dock with zoom, fit, reset and pause" --branch gr2-graph-controls-dock`. E2E (`scripts/e2e-docker.sh`) needs Docker on the host.

## Not in this package (follow-ups)
Minimap, link layers popover, Colour by control, phone bottom bar.
