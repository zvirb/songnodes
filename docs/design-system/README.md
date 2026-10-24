# The design system in this repo

The SongNodes design system is the single source of truth for every formatting and design decision in SongNodes and the music library: colour, type, spacing, radius, shadow, z-index, motion, icons, copy, date and number formatting, component markup and page patterns. If anything else disagrees (older CSS, a component, a library default or taste), the design system wins.

This folder explains how it works here. The system itself lives in [`design-system/`](../../design-system/README.md).

| You want | Open |
|---|---|
| What it should look like, rendered live in every theme | [`reference.html`](reference.html) (serve the repo root, or open the file; the self-contained copy is `reference.standalone.html`) |
| Code only: import order, every token, helper API, React exports, markup for all 92 components, rules, checks | [`CODE_REFERENCE.md`](CODE_REFERENCE.md) |
| The brand book, component index and full rules | [`design-system/README.md`](../../design-system/README.md) and the 19 sections below |

## Where it lives

- **Source:** `design-system/`. It mirrors the published design-system artifact. Treat it as read-only in this repo; it is not edited by hand downstream.
- **What is in it:** `tokens.json` (every token, with the version), `tokens.css` (the tokens as CSS variables plus `@font-face`), `components/bundle.css` (every `sn-*` class), `components/bundle.js` (defines `window.SongNodes`), `components/<Comp>/README.md` and `preview.html` for 92 components, `components/index.d.ts` and `source/types/*.d.ts` (props and the helper API), `fonts/` (Sora, Inter, JetBrains Mono, self-hosted), and the generators in `source/`.
- **Version:** one semver number in `tokens.json` and `SongNodes.version`; they must match. Currently 1.1.0.

## How it reaches the app

1. `scripts/sync-design-system.sh` copies `tokens.css`, `components/bundle.css`, `components/bundle.js`, `components/index.d.ts`, `source/types/*.d.ts` and `fonts/*.woff2` into `frontend/src/styles/design-system/`, and writes the synced version to `frontend/src/styles/design-system/VERSION`. It refuses to go backwards and fails if `tokens.json` and `bundle.js` disagree. Never edit the synced folder.
2. `scripts/sync-design-system.sh --check` fails when the synced copy drifts from `design-system/`. Run it on every UI change; CI runs it too.
3. `frontend/src/main.tsx` imports the styles in this order:
   1. the legacy stylesheets (`styles/tokens.css`, `globals.css`, `global.css`), kept only until migration phase 6
   2. `styles/design-system/tokens.css`
   3. `styles/design-system/bundle.css`
   4. `styles/legacy-aliases.css`
   5. `styles/app.css` (app layout only)

   It then calls `SN.prefs.init()` so the saved theme, text size, density and motion apply before first paint.
4. `styles/legacy-aliases.css` is a temporary bridge. It re-points the old variable names (`--color-bg-primary` and friends) at design-system tokens, so unmigrated components already render in the system's palette. Do not add to it; new code uses tokens directly. Phase 6 of `19-songnodes-migration.md` deletes it with the legacy stylesheets.
5. React reaches the helpers through `frontend/src/lib/songnodes.tsx`: `SN` (typed `window.SongNodes`), `SnIcon`, `Title`, `EnergyBar`, `KeyBadge`, `Bpm`, `StatusPill`, `CompatPill`, `MODULE_ROUTES` and `moduleOf`.
6. The shell in `frontend/src/shell/` mirrors the component markup: `AppShell` (AppHeader, NavDrawer and the outlet; pages set their title with `usePageHeader`), `PageParts` (`PageHeader`, `EmptyState`, `SectionHeading`, `LauncherCard`) and `PreferencesPanel`.

Pages outside the React app (the music library, artifacts, `reference.html`) load the same three files and the fonts directly: `tokens.css`, then `components/bundle.css`, then `components/bundle.js`, then `SongNodes.prefs.init()` inline in `<head>`.

## How to change it

1. Change it at the source: the design-system artifact, or `design-system/source/` in a change that mirrors it. Colours, type and scales live in `source/build_tokens.py`; classes in `source/css/*.css`; helpers in `source/bundle.src.js`.
2. Rebuild from `design-system/`: `python3 source/build_tokens.py .` (writes `tokens.json` and `tokens.css`, prints the contrast report; nothing ships with a failing pair), then `python3 source/build_bundle.py` (inlines the icons, writes `components/bundle.css` and `components/bundle.js`).
3. Bump the version per `17-governance.md`: major for a rename, removal or change of meaning; minor for anything added; patch for a value fix. Deprecate before removing, add a change-log line, and write a decision record for any choice that could reasonably go another way.
4. Re-sync with `scripts/sync-design-system.sh` and open a normal pull request with the version in the title and the change-log excerpt in the body.
5. Regenerate the docs here: `python3 docs/design-system/gen_code_reference.py` and `python3 docs/design-system/build_standalone.py` (both from the repo root, stdlib only).

