QA5: Make sync-design-system.sh work on Windows

Base: main at BASE_SHA. Repo: zvirb/songnodes. Follow AGENTS.md and CLAUDE.md. No access to the user's laptop, local data or secrets; work from the repo and fixtures. Open one PR against main; do not merge it. Edit only the lines inside your own slot in STATUS.md (SLOT:QA5 BEGIN/END): dated start entry, dated end entry with what you built, checks run and not run, and the PR link. Stay inside the owned paths below. Do not edit frontend/src/styles/design-system/ or design-system/. If a check cannot run in your sandbox, say so in the PR.

## Problem
`bash scripts/sync-design-system.sh --check` on Windows crashes with UnicodeDecodeError (cp1252 cannot decode byte 0x8f) because the embedded python reads files with the default locale encoding. With PYTHONUTF8=1 it passes ("design-system 1.1.1: frontend copy in sync").
## Owned paths
scripts/sync-design-system.sh and any python helper it calls. Do NOT touch design-system/ or frontend/src/styles/design-system/.
## Do
- Open every file with encoding="utf-8" (and write with newline handling that does not change bytes), or export PYTHONUTF8=1 inside the script. Check python3 vs python availability on Windows Git Bash.
- Confirm --check still fails when the synced copy drifts (show a test with a temporary change, then revert).
## Checks
bash scripts/sync-design-system.sh --check with and without PYTHONUTF8 set.
