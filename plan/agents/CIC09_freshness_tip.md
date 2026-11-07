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
- `frontend/tests/e2e/all-pages.spec.ts`
- `frontend/tests/e2e/libraryApi.ts`
- `frontend/src/features/auth/route.tsx`
- `frontend/src/features/auth/LoginPage.tsx`
- `frontend/src/features/auth/LoginPage.test.tsx`
- `frontend/src/features/pipeline/route.tsx`
- `frontend/src/routes/registry.test.tsx`
- `frontend/src/components/OAuthCallback.tsx`
- `STATUS.md` (CIC09 slot only)

## Checks
Design-system conformance, TypeScript, existing track-detail component tests,
whitespace, scope and deletion guards. Full CI remains authoritative.

## Behavioural check
Open Library with a stale data stamp. Its tooltip is still available and the
stamp retains its absolute and relative time.

## Follow-ups
The user confirmed local 1.10.0 is authoritative; the cloud copy is stale.
Receive scoped follow-up packages CIC10 (upload assertion), CIC11 (all registered
page audit and fresh-library test fixtures), CIC12 (login route), CIC13 (run-history
route) and CIC14 (callback page semantics). Each has its own commit and status
slot; the combined audit coverage needs more than ten files, while each package
remains small. No unrelated paths may be edited.
Review pipeline E2E output and its changed visual baselines separately.
