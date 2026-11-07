# Architectural improvements: songnodes-frontend

Written 7 Nov 2026 by the data-flow investigation. 2 tasks for this sub-project.

From the SongNodes data flow report of 7 Nov 2026 (`findings.json` sha256 `e469b41763f1`). Master report, in the songnodes repo: `documentation/data-flow-analysis/DATA_FLOW_AND_PAGE_INTERACTION_REPORT.md` (Markdown), `documentation/data-flow-analysis/report/index.html` (web), `documentation/data-flow-analysis/DATA_FLOW_AND_PAGE_INTERACTION_REPORT.pdf` (PDF); gaps in `documentation/data-flow-analysis/ARCHITECTURE_ENHANCEMENTS_AND_GAPS_REPORT.md`.

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

