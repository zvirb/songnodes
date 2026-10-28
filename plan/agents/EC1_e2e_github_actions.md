EC1: Run the browser tests in GitHub Actions

Base: main at BASE_SHA. Repo: zvirb/songnodes. Follow "Working rules for agents" in AGENTS.md (one job, owned paths only, about 400 changed lines at most, verify then commit, two attempts then stop, rebase before the PR) and CLAUDE.md; the design system rules apply to any UI change. No access to the user's laptop, local data or secrets; work from the repo and fixtures. Open one PR against main titled "EC1: Run the browser tests in GitHub Actions" on a branch starting with "ec1-"; do not merge it. Edit only the lines inside your own STATUS.md slot (SLOT:EC1 BEGIN/END). Depends on: nothing. If a dependency is not merged on main yet, stop and say so instead of working around it. Never merge or rebuild your branch from an older base: before opening or updating the PR, run `git fetch origin main && git diff --diff-filter=D --name-only origin/main...HEAD`; it must list only your owned paths, otherwise stop and say so (the scope guard fails the PR anyway). New pages register through frontend/src/routes (G2) and new REST routers expose register(app) (G3); never edit App.tsx or services/rest_api/main.py unless your brief owns them.

## Job
Add one GitHub Actions workflow that brings up the development Compose stack and runs the Playwright suite against it, the same way scripts/e2e-docker.sh does on the laptop, on every pull request and push to main.

## Context (verified on main 2026-10-28)
The 7 workflows in .github/workflows (codeql, design-system, python-tests, scope-guard, security-secrets-deps, security, trivy) never run Playwright. The canonical run is scripts/e2e-docker.sh: it needs the stack from scripts/start-dev.sh (Compose project `songnodes-dev`, compose.dev.yaml:1, network songnodes-dev_default), then runs mcr.microsoft.com/playwright:v1.64.1-noble on that network with PLAYWRIGHT_BASE_URL=http://frontend:8080 and `npx playwright test --workers=1`. frontend/playwright.config.ts: one worker, no retries, reporters html (playwright-report/), list and json (test-results/results.json); visual baselines exist for chromium on Linux only (frontend/tests/README.md "Visual baselines"); library and set specs use the pinned fixture tests/e2e/data/library.fixture.json; graph specs assert structure only and wait for data without seeding. compose.dev.yaml gives every credential a `${VAR:-}` default and ENRICHMENT_PROVIDERS defaults to 'none', so the stack starts without secrets. start-dev.sh builds five images and applies migrations; it sets DOCKER_CONFIG under .local-dev/. Other workflows pin actions by full commit SHA with a version comment (e.g. actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1) and set `permissions: contents: read`. compose.dev.yaml and scripts/start-dev.sh are read-only for you.

## Owned paths
- .github/workflows/e2e.yml (new)
- frontend/tests/README.md (a short "In CI" section only)

(Complete list. Anything else is read-only for you. You may also add a dated note under docs/integration/EC1/ if you need to record a decision.)

## Do
1. e2e.yml: `on: pull_request` (paths frontend/**, services/**, scrapers/**, sql/**, compose.dev.yaml, scripts/start-dev.sh, scripts/e2e-docker.sh, .github/workflows/e2e.yml) and `push: branches: [main]`; `permissions: contents: read`; concurrency group per ref with cancel-in-progress; timeout-minutes 45; runs-on ubuntu-latest.
2. Steps: checkout (pinned SHA); `bash scripts/start-dev.sh`; `docker compose -f compose.dev.yaml ps`; `bash scripts/e2e-docker.sh --project=chromium` on pull_request and the full suite (all projects) on push to main. No secrets beyond the default GITHUB_TOKEN; if any variable must be set, use a CHANGE_ME placeholder in `env:` with a comment.
3. Always (if: always()) upload frontend/playwright-report and frontend/test-results as one artifact (actions/upload-artifact pinned by SHA, retention 14 days), and on failure dump `docker compose -f compose.dev.yaml logs --tail=200` to the job log.
4. Cache nothing that could make a stale image pass: images are rebuilt from the checkout every run, as CLAUDE.md requires.
5. If a spec cannot pass in CI for a reason outside your paths (for example it needs real scraped data), do not skip or edit it: let it fail, and list the spec and the reason in the PR and the hand-back.
6. frontend/tests/README.md: a few lines on the CI run, which projects run when, and where to download the report.

## Done when (the reviewer's under-10-minute check; put it in the PR)
The PR's own checks list an "e2e" job that ran the chromium suite against the Compose stack, and its run page has a playwright-report artifact that opens.

## Checks
`docker compose -f compose.dev.yaml config -q`, a YAML lint of the workflow (`python -c "import yaml,sys; yaml.safe_load(open('.github/workflows/e2e.yml'))"`), and the workflow run on the PR itself. Report failures in files you do not own; do not fix them.

## Hand-back
The one job done, files added/changed/deleted, checks run and not run, the reviewer check, the CI run time, any spec that fails only in CI and why, follow-ups.
