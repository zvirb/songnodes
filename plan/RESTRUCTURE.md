# Restructure: small-batch work packages (26 Oct 2026)

Guide: *Architectural Modularity and Cognitive Sustainability in Generative Software Engineering* (the "vibe coding report"). Its claims are used as working heuristics, not as measured facts about this repo. This file replaces the wave plan in the laptop copy of `INTEGRATION_PLAN.md` for everything not yet merged. It is the single plan; `plan/launch_jules.py` in this repo is the single launcher.

## 1. What the audit of main found (5d1da0f, 26 Oct 05:43)

The report's main warning is that a large changeset silently deletes working logic next to the change. That has already happened here several times:

| Merged work | Deleted by | What is missing on main now |
|---|---|---|
| FE1 track bridge (#91) | #93, the stale duplicate WP0 merge | `hooks/useUnifiedTracks.ts`, `services/trackSyncAdapter.ts`, `services/unifiedTrackService.ts` and its test. Three pages carry TEMP copies instead. |
| FE3 route finder (#133) | #136 "fix(ci): fix broken package.json ..." (70 files, -3,679 lines) | All of `features/pathfinder/`. `/paths` still shows the placeholder. |
| WP8 graph projection (#128, #131) | #136 | `datalayer/graph_projection.py`, `services/graph-projection/`, migration 220, the handlers wiring, WP8 docs. |
| BE1 real music search (#118) | never landed | Only the test fakes were merged. The REST API still returns "Mock Artist" / "Mock Album". |
| WP3 resolver (#142) | n/a | Two copies, in `services/reference-data/resolver/` and `services/reference_data/resolver/`. It also rewrote WP0's fixtures. |

Other findings:
- Finished pages that were never routed: `features/camelot` (FE5, which duplicates `pages/CamelotPage.tsx`), `features/aiSetlists` (FE10) and the route finder. Each was waiting on a separate "wiring" package that edits the shared `App.tsx`.
- Agent sessions committed scratch scripts to the repo root (`patch_*.py`, `fix_*.py`, `fix16.sh`).
- 12 components in `frontend/src/components/` are imported by nothing. That folder holds 63 files and about 29,000 lines.
- Work packages that bundled several jobs either finished only one of them (BE1 shipped only its test fakes) or reached into other packages' files to get CI green (#136).

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
| 1, recover and guard | QA2 lockfile, QA5 sync script, G1 scope guard, G2 route registry, G3 router registry, R1 restore track bridge, R2 restore route finder, R3 restore graph projection, C1 one resolver, C2 root scripts, S1 search service, L1 library model, E2 web call log, SB1 set exporters | nothing |
| 2, wire pages, next layer | QA1 lint config, QA4 refmb tests, QA6 worker test, P1 /paths, P2 one Camelot page, P3 AI setlists route, FE9 add to targets, S2 search proxy without mocks, L2 importer, L4 saved sets API, E1 local MB provider, SB2 export dialog, SEC6A AI proxy route | wave 1 merged; each brief names its own dependency (QA4 also needs PR #121 merged or closed) |
| 3 | QA3 graph API tests, S3 search UI errors, L3 ingest API, L5 reconciliation, E3 replay report, SB3 reorder, SEC5 REST token auth, SEC6B AI proxy client | wave 2 |
| 4, design system per page | DS1 to DS15, then DS16 (held) | wave 3. **First rerun `plan/build_ds_prompts.py` with its ENTRIES updated for the G2 registry and P2**, so ownership matches the new files. |

Retired because they were split or replaced: WP2 (ref_mb is a separate database), WP4 → E1/E2/E3, WP5 → L1 to L5, BE1 → S1/S2/S3, FE1 → R1, FE3 → R2 + P1, FE4 → SB1/SB2/SB3, FE11 and FEW (replaced by G2 plus P1 to P3), SEC6 → SEC6A/SEC6B. The laptop launcher in `E:\musicLibrary\plan` is retired; it refuses everything and points here.

Briefs are generated: `python plan/build_rs_prompts.py` writes every R/G/C/S/L/E/SB/P/FE9/SEC brief and adds missing STATUS.md slots. The DS briefs come from `plan/build_ds_prompts.py`. The QA briefs are hand-written.

## 5. Merge protocol and review budget

1. Merge in wave order, one PR at a time. Before each merge, update the PR branch from main and wait for checks again. Never squash a branch whose base is behind main without updating it first; that is how #93 and #136 deleted work.
2. Require the G1 scope guard to pass (after G1 merges). Until then, read the PR's "deleted" list and `git diff --stat main...<branch>` yourself. Any deleted file outside the brief's owned paths means do not merge.
3. Do the PR's under-10-minute behavioural check, then merge.
4. If a PR conflicts in files it does not own, or needs more than one follow-up message, close it and resend the brief with the lesson added. Do not patch it in conversation.
5. A CI breakage outside every open package gets its own one-job QA package. "Fix CI" PRs that touch many areas are not merged.
6. Merge at most about 10 PRs per sitting and stop at 2 hours, or sooner if you notice yourself skimming diffs.
7. After each sitting, run the deleted-work check (`git diff --diff-filter=D --name-only <sitting start>..main`) and compare it with the briefs' owned paths.
