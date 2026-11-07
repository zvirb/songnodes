# Architectural improvements: songnodes-services

Written 7 Nov 2026 by the data-flow investigation. 4 tasks for this sub-project.

From the SongNodes data flow report of 7 Nov 2026 (`findings.json` sha256 `e469b41763f1`). Master report, in the songnodes repo: `documentation/data-flow-analysis/DATA_FLOW_AND_PAGE_INTERACTION_REPORT.md` (Markdown), `documentation/data-flow-analysis/report/index.html` (web), `documentation/data-flow-analysis/DATA_FLOW_AND_PAGE_INTERACTION_REPORT.pdf` (PDF); gaps in `documentation/data-flow-analysis/ARCHITECTURE_ENHANCEMENTS_AND_GAPS_REPORT.md`.

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

