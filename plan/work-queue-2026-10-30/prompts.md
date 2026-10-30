# Work queue, 30 Oct 2026 (main at b359108)

## House rules

```text
SongNodes house rules (apply to every job below)

Repo: zvirb/songnodes. Base: main at b359108 (30 Oct 2026); update from main before you start.
Read first: AGENTS.md ("Working rules for agents"), CLAUDE.md, plan/RESTRUCTURE.md section 5 (merge protocol).

- One job, owned paths only. Create, edit or delete only the files the job lists. Never delete, move or rewrite a file you do not own.
- About 400 changed lines of non-test code and 10 files at most. If it will not fit, stop at a working point and say what remains.
- Verify, then commit: one commit per verified step. Two failed attempts at the same check: stop, open the PR as a draft with the failing command and output.
- Failures in files you do not own are reported in the PR (file, error, suspected owner), never fixed.
- No unrequested refactors, renames, formatting sweeps, dependency bumps or scratch scripts.
- Honest states: real data, an explicit empty state, or an error that names the cause. Never mock data.
- Before every push: `git fetch origin main && git diff --diff-filter=D --name-only origin/main...HEAD` must list only your owned paths; otherwise stop.
- PR: title `<CODE>: <task>`, branch starts with the code in lower case, opened against main, never merged by you. Body: the one job, files added/changed/deleted, checks run and not run, the reviewer's under-10-minute check, follow-ups.
- STATUS.md: edit only your own slot (`<!-- SLOT:<CODE> BEGIN -->` … `END`), adding it at the end of the file if missing. Record start, what changed, checks run and not run, and the next step.
- UI work: the design system in design-system/ decides everything (tokens and sn-* classes only, no hex/rgb/px/emoji, SN.format for values, one primary button per view, ConfirmDialog and Toast instead of alert/confirm). Read design-system/README.md and the component cards you use. Never edit frontend/src/styles/design-system/.
- Frontend checks: `cd frontend && npx tsc --noEmit -p . && npx oxlint src && npx vitest run src && npx vite build`; `PYTHONUTF8=1 bash scripts/sync-design-system.sh --check`; `python3 scripts/check_design_system.py --check`.
- Backend checks: `python -m pytest` (root) and `cd services && python -m pytest common/tests`.
- Scope guard on every package PR: `python scripts/scope_guard.py --base origin/main --head HEAD --title "<CODE>: ..." --branch "<code>-..."`.
- Running stack (owner jobs only): `bash scripts/start-dev.sh`; E2E with `bash scripts/e2e-docker.sh`. Never reset or delete a Postgres volume. Never edit running containers.
- An open question is a stop point: lay out the evidence and ask Markus; never guess.
```

## MRG1: Review and merge #444: Spotify playlists error leakage

- Group: Merge · Area: Owner merge step
- Depends on: –
- Open question: –

```text
MRG1: Review and merge zvirb/songnodes#444 (owner merge step, not a package)

Goal: merge the Sentinel fix that stops the Spotify playlists router returning exception details to the client, following the merge protocol.

Read first: https://github.com/zvirb/songnodes/pull/444 (diff and checks); plan/RESTRUCTURE.md section 5; the earlier TIDAL fix of the same kind on main ("fix(security): sanitize exception messages in Tidal device auth endpoints", #407) for the pattern already accepted.

Do:
1. Update the PR branch from main and wait for every check to finish.
2. Deleted-files check: `git diff --diff-filter=D --name-only origin/main...origin/<branch>` must be empty.
3. Read the diff: errors are logged server-side with the detail, the client gets a generic message and the right status code; no behaviour change on the success path; a test covers the error path.
4. If it touches files outside the Spotify playlists router and its test, or needs more than one follow-up, close it and write a one-job brief instead (section 5 rule 4).
5. Squash-merge. Then run the deleted-work check on main.

Gate: checks green on the updated head; deleted list empty; a request that forces the error (for example an expired Spotify token) returns the generic message, and the log line carries the detail.
```

## MRG2: Review and merge #445: memoize to_camelot

- Group: Merge · Area: Owner merge step
- Depends on: MRG1
- Open question: –

