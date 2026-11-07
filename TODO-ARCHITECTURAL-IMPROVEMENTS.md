# Architectural improvements: songnodes

Written 7 Nov 2026 by the data-flow investigation. 22 tasks for this repository.

From the SongNodes data flow report of 7 Nov 2026 (`findings.json` sha256 `9239a01d7141`). Master report, in the songnodes repo: `documentation/data-flow-analysis/DATA_FLOW_AND_PAGE_INTERACTION_REPORT.md` (Markdown), `documentation/data-flow-analysis/report/index.html` (web), `documentation/data-flow-analysis/DATA_FLOW_AND_PAGE_INTERACTION_REPORT.pdf` (PDF); gaps in `documentation/data-flow-analysis/ARCHITECTURE_ENHANCEMENTS_AND_GAPS_REPORT.md`.

Each task is one job package (AGENTS.md rules 1–3: one verb, owned paths only, about 400 changed lines). UI work follows the SongNodes design system in full: tokens and `sn-*` classes only, its page patterns, and no local overrides; a missing pattern is added to the design system first.

## SN-T01: Require the API token on write and admin routes

- **Type:** security
- **Owned paths:** `services/rest_api/security/auth.py`, `compose.dev.yaml`
- **Depends on:** –
- **Verification:** curl without token gets 401 on every POST/PUT/DELETE; scripts pass with the token
- **Gap `sn-be-gap-auth-token-flow` (critical):** Make API token usable by scripts and TIDAL routes
  - Fix: In security/auth.py prefer X-API-Token over Authorization, fix the prefix to /api/v1/api-keys and add /api/v1/music-auth/spotify/token/status; pass SONGNODES_API_TOKEN and API_KEY_ENCRYPTION_SECRET through compose.dev.yaml; add -H "X-API-Token: $SONGNODES_API_TOKEN" to import-music-library.sh curl calls.
  - Contract: X-API-Token header is the only admin credential; Authorization is reserved for provider tokens.
  - Evidence: songnodes/services/rest_api/security/auth.py:58, songnodes/scripts/import-music-library.sh:45
- **Impact:** closes sn-be-gap-auth-token-flow

## SN-T02: Remove the default admin login from the queued auth router

- **Type:** security
- **Owned paths:** `services/rest_api/routers/user_auth.py (in PR #578)`
- **Depends on:** SN-T01
- **Verification:** no login succeeds without a configured user
- **Gap `sn-be-gap-auth-token-flow` (critical):** Make API token usable by scripts and TIDAL routes
  - Fix: In security/auth.py prefer X-API-Token over Authorization, fix the prefix to /api/v1/api-keys and add /api/v1/music-auth/spotify/token/status; pass SONGNODES_API_TOKEN and API_KEY_ENCRYPTION_SECRET through compose.dev.yaml; add -H "X-API-Token: $SONGNODES_API_TOKEN" to import-music-library.sh curl calls.
  - Contract: X-API-Token header is the only admin credential; Authorization is reserved for provider tokens.
  - Evidence: songnodes/services/rest_api/security/auth.py:58, songnodes/scripts/import-music-library.sh:45
- **Impact:** closes sn-be-gap-auth-token-flow

## SN-T03: Accept and keep musicLibrary pipeline fields on library ingest

- **Type:** contract
- **Owned paths:** `services/rest_api/routers/library_ingest.py`, `contracts/library_ingest.openapi.yaml`
- **Depends on:** –
- **Verification:** fixture round-trip keeps energy, rotation, pillar and ISRC
- **Gap `ml-gap-songnodes-field-loss` (medium):** songnodes drops pipeline fields on ingest
  - Fix: Persist export extras (bp, sync, rev, ovr, local) from _from_export 'export' into evidence and select them in library_search; return generated and runs from library.runs.
  - Contract: LibraryTrack parity between library.json and /api/v1/library/search
  - Evidence: songnodes/services/rest_api/routers/library_search.py, songnodes/frontend/src/features/musicLibrary/data.ts:121-129
