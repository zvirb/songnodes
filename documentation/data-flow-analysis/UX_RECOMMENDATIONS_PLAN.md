# User experience plan: proposed pages and design-system updates

Part of the SongNodes data flow report of 7 Nov 2026 (`findings.json` sha256 `9239a01d7141`). Web report section 9; PDF section 9. Every proposal answers evidence in the investigation (persona failure modes, standing-rule violations, gaps) and is sized as a one-job package in roadmap wave W6. State: Proposed (nothing built or queued). Effort is an Estimate against the AGENTS.md package budget.

## Order of work

1. Design-system rules first (UX-07, UX-08, UX-10): they change what every page must do and make the checks catch today's violations.
2. The editable cell (UX-09) and the service-row rule (UX-11), which the new pages depend on.
3. Pages in persona order of pain: Review queue (UX-01), Pipeline health (UX-03), One Set builder (UX-05), Track detail (UX-02), Buy list (UX-04), then the tracker (UX-06).
4. Close Q-PRINT-1 and publish 1.10.0 (UX-12) with the first page that ships.

## Proposals by persona

| ID | Proposal | P1 | P2 | P3 | P4 | P5 | P7 | P8 |
|---|---|---|---|---|---|---|---|---|
| UX-01 | Review queue | – | – | ● | – | – | ● | – |
| UX-02 | Track detail | ● | ● | ● | – | – | – | – |
| UX-03 | Pipeline health | – | – | – | ● | – | ● | – |
| UX-04 | Buy list | – | – | ● | – | – | – | ● |
| UX-05 | One Set builder | – | ● | – | – | – | ● | – |
| UX-06 | Work queue on the design system | – | – | – | – | ● | – | – |
| UX-07 | One primary action when an empty state carries it | – | ● | – | ● | – | – | – |
| UX-08 | Linter catches 'Unknown' and Title Case labels | ● | ● | – | ● | – | – | – |
| UX-09 | Inline editable cell for DataTable | – | – | ● | – | – | – | – |
| UX-10 | Freshness on every data page | ● | ● | ● | – | – | – | – |
| UX-11 | Service rows tell the truth about OAuth | – | ● | – | ● | – | – | – |
| UX-12 | Close Q-PRINT-1 and publish 1.10.0 | – | ● | – | – | ● | – | – |

## New pages and page changes

### UX-01: Review queue

- **Module:** library · **Route or place:** `/library/review` · **Effort:** L (Estimate) · **State:** Proposed
- **Problem:** The curator's weekly review is a CSV round trip: review_queue.csv lists all 413 tracks because none has a BPM, its override column is read by no code, and rows must be copied by hand into overrides/energy_overrides.csv with different columns. 0 overrides exist after four runs.
- **Proposal:** A page that lists tracks needing a check (energy estimate, missing key or BPM, duplicate), lets the curator set energy, pillar, rotation and local_path in the row, and writes the override through the library API; the weekly run reads overrides from the API instead of the CSV. NavDrawer badge on Library shows the queue size; a warn Banner on /library links to it (every warning says where to fix it).
- **Design-system pattern:** LogPage (filter chips, selectable DataTable with bulk actions, entry panel) with inline NumberField and SelectField cells
- **Personas served:** P3 Library curator, P7 Weekly-run agent (system actor)
- **Rules it satisfies:** R1, R2, R5, design-system 07 warnings link to their source
- **Task:** `UX-T01` Build the Review queue page (UX-01) · owned paths: `frontend/src/features/musicLibrary/ReviewQueuePage.tsx (new)`, `frontend/src/features/musicLibrary/route.tsx`, `services/rest_api/routers/library_overrides.py (new)` · depends on: UX-T09, SN-T03
- **Verification:** Set energy on one queued track in the page; the next weekly run's ledger shows the override and the review queue shrinks by one.
- **Evidence:** P3 failure modes, ml-gap-written-never-read, ml-gap-deezer-bpm-not-merged, musicLibrary/pipeline/run_weekly.py, songnodes/design-system/components/LogPage/README.md

### UX-02: Track detail