```text
MRG2: Review and merge zvirb/songnodes#445 (owner merge step, not a package)

Goal: merge the Bolt change that adds an LRU cache to `to_camelot` key normalisation, only if it is a pure speed change.

Read first: https://github.com/zvirb/songnodes/pull/445; plan/RESTRUCTURE.md section 5.

Do:
1. Merge after MRG1 (one PR at a time). Update the branch from main and wait for checks again.
2. Deleted-files check as in MRG1; must be empty.
3. Confirm the cached function is pure: same input always gives the same output, arguments are hashable (strings or None), and it never returns a mutable object a caller could change.
4. Confirm existing key tests still pass unchanged and that the PR adds or keeps a test for an invalid key (still returns the same empty or error result as before).
5. If the PR also edits unrelated files (for example STATUS.md outside a slot, or other utilities), close it rather than merge.
6. Squash-merge and run the deleted-work check.

Gate: checks green; deleted list empty; `to_camelot("A minor")` and `to_camelot("8A")` give 8A before and after; an invalid key behaves as before.
```

## PG1: Confirm the Postgres 18 cut-over

- Group: Stack · Area: Owner, laptop
- Depends on: –
- Open question: Has scripts/upgrade-postgres-18.sh been run on the laptop?

```text
PG1: Confirm the Postgres 18 cut-over (owner job on the laptop with Docker)

Goal: make sure the next `bash scripts/start-dev.sh` starts on a Postgres 18 volume that holds the real data. U7 put `postgres:18-alpine` on a new `dev-postgres-18` volume in compose.dev.yaml; the plan said to merge it only after the upgrade script had been run.

Step 0 (blocking): has the data already been moved? Answer with two independent methods:
  a. `docker volume ls | grep dev-postgres` and `docker run --rm -v songnodes-dev_dev-postgres-18:/d alpine cat /d/PG_VERSION` (the PG_VERSION file, under PGDATA's subfolder if compose sets one).
  b. With the stack up, row counts from the running database: `docker compose -f compose.dev.yaml exec -T postgres psql -U songnodes -d songnodes -c "select (select count(*) from bronze_scraped_playlists), (select count(*) from bronze_scraped_tracks), (select count(*) from silver_track_transitions), (select count(*) from library.tracks);"` compared with the last recorded numbers in STATUS.md (28 Oct: bronze 9 playlists / 100 tracks, silver 80 transitions; library 339 tracks after L7).
If the two disagree or the new volume is empty while the old one has data, stop and tell Markus with the outputs. Do not run start-dev.sh until he says go.

Read first: compose.dev.yaml lines 1–20 and the volumes block; scripts/upgrade-postgres-18.sh; the U7 slot in STATUS.md.

Do (only after Step 0 says the move is still needed and Markus agrees):
1. Back up the old volume first: `docker compose -f compose.dev.yaml exec -T postgres pg_dump -U songnodes -Fc songnodes > backup-$(date +%Y%m%d).dump` while it still runs on the old image.
2. Run `bash scripts/upgrade-postgres-18.sh` and keep its output.
3. Run `bash scripts/start-dev.sh`; every service healthy.
4. Repeat the Step 0 counts; they must match the pre-upgrade numbers.
5. Leave the old `songnodes-dev_dev-postgres` volume in place. Never delete it.
6. Write the outcome (counts before/after, script output summary) in a new STATUS.md slot PG1.

Gate: `select version()` reports 18.x; counts equal before and after; old volume still listed by `docker volume ls`.
```

## DOC3: CLAUDE.md: Postgres 18 volume and Python 3.15 images

- Group: Docs · Area: CLAUDE.md
- Depends on: PG1
- Open question: –

```text
DOC3: Bring CLAUDE.md in line with the running stack

Goal: CLAUDE.md states the Postgres volume and Python version the stack actually uses.

Read first: CLAUDE.md sections 1 (Start) and 2 (Stack); compose.dev.yaml (postgres image and volumes); the U1–U4 and U7 slots in STATUS.md; the Dockerfiles for rest_api, graph-visualization-api, worker and scrapers (`grep -n "^FROM" services/rest_api/Dockerfile services/graph-visualization-api/Dockerfile services/worker/Dockerfile scrapers/Dockerfile.unified`).

Do:
1. Section 1: replace the volume name `songnodes-dev_dev-postgres` with the one compose.dev.yaml mounts now (`songnodes-dev_dev-postgres-18`, as PG1 confirmed), and add one sentence that the Postgres 16 volume is kept and never removed.
2. Section 2 Backend line: state the Python version the four Dockerfiles use (read it from their FROM lines; do not assume).
3. Database backup command in section 7: keep as is unless the service name changed.
4. No other wording changes.

Owned paths: CLAUDE.md; STATUS.md slot DOC3.

Gate: every version or volume name in the changed lines matches `grep` output from compose.dev.yaml and the Dockerfiles, quoted in the PR body.
```