- **Gap `sn-be-gap-library-ingest-409` (medium):** Enforce the library ingest body contract
  - Fix: Store sha256 of the canonical JSON payload in ingestion_jobs.payload_hash (or compare payload) in jobs.enqueue for library_ingest and raise CatalogError(409) on mismatch.
  - Contract: Idempotency-Key + payload hash.
  - Evidence: songnodes/contracts/library_ingest.md:16
- **Impact:** closes ml-gap-songnodes-field-loss, sn-be-gap-library-ingest-409

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

## SN-T05: Stop the unified scraper at bronze

- **Type:** data-integrity
- **Owned paths:** `scrapers/pipelines/persistence_pipeline.py`
- **Depends on:** –
- **Verification:** a scrape writes bronze rows only; ingest creates silver once
- **Gap `sn-be-gap-scraper-bronze-only` (high):** Scraper must stop at bronze
  - Fix: Remove the tracks/playlists/playlist_tracks/song_adjacency branches from PersistencePipeline._flush_batch (keep bronze_* only) and rely on the ingest_pending follow-up; add a unique index on silver_enriched_tracks (bronze_id) or (lower(artist_name), lower(track_title)) and convert upsert_track to ON CONFLICT.
  - Contract: Scraper output = bronze_scraped_playlists + bronze_scraped_tracks with positions 1..n; silver is written only by common/datalayer/ingest.py inside a transaction that appends an outbox event.
  - Evidence: songnodes/scrapers/pipelines/persistence_pipeline.py:910, songnodes/services/common/datalayer/ingest.py:104
- **Impact:** closes sn-be-gap-scraper-bronze-only

## SN-T06: Decide and document the real layer model

- **Type:** docs
- **Owned paths:** `docs/DATA_LAYER.md`, `CLAUDE.md`
- **Depends on:** SN-T05
- **Verification:** docs and compose name the same jobs
- **Gap `sn-be-gap-medallion-doc` (high):** Decide and document the real layer model
  - Fix: Either (a) update CLAUDE.md to Bronze -> Silver -> projection_tracks/graph reads, drop gold_track_graph, or (b) add a gold job kind (REFRESH MATERIALIZED VIEW CONCURRENTLY gold_track_graph after ingest, apply medallion 008) and point graph-api at it. Record the choice in docs/decisions.
  - Contract: Layer contract table: layer -> table -> sole writer -> readers.
  - Evidence: songnodes/CLAUDE.md:11, songnodes/sql/migrations/medallion/008_gold_track_graph_index_up.sql:3
- **Impact:** closes sn-be-gap-medallion-doc

## SN-T07: Let target scrapes bypass the daily discovery quota

- **Type:** fix
- **Owned paths:** `scrapers/spiders/1001tracklists_spider.py`
- **Depends on:** –
- **Verification:** two target scrapes in an hour both run
- **Gap `sn-be-gap-target-scrape-quota` (high):** Target scrapes must bypass the daily discovery quota
  - Fix: Set self.force_run = True in OneThousandOneTracklistsSpider.__init__ when search_query is given (as MixesDB does at line 116), or have the handler pass force_run=1 via params; and only stamp last_searched / found_nothing when the spider did not close with daily_quota_reached (return a reason from /scrape).
  - Contract: POST /scrape response gains close_reason; handler treats daily_quota_reached as RetryableError.
  - Evidence: songnodes/scrapers/spiders/1001tracklists_spider.py:189, songnodes/services/common/datalayer/handlers.py:85
- **Impact:** closes sn-be-gap-target-scrape-quota

## SN-T08: Publish the transition feed (M3)

- **Type:** module
- **Owned paths:** `services/rest_api/routers/transitions_export.py (new)`, `contracts/transitions.v1.json (new)`
- **Depends on:** SN-T03
- **Verification:** GET returns transitions/1 for library ISRCs
- **Gap `ml-gap-transitions-not-used` (medium):** songnodes proven transitions never inform musicLibrary set building
  - Fix: Add GET /api/v1/library/transitions?ids=… returning occurrence_count for library-track pairs; have build_db fetch it (optional) and add 'nx' (proven next track ids with counts) to library.json tracks; Set Builder ranks spares by it.
  - Contract: library.json tracks[].nx: [{id, n}]
  - Evidence: songnodes/scripts/load-library-targets.sql, musicLibrary/pipeline/build_db.py:190-229
