# Repository Guidelines

## Project Structure & Module Organization
Use `frontend/` for the Vite + React client; shared widgets live in `frontend/src/components/` and design tokens in `frontend/src/theme/`. Static assets stay in `frontend/public/`. Python services live under `services/` (e.g., `services/graphql-api/`, `services/rest-api/`), each with a dedicated `Dockerfile` and `requirements.txt`. Data ingestion resides in `musicdb_scrapy/` and `scrapers/`, while automation scripts sit in `scripts/` and deployment manifests in `deployment/`, `k8s/`, and root-level `docker-compose*.yml`. Centralized tests live in `tests/` and `frontend/tests/`, with snapshots and logs archived under `test-results/`.

## Build, Test, and Development Commands
Run `npm run install:all` to hydrate workspace packages, then `pip install -r services/<service>/requirements.txt` before touching a microservice. Start the entire stack with `npm run dev` or `./start-dev.sh`; target the client via `cd frontend && npm run dev`. Ship production bundles using `cd frontend && npm run build && npm run preview`. Validate broadly with `npm run test --workspaces`, or use `make test` / `make test-coverage` to mirror CI. When debugging Playwright flows, execute `npx playwright install` once and then `npm run e2e`.

## Coding Style & Naming Conventions
Follow repo ESLint + Prettier defaults with 2-space indentation. Name TypeScript utilities in `camelCase`, React components in `PascalCase`, and keep Tailwind class chains declarative; extract reused tokens to `frontend/src/theme/`. Python files adhere to PEP 8, `snake_case`, and module-level type hints. Every shell script starts with `#!/usr/bin/env bash` and `set -euo pipefail`.

## Testing Guidelines
Pytest suites live in `tests/unit/` and `tests/integration/`; reuse factories from `tests/utils/`. Uphold ≥90% coverage using `make test-coverage`, and spot-check `tests/reports/coverage-html/index.html` before merging. Frontend work requires `npm run test:unit`, targeted coverage via `npm run test:coverage`, and Playwright checks like `npm run e2e -- --project=chromium`.

## Commit & Pull Request Guidelines
Write Conventional Commits such as `feat(graph): add node clustering toggle`. PRs document motivation, linked tickets, surfaces touched, and verification commands. Attach screenshots or recordings for UI changes, and call out migrations, new env vars, or external API impacts. Confirm blue/green readiness with `npm run maintenance:health` plus `./validate-production-deployment.sh` whenever platform behavior shifts.

## Security & Configuration Tips
Keep secrets in local `.env` files derived from `config/environments/` templates. After editing Docker or Kubernetes assets, run the maintenance scripts above to ensure parity with staging. Archive coverage exports, Playwright traces, and Lighthouse reports under `frontend/test-results/` for follow-up reviews.
