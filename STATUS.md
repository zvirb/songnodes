# Implementation status

## Current task

Checkpoint: reviewed the work completed so far for a local Git commit requested
by the user. Includes development startup, frontend TypeScript cleanup and
regression tests, the documented architecture/wave plan, feature gate, and task
tracking. Next task: broader REST and legacy graph workflow validation.

Maintained plan: [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md).

Started: 2026-10-24 (Australia/Sydney).

## Progress

- Inspected the checkout; no existing STATUS.md or AGENTS.md was found.
- Earlier baseline: frontend production build passes; type checking reports 124 errors; browser graph requests fail without backend services.
- Added a minimal development Compose stack for PostgreSQL, Redis, graph API, and REST API.
- Fixed graph async pool configuration, Redis cleanup/auth defaults, shared-module Docker copy path, and transition queries to match the checked-in occurrence_count schema.
- Restricted timestamp injection to production builds, fixing the Vite client __BASE__ exception.
- Frontend initial loading now uses the combined silver-schema graph endpoint.
- A real database/API/browser smoke test passes and cleans up its temporary records.
- Current task started: record reproducible commands and verify startup repeatability and the production build.
- Added AGENTS.md to preserve the requirement to update this file for every task.
- Unified shared DJ/catalog track and API-key types, corrected DJ mode values and graph selection calls, and added an explicit REST-to-client path adapter.
- Added missing XState/D3 runtime dependencies and Vitest/Three/D3 type dependencies with an updated npm lockfile.
- Updated disabled renderer and reference-example types for current PIXI APIs; that archived renderer remains outside live runtime validation.
- Added focused path conversion and slotted-button regression tests and a `test:unit` script.
- Documented all eight milestones, decisions, dependencies, and exit criteria in docs/IMPLEMENTATION_PLAN.md, linked from README.md and AGENTS.md.
- Added ordered real-set fixtures, canonical 1–10 energy/bands/provenance, energy search facets, contextual wave routing and shadow validation, move-coloured edges/wave chart, and multi-method audio calibration against user library ratings to the relevant milestones.
- Added VITE_ENABLE_WAVE_ROUTING as a default-off visibility gate. It does not implement wave routing; leave it unset until milestone 6 is validated.

## Validation results

- `bash scripts/start-dev.sh`: passed, including a repeat run retaining the existing database volume. All four services reported healthy.
- REST `/health`: passed with `database_connected: true`.
- Graph `/api/graph/data`: passed for an empty catalog and for temporary test tracks/transition.
- `CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium node frontend/scripts/smoke-dev.mjs` (run from repository root): passed twice; verifies database-backed graph response, transition weight, and browser canvas with no page exceptions. Temporary test records were removed.
- `npm run build` in frontend: passed after changes.
- Before this task, `npm run type-check` failed with 124 pre-existing errors. After cleanup: passed with zero errors.
- `npm run test:unit` in frontend: 33 tests passed across three files (29 spatial-index tests, two REST-path adapter tests, and two button-slot tests).
- Production build and database-backed Chromium smoke test passed again after the TypeScript cleanup. Full platform readiness is not claimed.
- Shell syntax, Compose configuration, and `git diff --check`: passed.
- Plan/feature-gate update: frontend type check and production build passed; all eight milestones and documentation targets checked. No routing or full-platform behavior was claimed or newly tested for this documentation task.

## Resume point

Read docs/DEVELOPMENT.md for startup and smoke-test commands. Development API
containers and Vite were left running in the cloud instance; live processes do
not necessarily survive a new session. This checkpoint includes the implementation
and plan changes; use Git history to identify its commit.

Begin the next task by updating this file. Frontend type checking, build, unit
tests, and the minimal graph browser workflow pass. Investigate broader REST CRUD
and legacy graph routes against the minimal silver-schema database; inspect schema
assumptions before adding migrations. RabbitMQ, external provider integrations,
the full Playwright suite, and archived renderer behavior remain unvalidated.
Follow the maintained implementation plan. Wave routing remains scheduled for
milestone 6 after canonical energy definitions, not for the current route finder.
Exact energy band boundaries/names and calibration policy are decisions for
milestone 3; availability of complete real-set fixtures must be checked in milestone 1.

## Next steps

1. Bring legacy graph routes and broader REST workflows into alignment with the selected schema.
2. Capture representative workload performance baselines once those workflows pass.
3. Then begin backend domain consolidation and canonical identity/outbox work.

Update this file whenever a new task begins and when work stops or a milestone completes.
