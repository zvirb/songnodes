# CIC03: Refresh reviewed Set builder baselines

## One job
Refresh the four /sets visual baselines after the empty-state action changes.
Input: canonical Linux Playwright CI run 42340395662, artifact 13561074678.
Output: reviewed PNG baselines matching the intended empty-state layout.
Failure mode: stale screenshot expectations.

## Owned paths
- `plan/agents/CIC03_sets_baselines.md`
- `STATUS.md` (CIC03 slot only)
- `frontend/tests/e2e/visual.spec.ts-snapshots/sets-dark-desktop-chromium-linux.png`
- `frontend/tests/e2e/visual.spec.ts-snapshots/sets-dark-phone-chromium-linux.png`
- `frontend/tests/e2e/visual.spec.ts-snapshots/sets-light-desktop-chromium-linux.png`
- `frontend/tests/e2e/visual.spec.ts-snapshots/sets-light-phone-chromium-linux.png`

## Checks
Visually inspect all four source captures. Verify PNG dimensions and identical
SHA256 hashes between the reviewed artifact captures and copied baselines.
Run the canonical Chromium E2E suite in CI; do not loosen screenshot tolerances.

## Behavioural check
Open each baseline: one primary Build set action in the running-order empty
state, no duplicate header primary, saved-set empty action, no clipped content.

## Follow-ups
Merge this package into CIC02 once CI passes, then merge CIC02 into CIC01.
