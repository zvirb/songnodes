#!/usr/bin/env python3
"""Build the small-batch restructure briefs (plan/agents/<CODE>_*.md) and their STATUS.md slots.

Source of the plan: plan/RESTRUCTURE.md. Every brief does ONE job, lists its owned paths in a machine-readable
"## Owned paths" bullet list (scripts/scope_guard.py reads it once G1 is merged), names its dependencies, and
says how a reviewer checks it in under 10 minutes.
Re-run after editing a package:  python plan/build_rs_prompts.py   (idempotent; never touches other briefs)
"""
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent
REPO = ROOT.parent
AGENTS = ROOT / "agents"

FE_CHECKS = ("`cd frontend && npm ci && npx tsc --noEmit -p . && npx vitest run src && npx vite build`. If `npm ci` fails on the "
             "lockfile (QA2 not merged yet), use `npm install --no-package-lock` instead, say so, and never commit package-lock.json. "
             "Report failures in files you do not own; do not fix them. Playwright cannot run in your sandbox; say so.")
PY_CHECKS = "`python -m pytest` for the paths you own, from the repo root. Report failures in files you do not own; do not fix them."


def header(code, title, deps):
    dep = ", ".join(deps) if deps else "nothing"
    return f"""{code}: {title}

Base: main at BASE_SHA. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md (one job, owned paths only, about 400 changed lines at most, verify then commit, two attempts then stop, rebase before the PR) and CLAUDE.md; the design system rules apply to any UI change. No access to the user's laptop, local data or secrets; work from the repo and fixtures. Open one PR against main titled "{code}: {title}" on a branch starting with "{code.lower()}-"; do not merge it. Edit only the lines inside your own STATUS.md slot (SLOT:{code} BEGIN/END). Depends on: {dep}. If a dependency is not merged on main yet, stop and say so instead of working around it.
"""


def brief(code, title, deps, job, context, owned, do, done, checks):
    out = [header(code, title, deps), f"## Job\n{job}\n"]
    if context:
        out.append(f"## Context (verified on main 2026-10-26)\n{context}\n")
    out.append("## Owned paths\n" + "\n".join(f"- {p}" for p in owned) +
               "\n\n(Complete list. Anything else is read-only for you. You may also add a dated note under docs/integration/"
               f"{code}/ if you need to record a decision.)\n")
    out.append("## Do\n" + "\n".join(f"{i}. {d}" for i, d in enumerate(do, 1)) + "\n")
    out.append(f"## Done when (the reviewer's under-10-minute check; put it in the PR)\n{done}\n")
    out.append(f"## Checks\n{checks}\n")
    out.append("## Hand-back\nThe one job done, files added/changed/deleted, checks run and not run, the reviewer check, follow-ups.\n")
    return "\n".join(out)


P = []  # (code, slug, title, deps, job, context, owned, do, done, checks)

# ---------------- wave 1: recover, guard, foundations ----------------
P.append(("R1", "restore_track_bridge", "Restore the unified track data bridge", [],
  "Bring back the FE1 track bridge files that a later merge deleted, so pages can share one track hook again.",
  "FE1 (PR #91, commit 541ee5e) added frontend/src/hooks/useUnifiedTracks.ts, frontend/src/services/trackSyncAdapter.ts, "
  "frontend/src/services/unifiedTrackService.ts (+ .test.ts) and frontend/src/types/unifiedTrack.ts. The stale duplicate WP0 merge "
  "(PR #93, d4ca595) deleted the first four; types/unifiedTrack.ts survived and has changed since. Pages now carry local copies "
  "(features/aiSetlists/TEMP_useUnifiedTracks.ts, features/camelot/TEMP_useUnifiedTracks.ts, features/pathfinder/useUnifiedTracks.ts once R2 lands); "
  "do not touch them, P1 to P3 switch them over.",
  ["frontend/src/hooks/useUnifiedTracks.ts", "frontend/src/services/trackSyncAdapter.ts", "frontend/src/services/unifiedTrackService.ts",
   "frontend/src/services/unifiedTrackService.test.ts", "frontend/src/types/unifiedTrack.ts (reconcile only; keep every field now on main)"],
  ["`git checkout 541ee5e -- frontend/src/hooks/useUnifiedTracks.ts frontend/src/services/trackSyncAdapter.ts frontend/src/services/unifiedTrackService.ts frontend/src/services/unifiedTrackService.test.ts`.",
   "Diff 541ee5e:frontend/src/types/unifiedTrack.ts against main; keep main's version and adapt the restored files to it. Never remove a field.",
   "Fix only compile errors inside the owned files. If an import target no longer exists anywhere, stop and report it.",
   "Commit the restore and the reconciliation as two commits."],
  "`npx vitest run src/services/unifiedTrackService.test.ts` passes; `git show --stat HEAD~1` shows only the four restored files.",
  FE_CHECKS))

