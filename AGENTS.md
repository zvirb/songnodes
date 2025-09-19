# Repository Guidelines

## Project Structure & Module Organization
The `frontend/` workspace hosts the Vite + React client, with reusable UI in `frontend/src/components/` and static assets in `frontend/public/`. Python microservices live under `services/`, such as `services/graphql-api/` and `services/rest-api/`, each with its own `Dockerfile` and `requirements.txt`. Data ingestion resides in `musicdb_scrapy/` and `scrapers/`, while automation scripts sit in `scripts/` and deployment manifests in `deployment/`. Testing and infrastructure assets are split between `tests/`, `frontend/tests/`, `config/`, `docker-compose*.yml`, and `k8s/`.

## Build, Test, and Development Commands
Hydrate dependencies with `npm run install:all`, then `pip install -r services/<service>/requirements.txt` before editing a service. Start the full stack using `npm run dev` or `./start-dev.sh`; develop the client via `cd frontend && npm run dev`. Run a repo-wide sweep with `npm run test --workspaces`, or use `make test` / `make test-coverage` to align with CI. Frontend flows rely on `cd frontend && npm run build`, `npm run preview`, and Playwright suites via `npm run e2e` after `npx playwright install`.

## Coding Style & Naming Conventions
TypeScript follows repo ESLint rules, enforces 2-space indentation, `camelCase` utilities, and `PascalCase` components. Keep Tailwind class chains declarative; extract shared tokens into `frontend/src/theme/`. Python services follow PEP 8, `snake_case`, descriptive docstrings, and type hints at module boundaries. Shell scripts begin with `#!/usr/bin/env bash` and `set -euo pipefail`.

## Testing Guidelines
Use Pytest with suites in `tests/unit/` and `tests/integration/`; reuse factories from `tests/utils/`. Maintain ≥90% coverage via `make test-coverage` and inspect `tests/reports/coverage-html/index.html` before merging. Frontend features demand `npm run test:unit`, targeted coverage via `npm run test:coverage`, and accessibility or E2E passes (`npm run e2e -- --project=chromium`).

## Commit & Pull Request Guidelines
Write Conventional Commits like `feat(graph): add node clustering toggle`. PRs should document motivation, affected surfaces, linked tickets, and verification commands. Attach UI captures for frontend shifts and flag migrations, env var changes, or external API updates. Confirm blue/green readiness with `npm run maintenance:health` and `./validate-production-deployment.sh` after platform tweaks.

## Security & Configuration Tips
Keep secrets in local `.env` files referencing `config/environments/` templates. After editing Docker or Kubernetes assets, validate parity with staging using the provided maintenance scripts. Archive coverage, Playwright traces, and Lighthouse results under `frontend/test-results/` when they inform reviews.
