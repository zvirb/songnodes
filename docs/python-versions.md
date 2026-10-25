# Python Version Support Matrix

## Evidence of GPU
The write-up claims GPU/CUDA workloads on Maxwell/Pascal cards (Titan X). However, after full codebase inspection, no `torch`, `tensorflow`, `onnxruntime`, `cuda`, `nvidia` dependencies or device requests were found in Dockerfiles, requirements, Compose, or Helm. The only mention is `GPU acceleration for STFT` in `services/audio-analysis/README.md`. Therefore, **there is no real GPU workload in the repo, so the GPU guidance from the write-up is not applicable**.

## Services & Jobs Table

| Service/Job | Dockerfile | Current Base | Constraints/Pins | Verdict | Evidence |
|---|---|---|---|---|---|
| rest_api | services/rest_api/Dockerfile | python:3.11-slim | | keep 3.11 | No immediate reason to upgrade |
| db-connection-pool | services/db-connection-pool/Dockerfile | public.ecr.aws/docker/library/python:3.11-slim | | keep 3.11 | |
| websocket-api | services/websocket-api/Dockerfile | public.ecr.aws/docker/library/python:3.11-slim | | keep 3.11 | |
| serato-integration | services/serato-integration/Dockerfile | python:3.11-slim | | keep 3.11 | |
| metadata-enrichment | services/metadata-enrichment/Dockerfile | public.ecr.aws/docker/library/python:3.11-slim | | keep 3.11 | |
| metadata-enrichment-worker | services/metadata-enrichment/Dockerfile.worker | python:3.11-slim | | keep 3.11 | |
| api-gateway | services/api-gateway/Dockerfile | node:20 | | not Python | |
| graph-visualization-api | services/graph-visualization-api/Dockerfile | python:3.11-slim | | keep 3.11 | |
| data-validator | services/data-validator/Dockerfile | public.ecr.aws/docker/library/python:3.11-slim | | keep 3.11 | |
| graphql-api | services/graphql-api/Dockerfile | public.ecr.aws/docker/library/python:3.11-slim | | keep 3.11 | |
| nlp-processor | services/nlp-processor/Dockerfile | public.ecr.aws/docker/library/python:3.11-slim | numpy==1.26.4 | keep 3.11 | Has `numpy==1.26.4` which requires `<3.13` and has 3.11 wheels |
| audio-analysis | services/audio-analysis/Dockerfile | python:3.11-slim | librosa==0.10.1, numpy==2.5.4, scipy==1.18.1 | upgrade to 3.12 now | `numpy==2.5.4` requires python >=3.12. Dry-run resolves successfully on 3.12 |
| data-transformer | services/data-transformer/Dockerfile | public.ecr.aws/docker/library/python:3.11-slim | | keep 3.11 | |
| gold-to-operational-etl | services/gold-to-operational-etl/Dockerfile | public.ecr.aws/docker/library/python:3.11-slim | | keep 3.11 | |
| gold_processor | services/Dockerfile.gold_processor | python:3.11-slim | | keep 3.11 | |
| scraper-orchestrator | services/scraper-orchestrator/Dockerfile | public.ecr.aws/docker/library/python:3.11-slim | | keep 3.11 | |
| scraper-orchestrator-enhanced | services/scraper-orchestrator/Dockerfile.enhanced | public.ecr.aws/docker/library/python:3.11-slim | | keep 3.11 | |
| enhanced-visualization-service | services/enhanced-visualization-service/Dockerfile | node:20 | | not Python | |
| enhanced-visualization-service-test | services/enhanced-visualization-service/Dockerfile.test | node:20 | | not Python | |
| api-gateway-internal | services/api-gateway-internal/Dockerfile | python:3.11-slim | | keep 3.11 | |
| browser-collector | services/browser-collector/Dockerfile | python:3.12-slim | | keep 3.12 | Already on 3.12 |
| dlq-manager | services/dlq-manager/Dockerfile | python:3.11-slim | | keep 3.11 | |
| health-monitor | services/health-monitor/Dockerfile | node:20 | | not Python | |
| worker | services/worker/Dockerfile | python:3.11-slim | | keep 3.11 | |
| scrapers | scrapers/Dockerfile | public.ecr.aws/docker/library/python:3.11-slim | | keep 3.11 | |
| scrapers-unified | scrapers/Dockerfile.unified | public.ecr.aws/docker/library/python:3.11-slim | | keep 3.11 | |

## Job mappings

- `raw-data-processor-job`: `postgres:15-alpine` (not Python) and `songnodes_raw-data-processor`
- `silver-to-gold-cronjob`: `postgres:15-alpine` (not Python) and `songnodes_raw-data-processor`
- `gold-to-operational-cronjob`: `postgres:15-alpine` (not Python) and `songnodes_gold-to-operational-etl`
- `data-layer-migrations-job`: `songnodes_worker` (python:3.11-slim)
- `target-track-scraper-cronjob`: `songnodes_scrapers` (python:3.11-slim)

## Follow-up candidates to upgrade to 3.12:
- scrapers
- scrapers-unified
- worker
- raw-data-processor
- gold-to-operational-etl
- metadata-enrichment
- nlp-processor (after resolving `numpy` pinning)

## Dry-run output for audio-analysis on Python 3.12
```
Would install PyYAML-6.0.3 aio-pika-10.1.1 aiormq-7.2.4 annotated-doc-0.0.5 annotated-types-0.8.0 anyio-4.15.1 asyncpg-0.32.0 audioread-3.1.0 certifi-2026.10.23 cffi-2.1.1 charset-normalizer-3.5.2 click-8.5.0 cloudpickle-3.1.2 decorator-5.3.1 fastapi-0.162.0 h11-0.16.0 httpcore-1.0.9 httptools-0.9.0 httpx-0.28.1 idna-3.20 joblib-1.6.0 lazy-loader-0.6 librosa-0.10.1 llvmlite-0.50.0 msgpack-1.2.3 multidict-7.2.1 narwhals-2.27.1 numba-0.68.0 numpy-2.5.4 opentelemetry-api-1.45.1 packaging-26.3 pamqp-4.0.1 platformdirs-4.13.5 pooch-1.9.0 prometheus_client-0.26.0 propcache-0.5.4 psutil-7.2.2 pycparser-3.12 pydantic-2.14.1 pydantic_core-2.50.1 python-dotenv-1.2.4 requests-2.34.2 resampy-0.4.3 scikit-learn-1.9.1 scipy-1.18.1 soundfile-0.14.0 soxr-1.1.0 starlette-1.10.0 threadpoolctl-3.7.0 typing-inspection-0.4.4 typing_extensions-4.16.0 urllib3-2.8.0 uvicorn-0.54.0 uvloop-0.23.0 watchfiles-1.3.0 websockets-17.3 yarl-1.25.1
```
