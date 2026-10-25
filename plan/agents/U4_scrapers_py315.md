U4: Upgrade scrapers to Python 3.15 and latest requirements

Base: main at BASE_SHA. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md (one job, owned paths only, about 400 changed lines at most, verify then commit, two attempts then stop, rebase before the PR) and CLAUDE.md; the design system rules apply to any UI change. No access to the user's laptop, local data or secrets; work from the repo and fixtures. Open one PR against main titled "U4: Upgrade scrapers to Python 3.15 and latest requirements" on a branch starting with "u4-"; do not merge it. Edit only the lines inside your own STATUS.md slot (SLOT:U4 BEGIN/END). Depends on: nothing. If a dependency is not merged on main yet, stop and say so instead of working around it.

## Job
Move scrapers to Python 3.15 and set its pinned requirements to the latest versions listed below.

## Context (verified on main 2026-10-26)
Part of the running stack (compose.dev.yaml). Base images now: scrapers/Dockerfile: `public.ecr.aws/docker/library/python:3.11-slim`; scrapers/Dockerfile.unified: `public.ecr.aws/docker/library/python:3.11-slim`. Target Python: **3.15**. tidalapi constrains python-dateutil (see #115); keep that constraint working.

Chosen versions (latest on PyPI when this brief was built):

| File | Package | Now | Target |
|---|---|---|---|
| scrapers/requirements.txt | scrapy | `>=2.19.0` | **2.19.0** (pin it: `==2.19.0`) |
| scrapers/requirements.txt | psycopg-binary | `>=3.3.6` | **3.3.6** (pin it: `==3.3.6`) |
| scrapers/requirements.txt | asyncpg | `>=0.32.0` | **0.32.0** (pin it: `==0.32.0`) |
| scrapers/requirements.txt | SQLAlchemy | `>=2.1.6` | **2.1.6** (pin it: `==2.1.6`) |
| scrapers/requirements.txt | redis | `>=8.1.0` | **8.1.0** (pin it: `==8.1.0`) |
| scrapers/requirements.txt | pika | `>=1.4.4` | **1.4.4** (pin it: `==1.4.4`) |
| scrapers/requirements.txt | requests | `>=2.34.2` | **2.34.2** (pin it: `==2.34.2`) |
| scrapers/requirements.txt | urllib3 | `>=2.8.0` | **2.8.0** (pin it: `==2.8.0`) |
| scrapers/requirements.txt | brotli | `>=1.2.1` | **1.2.1** (pin it: `==1.2.1`) |
| scrapers/requirements.txt | playwright | `>=1.64.1` | **1.64.1** (pin it: `==1.64.1`) |
| scrapers/requirements.txt | scrapy-playwright | `>=0.0.48` | **0.0.48** (pin it: `==0.0.48`) |
| scrapers/requirements.txt | beautifulsoup4 | `>=4.15.0` | **4.15.0** (pin it: `==4.15.0`) |
| scrapers/requirements.txt | lxml | `>=6.1.3` | **6.1.3** (pin it: `==6.1.3`) |
| scrapers/requirements.txt | PyYAML | `>=6.0.3` | **6.0.3** (pin it: `==6.0.3`) |
| scrapers/requirements.txt | rapidfuzz | `>=3.14.6` | **3.14.6** (pin it: `==3.14.6`) |
| scrapers/requirements.txt | jellyfish | `>=1.3.0` | **1.3.0** (pin it: `==1.3.0`) |
| scrapers/requirements.txt | jsonschema | `>=4.26.0` | **4.26.0** (pin it: `==4.26.0`) |
| scrapers/requirements.txt | pydantic | `>=2.14.1` | **2.14.1** (pin it: `==2.14.1`) |
| scrapers/requirements.txt | fastapi | `>=0.162.0` | **0.162.0** (pin it: `==0.162.0`) |
| scrapers/requirements.txt | uvicorn | `>=0.54.0` | **0.54.0** (pin it: `==0.54.0`) |
| scrapers/requirements.txt | python-dotenv | `>=1.2.4` | **1.2.4** (pin it: `==1.2.4`) |
| scrapers/requirements.txt | python-dateutil | `>=2.8.2,<3.0.0` | **3.0.0** (pin it: `==3.0.0`) |
| scrapers/requirements.txt | psutil | `>=7.2.2` | **7.2.2** (pin it: `==7.2.2`) |
| scrapers/requirements.txt | opentelemetry-api | `>=1.45.1` | **1.45.1** (pin it: `==1.45.1`) |
| scrapers/requirements.txt | opentelemetry-sdk | `>=1.45.1` | **1.45.1** (pin it: `==1.45.1`) |
| scrapers/requirements.txt | opentelemetry-instrumentation | `>=0.66b1` | **0.66b1** (pin it: `==0.66b1`) |
| scrapers/requirements.txt | opentelemetry-exporter-otlp-proto-grpc | `>=1.45.1` | **1.45.1** (pin it: `==1.45.1`) |
| scrapers/requirements.txt | opentelemetry-instrumentation-requests | `>=0.66b1` | **0.66b1** (pin it: `==0.66b1`) |
| scrapers/requirements.txt | opentelemetry-instrumentation-psycopg2 | `>=0.66b1` | **0.66b1** (pin it: `==0.66b1`) |
| scrapers/requirements.txt | opentelemetry-instrumentation-redis | `>=0.66b1` | **0.66b1** (pin it: `==0.66b1`) |
| scrapers/requirements.txt | opentelemetry-instrumentation-asyncpg | `>=0.66b1` | **0.66b1** (pin it: `==0.66b1`) |
| scrapers/requirements.txt | structlog | `>=26.1.0` | **26.1.0** (pin it: `==26.1.0`) |
| scrapers/requirements.txt | loguru | `>=0.7.3` | **0.7.3** (pin it: `==0.7.3`) |
| scrapers/requirements.txt | praw | `>=8.0.3` | **8.0.3** (pin it: `==8.0.3`) |
| scrapers/requirements.txt | tidalapi | `>=0.8.11` | **0.8.11** (pin it: `==0.8.11`) |
| scrapers/requirements.txt | pytest | `>=9.1.1` | **9.1.1** (pin it: `==9.1.1`) |
| scrapers/requirements.txt | pytest-asyncio | `>=1.4.0` | **1.4.1** (pin it: `==1.4.1`) |
| scrapers/requirements.txt | twisted | 26.10.0rc1 | **26.4.0** |
| scrapers/requirements_llm.txt | openai | `>=3.37.0` | **3.37.0** (pin it: `==3.37.0`) |
| scrapers/requirements_llm.txt | anthropic | `>=2.2.0` | **2.3.0** (pin it: `==2.3.0`) |
| scrapers/requirements_llm.txt | beautifulsoup4 | `>=4.15.0` | **4.15.0** (pin it: `==4.15.0`) |
| scrapers/requirements_llm.txt | lxml | `>=6.1.3` | **6.1.3** (pin it: `==6.1.3`) |
| scrapers/requirements_llm.txt | regex | `>=2026.9.29` | **2026.9.29** (pin it: `==2026.9.29`) |
| scrapers/requirements_llm.txt | tiktoken | `>=0.14.0` | **0.14.0** (pin it: `==0.14.0`) |

## Owned paths
- scrapers/Dockerfile (base image and install steps only)
- scrapers/Dockerfile.unified (base image and install steps only)
- scrapers/requirements*.txt

(Complete list. Anything else is read-only for you. You may also add a dated note under docs/integration/U4/ if you need to record a decision.)

## Do
1. Change every Python base image you own to `3.15-slim`, keeping its registry prefix (for example `public.ecr.aws/docker/library/python:3.15-slim`).
2. Set each pin in the table to its target. Do not add, remove or loosen other requirements.
3. PyYAML ship no Python 3.15 wheel yet and compile from source: make sure the build stage has a compiler (for example `build-essential`) and that it is not left in the final image if the Dockerfile has a separate runtime stage.
4. For a major version, read the package's changelog and fix only the call sites inside your owned paths; if a needed change is outside them, stop at the last working step and report it.
5. Rebuild the image and run the checks; commit one step at a time.

## Done when (the reviewer's under-10-minute check; put it in the PR)
`docker build` succeeds for scrapers/Dockerfile, scrapers/Dockerfile.unified; the entry module imports inside the image; `python --version` in the image prints 3.15.

## Checks
`docker build` the image(s) you own from the repo root exactly as compose.dev.yaml or the Dockerfile's comments do; inside the image, import the service's entry module; run the service's tests (`python -m pytest` in its folder) if it has any. Report failures in files you do not own; do not fix them.

## Hand-back
The one job done, files added/changed/deleted, checks run and not run, the reviewer check, follow-ups.