P.append(("R2", "restore_route_finder", "Restore the route finder page", [],
  "Bring back the FE3 route finder page that the PR #136 CI fix deleted. Do not route it yet (P1 does).",
  "FE3 (PR #133, ccaca01) added frontend/src/features/pathfinder/{PathfinderPage.tsx, PathfinderPage.test.tsx, index.ts, useUnifiedTracks.ts}. "
  "PR #136 (ecdfe4a, \"fix(ci): fix broken package.json ...\") deleted all four. /paths still renders PlannedModulePage. "
  "The backend router services/rest_api/routers/pathfinder.py and the existing usePathfinder hook are still on main.",
  ["frontend/src/features/pathfinder/**"],
  ["`git checkout ccaca01 -- frontend/src/features/pathfinder`.",
   "Fix only compile or test errors inside that folder (imports that moved). Keep its local useUnifiedTracks.ts; P1 swaps it for the shared hook.",
   "Do not edit App.tsx or any route file."],
  "`npx vitest run src/features/pathfinder` passes and the folder matches ccaca01 except the listed fixes.",
  FE_CHECKS))

P.append(("R3", "restore_graph_projection", "Restore the graph projection consumer", [],
  "Bring back the WP8 graph projection outbox consumer that the PR #136 CI fix deleted, without the scratch scripts that came with it.",
  "WP8 (PR #128, dee69d5; PR #131, f188682) added services/common/datalayer/graph_projection.py, services/graph-projection/{Dockerfile, cli.py, requirements.txt}, "
  "sql/migrations/220_graph_consumer_{up,down}.sql, docs/integration/WP8/{decisions/2026-10-25-WP8-graph.md, versions.csv} and a 14-line change to "
  "services/common/datalayer/handlers.py. PR #136 (ecdfe4a) deleted all of it and reverted the handlers.py lines. The graph page has no projected data without it.",
  ["services/common/datalayer/graph_projection.py", "services/graph-projection/**", "sql/migrations/220_graph_consumer_up.sql",
   "sql/migrations/220_graph_consumer_down.sql", "docs/integration/WP8/**", "services/common/datalayer/handlers.py (only the lines dee69d5 added)",
   "tests/graph_projection/**"],
  ["`git checkout dee69d5 -- services/common/datalayer/graph_projection.py services/graph-projection sql/migrations/220_graph_consumer_up.sql sql/migrations/220_graph_consumer_down.sql docs/integration/WP8`. Do NOT restore patch_*.py or run_tests.sh.",
   "`git show dee69d5 -- services/common/datalayer/handlers.py`; re-apply those lines by hand on the current file. Change nothing else in it.",
   "Apply any later WP8 fix from f188682 that touches the same files (check `git show f188682 --stat`).",
   "If tests/graph_projection does not exist, add one test file with a fake Memgraph client covering one create and one delete event. Never add synthetic graph data to a real database."],
  "`python -m pytest tests/graph_projection` passes; migration 220 up then down applies on a throwaway Postgres if your sandbox can start one (say if not).",
  PY_CHECKS))

P.append(("G1", "scope_guard", "Scope guard: fail PRs that touch files outside their package", [],
  "Add a CI check that fails a work-package PR when it adds, changes or deletes files outside the owned paths in its brief.",
  "Several merged PRs deleted other packages' merged work: #93 deleted the FE1 bridge; #136 (a CI fix) deleted FE3, WP8 and more (about 3,700 lines). "
  "Briefs in plan/agents/<CODE>_*.md each have a \"## Owned paths\" bullet list (one path or glob per bullet; text after the path in brackets is commentary).",
  [".github/workflows/scope-guard.yml", "scripts/scope_guard.py", "tests/scope_guard/**"],
  ["scripts/scope_guard.py (stdlib only): args --base, --head, --title, --branch. Package code = first match of `\\b([A-Z]{1,4}\\d{1,2}[A-Z]?)\\b` in the title, else the leading code in the branch name (case-insensitive). No code or no matching brief: print \"not a work package\" and exit 0.",
   "Read owned globs from the brief (strip backticks and anything from the first space followed by a bracket). Always allowed: STATUS.md (only inside SLOT:<CODE>) and docs/integration/<CODE>/**.",
   "`git diff --name-status base...head`: fail if any added/modified file is not owned, if STATUS.md changes outside the slot, and loudly if any deleted file is not owned (list each one). Write a markdown table to $GITHUB_STEP_SUMMARY when set.",
   "Workflow on pull_request with fetch-depth 0, passing the PR title and head ref.",
   "Tests on a temporary git repo: in-scope pass; out-of-scope edit fails; out-of-scope delete fails; STATUS edit outside slot fails; no code passes; `**` globs match nested files."],
  "Run `python scripts/scope_guard.py --base ecdfe4a^ --head ecdfe4a --title \"R2: test\" --branch r2-test` and show that it fails and lists the deleted files outside features/pathfinder.",
  "`python -m pytest tests/scope_guard`; the command in \"Done when\"."))

