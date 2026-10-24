# Design-system exceptions (SongNodes app)

Approved exceptions to the SongNodes design system, following
`design-system/17-governance.md` "Exceptions". The authoritative register is the
open questions register in the design-system artifact. `design-system/` is a
read-only mirror, so these rows still have to be added there upstream; until then
this file is the record for this repository. Each site carries the comment
`design-system exception EX-NNN`.

| ID | Rule | Why | Scope | Approved | Expires |
|---|---|---|---|---|---|
| EX-001 | WCAG 1.4.3 contrast (axe `color-contrast`) | The AppHeader wordmark is SongNodes' logotype (`14-identity-icons`: "Its identity is the wordmark"); WCAG 1.4.3 exempts logotypes. Dark theme `--brand` `#9b85cb` on `#2d2d2d` measures 4.33:1. | `.sn-app-header__wordmark` only, all themes; `frontend/tests/e2e/accessibility.spec.ts` | Markus, 25 Oct 2026 | Design system 1.2.0 |
| EX-002 | WCAG 2.5.3 label in name (axe `label-content-name-mismatch`) | The LauncherCard markup in the design system names the card link from its title only (`aria-labelledby="lc-t"`), so the visible module label is not part of the accessible name. Kept as specified until the design system decides. | `.sn-launcher-card` links on Home; `frontend/tests/e2e/accessibility.spec.ts` | Markus, 25 Oct 2026 | Design system 1.2.0 |
