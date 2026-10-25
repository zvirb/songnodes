G1: Scope guard: fail PRs that touch files outside their package

Base: main at BASE_SHA. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md (one job, owned paths only, about 400 changed lines at most, verify then commit, two attempts then stop, rebase before the PR) and CLAUDE.md; the design system rules apply to any UI change. No access to the user's laptop, local data or secrets; work from the repo and fixtures. Open one PR against main titled "G1: Scope guard: fail PRs that touch files outside their package" on a branch starting with "g1-"; do not merge it. Edit only the lines inside your own STATUS.md slot (SLOT:G1 BEGIN/END). Depends on: nothing. If a dependency is not merged on main yet, stop and say so instead of working around it.

## Job
Add a CI check that fails a work-package PR when it adds, changes or deletes files outside the owned paths in its brief.

## Context (verified on main 2026-10-26)
Several merged PRs deleted other packages' merged work: #93 deleted the FE1 bridge; #136 (a CI fix) deleted FE3, WP8 and more (about 3,700 lines). Briefs in plan/agents/<CODE>_*.md each have a "## Owned paths" bullet list (one path or glob per bullet; text after the path in brackets is commentary).

## Owned paths
- .github/workflows/scope-guard.yml
- scripts/scope_guard.py
- tests/scope_guard/**

(Complete list. Anything else is read-only for you. You may also add a dated note under docs/integration/G1/ if you need to record a decision.)

## Do
1. scripts/scope_guard.py (stdlib only): args --base, --head, --title, --branch. Package code = first match of `\b([A-Z]{1,4}\d{1,2}[A-Z]?)\b` in the title, else the leading code in the branch name (case-insensitive). No code or no matching brief: print "not a work package" and exit 0.
2. Read owned globs from the brief (strip backticks and anything from the first space followed by a bracket). Always allowed: STATUS.md (only inside SLOT:<CODE>) and docs/integration/<CODE>/**.
3. `git diff --name-status base...head`: fail if any added/modified file is not owned, if STATUS.md changes outside the slot, and loudly if any deleted file is not owned (list each one). Write a markdown table to $GITHUB_STEP_SUMMARY when set.
4. Workflow on pull_request with fetch-depth 0, passing the PR title and head ref.
5. Tests on a temporary git repo: in-scope pass; out-of-scope edit fails; out-of-scope delete fails; STATUS edit outside slot fails; no code passes; `**` globs match nested files.

## Done when (the reviewer's under-10-minute check; put it in the PR)
Run `python scripts/scope_guard.py --base ecdfe4a^ --head ecdfe4a --title "R2: test" --branch r2-test` and show that it fails and lists the deleted files outside features/pathfinder.

## Checks
`python -m pytest tests/scope_guard`; the command in "Done when".

## Hand-back
The one job done, files added/changed/deleted, checks run and not run, the reviewer check, follow-ups.