- **Module:** library · **Route or place:** `/tracks/:id` · **Effort:** M (Estimate) · **State:** Proposed
- **Problem:** Track detail is a modal (TrackDetailsModal) opened from the graph; the design system specifies a page, and nothing links a track to where it was heard, its proven transitions and its IDs in one place. The DJ's third step (key and mood) and the planner's spare suggestions have no fallback once the modal closes.
- **Proposal:** Build the TrackDetailPage route; TrackCell titles in the crate, running order, graph side panel and review queue link to it; the transitions tab reads the transition feed (module M3) so the two projects share one view of a track.
- **Design-system pattern:** TrackDetailPage (KeyValueGrid, KeyBadge with key name, BpmReadout, EnergyBar, SourceBadge, Tabs: overview, plays, transitions)
- **Personas served:** P1 DJ performing, P2 Set planner, P3 Library curator
- **Rules it satisfies:** R1, R6
- **Task:** `UX-T02` Build the Track detail page (UX-02) · owned paths: `frontend/src/features/trackDetail/ (new)`, `frontend/src/components/TrackDetailsModal.tsx` · depends on: SN-T08
- **Verification:** Open a track from /library and from the graph; both land on /tracks/:id with key, BPM, energy, sources and transitions filled or shown as en dashes.
- **Evidence:** songnodes/frontend/src/components/TrackDetailsModal.tsx, songnodes/design-system/components/TrackDetailPage/README.md, P1 step 3 (fallback none), ml-gap-transitions-not-used

### UX-03: Pipeline health

- **Module:** pipeline · **Route or place:** `/pipeline (health) and /pipeline/runs (run history)` · **Effort:** L (Estimate) · **State:** Proposed
- **Problem:** The existing /pipeline is a telemetry page (queue a scrape, recent runs); nothing answers 'is anything broken'. The resolve yield fell from 614 of 777 to 6 of 81 with no alert, the weekly schedule drifted off Sunday 07:37, songnodes ingest failures are printed as a note, and the backup scripts back up nothing.
- **Proposal:** Replace the telemetry page's head with the MonitoringPage pattern: a single Banner that names the worst current condition with a source link, FigureTiles for last run, resolve yield, review queue and last backup, and a run history page fed by module M5 (Run monitor). The existing scrape controls move under a 'Queue a scrape' Disclosure.
- **Design-system pattern:** MonitoringPage (one Banner, ConnectionStatus, four FigureTiles, ServiceStatus list with only problems expanded) plus a LogPage for run history with StagedProgress per run
- **Personas served:** P4 Pipeline operator, P7 Weekly-run agent (system actor)
- **Rules it satisfies:** R1, R2, design-system 07 one Banner per page
- **Task:** `UX-T03` Pipeline health page and run history (UX-03) · owned paths: `frontend/src/pages/ScraperProgressPage.tsx`, `frontend/src/features/pipeline/RunsPage.tsx (new)`, `frontend/src/features/pipeline/RunMonitor.tsx (new, M5)` · depends on: ML-T06
- **Verification:** With a run whose yield is half the previous four, /pipeline opens on a warn Banner naming the run and linking to /pipeline/runs.
- **Evidence:** songnodes/frontend/src/pages/ScraperProgressPage.tsx:18, songnodes/design-system/components/MonitoringPage/README.md, P7 failure modes, P4 step 6 (backups), sn-be-gap-backups

### UX-04: Buy list

- **Module:** library · **Route or place:** `/library/buy` · **Effort:** M (Estimate) · **State:** Proposed
- **Problem:** Buying is a CSV (buy_list.csv) and a Beatport sync that has never run: 243 beatport_check songs are waiting and 0 tracks have a Beatport id. Bought tracks only reach Rekordbox when a local_path is typed into the overrides CSV.
- **Proposal:** One page for High and Standard rotation tracks not yet owned, with the Beatport check state, a 'Mark bought' action that records the local_path (or a FileDrop of the file) and feeds the Rekordbox XML, and the assisted Beatport sync as a StagedProgress job started from the page.
- **Design-system pattern:** LogPage with FilterChip (store, rotation), DataTable (TrackCell, price and store columns, Beatport check state as StatusPill) and bulk 'Mark bought'
- **Personas served:** P3 Library curator, P8 Beatport sync (assisted)
- **Rules it satisfies:** R1, R2
- **Task:** `UX-T04` Build the Buy list page (UX-04) · owned paths: `frontend/src/features/musicLibrary/BuyListPage.tsx (new)`, `frontend/src/features/musicLibrary/route.tsx` · depends on: UX-T09, ML-T04
- **Verification:** Mark one track bought with a local file; the next run's rekordbox_musicLibrary.xml contains it and the buy list no longer does.
- **Evidence:** P8 failure modes, P3 routine, musicLibrary/outputs/<date>/buy_list.csv, ml-gap-rekordbox-feedback

