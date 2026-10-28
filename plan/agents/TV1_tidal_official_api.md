TV1: TIDAL: use only the official API

Base: main at BASE_SHA. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md (one job, owned paths only, about 400 changed lines at most, verify then commit, two attempts then stop, rebase before the PR) and CLAUDE.md; the design system rules apply to any UI change. No access to the user's laptop, local data or secrets; work from the repo and fixtures. Open one PR against main titled "TV1: TIDAL: use only the official API" on a branch starting with "tv1-"; do not merge it. Edit only the lines inside your own STATUS.md slot (SLOT:TV1 BEGIN/END). Depends on: nothing. If a dependency is not merged on main yet, stop and say so instead of working around it. Never merge or rebuild your branch from an older base: before opening or updating the PR, run `git fetch origin main && git diff --diff-filter=D --name-only origin/main...HEAD`; it must list only your owned paths, otherwise stop and say so (the scope guard fails the PR anyway). New pages register through frontend/src/routes (G2) and new REST routers expose register(app) (G3); never edit App.tsx or services/rest_api/main.py unless your brief owns them.

## Job
Move the TIDAL playlist router onto the official TIDAL API v2 (openapi.tidal.com) with the user's OAuth token, behind a small client with create_playlist(name, description) and add_tracks_in_order(playlist_id, track_ids), and stop accepting client secrets in query strings.

## Context (verified on main 2026-10-28)
services/rest_api/routers/tidal_playlists.py (401 lines) uses the private API: TIDAL_API_V1 = https://api.tidal.com/v1 (:17) for /sessions (:84), /users/{id}/playlists (:202), /playlists/{id}/items (:270), /search/tracks (:319), and TIDAL_API_V2 = https://api.tidal.com/v2 (:18) for create (:139). No countryCode is sent. The frontend (frontend/src/components/TidalPlaylistManager.tsx:80-240) calls /api/v1/tidal/playlists/create, /playlists/list, /playlists/{id}/tracks, /tracks/search and /tracks/check-availability; keep those paths and the request/response models (:24-66) so it keeps working. The official usage is written up in docs/requirements/TRACK_METADATA_RETRIEVAL.md:28-40 (spec: https://tidal-music.github.io/tidal-api-reference/tidal-api-oas.json): media type application/vnd.api+json; search GET /v2/searchResults?filter[query]=...&countryCode=..&include=tracks; hydrate GET /v2/tracks?filter[id]=<=20 ids&include=artists; POST /v2/playlists, then POST /v2/playlists/{id}/relationships/items (<=50 per call) with an Idempotency-Key header; duration is ISO-8601 (PT5M4S); countryCode from TIDAL_COUNTRY_CODE, default AU. The app-token client in services/common/providers/tidal.py (API = openapi.tidal.com/v2, :21) shows the JSON:API parsing; it is read-only for you. services/rest_api/routers/music_auth.py accepts client_id/client_secret as Query parameters on POST /tidal/device/init (:915-918) and POST /tidal/refresh and /tidal/oauth/refresh (:1230-1235); the frontend never sends them (it posts to /test/tidal in a JSON body, frontend/src/store/useStore.ts:1095).

## Owned paths
- services/rest_api/routers/tidal_playlists.py
- services/rest_api/utils/tidal_user_api.py (new)
- services/rest_api/routers/music_auth.py (the client_id/client_secret Query parameters of the three TIDAL endpoints above only)
- tests/rest_api/test_tidal_playlists.py (new)
- tests/rest_api/test_tidal_auth_no_query_secret.py (new)

(Complete list. Anything else is read-only for you. You may also add a dated note under docs/integration/TV1/ if you need to record a decision.)

## Do
1. tidal_user_api.py: class TidalUserApi(access_token, country_code, client=httpx.AsyncClient) with me(), search_track(artist, title, isrc=None) (ISRC via /v2/tracks?filter[isrc] first, then searchResults), list_playlists(limit, offset) (the current user's playlists; check the spec for the owner filter), create_playlist(name, description) -> id, add_tracks_in_order(playlist_id, track_ids) (chunks of 50, sent in order, one Idempotency-Key per chunk, onDuplicates SKIP unless allow_duplicates). Map 401 to 401, 429 to 429 with Retry-After, others to 502; error details never include the token.
2. Router: replace every api.tidal.com call with the client; delete TIDAL_API_V1/V2 and get_user_id. Keep endpoint paths, models and the Bearer header contract; map v2 fields onto PlaylistResponse/TrackResponse (duration in seconds from ISO-8601, url https://tidal.com/browse/...). parent_folder_id is accepted and ignored if v2 has no folder target; say so in the PR.
3. music_auth.py: drop the client_id and client_secret Query parameters from the three TIDAL endpoints; use TIDAL_CLIENT_ID/TIDAL_CLIENT_SECRET from the environment only. Nothing else in that file changes.
4. Tests with httpx.MockTransport: no request goes to api.tidal.com; every request has countryCode and the Bearer token in a header only; create then add 120 ids makes 3 ordered calls with distinct Idempotency-Keys; ISO duration parses; a query parameter named client_secret is rejected or ignored and never reaches TIDAL.
5. `git grep -n "api.tidal.com" -- services/rest_api` returns nothing.

## Done when (the reviewer's under-10-minute check; put it in the PR)
Signed in with TIDAL, POST /api/v1/tidal/playlists/create {"name":"SongNodes test"} returns an id, POST /api/v1/tidal/playlists/{id}/tracks with three track ids adds them in that order in the TIDAL app, and `git grep api.tidal.com services/rest_api` is empty.

## Checks
`python -m pytest tests/rest_api/test_tidal_playlists.py tests/rest_api/test_tidal_auth_no_query_secret.py tests/rest_api/test_router_registry.py -q`. Report failures in files you do not own; do not fix them.

## Hand-back
The one job done, files added/changed/deleted, checks run and not run, the reviewer check, follow-ups (the 'send a set to TIDAL as a dated playlist' job builds on create_playlist and add_tracks_in_order; tidal-integration and streaming-integrations still use tidalapi).
