GV3: Graph API serves one anchor's neighbourhood

Base: main at 9d58e6df. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md and CLAUDE.md. Open one PR titled "GV3: Graph API serves one anchor's neighbourhood" on a branch starting with "gv3-". Edit only the lines inside your own STATUS.md slot (SLOT:GV3).

## Job
Let the graph API return the neighbourhood view (design system 1.9.0, DR-057, GV1 zvirb/songnodes#531) without reading or sending the whole library.

## Context
Markus, 2 Nov 2026: the library is expected to grow exponentially; the graph offers a Neighbourhood view (default) and a Whole library view. `/api/graph/data` returns up to 15,000 tracks (1.2 MB at 1,240 today). `/api/graph/neighborhood/{id}` exists for the detail modal (radius 1–2, 150 tracks, breadth-first ordered by track id), not strongest link first.

## Owned paths
- services/graph-visualization-api/catalog.py
- services/graph-visualization-api/main.py (`/api/graph/data` only)
- services/graph-visualization-api/tests/unit/test_neighbourhood.py
- plan/agents/GV3_graph_neighbourhood_api.md
- STATUS.md (SLOT:GV3 only)

## Do
1. `catalog.strongest_first`: the same rule as `SongNodes.neighbourhood` (heap; strongest link, then more links, then order reached; at most `steps` links; at most `max_nodes`).
2. `catalog.neighbourhood`: anchor = `center` (404 when unknown or not visible) else the most-linked visible track; read links one level at a time out to `steps`; return the graph shape plus `metadata.anchor`, `capped`, `library_nodes`.
3. `/api/graph/data?view=neighbourhood&center=&steps=3&max=200`; `view=library` (default) unchanged.
4. Unit tests, including that the selection matches the bundle on the same input.

## Done when (reviewer check)
`curl "http://127.0.0.1:8084/api/graph/data?view=neighbourhood"` returns at most 200 nodes, `metadata.anchor` set, `metadata.library_nodes` = the track count; `curl "http://127.0.0.1:8084/api/graph/data?limit=10"` behaves as before.

## Checks
`cd services/graph-visualization-api && PYTHONPATH=.. python -m pytest tests/unit -q -p no:cacheprovider --no-cov`; scope guard. E2E (`scripts/e2e-docker.sh`) needs Docker on the host.
