L8: Library page: import the library export from the browser

Base: main at BASE_SHA. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md (one job, owned paths only, about 400 changed lines at most, verify then commit, two attempts then stop, rebase before the PR) and CLAUDE.md; the design system rules apply to any UI change. No access to the user's laptop, local data or secrets; work from the repo and fixtures. Open one PR against main titled "L8: Library page: import the library export from the browser" on a branch starting with "l8-"; do not merge it. Edit only the lines inside your own STATUS.md slot (SLOT:L8 BEGIN/END). Depends on: FL5. If a dependency is not merged on main yet, stop and say so instead of working around it. Never merge or rebuild your branch from an older base: before opening or updating the PR, run `git fetch origin main && git diff --diff-filter=D --name-only origin/main...HEAD`; it must list only your owned paths, otherwise stop and say so (the scope guard fails the PR anyway). New pages register through frontend/src/routes (G2) and new REST routers expose register(app) (G3); never edit App.tsx or services/rest_api/main.py unless your brief owns them.

## Job
Add an 'Import library' action to the Library page that uploads the musicLibrary export (library.json) to POST /api/v1/library/ingest and shows the import's progress and result, so the owner never needs a terminal to load the library.

## Context (verified on main 2026-10-26)
The library page reads library.tracks through /api/v1/library/search. The only way to fill it is POST /api/v1/library/ingest (services/rest_api/routers/library_ingest.py): body = the export JSON, required header Idempotency-Key; it returns {job_id, status, created} and a worker runs the job. GET /api/v1/jobs/{job_id} returns status (queued, running, succeeded, dead), attempts, last_error and result; POST /api/v1/jobs/{job_id}/retry re-queues a dead job (services/rest_api/routers/jobs.py). scripts/import-music-library.sh does the same from a terminal and uses Idempotency-Key 'import-<md5 of the file>'; use the same key scheme (SHA or MD5 of the file bytes via crypto.subtle; MD5 is not in crypto.subtle, so use 'import-sha256-<hex>') so a file is never imported twice. The export's shape: musicLibrary outputs/artifact/library.json, the same shape as frontend/public/data/music-library.json (LibraryFile in features/musicLibrary/data.ts).

## Owned paths
- frontend/src/features/musicLibrary/components/LibraryImportDialog.tsx (new)
- frontend/src/features/musicLibrary/components/LibraryImportDialog.test.tsx (new)
- frontend/src/features/musicLibrary/LibraryPage.tsx (the PageHeader actions and the empty-library state only)

(Complete list. Anything else is read-only for you. You may also add a dated note under docs/integration/L8/ if you need to record a decision.)

## Do
1. Read design-system/components/Dialog, FileDrop, StagedProgress and Toast (README.md and api card each) and use them; no new sn-* classes, tokens only.
2. LibraryPage: a quiet 'Import library' button (upload icon plus the word) in the PageHeader actions, next to the existing primary 'Build set from crate' (keep one primary per view). When the database has 0 library tracks, the crate's empty state says the library has not been imported yet and offers the same action.
3. LibraryImportDialog: FileDrop accepting one .json file. Read it, check it parses and has a tracks array, and show 'N tracks, generated <date via SN.format>' before sending. Errors in sentence case, en-AU.
4. Import: POST the file text to /api/v1/library/ingest with Content-Type application/json and the Idempotency-Key above. If the response says created is false and GET /api/v1/jobs/{id} is dead, offer 'Try again' which calls POST /api/v1/jobs/{id}/retry.
5. Progress: poll GET /api/v1/jobs/{id} every 2 s (stop on close or unmount) and show StagedProgress: Uploaded, Queued, Importing, Done. On succeeded show the result counts and a Toast 'Library imported: N tracks', then reload the crate (clear the loadLibrary cache in data.ts through an exported reset function if one exists; if not, reload the page data the way LibraryPage already retries with setAttempt). On dead show last_error in an InlineMessage and keep the dialog open.
6. Do not change filters, the table, keyboard navigation (FL5) or any other page.
7. Tests (jsdom, fetch mocked): a valid file shows its track count and posts with the idempotency header; a file without tracks shows an error and posts nothing; succeeded shows the result and calls the reload; dead shows the error and Try again calls the retry endpoint.

## Done when (the reviewer's under-10-minute check; put it in the PR)
On /library press 'Import library', drop musicLibrary's library.json: the dialog shows the track count, then Queued, Importing, Done, and the crate shows the imported tracks.

## Checks
`cd frontend && npm ci && npx tsc --noEmit -p . && npx oxlint src && npx vitest run src && npx vite build` (Node 26, TypeScript 7, Oxlint; see frontend/LINTING.md). Lint must not get worse in files you touch. Report failures in files you do not own; do not fix them. Playwright cannot run in your sandbox; say so.

## Hand-back
The one job done, files added/changed/deleted, checks run and not run, the reviewer check, follow-ups.
