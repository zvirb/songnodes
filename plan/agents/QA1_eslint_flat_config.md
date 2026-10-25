QA1: Add an ESLint 9 flat config to the frontend

Base: main at BASE_SHA. Repo: zvirb/songnodes. Follow AGENTS.md and CLAUDE.md. No access to the user's laptop, local data or secrets; work from the repo and fixtures. Open one PR against main; do not merge it. Edit only the lines inside your own slot in STATUS.md (SLOT:QA1 BEGIN/END): dated start entry, dated end entry with what you built, checks run and not run, and the PR link. Stay inside the owned paths below. Do not edit frontend/src/styles/design-system/ or design-system/. If a check cannot run in your sandbox, say so in the PR.

## Problem
`cd frontend && npx eslint src --ext .ts,.tsx` (npm run lint) exits with "ESLint couldn't find an eslint.config.(js|mjs|cjs) file". eslint is ^9.39.5, which needs a flat config; the repo has none, so lint has never run.
## Owned paths
frontend/eslint.config.js, frontend/package.json (devDependencies and scripts only), frontend/package-lock.json, and minimal fixes to lint errors in frontend/src.
## Do
- Add eslint.config.js for TypeScript + React hooks + react (check which plugins are already in package.json; eslint 10 is NOT supported by eslint-plugin-react, keep eslint at 9).
- Make `npm run lint` pass; fix real errors, downgrade noisy rules to warn with a one-line reason each. Do not mass-disable.
- Do not add hex colours, px font sizes or other design-system violations.
## Checks
npm ci, npm run type-check, npm run lint, npm run test:unit.