### UX-05: One Set builder

- **Module:** sets · **Route or place:** `/sets (songnodes) with the artifact retired` · **Effort:** M (Estimate) · **State:** Proposed
- **Problem:** Two Set Builders save sets in different shapes, each with its own Send to TIDAL, so one set can become two TIDAL playlists and a set saved in the artifact waits up to a week. The legacy artifact page breaks R1, R4 and R5 (43 linter findings).
- **Proposal:** songnodes /sets becomes the only builder. The artifact pages show RetiredPageNotice with a link to /sets. Sending to TIDAL is one action with one state on the SetCard (queued for the weekly run, or sent now), backed by the set exchange (module M1) so the weekly run and the page agree.
- **Design-system pattern:** SetBuilderPage as built in songnodes; RetiredPageNotice for artifact/index.html and artifact/build/index.html; SetCard 'Send to TIDAL' state
- **Personas served:** P2 Set planner, P7 Weekly-run agent (system actor)
- **Rules it satisfies:** R1, R2, R4, R5
- **Task:** `UX-T05` Retire the artifact Set Builder behind /sets (UX-05) · owned paths: `artifact/index.html`, `artifact/build/index.html`, `README.md` · depends on: ML-T02
- **Verification:** Save a set on /sets and tick Send to TIDAL; exactly one 'SET · name' playlist exists after the next run, and the artifact URL shows the retired notice.
- **Evidence:** P2 failure modes, ml-gap-saved-set-shape, sn-fe-gap-artifact-sets-tidal-flag, ml-page-set-builder-legacy R1/R4/R5, songnodes/design-system/components/RetiredPageNotice/README.md

### UX-06: Work queue on the design system

- **Module:** design · **Route or place:** `plan/work-queue-*/tracker.html` · **Effort:** S (Estimate) · **State:** Proposed
- **Problem:** The developer's work-queue tracker defines its own colours (12 hex literals, !important) and so breaks R4 on the one page developers open most.
- **Proposal:** Rebuild the tracker from the design system's LogPage pattern with its tokens inlined the way the report and reference.standalone.html are built, so it reads like every other page and the linter passes.
- **Design-system pattern:** LogPage (filter chips by wave and status, DataTable with CopyButton per prompt)
- **Personas served:** P5 Developer
- **Rules it satisfies:** R4, R5
- **Task:** `UX-T06` Rebuild the work-queue tracker on the design system (UX-06) · owned paths: `plan/work-queue-2026-10-30/tracker.html` · depends on: –
- **Verification:** design-system/linters/check.py reports 0 findings on the tracker.
- **Evidence:** sn-fe-work-queue-tracker R4, songnodes/plan/work-queue-2026-10-30/tracker.html, songnodes/docs/design-system/build_standalone.py


## Design-system updates

### UX-07: One primary action when an empty state carries it

