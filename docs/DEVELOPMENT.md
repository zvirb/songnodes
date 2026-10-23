# Development baseline

This is the first increment of the architecture migration: a small, real database
and API workflow for frontend development. It does not deploy the full platform.
See [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) for the complete migration plan.

The inactive Wave option is hidden by default. `VITE_ENABLE_WAVE_ROUTING=true`
reveals it for development only; this does not implement wave routing. Keep the
flag unset for users until milestone 6 is validated. Vite reads this variable at
startup/build time, so changes require restarting or rebuilding the frontend.

## Prerequisites

- Docker Engine and Docker Compose v2 (supporting `up --wait`)
- Node.js 22.12+ (validated with 24.19) and npm
- Bash, curl, and, in the Codex proxy environment, Python 3 and getent

Use the existing checkout. In Codex cloud, files remain in the cloud; no laptop
drive space is required. For a Windows checkout, use `D:\` as requested and run
these commands through WSL with Docker integration.

## Start

From the repository root:

```bash
bash scripts/start-dev.sh
cd frontend
npm ci
npm run dev -- --host 127.0.0.1
```

The startup script builds API images and starts PostgreSQL 16, Redis 7, REST on
loopback port 8082, and the graph API on loopback port 8084. Vite uses port 3006
and proxies API requests to those backends. The script supports the cloud's
existing proxy and CA certificate without disabling verification.

The development database is private to this Compose network and has no published
port. It uses trust authentication for development only. Never use this Compose
file on a shared or production network. Redis also has no published port.

The dedicated `songnodes-dev_dev-postgres` volume is initialized from the existing
bronze, silver, and transition migrations. It starts empty; no production data or
external provider credentials are required. Initialization scripts run only when
the volume is first created. Existing volumes are preserved by the startup script.
Schema changes to an existing volume require explicit migrations, not a reset.

## Verify

With Vite running:

```bash
curl --fail http://127.0.0.1:8082/health
curl --fail http://127.0.0.1:8084/api/graph/data
cd frontend
npm run build
npm run type-check
npm run test:unit
node scripts/smoke-dev.mjs
```

The smoke test requires Playwright Chromium (`npx playwright install chromium`).
Where a system Chromium is already installed, use:

```bash
CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium node scripts/smoke-dev.mjs
```

The smoke test inserts two explicitly synthetic tracks and one directed transition
into the development database, checks their IDs and transition weight through the
Vite proxy, and verifies that React renders a graph canvas without browser
exceptions. It removes its records in a cleanup block. It does not mock API data.
If the process is forcibly killed, test records may remain; their artist is
`Smoke Test Artist`.

This baseline does not validate catalog CRUD, legacy graph routes, OAuth, external
music services, scraping, or the complete medallion pipeline. The initial graph
endpoint uses the silver schema; some legacy endpoints still require older
operational tables. Type checking and the 33 frontend unit tests pass after the
milestone-1 cleanup. The archived renderer is type checked but its runtime behavior
has not been validated. Do not treat a passing build as a passing type check.

## Stop and inspect

```bash
docker compose -f compose.dev.yaml ps
docker compose -f compose.dev.yaml logs --tail 100 graph-api rest-api
docker compose -f compose.dev.yaml stop
```

Stop Vite with Ctrl+C. Stopping services retains database contents. Avoid
`down -v` unless intentionally deleting this development database.
