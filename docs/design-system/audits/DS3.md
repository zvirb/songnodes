# DS3: Design system audit and fix: Library page

## Summary
- **Files reviewed:**
  - `frontend/src/features/musicLibrary/LibraryPage.tsx`
  - `frontend/src/features/musicLibrary/components/CrateFilterRail.tsx`
  - `frontend/src/features/musicLibrary/components/ui.tsx`
  - `frontend/src/features/musicLibrary/musicLibrary.css`
  - `frontend/src/features/musicLibrary/route.tsx`
  - `frontend/src/features/musicLibrary/setBuilder.ts`
  - `frontend/src/features/musicLibrary/storage.ts`
  - `frontend/src/features/musicLibrary/targetAction/TargetActionButton.tsx`
  - `frontend/src/hooks/useUnifiedTracks.ts`
  - `frontend/src/services/trackSyncAdapter.ts`
  - `frontend/src/services/unifiedTrackService.ts`
  - `frontend/src/types/unifiedTrack.ts`
- **Deviations found:**
  - Inline pixel sizes, missing/wrong tokens (`var(--text-2)`, `var(--spacing-md)`), missing padding and font-size tokens.
- **Fixed:** All deviations fixed in owned paths.
- **Left open:** None.

## Findings table
| File | Line | Rule | What was wrong | Fixed | How |
|---|---|---|---|---|---|
| `LibraryPage.tsx` | 278-281 | 04-typography, 03-colour, 05-layout | Incorrect inline tokens `var(--text-2)`, `var(--spacing-md)`, `0.875rem` | yes | Replaced with `sn-body-s`, `var(--fg-2)`, `var(--space-4)`, removed duplicate rows. |
| `components/ui.tsx` | 441 | 05-layout | Ad-hoc padding `0.5rem` | yes | Replaced with `var(--space-2)` |
| `components/ui.tsx` | 442 | 04-typography | Ad-hoc font size `0.875rem` | yes | Replaced with `.sn-body-strong` |
| `components/ui.tsx` | 444 | 04-typography, 03-colour | Ad-hoc font size `0.75rem`, invalid token `var(--text-2)` | yes | Replaced with `.sn-body-s` and `var(--fg-2)` |

## MISSING TOKENS
None found that weren't already resolved by substituting existing valid tokens.

## MISSING COMPONENTS AND PATTERNS
None found.

## Exceptions requested
None.

## Elsewhere
- `SetBuilderPage.tsx` (Out of scope/DS4): Has duplicate credit lines and incorrect inline tokens like `var(--text-2)`, `var(--spacing-md)`, `var(--spacing-xl)`, `0.875rem` (around lines 563-566).
- `components/AITransitionHelper.tsx` (Out of scope): Ad-hoc font size `0.8125rem` at line 63.
- `components/EnergyWave.tsx` (Out of scope): Hardcoded pixel size `16` for `rem` SVG scaling at line 25.

## Could not check
- Playwright visual/E2E tests cannot run in this sandbox environment.