A conflict the system does not settle is a change to the system, not a local override. A one-off exception needs an `EX-NNN` entry approved by Markus and a `/* design-system exception EX-NNN */` comment at the site.

## When things conflict

Decide in this order and stop at the first that answers:

1. Markus's own decisions: the decision records in `17-governance.md` (DR-001 to DR-030) and his later corrections.
2. The design-system files for the thing in hand: the component's `components/<Comp>/README.md` and `api/components/<Comp>.md`, then the guideline section, then the brand book in `design-system/README.md`, then the token's usage note in `tokens.json`.
3. What the existing artifacts already do (the Naarm Set Builder's tiers, set shapes, transition rules and weekly run): fit the rule that reproduces them rather than inventing a value.
4. SongNodes code where it is correct (for example backend status enums, `utils/harmonic.ts`).
5. Platform standards: WCAG 2.2 AA, WAI-ARIA Authoring Practices, Lucide conventions.
6. Taste, last, recorded as an open question in `17-governance.md`.

Legacy CSS, Tailwind classes, a library default or the synced copy never win.

## Conformance checks

From `17-governance.md`; the commands are in [`CODE_REFERENCE.md`](CODE_REFERENCE.md#conformance-checks-17-governance).

CI (`.github/workflows/design-system.yml`) runs the colour, emoji and dialog checks on
every tracked file in `frontend/src` except the synced copy, `lib/graphColours.ts` and
the files in [`frontend/design-system-pending.txt`](../../frontend/design-system-pending.txt),
which are still waiting for migration. That list only shrinks: CI fails if a listed file
is clean or gone. The accessibility check runs in the E2E suite
(`frontend/tests/e2e/accessibility.spec.ts`); approved exceptions are in
[`EXCEPTIONS.md`](EXCEPTIONS.md).

| Check | Fails when |
|---|---|
| No raw colours | Any hex, `rgb()` or named colour in app code outside `styles/design-system/` |
| No emoji | Any character in U+1F300–1FAFF or U+2600–27BF outside comments (the system's own status and key glyphs, such as ✕ and ♭, come from the bundle) |
| No `alert` / `confirm` / `prompt` | Any call (ESLint `no-alert`) |
| Accessibility | Any serious or critical axe-core violation on any route or theme |
| Contrast | Any pair in the `build_tokens.py` report below 4.5:1 (3:1 for large text and UI edges) |
| Visual | Playwright snapshots of every `preview.html` and key routes differ without an approved update |
| Version sync | `tokens.json` and `SongNodes.version` differ, or `sync-design-system.sh --check` fails |

Before each minor or major release, also run the pre-release review checklist in `09-cognitive-load.md`.

## The 19 sections

| # | Section | # | Section |
|---|---|---|---|
| 01 | [Writing and content](../../design-system/01-writing.md) | 11 | [Data display](../../design-system/11-data-display.md) |
| 02 | [Information architecture](../../design-system/02-information-architecture.md) | 12 | [Inputs and actions](../../design-system/12-inputs.md) |
| 03 | [Colour](../../design-system/03-colour.md) | 13 | [Page patterns](../../design-system/13-page-patterns.md) |
| 04 | [Typography](../../design-system/04-typography.md) | 14 | [Identity and icons](../../design-system/14-identity-icons.md) |
| 05 | [Layout](../../design-system/05-layout.md) | 15 | [Print and export](../../design-system/15-print-export.md) |
| 06 | [Interaction and accessibility](../../design-system/06-interaction-accessibility.md) | 16 | [Platform](../../design-system/16-platform.md) |
| 07 | [Feedback and status](../../design-system/07-feedback-status.md) | 17 | [Governance](../../design-system/17-governance.md) |
| 08 | [Motion](../../design-system/08-motion.md) | 18 | [Music domain](../../design-system/18-music-domain.md) |
| 09 | [Cognitive load](../../design-system/09-cognitive-load.md) | 19 | [SongNodes migration](../../design-system/19-songnodes-migration.md) |
| 10 | [Navigation](../../design-system/10-navigation.md) | | |

## Files in this folder

| File | What it is |
|---|---|
| `README.md` | This page |
| `reference.html` | Rendered reference; loads `../../design-system/` by relative path |
| `reference.standalone.html` | Generated self-contained copy (CSS, JS and fonts inlined) for sharing; do not edit |
| `build_standalone.py` | Builds the standalone copy |
| `CODE_REFERENCE.md` | Code-only reference; the token, helper, React and component blocks are generated |
| `gen_code_reference.py` | Regenerates those blocks from `design-system/` and `frontend/src/` |