- **Impact:** closes ml-gap-transitions-not-used

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

## DS-T01: Publish 1.10.0 to the design-system artifact

- **Type:** design-system
- **Owned paths:** `design-system artifact 7f37707d`
- **Depends on:** –
- **Verification:** artifact tokens.json version is 1.10.0
- **Impact:** closes a release-process step

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

## UX-T06: Rebuild the work-queue tracker on the design system (UX-06)

- **Type:** ux-page
- **Owned paths:** `plan/work-queue-2026-10-30/tracker.html`
- **Depends on:** –
- **Verification:** see UX-06
- **Impact:** closes a release-process step

## UX-T07: Rule: one primary when the empty state carries it (UX-07)

- **Type:** design-system
- **Owned paths:** `design-system/06-interaction-accessibility.md`, `design-system/rules/rules.yaml`, `scripts/check_design_system.py`, `design-system/17-governance.md`
- **Depends on:** –
- **Verification:** see UX-07
- **Impact:** closes a release-process step

## UX-T08: Linter: Unknown values and Title Case labels (UX-08)

- **Type:** design-system
- **Owned paths:** `design-system/linters/check.py`, `design-system/rules/rules.yaml`
- **Depends on:** –
- **Verification:** see UX-08
- **Impact:** closes a release-process step

## UX-T09: DataTable editable cell (UX-09)

- **Type:** design-system
- **Owned paths:** `design-system/components/DataTable/README.md`, `design-system/components/DataTable/preview.html`, `design-system/source/css/30-data.css`, `design-system/source/bundle.src.js`, `design-system/17-governance.md`
- **Depends on:** –
- **Verification:** see UX-09
- **Impact:** closes a release-process step

## UX-T10: Freshness stamp required on data pages (UX-10)

- **Type:** design-system
- **Owned paths:** `design-system/13-page-patterns.md`, `design-system/rules/rules.yaml`, `scripts/check_design_system.py`
- **Depends on:** –
- **Verification:** see UX-10
- **Gap `sn-fe-gap-library-generated` (medium):** Library freshness stamp is always unknown
  - Fix: Add GET /api/v1/library/meta returning {generated, ledger_updated, counts, sources, runs} from the ingest job result and merge it in loadLibrary.
  - Contract: library-meta/v1 = LibraryFile minus tracks
  - Evidence: songnodes/frontend/src/features/musicLibrary/data.ts:120-130, songnodes/frontend/src/pages/HomePage.tsx:22-46
- **Impact:** closes sn-fe-gap-library-generated

## UX-T11: ServiceStatus state from a usable token (UX-11)

- **Type:** design-system
- **Owned paths:** `design-system/components/ServiceStatus/README.md`, `design-system/components/AuthCallbackPage/README.md`, `design-system/components/SettingsPage/README.md`
- **Depends on:** SN-T09
- **Verification:** see UX-11
- **Gap `sn-fe-gap-oauth-session-tokens` (high):** OAuth tokens written to sessionStorage have no reader
  - Fix: In OAuthCallback, when window.opener is null, call useStore.getState().credentials.updateCredentials(service,{accessToken,refreshToken,expiresAt,isConnected:true}) before redirecting to /settings/<service>-connection, and delete the sessionStorage write; or have SettingsPage read and clear sessionStorage '<service>_oauth_tokens' on mount.
  - Contract: oauth-handoff/v1: {service, access_token, refresh_token, expires_at} consumed exactly once by the credentials slice
  - Evidence: songnodes/frontend/src/components/OAuthCallback.tsx:226-270, songnodes/frontend/src/pages/SettingsPage.tsx:362-394, songnodes/frontend/src/pages/GraphPage.tsx:15-33
- **Impact:** closes sn-fe-gap-oauth-session-tokens

## UX-T12: Close Q-PRINT-1 and publish 1.10.0 (UX-12)

- **Type:** design-system
- **Owned paths:** `design-system/source/css/61-pages-b.css`, `design-system/15-print-export.md`, `design-system/17-governance.md`, `design-system artifact 7f37707d`
- **Depends on:** DS-T01
- **Verification:** see UX-12
- **Impact:** closes a release-process step

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

## Standing-rule violations in this project (report only)

