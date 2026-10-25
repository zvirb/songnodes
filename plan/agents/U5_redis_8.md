U5: Upgrade Redis to 8.10 in the dev stack

Base: main at BASE_SHA. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md (one job, owned paths only, about 400 changed lines at most, verify then commit, two attempts then stop, rebase before the PR) and CLAUDE.md; the design system rules apply to any UI change. No access to the user's laptop, local data or secrets; work from the repo and fixtures. Open one PR against main titled "U5: Upgrade Redis to 8.10 in the dev stack" on a branch starting with "u5-"; do not merge it. Edit only the lines inside your own STATUS.md slot (SLOT:U5 BEGIN/END). Depends on: nothing. If a dependency is not merged on main yet, stop and say so instead of working around it.

## Job
Move the compose Redis service from redis:7-alpine to redis:8.10-alpine.

## Context (verified on main 2026-10-26)
Redis 8.10.2 is the latest release (17 Sep 2026). Redis 8 reads Redis 7 RDB/AOF files, so the existing volume carries over. compose.dev.yaml is shared: change only the redis service block.

## Owned paths
- compose.dev.yaml (the redis service block only)
- docs/upgrades/redis-8.md

(Complete list. Anything else is read-only for you. You may also add a dated note under docs/integration/U5/ if you need to record a decision.)

## Do
1. Change the image to redis:8.10-alpine; keep the volume, command and healthcheck unless 8.x requires a change (say which).
2. Start redis 7 with a key written, switch to 8.10 on the same volume in your sandbox, and show the key survives.
3. Write docs/upgrades/redis-8.md: what changed and how the owner checks it.

## Done when (the reviewer's under-10-minute check; put it in the PR)
The PR shows the key surviving the 7 to 8.10 switch on the same volume.

## Checks
`docker compose -f compose.dev.yaml config` passes; the volume test above.

## Hand-back
The one job done, files added/changed/deleted, checks run and not run, the reviewer check, follow-ups.