## E2E2: Rebuild from main and run the full E2E suite

- Group: Stack · Area: Owner, laptop
- Depends on: PG1, MRG1, MRG2
- Open question: –

```text
E2E2: Rebuild from main and record a full E2E run (owner job on the laptop)

Goal: one recorded, full E2E result against a stack rebuilt from current main. The last full run (28 Oct afternoon) was 337/367 and its fixes were never re-checked.

Read first: frontend/tests/README.md; tests/README.md; the 28 Oct afternoon scheduled-run note in STATUS.md; .github/workflows/e2e.yml (EC1).

Do:
1. `git switch main && git pull --ff-only`, then `bash scripts/start-dev.sh`; `docker compose -f compose.dev.yaml ps` shows every service healthy. Confirm each app container was created after the last commit (CLAUDE.md section 7, stale code).
2. `bash scripts/e2e-docker.sh` (sequential, all browsers). Keep the HTML report.
3. Check the GitHub Actions e2e workflow's latest run on main; note pass/fail and its run link.
4. Sort every failure into: visual snapshot after an intended change, real defect, flaky (fails once, passes on rerun of that test alone). Rerun flaky ones once only.
5. For each real defect write one line: test, route, browser, error, likely owner file. Do not fix anything here; each defect becomes its own package (AX2 already covers /library target-size).
6. Record totals, the CI result and the defect list in a new STATUS.md slot E2E2.

Gate: a pass count out of the total, zero console errors or each listed as a defect, and the CI run link.
```

## AX2: /library: row icon buttons meet target size

- Group: Accessibility · Area: Music library
- Depends on: –
- Open question: –

```text
AX2: Library: row icon buttons meet the axe target-size rule

Goal: /library passes the axe test with no target-size violation on the crate table's row icon buttons, in dark and light, in chromium, firefox and webkit.

Read first: frontend/tests/e2e/accessibility.spec.ts and fixtures.ts (SHELL_ROUTES, withLibraryApi from QA7); frontend/src/features/musicLibrary/ (LibraryPage.tsx and the row/cell components that render icon buttons); design-system/06-interaction-accessibility.md (target size) and the IconButton/Button cards under design-system/api/components/; the 28 Oct afternoon note in STATUS.md.

Do:
1. Reproduce: `cd frontend && npx playwright test tests/e2e/accessibility.spec.ts -g "library"` and record the failing nodes.
2. Fix with the design system's own sizing for icon buttons (the component's size variant or an sn-* class with --space-* tokens). Keep the row height the design system specifies for dense tables; if 24×24 CSS pixels cannot be met without changing row height, stop and ask Markus with a screenshot of both options (design-system choice, not a local override).
3. Every icon-only button keeps an aria-label naming the track ("Add <artist – title> to targets").
4. No axe exceptions.

Owned paths: the musicLibrary files the failing buttons live in (list them in the PR before editing), their tests, STATUS.md slot AX2.

Gate: the step 1 command passes in all three browsers, dark and light; FL5's keyboard row navigation test still passes; frontend checks pass.
```

## SC5: Scrape counts agree: job result, bronze and /pipeline

- Group: Pipeline · Area: Scraper / pipeline counts
- Depends on: –
- Open question: Which count is wrong (job result 928, /pipeline 15 tracks, bronze 100)?

