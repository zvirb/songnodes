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

FE_CHECKS = ("`cd frontend && npm ci && npx tsc --noEmit -p . && npx oxlint src && npx vitest run src && npx vite build` (Node 26, TypeScript 7, "
             "Oxlint; see frontend/LINTING.md). Lint must not get worse in files you touch. "
             "Report failures in files you do not own; do not fix them. Playwright cannot run in your sandbox; say so.")
PY_CHECKS = "`python -m pytest` for the paths you own, from the repo root. Report failures in files you do not own; do not fix them."


def header(code, title, deps):
    dep = ", ".join(deps) if deps else "nothing"
    return f"""{code}: {title}

Base: main at BASE_SHA. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md (one job, owned paths only, about 400 changed lines at most, verify then commit, two attempts then stop, rebase before the PR) and CLAUDE.md; the design system rules apply to any UI change. No access to the user's laptop, local data or secrets; work from the repo and fixtures. Open one PR against main titled "{code}: {title}" on a branch starting with "{code.lower()}-"; do not merge it. Edit only the lines inside your own STATUS.md slot (SLOT:{code} BEGIN/END). Depends on: {dep}. If a dependency is not merged on main yet, stop and say so instead of working around it. Never merge or rebuild your branch from an older base: before opening or updating the PR, run `git fetch origin main && git diff --diff-filter=D --name-only origin/main...HEAD`; it must list only your owned paths, otherwise stop and say so (the scope guard fails the PR anyway). New pages register through frontend/src/routes (G2) and new REST routers expose register(app) (G3); never edit App.tsx or services/rest_api/main.py unless your brief owns them.
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
  "services/common/datalayer/handlers.py. PR #136 (ecdfe4a) deleted all of it and reverted the handlers.py lines. The graph page has no projected data without it. "
  "Note: handlers.py now also has a bottom-of-file library_ingest import from PR #158; preserve it.",
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
  "services/rest_api/main.py is 774 lines with explicit include_router calls; routers/library_search.py and routers/library_ingest.py (PR #158) already use a register(app) function (main.py lines 758-763). Note that legacy routers like routers/catalog_writes.py import from main at module load time.",
  ["services/rest_api/router_registry.py", "services/rest_api/main.py (one call to the registry after the existing includes; nothing else)",
   "tests/rest_api/test_router_registry.py"],
  ["router_registry.register_all(app): scan services/rest_api/routers/*.py; skip any module already imported/included by main.py (or check AST for a top-level `def register` before importing so legacy routers that import `main` are never re-imported); call register(app) once for each new router in module-name order; log each.",
   "An import error fails fast with a message naming the module (a hidden missing router is worse than a failed start).",
   "Leave the existing explicit includes (including library_search and library_ingest) exactly as they are."],
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

# L1-L4 were superseded by PR #158 (WP5 merged whole). They are now one-job repairs of that code (plan/RESTRUCTURE.md 1.1).
P.append(("L1", "importer_evidence_fields", "Library importer: write only allowed evidence fields", [],
  "Make the library importer record evidence only under field names the evidence table accepts.",
  "PR #158's services/library/importer/import_library.py (around line 50) records evidence for 'label' and 'release_year'. "
  "silver_track_metadata_evidence.field has a CHECK (sql/migrations/014_data_layer_up.sql line 78) that allows bpm, key, energy, isrc, duration_ms, "
  "mix_name, genre, record_label, tidal_id, deezer_id and musicbrainz_id, so an import with either field fails the whole transaction.",
  ["services/library/importer/import_library.py", "tests/library_importer/**"],
  ["Record the source's 'label' as 'record_label'.",
   "Do not record 'release_year' as evidence (there is no such field); count it as skipped in the returned stats and log it once per run. Do not change the CHECK.",
   "Test with a fake connection: a track with label and release_year records record_label, skips release_year, and every recorded field is in the allowed list."],
  "The test lists the fields the importer records for a fully populated fixture track; all are in the CHECK list.",
  PY_CHECKS))

P.append(("L2", "reconcile_view_mbid", "Reconciliation view: read MusicBrainz ids from musicbrainz_id", [],
  "Fix library.v_reconciliation_report so its MBID column reads the evidence field that exists.",
  "Migration 181 (PR #158) joins silver_track_metadata_evidence on field = 'mbid'; the allowed name is 'musicbrainz_id', so the column is always empty. "
  "181 may already be applied somewhere, so do not edit it; replace the view in a new migration.",
  ["sql/migrations/185_reconcile_view_mbid_up.sql", "sql/migrations/185_reconcile_view_mbid_down.sql", "tests/library_model/test_reconcile_view_sql.py"],
  ["185 up: CREATE OR REPLACE VIEW library.v_reconciliation_report with field = 'musicbrainz_id'; otherwise identical columns and filter.",
   "185 down: restore 181's definition exactly.",
   "Test: parse both files; up references musicbrainz_id and not 'mbid'; down equals 181's view body. If your sandbox can start Postgres, also apply 014, 101, 181, 185 up and down."],
  "The view SQL in 185 differs from 181 only in the evidence field name.",
  PY_CHECKS))

P.append(("L3", "saved_sets_outbox_uuid", "Saved sets: outbox events with a UUID aggregate id", [],
  "Make saving a set write a valid outbox event.",
  "services/library/model/library_db.py save_set passes the integer library.sets.id (bigserial) to datalayer.outbox.append, whose aggregate_id is UUID NOT NULL "
  "(014_data_layer_up.sql line 124), so PUT on the saved-sets endpoint fails with a 500.",
  ["services/library/model/library_db.py", "tests/library_model/test_saved_sets_outbox.py"],
  ["Derive a stable aggregate id with uuid.uuid5 from a fixed namespace and the set id; put the integer set_id in the event payload too.",
   "Use the same id for any other outbox call in this file (delete_set if it emits one); change nothing else.",
   "Test with a fake connection: save_set passes a UUID, the same set id always gives the same UUID, and the payload carries set_id."],
  "The test shows a UUID aggregate id that is stable for a given set id.",
  PY_CHECKS))

P.append(("L4", "start_dev_migrations", "start-dev applies the migrations added since 26 Oct", ["L2"],
  "Make scripts/start-dev.sh apply migrations 170, 180-185 and 220 safely on new and existing volumes.",
  "start-dev.sh applies a fixed list (012, 013, 014, 101 once, 240). Migrations merged on 26 Oct are never applied: 170 web_call_log (E2), 180-184 library "
  "(PR #158), 185 (L2) and 220 graph projection consumer (R3). 180 and 184 use IF NOT EXISTS / OR REPLACE; 182 and 183 do not (183 is a no-op comment).",
  ["scripts/start-dev.sh"],
  ["Apply each in number order after 101 and before 240, with ON_ERROR_STOP like the existing lines.",
   "Guard any that is not idempotent the same way 101 is guarded (check for the object first); never drop or rewrite existing rows.",
   "Keep the rest of the script unchanged."],
  "Running start-dev.sh twice on an existing volume succeeds both times, and `\\d web_call_log` plus `SELECT * FROM outbox_consumers` show the new objects "
  "(the reviewer runs this on the laptop; say in the PR that your sandbox could not).",
  "`bash -n scripts/start-dev.sh` and shellcheck if available. Docker is not available in your sandbox; say so."))

P.append(("L6", "library_import_script", "Script: import the musicLibrary SQLite into the running stack", ["L1", "L3", "L4"],
  "Add scripts/import-music-library.sh, which loads one musicLibrary SQLite file into the running dev stack through the existing importer.",
  "The owner's weekly DJ library refresh writes E:\\musicLibrary\\db\\dj_library.sqlite on the laptop. services/library/importer (PR #158) reads that SQLite and "
  "posts it to POST /api/v1/library/ingest with Idempotency-Key "
  "import-<md5 of the file>, so the same file never imports twice. Nothing runs it yet, so the Library page shows an empty library.",
  ["scripts/import-music-library.sh", "docs/library-import.md"],
  ["Usage: `bash scripts/import-music-library.sh <path-to-dj_library.sqlite>`. Refuse with a clear message if the file is missing or the rest-api "
   "service is not healthy (`docker compose -f compose.dev.yaml ps`).",
   "docker cp the file into the rest-api container under /tmp, run `python -m library.importer --sqlite /tmp/<name> --api-url http://localhost:8082/api/v1/library/ingest` there (rest-api listens on 8082 inside its container, see services/rest_api/Dockerfile; the importer's default 8080 is wrong) with "
   "`docker compose -f compose.dev.yaml exec -T`, then remove the copy. Never mount or write the owner's folder.",
   "Poll GET /api/v1/jobs for the returned job id until it succeeds or fails (bounded, with a message naming what it waited for); print the "
   "result counts; exit non-zero on failure. Append one dated line to a log file given by --log (optional).",
   "docs/library-import.md: what it does, how to run it, and a one-line Windows Task Scheduler entry (Git Bash) to run it weekly after the refresh."],
  "On the laptop, running the script twice with the same SQLite file creates one ingest job and the second run reports it as already imported; "
  "/library then shows the library's track count (the reviewer runs this; say in the PR that your sandbox could not).",
  "`bash -n scripts/import-music-library.sh` and shellcheck if available. Docker is not available in your sandbox; say so."))

P.append(("SB4", "saved_sets_per_set_api", "Set builder: save and delete sets through the per-set API", ["L3"],
  "Make the Set builder save, list and delete sets through the saved-sets endpoints as the backend defines them.",
  "frontend/src/features/musicLibrary/data.ts writeSavedSetsAsync sends PUT /api/v1/library/sets with the whole list, but the backend "
  "(services/rest_api/routers/library_ingest.py, PR #158) only has GET /api/v1/library/sets, PUT and DELETE /api/v1/library/sets/{set_id} "
  "(set_id is an integer, library.sets.id). The PUT fails, the page saves to localStorage only, and on reload GET returns the database's list, "
  "so saved sets vanish. The frontend's SavedSet.id is a string.",
  ["frontend/src/features/musicLibrary/data.ts", "frontend/src/features/musicLibrary/data.test.ts"],
  ["Save one set with PUT /api/v1/library/sets/{id} and delete with DELETE; map the API's integer id to and from SavedSet.id in data.ts only.",
   "If the API is unreachable or answers an error, show that honestly through the existing error path instead of silently keeping a local-only copy; "
   "keep localStorage only as the documented offline cache it already is.",
   "Unit test with a mocked fetch: save, list after reload, delete, and an API error."],
  "With QA7's fixture, `bash scripts/e2e-docker.sh sets` passes: a saved set survives a reload and can be deleted.",
  FE_CHECKS))

# ---------------- wave 5: input & search intelligence primitives ----------------
P.append(("UX1", "search_history_storage", "Search history: recent queries storage", [],
  "Add a pure, typed utility to record and retrieve recent searches per context in localStorage.",
  "Search inputs in LibraryPage, Pathfinder, MusicServiceSearch and QuickSearch currently have no shared recent query memory. The design system SearchField component anticipates recent query suggestions.",
  ["frontend/src/utils/recentSearches.ts", "frontend/src/utils/recentSearches.test.ts"],
  ["Implement saveRecentSearch(namespace: string, query: string, maxItems = 10) and getRecentSearches(namespace: string): string[] in recentSearches.ts.",
   "Use key prefix 'sn-recent-' + namespace; trim whitespace, deduplicate case-insensitively, keep most recent at index 0, cap at maxItems; handle localStorage errors and SSR gracefully.",
   "Add clearRecentSearches(namespace: string) and removeRecentSearch(namespace: string, query: string).",
   "Unit tests covering: empty query ignored, trimming, case-insensitive deduplication, FIFO capping at max, removal of individual items, clear all, and quota error fallback."],
  "`npx vitest run src/utils/recentSearches.test.ts` passes with 100% coverage.",
  FE_CHECKS))

P.append(("UX2", "favorite_queries_storage", "Favorite queries: starred queries and filter preset storage", [],
  "Add a pure, typed utility to store, toggle, and retrieve starred queries and filter presets in localStorage.",
  "DJs repeatedly apply the same complex filter combinations (e.g. specific BPM range, Camelot keys, and rotation status) or search for recurring labels/artists without a quick recall mechanism.",
  ["frontend/src/utils/favoriteQueries.ts", "frontend/src/utils/favoriteQueries.test.ts"],
  ["Implement FavoriteItem<T> interface { id: string; label: string; payload: T; createdAt: number }.",
   "Implement getFavorites<T>(namespace: string): FavoriteItem<T>[], saveFavorite<T>(namespace: string, item: Omit<FavoriteItem<T>, 'id' | 'createdAt'>): FavoriteItem<T>, removeFavorite(namespace: string, id: string), isFavorite(namespace: string, label: string): boolean.",
   "Store under key prefix 'sn-favs-' + namespace with JSON serialization and schema guards.",
   "Unit tests: adding a favorite, duplicate prevention, removal, custom payload retrieval, invalid JSON recovery."],
  "`npx vitest run src/utils/favoriteQueries.test.ts` passes.",
  FE_CHECKS))

P.append(("UX3", "lexicon_autocomplete_engine", "Lexicon autocomplete: prefix trie and token completion", [],
  "Add a lightweight, pure TypeScript prefix trie / token completion engine for fast in-memory search.",
  "Typing into filter boxes or search inputs should complete words (artists, genres, Camelot keys 1A-12B, labels, pillars) instantly without network latency or external dependencies.",
  ["frontend/src/utils/lexiconTrie.ts", "frontend/src/utils/lexiconTrie.test.ts"],
  ["Implement LexiconTrie class with insert(word: string, category?: string, weight?: number), insertBatch(words: string[]), searchPrefix(prefix: string, limit = 8): { word: string; category?: string }[], clear().",
   "Normalize case, strip punctuation, rank exact prefix matches first, then weighted frequency (e.g. play count / rotation).",
   "Include built-in Camelot key vocabulary (1A-12B) and standard Melbourne music pillars.",
   "Unit tests: empty prefix, case-insensitive match, limit capping, rank order, special characters, batch insertion performance (<5ms for 5,000 words)."],
  "`npx vitest run src/utils/lexiconTrie.test.ts` passes.",
  FE_CHECKS))

P.append(("UX4", "ds_autocomplete_search_field", "Design system: AutocompleteSearchField component", ["UX1", "UX3"],
  "Add AutocompleteSearchField to frontend design-system components, extending SearchField with keyboard-navigable listbox completions.",
  "design-system/components/SearchField specifies SearchFieldProps and behaviour, but lacks an accessible popup combobox list for recent searches and word completions.",
  ["frontend/src/components/ds/AutocompleteSearchField.tsx", "frontend/src/components/ds/AutocompleteSearchField.test.tsx",
   "frontend/src/components/ds/index.tsx (export AutocompleteSearchField)"],
  ["Implement AutocompleteSearchField: wraps SearchField markup with role=\"combobox\", aria-expanded, aria-controls, aria-autocomplete=\"list\".",
   "Render a floating sn-menu / sn-card dropdown with tokens when focused: section for 'Recent searches' (from UX1) if empty/prefix match, section for 'Suggestions' (from lexicon/trie or items prop).",
   "Keyboard navigation: ArrowDown/ArrowUp moves active option (aria-activedescendant), Enter selects, Escape closes and retains focus, Tab closes.",
   "Export AutocompleteSearchField from frontend/src/components/ds/index.tsx with strict design-system token styling and sn-* classes.",
   "Tests: renders without crash; keyboard navigation moves selection; Enter selects word; Escape closes; recent searches section renders."],
  "`npx vitest run src/components/ds/AutocompleteSearchField.test.tsx` passes.",
  FE_CHECKS))

# ---------------- wave 6: contextual autocomplete across pages ----------------
P.append(("UX5", "crate_filter_autocomplete", "Crate FilterRail: search autocompletion and recent queries", ["UX4"],
  "Integrate AutocompleteSearchField into CrateFilterRail with live vocabulary from the loaded crate tracks.",
  "frontend/src/features/musicLibrary/components/CrateFilterRail.tsx renders a standard input for search. It already extracts unique tags and sources from loaded tracks, but provides no autocompletion while typing.",
  ["frontend/src/features/musicLibrary/components/CrateFilterRail.tsx",
   "frontend/src/features/musicLibrary/components/CrateFilterRail.test.tsx"],
  ["Build a local LexiconTrie from tracks: index artist names, track titles, tags, and source names whenever tracks change.",
   "Replace the raw input with AutocompleteSearchField using namespace 'library-crate'.",
   "Display recent queries on focus; show completed word suggestions as user types.",
   "Preserve the existing debounce, keyboard shortcuts (/), and live match count.",
   "Tests: typing prefix displays matching artists and tags; selecting suggestion updates query; clear button resets."],
  "Open /library, click filter search or press /: typing 'bic' suggests 'Bicep', selecting it filters the crate table.",
  FE_CHECKS))

P.append(("UX6", "pathfinder_autocomplete", "Pathfinder: waypoint autocompletion for start and end tracks", ["UX4", "P1"],
  "Add track title and artist autocompletion to the start and end track inputs in the route finder page.",
  "frontend/src/features/pathfinder/PathfinderPage.tsx requires selecting start and end tracks. Currently users must type track titles manually or search without inline completion.",
  ["frontend/src/features/pathfinder/PathfinderPage.tsx",
   "frontend/src/features/pathfinder/PathfinderPage.test.tsx"],
  ["Replace raw text inputs for start and destination tracks with AutocompleteSearchField using namespace 'pathfinder-waypoints'.",
   "Populate suggestions from useUnifiedTracks() track catalogue.",
   "Selecting a track binds its track ID and updates the waypoint selection state.",
   "Tests: typing in start track input suggests matching library tracks; selecting a track sets the start point."],
  "Open /paths: typing a track prefix in start or end field shows matching tracks and sets waypoint on selection.",
  FE_CHECKS))

P.append(("UX7", "music_service_search_history", "Music service search: query history and suggestion chips", ["UX1", "S3"],
  "Add recent search chips and clearable query history to MusicServiceSearch.",
  "frontend/src/components/MusicServiceSearch.tsx enables searching TIDAL and Spotify. When DJs search for tracks to target, they frequently query the same artist or label names.",
  ["frontend/src/components/MusicServiceSearch.tsx",
   "frontend/src/components/MusicServiceSearch.test.tsx"],
  ["Connect search submission to recentSearches with namespace 'music-service'.",
   "Render a row of recent search chips (FilterChip style) beneath the search bar when the query is empty.",
   "Clicking a chip executes the search immediately; quiet 'Clear history' button clears the list.",
   "Tests: executed search adds to recent list; clicking recent chip triggers search; clear history removes chips."],
  "In MusicServiceSearch: after searching 'Mall Grab', returning to empty search displays 'Mall Grab' chip; clicking it re-executes search.",
  FE_CHECKS))

P.append(("UX8", "quick_search_palette", "QuickSearch dialog: recent commands and track completions", ["UX1", "UX3"],
  "Add recent search memory and module route completions to the QuickSearch dialog.",
  "frontend/src/components/QuickSearch.tsx provides app-wide Cmd/Ctrl+K search, but starts blank without recent navigation history or keyword suggestions.",
  ["frontend/src/components/QuickSearch.tsx",
   "frontend/src/components/QuickSearch.test.tsx"],
  ["Store and display recently opened tracks, modules, and setlists using recentSearches under namespace 'quick-search'.",
   "Provide keyword prefix suggestions for navigation shortcuts (e.g. 'lib' -> /library, 'set' -> /sets, 'har' -> /harmony).",
   "Maintain full keyboard accessibility (ArrowDown/Up, Enter, Esc).",
   "Tests: opening QuickSearch shows recent items; typing filters options; selecting navigation item redirects."],
  "Press Cmd/Ctrl+K: recent items appear; typing 'set' selects /sets route.",
  FE_CHECKS))

# ---------------- wave 7: target track intelligence & auto-suggestions ----------------
P.append(("TG1", "target_suggestions_endpoint", "Target tracks: suggestions endpoint based on crate and graph gaps", ["G3"],
  "Add GET /api/v1/target-tracks/suggestions to the REST API, returning prioritized candidates for discovery and scraping.",
  "services/rest_api/routers/target_tracks.py only lists and creates target tracks. When the target queue is empty, background scrapers have zero work. Silver library tracks with high rotation or missing graph adjacencies are prime candidates.",
  ["services/rest_api/routers/target_tracks.py", "services/rest_api/target_suggestions.py",
   "tests/rest_api/test_target_suggestions.py"],
  ["Implement target_suggestions.py: query candidate tracks from silver and graph projection.",
   "Scoring rules: priority given to tracks played on >=2 Melbourne shows, tracks with 0 existing target/scrape records, and tracks in camelot keys with low graph edge density.",
   "Endpoint GET /api/v1/target-tracks/suggestions?limit=20 returning: [{ title, artist, genres, rationale, priority_score }].",
   "Honest error handling: 503 if DB pool uninitialized, empty list if no silver tracks exist.",
   "Tests: mock database pool returning sample silver records; verify rationale generation and priority ordering."],
  "GET /api/v1/target-tracks/suggestions returns JSON array of suggested tracks with rationale (e.g. 'Heard on 3 shows').",
  PY_CHECKS))

P.append(("TG2", "target_suggestions_hook", "Target suggestions: frontend data hook and actions", ["TG1"],
  "Add useTargetSuggestions hook with fetch, dismiss, and promote-to-target actions.",
  "Frontend components need a typed, resilient data hook to query suggested target tracks and convert them into actual targets via api.post('/target-tracks').",
  ["frontend/src/hooks/useTargetSuggestions.ts", "frontend/src/hooks/useTargetSuggestions.test.ts"],
  ["Create useTargetSuggestions() hook: state for suggestions, loading, error, and dismissedIds.",
   "Functions: promoteSuggestion(suggestion) (POSTs to /api/v1/target-tracks and removes from suggestion list), dismissSuggestion(id) (persists to sn-dismissed-suggestions).",
   "Graceful fallback: if endpoint returns 404 or backend down, set honest error state without crashing.",
   "Tests: successful load, promoteSuggestion calls API and updates local state, dismissSuggestion persists to local storage."],
  "`npx vitest run src/hooks/useTargetSuggestions.test.ts` passes.",
  FE_CHECKS))

P.append(("TG3", "target_suggestions_deck", "TargetTracksManager: suggested tracks discovery rail", ["TG2"],
  "Mount a 'Suggested for Discovery' card carousel in TargetTracksManager with one-click '+ Add Target' buttons.",
  "frontend/src/components/TargetTracksManager.tsx displays a table of targets, but has no discovery mechanism when the list is sparse.",
  ["frontend/src/components/TargetTracksManager.tsx", "frontend/src/components/TargetTracksManager.test.tsx"],
  ["Mount a horizontal card deck above or alongside the target table when suggestions exist.",
   "Each card shows: Track title, Artist, Rationale pill (e.g. 'Played on 3 shows'), '+ Add Target' button (sn-btn--quiet sn-btn--sm), and 'Dismiss' button.",
   "Clicking '+ Add Target' calls promoteSuggestion with optimistic feedback and announces via aria-live.",
   "Empty/error state: if no suggestions available, render nothing or polite empty indicator without layout jump.",
   "Tests: suggestions render in deck; clicking '+ Add' promotes track to target list; dismissing card removes it from view."],
  "Open /sources/targets: suggested tracks appear in deck; clicking '+ Add' moves track into target table.",
  FE_CHECKS))

P.append(("TG4", "library_crate_discovery_banner", "Library: crate target-enrichment discovery banner", ["TG2", "FE9"],
  "Add an enrichment opportunity banner to LibraryPage when crate tracks are not yet in the target queue.",
  "DJs exploring crates in LibraryPage frequently spot un-enriched tracks. A banner informing them of high-rotation un-targeted tracks bridges crate browsing with crawler enrichment.",
  ["frontend/src/features/musicLibrary/targetAction/DiscoveryBanner.tsx",
   "frontend/src/features/musicLibrary/targetAction/DiscoveryBanner.test.tsx",
   "frontend/src/features/musicLibrary/LibraryPage.tsx (one edit: mount banner)"],
  ["Create DiscoveryBanner component using design system Banner pattern (sn-banner).",
   "Show count of tracks in the current view that lack BPM/key or graph adjacencies and are not yet targeted.",
   "Provide 'Target top un-enriched' quick action (invokes setTrackAsTarget in batch up to 5 tracks) and a dismiss button.",
   "Mount inside LibraryPage between keyed-coverage banner and the data table.",
   "Tests: banner renders when un-targeted tracks present; action triggers batch targeting; dismiss hides banner."],
  "Open /library with un-targeted tracks: banner appears; clicking action targets them and updates coverage.",
  FE_CHECKS))

# ---------------- wave 8: workflow velocity & dj transitions ----------------
P.append(("FL1", "keyboard_power_nav", "Keyboard navigation: table row selection and quick actions", ["UX4"],
  "Add keyboard navigation (J/K row navigation, Space preview, T add to target) for the crate table.",
  "Professional DJs use keyboard shortcuts for rapid library curation without reaching for the mouse.",
  ["frontend/src/hooks/useTableKeyboardNav.ts", "frontend/src/hooks/useTableKeyboardNav.test.ts"],
  ["Create useTableKeyboardNav({ rowCount, onSelectRow, onAction }): handles J/Down (next), K/Up (prev), Enter (select/open), T (target action).",
   "Ignore shortcuts when focus is inside text fields, inputs, or dialogs.",
   "Maintain visual active row styling and ARIA active descendant.",
   "Tests: pressing J moves active index down; K moves up; input focus suppresses navigation."],
  "`npx vitest run src/hooks/useTableKeyboardNav.test.ts` passes.",
  FE_CHECKS))

P.append(("FL2", "set_transition_suggestions", "Set builder: harmonic and energy transition suggestions", ["SB3"],
  "Add pure transition matching utility and 'Suggest Next Track' drawer in SetBuilderPage.",
  "frontend/src/features/musicLibrary/SetBuilderPage.tsx calculates transition checks, but cannot proactively suggest the next compatible track from the library.",
  ["frontend/src/features/setBuilder/transitions.ts", "frontend/src/features/setBuilder/transitions.test.ts",
   "frontend/src/features/musicLibrary/SetBuilderPage.tsx (suggest next track action)"],
  ["transitions.ts: findCompatibleTracks(currentTrack, candidateTracks, options): scores candidates by Camelot key distance (same, +/-1 step, or relative major/minor), BPM delta (+/- 4%), and smooth energy progression.",
   "In SetBuilderPage: add 'Suggest next' button on empty slot or below last track.",
   "Opens a compact popover listing the top 5 compatible tracks from the crate with compatibility badges ('Key match 8A', 'BPM +1.2%').",
   "Clicking a candidate slots it directly into the set.",
   "Tests: key compatibility scoring handles edge cases (12A -> 1A); BPM tolerance filtering; slotting track updates set."],
  "On /sets with a track in slot 1: clicking 'Suggest next' lists harmonically compatible crate tracks; clicking one adds it to slot 2.",
  FE_CHECKS))

P.append(("FL3", "crate_filter_presets", "Crate filter presets: save and recall favorite filter views", ["UX2", "UX5"],
  "Add saved filter preset chips to CrateFilterRail using favoriteQueries storage.",
  "DJs need to save recurring filter combinations (e.g. 'Opening Warmup 118-122', 'Peak Acid Techno') and recall them in one click.",
  ["frontend/src/features/musicLibrary/components/FilterPresets.tsx",
   "frontend/src/features/musicLibrary/components/FilterPresets.test.tsx",
   "frontend/src/features/musicLibrary/components/CrateFilterRail.tsx (mount presets section)"],
  ["FilterPresets component: displays saved preset chips using FilterChip component and a '+ Save current filters' button.",
   "Clicking a preset applies its CrateFilters state immediately and updates URL search params.",
   "Preset chips carry an overflow/delete action to remove saved presets.",
   "Tests: saving current filters creates preset; clicking preset updates filters; deleting removes preset."],
  "In /library: customize filters, click '+ Save preset', name it 'Warmup': chip appears; resetting filters and clicking 'Warmup' restores state.",
  FE_CHECKS))

P.append(("FL4", "instant_audio_preview_strip", "Design system: MiniAudioPreview component", [],
  "Add accessible MiniAudioPreview component for 30-second track audio preview with play/pause and progress.",
  "Curation and set-building require listening to snippets of tracks without navigating away or opening external music players.",
  ["frontend/src/components/ds/MiniAudioPreview.tsx", "frontend/src/components/ds/MiniAudioPreview.test.tsx"],
  ["MiniAudioPreview: compact inline player (32px height) with play/pause button (SnIcon play/pause), time display, and mini progress bar using design-system tokens.",
   "Audio element lifecycle: stop playback on unmount, handle missing or 404 preview URLs with quiet disabled state.",
   "Global singleton audio manager ensuring only one preview plays at a time across the entire application.",
   "Tests: play/pause state toggle; time update; unmount cleans up audio instance; graceful error when audio fails to load."],
  "`npx vitest run src/components/ds/MiniAudioPreview.test.ts` passes.",
  FE_CHECKS))

WAVES = {
    "1a": ["G1", "G2", "G3"],
    "1b": ["QA5", "R1", "R2", "R3", "C1", "C2", "S1", "E2", "SB1"],
    "1": ["QA5", "G1", "G2", "G3", "R1", "R2", "R3", "C1", "C2", "S1", "E2", "SB1"],
    "2": ["QA4", "QA6", "P1", "P2", "P3", "FE9", "S2", "E1", "SB2", "SEC6A", "L1", "L2", "L3", "QA7"],
    "3": ["QA3", "S3", "L4", "L5", "L6", "SB4", "E3", "SB3", "SEC5", "SEC6B"],
    # runtime upgrades (plan/build_upgrade_prompts.py): send "up" after wave 1b is merged and verified; "up-legacy" after "up" is merged.
    # U7 (Postgres 18) is held: send only with --only. L1-L4 are now repairs of the PR #158 code (waves 2 and 3). U8 (Actions pins) is in wave 4 because waves 1-3 edit workflows.
    "up": ["U1", "U2", "U3", "U4", "U5"],
    "up-legacy": ["U6", "U9", "U10", "U11", "U12", "U13", "U14", "U15", "U16", "U17", "U18", "U19", "U20", "U21", "U22", "U23", "U24", "U25", "U26", "U27", "U28", "U29"],
    "4": ["U8", "DS1", "DS2A", "DS2B", "DS3", "DS4", "DS5", "DS6", "DS8", "DS9", "DS10", "DS11", "DS12", "DS13", "DS14", "DS15"],
    "5": ["UX1", "UX2", "UX3", "UX4"],
    "6": ["UX5", "UX6", "UX7", "UX8"],
    "7": ["TG1", "TG2", "TG3", "TG4"],
    "8": ["FL1", "FL2", "FL3", "FL4"],
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
