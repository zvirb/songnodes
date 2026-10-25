U6: Upgrade RabbitMQ to 4.3 in the dev stack

Base: main at BASE_SHA. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md (one job, owned paths only, about 400 changed lines at most, verify then commit, two attempts then stop, rebase before the PR) and CLAUDE.md; the design system rules apply to any UI change. No access to the user's laptop, local data or secrets; work from the repo and fixtures. Open one PR against main titled "U6: Upgrade RabbitMQ to 4.3 in the dev stack" on a branch starting with "u6-"; do not merge it. Edit only the lines inside your own STATUS.md slot (SLOT:U6 BEGIN/END). Depends on: nothing. If a dependency is not merged on main yet, stop and say so instead of working around it.

## Job
Move the compose RabbitMQ service from rabbitmq:3.13-alpine to rabbitmq:4.3-alpine by the officially supported upgrade path.

## Context (verified on main 2026-10-26)
RabbitMQ 3.13 lost community support in Sep 2024; 4.3.7 is the latest (19 Oct 2026). RabbitMQ requires all stable feature flags enabled before a 3.13 to 4.x upgrade, and may not allow skipping minor series. compose.dev.yaml is shared: change only the rabbitmq service block.

## Owned paths
- compose.dev.yaml (the rabbitmq service block only)
- docs/upgrades/rabbitmq-4.md

(Complete list. Anything else is read-only for you. You may also add a dated note under docs/integration/U6/ if you need to record a decision.)

## Do
1. Read the official RabbitMQ upgrade docs and state the supported path from 3.13 in the PR (direct, or through intermediate series).
2. Change the image to rabbitmq:4.3-alpine. If a direct jump on the existing volume is not supported, use a new named volume for 4.3 and document that queues start empty (the outbox in Postgres replays durable work); never delete the old volume.
3. Write docs/upgrades/rabbitmq-4.md with the exact owner steps (enable feature flags on 3.13 first if needed).
4. Test the path in your sandbox: publish to a durable queue on 3.13, upgrade, and show the result.

## Done when (the reviewer's under-10-minute check; put it in the PR)
The PR states the supported path and shows the sandbox upgrade result.

## Checks
`docker compose -f compose.dev.yaml config` passes; the sandbox upgrade above.

## Hand-back
The one job done, files added/changed/deleted, checks run and not run, the reviewer check, follow-ups.