P.append(("G2", "route_registry", "Route registry: each page registers its own route", [],
  "Make pages register their routes from their own folder, so adding a page no longer edits the shared App.tsx.",
  "Every new page so far needed an App.tsx edit by a separate wiring package; three finished pages (FE5 camelot, FE10 AI setlists, FE3 route finder) are still unrouted. "
  "Navigation items come from the design system's modules (lib/songnodes.tsx MODULE_ROUTES); do not change navigation.",
  ["frontend/src/App.tsx", "frontend/src/routes/**", "frontend/src/features/musicLibrary/route.tsx"],
  ["frontend/src/routes/registry.tsx: collect `import.meta.glob('../features/*/route.tsx', { eager: true })`; each module exports `route = { path, element }` (lazy element allowed). Keep a static list for today's pages that live outside features/ (home, graph, harmony, sources, pipeline, settings, not-found, the /paths placeholder).",
   "A discovered route replaces a static entry with the same path; two discovered routes with the same path is an error (throw in dev and fail the test).",
   "App.tsx renders static plus discovered routes inside the existing AppShell; the OAuth callback routes stay outside the shell, unchanged.",
   "Move /library and /sets into features/musicLibrary/route.tsx.",
   "Test: render every current URL in a MemoryRouter and assert the same page heading as before."],
  "Every URL in today's App.tsx still opens the same page; the registry test lists them.",
  FE_CHECKS))

P.append(("G3", "router_registry", "REST API: routers register themselves", [],
  "Let REST API routers that expose register(app) be included automatically, so new endpoints no longer edit the shared main.py.",
  "services/rest_api/main.py is 772 lines with explicit include_router calls; routers/library_search.py already uses a register(app) function (main.py lines 758-759).",
  ["services/rest_api/router_registry.py", "services/rest_api/main.py (one call to the registry after the existing includes; nothing else)",
   "tests/rest_api/test_router_registry.py"],
  ["router_registry.register_all(app): import every module in services/rest_api/routers/ that defines register(app) and is not already included explicitly by main.py; call each once, in module-name order; log each.",
   "An import error fails fast with a message naming the module (a hidden missing router is worse than a failed start).",
   "Leave the existing explicit includes exactly as they are."],
  "Start the app with TestClient: the route list is identical to before plus nothing; a test with a fake routers package proves discovery and the duplicate guard.",
  PY_CHECKS))

P.append(("C1", "one_resolver_home", "One home for the local MusicBrainz resolver", [],
  "Remove the duplicate copy of the WP3 resolver so there is exactly one implementation.",
  "WP3 (PR #142) wrote services/reference-data/resolver/resolver.py (292 lines) and services/reference_data/resolver/{__init__, loader, resolver}.py (238 lines). "
  "contracts/ownership.yaml gives wp3 the hyphenated path, but Python cannot import a hyphenated package. ref_mb lives in its own read-only database "
  "(docs/integration/ref_mb/DECISION.md, settings in services/common/refmb/settings.py, gated by MB_LOCAL_ENABLED).",
  ["services/reference-data/resolver/**", "services/reference_data/**", "tests/resolver/**", "contracts/ownership.yaml (the wp3 entry only)"],
  ["Find which copy is imported (grep imports, tests/resolver, Dockerfiles, compose files) and diff the two.",
   "Keep the imported copy. Carry over anything that exists only in the other copy (list each item in the PR); then delete the other copy.",
   "Point the wp3 entry in contracts/ownership.yaml at the kept path.",
   "Report, do not fix: whether the kept resolver reads from the ref_mb connection settings and honours MB_LOCAL_ENABLED."],
  "One resolver folder remains; `python -m pytest tests/resolver` passes; grep shows no import of the deleted path.",
  PY_CHECKS))

P.append(("C2", "root_scratch_scripts", "Remove one-off agent scripts from the repo root", [],
  "Delete the one-off fix and patch scripts that earlier agent sessions left in the repo root, when nothing references them.",
  "Earlier sessions committed scratch scripts to the root.",
  ["fix16.sh", "fix_scrapers_reqs.py", "fix_scrapers_reqs2.py", "fix_test_reqs.py", "fix_test_reqs2.py", "fix_test_reqs3.py", "fix_test_reqs4.py",
   "patch_package_json.py", "patch_reqs.py", "patch_sec.py", "patch_sec_requirements.py", "patch_sec_workflow.py", "patch_sec_workflow2.py",
   "patch_sec_workflow3.py", "patch_tests_requirements.py", ".gitignore (one block for root-level patch_*.py and fix_*.py)"],
  ["For each listed file, grep the whole repo (workflows, scripts, docs, compose, Makefiles) for its name.",
   "Delete only the unreferenced ones; leave referenced ones and list where they are referenced.",
   "Add `/patch_*.py` and `/fix_*.py` to .gitignore under a comment saying why."],
  "The PR lists each file as deleted or kept, with the grep result.",
  "`git grep` evidence in the PR; run `python -m pytest tests -q -x --co` to show collection still works."))

