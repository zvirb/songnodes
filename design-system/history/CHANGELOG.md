# Changelog

All notable changes to the design system, newest first, in the style of Keep a Changelog. Source: 17-governance.md, Change log. Dates are Melbourne.

## [1.14.0] - 2026-11-12
The newer LedgerSchedule features (v4.21 to v5.36), fitted to SongNodes. Full entry: 17-governance.md, Change log.

### Added
- `QuickSave` (`SongNodes.save`), `Diagnostics` (`SongNodes.diag`), `Skeleton`, `SaveMark`, `Outbox` (`SongNodes.resp`), `CardFlag`, `SuggestionActions`.
- Guidelines `20-responsive-pages.md`, `21-figure-pages.md`, `22-forms-and-load.md`.
- `FigureTile` link form, state tiles and summary band; held-scale `ProgressRing` and `ProgressBar`; `Heatmap` not-measured cell.
- Tokens `opacity-stale`, `skeleton-card-h`, `skeleton-chart-h`, `field-min`, and the type scale `fs-*`, `lh-*`, `fw-*`.
- Rule families QSV, DIA, RSP, SKL, SVM, OBX, KPG, FIG, CFL, SUG; more RAC, FBK, INP, COG and others.

### Changed
- `RowActions` is a full card; a destructive row action is a plain button with danger only on the confirm step.
- `Toast` roles and wrap; `linters/check.py` override check covers every `sn-` class.

### Fixed
- `InfoTip` Escape on a hover-opened tip; theme choice when storage refuses a write.

## [1.13.0] - 2026-11-12
The published design system and the repo line merged; sliders and ordered controls.

### Added
- `SliderGroup` and `OrderList` components; tokens `slider-track-h`, `slider-thumb`, `slider-thumb-ring`; `source/css/36-controls.css`.
- Rules INP-125 to INP-149 and MUS-080 (fragment `rules/frag/batch4.yaml`); linter checks `INP-RANGE`, `INP-STEPPER`, `INP-OVERRIDE`.
- DR-062 to DR-064 (published before the merge as DR-043 to DR-045); open questions Q28 and Q29.

### Changed
- `RangeSlider` and `NumberField` specified in full; slider track edge and thumb halo for contrast.
- Genre mix weights are relative (DR-062).

### Deprecated
- MUS-047, replaced by MUS-080.

## [1.12.1] - 2026-11-10
- Provenance bump to LedgerSchedule v5.13 (tokens v26 unchanged). Nothing applicable: StockProjectionChart table Floor cell (SPJ-124) and PlanningReview flag-tag wrap (PRV-027) are Bean Alliance-only.
- No SongNodes rule, token, component or override changed.

## [1.12.0] - 2026-11-09
- Added `RowActions` and `TaskNotice` from LedgerSchedule v5.10–v5.12 (RAC, TSK); toast wrap (BAN-130); page-size budget 2,000,000 B (PSZ-001).
- Preserved: page OverflowMenu ellipsis icon; toasts are confirmations only.
- Not imported: Bean Alliance planning, modules, speed chart; missing `dismiss_v1.js` source file documented.

## [1.11.0] - 2026-11-08
LiveChange and the shared LedgerSchedule v5.4–v5.9 changes that fit SongNodes. Entries for 1.2.0 to 1.10.0 are in 17-governance.md, Change log.

### Added
- `LiveChange` component and `SongNodes.live` helper (LIV-001 to LIV-021, DR-059, DR-060).
- Where LedgerSchedule differs, SongNodes rules are kept as preserved overrides: still placeholders and waiting border, put-back in an InlineMessage, device tags, 12-item glide limit (17-governance.md).
- A generating row holds the shape of the row it becomes, so it is as tall as the filled row at every width (LIV-021).
- `live-*` tokens (16) and `stroke-mark`, `dash`, `dash-gap` sizes; DTCG `live` group.
- Column hairlines on printed tables (PRT-080, DR-061).

### Fixed
- INT-001 and WRT-116 restored to the rule fragments so a rebuild keeps them.

## [1.1.0] - 2026-10-24
Open questions answered.

### Added
- Graph "Colour by" modes (Neutral default, Energy, Key, Genre) to `GraphControls` (DR-026).

### Changed
- `now` is its own amber token; selected stays brand lavender (DR-024).
- Booth statuses use the traffic-light set used in dark and light (DR-018 revised).
- `chart-1…8` use an Okabe-Ito based palette (DR-025).
- Finished `StagedProgress` steps use `status-ok` green; energy tier chips are a mini three-segment bar; filter rail visible from 1024px; library default columns without Last heard; tooltip shows at once on keyboard focus.
- Copy: "TIDAL" in capitals, "65%" without a space, weeks start Monday.
- Rotation is calculated by the weekly run from play data (DR-027).

### Removed
- The 3D graph and Camelot helix (DR-028).

## [1.0.0] - 2026-10-24
First release.

### Added
- Tokens for three themes (dark, light, booth), eight module hues, status, compatibility, energy 1-10, Camelot keys 1A-12B, charts, spacing, radius, shadow, size, z-index, motion, breakpoints, opacity (DR-001...DR-020).
- `00-core.css` primitives and the `SongNodes` helper bundle (icons, Camelot, compat, energy and BPM steps, formatting, status map, preferences).
- The component catalogue (navigation, inputs, data and music, charts, feedback and surfaces, pages) and guideline sections 01-19.
- Lucide 1.53 icon subset (109 icons) and self-hosted Sora, Inter, JetBrains Mono.