- **Module:** design · **Route or place:** `06 interaction, EmptyState and PageHeader cards` · **Effort:** S (Estimate) · **State:** Proposed
- **Problem:** Three production pages show two primary buttons at once (Set builder, Pathfinder, Sources import) because the PageHeader primary and the EmptyState primary are both specified and the repo checker does not test the combination.
- **Proposal:** Add the rule: while a page's EmptyState shows the primary action, the PageHeader primary is not rendered (the EmptyState is the view). Add it to rules/rules.yaml (INT family) and to scripts/check_design_system.py as a DOM check on the previews; record the decision in 17-governance.
- **Design-system pattern:** Rule and a conformance check
- **Personas served:** P2 Set planner, P4 Pipeline operator
- **Rules it satisfies:** R2
- **Task:** `UX-T07` Rule: one primary when the empty state carries it (UX-07) · owned paths: `design-system/06-interaction-accessibility.md`, `design-system/rules/rules.yaml`, `scripts/check_design_system.py`, `design-system/17-governance.md` · depends on: –
- **Verification:** The check fails on today's Set builder and passes once its header primary is hidden while the draft is empty.
- **Evidence:** sn-fe-sets R2, sn-fe-paths R2, sn-fe-sources-import R2, songnodes/design-system/components/EmptyState/README.md

### UX-08: Linter catches 'Unknown' and Title Case labels

- **Module:** design · **Route or place:** `linters/check.py DATA-NULL and WRT-CASE` · **Effort:** S (Estimate) · **State:** Proposed
- **Problem:** Five pages print 'Unknown algorithm', 'Unknown error', 'Unknown DJ' or Title Case button labels ('Copy Prompt', 'Run Search'); the linter's DATA-NULL rule only catches N/A, null, undefined and NaN, so the repo checker passes them.
- **Proposal:** Extend DATA-NULL to the word Unknown (and 'Unknown …') in visible copy, and add WRT-CASE: a button or tab label of two or more capitalised words. Both run in the design-system workflow on the frontend's rendered previews, not only on static files.
- **Design-system pattern:** Linter rules
- **Personas served:** P1 DJ performing, P2 Set planner, P4 Pipeline operator
- **Rules it satisfies:** R5
- **Task:** `UX-T08` Linter: Unknown values and Title Case labels (UX-08) · owned paths: `design-system/linters/check.py`, `design-system/rules/rules.yaml` · depends on: –
- **Verification:** check.py reports the five known sites; after the copy fixes it reports 0.
- **Evidence:** sn-fe-paths R5, sn-fe-sources-import R5, sn-fe-oauth-callback R5, sn-fe-login R5, songnodes/design-system/linters/check.py:20

### UX-09: Inline editable cell for DataTable

- **Module:** design · **Route or place:** `components/DataTable (new part) and 12 inputs` · **Effort:** M (Estimate) · **State:** Proposed
- **Problem:** The review queue (UX-01) and the buy list (UX-04) need a value set in the row; the design system has NumberField and SelectField but no rule for editing inside a table, so each page would invent one.
- **Proposal:** Specify the editable cell once: which cells may be edited, the keyboard model (Enter edits, Esc cancels, Tab moves on), how a save failure is shown, and the print form (the value only). Add the card and a preview; bump the design system a minor.
- **Design-system pattern:** DataTable `__edit` cell: NumberField or SelectField shown on Enter or click, saved on blur, with an InlineMessage on failure
- **Personas served:** P3 Library curator
- **Rules it satisfies:** R4, R5
- **Task:** `UX-T09` DataTable editable cell (UX-09) · owned paths: `design-system/components/DataTable/README.md`, `design-system/components/DataTable/preview.html`, `design-system/source/css/30-data.css`, `design-system/source/bundle.src.js`, `design-system/17-governance.md` · depends on: –
- **Verification:** The DataTable preview shows an editable energy cell that passes the design-system linter and the keyboard check.
- **Evidence:** songnodes/design-system/components/DataTable/README.md, songnodes/design-system/12-inputs.md, UX-01, UX-04

### UX-10: Freshness on every data page

