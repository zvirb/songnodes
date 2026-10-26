L3: Library ingest endpoint on the job framework

Base: main at BASE_SHA. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md (one job, owned paths only, about 400 changed lines at most, verify then commit, two attempts then stop, rebase before the PR) and CLAUDE.md; the design system rules apply to any UI change. No access to the user's laptop, local data or secrets; work from the repo and fixtures. Open one PR against main titled "L3: Library ingest endpoint on the job framework" on a branch starting with "l3-"; do not merge it. Edit only the lines inside your own STATUS.md slot (SLOT:L3 BEGIN/END). Depends on: L2, G3. If a dependency is not merged on main yet, stop and say so instead of working around it.

## Job
Add POST /api/v1/library/ingest that queues the L2 import as a job, with idempotency.

## Context (verified on main 2026-10-26)
songnodes has a job queue with idempotency and an outbox (services/common/datalayer: jobs.enqueue, @handler, outbox.append). Use them; do not build another.

## Owned paths
- services/library/ingest/**
- services/rest_api/routers/library_ingest.py
- tests/library_ingest/**

(Complete list. Anything else is read-only for you. You may also add a dated note under docs/integration/L3/ if you need to record a decision.)

## Do
1. Idempotency-Key header; jobs.enqueue(kind='library_ingest', ...); a @handler('library_ingest') running the L2 importer logic with per-row results; outbox events in the same transaction as the rows.
2. Same key and body replays; same key with a different body returns 409.
3. Failure tests: kill mid-batch (no partial chunk; retry resumes), duplicate row, duplicate request, concurrent identical requests, oversized body.

## Done when (the reviewer's under-10-minute check; put it in the PR)
TestClient: post twice with one key, get one job; post a changed body with the same key, get 409.

## Checks
`python -m pytest` for the paths you own, from the repo root. Report failures in files you do not own; do not fix them.

## Hand-back
The one job done, files added/changed/deleted, checks run and not run, the reviewer check, follow-ups.
