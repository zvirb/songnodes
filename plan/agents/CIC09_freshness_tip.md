# CIC09: Restore merged frontend conformance

## One job
Clear the conformance findings in the newly merged frontend. Remove undefined
classes, use the design-system key-name helper and canonical card styling.

## Owned paths
- `plan/agents/CIC09_freshness_tip.md`
- `frontend/src/components/ds/FreshnessStamp.tsx`
- `frontend/src/features/trackDetail/TrackDetailPage.tsx`
- `frontend/src/features/pipeline/RunsPage.tsx`
- `frontend/src/features/musicLibrary/components/LibraryImportDialog.test.tsx`
- `STATUS.md` (CIC09 slot only)

## Checks
Design-system conformance, TypeScript, existing track-detail component tests,
whitespace, scope and deletion guards. Full CI remains authoritative.

## Behavioural check
Open Library with a stale data stamp. Its tooltip is still available and the
stamp retains its absolute and relative time.

## Follow-ups
The user identified today's original 1.7.0 as authoritative; the repository's
1.10.0 numbering is divergent. Locate and import that exact original before
certifying page compliance or merging these provisional component changes.
The upload-test path is owned for the separate CIC10 CI lint repair.
Review pipeline E2E output and its changed visual baselines separately.
