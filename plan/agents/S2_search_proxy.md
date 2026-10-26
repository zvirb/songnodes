S2: REST music search: remove the mock results

Base: main at BASE_SHA. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md (one job, owned paths only, about 400 changed lines at most, verify then commit, two attempts then stop, rebase before the PR) and CLAUDE.md; the design system rules apply to any UI change. No access to the user's laptop, local data or secrets; work from the repo and fixtures. Open one PR against main titled "S2: REST music search: remove the mock results" on a branch starting with "s2-"; do not merge it. Edit only the lines inside your own STATUS.md slot (SLOT:S2 BEGIN/END). Depends on: S1. If a dependency is not merged on main yet, stop and say so instead of working around it. Never merge or rebuild your branch from an older base: before opening or updating the PR, run `git fetch origin main && git diff --diff-filter=D --name-only origin/main...HEAD`; it must list only your owned paths, otherwise stop and say so (the scope guard fails the PR anyway). New pages register through frontend/src/routes (G2) and new REST routers expose register(app) (G3); never edit App.tsx or services/rest_api/main.py unless your brief owns them.

## Job
Make the REST API's music search pass real results and real errors through, and delete the mock data.

## Context (verified on main 2026-10-26)
services/rest_api/main.py music_search (around line 672) proxies to metadata-enrichment and returns hard-coded mock tracks on 404 or connection errors.

## Owned paths
- services/rest_api/main.py (only the body of music_search)
- tests/rest_api/test_music_search_proxy.py
- docs/music-search.md

(Complete list. Anything else is read-only for you. You may also add a dated note under docs/integration/S2/ if you need to record a decision.)

## Do
1. Keep the proxy; delete both mock branches. Pass upstream status and detail through; connection failure becomes 503 {code: search_service_unavailable}. Short timeout; use METADATA_ENRICHMENT_URL.
2. Test: pass-through of 200/424/502, 503 when the service is down, and a grep test that "Mock Artist", "Mock Album" and "placeholder.com" no longer appear under services/rest_api or services/metadata-enrichment.
3. docs/music-search.md: how the owner sets TIDAL/Spotify credentials locally without committing them, and the curl check.

## Done when (the reviewer's under-10-minute check; put it in the PR)
With no credentials: `curl .../api/v1/music-search/tidal?q=test` returns 424 with the not-configured message, not mock tracks.

## Checks
`python -m pytest` for the paths you own, from the repo root. Report failures in files you do not own; do not fix them.

## Hand-back
The one job done, files added/changed/deleted, checks run and not run, the reviewer check, follow-ups.