P.append(("S1", "search_service", "Track search on metadata-enrichment for TIDAL and Spotify", [],
  "Add GET /api/v1/search/{service} to metadata-enrichment, returning real normalised TIDAL or Spotify tracks or an explicit error.",
  "The UI's music search calls the REST API, which proxies to metadata-enrichment /api/v1/search/{service}; that route does not exist, so the REST API "
  "falls back to hard-coded mock tracks (services/rest_api/main.py around line 730: \"Mock Artist\", \"Mock Album\"). BE1 (PR #118) merged only "
  "tests/fakes/fake_music_services.py; the search itself never landed. The real clients are TidalClient and SpotifyClient in services/metadata-enrichment/api_clients.py.",
  ["services/metadata-enrichment/music_search.py", "services/metadata-enrichment/search_routes.py",
   "services/metadata-enrichment/main.py (one include_router line)", "services/metadata-enrichment/tests/test_music_search.py"],
  ["music_search.search_tracks(service, q, limit) for tidal and spotify, reusing the existing clients' token handling (do not edit api_clients.py; if a change is needed, describe it and monkeypatch in tests). limit 1 to 50; q trimmed and capped; timeouts on every call.",
   "Normalised shape (the UI reads exactly this): {\"tracks\": [{\"id\", \"name\", \"title\", \"artist\", \"artists\": [{\"name\"}], \"album\": {\"name\", \"images\": [{\"url\"}]}, \"duration_ms\", \"preview_url\", \"image\", \"isrc\", \"url\"}]}; real image URLs or null, never placeholders.",
   "search_routes.py: 424 {code: tidal_not_configured|spotify_not_configured, message} without credentials; 502 {code: provider_error} on upstream failure, passing Retry-After on 429; 400 for an unknown service or empty q.",
   "Tests against tests/fakes/fake_music_services.py: normalisation (missing album, missing ISRC, several artists, remix titles), validation, 424, 429 and 500 mapping, timeout."],
  "`python -m pytest services/metadata-enrichment/tests/test_music_search.py` passes; with no credentials set, the route returns 424 with the not-configured code.",
  PY_CHECKS + " Never read, print or commit real credentials."))

P.append(("L1", "library_model", "Library overlay: models and views", [],
  "Add the models and views for the WP0 library overlay schema, with no importer and no endpoints.",
  "WP0 created the library overlay schema (sql/migrations/101_library_schema_up.sql) and the library fixture under contracts/. The musicLibrary SQLite views "
  "being replaced are v_crates, v_source_yield, v_review_queue and v_buy_list. Library-only concepts: rotation status and locks, crate, energy score with auto "
  "and override parts, tier, tags, source appearances, chart positions, saved sets. Migrations 180-189 are yours (WP5's range was 180-219; L2, L4 use 190-209).",
  ["services/library/__init__.py", "services/library/model/**", "sql/migrations/18[0-9]_*", "tests/library_model/**"],
  ["Repositories for the overlay tables (read and write) following the datalayer conventions in services/common/datalayer.",
   "Views equivalent to the four SQLite views as migrations 180-189, up and down.",
   "An energy_model field and registry with only a passthrough of today's score (a later package plugs in a new model).",
   "Tests on the WP0 fixture against a throwaway Postgres if your sandbox can start one; otherwise say so and test the SQL text."],
  "Views return the same crate counts as the fixture's v_crates; up/down migrations apply cleanly.",
  PY_CHECKS))

P.append(("E2", "web_call_log", "Log every outbound enrichment call", [],
  "Add web_call_log: a table and a thin wrapper that records every outbound enrichment HTTP call, without changing existing providers.",
  "WP4's goal is to count the web calls the local MusicBrainz data makes unnecessary. Providers live in services/common/providers/ (base.py defines the Provider protocol). Migrations 170-179 are yours.",
  ["services/common/providers/web_call_log.py", "sql/migrations/17[0-9]_*", "tests/enrichment_local/test_web_call_log.py"],
  ["Table: provider, endpoint, field, run id, timestamp, status, duration (up and down migrations).",
   "A wrapper that can be attached to a provider's HTTP session in tests and, later, in the waterfall; no edits to existing provider files.",
   "MusicBrainz web fallback rule recorded in the wrapper docs: 1 request per second and a descriptive User-Agent."],
  "The test attaches the wrapper to a fake provider and shows one row per call.",
  PY_CHECKS))

