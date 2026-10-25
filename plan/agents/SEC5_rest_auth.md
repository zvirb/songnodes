SEC5: REST API: token auth on write and admin routes

Base: main at BASE_SHA. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md (one job, owned paths only, about 400 changed lines at most, verify then commit, two attempts then stop, rebase before the PR) and CLAUDE.md; the design system rules apply to any UI change. No access to the user's laptop, local data or secrets; work from the repo and fixtures. Open one PR against main titled "SEC5: REST API: token auth on write and admin routes" on a branch starting with "sec5-"; do not merge it. Edit only the lines inside your own STATUS.md slot (SLOT:SEC5 BEGIN/END). Depends on: G3. If a dependency is not merged on main yet, stop and say so instead of working around it.

## Job
Require SONGNODES_API_TOKEN on write and admin REST routes when it is set.

## Context (verified on main 2026-10-26)
No auth dependency is applied to the REST routers; compose binds to 127.0.0.1, so this is defence in depth locally.

## Owned paths
- services/rest_api/security/**
- tests/security/test_rest_auth.py
- services/rest_api/main.py (one line: register_security(app))

(Complete list. Anything else is read-only for you. You may also add a dated note under docs/integration/SEC5/ if you need to record a decision.)

## Do
1. When the variable is set, require it (Authorization: Bearer or X-API-Token, hmac.compare_digest) on non-GET/HEAD/OPTIONS and on a configurable list of sensitive GET prefixes (api-keys, jobs, datalayer admin). Health, docs and read-only catalog stay open. Unset: unchanged behaviour plus a startup warning.
2. 401 with a generic message; never echo or log the token; simple in-memory limit on repeated 401s.
3. Do not touch the frontend; document the header.

## Done when (the reviewer's under-10-minute check; put it in the PR)
TestClient: unset = open; set = 401 without or with a wrong token, 200 with the right one; health open.

## Checks
`python -m pytest` for the paths you own, from the repo root. Report failures in files you do not own; do not fix them.

## Hand-back
The one job done, files added/changed/deleted, checks run and not run, the reviewer check, follow-ups.
