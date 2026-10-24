# SongNodes SDLC

How work moves from idea to release in SongNodes, and the gate each phase must pass.
Architecture milestones live in [IMPLEMENTATION_PLAN.md](../IMPLEMENTATION_PLAN.md);
progress and resume points live in [STATUS.md](../../STATUS.md). This document fixes the
lifecycle itself, with the **SongNodes design system** as a gate in every phase that
touches anything a person sees.

## §0 Governing decisions

| Topic | Decision | Source |
|---|---|---|
| Formatting and design | The SongNodes design system in [`design-system/`](../../design-system/README.md) is the **single source of truth** for every formatting and design decision (colour, type, spacing, shape, icons, motion, copy, number/date formatting, component markup, page patterns) in SongNodes and the music library. Where code, older CSS or a library default disagrees, the system wins. | Markus, 24 Oct 2026; [decision record](../decisions/2026-10-24-design-system-source-of-truth.md) |
| Design-system decision order | Markus's choices (DR-001…DR-030) > the design system > SongNodes `styles/tokens.css` > the Naarm Set Builder artifact > inline component styles | `design-system/02-information-architecture.md`, `17-governance.md` |
| Deriving rules | Markus's own decisions first; then fit the rule that reproduces existing artifacts (Naarm Set Builder tiers, set shapes, transition rules, rotation); then correct SongNodes code; then platform standards (WCAG 2.2 AA, WAI-ARIA APG); taste last, recorded as an open question | `design-system/17-governance.md` "How rules are derived" |
| Design-system distribution | Source artifact → `design-system/` mirror → `scripts/sync-design-system.sh` → `frontend/src/styles/design-system/` (plus `VERSION`). Nothing is edited downstream. | `17-governance.md` "Distribution" |
| Frontend migration | Phases 0–6 of `design-system/19-songnodes-migration.md`. Each phase ships on its own and removes what it replaces in the same change. | DS section 19 |
| Data integrity | Bronze → Silver → Gold → Operational; no layer skipping. Unknown metadata stays unknown, never invented. | [CLAUDE.md](../../CLAUDE.md), [AGENTS.md](../../AGENTS.md) |
| Delivery | GitOps (Git → Flux → Kubernetes); feature branches; conventional commits; E2E before merge | CLAUDE.md §3 |
| Open | Q9 score bands for recommendations: 80/60/40 until enough accepted picks exist, then fitted from Markus's own picks | `17-governance.md` open questions |

## §1 Lifecycle

```
  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
  │ 1 Define     │──▶│ 2 Design     │──▶│ 3 Build      │──▶│ 4 Verify     │──▶│ 5 Review     │──▶│ 6 Release    │
  │ requirement, │   │ page pattern,│   │ tokens, sn-* │   │ unit, E2E,   │   │ PR checklist,│   │ GitOps,      │
  │ data source  │   │ components,  │   │ classes, SN  │   │ DS conformance│  │ independent  │   │ STATUS.md    │
  │              │   │ copy         │   │ helpers      │   │ and visual   │   │ verifier     │   │              │
  └──────────────┘   └──────────────┘   └──────────────┘   └──────────────┘   └──────────────┘   └──────┬───────┘
         ▲                                                                                             │
         └──────────── 7 Operate: drift (DS version bump, conformance failure, user feedback) ◀────────┘
```

A design-system version bump is itself a change that enters at phase 1 (what changed in the system) and is synced in phase 3.

## §2 Repository layout (design-system related)

| Path | What | Who edits |
|---|---|---|
| `design-system/` | Mirror of the published SongNodes design-system artifact: brand book (`README.md`), sections `01`–`19`, `api/` cards, `components/` (guidelines, previews, `bundle.css`, `bundle.js`, `index.d.ts`), `tokens.json`/`tokens.css`, `fonts/`, `assets/Icons/`, `source/` build scripts | Only by re-pulling the artifact, or through `design-system/source/*` and its build scripts, with a version bump |
| `frontend/src/styles/design-system/` | Synced runtime copy and `VERSION` | `scripts/sync-design-system.sh` only |
| `frontend/src/lib/songnodes.tsx` | Typed wrapper around `window.SongNodes` and the small React primitives | Frontend |
| `frontend/src/shell/` | AppShell (AppHeader, NavDrawer), PageHeader, EmptyState, SectionHeading, LauncherCard, PreferencesPanel | Frontend |
| `frontend/src/pages/`, `frontend/src/features/` | Pages built on the system | Frontend |
| `frontend/src/styles/legacy-aliases.css` | Temporary bridge from legacy variables to tokens; removed in phase 6 | Nobody adds to it |
| `docs/design-system/` | How it works here (`README.md`), rendered reference (`reference.html`, `reference.standalone.html`), code-only reference (`CODE_REFERENCE.md`) and their generators | Regenerated after every sync |
| `.github/workflows/design-system.yml` | Conformance CI | Frontend |

