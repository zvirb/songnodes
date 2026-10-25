U2: Upgrade services/graph-visualization-api to Python 3.15 and latest requirements

Base: main at BASE_SHA. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md (one job, owned paths only, about 400 changed lines at most, verify then commit, two attempts then stop, rebase before the PR) and CLAUDE.md; the design system rules apply to any UI change. No access to the user's laptop, local data or secrets; work from the repo and fixtures. Open one PR against main titled "U2: Upgrade services/graph-visualization-api to Python 3.15 and latest requirements" on a branch starting with "u2-"; do not merge it. Edit only the lines inside your own STATUS.md slot (SLOT:U2 BEGIN/END). Depends on: nothing. If a dependency is not merged on main yet, stop and say so instead of working around it.

## Job
Move services/graph-visualization-api to Python 3.15 and set its pinned requirements to the latest versions listed below.

## Context (verified on main 2026-10-26)
Part of the running stack (compose.dev.yaml). Base images now: services/graph-visualization-api/Dockerfile: `python:3.11-slim`. Target Python: **3.15**. 

Chosen versions (latest on PyPI when this brief was built):

| File | Package | Now | Target |
|---|---|---|---|
| services/graph-visualization-api/requirements-test.txt | pytest-asyncio | 1.4.0 | **1.4.1** |
| services/graph-visualization-api/requirements.txt | ecdsa | `>=0.19.2` | **0.19.2** (pin it: `==0.19.2`) |
| services/graph-visualization-api/requirements.txt | pytest-asyncio | 1.4.0 | **1.4.1** |
| services/graph-visualization-api/requirements.txt | python-jose | `>=3.5.0` | **3.5.0** (pin it: `==3.5.0`) |
| services/graph-visualization-api/requirements.txt | starlette | 1.9.0 | **1.10.0** |

## Owned paths
- services/graph-visualization-api/Dockerfile (base image and install steps only)
- services/graph-visualization-api/requirements*.txt

(Complete list. Anything else is read-only for you. You may also add a dated note under docs/integration/U2/ if you need to record a decision.)

## Do
1. Change every Python base image you own to `3.15-slim`, keeping its registry prefix (for example `public.ecr.aws/docker/library/python:3.15-slim`).
2. Set each pin in the table to its target. Do not add, remove or loosen other requirements.
3. PyYAML ship no Python 3.15 wheel yet and compile from source: make sure the build stage has a compiler (for example `build-essential`) and that it is not left in the final image if the Dockerfile has a separate runtime stage.
4. For a major version, read the package's changelog and fix only the call sites inside your owned paths; if a needed change is outside them, stop at the last working step and report it.
5. Rebuild the image and run the checks; commit one step at a time.

## Done when (the reviewer's under-10-minute check; put it in the PR)
`docker build` succeeds for services/graph-visualization-api/Dockerfile; the entry module imports inside the image; `python --version` in the image prints 3.15.

## Checks
`docker build` the image(s) you own from the repo root exactly as compose.dev.yaml or the Dockerfile's comments do; inside the image, import the service's entry module; run the service's tests (`python -m pytest` in its folder) if it has any. Report failures in files you do not own; do not fix them.

## Hand-back
The one job done, files added/changed/deleted, checks run and not run, the reviewer check, follow-ups.
