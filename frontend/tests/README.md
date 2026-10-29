# SongNodes E2E tests (Playwright)

The suite covers the app as it stands on the SongNodes design system (CLAUDE.md §4,
docs/sdlc/SDLC.md gates V1–V3). It replaced the pre-migration suite in October 2026;
the retired specs targeted markup that no longer exists (see `STATUS.md`).

## Run

Canonical run, in the official Linux image against the development stack
(`scripts/start-dev.sh` first). This is the run that counts for the merge gate:

```bash
scripts/e2e-docker.sh
```

Extra arguments go to Playwright, for example `scripts/e2e-docker.sh --project=webkit`
or `scripts/e2e-docker.sh shell`.

On the host (chromium only is installed by default; visual baselines exist for
Linux only, so `visual.spec.ts` fails elsewhere by design):

```bash
cd frontend
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3006 npm run test:e2e -- --project=chromium
```

Without `PLAYWRIGHT_BASE_URL`, Playwright starts Vite on port 3006.

## Rules

- One worker, no retries (`playwright.config.ts`). A flaky test is a failing test.
- `fixtures.ts` fails every test on any console error or uncaught page error. Nothing
  is filtered. Import `test` and `expect` from `./fixtures`, not from `@playwright/test`.
- Chromium renders WebGL with SwiftShader (`setup/webgl.ts`); global setup stops the
  run if WebGL is unavailable.
- Graph specs assert structure only. Node and edge assertions wait for real scraped data;
  no synthetic graph data is seeded or mocked.
- Accessibility (`accessibility.spec.ts`) fails on any serious or critical axe
  violation, except the approved exceptions in `docs/design-system/EXCEPTIONS.md`,
  each limited to one rule on one element.

## Pinned Library Fixture

Library and Set builder E2E tests (`library.spec.ts`, `sets.spec.ts`) use a pinned
library fixture to run predictably, rather than depending on whatever happens to be
in the local developer's Postgres database (the real library grows every week).

The pinned fixture lives at `frontend/tests/e2e/data/library.fixture.json` and is
served by Playwright route handlers (`useLibraryFixture`). It never changes automatically
with the real library.

To deliberately refresh the fixture data, copy the pipeline export over it:
```bash
cp ../musicLibrary/outputs/artifact/library.json frontend/tests/e2e/data/library.fixture.json
```
Only test data may read from it; nothing under `frontend/src` should reference it.

## Visual baselines

`visual.spec.ts` checks Home, Library, Set builder, Settings, the pipeline telemetry page,
the not-found page and the open NavDrawer, in dark and light, at 1440 and 390 px, in
chromium. The pipeline page's API calls (`/api/v1/jobs`, `/api/v1/outbox/status`,
`/api/v1/target-tracks`) are answered with an empty pipeline, so a laptop with history
and CI's fresh database capture the same page. Baselines (`visual.spec.ts-snapshots/*-chromium-linux.png`) are made only
in the Linux image:

```bash
scripts/e2e-docker.sh visual --project=chromium --update-snapshots
```

Only update them for an intended visual change, review every image against the design
system before committing, and commit baselines separately from code. Never update them
to clear a failure that has another cause.

## Specs

| Spec | Covers |
|---|---|
| `routes.smoke.spec.ts` | Every route loads with status 200, the `/sources` redirect, the not-found page |
| `shell.spec.ts` | NavDrawer open/close/focus, every row navigates and is marked current, Back/Forward, header search and Ctrl+K, skip link, titles |
| `library.spec.ts` | Crate count from `frontend/tests/e2e/data/library.fixture.json`, search, empty state, en dash for missing values, sorting, Build set from crate |
| `library.spec.ts` | Crate count from `library.fixture.json`, search, empty state, en dash for missing values, sorting, Build set from crate |
| `sets.spec.ts` | Build set, save, persist across reload, delete through ConfirmDialog (confirm, Cancel, Escape) |
| `settings.spec.ts` | Theme, text size, density, motion, reset, About |
| `graph.spec.ts` | Graph toolbar and canvas panel, Play/Plan in the URL, Plan-tab deep links |
| `design-rules.spec.ts` | Per route: at most one primary button, no horizontal scroll at 390 px or at text size XL, no "N/A"/"Unknown", `lang="en-AU"` |
| `accessibility.spec.ts` | axe WCAG 2.2 AA per route in dark and light, and the open NavDrawer |
| `visual.spec.ts` | Screenshot baselines (above) |

## In CI

The canonical run (above) is executed in GitHub Actions (`e2e.yml`) using the
development Compose stack. The workflow runs the Chromium suite on pull requests
and the full multi-browser suite on pushes to `main`. The Playwright report is
uploaded as an artifact on the job's run page.
