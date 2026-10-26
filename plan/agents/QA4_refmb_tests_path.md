QA4: Run services/common/refmb tests from any directory and in CI

Depends on: PR #121 (BE2) merged or closed, because it also edits .github/workflows/python-tests.yml. Base: main at BASE_SHA. Repo: zvirb/songnodes. Follow AGENTS.md and CLAUDE.md. No access to the user's laptop, local data or secrets; work from the repo and fixtures. Open one PR against main titled "QA4: Run services/common/refmb tests from any directory and in CI" on a branch starting with "qa4-"; do not merge it. Edit only the lines inside your own slot in STATUS.md (SLOT:QA4 BEGIN/END): dated start entry, dated end entry with what you built, checks run and not run, and the PR link. Stay inside the owned paths below. Do not edit frontend/src/styles/design-system/ or design-system/. If a check cannot run in your sandbox, say so in the PR.

## Problem
`cd services/common/refmb && python -m pytest` fails collection ("ModuleNotFoundError: No module named 'services'"); it passes only from the repo root (`python -m pytest services/common/refmb`, 6 tests). The tests are also not in root testpaths (tests) or confirmed in python-tests.yml.
## Owned paths
- services/common/refmb/**
- pytest.ini (testpaths/pythonpath only)
- .github/workflows/python-tests.yml (the refmb step only)

## Do
- Add a conftest.py or pythonpath setting so the tests import from any working directory.
- Make sure CI runs them. Do not change refmb runtime code.
## Checks
pytest from the repo root and from services/common/refmb.
