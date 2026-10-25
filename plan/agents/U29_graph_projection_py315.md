U29: Upgrade the graph projection service to Python 3.15 and neo4j 6

Base: main at BASE_SHA. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md (one job, owned paths only, about 400 changed lines at most, verify then commit, two attempts then stop, rebase before the PR) and CLAUDE.md; the design system rules apply to any UI change. No access to the user's laptop, local data or secrets; work from the repo and fixtures. Open one PR against main titled "U29: Upgrade the graph projection service to Python 3.15 and neo4j 6" on a branch starting with "u29-"; do not merge it. Edit only the lines inside your own STATUS.md slot (SLOT:U29 BEGIN/END). Depends on: R3. If a dependency is not merged on main yet, stop and say so instead of working around it.

## Job
Move services/graph-projection (restored by R3) to Python 3.15 and the neo4j driver from 5.17.0 to the latest 6.x, keeping the projection working.

## Context (verified on main 2026-10-26)
R3 restores services/graph-projection/{Dockerfile, cli.py, requirements.txt} (neo4j==5.17.0, asyncpg) and services/common/datalayer/graph_projection.py, which uses neo4j.AsyncGraphDatabase against Memgraph.

## Owned paths
- services/graph-projection/Dockerfile (base image and install steps only)
- services/graph-projection/requirements.txt
- services/common/datalayer/graph_projection.py (only the lines the neo4j 6 API requires)
- tests/graph_projection/**

(Complete list. Anything else is read-only for you. You may also add a dated note under docs/integration/U29/ if you need to record a decision.)

## Do
1. Look up the latest neo4j 6.x release on PyPI and its 5-to-6 migration notes; list the changes that touch AsyncGraphDatabase, sessions and transactions.
2. Set Python 3.15-slim and neo4j to that version; change only the graph_projection.py lines the migration notes require.
3. Run tests/graph_projection (from R3) against the new driver.

## Done when (the reviewer's under-10-minute check; put it in the PR)
`python -m pytest tests/graph_projection` passes with neo4j 6; the image builds on Python 3.15.

## Checks
`docker build` the image(s) you own from the repo root exactly as compose.dev.yaml or the Dockerfile's comments do; inside the image, import the service's entry module; run the service's tests (`python -m pytest` in its folder) if it has any. Report failures in files you do not own; do not fix them.

## Hand-back
The one job done, files added/changed/deleted, checks run and not run, the reviewer check, follow-ups.
