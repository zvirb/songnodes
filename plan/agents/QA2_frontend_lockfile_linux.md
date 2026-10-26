QA2: Fix frontend lockfile so npm ci works on Linux

Base: main at BASE_SHA. Repo: zvirb/songnodes. Follow AGENTS.md and CLAUDE.md. No access to the user's laptop, local data or secrets; work from the repo and fixtures. Open one PR against main; do not merge it. Edit only the lines inside your own slot in STATUS.md (SLOT:QA2 BEGIN/END): dated start entry, dated end entry with what you built, checks run and not run, and the PR link. Stay inside the owned paths below. Do not edit frontend/src/styles/design-system/ or design-system/. If a check cannot run in your sandbox, say so in the PR.

## Problem
`docker build frontend/` fails at `npm ci` (node:24-alpine): "Missing: @emnapi/core@1.11.3 from lock file", "Missing: @emnapi/runtime@1.11.3 from lock file". The lockfile was generated on Windows and lacks optional/peer entries needed on Linux. This blocks scripts/start-dev.sh and the E2E gate.
## Owned paths
- frontend/package-lock.json
- frontend/package.json (only if a dependency range must change)
- frontend/Dockerfile (only if needed)

## Do
- Regenerate the lockfile so `npm ci` succeeds on Linux and Windows (e.g. install with a Linux node:24 image, or add the missing packages explicitly).
- Confirm `npm ci --no-audit --no-fund && npx tsc --noEmit -p . && npx vitest run src && npx vite build` all pass in a node:24 container.
- Keep eslint at 9.x and typescript at the version in package.json.
## Checks
The commands above, run in a clean container. State that Playwright E2E could not run.