P.append(("SB1", "set_exporters", "Set exporters: M3U8, Rekordbox XML and a TIDAL list", [],
  "Add pure, tested functions that turn a set's tracks into M3U8, Rekordbox XML and a TIDAL id list. No UI.",
  "features/musicLibrary/SetBuilderPage.tsx has energy waves, transition checks and saved sets but no DJ-format export. BPM, key and duration are often null.",
  ["frontend/src/features/setBuilder/exporters.ts", "frontend/src/features/setBuilder/exporters.test.ts"],
  ["M3U8 with #EXTINF and safe path/URL handling; Rekordbox XML with escaping and missing duration/BPM/key handled; TIDAL as a JSON list of ids/URLs only (no network).",
   "A missing-field summary helper (\"12 tracks have no BPM\") for the dialog in SB2.",
   "Golden-string tests including special characters and empty fields."],
  "`npx vitest run src/features/setBuilder` passes; the PR shows one golden output per format.",
  FE_CHECKS))

# ---------------- wave 2: wire the pages, next layer ----------------
P.append(("P1", "paths_page", "Route /paths to the route finder page", ["G2", "R1", "R2"],
  "Make /paths open the restored route finder page, using the shared track hook.",
  "After R2 the page is back in features/pathfinder with a local useUnifiedTracks.ts; after R1 the shared hook is at frontend/src/hooks/useUnifiedTracks.ts; after G2 a feature registers its route in its own route.tsx.",
  ["frontend/src/features/pathfinder/**"],
  ["Add features/pathfinder/route.tsx exporting the /paths route (it replaces the static placeholder through the registry).",
   "Switch the page to the shared hook and delete the local useUnifiedTracks.ts.",
   "Check the page's empty and error states are honest (no data: say so and point to the library; API error: name it)."],
  "Open /paths: the route finder renders; with the backend down it shows an error that names the cause, not an empty result.",
  FE_CHECKS))

P.append(("P2", "harmony_page", "Harmony: one Camelot page", ["G2", "R1"],
  "Leave exactly one Camelot page at /harmony.",
  "Two exist: frontend/src/pages/CamelotPage.tsx (448 lines, routed at /harmony) and frontend/src/features/camelot/CamelotPage.tsx (336 lines, FE5 PR #98, unrouted, with a TEMP_useUnifiedTracks.ts).",
  ["frontend/src/pages/CamelotPage.tsx", "frontend/src/features/camelot/**", "frontend/src/routes/registry.tsx (only removing the static /harmony entry)"],
  ["Put a comparison table in the PR: features of each, data source, tests, design-system state.",
   "Keep the better base (prefer the one in features/ if it is not clearly worse). Port only user-visible features the other has, within the diff budget; list the rest as follow-ups.",
   "Register /harmony from features/camelot/route.tsx, remove the static entry, delete the page you did not keep, and switch to the shared hook (delete the TEMP copy)."],
  "Open /harmony: one page renders; the PR table says what was kept and what was dropped.",
  FE_CHECKS))

P.append(("P3", "ai_setlists_page", "Sources: route the AI setlists page", ["G2", "R1"],
  "Make the finished AI setlists page reachable, in the place the design system's information architecture gives it.",
  "FE10 (PR #94) built frontend/src/features/aiSetlists/AISetlistsPage.tsx; it was never routed. /sources redirects to /sources/targets. "
  "design-system 02-information-architecture and 10-navigation decide how a second Sources page is reached (NavDrawer only; no site tabs).",
  ["frontend/src/features/aiSetlists/**", "frontend/src/pages/ModulePages.tsx (only an entry point on the Sources page, if the IA calls for one)"],
  ["Read the IA sections and pick the path and entry point they prescribe; quote the rule in the PR. If they give no place, register the route, add no navigation, and report it as a design-system gap.",
   "Add features/aiSetlists/route.tsx and switch to the shared hook (delete TEMP_useUnifiedTracks.ts).",
   "The page keeps its AI calls as they are (SEC6 moves keys off the browser later)."],
  "The page opens at its route and is reachable the way the PR describes.",
  FE_CHECKS))

P.append(("FE9", "library_to_targets", "Add library tracks to target tracks", ["R1"],
  "Add a row button in the library table that adds the track to target tracks.",
  "The library table is frontend/src/features/musicLibrary/LibraryPage.tsx; the row-actions cell has an \"Add to set\" icon button with classes sn-btn sn-btn--quiet sn-btn--sm sn-btn--icon. "
  "Targets go through useUnifiedTracks().setTrackAsTarget (R1), which POSTs to /api/v1/target-tracks (routers/target_tracks.py: title, artist, priority, genres, search_terms).",
  ["frontend/src/features/musicLibrary/targetAction/**", "frontend/src/features/musicLibrary/LibraryPage.tsx (one edit: mount the button in the row-actions cell)"],
  ["Icon button with the same classes; icon name from design-system 14-identity-icons via SnIcon (do not invent one); accessible name \"Add {artist} - {title} to target tracks\".",
   "Priority medium; search_terms from artist, title and mix; genres when known. Backend down: keep it locally and say \"saved locally, will sync\".",
   "States with text and icon: idle, adding (aria-busy), added (\"In target tracks\"), error with retry; announce in an aria-live region. Detect existing targets by id, then by normalised artist + title.",
   "Tests: renders with missing BPM/key; one click calls setTrackAsTarget once; double click does not duplicate; existing target shows added; backend-down message."],
  "Click the new button on a library row: the track appears in /sources/targets.",
  FE_CHECKS))

