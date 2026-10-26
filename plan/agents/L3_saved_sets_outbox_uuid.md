L3: Saved sets: outbox events with a UUID aggregate id

Base: main at BASE_SHA. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md (one job, owned paths only, about 400 changed lines at most, verify then commit, two attempts then stop, rebase before the PR) and CLAUDE.md; the design system rules apply to any UI change. No access to the user's laptop, local data or secrets; work from the repo and fixtures. Open one PR against main titled "L3: Saved sets: outbox events with a UUID aggregate id" on a branch starting with "l3-"; do not merge it. Edit only the lines inside your own STATUS.md slot (SLOT:L3 BEGIN/END). Depends on: nothing. If a dependency is not merged on main yet, stop and say so instead of working around it. Never merge or rebuild your branch from an older base: before opening or updating the PR, run `git fetch origin main && git diff --diff-filter=D --name-only origin/main...HEAD`; it must list only your owned paths, otherwise stop and say so (the scope guard fails the PR anyway). New pages register through frontend/src/routes (G2) and new REST routers expose register(app) (G3); never edit App.tsx or services/rest_api/main.py unless your brief owns them.

## Job
Make saving a set write a valid outbox event.

## Context (verified on main 2026-10-26)
services/library/model/library_db.py save_set passes the integer library.sets.id (bigserial) to datalayer.outbox.append, whose aggregate_id is UUID NOT NULL (014_data_layer_up.sql line 124), so PUT on the saved-sets endpoint fails with a 500.

## Owned paths
- services/library/model/library_db.py
- tests/library_model/test_saved_sets_outbox.py

(Complete list. Anything else is read-only for you. You may also add a dated note under docs/integration/L3/ if you need to record a decision.)

## Do
1. Derive a stable aggregate id with uuid.uuid5 from a fixed namespace and the set id; put the integer set_id in the event payload too.
2. Use the same id for any other outbox call in this file (delete_set if it emits one); change nothing else.
3. Test with a fake connection: save_set passes a UUID, the same set id always gives the same UUID, and the payload carries set_id.

## Done when (the reviewer's under-10-minute check; put it in the PR)
The test shows a UUID aggregate id that is stable for a given set id.

## Checks
`python -m pytest` for the paths you own, from the repo root. Report failures in files you do not own; do not fix them.

## Hand-back
The one job done, files added/changed/deleted, checks run and not run, the reviewer check, follow-ups.