```text
SC5: Scrape counts agree between the job result, bronze and /pipeline

Goal: after a scrape, the job result, the bronze tables and the /pipeline page report the same playlist and track numbers. On 28 Oct the 'Deadmau5 Strobe' MixesDB scrape reported 928 items persisted, /pipeline showed 1 playlist and 15 tracks, and bronze held 9 playlists and 100 tracks; playlist 9fe4886d had only 3 tracks.

Step 0 (blocking): find which number is wrong, with two independent methods:
  a. Code reading: how `items_persisted`, `bronze_playlists_persisted` and `bronze_tracks_persisted` are derived in scrapers/unified_scraper_api.py (around line 195–240, parsed from the persistence pipeline's log lines) versus what scrapers/pipelines/persistence_pipeline.py actually logs and counts (per item, per batch, cumulative across spiders?). And which endpoint and query /pipeline (frontend/src/pages/ScraperProgressPage.tsx, usePipelineTelemetry) reads.
  b. A fixture run: run the persistence pipeline on a fixed fixture of 2 playlists × 5 tracks against a test database (tests/ fixtures or the unit-test fakes) and compare the logged count, the parsed count and `select count(*)` per table.
If the methods point at different causes, or playlist 9fe4886d's 3 tracks turn out to be a real partial tracklist (CLAUDE.md: partial playlists are invalid), stop and report with the evidence.

Do (one job: make the job result count what bronze holds):
1. Fix the count at its source so job result = rows written to bronze_scraped_playlists and bronze_scraped_tracks for that job. Do not change what is written.
2. If /pipeline is also wrong, list it as a follow-up package (separate owner), do not fix it here.
3. Add a test with the fixture from Step 0 b asserting the three numbers agree.

Owned paths: scrapers/unified_scraper_api.py, scrapers/pipelines/persistence_pipeline.py, a new test under scrapers/tests/ (or tests/scrapers/), STATUS.md slot SC5.

Gate: the new test passes; existing scraper tests pass; on the stack a 'Deadmau5 Strobe' limit=1 scrape reports playlist and track counts equal to the bronze rows added for that job (query in the PR).
```

## DATA1: Load real target tracks and run a wider scrape

- Group: Pipeline · Area: Owner, laptop
- Depends on: SC5, E2E2
- Open question: Which target list and how many searches per run?

```text
DATA1: Load real target tracks and run a wider scrape (owner job on the laptop)

Goal: grow the graph from real DJ sets. Today it holds about 132 nodes and 80 edges from one 'Deadmau5 Strobe' scrape.

Step 0 (blocking): which targets, and how many? Two sources to compare: the repo's target_tracks_master.json / load_target_tracks.py, and the library's tracks (library.tracks, 339 after L7) via the "add to targets" flow (FE9). If they differ a lot in size or style, or the scrape volume would exceed the rate limits in the scraper settings, stop and ask Markus which list and how many searches per run.

Read first: CLAUDE.md sections 2 (Scraper workflow) and 5.1; docs/DEPLOYMENT_CHECKLIST.md; load_target_tracks.py.

Do:
1. Load the chosen targets into target_track_searches (artist + title search queries, never artist only).
2. Trigger scrapes through the REST API (CLAUDE.md section 9 Trigger Scrape) in batches of about 10, MixesDB first, then 1001Tracklists.
3. After each batch check: bronze positions have no gaps (`select playlist_id from bronze_scraped_tracks group by playlist_id having max(position) <> count(*)`), silver transitions grow, no NULL or 'Unknown Artist' on either end of any graph edge, outbox backlog returns to 0.
4. Stop a batch on any failed check and report it as its own package.
5. Record per batch: searches, playlists, tracks, transitions, graph nodes/edges, failures, in a STATUS.md slot DATA1.

Gate: the gap query returns 0 rows; graph-api node and edge counts went up; no unknown-artist edges.
```

## DS21: FileDrop replaces raw file inputs

- Group: Design system · Area: Importers
- Depends on: –
- Open question: –

```text
DS21: FileDrop replaces the raw file inputs

Goal: every place the app takes a file uses the design-system FileDrop component (added in DS19) instead of a bare <input type="file">.

Read first: design-system/api/components/FileDrop.md and components/FileDrop/README.md; frontend/src/components/ds/FileDrop.tsx and its test; DS19 and DS20 slots in STATUS.md (drag and drop, CSV guard, never print file paths).

Known inputs on main (verify with `grep -rn 'type="file"' frontend/src --include=*.tsx`):
- frontend/src/components/TracklistImporter.tsx line ~294
- frontend/src/features/musicLibrary/components/LibraryImportDialog.tsx line ~213
- frontend/src/components/TargetTracksManager.tsx "Import from JSON" menu item (line ~453): check how it picks a file.

Do:
1. Replace each input with FileDrop, keeping accepted types, size limits and the existing parse/upload handlers unchanged.
2. Show the file name only, never a path (DR-033).
3. Keep the existing tests passing; update selectors only where the markup changed (`input[type="file"]` inside FileDrop still exists).
4. If the TargetTracksManager import is a menu action that should stay a menu action, leave it and say why in the PR.

Owned paths: the three files above, their tests, STATUS.md slot DS21. Commented-out lines in frontend/design-system-pending.txt only per AGENTS.md rule 13.

Gate: frontend checks pass; dragging a JSON file onto the library import dialog and the tracklist importer starts the same import as clicking did before.
```