## §3 The repeat unit: a page

Every surface is a page from the inventory in `design-system/02-information-architecture.md`. Adding or migrating one means filling this spec in the PR description:

```yaml
page: Library                     # exactly as in the IA inventory
module: library                   # graph | library | sets | paths | harmony | sources | pipeline | services | –
route: /library
pattern: LibraryPage              # design-system/components/<Pattern>
job: "Use this page to filter the crate and build a set from it"   # one job, no "and"
primary_action: Build set from crate                                # exactly one per view
components: [PageHeader, FilterRail, SearchField, DataTable, TrackCell, EnergyBar, KeyBadge, BpmReadout]
data: { source: public/data/music-library.json, authoritative: music library ledger, stamp: generated }
states: [loading, empty, error, offline, partial-data]              # each from design-system/07-feedback-status.md
status: planned                   # planned → building → verified → released → retired
```

## §4 Phase specifications

### 1 Define
- **Purpose:** state the need, the data and its authoritative source.
- **Inputs:** request, IMPLEMENTATION_PLAN milestone, `design-system/02-information-architecture.md`.
- **Outputs:** STATUS.md entry; page spec (§3) for any UI.
- **Gate D1:** the page or change maps to one IA inventory row (or a proposed new row). It has one job and one primary action. The data source and its authority are named (IA "Content imported from other sources").

### 2 Design
- **Purpose:** choose the pattern, components and copy from the system before any code.
- **Inputs:** `design-system/README.md`, the relevant sections (including `04-typography`, `01-writing`, `09-cognitive-load`), component cards `design-system/api/components/<Comp>.md`, `docs/design-system/reference.html`.
- **Outputs:** the component list and copy in the page spec; any gap written up as a proposed design-system change (new DR or component) instead of a local design.
- **Gate D2:** every visual element maps to a named token, class or component. Copy passes the `01-writing` rules (sentence case, verb plus object, en-AU, no emoji). Every state (loading, empty, error, offline) is chosen from `07-feedback-status`. There are no local design decisions.

### 3 Build
- **Purpose:** implement with the system only.
- **Inputs:** synced `frontend/src/styles/design-system/` (run `scripts/sync-design-system.sh` first), `frontend/src/lib/songnodes.tsx`, `frontend/src/shell/`.
- **Outputs:** code, unit tests, updated docs.
- **Gate B1:**
  - Zero hex, `rgb()` or named colours, px font sizes and raw z-index numbers in changed app code.
  - Zero emoji and zero `alert`/`confirm`/`prompt`.
  - Dates, durations, counts, BPM, keys, energy and statuses go through `SN` helpers.
  - Markup matches the component README and preview.
  - `frontend/src/styles/design-system/` is unchanged apart from a sync.

### 4 Verify
- **Purpose:** prove it works and conforms. Use more than one method: automated checks, rendered screenshots, and a manual pass.
- **Outputs:** test results with numbers in STATUS.md, plus screenshots.
- **Gate V1 (functional):** `npx tsc --noEmit` reports 0 errors, `npx vitest run src` passes, `npx vite build` passes, and `npm run test:e2e` runs with zero console errors.
- **Gate V2 (design system):** `scripts/sync-design-system.sh --check` passes and the conformance job in `.github/workflows/design-system.yml` passes. axe reports no serious or critical violations.
- **Gate V3 (visual):** screenshots in dark, light and booth at 1440px and 390px show no horizontal scroll at 390px. The page survives text size XL. The primary button count per view is exactly 1 (or 0 for read-only pages).

### 5 Review
- **Purpose:** an independent check that does not grade its own work.
- **Outputs:** the PR with the design-system checklist ticked (`.github/pull_request_template.md`).
- **Gate R1:** a reviewer, or a separate verifier agent that did not write the change, compares the rendered page against `docs/design-system/reference.html` and the component previews, and confirms D2/B1/V2/V3. Deviations are either fixed or recorded as `EX-NNN` exceptions approved by Markus (`17-governance` "Exceptions").

