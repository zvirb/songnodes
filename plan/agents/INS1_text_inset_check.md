INS1: Design check fails text set 4–7 px from its box edge

Base: main. Follows "Working rules for agents" in AGENTS.md and CLAUDE.md. Branch `ins1-text-inset-check`, PR title "INS1: Design check fails text set 4–7 px from its box edge". Edit only the lines inside the STATUS.md slot SLOT:INS1.

## Job
Build the rendered text-inset check that DR-050 (design-system/17-governance.md, closes Q18) asks for: text 4 to under 8px from the edge of its box fails the design check and blocks the PR.

## Owned paths
- frontend/tests/e2e/design-rules.spec.ts
- frontend/src/lib/textInset.ts
- frontend/src/lib/textInset.test.ts
- design-system/17-governance.md (the "Text inset (rendered)" conformance row only)
- plan/agents/INS1_text_inset_check.md
- STATUS.md (SLOT:INS1 only)

## Definition
- Pages and widths: every `SHELL_ROUTES` route plus `/sources/import`, at 390 and 1440px, inside `main#main`.
- Box: the nearest ancestor of the text (inside main) that draws a left or right edge: a fill that differs from the nearest filled ancestor behind it, a background image, a visible border on that side, or a box-shadow (outer shadow or inset ring: every side; a hard inset offset: that side only).
- Inset: least distance from the text's rendered line rects (`Range.getClientRects`, clipped to what shows) to the box's padding edge, left and right only (the block rule is a separate 2px minimum).
- Tight: 3.5 <= inset < 7.5 (4 to under 8px with 0.5px sub-pixel tolerance) fails. Under 4px is a defect of its own and is not judged here.
- Not measured: text outside main (AppHeader, NavDrawer); input, select and textarea values; SVG text; hidden, screen-reader-only, closed or off-screen text; boxes in `EXCLUDED_BOX_CLASSES` with a card citation (`sn-key-picker__key`: KeyPicker card, keys at least 24px wide padded `space-1`).

## Done when
CI's e2e job runs the new tests. The first run is the first real one: a failure lists every offender as `route @width: selector "text" sits Npx from the left|right edge of box (needs 8px)`, which is the fix list for follow-up packages.

## Checks
Frontend checks, `sync-design-system.sh --check`, `check_design_system.py --check`, scope guard. Playwright against the real stack cannot run in the agent sandbox; say so.
