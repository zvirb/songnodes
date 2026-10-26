# DS6: Design system audit and fix: Harmony (Camelot) page

## 1. Summary

**Files reviewed:**
- frontend/src/features/camelot/CamelotPage.tsx
- frontend/src/features/camelot/camelot.css
- frontend/src/components/CamelotWheel.tsx
- frontend/src/components/HarmonicCompatibility.tsx
- frontend/src/components/KeyMoodPanel.tsx
- frontend/src/components/KeyMoodPanel.css
- frontend/src/components/MoodVisualizer.tsx
- frontend/src/components/MoodVisualizer.css
- frontend/src/features/camelot/camelotLogic.ts
- frontend/src/features/camelot/camelot.test.tsx
- frontend/src/features/camelot/camelotLogic.test.ts
- frontend/src/features/camelot/index.ts
- frontend/src/features/camelot/route.tsx
- frontend/src/lib/graphColours.ts
- frontend/src/store/useStore.ts
- frontend/src/types/pathfinding.ts
- frontend/src/utils/camelotData.ts
- frontend/src/utils/camelotUtils.ts
- frontend/src/utils/communityDetection.ts
- frontend/src/utils/filterNodes.ts
- frontend/src/utils/graphHelpers.ts
- frontend/design-system-pending.txt

**Deviations found:**
- Hardcoded string 'Unknown' in CamelotPage instead of en dash using `sn-none`.
- Manual inline styles using pixels instead of layout/spacing tokens (`CamelotPage.tsx`).
- Text capitalization in page headings not conforming to sentence case ("Acoustic Mood & Energy Profile", "Active Key").
- Raw pixel font sizes in CSS and TSX replacing design-system typography classes (.body-s, .data-strong, .label).
- Hardcoded drop shadows (`text-shadow: 0 1px 2px var(--bg)`) instead of `var(--shadow-1)`.
- Use of raw font-family declarations like `var(--font-data)` instead of design system classes.

**Fixed:** Yes, within owned component bounds, except for media queries (see MISSING TOKENS).

## 2. Findings table

