C2: Remove one-off agent scripts from the repo root

Base: main at BASE_SHA. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md (one job, owned paths only, about 400 changed lines at most, verify then commit, two attempts then stop, rebase before the PR) and CLAUDE.md; the design system rules apply to any UI change. No access to the user's laptop, local data or secrets; work from the repo and fixtures. Open one PR against main titled "C2: Remove one-off agent scripts from the repo root" on a branch starting with "c2-"; do not merge it. Edit only the lines inside your own STATUS.md slot (SLOT:C2 BEGIN/END). Depends on: nothing. If a dependency is not merged on main yet, stop and say so instead of working around it. Never merge or rebuild your branch from an older base: before opening or updating the PR, run `git fetch origin main && git diff --diff-filter=D --name-only origin/main...HEAD`; it must list only your owned paths, otherwise stop and say so (the scope guard fails the PR anyway). New pages register through frontend/src/routes (G2) and new REST routers expose register(app) (G3); never edit App.tsx or services/rest_api/main.py unless your brief owns them.

## Job
Delete the one-off fix and patch scripts that earlier agent sessions left in the repo root, when nothing references them.

## Context (verified on main 2026-10-26)
Earlier sessions committed scratch scripts to the root.

## Owned paths
- fix16.sh
- fix_scrapers_reqs.py
- fix_scrapers_reqs2.py
- fix_test_reqs.py
- fix_test_reqs2.py
- fix_test_reqs3.py
- fix_test_reqs4.py
- patch_package_json.py
- patch_reqs.py
- patch_sec.py
- patch_sec_requirements.py
- patch_sec_workflow.py
- patch_sec_workflow2.py
- patch_sec_workflow3.py
- patch_tests_requirements.py
- .gitignore (one block for root-level patch_*.py and fix_*.py)

(Complete list. Anything else is read-only for you. You may also add a dated note under docs/integration/C2/ if you need to record a decision.)

## Do
1. For each listed file, grep the whole repo (workflows, scripts, docs, compose, Makefiles) for its name.
2. Delete only the unreferenced ones; leave referenced ones and list where they are referenced.
3. Add `/patch_*.py` and `/fix_*.py` to .gitignore under a comment saying why.

## Done when (the reviewer's under-10-minute check; put it in the PR)
The PR lists each file as deleted or kept, with the grep result.

## Checks
`git grep` evidence in the PR; run `python -m pytest tests -q -x --co` to show collection still works.

## Hand-back
The one job done, files added/changed/deleted, checks run and not run, the reviewer check, follow-ups.
