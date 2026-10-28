# Design-system exceptions (SongNodes app)

Approved exceptions to the SongNodes design system, following
`design-system/17-governance.md` "Exceptions". The authoritative register is
"Approved exceptions" under Open questions in `design-system/17-governance.md`
(added in design system 1.1.1, published to the design-system artifact); this file
repeats it for this repository. Each site carries the comment
`design-system exception EX-NNN`.

| ID | Rule | Why | Scope | Approved | Expires |
|---|---|---|---|---|---|
| EX-001 | WCAG 1.4.3 contrast (axe `color-contrast`) | The AppHeader wordmark is SongNodes' logotype (`14-identity-icons`: "Its identity is the wordmark"); WCAG 1.4.3 exempts logotypes. Dark theme `--brand` `#9b85cb` on `#2d2d2d` measures 4.33:1. | `.sn-app-header__wordmark` only, all themes; `frontend/tests/e2e/accessibility.spec.ts` | Markus, 25 Oct 2026 | Closed in design system 1.2.0: fixed (see the 1.2.0 change log) |
| EX-002 | WCAG 2.5.3 label in name (axe `label-content-name-mismatch`) | The LauncherCard markup in the design system names the card link from its title only (`aria-labelledby="lc-t"`), so the visible module label is not part of the accessible name. Kept as specified until the design system decides. | `.sn-launcher-card` links on Home; `frontend/tests/e2e/accessibility.spec.ts` | Markus, 25 Oct 2026 | Closed in design system 1.2.0: fixed (see the 1.2.0 change log) |

Both exceptions were closed at their expiry release, 1.2.0: the dark wordmark now uses `--brand-strong`, and LauncherCard links are the card titles (stretched-link pattern). No open exceptions remain.
