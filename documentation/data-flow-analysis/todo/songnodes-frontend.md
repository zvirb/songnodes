# Architectural improvements: songnodes-frontend

Written 7 Nov 2026 by the data-flow investigation. 7 tasks for this sub-project.

From the SongNodes data flow report of 7 Nov 2026 (`findings.json` sha256 `9239a01d7141`). Master report, in the songnodes repo: `documentation/data-flow-analysis/DATA_FLOW_AND_PAGE_INTERACTION_REPORT.md` (Markdown), `documentation/data-flow-analysis/report/index.html` (web), `documentation/data-flow-analysis/DATA_FLOW_AND_PAGE_INTERACTION_REPORT.pdf` (PDF); gaps in `documentation/data-flow-analysis/ARCHITECTURE_ENHANCEMENTS_AND_GAPS_REPORT.md`.

Each task is one job package (AGENTS.md rules 1–3: one verb, owned paths only, about 400 changed lines). UI work follows the SongNodes design system in full: tokens and `sn-*` classes only, its page patterns, and no local overrides; a missing pattern is added to the design system first.

## SN-T04: Raise the frontend nginx body limit to the ingest limit

- **Type:** fix
- **Owned paths:** `frontend/Dockerfile`
- **Depends on:** –
- **Verification:** a 5 MB library import returns 202, not 413
- **Gap `sn-fe-gap-ingest-body-limit` (medium):** Library ingest allows 50 MB but frontend nginx accepts 1 MB
  - Fix: Add client_max_body_size 64m; inside location /api/ (or a dedicated location = /api/v1/library/ingest) in the frontend Dockerfile default.conf, and map HTTP 413 to an explicit error in LibraryImportDialog.
  - Contract: ingest upload limit = FileDrop maxMb = nginx client_max_body_size = rest-api request limit
  - Evidence: songnodes/frontend/src/features/musicLibrary/components/LibraryImportDialog.tsx:23-24, songnodes/frontend/Dockerfile:91-99, songnodes/STATUS.md:1899
- **Impact:** closes sn-fe-gap-ingest-body-limit

## SN-T09: Fix the OAuth token hand-off and remove dead scraper calls

- **Type:** fix
- **Owned paths:** `frontend/src/components/OAuthCallback.tsx`, `frontend/src/pages/SettingsPage.tsx`, `frontend/src/pages/GraphPage.tsx`
- **Depends on:** SN-T01
- **Verification:** Send to TIDAL finds a token after a fresh login; no 404 in the graph page network log
- **Gap `sn-fe-gap-oauth-session-tokens` (high):** OAuth tokens written to sessionStorage have no reader
  - Fix: In OAuthCallback, when window.opener is null, call useStore.getState().credentials.updateCredentials(service,{accessToken,refreshToken,expiresAt,isConnected:true}) before redirecting to /settings/<service>-connection, and delete the sessionStorage write; or have SettingsPage read and clear sessionStorage '<service>_oauth_tokens' on mount.
  - Contract: oauth-handoff/v1: {service, access_token, refresh_token, expires_at} consumed exactly once by the credentials slice
  - Evidence: songnodes/frontend/src/components/OAuthCallback.tsx:226-270, songnodes/frontend/src/pages/SettingsPage.tsx:362-394, songnodes/frontend/src/pages/GraphPage.tsx:15-33
- **Gap `sn-fe-gap-scrapers-endpoints` (medium):** Graph page calls scraper endpoints that do not exist
  - Fix: Point the actions at POST /api/v1/target-tracks/{id}/search and POST /api/v1/scrape/trigger, or remove the buttons; add a contract test listing every frontend path against the FastAPI OpenAPI document.
  - Contract: frontend-endpoint-manifest.json checked against rest-api /openapi.json in CI
  - Evidence: songnodes/frontend/src/components/DJInterface.tsx:360,395,432, /home/claude/dfa/scratch/sn-frontend/backend_routes.tsv
- **Gap `sn-be-gap-frontend-dead-routes` (medium):** Frontend calls routes that do not exist
  - Fix: Point DJInterface at POST /api/v1/target-tracks/{id}/search and drop queue/clear (no queue endpoint), or add the routes in a router module.
  - Contract: Use existing target-tracks router.
  - Evidence: songnodes/frontend/src/components/DJInterface.tsx:360, songnodes/frontend/src/components/DJInterface.tsx:432
- **Impact:** closes sn-fe-gap-oauth-session-tokens, sn-fe-gap-scrapers-endpoints, sn-be-gap-frontend-dead-routes

## UX-T01: Build the Review queue page (UX-01)