## DS22: TracklistImporter: real StagedProgress, no fake progress

- Group: Design system · Area: Importers
- Depends on: DS21
- Open question: –

```text
DS22: TracklistImporter shows real stages with StagedProgress

Goal: the tracklist import shows honest progress. Today TracklistImporter.tsx animates a fake percentage (setInterval adding 15 up to 90, around lines 196–215), which breaks the honest-states rule.

Read first: design-system/api/components/StagedProgress.md and components/StagedProgress/README.md (including the stalled state from DS20); frontend/src/components/ds/StagedProgress.tsx; frontend/src/components/TracklistImporter.tsx.

Do:
1. Replace the timer with StagedProgress stages that map to real events the component already knows: parsing the file, sending to the API, waiting for the job, done or failed. No percentage unless the API returns one.
2. Show the stalled state when the API call has not answered within the threshold the design system specifies.
3. On failure, the stage names the cause from the API error (no raw exception text).
4. Remove the setInterval and its cleanup.
5. Unit test: each stage appears in order with mocked API calls, and the failure path.

Owned paths: frontend/src/components/TracklistImporter.tsx and its test; STATUS.md slot DS22.

Gate: frontend checks pass; no setInterval left in TracklistImporter; importing a fixture tracklist with the API down shows the failed stage naming the cause.
```

## DS23: Pipeline page: StagedProgress for running jobs

- Group: Design system · Area: Pipeline page
- Depends on: SC5
- Open question: Which job stages does /api/v1/jobs expose?

```text
DS23: Pipeline page shows running scrape jobs with StagedProgress

Goal: a running scrape job on /pipeline shows its real stages (queued, scraping, persisting to bronze, ingest to silver, projection) with StagedProgress, including the stalled state.

Step 0 (blocking): which stages can be shown honestly? Check two ways: the job payload returned by /api/v1/jobs (services/rest_api router and the worker's job status updates) and the outbox status endpoint. If the API does not expose a stage, it is not shown; if fewer than two stages are available, stop and propose a backend package first.

Read first: StagedProgress card and README in design-system/; frontend/src/pages/ScraperProgressPage.tsx and usePipelineTelemetry; the FE12 and SQ1 slots in STATUS.md.

Do:
1. Render StagedProgress for each job that is not finished, mapped from the fields found in Step 0.
2. Finished and failed jobs keep the existing table row and status pill.
3. Unit test the mapping (each API status to a stage, unknown status shown as an en dash, not guessed).

Owned paths: frontend/src/pages/ScraperProgressPage.tsx, its test, a new mapping file next to it if needed; STATUS.md slot DS23.

Gate: frontend checks pass; triggering a scrape on the stack shows the stages advancing on /pipeline and the stalled state if the worker is stopped.
```

## DS24: DateRange: decide the first real use

- Group: Design system · Area: Dates
- Depends on: DSQ1
- Open question: Where should DateRange first be used, and is a React DateField needed?

```text
DS24: First real use of DateRange (and a React DateField if needed)

Goal: put DateRange where a date span is chosen, as DS19 planned ("DateField calendar button and scrape-history export").

Step 0 (blocking, design choice): neither target exists in React today. There is no React DateField (only the bundle's SongNodes.dateRange/DateField) and no scrape-history export (`grep -rn "exportCsv" frontend/src` finds only the set builder's ExportDialog). Write a short decision note under docs/integration/DS24/decision.md comparing:
  A. Port DateField to frontend/src/components/ds/DateField.tsx with the calendar button, then use it on /pipeline's job history filter.
  B. Add a date-range filter to an existing list (pipeline job history or library runs) using DateRange directly.
Include which pages would use it, what data is filtered, and Markus's open answers Q11–Q16 that affect it. Stop and ask Markus to pick.

Do (after the pick): one package for the chosen option only, with tests, following the DateRange card (SN.calendar, SN.format.range, calendar-day counts per DR-031).

Owned paths: docs/integration/DS24/decision.md for Step 0; the files the chosen option names afterwards; STATUS.md slot DS24.

Gate for Step 0: the decision note exists and lists both options with the pages each touches.
```

## DSQ1: Answer design-system questions Q9, Q11–Q16, Q18

- Group: Decisions · Area: Markus
- Depends on: –
- Open question: All of them; defaults apply until answered.

