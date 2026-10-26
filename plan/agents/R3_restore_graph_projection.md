R3: Restore the graph projection consumer

Base: main at BASE_SHA. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md (one job, owned paths only, about 400 changed lines at most, verify then commit, two attempts then stop, rebase before the PR) and CLAUDE.md; the design system rules apply to any UI change. No access to the user's laptop, local data or secrets; work from the repo and fixtures. Open one PR against main titled "R3: Restore the graph projection consumer" on a branch starting with "r3-"; do not merge it. Edit only the lines inside your own STATUS.md slot (SLOT:R3 BEGIN/END). Depends on: nothing. If a dependency is not merged on main yet, stop and say so instead of working around it.

## Job
Bring back the WP8 graph projection outbox consumer that the PR #136 CI fix deleted, without the scratch scripts that came with it.

## Context (verified on main 2026-10-26)
WP8 (PR #128, dee69d5; PR #131, f188682) added services/common/datalayer/graph_projection.py, services/graph-projection/{Dockerfile, cli.py, requirements.txt}, sql/migrations/220_graph_consumer_{up,down}.sql, docs/integration/WP8/{decisions/2026-10-25-WP8-graph.md, versions.csv} and a 14-line change to services/common/datalayer/handlers.py. PR #136 (ecdfe4a) deleted all of it and reverted the handlers.py lines. The graph page has no projected data without it.

## Owned paths
- services/common/datalayer/graph_projection.py
- services/graph-projection/**
- sql/migrations/220_graph_consumer_up.sql
- sql/migrations/220_graph_consumer_down.sql
- docs/integration/WP8/**
- services/common/datalayer/handlers.py (only the lines dee69d5 added)
- tests/graph_projection/**

(Complete list. Anything else is read-only for you. You may also add a dated note under docs/integration/R3/ if you need to record a decision.)

## Do
1. `git checkout dee69d5 -- services/common/datalayer/graph_projection.py services/graph-projection sql/migrations/220_graph_consumer_up.sql sql/migrations/220_graph_consumer_down.sql docs/integration/WP8`. Do NOT restore patch_*.py or run_tests.sh.
2. `git show dee69d5 -- services/common/datalayer/handlers.py`; re-apply those lines by hand on the current file. Change nothing else in it.
3. Apply any later WP8 fix from f188682 that touches the same files (check `git show f188682 --stat`).
4. If tests/graph_projection does not exist, add one test file with a fake Memgraph client covering one create and one delete event. Never add synthetic graph data to a real database.

## Done when (the reviewer's under-10-minute check; put it in the PR)
`python -m pytest tests/graph_projection` passes; migration 220 up then down applies on a throwaway Postgres if your sandbox can start one (say if not).

## Checks
`python -m pytest` for the paths you own, from the repo root. Report failures in files you do not own; do not fix them.

## Hand-back
The one job done, files added/changed/deleted, checks run and not run, the reviewer check, follow-ups.
