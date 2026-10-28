DB1: One track source: every page reads the library from the database

Base: main at BASE_SHA. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md (one job, owned paths only, about 400 changed lines at most, verify then commit, two attempts then stop, rebase before the PR) and CLAUDE.md; the design system rules apply to any UI change. No access to the user's laptop, local data or secrets; work from the repo and fixtures. Open one PR against main titled "DB1: One track source: every page reads the library from the database" on a branch starting with "db1-"; do not merge it. Edit only the lines inside your own STATUS.md slot (SLOT:DB1 BEGIN/END). Depends on: nothing. If a dependency is not merged on main yet, stop and say so instead of working around it. Never merge or rebuild your branch from an older base: before opening or updating the PR, run `git fetch origin main && git diff --diff-filter=D --name-only origin/main...HEAD`; it must list only your owned paths, otherwise stop and say so (the scope guard fails the PR anyway). New pages register through frontend/src/routes (G2) and new REST routers expose register(app) (G3); never edit App.tsx or services/rest_api/main.py unless your brief owns them.

## Job
Make the shared track hook read the library from the database (GET /api/v1/library/search, table library.tracks) instead of the static file frontend/public/data/music-library.json, so Library, Set builder, Pathfinder, Key and mood, AI setlists and Home all show the same tracks.

## Context (verified on main 2026-10-26)
Two loaders exist today. features/musicLibrary/data.ts loadLibrary() (Library and Set builder pages) calls /api/v1/library/search?limit=5000 and falls back to /data/music-library.json only when the request fails. hooks/useUnifiedTracks.ts (Pathfinder, Key and mood, AI setlists, Home, the target buttons) never asks the database: services/unifiedTrackService.ts fetchLibraryFixture() reads /data/music-library.json, a 294-track copy from 23 Oct baked into the frontend image. On the live stack on 28 Oct the database held 0 library tracks (the import failed; L7 fixes it), so the Library page showed 0 while Pathfinder showed 294 old tracks and said 'Using data from: Library fixture'. The search endpoint is services/rest_api/routers/library_search.py (LibraryTrackSearchResponse).

## Owned paths
- frontend/src/hooks/useUnifiedTracks.ts
- frontend/src/services/unifiedTrackService.ts
- frontend/src/services/unifiedTrackService.test.ts
- frontend/src/features/musicLibrary/data.ts (loadLibrary and the response mapping only)
- frontend/src/features/musicLibrary/data.test.ts (new)

(Complete list. Anything else is read-only for you. You may also add a dated note under docs/integration/DB1/ if you need to record a decision.)

## Do
1. Read services/rest_api/routers/library_search.py and compare LibraryTrackSearchResponse field by field with LibraryTrack in data.ts. loadLibrary currently casts the response; replace the cast with an explicit mapping function (one place) so every LibraryTrack field is filled or null. List any field the API cannot supply in the PR.
2. useUnifiedTracks: build the library tracks from loadLibrary() (so both loaders share one request and one cache) and map with fromLibraryRow. Set the data source to 'backend' when the API answered, even with 0 tracks.
3. Fall back to /data/music-library.json only when the API request fails (network error or HTTP error), never when it returns an empty list, and set the source to 'library-fixture' then. Keep the file in the repo: tests and the offline fallback use it.
4. Do not edit any page. Pages already show their empty states and the 'Using data from' line from the hook's source value.
5. Tests: API returns tracks -> hook gives those tracks with source 'backend'; API returns [] -> 0 tracks, source 'backend', the JSON file is not requested; API fails -> tracks from the file, source 'library-fixture'; the mapping fills every LibraryTrack field from a sample search row.

## Done when (the reviewer's under-10-minute check; put it in the PR)
With the stack running and library.tracks empty, /paths shows the empty state instead of 294 old tracks; after the library import (L7) /library and /paths show the same count.

## Checks
`cd frontend && npm ci && npx tsc --noEmit -p . && npx oxlint src && npx vitest run src && npx vite build` (Node 26, TypeScript 7, Oxlint; see frontend/LINTING.md). Lint must not get worse in files you touch. Report failures in files you do not own; do not fix them. Playwright cannot run in your sandbox; say so.

## Hand-back
The one job done, files added/changed/deleted, checks run and not run, the reviewer check, follow-ups.
