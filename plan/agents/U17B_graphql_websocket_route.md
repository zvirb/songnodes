U17B: graphql-api mounts its websocket route on strawberry 0.337

Base: main at 2427bf9. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md (one job, owned paths only, about 400 changed lines at most, verify then commit, two attempts then stop, rebase before the PR) and CLAUDE.md; the design system rules apply to any UI change. No access to the user's laptop, local data or secrets; work from the repo and fixtures. Open one PR against main titled "U17B: graphql-api mounts its websocket route on strawberry 0.337" on a branch starting with "u17b-"; do not merge it. Edit only the lines inside your own STATUS.md slot (SLOT:U17B BEGIN/END, added at the end of the file if missing). Depends on: U17 (merged). If a dependency is not merged on main yet, stop and say so instead of working around it. Never merge or rebuild your branch from an older base: before opening or updating the PR, run `git fetch origin main && git diff --diff-filter=D --name-only origin/main...HEAD`; it must list only your owned paths, otherwise stop and say so (the scope guard fails the PR anyway). New pages register through frontend/src/routes (G2) and new REST routers expose register(app) (G3); never edit App.tsx or services/rest_api/main.py unless your brief owns them.

## Job
Make services/graphql-api start on strawberry-graphql 0.337.2 with HTTP and websocket GraphQL on /graphql.

## Context (verified on main 2427bf9, 1 Nov 2026)
U17 upgraded services/graphql-api to strawberry-graphql 0.337.2 (services/graphql-api/requirements.txt) and stopped: `main.py` (about line 264) calls `app.add_websocket_route("/graphql", graphql_app)`, and the app fails with "'FastAPI' object has no attribute 'add_websocket_route'" (docs/integration/U17/notes.md). graphql-api is not in compose.dev.yaml. Do not change requirements.

## Owned paths
- services/graphql-api/main.py (the GraphQL mount only)
- services/graphql-api/tests/unit/test_graphql_mount.py (new)

(Complete list. Anything else is read-only for you. You may also add a dated note under docs/integration/U17B/ if you need to record a decision.)

## Do
1. Mount the schema with strawberry's FastAPI integration (`strawberry.fastapi.GraphQLRouter`, included at `/graphql`), which serves queries and the graphql-transport-ws subscription protocol.
2. A test that imports the app, posts `{ __typename }` to /graphql with FastAPI's TestClient and opens a websocket on /graphql with the graphql-transport-ws subprotocol.

## Done when (the reviewer's under-10-minute check; put it in the PR)
`cd services/graphql-api && python -m pytest tests/unit/test_graphql_mount.py -q` passes on strawberry-graphql 0.337.2.

## Checks
`cd services/graphql-api && python -m pytest tests/unit -q` (install requirements.txt and requirements-test.txt into a venv first). Report failures in files you do not own; do not fix them.

## Hand-back
The one job done, files added/changed/deleted, checks run and not run, the reviewer check, follow-ups.
