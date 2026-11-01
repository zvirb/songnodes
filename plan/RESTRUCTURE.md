# Restructure: small-batch work packages (26 Oct 2026)

Guide: *Architectural Modularity and Cognitive Sustainability in Generative Software Engineering* (the "vibe coding report"). Its claims are used as working heuristics, not as measured facts about this repo. This file replaces the wave plan in the laptop copy of `INTEGRATION_PLAN.md` for everything not yet merged. It is the single plan; `plan/launch_jules.py` in this repo is the single launcher.

## 1. What the audit of main found (`5d1da0f`, 26 Oct 05:43, updated at `162c024`, 26 Oct 18:00, after wave 1; plan refreshed at `2427bf9`, 2 Nov 2026 08:02, after waves 1A–9, `up`, `up-legacy`, U7 and the 30 Oct work queue)

The report's main warning is that a large changeset silently deletes working logic next to the change. That has already happened here several times:

| Merged work | Deleted by | Status on main now |
|---|---|---|
| FE1 track bridge (#91) | #93, the stale duplicate WP0 merge | **Restored in `R1` (#165).** `hooks/useUnifiedTracks.ts`, `services/trackSyncAdapter.ts`, `services/unifiedTrackService.ts` and its test are back on `main`. |
| FE3 route finder (#133) | #136 "fix(ci): fix broken package.json ..." (70 files, -3,679 lines) | **Restored in `R2` (#177).** `features/pathfinder/` is back, still with its TEMP local `useUnifiedTracks`; `P1` routes `/paths` and swaps in the shared hook. |
| WP8 graph projection (#128, #131) | #136 | **Restored in `R3` (#166).** `datalayer/graph_projection.py`, `services/graph-projection/`, migration 220, the `handlers.py` wiring, and `tests/graph_projection/` are back on `main`. |
| BE1 real music search (#118) | never landed | **`S1` (#172) merged** the search service on metadata-enrichment. The REST API still returns "Mock Artist" / "Mock Album" until `S2` replaces the proxy. |
| WP3 resolver (#142) | n/a | **Consolidated by `C1` (#173)** into `services/reference_data/`. |

Wave 1 is complete except `L1` (repurposed, see 1.1). Merged on 26 Oct, `bbc695a..162c024`; the deleted-work check lists only the 15 root scripts (`C2`) and the duplicate `services/reference-data/resolver/resolver.py` (`C1`), both owned:
- **Guards & registries:** `G1` scope guard (#161; the env-input fix #169 closes a script-injection hole), `G2` frontend route registry (#170), `G3` REST router registry (#171).
- **Restorations & foundations:** `QA5` (#159), `SB1` (#160), `E2` (#163), `R1` (#165), `R3` (#166), `C1` (#173), `S1` (#172), `C2` (#162), `R2` (#177).
- **Runtime upgrades (`up`):** `U1` (#167), `U2` (#168), `U3` (#164), `U4` (#174). `U5` (Redis 8.10) failed to create a Jules session and has to be resent.
- **Owner fixes:** #175 (docs, prompts, Dockerfiles copy `services/library`), #176 (`handlers.py` circular import).
- **Lesson from `C2` (#162):** its follow-up commit was rebuilt from an older base and would have deleted G1, R3 and QA5's change. GitHub showed a conflict and the scope guard failed it. AGENTS.md rule 9 and every brief header now require the deleted-files check before each push.

Other findings:
- Finished pages that were never routed: `features/camelot` (FE5, which duplicates `pages/CamelotPage.tsx`), `features/aiSetlists` (FE10) and the route finder. Each was waiting on a separate "wiring" package that edits the shared `App.tsx`.
- Agent sessions committed scratch scripts to the repo root (`patch_*.py`, `fix_*.py`, `fix16.sh`).
- 12 components in `frontend/src/components/` are imported by nothing. That folder holds 63 files and about 29,000 lines.
- Work packages that bundled several jobs either finished only one of them (BE1 shipped only its test fakes) or reached into other packages' files to get CI green (#136).

### 1.1 Post-plan change on `main`: PR #158 (`bbc695a`, 26 Oct 16:37)

After this restructure plan was written (retiring `WP5` into `L1`–`L5`), an older monolithic `WP5` branch was merged in PR #158 (`bbc695a`). An independent audit of `bbc695a` found both overlap with `L1`–`L5` and **five defects now on `main`**:

1. **Circular import crash in `services/common/datalayer/handlers.py`:** Line 15 (`from library.ingest.handler import library_ingest`) runs before `Context` (line 24) and `def handler` (line 35) are defined, while `services/library/ingest/handler.py` imports `from common.datalayer.handlers import handler, Context`. Importing `common.datalayer.handlers` fails with `ImportError: cannot import name 'handler' from partially initialized module 'common.datalayer.handlers'`.
2. **Missing `COPY services/library /app/library` in Dockerfiles:** Neither `services/rest_api/Dockerfile` nor `services/worker/Dockerfile` copies `services/library` into `/app/library`. Rebuilding `rest-api` or `worker` from `main` fails on startup with `ModuleNotFoundError: No module named 'library'`.
3. **Invalid evidence field names in `services/library/importer/import_library.py`:** Line 50 passes `'label'` and `'release_year'` to `record_evidence()`, violating the `CHECK` constraint on `silver_track_metadata_evidence.field` in `014_data_layer_up.sql` (`'record_label'` is allowed; `'label'` and `'release_year'` are not). Similarly, `sql/migrations/181_insert_reconciliation_reports_up.sql` queries `field = 'mbid'` instead of `'musicbrainz_id'`.
4. **Outbox UUID type mismatch in `services/library/model/library_db.py`:** Line 21 passes an integer `set_id` (`library.sets.id` is `BIGSERIAL`) to `append_outbox()`, which requires `aggregate_id UUID NOT NULL` in `outbox_events`.
5. **No tests and unapplied migrations:** PR #158 added zero unit tests (`tests/library_*` do not exist) and `scripts/start-dev.sh` does not apply `sql/migrations/180_*`–`184_*`.

**Disposition of `L1`–`L5` after PR #158:**
- Do **not** send `L1`, `L2`, `L3` or `L4` as originally written; they collide directly with files and migrations (`180`–`184`, `services/library/**`, `services/rest_api/routers/library_ingest.py`) already on `main`.
- Defects 1 and 2 are fixed on `main` (#176 moves the import to the end of `handlers.py`; #175 adds the Dockerfile copies).
- `L1`–`L4` are repurposed as one-job repairs of the remaining defects, each with tests: `L1` importer evidence field names (defect 3, importer), `L2` migration 185 replaces the reconciliation view with `musicbrainz_id` (defect 3, view), `L3` saved-sets outbox UUID (defect 4), `L4` `start-dev.sh` applies 170, 180–185 and 220 (defect 5, which also covers E2's and R3's migrations). `L5` (reconciliation CLI) stays in wave 3 after `L2`.

## 2. What the report says and how it applies here

| Report principle | Here |
|---|---|
| One job rule: one verb, one input, one output, one failure mode | **Adopted.** Every package has one job. WP5, WP4, BE1, FE4 and SEC6 are split (section 4). |
| Explicit blast-radius limits | **Adopted and enforced.** Owned paths are listed in each brief. G1 makes CI fail a PR that edits or deletes anything else. |
| Verify after every step; atomic commits | **Adopted.** AGENTS.md rule 4, one commit per verified step. |
| Two failed attempts: roll back and re-prompt instead of more conversation | **Adopted.** AGENTS.md rule 5: the agent stops and opens a draft. The owner closes a bad PR and resends a refined brief. Each live session gets at most one follow-up message. |
| Small reviewable diffs instead of the multi-file diff wall | **Adopted.** Budget of about 400 non-test lines. Each PR states a check the reviewer can do in under 10 minutes. |
| About 2 hours of careful review, then stop | **Adopted** as the merge sitting limit (section 5). |
| Grow from a simple working system (Gall's law) | **Adopted.** Wave 1 restores what worked and adds guards before new features. Pages are fixed one at a time. |
| Disposable, regenerable units | **Adapted.** A feature folder is the disposable unit. A failed package is closed and resent, not patched. |
| Single-file HTML, no React, no build step | **Not adopted for songnodes.** Rewriting a working React and design-system app in one go is the big-bang approach Gall's law warns against. This pattern already fits the separate single-page artifacts (for example the Naarm Set Builder), and new standalone utilities can be built that way. |
| Keep API keys in localStorage | **Rejected.** That is the current weakness SEC6 removes. Keys stay encrypted on the server. |

## 3. How each agent works now

- **Package agent (Jules).** Follows "Working rules for agents" in `AGENTS.md`, which every session reads. It does one job inside its owned paths and opens one PR titled `<CODE>: <task>`. It reports out-of-scope failures instead of fixing them, and stops after two failed attempts.
- **Guard (G1, CI).** Fails a PR that touches files outside its brief's owned paths, deletes files it does not own, or edits STATUS.md outside its slot. PRs with no package code (Dependabot, the owner) pass with a notice.
- **Merge step (owner, or the scheduled run).** Follows the protocol in section 5. It is the only actor that merges.
- **Scheduled run** ("songNodes weekend progress run"). Same protocol. It sends at most one wave and merges at most 10 PRs per run.
- **Planning (Claude).** Writes and updates briefs in `plan/build_rs_prompts.py`. It checks owned paths for overlaps within a wave before a wave is sent, and checks main for deleted work after each sitting.

## 4. Program structure and the packages

Target structure (reached one package at a time):
- **Frontend.** A page is a folder `features/<page>/` with its own `route.tsx` (G2 registry), one data hook and its own tests. Shared code is limited to `lib/`, `shell/`, `components/ds`, `hooks/useUnifiedTracks` and `types/`. Adding a page no longer edits `App.tsx`. A later lint package will stop features importing each other.
- **Backend.** A router exposes `register(app)` and is discovered by G3. A capability is one module, and migrations stay in their reserved ranges.
- **Honest states.** A page or endpoint shows real data, an explicit empty state, or an error that names the cause. It never shows mock data.

| Wave | Packages (one job each) | Waits on |
|---|---|---|
| **Pre-1 hotfix** (done, 26 Oct; #175 #176) | Fix PR #158 circular import in `services/common/datalayer/handlers.py` and `COPY services/library /app/library` in `rest_api` + `worker` Dockerfiles | nothing (do before Wave 1A) |
| **1A, guards & registries** (done, 26 Oct) | `G1` scope guard, `G2` route registry, `G3` router registry | Pre-1 hotfix; merge `G1` first so CI enforces scope on everything after |
| **1B, recover & foundations** (done, 26 Oct) | `QA5` sync script, `R1` restore track bridge, `R2` restore route finder, `R3` restore graph projection, `C1` one resolver, `C2` root scripts, `S1` search service, `E2` web call log, `SB1` set exporters | Wave 1A merged |
| **2, wire pages, next layer** (done, 26–29 Oct) | `QA4` refmb tests, `QA6` worker test, `P1` `/paths`, `P2` one Camelot page, `P3` AI setlists route, `FE9` add to targets, `S2` search proxy without mocks, `E1` local MB provider, `SB2` export dialog, `SEC6A` AI proxy route, `L1` importer fields, `L2` reconciliation view, `L3` saved-sets outbox | Wave 1B merged; each brief names its own dependency. Send `up`'s `U5` with it. |
| **3** (done, 26–27 Oct) | `QA3` graph API tests, `S3` search UI errors, `L5` reconciliation, `E3` replay report, `SB3` reorder, `SEC5` REST token auth, `SEC6B` AI proxy client, `L4` start-dev migrations | Wave 2 merged |
| **`up` & `up-legacy`** (done, 26–27 Oct) | `U1`–`U5` (running stack Python 3.15 + Redis 8.10), then `U6`, `U9`–`U29` | `U1`–`U4` merged on 26 Oct alongside 1B (owner's call); `U5` to resend. Send `up-legacy` only after the stack rebuilt from `main` passes `start-dev.sh` and the e2e smoke test on the 3.15 images. |
| **4, design system per page** (done, 26–27 Oct) | `U8` Actions pins, `DS1` to `DS15`, then `DS16` (held) | Wave 3 merged. **First update `plan/build_ds_prompts.py`** so `ENTRIES` match `G2`/`P1`–`P3` AND `## Owned paths` includes `docs/design-system/audits/{code}.md` and `frontend/design-system-pending.txt` for `G1` compatibility. |
| **5, search intelligence primitives** (done, 26–28 Oct) | `UX1` search history, `UX2` favorite queries, `UX3` lexicon trie, `UX4` autocomplete search field | Wave 4 merged (or Wave 3 merged; independent primitives) |
| **6, contextual autocomplete** (done, 26–28 Oct) | `UX5` crate filter autocomplete, `UX6` pathfinder autocomplete, `UX7` music service history, `UX8` quick search palette | Wave 5 merged |
| **7, target track auto-suggestions** (done, 27 Oct) | `TG1` target suggestions endpoint, `TG2` suggestions hook, `TG3` suggestions UI deck, `TG4` crate discovery banner | Wave 6 merged (and Wave 2 FE9 merged) |
| **8, workflow velocity & transitions** (done, 27–28 Oct) | `FL1` table keyboard nav, `FL2` set transition suggestions, `FL3` crate filter presets, `FL4` mini audio preview | Wave 7 merged (and Wave 3 SB3 merged) |
| **9, layout debt** (done, 27–28 Oct) | `LY1` AI setlists, `LY2` music library, `LY3` pathfinder and Camelot, `LY4` pipeline and export, `LY5` shared components; `DS16` (resend) | Wave 4 merged. Briefs from `plan/build_ly_prompts.py`. They share `frontend/design-system-layout-baseline.txt`, so merge one at a time and rebase each on main first. |
| **Held U7, Postgres 18** (done, 28–30 Oct) | `U7` prepared the upgrade (28 Oct); the owner cut over in `PG1` (#448, 30 Oct). The old volume is kept. | owner run |
| **Work queue of 30 Oct** (`WQ1` #446; done, 30 Oct–2 Nov) | `MRG1`, `DOC3`, `DOC4`, `PG1`, `AX2`, `SC5`, `SC6`, `SC7`, `DS21`, `DS22`, `DS24` (decision), `DS24A` (#476), `SP14` (#475), `WEB1` (the E2 `web_call_log` wrapper), `TGT1` (#474), `PV1`, `PV2`, `PF2`, `UNK1`, `UNK2`, `LINT1`. Still open: `JOBSTG` (#477), `DS23` (moved to wave 10), and the owner jobs `E2E2`, `DATA1`, `DSQ1`. | `plan/work-queue-2026-10-30/` |
| **10A, follow-ups and the M6 spec** (approved by Markus 1 Nov 2026) | `DS23`, `DS24B`, `SC2B`, `TX1C`, `U17B`, `JOBDATE`, `BRZ1`, `M6S` (see 4.1) | each brief names its own dependency; `DS23`, `SC2B` and `JOBDATE` wait for `JOBSTG` (#477) |
| **10B** | `DS24C`, `MDB1` (see 4.1) | `DS24C` after `DS23` and `DS24B`; `MDB1` after `BRZ1` (they share a file with those, so they cannot run beside them) |
| **10C, milestone 6 code** | defined by `M6S` (for example one shared scoring module, the move label on projected edges, the frontend reading it) | `M6S` merged; briefs written then |

### 4.1 Wave 10 (approved by Markus on 1 Nov 2026)

Candidates came from the follow-ups in finished slots and PRs and from the milestones in `docs/IMPLEMENTATION_PLAN.md` that are not yet met. Markus picked these on 1 Nov 2026. Each package has a hand-written brief in `plan/agents/<CODE>_<slug>.md` with a `## Owned paths` list, so G1 can find it (but see the `JOBDATE` note). Base: `main` at `2427bf9`.

| Code | One job | Owned paths (STATUS.md slot of the same code is always added) | Depends on | Sub-wave |
|---|---|---|---|---|
| `DS23` | Show each unfinished scrape job on /pipeline with StagedProgress, from the stages endpoint | `frontend/src/features/pipeline/{jobStages.ts, jobStages.test.ts, ScrapeJobStages.tsx, ScrapeJobStages.test.tsx}` (new), `frontend/src/pages/ScraperProgressPage.tsx` ("Scrape runs" only), `frontend/src/pages/ScraperProgressPage.test.tsx` | `SP14` (#475, merged), `JOBSTG` (#477) | 10A |
| `DS24B` | Store one scheduled-scrape date window; the hourly target scheduler queues nothing outside it | `sql/migrations/260_scrape_window_{up,down}.sql` (new), `scripts/start-dev.sh` (one line), `services/rest_api/routers/scrape_window.py` (new), `services/common/datalayer/target_scrape.py`, `services/common/tests/test_target_scrape.py`, `tests/rest_api/test_scrape_window.py` (new) | `DS24A` (#476, merged) | 10A |
| `SC2B` | After a target-track scrape, set `target_tracks.playlists_found` from bronze (a recount) | `services/common/datalayer/target_results.py` (new), `services/common/datalayer/handlers.py` (`scrape` handler only), `services/common/tests/test_target_results.py` (new) | `SC2`; rebase on `JOBSTG` (#477, also edits `handlers.py`) | 10A |
| `TX1C` | Remove the set-level `tidal` flag from `SavedSet` and the set builder draft | `frontend/src/features/musicLibrary/{data.ts, setBuilder.ts, SetBuilderPage.tsx}` (the flag only), `frontend/src/features/musicLibrary/{data.test.ts, setBuilder.test.ts}`, `frontend/src/features/setBuilder/{ExportDialog.test.tsx, exporters.test.ts, sendToTidal.test.ts}` | `TX1` (#394, merged) | 10A |
| `U17B` | Mount GraphQL HTTP and websocket on `/graphql` with strawberry 0.337's FastAPI router | `services/graphql-api/main.py` (the mount only), `services/graphql-api/tests/unit/test_graphql_mount.py` (new) | `U17` (merged) | 10A |
| `JOBDATE` | Add `created_from`/`created_to` (Melbourne days) to `GET /api/v1/jobs` | `services/rest_api/routers/jobs.py` (list endpoint only), `services/common/datalayer/jobs.py` (`list_jobs` only), `tests/rest_api/test_jobs_date_span.py` (new) | rebase on `JOBSTG` (#477, also edits `routers/jobs.py`) | 10A |
| `BRZ1` | One savepoint per bronze row, so one bad row is skipped and counted and the rest of the batch is written | `scrapers/pipelines/persistence_pipeline.py` (bronze inserts and their `_flush_batch` branches only), `scrapers/tests/test_bronze_batch_bad_row.py` (new), `scrapers/tests/test_scrape_counts_agree.py` (only if its fake needs savepoints) | `SC5`, `SC6` (merged) | 10A |
| `M6S` | Write the transition scoring and energy move spec and name the M6 code packages (docs only) | `docs/TRANSITION_SCORING.md` (new) | nothing | 10A |
| `DS24C` | /pipeline card that shows and sets the scheduled-scrape window with `DateRangeField` | `frontend/src/features/pipeline/{ScrapeWindowCard.tsx, ScrapeWindowCard.test.tsx}` (new), `frontend/src/pages/ScraperProgressPage.tsx` (mount only), `frontend/src/pages/ScraperProgressPage.test.tsx` | `DS24B`; `DS23` merged first (same page) | 10B |
| `MDB1` | Link each MixesDB silver track to its positioned bronze row, so none is skipped for a missing `bronze_id` | `scrapers/pipelines/persistence_pipeline.py` (`_process_track_item`, `_insert_songs_batch` only), `scrapers/tests/test_silver_links_bronze.py` (new) | `BRZ1` merged first (same file) | 10B |
| M6 code | Defined by `M6S` | from `M6S` | `M6S` | 10C |

Notes:
- **Overlap check.** Within 10A no two packages own the same path, and within 10B neither does. The pairs that share a file are split across sub-waves: `DS23`/`DS24C` (`ScraperProgressPage.tsx` and its test) and `BRZ1`/`MDB1` (`persistence_pipeline.py`). Every package also edits STATUS.md, each in its own slot only, which G1 allows.
- **`DS24B` and `DS24C`.** Markus approved "DS24B" as a backend setting plus a /pipeline card. It is split in two so each part stays inside the 10-file budget, and so the card can wait for `DS23` on the same page without holding up the backend.
- **`DS24B` window meaning (assumed).** The window limits the days on which scheduled target scrapes are queued (Melbourne dates). It does not filter mixes by date, and manual scrapes are never limited. Confirm before sending if that is not what was meant.
- **`TX1C`.** The weekly run that read the set's `tidal` flag is in the owner's musicLibrary folder, not in this repo (`pipeline/run_weekly.py` has no TIDAL set step). Removing that step there is an owner follow-up.
- **`JOBDATE` and G1.** `scripts/scope_guard.py` takes the code from the PR title with `\b([A-Z]{1,4}\d{1,2}[A-Z]?)\b`, or from the branch with `^([A-Za-z]{1,4}\d{1,2}[A-Za-z]?)`. A code with no digit (`JOBDATE`, like `JOBSTG`) matches neither, so the guard prints "not a work package" and exits 0 without checking owned paths. Its brief is in `plan/agents/` for the agent, but the reviewer checks its owned paths by hand. Every other wave 10 code (`DS23`, `DS24B`, `DS24C`, `SC2B`, `TX1C`, `U17B`, `BRZ1`, `MDB1`, `M6S`) matches and finds its brief.

Retired because they were split or replaced: WP2 (ref_mb is a separate database), WP4 → E1/E2/E3, WP5 → merged in #158 (L1–L4 held for repair, L5 active), BE1 → S1/S2/S3, FE1 → R1, FE3 → R2 + P1, FE4 → SB1/SB2/SB3, FE11 and FEW (replaced by G2 plus P1 to P3), SEC6 → SEC6A/SEC6B. The laptop launcher in `E:\musicLibrary\plan` is retired; it refuses everything and points here.

Briefs are generated: `python plan/build_rs_prompts.py` writes every R/G/C/S/L/E/SB/P/FE9/SEC brief and adds missing STATUS.md slots. The DS briefs come from `plan/build_ds_prompts.py`, the LY briefs from `plan/build_ly_prompts.py`. The QA briefs and the wave 10 briefs (4.1) are hand-written.

## 5. Merge protocol and review budget

1. Merge in wave order, one PR at a time. Before each merge, update the PR branch from main and wait for checks again. Never squash a branch whose base is behind main without updating it first; that is how #93 and #136 deleted work.
2. Require the G1 scope guard to pass (merged #161). Merge G1-type guards first in any wave that adds them; sessions can be sent together, because the guard runs on every PR once it is on main and the branch is updated. Until then, read the PR's "deleted" list and `git diff --stat main...<branch>` yourself. Any deleted file outside the brief's owned paths means do not merge.
3. Do the PR's under-10-minute behavioural check, then merge.
4. If a PR conflicts in files it does not own, or needs more than one follow-up message, close it and resend the brief with the lesson added. Do not patch it in conversation. A follow-up push is a new PR as far as review goes: rerun the deleted-files check on every new head, because a session that rebuilds its branch can delete merged work (#162).
5. A CI breakage outside every open package gets its own one-job QA package. "Fix CI" PRs that touch many areas are not merged.
6. Merge at most about 10 PRs per sitting and stop at 2 hours, or sooner if you notice yourself skimming diffs.
7. After each sitting, run the deleted-work check (`git diff --diff-filter=D --name-only <sitting start>..main`) and compare it with the briefs' owned paths.

## 6. Upgrades to the latest versions (26 Oct 2026)

Test, lint and type-check tooling was upgraded directly in PR #155, not by Jules:
- TypeScript 7.0.2.
- Oxlint 1.89 with oxlint-tsgolint 7.0.2005, replacing ESLint, typescript-eslint and eslint-plugin-react (see `frontend/LINTING.md`).
- Node 26 for CI and the frontend image.
- Python 3.15 for the test jobs, and pip-audit 2.10.1 running on 3.14.
- A lockfile that `npm ci` accepts on Linux.
- Test pins at their latest versions.

This retires QA1 and QA2.

Everything else is one-job Jules packages built by `plan/build_upgrade_prompts.py`. That script looks up the latest versions when it runs and writes the chosen versions into each brief. Rerun it before sending, so the targets are current. **Schedule note:** send `up` after Wave 1B is merged and verified so runtime upgrades do not compound with structural recovery.

| Wave | Packages | Notes |
|---|---|---|
| `up` (after Wave 1B; done, 26 Oct) | U1 rest_api, U2 graph-visualization-api, U3 worker, U4 scrapers (all Python 3.15), U5 Redis 8.10 | The running stack first, once Wave 1 recovery is green. |
| `up-legacy` (after `up` is merged; done, 26–27 Oct) | U6 RabbitMQ 4.3; U9–U18, U20–U24 Python services not in compose (3.15); U19 nlp-processor (3.14, since spaCy needs Python <3.15); U25 base template; U26–U28 Node services (Node 26); U29 graph projection (Python 3.15 and neo4j 6, after R3) | Keeps every image building. |
| `4` (done, 27 Oct) | U8 GitHub Actions pinned by SHA to their latest releases | After waves 1–3, which edit workflows. |
| held (done, 28–30 Oct; cut over in PG1 #448) | U7 Postgres 18.6 | Prepares a new volume, a migration script and a runbook. Send it with `--only U7`. Merge it only after the owner has run `scripts/upgrade-postgres-18.sh`. The old volume is never removed. |

Version rules applied:
- Python 3.15 everywhere it installs. Packages without a cp315 wheel (annoy, PyYAML, ruamel.yaml.clib) compile from source, so their build stage needs a compiler.
- spaCy is the only package that blocks 3.15.
- Node 26 is LTS from late October 2026; Node 24 is security-only.
- The PostgreSQL, RabbitMQ and Redis versions are the latest stable releases.

Major bumps are flagged in the briefs.