| Page | Rule | Detail | Evidence |
|---|---|---|---|
| sn-be-svc-unified-scraper | R8 | PersistencePipeline inserts silver_enriched_tracks with artist_name defaulting to Unknown Artist and writes song_adjacency edges without artist checks; graph-api filters these at read time. | songnodes/scrapers/pipelines/persistence_pipeline.py:1383 |
| sn-fe-sets | R2 | header Build set primary (line 450) and empty-state Build set primary (line 590) both visible while the draft has no slots; repo checker does not test this rule (scripts/check_design_system.py --check: exit 0, no findings; frontend/design-system-pending.txt: all 37 lines commented out as migrated) | songnodes/frontend/src/features/musicLibrary/SetBuilderPage.tsx:450,584-590 |
| sn-fe-paths | R2 | Calculate primary (line 204) and empty-state primary Choose start track/Find path (224/235) visible together before a result; header empty-state Open library is also primary; repo checker does not test this rule (scripts/check_design_system.py --check: exit 0, no findings; frontend/design-system-pending.txt: all 37 lines commented out as migrated) | songnodes/frontend/src/features/pathfinder/PathfinderPage.tsx:126,204,218-240 |
| sn-fe-sources-import | R2 | Review Data and Run Search are on different tabs, but the review step adds a third primary (line 359) shown with the active tab (not rendered to confirm); repo checker does not test this rule (scripts/check_design_system.py --check: exit 0, no findings; frontend/design-system-pending.txt: all 37 lines commented out as migrated) | songnodes/frontend/src/features/aiSetlists/AISetlistsPage.tsx:244,266,359 |
| sn-fe-sources-import | R4 | inline maxHeight: 200 (raw px) on the prompt box; checker passes it | songnodes/frontend/src/features/aiSetlists/AISetlistsPage.tsx:228 |
| sn-fe-pipeline | R4 | inline style uses raw px (minHeight 300px, border 1px solid, lucide size 48) in the error state; checker passes it | songnodes/frontend/src/pages/ScraperProgressPage.tsx:167-171 |
| sn-fe-paths | R5 | 'Unknown algorithm' / 'Unknown optimization level' fallbacks (also en-US spelling) | songnodes/frontend/src/components/PathfinderPanel/hooks.ts:203,212 |
| sn-fe-sources-import | R5 | Title Case labels ('Copy Prompt', 'Paste Result', 'Additional Exclusions', 'Review Data', 'Run Search') and 'Unknown Date'/'Unknown DJ'/'Unknown Event' instead of an en dash | songnodes/frontend/src/features/aiSetlists/AISetlistsPage.tsx:219,227,236,244,266,338 |
| sn-fe-oauth-callback | R5 | 'Unknown error' shown in the failure message | songnodes/frontend/src/components/OAuthCallback.tsx:276 |
| sn-fe-login | R5 | banner titles 'Signed In:' and 'Error:' use Title Case (queued PR) | PR #579 LoginPage.tsx:54,68 |
| sn-fe-graph | R8 | primary load (/api/graph/data) drops invalid-artist nodes and their edges; fallback path GET /api/graph filters nodes but does not drop edges whose endpoint was filtered before computing connectedNodeIds, so edges to invalid-artist nodes reach the store | songnodes/frontend/src/hooks/useDataLoader.ts:85-110 |
| sn-fe-work-queue-tracker | R4 | design-system linter: 12 COL-HEX findings (lines 7-23) and 1 LAY-IMP (!important, line 66) | design-system/linters/check.py ../plan/work-queue-2026-10-30/tracker.html --json |
| sn-fe-ds-reference | R5 | linter: WRT-EMO line 360, WRT-CAPS line 191; also 7 A11Y-ICONBTN | design-system/linters/check.py ../docs/design-system/reference.html --json |
| sn-fe-paths | R8 | Pathfinder uses the same useDataLoader: primary load (/api/graph/data) drops invalid-artist nodes and their edges; fallback path GET /api/graph filters nodes but does not drop edges whose endpoint was filtered before computing connectedNodeIds, so edges to invalid-artist nodes reach the store | songnodes/frontend/src/hooks/useDataLoader.ts:85-110 |