P.append(("S2", "search_proxy", "REST music search: remove the mock results", ["S1"],
  "Make the REST API's music search pass real results and real errors through, and delete the mock data.",
  "services/rest_api/main.py music_search (around line 672) proxies to metadata-enrichment and returns hard-coded mock tracks on 404 or connection errors.",
  ["services/rest_api/main.py (only the body of music_search)", "tests/rest_api/test_music_search_proxy.py", "docs/music-search.md"],
  ["Keep the proxy; delete both mock branches. Pass upstream status and detail through; connection failure becomes 503 {code: search_service_unavailable}. Short timeout; use METADATA_ENRICHMENT_URL.",
   "Test: pass-through of 200/424/502, 503 when the service is down, and a grep test that \"Mock Artist\", \"Mock Album\" and \"placeholder.com\" no longer appear under services/rest_api or services/metadata-enrichment.",
   "docs/music-search.md: how the owner sets TIDAL/Spotify credentials locally without committing them, and the curl check."],
  "With no credentials: `curl .../api/v1/music-search/tidal?q=test` returns 424 with the not-configured message, not mock tracks.",
  PY_CHECKS))

P.append(("L2", "library_importer", "Library importer: SQLite into silver and the overlay", ["L1"],
  "Add `python -m library.importer --sqlite <path>`: an idempotent import of the musicLibrary SQLite into silver plus the overlay.",
  "Use the existing datalayer helpers: datalayer.ingest (resolve_artist, upsert_track) and datalayer.evidence.record for ISRC, TIDAL/Deezer ids, genre, label and "
  "release year as evidence from source musiclibrary; never overwrite stronger values. Identifiers: (source_system='musiclibrary', source_id=track_id) and norm_key, per contracts/ids.md. "
  "Real counts on 24 Oct 2026 (owner-side check only): tracks 319, appearances 325, chart_positions 10, rotation_history 319.",
  ["services/library/importer/**", "tests/library_importer/**", "sql/migrations/19[0-9]_* (only if needed)"],
  ["One transaction per chunk; per-table counts printed; refuse if the SQLite integrity check fails; a second run changes 0 rows.",
   "Tests on the WP0 library fixture; the real file is an owner step: give the exact command in the PR."],
  "Run the importer twice on the fixture: counts match, second run reports 0 changes.",
  PY_CHECKS))

P.append(("L4", "saved_sets_api", "Saved sets endpoints", ["L1", "G3"],
  "Add GET /api/v1/library/sets, PUT and DELETE /api/v1/library/sets/{id} and GET /api/v1/library/sets/export.",
  "The document shape matches the set builder artifact's saved sets (frontend/src/features/musicLibrary/storage.ts shows it). Routers expose register(app) and are discovered by G3.",
  ["services/rest_api/routers/library_sets.py", "services/library/sets/**", "tests/library_sets/**", "sql/migrations/20[0-9]_* (only if needed)"],
  ["Repository on the L1 overlay tables; validation; 404 and 409 handling.", "Export returns the same shape the frontend's storage.ts reads."],
  "TestClient: create, list, replace, delete and export one set.",
  PY_CHECKS))

P.append(("E1", "mb_local_provider", "Local MusicBrainz provider in the enrichment waterfall", ["C1"],
  "Add MusicBrainzLocalProvider, using the local resolver, ahead of the web MusicBrainz provider.",
  "Providers: services/common/providers/base.py (Provider protocol), musicbrainz.py (the web provider), registry.py build_providers(); evidence via datalayer.evidence.record. "
  "ref_mb is a separate read-only database; everything is behind MB_LOCAL_ENABLED (default off). Migrations 160-169 are yours.",
  ["services/common/providers/musicbrainz_local.py", "services/common/providers/registry.py (only the block that builds musicbrainz_local)",
   "sql/migrations/16[0-9]_*", "tests/enrichment_local/test_provider.py", "docs/integration/WP4/**"],
  ["Implement Provider; no network. Fields carry source musicbrainz_local, matched_by, confidence, dump_version, licence (CC0; CC-BY-NC-SA-3.0 for tag-derived genre). Evidence through evidence.record only.",
   "Waterfall seed rows (up/down) placing it before the web provider for mbid, isrc, label, release_date, genre, aliases and external ids, using the existing waterfall configuration mechanism.",
   "Off unless MB_LOCAL_ENABLED is true; tests use a throwaway Postgres built from the real ref_mb column lists, never the real database."],
  "Tests show the provider filling fields from the fixture and doing nothing when MB_LOCAL_ENABLED is unset.",
  PY_CHECKS))