| File | Line | Rule | What was wrong | Fixed | How |
|---|---|---|---|---|---|
| frontend/src/features/camelot/camelot.css | 7 | 05-layout | Hardcoded `960px` breakpoint media query. | No | Media queries cannot accept `var(--bp-desktop)` natively; reported as Missing Token for the build toolchain. |
| frontend/src/features/camelot/camelot.css | 24 | 04-typography | Raw `font-size: 0.875rem` and `font-family: var(--font-body)`. | Yes | Removed CSS overrides and used component styles. |
| frontend/src/features/camelot/CamelotPage.tsx | 127 | 04-typography | Raw style map with `fontSize: '0.75rem'` and `fontFamily: 'var(--font-data)'`. | Yes | Swapped out inline properties for `className="data-s"`. |
| frontend/src/features/camelot/CamelotPage.tsx | 131 | 05-layout | Raw `textShadow: '0 1px 2px var(--bg)'` manually applied. | Yes | Swapped out with `textShadow: 'var(--shadow-1)'`. |
| frontend/src/features/camelot/CamelotPage.tsx | 172 | 01-writing | 'Unknown' as label fallback text. | Yes | Swapped to `<span className="sn-none">–</span>`. |
| frontend/src/features/camelot/CamelotPage.tsx | 196 | 01-writing | "Acoustic Mood & Energy Profile" (Title Case). | Yes | Converted to "Acoustic mood and energy profile" (sentence case). |
| frontend/src/features/camelot/CamelotPage.tsx | 197 | 05-layout | Inline styling `var(--surface-1)` / padding instead of component class. | Yes | Applied `.sn-card`. |
| frontend/src/components/CamelotWheel.tsx | 224 | 04-typography | `style={{ fontFamily: 'var(--font-data)' }}` inline override. | Yes | Used `.data-strong` class. |
| frontend/src/components/CamelotWheel.tsx | 233 | 04-typography | `style={{ fontFamily: 'var(--font-data)' }}`. | Yes | Used `.data-s` class. |
| frontend/src/components/CamelotWheel.tsx | 315 | 04-typography | Inline `fontFamily` overrides. | Yes | Used `.data-strong`, `.title-s`, and `.body-s`. |
| frontend/src/components/CamelotWheel.tsx | 323 | 01-writing | "Active Key" (Title Case). | Yes | Changed to "Active key". |
| frontend/src/components/HarmonicCompatibility.tsx | 25 | 04-typography | `style={{ fontFamily: 'var(--font-data)' }}`. | Yes | Changed to `.data` class. |
| frontend/src/components/HarmonicCompatibility.tsx | 49 | 04-typography | `style={{ fontFamily: 'var(--font-display)' }}`. | Yes | Removed inline rule in favor of `.title-s` which carries correct font. |
| frontend/src/components/HarmonicCompatibility.tsx | 56 | 04-typography | `style={{ fontFamily: 'var(--font-body)' }}` on `.sn-btn`. | Yes | Replaced with `.body` class. |
| frontend/src/components/KeyMoodPanel.css | 37 | 04-typography | `font-size: 0.75rem; font-family: var(--font-body); font-weight: 600;` on `.km__label`. | Yes | Moved to `.label` TSX class. |
| frontend/src/components/KeyMoodPanel.css | 58 | 04-typography | `font-size: 0.8125rem` on `.km__stats dt`. | Yes | Moved to `.body-s` TSX class. |
| frontend/src/components/KeyMoodPanel.css | 64 | 04-typography | Raw typography definitions. | Yes | Moved to `.data-strong` TSX class. |
| frontend/src/components/MoodVisualizer.css | 4 | 04-typography | `font: 600 0.75rem/1.3 var(--font-body);` | Yes | Dropped from CSS and applied `.label` in TSX. |
| frontend/src/components/MoodVisualizer.css | 5 | 04-typography | `font-size: 0.75rem;` | Yes | Dropped from CSS and applied `.caption` in TSX. |
| frontend/src/components/MoodVisualizer.css | 15 | 04-typography | `font: 700 0.6875rem/1 var(--font-data);` | Yes | Applied `.data-s` in TSX. |
| frontend/src/components/MoodVisualizer.css | 16 | 04-typography | `font: 400 0.6875rem/1 var(--font-data);` | Yes | Applied `.data-s` in TSX. |
| frontend/src/components/MoodVisualizer.css | 17 | 04-typography | `font: 400 0.6875rem/1 var(--font-data);` | Yes | Applied `.data-s` in TSX. |
| frontend/src/components/MoodVisualizer.css | 18 | 04-typography | `font: 400 0.75rem/1 var(--font-body);` | Yes | Applied `.label` in TSX. |
| frontend/src/components/MoodVisualizer.tsx | 426 | 01-writing | Missing `SN.format.count()` on numbers for transitions | Yes | Wrapped variables in SN.format.count() |
| frontend/src/features/camelot/CamelotPage.tsx | 133 | 01-writing | Missing `SN.format.count()` on numbers for keys count | Yes | Wrapped count variable in SN.format.count() |

## 3. MISSING TOKENS

| Value/Need | File:Line | Proposed token | Nearest existing | Section |
|---|---|---|---|---|
| Native Media Query Variable | frontend/src/features/camelot/camelot.css:7 | N/A (Build Step enhancement) | `--bp-desktop: 1100px` | 05-layout |

## 4. MISSING COMPONENTS AND PATTERNS

None found.

## 5. Exceptions requested

None requested.

## 6. Elsewhere

No design system deviations found affecting external files that we cannot fix within our bounds.

## 7. Could not check

- We cannot check E2E / visual layouts via Playwright (sandbox constraints).
- React components using DOM interactions heavily dependent on complex state interactions.
