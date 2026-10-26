S1: Track search on metadata-enrichment for TIDAL and Spotify

Base: main at BASE_SHA. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md (one job, owned paths only, about 400 changed lines at most, verify then commit, two attempts then stop, rebase before the PR) and CLAUDE.md; the design system rules apply to any UI change. No access to the user's laptop, local data or secrets; work from the repo and fixtures. Open one PR against main titled "S1: Track search on metadata-enrichment for TIDAL and Spotify" on a branch starting with "s1-"; do not merge it. Edit only the lines inside your own STATUS.md slot (SLOT:S1 BEGIN/END). Depends on: nothing. If a dependency is not merged on main yet, stop and say so instead of working around it. Never merge or rebuild your branch from an older base: before opening or updating the PR, run `git fetch origin main && git diff --diff-filter=D --name-only origin/main...HEAD`; it must list only your owned paths, otherwise stop and say so (the scope guard fails the PR anyway). New pages register through frontend/src/routes (G2) and new REST routers expose register(app) (G3); never edit App.tsx or services/rest_api/main.py unless your brief owns them.

## Job
Add GET /api/v1/search/{service} to metadata-enrichment, returning real normalised TIDAL or Spotify tracks or an explicit error.

## Context (verified on main 2026-10-26)
The UI's music search calls the REST API, which proxies to metadata-enrichment /api/v1/search/{service}; that route does not exist, so the REST API falls back to hard-coded mock tracks (services/rest_api/main.py around line 730: "Mock Artist", "Mock Album"). BE1 (PR #118) merged only tests/fakes/fake_music_services.py; the search itself never landed. The real clients are TidalClient and SpotifyClient in services/metadata-enrichment/api_clients.py.

## Owned paths
- services/metadata-enrichment/music_search.py
- services/metadata-enrichment/search_routes.py
- services/metadata-enrichment/main.py (one include_router line)
- services/metadata-enrichment/tests/test_music_search.py

(Complete list. Anything else is read-only for you. You may also add a dated note under docs/integration/S1/ if you need to record a decision.)

## Do
1. music_search.search_tracks(service, q, limit) for tidal and spotify, reusing the existing clients' token handling (do not edit api_clients.py; if a change is needed, describe it and monkeypatch in tests). limit 1 to 50; q trimmed and capped; timeouts on every call.
2. Normalised shape (the UI reads exactly this): {"tracks": [{"id", "name", "title", "artist", "artists": [{"name"}], "album": {"name", "images": [{"url"}]}, "duration_ms", "preview_url", "image", "isrc", "url"}]}; real image URLs or null, never placeholders.
3. search_routes.py: 424 {code: tidal_not_configured|spotify_not_configured, message} without credentials; 502 {code: provider_error} on upstream failure, passing Retry-After on 429; 400 for an unknown service or empty q.
4. Tests against tests/fakes/fake_music_services.py: normalisation (missing album, missing ISRC, several artists, remix titles), validation, 424, 429 and 500 mapping, timeout.

## Done when (the reviewer's under-10-minute check; put it in the PR)
`python -m pytest services/metadata-enrichment/tests/test_music_search.py` passes; with no credentials set, the route returns 424 with the not-configured code.

## Checks
`python -m pytest` for the paths you own, from the repo root. Report failures in files you do not own; do not fix them. Never read, print or commit real credentials.

## Hand-back
The one job done, files added/changed/deleted, checks run and not run, the reviewer check, follow-ups.
