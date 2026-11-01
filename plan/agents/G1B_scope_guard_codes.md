G1B: Scope guard recognises package codes without digits

Base: main at 62795a7. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md (one job, owned paths only, about 400 changed lines at most, verify then commit, two attempts then stop, rebase before the PR) and CLAUDE.md. Open one PR against main titled "G1B: Scope guard recognises package codes without digits" on a branch starting with "g1b-"; do not merge it. Edit only the lines inside your own STATUS.md slot (SLOT:G1B BEGIN/END, added at the end of the file if missing). Depends on: G1 (merged). Never merge or rebuild your branch from an older base: before opening or updating the PR, run `git fetch origin main && git diff --diff-filter=D --name-only origin/main...HEAD`; it must list only your owned paths, otherwise stop and say so.

## Job
Make scripts/scope_guard.py find package codes that have no digits (JOBDATE, JOBSTG), so those PRs are checked instead of passing as "not a work package".

## Context (verified on main 62795a7, 1 Nov 2026)
The guard takes the code from the PR title with `\b([A-Z]{1,4}\d{1,2}[A-Z]?)\b` (fallback: the branch name). JOBDATE (#480, squash commit fc0a8e6) has plan/agents/JOBDATE_jobs_date_span.md, but the guard printed "not a work package" and checked nothing.

## Owned paths
- scripts/scope_guard.py
- tests/scope_guard/** (new test file test_package_code.py)
- plan/agents/G1B_scope_guard_codes.md (this brief)

(Complete list. Anything else is read-only for you. You may also add a dated note under docs/integration/G1B/ if you need to record a decision.)

## Do
1. Take the code as the title prefix before the first colon, `^([A-Z][A-Z0-9]{1,11}):`, when a brief plan/agents/<CODE>_*.md exists for it; otherwise fall back to the current title and branch patterns unchanged.
2. Keep every existing code working (DS24C, U17B, SC2B, M6S, PLAN2, DSQ1A, G1 ...).
3. No false positives: "fix(deps): ..." (lower case) and "PLAN2B: ..." with no brief stay "not a work package"; a JOBDATE brief must not match "JOBDATES:".
4. Tests in tests/scope_guard/: code detection for the above, and an end-to-end JOBDATE repo where an out-of-scope edit fails.

## Done when (the reviewer's under-10-minute check; put it in the PR)
`python scripts/scope_guard.py --base fc0a8e6^ --head fc0a8e6 --title "JOBDATE: GET /api/v1/jobs filters by a created date span" --branch jobdate-jobs-date-span` prints "Scope guard passed." (it printed "not a work package" before), and the same with `--base 50e59b7^ --head 50e59b7 --title "JOBDATE: probe"` fails listing the DS24C files.

## Checks
`python -m pytest tests/scope_guard`; the commands in "Done when"; the guard on this PR itself.

## Hand-back
The one job done, files added/changed/deleted, checks run and not run, the reviewer check, follow-ups.
