QA1: Add an ESLint 9 flat config to the frontend

Depends on: QA2 (both packages edit package-lock.json). Base: main at BASE_SHA. Repo: zvirb/songnodes. Follow AGENTS.md and CLAUDE.md. No access to the user's laptop, local data or secrets; work from the repo and fixtures. Open one PR against main; do not merge it. Edit only the lines inside your own slot in STATUS.md (SLOT:QA1 BEGIN/END): dated start entry, dated end entry with what you built, checks run and not run, and the PR link. Stay inside the owned paths below. Do not edit frontend/src/styles/design-system/ or design-system/. If a check cannot run in your sandbox, say so in the PR.

## Problem
`cd frontend && npx eslint src --ext .ts,.tsx` (npm run lint) exits with "ESLint couldn't find an eslint.config.(js|mjs|cjs) file". eslint is ^9.39.5, which needs a flat config; the repo has none, so lint has never run.
## Owned paths
- frontend/eslint.config.js
- frontend/package.json (devDependencies and scripts only)
- frontend/package-lock.json

(Changed 2026-10-26: no edits in frontend/src. Fixing lint findings across every page would touch files other packages own. Lint fixes per page are separate packages.)
## Do
- Add eslint.config.js for TypeScript + React hooks + react (check which plugins are already in package.json; eslint 10 is NOT supported by eslint-plugin-react, keep eslint at 9).
- Make `npm run lint` run. Set rules that existing code breaks to warn, with a one-line reason each, so lint exits 0. Do not edit source files. Put the count of warnings per rule and per folder in the PR so per-page fix packages can be written.
- Do not add hex colours, px font sizes or other design-system violations.
## Checks
npm ci, npm run type-check, npm run lint, npm run test:unit.
