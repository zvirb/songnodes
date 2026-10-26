U3: Upgrade services/worker to Python 3.15 and latest requirements

Base: main at BASE_SHA. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md (one job, owned paths only, about 400 changed lines at most, verify then commit, two attempts then stop, rebase before the PR) and CLAUDE.md; the design system rules apply to any UI change. No access to the user's laptop, local data or secrets; work from the repo and fixtures. Open one PR against main titled "U3: Upgrade services/worker to Python 3.15 and latest requirements" on a branch starting with "u3-"; do not merge it. Edit only the lines inside your own STATUS.md slot (SLOT:U3 BEGIN/END). Depends on: nothing. If a dependency is not merged on main yet, stop and say so instead of working around it.

## Job
Move services/worker to Python 3.15 and set its pinned requirements to the latest versions listed below.

## Context (verified on main 2026-10-26)
Part of the running stack (compose.dev.yaml). Base images now: services/worker/Dockerfile: `python:3.11-slim`. Target Python: **3.15**. neo4j goes from 5 to 6 (major), but no worker code imports it on main (checked 26 Oct); only check the image builds and the Celery app imports.

Chosen versions (latest on PyPI when this brief was built):

| File | Package | Now | Target |
|---|---|---|---|
| services/worker/requirements.txt | neo4j | 5.17.0 | **6.4.1** (major: read its changelog) |

## Owned paths
- services/worker/Dockerfile (base image and install steps only)
- services/worker/requirements*.txt

(Complete list. Anything else is read-only for you. You may also add a dated note under docs/integration/U3/ if you need to record a decision.)

## Do
1. Change every Python base image you own to `3.15-slim`, keeping its registry prefix (for example `public.ecr.aws/docker/library/python:3.15-slim`).
2. Set each pin in the table to its target. Do not add, remove or loosen other requirements.
3. For a major version, read the package's changelog and fix only the call sites inside your owned paths; if a needed change is outside them, stop at the last working step and report it.
4. Rebuild the image and run the checks; commit one step at a time.

## Done when (the reviewer's under-10-minute check; put it in the PR)
`docker build` succeeds for services/worker/Dockerfile; the entry module imports inside the image; `python --version` in the image prints 3.15.

## Checks
`docker build` the image(s) you own from the repo root exactly as compose.dev.yaml or the Dockerfile's comments do; inside the image, import the service's entry module; run the service's tests (`python -m pytest` in its folder) if it has any. Report failures in files you do not own; do not fix them.

## Hand-back
The one job done, files added/changed/deleted, checks run and not run, the reviewer check, follow-ups.
