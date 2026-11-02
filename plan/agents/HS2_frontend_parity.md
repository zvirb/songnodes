HS2: Frontend scoring matches the shared fixture

Base: main at a5c338d. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md (one job, owned paths only, about 400 changed lines at most, verify then commit, two attempts then stop, rebase before the PR) and CLAUDE.md. Open one PR against main titled "HS2: Frontend scoring matches the shared fixture" on a branch starting with "hs2-"; do not merge it. Edit only the lines inside your own STATUS.md slot (SLOT:HS2 BEGIN/END, added at the end of the file if missing). Depends on: HS1 (#497, the fixture `tests/fixtures/harmonic_scoring/examples.json`) and HS3 (#507, design system 1.8.0). Before opening or updating the PR, run `git fetch origin main && git diff --diff-filter=D --name-only origin/main...HEAD`; it must list only your owned paths.

## Job
Implement spec package M6-F2 (docs/specs/HARMONIC_SCORING.md section 4): a vitest parity test that runs the design-system helpers the frontend uses (`SN.compat`, `SN.bpmStep`, `SN.energyStep`, `SN.energyMove`, reached through `frontend/src/lib/songnodes.tsx`) on every row of the shared fixture the Python classifier (`services/common/metadata/transition_scoring.py`) is tested against, and asserts the same key level and label, BPM relation, gap, level and label, and energy move. Design system 1.8.0 carries every owner answer, so there is no expected-differences list. A row that differs is a blocking finding: report it; never change the design system or the fixture here.

## Owned paths
- frontend/src/lib/harmonicScoring.parity.test.ts (new)
- plan/agents/HS2_frontend_parity.md (this brief)
- STATUS.md (slot HS2 only)

(Complete list.)

## Done when (the reviewer's under-10-minute check; put it in the PR)
`cd frontend && npx vitest run src/lib/harmonicScoring.parity.test.ts` passes for all 24 rows; changing any verdict in the fixture makes it fail.

## Checks
`cd frontend && npx tsc --noEmit -p . && npx oxlint src && npx vitest run src && npx vite build`; `PYTHONUTF8=1 bash scripts/sync-design-system.sh --check`; `python3 scripts/check_design_system.py --check`; the scope guard.