```text
DSQ1: Answer the open design-system questions (Markus)

Goal: close the open questions in design-system/17-governance.md so DS24 and later date work have no stop points. Defaults apply until answered.

| # | Question | Options | Default |
|---|---|---|---|
| Q9 | Score bands for recommendations | 80/60/40 · fitted to your accepted picks | 80/60/40 until enough picks |
| Q11 | DateRange outcome button weight | default · primary when picker is the whole view · always primary | default |
| Q12 | When the DateRange popover closes | stays open until the outcome button · closes on second pick in DateField | stays open |
| Q13 | Week presets in DateField's chip row | popover only · mirrored in the field | popover only |
| Q14 | More than one mark on a day | one code + names · two stacked codes · "+1" | one code |
| Q15 | DateRange on phones | bottom sheet below 480px · full-screen Dialog sheet | bottom sheet |
| Q16 | Limit future days in exports | none · max greys days after last data | none |
| Q18 | "Tight" text inset (4–7px) | warn only · fail the check | warn only |

After answering: Claude records each as a DR entry in design-system/17-governance.md at the source (the design-system artifact or design-system/source), bumps the version per 17-governance, rebuilds tokens and bundle, and re-syncs with scripts/sync-design-system.sh. Never patched downstream.
```

## DOC4: STATUS.md: fix placeholder PR links and wrong dates

- Group: Docs · Area: STATUS.md
- Depends on: –
- Open question: –

```text
DOC4: STATUS.md: real PR links, real dates, standard slot shape (owner PR)

Goal: every finished slot in STATUS.md points at its real merged PR and carries the real dates, so the file can be trusted when resuming work. This edits many slots, so it is an owner PR (the scope guard passes PRs with no package code with a notice); it does not change any slot's content beyond the fields below.

Read first: AGENTS.md rule 11 and the Task tracking section; `git log --format='%h %ad %s' --date=short origin/main` to map codes to merged PRs.

Known problems (verify each):
- PR links `pull/NEW`, `pull/LY2`, `pull/LY3`, "(pending)", "PR link pending": LY1–LY5, FL5, DB1, QA7, BOLT, ART3, DS7, DS17, SV1, AK1 and others (`grep -n "pull/NEW\|pull/LY\|pending)" STATUS.md`).
- Dates in the wrong year: LY2 (2024-11-20), DB1 (2023-11-20), SB4 (2023-10-26); FE12 "(2025-XX-XX)".
- Slots not in the `### CODE: title` / `- Start:` / `- End:` shape: FE12, SV1, DS7, REF0, R2, CR1.

Do:
1. For each slot, find the merged PR by code in the commit subjects (and PR title on GitHub). Replace the placeholder with the real link and the merge date. If no merged PR exists, write "not merged" rather than guessing.
2. Fix wrong dates from the merge commit date.
3. Reshape the listed slots to the standard header lines without changing their text.
4. Do not touch the "Scheduled run" notes or the task log at the top.

Owned paths: STATUS.md.

Gate: `grep -c "pull/NEW" STATUS.md` returns 0; every link opens a merged PR whose title starts with that slot's code (spot-check 5 in the PR body).
```

## PLAN2: Refresh RESTRUCTURE.md: waves done, next wave

- Group: Docs · Area: plan/
- Depends on: E2E2, SC5
- Open question: What should the next feature wave be?

```text
PLAN2: Refresh plan/RESTRUCTURE.md with the finished waves and the next wave

Goal: the plan says what is finished and what comes next. Today it describes waves 1A–9, `up`, `up-legacy` and U7 as pending, but every one has a finished STATUS.md slot.

Step 0 (blocking): what is the next wave? Gather candidates from two sources: (a) follow-ups listed in finished slots and PRs (`grep -n "Follow-up\|Next:" STATUS.md`, DS19's adoption list, E2E2's defect list, SC5's /pipeline follow-up); (b) docs/IMPLEMENTATION_PLAN.md milestones not yet met (for example wave routing, milestone 6). Write the candidate list into the PR description and stop for Markus to pick before writing the wave table.

Do (after the pick):
1. Section 4 table: mark each finished wave "done" with its date range; keep the table, drop no history.
2. Add the next wave with one-job packages, owned paths and dependencies, built the same way as the earlier waves (briefs in plan/agents/ or a generator script if there are more than five).
3. Update section 1's header line to the current main commit.

Owned paths: plan/RESTRUCTURE.md, new briefs under plan/agents/ for the new wave; STATUS.md slot PLAN2.

Gate: every package in the new wave has one job, owned paths that do not overlap another package in the same wave (list the overlap check in the PR), and a dependency line.
```