P.append(("SB2", "set_export_dialog", "Set builder: export dialog", ["SB1"],
  "Add an export dialog to the set builder, using the SB1 exporters.",
  "features/setBuilder/exporters.ts (SB1) provides the formats and the missing-field summary.",
  ["frontend/src/features/setBuilder/ExportDialog.tsx", "frontend/src/features/setBuilder/ExportDialog.test.tsx",
   "frontend/src/features/musicLibrary/SetBuilderPage.tsx (one edit: mount the export button)"],
  ["Design-system Dialog: format choice, preview of the first rows, CopyButton, file download; the missing-field summary before export.",
   "Tests: each format selectable; summary shown; download triggered."],
  "On /sets, export a set as M3U8 and see the summary first.",
  FE_CHECKS))

P.append(("SEC6A", "ai_proxy_route", "AI proxy route on the REST API", ["G3"],
  "Add POST /api/v1/ai/complete so AI calls use the server-side encrypted keys instead of keys in the browser.",
  "frontend/src/services/aiService.ts calls Anthropic, OpenAI and Google from the browser with keys in localStorage (Gemini puts the key in the URL). "
  "The backend stores provider keys encrypted (services/rest_api/routers/api_keys.py, API_KEY_ENCRYPTION_SECRET).",
  ["services/rest_api/routers/ai_proxy.py", "services/rest_api/ai_proxy/**", "tests/ai_proxy/**"],
  ["Body {provider: claude|openai|gemini, model, system?, prompt, max_tokens?, web_search?}; response {text, provider, model, usage?}. Keys come from the existing store through api_keys.py's helpers (do not duplicate crypto) and go in headers only.",
   "Limits: provider allowlist, body size cap, max_tokens cap, timeout, bounded concurrency, readable 401/403/429/5xx mapping, no stack traces. Model names configurable; check current provider docs for request shapes.",
   "Tests with mocked provider HTTP: success per provider, missing key, 429, 500, oversized body, timeout, and that no response, log line or exception contains the key."],
  "TestClient call with a fake key returns normalised text; the key never appears in output.",
  PY_CHECKS + " Never print or commit a real key."))

# ---------------- wave 3 ----------------
P.append(("S3", "search_ui_errors", "Music search UI: show the real error", ["S2"],
  "Make the music search box show the API's error message instead of a generic one or an empty result.",
  "frontend/src/components/MusicServiceSearch.tsx calls /api/v1/music-search/{service}; after S2 errors carry detail.code and detail.message.",
  ["frontend/src/components/MusicServiceSearch.tsx (error handling only)", "frontend/src/components/MusicServiceSearch.test.tsx"],
  ["Show detail.message for 424, 502 and 503 with the \"connect in Settings\" hint; keep partial results when one service fails; never show \"No results\" when the cause was an error.",
   "Use the design system's banner or empty-state component; no new CSS."],
  "With no TIDAL credentials, searching shows \"TIDAL is not configured...\" and not an empty list.",
  FE_CHECKS))

P.append(("L3", "library_ingest_api", "Library ingest endpoint on the job framework", ["L2", "G3"],
  "Add POST /api/v1/library/ingest that queues the L2 import as a job, with idempotency.",
  "songnodes has a job queue with idempotency and an outbox (services/common/datalayer: jobs.enqueue, @handler, outbox.append). Use them; do not build another.",
  ["services/library/ingest/**", "services/rest_api/routers/library_ingest.py", "tests/library_ingest/**"],
  ["Idempotency-Key header; jobs.enqueue(kind='library_ingest', ...); a @handler('library_ingest') running the L2 importer logic with per-row results; outbox events in the same transaction as the rows.",
   "Same key and body replays; same key with a different body returns 409.",
   "Failure tests: kill mid-batch (no partial chunk; retry resumes), duplicate row, duplicate request, concurrent identical requests, oversized body."],
  "TestClient: post twice with one key, get one job; post a changed body with the same key, get 409.",
  PY_CHECKS))

P.append(("L5", "library_reconcile", "Library reconciliation report", ["L2"],
  "Report candidate duplicate tracks between the imported library and existing silver. Never merge anything.",
  "Merging is identity.merge_tracks, a human decision. Match by ISRC, by norm_key and, when resolver data is present, by MBID.",
  ["services/library/reconcile/**", "tests/library_reconcile/**"],
  ["A CLI that prints and writes a CSV of candidates with the evidence for each.", "Tests on the fixture with planted duplicates."],
  "The fixture run lists the planted duplicates and changes no rows.",
  PY_CHECKS))

