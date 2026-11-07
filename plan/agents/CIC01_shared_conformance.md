# CIC01: Restore shared frontend conformance

## One job
Restore the design-system conformance check for the shared frontend on main.
Input: the conformance findings introduced by UX-T07 and UX-T09.
Output: token spacing, defined styling, and one Build set primary action.
Failure mode: the conformance job rejects shared frontend code.

## Owned paths
- `plan/agents/CIC01_shared_conformance.md`
- `STATUS.md` (CIC01 slot only)
- `frontend/src/components/ds/DataTable.tsx`
- `frontend/src/components/ds/EditableCell.tsx`
- `frontend/src/features/musicLibrary/SetBuilderPage.tsx`

## Checks
- Design-system conformance and sync
- Feature import boundaries
- Frontend type-check, lint, unit tests and build
- Scope guard and deletion guard

## Behavioural check
Open /sets with an empty running order: Build set appears only in the empty
state. Build a set: the action moves to the page header. Editable cells retain
saving, saved and failure labels; selected rows retain spaced bulk actions.

## Follow-ups
Investigate the remaining /paths primary actions and visual snapshot failures
in a separate package. Rebase affected PRs after this fix is merged.
