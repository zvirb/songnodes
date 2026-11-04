# Changelog

All notable changes to the design system, newest first, in the style of Keep a Changelog. Source: 17-governance.md, Change log. Dates are Melbourne.

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
