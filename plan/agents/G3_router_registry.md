G3: REST API: routers register themselves

Base: main at BASE_SHA. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md (one job, owned paths only, about 400 changed lines at most, verify then commit, two attempts then stop, rebase before the PR) and CLAUDE.md; the design system rules apply to any UI change. No access to the user's laptop, local data or secrets; work from the repo and fixtures. Open one PR against main titled "G3: REST API: routers register themselves" on a branch starting with "g3-"; do not merge it. Edit only the lines inside your own STATUS.md slot (SLOT:G3 BEGIN/END). Depends on: nothing. If a dependency is not merged on main yet, stop and say so instead of working around it. Never merge or rebuild your branch from an older base: before opening or updating the PR, run `git fetch origin main && git diff --diff-filter=D --name-only origin/main...HEAD`; it must list only your owned paths, otherwise stop and say so (the scope guard fails the PR anyway). New pages register through frontend/src/routes (G2) and new REST routers expose register(app) (G3); never edit App.tsx or services/rest_api/main.py unless your brief owns them.

## Job
Let REST API routers that expose register(app) be included automatically, so new endpoints no longer edit the shared main.py.

## Context (verified on main 2026-10-26)
services/rest_api/main.py is 774 lines with explicit include_router calls; routers/library_search.py and routers/library_ingest.py (PR #158) already use a register(app) function (main.py lines 758-763). Note that legacy routers like routers/catalog_writes.py import from main at module load time.

## Owned paths
- services/rest_api/router_registry.py
- services/rest_api/main.py (one call to the registry after the existing includes; nothing else)
- tests/rest_api/test_router_registry.py

(Complete list. Anything else is read-only for you. You may also add a dated note under docs/integration/G3/ if you need to record a decision.)

## Do
1. router_registry.register_all(app): scan services/rest_api/routers/*.py; skip any module already imported/included by main.py (or check AST for a top-level `def register` before importing so legacy routers that import `main` are never re-imported); call register(app) once for each new router in module-name order; log each.
2. An import error fails fast with a message naming the module (a hidden missing router is worse than a failed start).
3. Leave the existing explicit includes (including library_search and library_ingest) exactly as they are.

## Done when (the reviewer's under-10-minute check; put it in the PR)
Start the app with TestClient: the route list is identical to before plus nothing; a test with a fake routers package proves discovery and the duplicate guard.

## Checks
`python -m pytest` for the paths you own, from the repo root. Report failures in files you do not own; do not fix them.

## Hand-back
The one job done, files added/changed/deleted, checks run and not run, the reviewer check, follow-ups.
