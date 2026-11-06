# Architecture enhancements and gaps

Part of the SongNodes data flow report (7 Nov 2026). Source: `findings.json` sha256 `e469b41763f1`. Web: `report/index.html#gaps`; PDF section 8.

## 1. Critical data gaps


### Second-source BPM and key are discarded (`ml-gap-deezer-bpm-not-merged`, critical, effort S)

When the chosen version is TIDAL, Deezer's BPM is used only for the cross-check; ref_mb is not queried by the pipeline at all despite the 2026-10-25 decision to cut web calls with it.

- **Fix:** In process, when v.bpm is null take the Deezer twin's bpm (fold to pillar range) and record bpm_source; add an optional ref_mb lookup by ISRC for key/label/release date.
- **Data contract:** `ledger track bpm_source, key_source`
- **Affects:** musicLibrary/pipeline/run_weekly.py
- **Evidence:** musicLibrary/pipeline/run_weekly.py:226-230, musicLibrary/decisions/2026-10-25-metabrainz-integration-baseline.md

### Saved-set shape is no longer shared between the two Set Builders (`ml-gap-saved-set-shape`, critical, effort M)

musicLibrary sets carry tidal, shape, minutes, mix, pool, seed and ledger track ids (h:/bp:). songnodes stores only name, description and uuid track ids server-side and has no tidal flag. A songnodes 'Export sets for the weekly run' file imports into sets/set_tracks with uuid ids that match no ledger track, and sync-sets skips every set (no tidal). /api/v1/library/sets/export returns {sets:[...]} without ids, which load_sets turns into a list of lists and crashes on.

- **Fix:** Version the document: add schema 'naarm.saved-set.v2' {id, name, shape, minutes, mix, pool, seed, tidal, tracks[{ml_id, sn_id, tgt, move}]}; songnodes stores the extra fields in library.sets (jsonb) and maps uuid->source_id via library.track_xref on export; load_sets accepts {sets:[...]} and resolves ids via xref.
- **Data contract:** `naarm.saved-set.v2`
- **Affects:** musicLibrary/pipeline/build_db.py, musicLibrary/pipeline/run_weekly.py, songnodes/frontend/src/features/musicLibrary/data.ts, songnodes/services/library/model/library_db.py
- **Evidence:** musicLibrary/pipeline/build_db.py:93-106, musicLibrary/pipeline/run_weekly.py:529-547, songnodes/frontend/src/features/musicLibrary/data.ts:140-161, songnodes/services/library/model/library_db.py:50-62

### JohnCourse.json and kiki.json are written but never consumed (`ml-gap-setlists-orphan`, critical, effort M)

Both are songnodes.setlists.v1 DJ tracklists (29 and 5 sets) at the musicLibrary root. cmd_sync_songnodes globs only the parent folder and inbox/, so they are never found; if found, the body {schema, setlists} does not match TracklistImportRequest {tracks, dj_artist, name} and the 422 is swallowed. JohnCourse.json.bak is invalid JSON.

- **Fix:** Move them to inbox/setlists/; post one request per setlist as {name: event, dj_artist: dj, tracks:[{artist,title,position,...}]}; log failures to outputs/<date>/ALERT_songnodes.txt.
- **Data contract:** `songnodes.setlists.v1 -> TracklistImportRequest`
- **Affects:** musicLibrary/pipeline/run_weekly.py, musicLibrary root JSON
- **Evidence:** musicLibrary/pipeline/run_weekly.py:599-616, songnodes/services/rest_api/main.py:96-100, musicLibrary/JohnCourse.json, musicLibrary/kiki.json

### Outputs with no reader (`ml-gap-written-never-read`, critical, effort S)