- **Module:** design · **Route or place:** `FreshnessStamp, PageHeader stamp, 16 platform` · **Effort:** M (Estimate) · **State:** Proposed
- **Problem:** The library's freshness stamp is always unknown (library.generated is never set), the IndexedDB last-good-data cache that 16 platform requires does not exist, and polling backoff never engages, so a reader cannot tell live data from stale.
- **Proposal:** Make the stamp a page-pattern requirement: every data page's PageHeader shows 'Data from <stamp>' from the ingest or run time, goes amber past the module's staleness threshold and links to Pipeline health (UX-03). Add a conformance check that a data page without a stamp fails. The cache stays a frontend task (SN-T10).
- **Design-system pattern:** FreshnessStamp sourced from the server, IndexedDB last-good cache as 16 platform already specifies
- **Personas served:** P1 DJ performing, P2 Set planner, P3 Library curator
- **Rules it satisfies:** R1
- **Task:** `UX-T10` Freshness stamp required on data pages (UX-10) · owned paths: `design-system/13-page-patterns.md`, `design-system/rules/rules.yaml`, `scripts/check_design_system.py` · depends on: –
- **Verification:** /library shows the last ingest time; after the threshold the stamp turns warn and its link opens /pipeline.
- **Evidence:** sn-fe-gap-library-generated, sn-fe-gap-indexeddb-cache, sn-fe-debt-poll-backoff, songnodes/design-system/components/FreshnessStamp/README.md, songnodes/design-system/16-platform.md

### UX-11: Service rows tell the truth about OAuth

- **Module:** services · **Route or place:** `ServiceStatus, AuthCallbackPage, SettingsPage` · **Effort:** S (Estimate) · **State:** Proposed
- **Problem:** Settings redirects in the same window, the callback writes sessionStorage keys nothing reads, and the readers look for localStorage keys the callback deletes; Send to TIDAL then fails with a token error while Settings may still look connected. A TIDAL login for the weekly run also collides with songnodes on port 3006.
- **Proposal:** Specify that ServiceStatus derives its state from a token the app can actually use (a probe call), never from the presence of a key; the callback page always lands on a connected or failed state with 'Reconnect' as the one action; Settings shows a notice when the musicLibrary login needs port 3006. The token hand-off itself is task SN-T09.
- **Design-system pattern:** AuthCallbackPage (progress, then connected or what went wrong) and ServiceStatus with the one fixing action
- **Personas served:** P2 Set planner, P4 Pipeline operator
- **Rules it satisfies:** R1, R2, R5
- **Task:** `UX-T11` ServiceStatus state from a usable token (UX-11) · owned paths: `design-system/components/ServiceStatus/README.md`, `design-system/components/AuthCallbackPage/README.md`, `design-system/components/SettingsPage/README.md` · depends on: SN-T09
- **Verification:** After a fresh TIDAL login the Services row reads Connected and Send to TIDAL succeeds; after revoking the token the row reads Reconnect within one probe.
- **Evidence:** sn-fe-gap-oauth-session-tokens, ml-gap-tidal-port, songnodes/design-system/components/ServiceStatus/README.md, songnodes/design-system/components/AuthCallbackPage/README.md

### UX-12: Close Q-PRINT-1 and publish 1.10.0

- **Module:** design · **Route or place:** `15 print and export, PrintSheet, design-system artifact` · **Effort:** S (Estimate) · **State:** Proposed
- **Problem:** Printed set sheets lose their traceability footer (clipped at bottom: -12mm in Chromium), and the published design-system artifact still holds 1.9.1 while the repo is at 1.10.0, so pages built from the artifact miss the print rules and the report patterns.
- **Proposal:** Move the PrintSheet footer to the same footer-template mechanism, close Q-PRINT-1 with a decision record, and publish 1.10.0 to the artifact (DS-T01).
- **Design-system pattern:** PrintSheet footer through the PDF footer template, as long documents now do
- **Personas served:** P2 Set planner, P5 Developer
- **Rules it satisfies:** R4
- **Task:** `UX-T12` Close Q-PRINT-1 and publish 1.10.0 (UX-12) · owned paths: `design-system/source/css/61-pages-b.css`, `design-system/15-print-export.md`, `design-system/17-governance.md`, `design-system artifact 7f37707d` · depends on: DS-T01
- **Verification:** A printed set shows its footer on every page; the artifact's tokens.json reads 1.10.0.
- **Evidence:** songnodes/design-system/17-governance.md Q-PRINT-1, songnodes/design-system/15-print-export.md, DS-T01


UI work follows the SongNodes design system in full: tokens and `sn-*` classes only, its page patterns and components, and no local overrides; a missing pattern is added to the design system first (UX-07 to UX-12 are those additions).
