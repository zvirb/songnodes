QA6: Stabilise the dev-worker end-to-end integration test

Depends on: R3 (the graph projection consumer this test waits on). Base: main at BASE_SHA. Repo: zvirb/songnodes. Follow AGENTS.md and CLAUDE.md. No access to the user's laptop, local data or secrets; work from the repo and fixtures. Open one PR against main; do not merge it. Edit only the lines inside your own slot in STATUS.md (SLOT:QA6 BEGIN/END): dated start entry, dated end entry with what you built, checks run and not run, and the PR link. Stay inside the owned paths below. Do not edit frontend/src/styles/design-system/ or design-system/. If a check cannot run in your sandbox, say so in the PR.

## Problem
tests/integration/test_dev_worker.py::WorkerEndToEnd::test_bronze_playlist_flows_to_silver_transitions_and_the_projection failed once in a full `pytest tests -x` run against the dev stack, then passed on two later full runs (57 passed, 8 skipped). It is timing- or state-dependent.
## Owned paths
- tests/integration/test_dev_worker.py
- tests/integration/conftest.py
- tests/integration/helpers/**

## Do
- Read the test and find the race (fixed sleeps, shared rows, leftover data from other tests, projection not yet consumed). Replace sleeps with bounded polling with a clear failure message that names what it waited for; clean up its own rows.
- Do not weaken assertions and do not add synthetic graph data to the product or E2E (project rule). If it needs the live stack, keep the existing skip behaviour when the stack is absent.
## Checks
Static review only if the stack is unavailable; say so. Add a note of how to run it 10 times in a row locally.
