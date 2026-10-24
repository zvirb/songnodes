# 2026-10-24: the SongNodes design system is the single source of truth

**Status:** accepted · **Decided by:** Markus · **Date:** 24 Oct 2026

## What changed
- The SongNodes design system (version 1.1.0, published as a design-system artifact) is deployed to `design-system/` in this repository. It contains the brand book, 19 guideline sections (including `04-typography`), 92 component guidelines with previews, tokens, fonts, icons and build scripts.
- README.md, CLAUDE.md, AGENTS.md, CONTRIBUTING.md, the PR template and the new [SDLC](../sdlc/SDLC.md) name it as the single source of truth for every formatting and design decision in SongNodes and the music library.
- `scripts/sync-design-system.sh` copies its runtime files into `frontend/src/styles/design-system/`. CI (`.github/workflows/design-system.yml`) checks that the copy is in sync and that migrated code has no raw colours, emoji or browser dialogs.
- The frontend has a new router and shell (AppHeader, NavDrawer, Home, Settings preferences) built from the system. The music library (Naarm Set Builder) is a Library page and a Set builder page inside SongNodes.

## Why
SongNodes had four styling systems at once: Matrix-green tokens, a legacy global stylesheet, Tailwind (never compiled) and hundreds of inline hex colours. It also had three Camelot tables, one of them wrong, three energy drawings and two compatibility palettes. The music library used a third look. One system removes the drift and gives agents one place to read.

## Rules derived
Decision order and rule derivation follow `design-system/17-governance.md`:
- Markus's DR-001…DR-030 come first.
- Next, the rules that reproduce existing artifacts. The music library's set-building rules (tiers 1–4/5–7/8–10, +1 climbs, 2–3 point drops) are kept exactly as the Naarm Set Builder implements them.
- Then correct SongNodes code, then platform standards.

## Impact
- New UI work must pass the design-system gates in the SDLC (D2, B1, V2, V3, R1).
- Legacy stylesheets stay only behind `legacy-aliases.css` until migration phase 6 removes them.

## Evidence
- `design-system/tokens.json` version `1.1.0` equals `SongNodes.version` in `design-system/components/bundle.js`.
- `scripts/sync-design-system.sh --check` passes.
- Rebuilding `bundle.js` from `design-system/source/` reproduces the published file byte for byte (sha256 `629479639200931aef98a8db6ebae9bbcbc929c9672a33398255c3d0addabc06`).
