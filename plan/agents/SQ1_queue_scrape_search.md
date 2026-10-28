SQ1: Pipeline: Queue scrape job asks for search words

Base: main at BASE_SHA. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md (one job, owned paths only, about 400 changed lines at most, verify then commit, two attempts then stop, rebase before the PR) and CLAUDE.md; the design system rules apply to any UI change. No access to the user's laptop, local data or secrets; work from the repo and fixtures. Open one PR against main titled "SQ1: Pipeline: Queue scrape job asks for search words" on a branch starting with "sq1-"; do not merge it. Edit only the lines inside your own STATUS.md slot (SLOT:SQ1 BEGIN/END). Depends on: nothing. If a dependency is not merged on main yet, stop and say so instead of working around it. Never merge or rebuild your branch from an older base: before opening or updating the PR, run `git fetch origin main && git diff --diff-filter=D --name-only origin/main...HEAD`; it must list only your owned paths, otherwise stop and say so (the scope guard fails the PR anyway). New pages register through frontend/src/routes (G2) and new REST routers expose register(app) (G3); never edit App.tsx or services/rest_api/main.py unless your brief owns them.

## Job
On /pipeline, queueing a scrape asks for the search words (artist and title) and a source, and sends them, so the job can actually find playlists.

## Context (verified on main 2026-10-28)
frontend/src/pages/ScraperProgressPage.tsx handleQueueJob (lines 35-43) posts `/scrape/trigger?source=1001tracklists` with no search_query, and the only "Queue scrape job" button sits in the empty state (lines 121-130), so it disappears once any job exists. services/rest_api/routers/jobs.py:60-76 takes `source`, `search_query` (1-255 chars, line 63) and an optional `Idempotency-Key` header (line 64); without the key every call is a new job. CLAUDE.md §2 (Scraper workflow) says a search is always artist plus title ("Deadmau5 Strobe"), never the artist alone. The `api.post` helper (frontend/src/services/api.ts:636) cannot send headers, so call `fetch(`${API_BASE_URL}/api/v1/scrape/trigger?…`)` (API_BASE_URL from frontend/src/lib/apiBase) with `URLSearchParams` and the header. Design-system components in frontend/src/components/ds/index.tsx: TextField (388), SelectField (536) or SegmentedControl (285), Button, SectionHeading, showToast. Design system: read design-system/README.md and the cards in design-system/api/components/ for every component you use; UI copy is en-AU, sentence case, no emoji, missing values an en dash (`sn-none`), numbers, durations and dates through `SN.format`, keys through `SN.camelot`/`keyName`; tokens (`var(--…)`) and `sn-*` classes only, no hex, rgb(), named colours, px font sizes or raw z-index; never `alert`/`confirm`, one primary button per view.

## Owned paths
- frontend/src/pages/ScraperProgressPage.tsx
- frontend/src/pages/ScraperProgressPage.test.tsx (new)

(Complete list. Anything else is read-only for you. You may also add a dated note under docs/integration/SQ1/ if you need to record a decision.)

## Do
1. Add a "Queue a scrape" section (SectionHeading) above "Scrape runs", always shown when the page is live: TextField "Artist" and TextField "Title" (both required), a SegmentedControl or SelectField "Source" limited to MixesDB (`mixesdb`) and 1001Tracklists (`1001tracklists`), default mixesdb, and one primary Button "Queue scrape".
2. Validation before sending: both fields trimmed and non-empty, combined `"<artist> <title>"` at most 255 characters; show the message in the field's `error` ("Enter the artist." / "Enter the track title.") and focus the first bad field. No request when invalid.
3. Send `source` and `search_query` as query parameters and `Idempotency-Key: crypto.randomUUID()` created once per form submission (a double click reuses it). Disable the button while sending.
4. On 202: toast "Queued <search> on <source>" (or "Already queued" when `created` is false), clear the fields, refresh(). On failure: toast with the server's `detail` text when it is a string, otherwise "Could not queue the scrape (HTTP <status>)".
5. The empty state keeps its message but its button becomes a quiet button that focuses the Artist field (one primary per view).
6. Tests (jsdom, mock fetch and usePipelineTelemetry): an empty form sends nothing and shows both errors; a valid form calls /api/v1/scrape/trigger with source and search_query and an Idempotency-Key header; only the two sources are offered.

## Done when (the reviewer's under-10-minute check; put it in the PR)
Open http://127.0.0.1:3006/pipeline. Press Queue scrape with empty fields: two field errors, no request. Enter "Deadmau5" and "Strobe", choose MixesDB, press Queue scrape: a toast confirms, and within a refresh the Scrape runs table shows "Deadmau5 Strobe" with source mixesdb. In the network tab the request carries search_query and an Idempotency-Key header.

## Checks
`cd frontend && npx tsc --noEmit -p . && npx oxlint src && npx vitest run src && npx vite build` and `PYTHONUTF8=1 bash scripts/sync-design-system.sh --check`. Report failures in files you do not own; do not fix them.

## Hand-back
The one job done, files added/changed/deleted, checks run and not run, the reviewer check, follow-ups.