outputs/crates/*.csv, rejected.csv, ledger/history/*, db/dj_library.sqlite (only DB Browser), tests/reports/* (songnodes output) and the review_queue override column have no code reader; ledger beatport_check (243) is read only by the supervised Beatport playbook, which has never run.

- **Fix:** Either delete the step or give it a consumer: have process read the newest review_queue.csv override column into energy_overrides; move tests/reports to songnodes.
- **Data contract:** `review_queue.csv energy_score_override -> overrides`
- **Affects:** musicLibrary/outputs, musicLibrary/tests
- **Evidence:** musicLibrary/pipeline/djlib/export.py:285-305, musicLibrary/pipeline/run_weekly.py:298-308

### Make API token usable by scripts and TIDAL routes (`sn-be-gap-auth-token-flow`, critical, effort S)

Token middleware collides with TIDAL Bearer; import script sends no token; prefix typo. Queued PRs #578/#579 add a separate user login (cookie) but no enforcement on existing routes.

- **Fix:** In security/auth.py prefer X-API-Token over Authorization, fix the prefix to /api/v1/api-keys and add /api/v1/music-auth/spotify/token/status; pass SONGNODES_API_TOKEN and API_KEY_ENCRYPTION_SECRET through compose.dev.yaml; add -H "X-API-Token: $SONGNODES_API_TOKEN" to import-music-library.sh curl calls.
- **Data contract:** `X-API-Token header is the only admin credential; Authorization is reserved for provider tokens.`
- **Affects:** songnodes/services/rest_api/security, songnodes/compose.dev.yaml, songnodes/scripts/import-music-library.sh
- **Evidence:** songnodes/services/rest_api/security/auth.py:58, songnodes/scripts/import-music-library.sh:45

### artifact_sets.json lacks the tidal flag musicLibrary needs (`sn-fe-gap-artifact-sets-tidal-flag`, critical, effort M)

Set builder exports SavedSet[] without a 'tidal' field; musicLibrary run_weekly.py sync-sets filters sets by s.get('tidal'), so sets exported from songnodes are never pushed to TIDAL by the weekly run (songnodes has its own Send to TIDAL instead). The file is also only a browser download that has to be copied by hand.

- **Fix:** Either add 'tidal: boolean' (set when Send to TIDAL is requested) to SavedSet and the export, or document that songnodes sets go to TIDAL through /api/v1/tidal/sets/send and drop the inbox path; better, have musicLibrary read GET /api/v1/library/sets/export (exists, unused by the frontend).
- **Data contract:** `artifact_sets/v2: SavedSet[] + {tidal:boolean}`
- **Affects:** songnodes/frontend/src/features/musicLibrary/SetBuilderPage.tsx, musicLibrary/pipeline/run_weekly.py
- **Evidence:** songnodes/frontend/src/features/musicLibrary/SetBuilderPage.tsx:223-226, musicLibrary/pipeline/run_weekly.py:529, musicLibrary/pipeline/build_db.py:93-106

### Working backup for the compose volume (`sn-be-gap-backups`, high, effort S)

No script backs up songnodes-dev_dev-postgres-18.

- **Fix:** Rewrite scripts/backup_database.sh to docker compose -f compose.dev.yaml exec -T postgres pg_dump -U songnodes -Fc songnodes > backups/songnodes-$(date +%Y%m%d).dump with retention, and retire backup_volumes.sh.
- **Data contract:** `Backup file: backups/songnodes-YYYYMMDD.dump (pg custom format).`
- **Affects:** songnodes/scripts
- **Evidence:** songnodes/scripts/backup_database.sh:52

### Decide and document the real layer model (`sn-be-gap-medallion-doc`, high, effort S)

Gold/operational exist only in docs and unused Helm cronjobs.

- **Fix:** Either (a) update CLAUDE.md to Bronze -> Silver -> projection_tracks/graph reads, drop gold_track_graph, or (b) add a gold job kind (REFRESH MATERIALIZED VIEW CONCURRENTLY gold_track_graph after ingest, apply medallion 008) and point graph-api at it. Record the choice in docs/decisions.
- **Data contract:** `Layer contract table: layer -> table -> sole writer -> readers.`
- **Affects:** songnodes/CLAUDE.md, songnodes/services/graph-visualization-api
- **Evidence:** songnodes/CLAUDE.md:11, songnodes/sql/migrations/medallion/008_gold_track_graph_index_up.sql:3

### Scraper must stop at bronze (`sn-be-gap-scraper-bronze-only`, high, effort S)

The unified scraper writes silver directly (layer skip, Unknown Artist, no outbox).

- **Fix:** Remove the tracks/playlists/playlist_tracks/song_adjacency branches from PersistencePipeline._flush_batch (keep bronze_* only) and rely on the ingest_pending follow-up; add a unique index on silver_enriched_tracks (bronze_id) or (lower(artist_name), lower(track_title)) and convert upsert_track to ON CONFLICT.
- **Data contract:** `Scraper output = bronze_scraped_playlists + bronze_scraped_tracks with positions 1..n; silver is written only by common/datalayer/ingest.py inside a transaction that appends an outbox event.`
- **Affects:** songnodes/scrapers/pipelines, songnodes/services/common/datalayer
- **Evidence:** songnodes/scrapers/pipelines/persistence_pipeline.py:910, songnodes/services/common/datalayer/ingest.py:104

### Target scrapes must bypass the daily discovery quota (`sn-be-gap-target-scrape-quota`, high, effort S)

1001tracklists targeted searches are blocked by scraped:setlists:1001tracklists:last_run.

- **Fix:** Set self.force_run = True in OneThousandOneTracklistsSpider.__init__ when search_query is given (as MixesDB does at line 116), or have the handler pass force_run=1 via params; and only stamp last_searched / found_nothing when the spider did not close with daily_quota_reached (return a reason from /scrape).
- **Data contract:** `POST /scrape response gains close_reason; handler treats daily_quota_reached as RetryableError.`
- **Affects:** songnodes/scrapers/spiders, songnodes/services/common/datalayer/handlers.py
- **Evidence:** songnodes/scrapers/spiders/1001tracklists_spider.py:189, songnodes/services/common/datalayer/handlers.py:85

### OAuth tokens written to sessionStorage have no reader (`sn-fe-gap-oauth-session-tokens`, high, effort M)

Settings connects in the same window (window.location.href), so OAuthCallback has no opener: it writes sessionStorage <service>_oauth_tokens and redirects to /. GraphPage and SettingsPanel only read localStorage tidal_oauth_tokens/spotify_oauth_tokens (which OAuthCallback removes), so the browser store never receives the tokens; sendToTidal and useTokenRefresh then lack an access token.

- **Fix:** In OAuthCallback, when window.opener is null, call useStore.getState().credentials.updateCredentials(service,{accessToken,refreshToken,expiresAt,isConnected:true}) before redirecting to /settings/<service>-connection, and delete the sessionStorage write; or have SettingsPage read and clear sessionStorage '<service>_oauth_tokens' on mount.
- **Data contract:** `oauth-handoff/v1: {service, access_token, refresh_token, expires_at} consumed exactly once by the credentials slice`
- **Affects:** songnodes/frontend/src/components/OAuthCallback.tsx, songnodes/frontend/src/pages/SettingsPage.tsx
- **Evidence:** songnodes/frontend/src/components/OAuthCallback.tsx:226-270, songnodes/frontend/src/pages/SettingsPage.tsx:362-394, songnodes/frontend/src/pages/GraphPage.tsx:15-33

### Rekordbox play history and overrides do not feed back automatically (`ml-gap-rekordbox-feedback`, medium, effort S)

Play history reaches only calibrate.py, and only from a hand-dropped overrides/rekordbox_collection.xml (absent); calibrate writes suggestions only and has never run. local_path must be typed into overrides, so the XML export holds 0 tracks and the buy list never shrinks.

- **Fix:** Parse rekordbox_collection.xml in process: match by Location/Artist+Title to set local_path and last_played, add a play appearance (source 'Rekordbox') so rotation sees real play; keep calibrate as the suggestion step.
- **Data contract:** `rekordbox DJ_PLAYLISTS TRACK{Location, Artist, Name, PlayCount, LastPlayed, DateAdded} -> ledger local_path, appearances`
- **Affects:** musicLibrary/pipeline/run_weekly.py, musicLibrary/pipeline/calibrate.py
- **Evidence:** musicLibrary/pipeline/calibrate.py:55-83, musicLibrary/pipeline/djlib/export.py:356-358

### songnodes drops pipeline fields on ingest (`ml-gap-songnodes-field-loss`, medium, effort S)

library_search returns bp NULL, generated null, empty sources and runs, ids as uuids; rev/ovr/local/sync come back only if mapped. The songnodes Library page therefore cannot show buy links or run history that the artifact shows.

- **Fix:** Persist export extras (bp, sync, rev, ovr, local) from _from_export 'export' into evidence and select them in library_search; return generated and runs from library.runs.
- **Data contract:** `LibraryTrack parity between library.json and /api/v1/library/search`
- **Affects:** songnodes/services/rest_api/routers/library_search.py
- **Evidence:** songnodes/services/rest_api/routers/library_search.py, songnodes/frontend/src/features/musicLibrary/data.ts:121-129

### README contract names a songnodes script that no longer exists (`ml-gap-sync-script-missing`, medium, effort M)

README and .gitignore say scripts/sync-music-library.sh copies library.json to frontend/public/data/music-library.json. That script and folder are gone; songnodes now loads /api/v1/library/search fed by POST /api/v1/library/ingest (import-music-library.sh, and cmd_sync_songnodes inside cmd_db).

- **Fix:** Update README 'In SongNodes' section to name scripts/import-music-library.sh and the run_weekly db step; drop the .gitignore lines for music-library.json in songnodes.
- **Data contract:** `library.json v1 (build_db.export_artifact_json) -> POST /api/v1/library/ingest, Idempotency-Key import-<md5>`
- **Affects:** musicLibrary/README.md, songnodes/.gitignore
- **Evidence:** musicLibrary/README.md, songnodes/.gitignore:251-253, songnodes/scripts/import-music-library.sh

### TIDAL login collides with songnodes on 127.0.0.1:3006 (`ml-gap-tidal-port`, medium, effort M)

Both use the same TIDAL app and redirect; songnodes' /oauth/callback route consumes the single-use code if the frontend is up. Two TIDAL send paths exist (sync-sets 'SET · name' and songnodes /api/v1/tidal/sets/send) with separate token stores and no shared playlist map.

- **Fix:** Register a second redirect (http://127.0.0.1:3016/oauth/callback) on the TIDAL app for musicLibrary, or reuse songnodes' stored token through an endpoint; keep one playlist map keyed by set id.
- **Data contract:** `TIDAL redirect per client; shared set->playlist map`
- **Affects:** musicLibrary/pipeline/djlib/tidal.py, songnodes music_auth / tidal_playlists
- **Evidence:** musicLibrary/pipeline/djlib/tidal.py:32, songnodes/frontend/src/App.tsx:33, songnodes/services/rest_api/routers/tidal_playlists.py:318

### songnodes proven transitions never inform musicLibrary set building (`ml-gap-transitions-not-used`, medium, effort M)

Direction musicLibrary -> songnodes exists (library.json ingest; load-library-targets.sql makes library tracks scrape targets). Nothing flows back: library.json and the artifact Set Builder have no transition data, and the songnodes /sets page does not call the graph either.

- **Fix:** Add GET /api/v1/library/transitions?ids=… returning occurrence_count for library-track pairs; have build_db fetch it (optional) and add 'nx' (proven next track ids with counts) to library.json tracks; Set Builder ranks spares by it.
- **Data contract:** `library.json tracks[].nx: [{id, n}]`
- **Affects:** songnodes graph-api, musicLibrary/pipeline/build_db.py, Set Builder pages
- **Evidence:** songnodes/scripts/load-library-targets.sql, musicLibrary/pipeline/build_db.py:190-229

### Frontend calls routes that do not exist (`sn-be-gap-frontend-dead-routes`, medium, effort S)

DJInterface posts /api/v1/scrapers/target-tracks/search and /api/v1/scrapers/queue/clear.

- **Fix:** Point DJInterface at POST /api/v1/target-tracks/{id}/search and drop queue/clear (no queue endpoint), or add the routes in a router module.
- **Data contract:** `Use existing target-tracks router.`
- **Affects:** songnodes/frontend/src/components/DJInterface.tsx
- **Evidence:** songnodes/frontend/src/components/DJInterface.tsx:360, songnodes/frontend/src/components/DJInterface.tsx:432

### Enforce the library ingest body contract (`sn-be-gap-library-ingest-409`, medium, effort S)

Same key + different body silently returns the old job.

- **Fix:** Store sha256 of the canonical JSON payload in ingestion_jobs.payload_hash (or compare payload) in jobs.enqueue for library_ingest and raise CatalogError(409) on mismatch.
- **Data contract:** `Idempotency-Key + payload hash.`
- **Affects:** songnodes/services/common/datalayer/jobs.py, songnodes/services/rest_api/routers/library_ingest.py
- **Evidence:** songnodes/contracts/library_ingest.md:16

### Project library_track events into projection_tracks (`sn-be-gap-library-projection`, medium, effort S)

Library search reads stale rows after a library ingest.

- **Fix:** In projection.handle_event treat aggregate_type library_track like track (project_track on aggregate_id), and add a consumer or explicit ignore list for library_set and setlist events.
- **Data contract:** `Outbox event registry: event_type -> consumers (projection_tracks, graph_projection).`
- **Affects:** songnodes/services/common/datalayer/projection.py
- **Evidence:** songnodes/services/common/datalayer/projection.py:75

### Single migration runner with a ledger (`sn-be-gap-migration-ledger`, medium, effort S)

Migrations are a hand list in start-dev.sh.

- **Fix:** Apply 000_schema_migrations_up.sql and extend services/worker/migrate.py to apply every sql/migrations/*_up.sql in numeric order once, recording filename+checksum; start-dev.sh calls docker compose run --rm worker python migrate.py.
- **Data contract:** `schema_migrations(version, checksum, applied_at).`
- **Affects:** songnodes/services/worker/migrate.py, songnodes/scripts/start-dev.sh
- **Evidence:** songnodes/services/worker/migrate.py:1, songnodes/scripts/start-dev.sh:31

### Music search has no deployed backend (`sn-be-gap-music-search`, medium, effort S)

rest-api proxies to metadata-enrichment:8086, not in compose.

- **Fix:** Move the S1 search router into rest-api using common/providers (tidal, deezer) or add metadata-enrichment to compose; until then return an explicit 503 with cause in the UI.
- **Data contract:** `GET /api/v1/music-search/{service}?q= -> [{id, artist, title, isrc}].`
- **Affects:** songnodes/services/rest_api
- **Evidence:** songnodes/services/rest_api/main.py:692

### Run the scrape HTTP call outside the job transaction (`sn-be-gap-scrape-outside-tx`, medium, effort S)

A 16-minute open transaction holds xmin and stalls the outbox.

- **Fix:** In runner.run_one, let handlers declare long_io=True; for scrape, perform the HTTP POST before opening conn.transaction(), then record_playlists_found + follow-ups + complete inside a short transaction; lease (1800s) still guards double-run.
- **Data contract:** `Handler contract: (prepare outside tx) -> (commit inside tx).`
- **Affects:** songnodes/services/common/datalayer/runner.py, songnodes/services/common/datalayer/handlers.py
- **Evidence:** songnodes/services/common/datalayer/runner.py:37

### Graph WebSocket has a server but no client (`sn-fe-gap-graph-ws`, medium, effort S)

graph-api exposes WEBSOCKET /api/graph/ws/{room_id} (nginx passes Upgrade headers for /api/graph). The only frontend WebSocket client (LiveDataLoader, /api/ws) is unreachable and targets a path rest-api does not serve.

- **Fix:** Delete LiveDataLoader/useLiveDataLoader, or rewire it to /api/graph/ws/<room> and mount it from GraphPage.
- **Data contract:** `graph-ws/v1 message {type: nodes|edges|delta, payload}`
- **Affects:** songnodes/frontend/src/components/LiveDataLoader.tsx
- **Evidence:** songnodes/frontend/src/components/LiveDataLoader.tsx:138-140, songnodes/frontend/Dockerfile:81-91

### No IndexedDB last-good-data cache despite design-system rule (`sn-fe-gap-indexeddb-cache`, medium, effort S)

design-system/16-platform.md:50 says SongNodes keeps the last graph, library and saved sets in IndexedDB and shows them with FreshnessStamp when the API is unreachable. No indexedDB usage exists in frontend/src; library load just errors and Home shows a dash.

- **Fix:** Add frontend/src/lib/offlineCache.ts (idb-keyval style store "sn-cache" with keys graph, library, sets, each {data, fetchedAt}); write on successful loadLibrary/useDataLoader/readSavedSetsAsync, read on failure and pass fetchedAt to FreshnessStamp.
- **Data contract:** `sn-cache/v1 {key, data, fetchedAt ISO, apiVersion}`
- **Affects:** songnodes/frontend/src/features/musicLibrary/data.ts, songnodes/frontend/src/hooks/useDataLoader.ts
- **Evidence:** songnodes/design-system/16-platform.md:50, songnodes/frontend/src/features/musicLibrary/data.ts:107-135

### Library ingest allows 50 MB but frontend nginx accepts 1 MB (`sn-fe-gap-ingest-body-limit`, medium, effort M)

LibraryImportDialog FileDrop limit is 50 MB and the body is the whole export; the frontend image nginx config sets no client_max_body_size, so nginx default 1 MB returns 413 for any larger export. STATUS.md already lists it as a follow-up.

- **Fix:** Add client_max_body_size 64m; inside location /api/ (or a dedicated location = /api/v1/library/ingest) in the frontend Dockerfile default.conf, and map HTTP 413 to an explicit error in LibraryImportDialog.
- **Data contract:** `ingest upload limit = FileDrop maxMb = nginx client_max_body_size = rest-api request limit`
- **Affects:** songnodes/frontend/Dockerfile, songnodes/frontend/src/features/musicLibrary/components/LibraryImportDialog.tsx
- **Evidence:** songnodes/frontend/src/features/musicLibrary/components/LibraryImportDialog.tsx:23-24, songnodes/frontend/Dockerfile:91-99, songnodes/STATUS.md:1899

### Library freshness stamp is always unknown (`sn-fe-gap-library-generated`, medium, effort S)

loadLibrary sets generated: null and runs: [] because /api/v1/library/search returns rows only; Home and Library show an en dash for 'Library data from' and the weekly-run launcher summary never appears.

- **Fix:** Add GET /api/v1/library/meta returning {generated, ledger_updated, counts, sources, runs} from the ingest job result and merge it in loadLibrary.
- **Data contract:** `library-meta/v1 = LibraryFile minus tracks`
- **Affects:** songnodes/frontend/src/features/musicLibrary/data.ts, songnodes/services/rest_api/routers/library_search.py
- **Evidence:** songnodes/frontend/src/features/musicLibrary/data.ts:120-130, songnodes/frontend/src/pages/HomePage.tsx:22-46

### Graph page calls scraper endpoints that do not exist (`sn-fe-gap-scrapers-endpoints`, medium, effort M)

DJInterface posts to /api/v1/scrapers/target-tracks/search and /api/v1/scrapers/queue/clear; no rest-api route matches (route scan of services/rest_api).

- **Fix:** Point the actions at POST /api/v1/target-tracks/{id}/search and POST /api/v1/scrape/trigger, or remove the buttons; add a contract test listing every frontend path against the FastAPI OpenAPI document.
- **Data contract:** `frontend-endpoint-manifest.json checked against rest-api /openapi.json in CI`
- **Affects:** songnodes/frontend/src/components/DJInterface.tsx
- **Evidence:** songnodes/frontend/src/components/DJInterface.tsx:360,395,432, /home/claude/dfa/scratch/sn-frontend/backend_routes.tsv

### Pending target syncs are never retried and override the server (`sn-fe-gap-target-pending-sync`, medium, effort S)

A failed POST/DELETE leaves pendingSync=true in sn-target-tracks-v1; nothing reads pendingSync, and useUnifiedTracks prefers the local entry over backend state, so the device can disagree with target_tracks forever.

- **Fix:** On useUnifiedTracks.refresh(), replay entries with pendingSync=true through syncTargetTrack, and drop local entries whose backend match agrees; show a count of unsynced targets.
- **Data contract:** `sn-target-tracks-v2 {isTarget, priority, pendingSync, lastAttempt}`
- **Affects:** songnodes/frontend/src/services/trackSyncAdapter.ts, songnodes/frontend/src/hooks/useUnifiedTracks.ts
- **Evidence:** songnodes/frontend/src/services/trackSyncAdapter.ts:31-100, songnodes/frontend/src/hooks/useUnifiedTracks.ts:93-103

## 2. Proposed single-purpose modules

| ID | Name | Target users | One verb | Data inputs | Core operation | Size | Path |
|---|---|---|---|---|---|---|---|
| M1 | Set exchange | Set planner, weekly-run agent | Convert | songnodes saved sets (/api/v1/library/sets/export), artifact sets (artifact db `sets`) | Reads either saved-set shape and writes one versioned `songnodes.saved-set/2` document (name, shape, minutes, tracks[{isrc, tidal_id, ledger_id, tgt}], tidal) to musicLibrary inbox/artifact_sets.json, rejecting rows it cannot map. | about 250 lines (Estimate) | musicLibrary/pipeline/djlib/set_exchange.py (new) |
| M2 | Play-history import | Library curator | Import | Rekordbox / Lexicon collection XML, play counts and dates | Matches plays to ledger tracks by local_path then ISRC, appends `play` events to the ledger and writes rotation evidence that calibrate.py reads. | about 300 lines (Estimate) | musicLibrary/pipeline/djlib/play_history.py |
| M3 | Transition feed | Set planner, DJ | Export | songnodes silver_track_transitions (occurrence_count) joined to library tracks | Publishes `songnodes.transitions/1` (pairs of ISRCs with counts) beside library.json so both Set Builders can rank spares by proven pairings. | about 200 lines (Estimate) | songnodes/services/rest_api/routers/transitions_export.py |
| M4 | Contract check | Developer, pipeline operator | Verify | contracts/*.schema.json, the newest musicLibrary outputs, the songnodes ingest fixture | Validates every cross-project file and request body against its schema in CI and in the weekly run, and fails with the field that broke. | about 180 lines (Estimate) | songnodes/scripts/check_contracts.py |
| M5 | Run monitor | Pipeline operator, library curator | Alert | musicLibrary runs table and scrape_log; songnodes ingestion_jobs and web_call_log | Compares each run's resolve yield, source counts and job failures with the last four runs and raises one Banner-shaped warning with a source link when a figure drops by half. | about 220 lines (Estimate) | songnodes/frontend/src/features/pipeline/RunMonitor.tsx |

Every module is built from the SongNodes design system in full (tokens, `sn-*` classes, page patterns) and follows the standing rules R1–R8.

## 3. Unified storage backbone

Keep each project's own data folder and owner. Add one shared contracts folder and one exchange folder with versioned, schema-checked files, so every cross-project hop is a named file or endpoint with one writer.

![D10: Storage backbone before and after](storage-backbone-before-after.svg)

**D10 Storage backbone before and after.** Each project keeps its own data folder; the change is 4 new contract and exchange entries that carry the 8 cross-project hops. *n = 66 · stores and backbone entries · state built+projected · source stores[] (repo, kind, domain, state); backbone.tree; flows[] crossing repos · method hand-placed two-panel tree; 0 edges*

```
songnodes/
  contracts/                      # single source of every cross-project schema (exists; extend)
    library.set.saved.v2.json      # new
    library_ingest.openapi.yaml    # exists
    transitions.v1.json            # new
    setlists.v1.json               # new
  Postgres (compose volume)       # owner: songnodes services only
    bronze_* -> silver_* -> (gold_* decided in DFA gap) -> projection_*
musicLibrary/
  ledger/                         # owner: process step (append-only)
  db/dj_library.sqlite            # rebuilt each run from ledger
  inbox/                          # inputs written by people or other systems
  outputs/<date>/                 # run outputs, read by people
  exchange/                       # NEW: the only files the other project reads or writes
    library.json                  # musicLibrary -> songnodes (also POST /api/v1/library/ingest)
    saved-sets.json               # both ways, saved-set/2
    transitions.json              # songnodes -> musicLibrary, transitions/1
    setlists/*.json               # tracklists for songnodes import (moved from the root)
```

| Migration risk | Mitigation |
|---|---|
| Readers still point at old paths (README, import script, artifact) | Keep the old paths as copies for one release and log a warning when they are read. |
| Saved-set/1 documents in the artifact db | M1 reads both shapes; write only /2; keep /1 readable until no /1 set has been opened for four weeks. |
| Weekly run writes a file songnodes is reading | Write to a temporary name and rename; songnodes reads only complete files. |
| Postgres schema change for gold | One migration through the migration ledger gap first; never reset the volume (CLAUDE.md). |
