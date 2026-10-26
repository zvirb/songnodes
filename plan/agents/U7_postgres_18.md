U7: Prepare the Postgres 18 upgrade (owner runs it)

Base: main at BASE_SHA. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md (one job, owned paths only, about 400 changed lines at most, verify then commit, two attempts then stop, rebase before the PR) and CLAUDE.md; the design system rules apply to any UI change. No access to the user's laptop, local data or secrets; work from the repo and fixtures. Open one PR against main titled "U7: Prepare the Postgres 18 upgrade (owner runs it)" on a branch starting with "u7-"; do not merge it. Edit only the lines inside your own STATUS.md slot (SLOT:U7 BEGIN/END). Depends on: nothing. If a dependency is not merged on main yet, stop and say so instead of working around it.

## Job
Prepare the move from postgres:16-alpine to postgres:18-alpine (18.6) without touching the existing data volume.

## Context (verified on main 2026-10-26)
Postgres data files are not compatible across major versions: the 16 volume cannot be opened by 18. The project rule is never to reset the Postgres volume (CLAUDE.md). The owner runs the migration; this package prepares and proves it.

## Owned paths
- compose.dev.yaml (the postgres service block and its volume declaration only)
- scripts/upgrade-postgres-18.sh
- docs/upgrades/postgres-18.md

(Complete list. Anything else is read-only for you. You may also add a dated note under docs/integration/U7/ if you need to record a decision.)

## Do
1. compose: postgres:18-alpine on a NEW named volume (for example dev-postgres-18). Keep the old volume declared so it is never removed.
2. scripts/upgrade-postgres-18.sh: dump from the running 16 container (pg_dumpall), start 18 on the new volume, restore, run the migrations check, print row counts of the main tables before and after. Idempotent; refuses if the new volume already has data; never deletes anything.
3. docs/upgrades/postgres-18.md: the owner steps, how to verify, and how to roll back (switch compose back to 16 and the old volume).
4. Prove it in your sandbox with the repo fixtures: 16 with data, run the script, 18 with the same counts.

## Done when (the reviewer's under-10-minute check; put it in the PR)
The PR shows before/after counts from the sandbox run. Merge only after the owner has run the script on the laptop.

## Checks
`bash -n scripts/upgrade-postgres-18.sh`; `docker compose -f compose.dev.yaml config`; the sandbox run.

## Hand-back
The one job done, files added/changed/deleted, checks run and not run, the reviewer check, follow-ups.
