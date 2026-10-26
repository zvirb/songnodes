E2: Log every outbound enrichment call

Base: main at BASE_SHA. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md (one job, owned paths only, about 400 changed lines at most, verify then commit, two attempts then stop, rebase before the PR) and CLAUDE.md; the design system rules apply to any UI change. No access to the user's laptop, local data or secrets; work from the repo and fixtures. Open one PR against main titled "E2: Log every outbound enrichment call" on a branch starting with "e2-"; do not merge it. Edit only the lines inside your own STATUS.md slot (SLOT:E2 BEGIN/END). Depends on: nothing. If a dependency is not merged on main yet, stop and say so instead of working around it. Never merge or rebuild your branch from an older base: before opening or updating the PR, run `git fetch origin main && git diff --diff-filter=D --name-only origin/main...HEAD`; it must list only your owned paths, otherwise stop and say so (the scope guard fails the PR anyway). New pages register through frontend/src/routes (G2) and new REST routers expose register(app) (G3); never edit App.tsx or services/rest_api/main.py unless your brief owns them.

## Job
Add web_call_log: a table and a thin wrapper that records every outbound enrichment HTTP call, without changing existing providers.

## Context (verified on main 2026-10-26)
WP4's goal is to count the web calls the local MusicBrainz data makes unnecessary. Providers live in services/common/providers/ (base.py defines the Provider protocol). Migrations 170-179 are yours.

## Owned paths
- services/common/providers/web_call_log.py
- sql/migrations/17[0-9]_*
- tests/enrichment_local/test_web_call_log.py

(Complete list. Anything else is read-only for you. You may also add a dated note under docs/integration/E2/ if you need to record a decision.)

## Do
1. Table: provider, endpoint, field, run id, timestamp, status, duration (up and down migrations).
2. A wrapper that can be attached to a provider's HTTP session in tests and, later, in the waterfall; no edits to existing provider files.
3. MusicBrainz web fallback rule recorded in the wrapper docs: 1 request per second and a descriptive User-Agent.

## Done when (the reviewer's under-10-minute check; put it in the PR)
The test attaches the wrapper to a fake provider and shows one row per call.

## Checks
`python -m pytest` for the paths you own, from the repo root. Report failures in files you do not own; do not fix them.

## Hand-back
The one job done, files added/changed/deleted, checks run and not run, the reviewer check, follow-ups.
