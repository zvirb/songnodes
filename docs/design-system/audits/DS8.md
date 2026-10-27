# DS8: Design system audit and fix: Pipeline page

## 1. Summary
Files reviewed:
- `frontend/src/pages/ScraperProgressPage.tsx`: Found deviations in typography, spacing, hardcoded colors and component utilization. Fixed most of them.
- `frontend/src/features/pipeline/usePipelineTelemetry.ts`: Found title case logic for status strings which were ported to `ScraperProgressPage.tsx` using `StatusPill`.
- `frontend/src/utils/dataLoaderUtils.ts`: Evaluated for copy modifications.

## 2. Findings table
| File | Line | Rule | What was wrong | Fixed | How |
|---|---|---|---|---|---|
| `ScraperProgressPage.tsx` | multiple | 04-typography | Used `fontFamily` and inline `fontSizes`. | Yes | Swapped to standard DS typography classes `figure data`, `caption data`, `data` |
| `ScraperProgressPage.tsx` | multiple | 03-color | Used inline colors (hex variables). | Yes | Swapped them for predefined classes or removed completely where token applied directly. |
| `ScraperProgressPage.tsx` | multiple | 11-data-display | Hardcoded styles for Pills | Yes | Integrated `<StatusPill>` with `SN.status` implementation. |
| `ScraperProgressPage.tsx` | multiple | 11-data-display | Custom text formats | Yes | Leveraged `SN.format(value, 'count')`. |
| `ScraperProgressPage.tsx` | 335 | 06-interaction | Lack of WCAG labels | Yes | Supplied appropriate `aria-label`s or `aria-hidden` attributes for actionable or decorative `lucide` icons without redundant text announcements. |
| `usePipelineTelemetry.ts` | 55 | 01-writing | Status names were incorrectly capitalised. | Yes | Applied sentence casing. |
| `dataLoaderUtils.ts` | 134 | 01-writing | Stage info names were incorrectly capitalised. | Yes | Applied sentence casing. |

## 3. MISSING TOKENS
| Value / Need | Where | Proposed Name | Nearest Token | Section |
|---|---|---|---|---|
| minmax(240px, 1fr) | `ScraperProgressPage.tsx` line 137 | `var(--layout-grid-card-min)` | N/A | 05-layout |

## 4. MISSING COMPONENTS AND PATTERNS
| Value / Need | Where | Proposed Name | Nearest Token | Section |
|---|---|---|---|---|

## 5. Exceptions requested
None.

## 6. Elsewhere
None found.

## 7. Could not check
- Playwright E2E and visual tests were unable to execute since they cannot run inside this sandbox environment.
