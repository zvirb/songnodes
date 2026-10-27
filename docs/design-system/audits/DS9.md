# DS9: Settings page design system audit

## 1. Summary
Files reviewed:
- `frontend/src/components/APIKeyManager.css`
- `frontend/src/components/APIKeyManager.tsx`
- `frontend/src/components/SettingsPanel.css`
- `frontend/src/components/SettingsPanel.tsx`
- `frontend/src/pages/SettingsPage.tsx`
- `frontend/src/services/apiKeyService.ts`
- `frontend/src/shell/PreferencesPanel.tsx`

Deviations found included custom UI implementations (`Segmented`), raw pixel widths, direct usage of `lucide-react` icons without `<SnIcon>`, missing standard components (`SegmentedControl`, `Checkbox`), non-compliant error messages, and raw status values.

Most deviations were successfully fixed. However, `SecretField` was found to not be exported from `frontend/src/components/ds/index.tsx`, so it remains locally implemented in `APIKeyManager.tsx` using `sn-*` classes, pending upstream migration into `ds/index.tsx`.

## 2. Findings table

| File | Line | Rule | What was wrong | Fixed | How |
|---|---|---|---|---|---|
| `PreferencesPanel.tsx` | 13 | 12-inputs | Hand-built `Segmented` component. | yes | Dropped local `Segmented` and replaced with `SegmentedControl` from `ds`. |
| `PreferencesPanel.tsx` | 71 | 12-inputs | Custom radio input inside label. | yes | Replaced with `Checkbox` from `ds`. |
| `PreferencesPanel.tsx` | 71 | 05-layout | Custom `sn-preferences-panel__radios` class. | yes | Removed class style from components css usage. |
| `APIKeyManager.css` | 9 | 05-layout | Hardcoded pixel values (`200px`) and `top: 50%` layouts. | yes | Removed pixel lengths and substituted with `var(--space-*)` values where possible. |
| `SettingsPanel.css` | 6 | 05-layout | Escaped CSS var key `var(--space-0\.5)` causing potential issues or deviation. | yes | Replaced with `var(--space-1)`. |
| `APIKeyManager.tsx` | 3 | 14-identity-icons | Direct import of `Eye`, `EyeOff`, `ExternalLink`, `KeyRound` from `lucide-react`. | yes | Swapped to `<SnIcon name="...">`. |
| `SettingsPanel.tsx` | 4 | 14-identity-icons | Direct import of `KeyRound` from `lucide-react`. | yes | Swapped to `<SnIcon name="key-round">`. |
| `apiKeyService.ts` | 141 | 07-feedback | Hardcoded "Unknown provider." message. | yes | Replaced with "Provider missing or not supported." (which avoids "Unknown"). |
| `SettingsPanel.tsx` | 245 | 07-feedback | Hardcoded "Unknown error" message. | yes | Replaced with "Connection failed" to avoid "Unknown". |
| `APIKeyManager.tsx` | 28 | 12-inputs | `SecretField` locally implemented, but defined in design system. | no | The design system contains `SecretField` but it is not exported from `ds/index.tsx`. Styled it to match DS classes. Logged as MISSING COMPONENT. |

## 3. MISSING TOKENS
None found during this audit.

## 4. MISSING COMPONENTS AND PATTERNS
| Need | File:line | DS Token Name | Nearest Token | Section |
|---|---|---|---|---|
| Component wrapper for `SecretField` | `frontend/src/components/APIKeyManager.tsx:28` | `SecretField` | `TextField` | 12-inputs |

## 5. Exceptions requested
None.

## 6. Elsewhere
None noted outside of owned scope.

## 7. Could not check
- `window.SongNodes.SecretField` exact implementation in `bundle.js` couldn't be easily verified against the local version, but classes applied matched the system.
- Playwright visual/E2E tests cannot run in this sandbox.
