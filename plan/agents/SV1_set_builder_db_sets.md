SV1: Set builder: load saved sets from the database

Base: main at BASE_SHA. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md (one job, owned paths only, about 400 changed lines at most, verify then commit, two attempts then stop, rebase before the PR) and CLAUDE.md; the design system rules apply to any UI change. No access to the user's laptop, local data or secrets; work from the repo and fixtures. Open one PR against main titled "SV1: Set builder: load saved sets from the database" on a branch starting with "sv1-"; do not merge it. Edit only the lines inside your own STATUS.md slot (SLOT:SV1 BEGIN/END). Depends on: nothing. If a dependency is not merged on main yet, stop and say so instead of working around it. Never merge or rebuild your branch from an older base: before opening or updating the PR, run `git fetch origin main && git diff --diff-filter=D --name-only origin/main...HEAD`; it must list only your owned paths, otherwise stop and say so (the scope guard fails the PR anyway). New pages register through frontend/src/routes (G2) and new REST routers expose register(app) (G3); never edit App.tsx or services/rest_api/main.py unless your brief owns them.

## Job
Make the Set builder's saved sets come from the database: load them on mount (falling back to this device when the API is down), merge by id, and never create duplicates when the page is reloaded or a set is saved twice.

## Context (verified on main 2026-10-28)
frontend/src/features/musicLibrary/SetBuilderPage.tsx imports readSavedSetsAsync (line 12) but never calls it: state starts from localStorage readSavedSets() (54), the ?open= intake reads readSavedSets() (92) and Export reads readSavedSets() (193). Every change goes through setSaved (70) → writeSavedSetsAsync (frontend/src/features/musicLibrary/data.ts:201-254). That function diffs against a module-level serverSetsCache (176), which only readSavedSetsAsync (178-199) fills; since nothing calls it, after a reload the cache is empty and every set looks new. Sets with a local, non-numeric id (newSetId) are PUT to /api/v1/library/sets/0, which creates a row (services/rest_api/routers/library_ingest.py:28-33 returns {id}); the new id is written back by mutating the object (238), but React state and draft.id keep the old local id, so the next save creates another row. The server stores name, description and tracks only; shape, minutes, mix, pool, seed and tidal live in the local copy. frontend/src/pages/HomePage.tsx:11 also calls readSavedSets(); keep its signature. Tests for these functions are in data.test.ts (SavedSets, from line 81). Design system: read design-system/README.md and the cards in design-system/api/components/ for every component you use; UI copy is en-AU, sentence case, no emoji, missing values an en dash (`sn-none`), numbers, durations and dates through `SN.format`, keys through `SN.camelot`/`keyName`; tokens (`var(--…)`) and `sn-*` classes only, no hex, rgb(), named colours, px font sizes or raw z-index; never `alert`/`confirm`, one primary button per view.

## Owned paths
- frontend/src/features/musicLibrary/SetBuilderPage.tsx
- frontend/src/features/musicLibrary/data.ts (the saved-set functions, lines 150-268, only)
- frontend/src/features/musicLibrary/data.test.ts (the SavedSets tests only)

(Complete list. Anything else is read-only for you. You may also add a dated note under docs/integration/SV1/ if you need to record a decision.)

## Do
1. data.ts: readSavedSetsAsync() returns `{ sets, source: 'server' | 'device' }` (or add a sibling function and keep the old one): on success it merges server rows with local sets by id (server name, description and tracks win; local-only fields kept), keeps local sets whose id is not numeric (never synced) once, fills serverSetsCache and writes the merged list locally.
2. writeSavedSetsAsync() stops mutating its input and resolves to the list with server ids applied (a map local id → server id); a set is created at most once per local id, even if called twice in a row before the first PUT answers (keep a pending map).
3. SetBuilderPage: on mount call the async read and replace state with the merged list; while loading show the device list; if the API is down, a quiet InlineMessage "Saved sets are from this device; the server did not answer." When a save resolves with new ids, update state and draft.id. Use the in-memory `saved` state instead of readSavedSets() at 92 and 193 (the ?open= intake waits until the load finishes).
4. Tests: a reload (fresh module state, server returns sets 1 and 2, local has 1 and a local-only set) yields three sets, no duplicates; saving the same local set twice issues one create; a failed fetch falls back to local; the returned list carries the server id and nothing is mutated.

## Done when (the reviewer's under-10-minute check; put it in the PR)
Open http://127.0.0.1:3006/sets, build a set and press Save set: it appears once under Saved sets. Reload twice: still once, and GET http://127.0.0.1:3006/api/v1/library/sets lists it once. Clear site data for the page and reload: the set comes back from the database. Rename and save again: still one row in the API.

## Checks
`cd frontend && npx tsc --noEmit -p . && npx oxlint src && npx vitest run src && npx vite build` and `PYTHONUTF8=1 bash scripts/sync-design-system.sh --check`. Report failures in files you do not own; do not fix them.

## Hand-back
The one job done, files added/changed/deleted, checks run and not run, the reviewer check, follow-ups.
