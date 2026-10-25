U26: Upgrade services/api-gateway to Node 26 and latest npm dependencies

Base: main at BASE_SHA. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md (one job, owned paths only, about 400 changed lines at most, verify then commit, two attempts then stop, rebase before the PR) and CLAUDE.md; the design system rules apply to any UI change. No access to the user's laptop, local data or secrets; work from the repo and fixtures. Open one PR against main titled "U26: Upgrade services/api-gateway to Node 26 and latest npm dependencies" on a branch starting with "u26-"; do not merge it. Edit only the lines inside your own STATUS.md slot (SLOT:U26 BEGIN/END). Depends on: nothing. If a dependency is not merged on main yet, stop and say so instead of working around it.

## Job
Move services/api-gateway to Node 26 and set its npm dependencies to the latest versions listed below.

## Context (verified on main 2026-10-26)
Not in compose.dev.yaml (not part of the running stack). Base images now: services/api-gateway/Dockerfile: `public.ecr.aws/docker/library/node:18-alpine`.

| Section | Package | Now | Target |
|---|---|---|---|
| dependencies | http-proxy-middleware | `4.2.0` | **^4.2.1** |

## Owned paths
- services/api-gateway/Dockerfile (base image lines only)
- services/api-gateway/package.json
- services/api-gateway/package-lock.json

(Complete list. Anything else is read-only for you. You may also add a dated note under docs/integration/U26/ if you need to record a decision.)

## Do
1. Change every Node base image you own to `node:26-alpine`, keeping its registry prefix.
2. Set each dependency to its target and regenerate package-lock.json with `npm install` on Linux (npm 12).
3. For a major version, fix only call sites inside your owned paths; otherwise stop and report.
4. Build the image and run the package's own test script if it has one.

## Done when (the reviewer's under-10-minute check; put it in the PR)
`docker build` succeeds; `node --version` in the image prints v26.

## Checks
`npm ci && npm test` (if a test script exists) in the folder; `docker build` of each owned Dockerfile.

## Hand-back
The one job done, files added/changed/deleted, checks run and not run, the reviewer check, follow-ups.
