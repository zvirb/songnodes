# Repository Guidelines

## Project Structure & Module Organization
- `services/` contains microservices; Python APIs (e.g., `services/rest-api` FastAPI) live alongside Node gateways (`services/api-gateway`) and supporting workers (transformer, validator). Keep tests in `services/*/tests`.
- `frontend/` hosts the React + Vite client; source lives in `frontend/src`, shared UI docs in `frontend/docs`, and Playwright specs under `frontend/tests`.
- `scripts/` exposes operational tooling such as `run_integration_tests.sh`, `health_check.sh`, and deployment helpers; use them as orchestration entry points.
- `sql/` defines database schema and seeds, while `docs/` provides architecture and deployment references; shared datasets live in `data/` and reusable configs in `config/` and `common/`.

## Build, Test, and Development Commands
- Spin up core services with `docker compose up -d postgres redis rest-api api-gateway`; use `docker-compose.test.yml` when isolating pipelines.
- Run backend suites via `./scripts/run_integration_tests.sh` or targeted `pytest tests -m integration`; coverage reports land in `tests/reports/`.
- Frontend development runs on `npm run dev --prefix frontend`; build via `npm run build --prefix frontend` and preview with `npm run preview --prefix frontend`.
- Quality gates: `npm run lint --prefix frontend` for linting and `npm test --prefix services/api-gateway` for gateway unit coverage.

## Coding Style & Naming Conventions
- Python modules follow PEP 8 with 4-space indentation and type hints; format with `black` before pushing and keep async coroutines verb-based (e.g., `fetch_track_graph`).
- Node/TypeScript code uses ES modules, 2-space indentation, and camelCase exports; ESLint configs live beside each service and match React practices.
- Use kebab-case for Docker Compose service identifiers and snake_case for SQL tables and columns (see `sql/init/*.sql`).

## Testing Guidelines
- Default to Pytest markers (`unit`, `integration`, `e2e`, `slow`) defined in `pytest.ini`; exclude `slow` unless required and note marker rationale in the PR.
- Ensure Playwright specs pass with `npm run test:e2e --prefix frontend`; attach screenshots from `frontend/playwright-report/` when changes affect UI flow.
- Regenerate coverage artifacts or HTML reports before submitting, and clean up transient fixtures under `tests/utils` to keep CI deterministic.

## Commit & Pull Request Guidelines
- Use Conventional Commits (`commitlint.config.js`) with lowercase types and an approved scope, e.g., `feat(rest-api): add enriched track adjacency`.
- Branch from `develop`, reference related issues, and bundle command outputs (tests, lint) in the PR description; include screenshots for UI changes and link dashboards for ops updates.
- Request review once health checks pass (`./scripts/health_check.sh`) and call out any feature flags or config toggles touched in `config/` or `secrets/`.
