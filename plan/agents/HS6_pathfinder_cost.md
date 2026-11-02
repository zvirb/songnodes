HS6: Route finder prefers proven transitions

Base: main at a071a2e. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md (one job, owned paths only, about 400 changed lines at most, verify then commit, two attempts then stop, rebase before the PR) and CLAUDE.md. Open one PR against main titled "HS6: Route finder prefers proven transitions" on a branch starting with "hs6-"; do not merge it. Edit only the lines inside your own STATUS.md slot (SLOT:HS6 BEGIN/END, added at the end of the file if missing). Depends on: HS1 (#497, `services/common/metadata/transition_scoring.py`). Before opening or updating the PR, run `git fetch origin main && git diff --diff-filter=D --name-only origin/main...HEAD`; it must list only your owned paths, otherwise stop and say so.

## Job
Implement spec package M6-R1 (docs/specs/HARMONIC_SCORING.md §1.3, §2.6): the REST pathfinder costs each edge with the HS1 `path_cost`, so transitions DJs play more often cost less and no cost is ever zero or negative.

## Context (verified on main a071a2e, 2 Nov 2026)
`services/rest_api/routers/pathfinder.py` documents `GraphEdge.weight` as "lower is stronger", but every caller sends the transition's occurrence count as `weight` (`services/graph-visualization-api/catalog.py:109`, `services/rest_api/main.py:582`, `frontend/src/components/PathfinderPanel/hooks.ts:126`). The old cost `weight − 0.3·key bonus + (BPM gap/100)²` plus a −1.0 waypoint reward made more-played transitions cost more and could go negative.

## Owned paths
- services/rest_api/routers/pathfinder.py
- tests/rest_api/test_pathfinder_cost.py (new; root `tests/rest_api/` is where the REST router tests live and is in `pytest.ini` testpaths; the spec's `services/rest_api/tests/` is not collected)
- plan/agents/HS6_pathfinder_cost.md (this brief)

(Complete list. Anything else is read-only.)

## Do
1. Keep the request contract: `GraphEdge.weight` is read as the occurrence count (documented on the field); ANN fallback edges count as inferred (n = 0).
2. Edge cost = `path_cost(compat_score(key, BPM), n)`; unknown key or BPM follows §2.6 (U = 0.5).
3. Waypoints are steered with a positive discount, never a negative reward.

## Done when (the reviewer's under-10-minute check)
`python -m pytest tests/rest_api/test_pathfinder_cost.py tests/security/test_pathfinder_security.py -q` passes (needs `annoy`).

## Checks
The tests above, `cd services && python -m pytest common/tests`, the scope guard.

## Hand-back
The one job done, files added/changed/deleted, checks run and not run, the reviewer check, follow-ups.
