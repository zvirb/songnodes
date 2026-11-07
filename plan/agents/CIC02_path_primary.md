# CIC02: Show the relevant Pathfinder primary action

## One job
Fix the /paths primary-action E2E failure. Empty libraries show Open library;
routeable libraries show the empty-state action until results exist.

## Owned paths
- `plan/agents/CIC02_path_primary.md`
- `STATUS.md` (CIC02 slot only)
- `frontend/src/features/pathfinder/PathfinderPage.tsx`
- `frontend/src/features/pathfinder/PathfinderPage.test.tsx`

- `plan/agents/CIC03_sets_baselines.md`
- `frontend/tests/e2e/visual.spec.ts-snapshots/sets-dark-desktop-chromium-linux.png`
- `frontend/tests/e2e/visual.spec.ts-snapshots/sets-dark-phone-chromium-linux.png`
- `frontend/tests/e2e/visual.spec.ts-snapshots/sets-light-desktop-chromium-linux.png`
- `frontend/tests/e2e/visual.spec.ts-snapshots/sets-light-phone-chromium-linux.png`

## Integration ownership
The baseline paths belong to the reviewed CIC03 prerequisite package received
through PR #600; no unrelated files may be changed.

## Checks
Component tests, type-check, design-system conformance and whitespace check.

## Behavioural check
Open /paths with an empty library: Open library is the only primary action.
With tracks loaded, choose a start track and find a path; at every stage only
one primary action is visible.

## Follow-ups
Review the four Linux /sets visual snapshots in a separate package.
