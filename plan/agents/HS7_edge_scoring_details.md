HS7: Edge details show stored harmonic scoring

Base: main at a5c338d. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md (one job, owned paths only, about 400 changed lines at most, verify then commit, two attempts then stop, rebase before the PR) and CLAUDE.md. Open one PR against main titled "HS7: Edge details show stored harmonic scoring" on a branch starting with "hs7-"; do not merge it. Edit only the lines inside your own STATUS.md slot (SLOT:HS7 BEGIN/END, added at the end of the file if missing). Depends on: HS4 (#505, scoring columns on `silver_track_transitions`, migration 270) and HS3 (#507, design system 1.8.0 with `SongNodes.energyMove`). Before opening or updating the PR, run `git fetch origin main && git diff --diff-filter=D --name-only origin/main...HEAD`; it must list only your owned paths.

## Job
Implement spec package M6-U1 (docs/specs/HARMONIC_SCORING.md section 4): the graph API exposes the stored scoring fields on edges, and the edge details modal shows the stored key and BPM verdicts and the energy move label through the design-system `CompatibilityBadge` and `SongNodes.energyMove` ("lift" shows as "push"). Unscored edges show an en dash; the frontend never computes a verdict.

## Owned paths
- services/graph-visualization-api/catalog.py
- services/graph-visualization-api/tests/unit/test_catalog_scoring.py (new)
- frontend/src/components/EdgeDetailsModal.tsx
- frontend/src/components/EdgeDetailsModal.test.tsx (new)
- plan/agents/HS7_edge_scoring_details.md (this brief)

(Complete list. Carrying the fields through the graph data loaders and the `GraphEdge` type, edge colouring by move (milestone 7) and the compatibility score display are other packages.)

## Done when (the reviewer's under-10-minute check; put it in the PR)
`GET /api/graph/edges?node_ids=<a>,<b>` returns `scoring` on each edge with the stored columns (all null when unscored); opening "Connection details" on a scored edge shows Key, BPM and Energy badges with the stored verdicts (an energy `lift` reads "push"); an unscored edge shows en dashes and "Not scored yet."

## Checks
`cd services/graph-visualization-api && python -m pytest tests/unit`; frontend `npx tsc --noEmit -p . && npx oxlint src && npx vitest run src && npx vite build`; `PYTHONUTF8=1 bash scripts/sync-design-system.sh --check`; `python3 scripts/check_design_system.py --check`; the scope guard.
