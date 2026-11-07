# Architectural improvements: design-system

Written 7 Nov 2026 by the data-flow investigation. 7 tasks for this sub-project.

From the SongNodes data flow report of 7 Nov 2026 (`findings.json` sha256 `9239a01d7141`). Master report, in the songnodes repo: `documentation/data-flow-analysis/DATA_FLOW_AND_PAGE_INTERACTION_REPORT.md` (Markdown), `documentation/data-flow-analysis/report/index.html` (web), `documentation/data-flow-analysis/DATA_FLOW_AND_PAGE_INTERACTION_REPORT.pdf` (PDF); gaps in `documentation/data-flow-analysis/ARCHITECTURE_ENHANCEMENTS_AND_GAPS_REPORT.md`.

Each task is one job package (AGENTS.md rules 1–3: one verb, owned paths only, about 400 changed lines). UI work follows the SongNodes design system in full: tokens and `sn-*` classes only, its page patterns, and no local overrides; a missing pattern is added to the design system first.

## DS-T01: Publish 1.10.0 to the design-system artifact

- **Type:** design-system
- **Owned paths:** `design-system artifact 7f37707d`
- **Depends on:** –
- **Verification:** artifact tokens.json version is 1.10.0
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

