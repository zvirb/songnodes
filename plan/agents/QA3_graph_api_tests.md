QA3: Make graph-visualization-api tests collect and run

Depends on: QA4 (both edit .github/workflows/python-tests.yml). Base: main at BASE_SHA. Repo: zvirb/songnodes. Follow AGENTS.md and CLAUDE.md. No access to the user's laptop, local data or secrets; work from the repo and fixtures. Open one PR against main titled "QA3: Make graph-visualization-api tests collect and run" on a branch starting with "qa3-"; do not merge it. Edit only the lines inside your own slot in STATUS.md (SLOT:QA3 BEGIN/END): dated start entry, dated end entry with what you built, checks run and not run, and the PR link. Stay inside the owned paths below. Do not edit frontend/src/styles/design-system/ or design-system/. If a check cannot run in your sandbox, say so in the PR.

## Problem
`cd services/graph-visualization-api && python -m pytest` reports "no tests ran": pytest.ini has testpaths = tests, the tests/ folders (unit, integration) hold no collected tests, and test_performance.py in the service root is outside testpaths and is not collected either.
## Owned paths
- services/graph-visualization-api/** (tests, pytest.ini, requirements-test.txt)
- .github/workflows/python-tests.yml (the graph-visualization-api job only)

## Do
- Decide per file whether test_performance.py is a real test (move it under tests/ and make it run on fixtures, no live DB) or a benchmark (mark and exclude).
- Add unit tests for catalog.py and the main routes that run against fixtures with no network or database.
- Add the service to the python-tests workflow so CI runs it; keep coverage output out of git.
## Checks
python -m pytest in the service directory (state the count), and from the repo root.
