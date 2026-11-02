HS5: Graph edges carry stored harmonic scoring

Base: main at a5c338d. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md (one job, owned paths only, about 400 changed lines at most, verify then commit, two attempts then stop, rebase before the PR) and CLAUDE.md. Open one PR against main titled "HS5: Graph edges carry stored harmonic scoring" on a branch starting with "hs5-"; do not merge it. Edit only the lines inside your own STATUS.md slot (SLOT:HS5 BEGIN/END, added at the end of the file if missing). Depends on: HS4 (#505, migration 270 and `common.datalayer.transition_scores.NAMES`). Before opening or updating the PR, run `git fetch origin main && git diff --diff-filter=D --name-only origin/main...HEAD`; it must list only your owned paths.

## Job
Implement spec package M6-P2 (docs/specs/HARMONIC_SCORING.md section 4): the Memgraph projection writes a `TRANSITIONS_TO` edge only for an observed Silver transition (`silver_track_transitions`), carrying its `occurrence_count` and the section 2.7 fields HS4 stored on it. Stop the all-pairs "within 10 BPM" inferred edges, the hard-coded `key_compatibility` 1.0 and the 0.0 energy default. Unscored rows and unknown inputs project as null, never invented values.

## Owned paths
- services/common/datalayer/graph_projection.py
- services/common/tests/test_graph_projection_scoring.py (new)
- plan/agents/HS5_graph_projection_scoring.md (this brief)

(Complete list. The REST pathfinder cost (M6-R1) and the graph API and edge details (M6-U1) are other packages.)

## Done when (the reviewer's under-10-minute check; put it in the PR)
`cd services && python -m pytest common/tests/test_graph_projection_scoring.py -q` passes: an observed edge carries the stored fields, an unscored edge carries nulls, a track with no observed transition gets no edge, and a missing energy stays null rather than 0.0.

## Checks
`cd services && python -m pytest common/tests`; `python -m pytest tests/graph_projection`; the scope guard.
