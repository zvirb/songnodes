# DS4: Design system audit and fix: Set builder page

## 1. Summary
**Files reviewed:**
- `frontend/src/features/musicLibrary/SetBuilderPage.tsx`
- `frontend/src/features/musicLibrary/components/EnergyWave.tsx`
- `frontend/src/features/setBuilder/ExportDialog.tsx`
- `frontend/src/features/setBuilder/exporters.ts`
- `frontend/design-system-pending.txt`

**Deviations found:**
- **Color/Spacing/Type literals:** Ad-hoc layout spacing like `var(--spacing-md)` inside `SetBuilderPage.tsx` and `ExportDialog.tsx`. Text/surface colors `var(--text-2)` and `var(--surface-2)` in `SetBuilderPage.tsx` instead of `--fg-2` and `--surface-2`.
- **Formatting literals:** Inline styles for sizes (`0.875rem`) which belong to token-bound typography utilities (e.g. `.label`).
- **Data literals:** Using `'Unknown'` string for empty Artist and Title data fields during text exports.
- **Hand-built Components:** Hand-crafted HTML classes for `sn-status-pill` instead of the required `StatusPill` component.

**Fixed:** All reported deviations in owned paths were fixed.

**Left open:** None.

## 2. Findings table

| File | Line | Rule | What was wrong | Fixed | How |
|---|---|---|---|---|---|
| `SetBuilderPage.tsx` | 347, 527 | 07-feedback-status | Used manual `<span className="sn-pill sn-status-pill"...` markup for statuses. | Yes | Replaced with `<StatusPill raw="idle" label="..." />` from `../../lib/songnodes`. |
| `SetBuilderPage.tsx` | 568-571 | 04-typography, 05-layout | Hardcoded size `0.875rem`, invalid token `var(--spacing-md)` & `var(--spacing-xl)`, bad color `var(--text-2)`, and redundant markup instances. | Yes | Removed the duplicates. Rewrote the last instance to use the `.label` class and `--fg-2`, `--space-3`, and `--space-6` tokens. |
| `ExportDialog.tsx` | 63-64 | 01-writing | Hardcoded `'Unknown'` text replacement for missing track fields instead of en dash/blank. | Yes | Switched to empty string `''` (so exporters and text fields do not inject fake track data) and `sn-none` rules in standard views. |
| `ExportDialog.tsx` | 144 | 05-layout | Using non-existent `var(--spacing-md)` in flex `gap`. | Yes | Replaced with `var(--space-3)`. |
| `exporters.ts` | 26-27 | 01-writing | Hardcoded `'Unknown'` text replacement for missing track fields. | Yes | Switched to empty string `''` to prevent exporting fake track names to DJ formats. |

## 3. MISSING TOKENS

*No missing tokens reported. All required styles exist in the system.*

## 4. MISSING COMPONENTS AND PATTERNS

*No missing components reported.*

## 5. Exceptions requested

*None.*

## 6. Elsewhere

*None observed in this audit.*

## 7. Could not check

- Could not check interactive visual UI feedback and hover states statically.
- Could not run Playwright E2E visual tests due to running inside a sandbox environment without Playwright capability.