### 6 Release
- **Purpose:** ship through GitOps.
- **Outputs:** `npm run build` then `docker build`, Flux reconcile, STATUS.md result, and the page spec status set to `released`.
- **Gate L1:** the release notes name the design-system version (`frontend/src/styles/design-system/VERSION`). No page ships on an older system version than the rest of the app.

### 7 Operate and drift
- **Triggers:** a new design-system version, a conformance failure on `main`, or user feedback.
- **Gate O1:** a version bump is synced in one PR, with the change log excerpt in the body (`17-governance` "Distribution"). The docs generators in `docs/design-system/` are re-run in the same PR.

## §5 Cross-cutting requirements

- **One source:** design values exist only in the system. Downstream copies are generated. Legacy stylesheets are bridged by `legacy-aliases.css` until phase 6 deletes them.
- **Determinism:** the same tokens and helpers (`bundle.js`) run in the React app, the music library pages and the docs reference, so formatting cannot diverge.
- **Accessibility:** WCAG 2.2 AA; the focus ring on every interactive element; status is always glyph plus word; reduced motion is respected.
- **Locale:** en-AU, Australia/Melbourne, 24-hour. Stored times are UTC and converted on display only.
- **Offline:** fonts are self-hosted from `design-system/fonts/`; no CDN or Google Fonts requests.
- **Documentation:** any change to how the system is consumed updates `docs/design-system/README.md`. Any sync re-runs the reference generators.

## §6 Versioning

- The design system follows semver in `design-system/tokens.json` `version`, and it must equal `SongNodes.version` in `bundle.js`. The sync script fails if they differ or if the version goes backwards.
- The frontend records the synced version in `frontend/src/styles/design-system/VERSION`. Release notes and STATUS.md cite it.
- Major bumps (renamed or removed tokens or classes) need a deprecation alias for one minor release (`17-governance` "Versioning").

## §7 Work breakdown: design-system migration

| WP | Scope (design-system/19 phase) | Depends on | Gate | Verifier (WPV) |
|---|---|---|---|---|
| WP0 | Foundations: `design-system/` mirror, sync script and `VERSION`, `index.html` head, fonts, favicon, import order, legacy alias bridge | – | V2 sync check; no theme flash; no external font requests | Separate agent re-runs sync `--check` and inspects the network log |
| WP1 | Domain truth: `utils/camelot.ts` on `SN.camelot`/`compat`, `displayEnergy`, delete wrong Camelot tables | WP0 | 24-key round trip test; grep for `camelotData`/`getEnergyColor`/`COMPATIBILITY_PROPS` is empty | Unit tests reviewed by a non-author |
| WP2 | Shell and routes: router, AppShell, AppHeader, NavDrawer, Home, Settings preferences, AuthCallbackPage, ErrorPage | WP0 | Every route reachable from the drawer; Back/Forward restore state; axe clean | Playwright walk of every drawer row |
| WP3 | Surfaces and feedback: Dialog, ConfirmDialog, SideSheet, Toast, Popover; z-index tokens | WP2 | ESLint `no-alert`; no `zIndex` ≥ 100 literals | grep plus a one-dialog-at-a-time test |
| WP4 | Pages: Library and Set builder (music library), Graph explorer, Track detail, Settings, Log pages, review queue | WP2, WP3 | V3 in all themes; one primary per view; 375px without scroll | Screenshot review against `reference.html` |
| WP5 | Graph: `graphColours()`, edge patterns, node states, live theme switch | WP0 | No hex in `GraphVisualization.tsx`; theme switch recolours without reload | Visual diff dark/light/booth |
| WP6 | Clean-up: delete legacy CSS, `legacy-aliases.css`, Tailwind, `components/ui`, duplicates, demo pages; widen CI conformance to all of `src/` | WP1–WP5 | `npm run build`; stylelint/grep "no hex outside design-system"; emoji grep empty; bundle no larger than before WP0 | Independent full-repo conformance run |
| WP7 | Docs and index reconciliation: README, CLAUDE.md, AGENTS.md, CONTRIBUTING, PR template, this SDLC, `docs/design-system/*` regenerated | each WP | Every path named in these docs exists | Link check script |

Status of each WP is tracked in [STATUS.md](../../STATUS.md).
