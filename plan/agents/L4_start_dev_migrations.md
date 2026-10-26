L4: start-dev applies the migrations added since 26 Oct

Base: main at BASE_SHA. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md (one job, owned paths only, about 400 changed lines at most, verify then commit, two attempts then stop, rebase before the PR) and CLAUDE.md; the design system rules apply to any UI change. No access to the user's laptop, local data or secrets; work from the repo and fixtures. Open one PR against main titled "L4: start-dev applies the migrations added since 26 Oct" on a branch starting with "l4-"; do not merge it. Edit only the lines inside your own STATUS.md slot (SLOT:L4 BEGIN/END). Depends on: L2. If a dependency is not merged on main yet, stop and say so instead of working around it. Never merge or rebuild your branch from an older base: before opening or updating the PR, run `git fetch origin main && git diff --diff-filter=D --name-only origin/main...HEAD`; it must list only your owned paths, otherwise stop and say so (the scope guard fails the PR anyway). New pages register through frontend/src/routes (G2) and new REST routers expose register(app) (G3); never edit App.tsx or services/rest_api/main.py unless your brief owns them.

## Job
Make scripts/start-dev.sh apply migrations 170, 180-185 and 220 safely on new and existing volumes.

## Context (verified on main 2026-10-26)
start-dev.sh applies a fixed list (012, 013, 014, 101 once, 240). Migrations merged on 26 Oct are never applied: 170 web_call_log (E2), 180-184 library (PR #158), 185 (L2) and 220 graph projection consumer (R3). 180 and 184 use IF NOT EXISTS / OR REPLACE; 182 and 183 do not (183 is a no-op comment).

## Owned paths
- scripts/start-dev.sh

(Complete list. Anything else is read-only for you. You may also add a dated note under docs/integration/L4/ if you need to record a decision.)

## Do
1. Apply each in number order after 101 and before 240, with ON_ERROR_STOP like the existing lines.
2. Guard any that is not idempotent the same way 101 is guarded (check for the object first); never drop or rewrite existing rows.
3. Keep the rest of the script unchanged.

## Done when (the reviewer's under-10-minute check; put it in the PR)
Running start-dev.sh twice on an existing volume succeeds both times, and `\d web_call_log` plus `SELECT * FROM outbox_consumers` show the new objects (the reviewer runs this on the laptop; say in the PR that your sandbox could not).

## Checks
`bash -n scripts/start-dev.sh` and shellcheck if available. Docker is not available in your sandbox; say so.

## Hand-back
The one job done, files added/changed/deleted, checks run and not run, the reviewer check, follow-ups.
