# DS7: Design system audit and fix: Paths (route finder) page

## Summary
- **frontend/src/components/PathfinderPanel.css**: Reviewed and fixed. Deviations: ad-hoc font rules and layout values. Replaced with tokens or removed in favor of TSX utility classes.
- **frontend/src/components/PathfinderPanel/hooks.ts**: Reviewed and fixed. Deviations: custom formatting functions instead of SN.format.
- **frontend/src/components/PathfinderPanel/pathfinder.machine.ts**: Reviewed and fixed. Deviations: trailing ellipsis mismatch.
- **frontend/src/components/PathfinderPanel/types.ts**: Reviewed and fixed. Deviations: capitalization on labels.
- **frontend/src/features/pathfinder/PathfinderPage.tsx**: Reviewed and fixed. Deviations: missing tokens, string casing, spelling, use of `EmptyPanel` instead of `EmptyState`, and ad-hoc data formatters.
- **frontend/src/features/pathfinder/route.tsx**: Reviewed and verified. No design system deviations.
- **frontend/src/utils/serverPath.ts**: Reviewed and verified. Values use proper scaling boundaries.
- **docs/design-system/audits/DS7.md**: Added as audit file.
- **frontend/design-system-pending.txt**: None of the owned paths were in the pending file.

## Findings table
| File | Line | Rule | What was wrong | Fixed | How |
|---|---|---|---|---|---|
| PathfinderPanel.css | 3,8,13,17 | 04-typography | Used arbitrary font sizes (`0.8125rem`, `0.75rem`) and raw font-weight | Yes | Replaced by layout utility classes in TSX like `body-s`, `data-strong`, `caption`. |
| PathfinderPage.tsx | 198 | 13-page-patterns | Used `EmptyPanel` from components/ds instead of `EmptyState` from `shell/PageParts.tsx` | Yes | Updated import and substituted component usage |
| PathfinderPage.tsx | 277 | 01-writing | Hand-formatting numbers: `bpmShift.toFixed(1)`, `energyChange.toFixed(2)` | Yes | Wrapped via `SN.bpmStep(bpmShift)` and `SN.energyStep(energyChange)`. |
| PathfinderPage.tsx | 100 | 01-writing | Capitalization (`Start Track`) | Yes | Replaced to `Start track` and similarly adjusted other strings. |
| PathfinderPage.tsx | 205 | 01-writing | Button text was title case (`Add to Set`) | Yes | Lowercased to `Add to set` |
| PathfinderPage.tsx | 288 | 01-writing | Capitalization on `Key Fits` and `Key Clash` | Yes | Modified label to `Key fits` / `Key clash` |
| hooks.ts | 165 | 01-writing | Creating custom time formats | Yes | Imported `SN` and proxied `formatDuration` to `SN.format.span`. |

## MISSING TOKENS
None.

## MISSING COMPONENTS AND PATTERNS
None.

## Exceptions requested
None.

## Elsewhere
No deviations noticed.

## Could not check
- `LoadingPanel` and `ErrorPanel` aliases inside `ds/index.tsx` might violate naming pattern conventions since they represent `LoadingState` and `ErrorState` components but have alias exports.
- Could not check Playwright visual/E2E tests as they cannot run in the sandbox.
