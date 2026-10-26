QA7: E2E: pin the library and saved-sets API to a fixture

Depends on: nothing. Base: main at BASE_SHA. Repo: zvirb/songnodes. Follow AGENTS.md ("Working rules for agents") and CLAUDE.md. No access to the user's laptop, local data or secrets; work from the repo and fixtures. Open one PR against main titled "QA7: E2E: pin the library and saved-sets API to a fixture" on a branch starting with "qa7-"; do not merge it. Edit only the lines inside your own slot in STATUS.md (SLOT:QA7 BEGIN/END). Never merge or rebuild your branch from an older base: before every push run `git fetch origin main && git diff --diff-filter=D --name-only origin/main...HEAD` and stop if it lists anything outside your owned paths. Do not edit frontend/src/styles/design-system/ or design-system/. If a check cannot run in your sandbox, say so in the PR.

## Job
Make the Library and Set builder E2E tests run against a pinned library fixture served by Playwright, instead of whatever is in the developer's Postgres.

## Problem (26 Oct 2026 run: 266 passed, 47 failed)
- Since WP9 (#129) `frontend/src/features/musicLibrary/data.ts` reads `GET /api/v1/library/search` first and uses `public/data/music-library.json` only if that request errors. On a dev stack whose library has not been imported the API answers `200 []`, the page shows "0 of 0 tracks", and every test in library.spec.ts fails at `of ${TOTAL} tracks` (TOTAL comes from public/data/music-library.json). Set builder tests fail because the pool is empty; visual and accessibility snapshots of /library and /sets change with it.
- The real library grows every week (the owner's weekly refresh), so tests must not assume the dev database holds a particular library. E2E runs against the developer's stack and must never write to it.

## Owned paths
- frontend/tests/e2e/fixtures.ts
- frontend/tests/e2e/libraryApi.ts
- frontend/tests/e2e/data/library.fixture.json
- frontend/tests/e2e/library.spec.ts
- frontend/tests/e2e/sets.spec.ts
- frontend/tests/README.md

## Do
1. Copy public/data/music-library.json once into frontend/tests/e2e/data/library.fixture.json (the pinned fixture; it never changes with the real library). Test data only: nothing under frontend/src may read it.
2. libraryApi.ts: `useLibraryFixture(page)` installs `page.route` handlers that mirror the BACKEND contract exactly as it is on main (read services/rest_api/routers/library_search.py and routers/library_ingest.py; do not copy the frontend's calls):
   - `GET /api/v1/library/search` with optional `q` and `limit`: the fixture's tracks, filtered case-insensitively by `q` on artist and title.
   - `GET /api/v1/library/sets`, `PUT /api/v1/library/sets/{set_id}`, `DELETE /api/v1/library/sets/{set_id}`: an in-memory store per test, starting empty, with the request and response shapes the router defines.
   - Any other method or path under /api/v1/library is answered 404, so a call the backend does not support fails visibly.
3. Call it from a fixture option in fixtures.ts so library.spec.ts and sets.spec.ts (and only those specs) use it; read TOTAL from the pinned fixture instead of public/data.
4. Keep every assertion. Do not loosen a test to pass. Note: the frontend currently saves with `PUT /api/v1/library/sets` (the whole list) while the backend only has `PUT /api/v1/library/sets/{set_id}`, so the saved-set tests are expected to keep failing until SB4 fixes the frontend. Mark nothing as skipped or fixme for that; say it in the PR.
5. frontend/tests/README.md: one short section on the pinned fixture and how to refresh it deliberately.
6. Do not update screenshot baselines (visual.spec.ts); that is a separate owner step after this and SB4 merge.

## Done when (the reviewer's under-10-minute check; put it in the PR)
`bash scripts/e2e-docker.sh library` passes against a stack with an empty library database, and `bash scripts/e2e-docker.sh sets` fails only on the saved-set tests, naming the 404 for `PUT /api/v1/library/sets`.

## Checks
`cd frontend && npx tsc --noEmit -p . && npx oxlint src tests` (Node 26, TypeScript 7). Playwright cannot run in your sandbox against the stack; say so, and list the tests you expect to pass and fail.

## Hand-back
The one job done, files added/changed/deleted, checks run and not run, the reviewer check, follow-ups.