P.append(("E3", "enrichment_replay", "Enrichment replay and coverage report", ["E1", "E2"],
  "Run the library fixture through enrichment twice (local provider off, then on) and report coverage and web calls per field.",
  "E1 adds the local provider; E2 logs web calls. Real data (the owner's resolved items file) is an owner step.",
  ["tests/enrichment_local/replay/**", "docs/integration/WP4/replay.md"],
  ["Replay against recorded or stubbed HTTP; per-field coverage before and after; web calls by provider before and after.",
   "Report every field, including ones that did not improve. Give the exact owner command for the real file."],
  "The replay table is in docs/integration/WP4/replay.md with fixture numbers labelled as fixture.",
  PY_CHECKS))

P.append(("SB3", "set_reorder", "Set builder: reorder tracks", ["SB2"],
  "Add keyboard-accessible move up and move down on each set slot.",
  "Transition checks and the energy wave are exported by features/musicLibrary/setBuilder.ts; reuse them.",
  ["frontend/src/features/setBuilder/reorder.ts", "frontend/src/features/setBuilder/reorder.test.ts",
   "frontend/src/features/musicLibrary/SetBuilderPage.tsx (reorder controls only)"],
  ["Pure reorder helper; buttons on each slot; changes announced via aria-live; energy wave and transition checks recalculated; 0 to 60 tracks.",
   "Keep setBuilder.test.ts passing."],
  "On /sets, move a track up with the keyboard; the transition verdicts update.",
  FE_CHECKS))

P.append(("SEC5", "rest_auth", "REST API: token auth on write and admin routes", ["G3"],
  "Require SONGNODES_API_TOKEN on write and admin REST routes when it is set.",
  "No auth dependency is applied to the REST routers; compose binds to 127.0.0.1, so this is defence in depth locally.",
  ["services/rest_api/security/**", "tests/security/test_rest_auth.py", "services/rest_api/main.py (one line: register_security(app))"],
  ["When the variable is set, require it (Authorization: Bearer or X-API-Token, hmac.compare_digest) on non-GET/HEAD/OPTIONS and on a configurable list of sensitive GET prefixes (api-keys, jobs, datalayer admin). Health, docs and read-only catalog stay open. Unset: unchanged behaviour plus a startup warning.",
   "401 with a generic message; never echo or log the token; simple in-memory limit on repeated 401s.",
   "Do not touch the frontend; document the header."],
  "TestClient: unset = open; set = 401 without or with a wrong token, 200 with the right one; health open.",
  PY_CHECKS))

P.append(("SEC6B", "ai_proxy_client", "AI proxy: frontend client and migration note", ["SEC6A"],
  "Add a typed frontend client for /api/v1/ai/complete and document how pages switch to it.",
  "SEC6A adds the route. aiService.ts and the AI setlists page still call providers directly; they switch in a later package.",
  ["frontend/src/services/aiProxyClient.ts", "frontend/src/services/aiProxyClient.test.ts", "docs/security/ai-proxy.md"],
  ["Client with timeouts and error mapping; do not edit aiService.ts or any page.",
   "Doc: how aiService and the AI setlists page switch over, and how to clear the old localStorage keys."],
  "Unit test with a mocked fetch covers success, 429 and timeout.",
  FE_CHECKS))

WAVES = {
    "1": ["QA2", "QA5", "G1", "G2", "G3", "R1", "R2", "R3", "C1", "C2", "S1", "L1", "E2", "SB1"],
    "2": ["QA1", "QA4", "QA6", "P1", "P2", "P3", "FE9", "S2", "L2", "L4", "E1", "SB2", "SEC6A"],
    "3": ["QA3", "S3", "L3", "L5", "E3", "SB3", "SEC5", "SEC6B"],
    "4": ["DS1", "DS2A", "DS2B", "DS3", "DS4", "DS5", "DS6", "DS8", "DS9", "DS10", "DS11", "DS12", "DS13", "DS14", "DS15"],
}

SLOT = "<!-- SLOT:{c} BEGIN -->\n### {c}: {t}\n- Start: _not started_\n- End: _not finished_\n<!-- SLOT:{c} END -->\n"


def main():
    AGENTS.mkdir(exist_ok=True)
    status = REPO / "STATUS.md"
    s = status.read_text(encoding="utf-8")
    added = []
    for code, slug, title, deps, job, ctx, owned, do, done, checks in P:
        for old in AGENTS.glob(f"{code}_*.md"):
            old.unlink()
        (AGENTS / f"{code}_{slug}.md").write_text(brief(code, title, deps, job, ctx, owned, do, done, checks), encoding="utf-8")
        if f"SLOT:{code} BEGIN" not in s:
            s = s.rstrip("\n") + "\n\n" + SLOT.format(c=code, t=title)
            added.append(code)
    status.write_text(s, encoding="utf-8")
    print(f"{len(P)} briefs written; slots added: {', '.join(added) or 'none'}")


if __name__ == "__main__":
    main()