- **Type:** ux-page
- **Owned paths:** `frontend/src/features/musicLibrary/ReviewQueuePage.tsx (new)`, `frontend/src/features/musicLibrary/route.tsx`, `services/rest_api/routers/library_overrides.py (new)`
- **Depends on:** UX-T09, SN-T03
- **Verification:** see UX-01
- **Gap `ml-gap-written-never-read` (critical):** Outputs with no reader
  - Fix: Either delete the step or give it a consumer: have process read the newest review_queue.csv override column into energy_overrides; move tests/reports to songnodes.
  - Contract: review_queue.csv energy_score_override -> overrides
  - Evidence: musicLibrary/pipeline/djlib/export.py:285-305, musicLibrary/pipeline/run_weekly.py:298-308
- **Impact:** closes ml-gap-written-never-read

## UX-T02: Build the Track detail page (UX-02)

- **Type:** ux-page
- **Owned paths:** `frontend/src/features/trackDetail/ (new)`, `frontend/src/components/TrackDetailsModal.tsx`
- **Depends on:** SN-T08
- **Verification:** see UX-02
- **Gap `ml-gap-transitions-not-used` (medium):** songnodes proven transitions never inform musicLibrary set building
  - Fix: Add GET /api/v1/library/transitions?ids=… returning occurrence_count for library-track pairs; have build_db fetch it (optional) and add 'nx' (proven next track ids with counts) to library.json tracks; Set Builder ranks spares by it.
  - Contract: library.json tracks[].nx: [{id, n}]
  - Evidence: songnodes/scripts/load-library-targets.sql, musicLibrary/pipeline/build_db.py:190-229
- **Impact:** closes ml-gap-transitions-not-used

## UX-T03: Pipeline health page and run history (UX-03)

- **Type:** ux-page
- **Owned paths:** `frontend/src/pages/ScraperProgressPage.tsx`, `frontend/src/features/pipeline/RunsPage.tsx (new)`, `frontend/src/features/pipeline/RunMonitor.tsx (new, M5)`
- **Depends on:** ML-T06
- **Verification:** see UX-03
- **Gap `sn-be-gap-backups` (high):** Working backup for the compose volume
  - Fix: Rewrite scripts/backup_database.sh to docker compose -f compose.dev.yaml exec -T postgres pg_dump -U songnodes -Fc songnodes > backups/songnodes-$(date +%Y%m%d).dump with retention, and retire backup_volumes.sh.
  - Contract: Backup file: backups/songnodes-YYYYMMDD.dump (pg custom format).
  - Evidence: songnodes/scripts/backup_database.sh:52
- **Impact:** closes sn-be-gap-backups

## UX-T04: Build the Buy list page (UX-04)

- **Type:** ux-page
- **Owned paths:** `frontend/src/features/musicLibrary/BuyListPage.tsx (new)`, `frontend/src/features/musicLibrary/route.tsx`
- **Depends on:** UX-T09, ML-T04
- **Verification:** see UX-04
- **Gap `ml-gap-rekordbox-feedback` (medium):** Rekordbox play history and overrides do not feed back automatically
  - Fix: Parse rekordbox_collection.xml in process: match by Location/Artist+Title to set local_path and last_played, add a play appearance (source 'Rekordbox') so rotation sees real play; keep calibrate as the suggestion step.
  - Contract: rekordbox DJ_PLAYLISTS TRACK{Location, Artist, Name, PlayCount, LastPlayed, DateAdded} -> ledger local_path, appearances
  - Evidence: musicLibrary/pipeline/calibrate.py:55-83, musicLibrary/pipeline/djlib/export.py:356-358
- **Impact:** closes ml-gap-rekordbox-feedback

## SN-T10: IndexedDB last-good-data cache per 16 platform

- **Type:** fix
- **Owned paths:** `frontend/src/hooks/useDataLoader.ts`, `frontend/src/lib/lastGood.ts (new)`
- **Depends on:** –
- **Verification:** with the API down, /library shows the last data with a stale stamp instead of an error
- **Gap `sn-fe-gap-indexeddb-cache` (medium):** No IndexedDB last-good-data cache despite design-system rule
  - Fix: Add frontend/src/lib/offlineCache.ts (idb-keyval style store "sn-cache" with keys graph, library, sets, each {data, fetchedAt}); write on successful loadLibrary/useDataLoader/readSavedSetsAsync, read on failure and pass fetchedAt to FreshnessStamp.
  - Contract: sn-cache/v1 {key, data, fetchedAt ISO, apiVersion}
  - Evidence: songnodes/design-system/16-platform.md:50, songnodes/frontend/src/features/musicLibrary/data.ts:107-135
- **Impact:** closes sn-fe-gap-indexeddb-cache

