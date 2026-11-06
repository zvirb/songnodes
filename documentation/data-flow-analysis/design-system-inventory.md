# SongNodes Design System Inventory & Token Specification

**Document Path:** `documentation/data-flow-analysis/design-system-inventory.md`  
**Governing Source:** `design-system/` (`tokens.json`, `tokens.css`, `design-system.json`, guidelines `01`–`19`)  
**Design System Version:** 1.4.0 (Synchronised in `frontend/src/styles/design-system/`)  
**Locale & Conventions:** `en-AU`, sentence case, `Australia/Melbourne` 24-hour time, single design-system source of truth.

---

## 1. Executive Overview & Single Source of Truth

The SongNodes design system is the immutable single source of truth for all formatting, visual styling, spatial rhythms, interaction mechanics, and iconography across SongNodes and its sister projects (including the Naarm Set Builder / `musicLibrary`). Where existing code, legacy CSS, or ad-hoc components disagree with the design system, the design system wins without exception.

```
┌────────────────────────────────────────────────────────┐
│               design-system/tokens.json                │
│                 (Canonical Definition)                 │
└───────────────────────────┬────────────────────────────┘
                            │ python build_tokens.py / sync-design-system.sh
       ┌────────────────────┴────────────────────┐
       ▼                                         ▼
┌───────────────────────────────┐ ┌───────────────────────────────┐
│ design-system/tokens.css      │ │ frontend/src/styles/          │
│ design-system/components/     │ │   design-system/bundle.css    │
│   bundle.css & bundle.js      │ │   design-system/bundle.js     │
└──────────────┬────────────────┘ └──────────────┬────────────────┘
               │                                 │
               ▼                                 ▼
┌───────────────────────────────┐ ┌───────────────────────────────┐
│ Self-Contained Web Report &   │ │ Live Web Application          │
│ Standalone SVG Diagrams       │ │ (React AppShell & Modules)    │
└───────────────────────────────┘ └───────────────────────────────┘
```

---

## 2. Colour & Theming Architecture

The system supports three native operational themes:
1. **Dark (Default)**: Optimized for studio, low-light selector sessions, and general UI (`:root`, `[data-theme="dark"]`).
2. **Light**: Mandatory for high ambient light and forced for `@media print` exports (`[data-theme="light"]`).
3. **Booth**: Ultra-high contrast mode (pure black `#000000` sunk background, `#ffffff` foreground) engineered specifically for high-glare DJ booth environments (`[data-theme="booth"]`).

### 2.1 Core Neutral & Structural Palette

| Token | Dark Theme | Light Theme | Booth Theme | Semantic Role / Description |
|---|---|---|---|---|
| `--bg` | `#222222` | `#f4f4f1` | `#080808` | Primary application canvas background |
| `--surface-1` | `#2d2d2d` | `#ffffff` | `#141414` | Primary card, panel, and table background |
| `--surface-2` | `#373737` | `#ecece8` | `#1f1f1f` | Hover states, raised sub-cards, active controls |
| `--surface-3` | `#414141` | `#e1e1dc` | `#2b2b2b` | Progress bar tracks, sunken wells, secondary borders |
| `--sunk` | `#1b1b1b` | `#e9e9e5` | `#000000` | Code blocks, recessed telemetry readouts, terminal panels |
| `--line` | `#3c3c3c` | `#d9d9d4` | `#2e2e2e` | Default subtle divider, card border, table horizontal rule |
| `--line-strong` | `#858585` | `#86867f` | `#666666` | Emphasised borders, active tab indicators, focus outlines |
| `--fg` | `#f9f9f9` | `#1c1c1e` | `#ffffff` | Primary text, bold display titles, prominent numerals |
| `--fg-2` | `#bbbbbb` | `#47474b` | `#e0e0e0` | Secondary body text, table cell standard text, icons |
| `--fg-3` | `#a3a3a3` | `#616166` | `#b0b0b0` | Tertiary metadata, lead-in titles, freshness timestamps |
| `--fg-disabled` | `#6a6a6a` | `#a3a3a0` | `#606060` | Disabled actions, unavailable options, unselected tabs |
| `--overlay` | `rgba(0,0,0,0.55)` | `rgba(20,20,24,0.40)` | `rgba(0,0,0,0.80)` | Modal and navigation drawer scrim backdrop |

### 2.2 Brand & Accent Tokens

| Token | Value (Dark) | Value (Light) | Usage |
|---|---|---|---|
| `--brand` | `#9b85cb` | `#6a52a6` | Primary action accent, focus ring colour |
| `--brand-strong` | `#b4a2dc` | `#56408f` | Text links, primary button active state |
| `--brand-soft` | `#332b45` | `#ebe5f7` | Selected row tint, active nav drawer item highlight |
| `--on-brand` | `#160f26` | `#ffffff` | Text and icons rendered directly on top of `--brand` |
| `--link` | `var(--brand-strong)` | `var(--brand)` | Hyperlink text colour |
| `--focus` | `var(--brand)` | `var(--brand)` | High-visibility accessible focus ring (`outline: 2px solid`) |

### 2.3 Domain Module Color Tokens

Every operational module in SongNodes has an assigned tonal identity token set, preventing color collision and giving immediate visual context:

| Module Domain | Main Token | Background (`-bg`) | Raised (`-raised`) | Border/Line (`-line`) | Ink Text (`-ink`) |
|---|---|---|---|---|---|
| **Graph (`--mod-graph`)** | `#6fa8dc` | `#22313e` | `#2d4256` | `#3d5872` | `#e2f0fe` |
| **Library (`--mod-library`)** | `#c9a85c` | `#362e1b` | `#4a3e22` | `#63532f` | `#f6eedc` |
| **Sets (`--mod-sets`)** | `#e08a5f` | `#3f291e` | `#573726` | `#744935` | `#feeae0` |
| **Paths (`--mod-paths`)** | `#d27aa8` | `#3e2732` | `#553345` | `#71455c` | `#fee7f2` |
| **Harmony (`--mod-harmony`)** | `#5fb8b0` | `#1e3432` | `#264743` | `#345e5a` | `#dff4f1` |
| **Sources (`--mod-sources`)** | `#8fbf6b` | `#27331e` | `#344627` | `#465d35` | `#e7f3de` |
| **Pipeline (`--mod-pipeline`)** | `#7fa1b3` | `#283135` | `#354249` | `#475861` | `#e7f0f5` |
| **Services (`--mod-services`)**| `#a5a07b` | `#312f26` | `#424032` | `#585644` | `#f0efe5` |

### 2.4 Operational Status & Compatibility Verdicts

Per design-system rule 07, status and verdict are **never communicated by colour alone**; they are always paired with an unambiguous glyph (`●`, `◐`, `▲`, `✕`, `↻`, `–`):

| State Token | Text/Glyph Colour | Background Colour | Glyph & Canonical Label | Semantic Meaning |
|---|---|---|---|---|
| `--status-ok` | `#5fd08f` | `#143321` | `● Healthy / Pass` | System nominal, test passed, sync verified |
| `--status-fair` | `#b6d35a` | `#282f11` | `◐ Degraded / Partial` | Non-fatal lag, partial playlist scrape, warning |
| `--status-warn` | `#efb54a` | `#38280c` | `▲ Review / Stale` | Review queue entry, uncalibrated score, backoff |
| `--status-bad` | `#ff7469` | `#41211e` | `✕ Error / Dead` | Ingestion job failed, dead-letter, broken transition |
| `--status-info` | `#bbbbbb` | `#2b2b2b` | `– Idle / Info` | Dormant worker, waiting job, neutral information |
| `--compat-perfect` | `var(--status-ok)` | `#143321` | `● Same key / energy` | Zero harmonic or energy clash |
| `--compat-compatible` | `var(--status-fair)`| `#282f11` | `◐ +1 / -1 Camelot` | Energy climb/drop within acceptable DJ limits |
| `--compat-possible` | `var(--status-warn)`| `#38280c` | `▲ ±2 step jump` | Modulated transition requiring energy compensation |
| `--compat-clash` | `var(--status-bad)` | `#41211e` | `✕ Clashing transition`| Discordant harmonic clash or unworkable energy leap |

### 2.5 Canonical 1–10 Energy Scale Palette

The canonical 1–10 energy scale represents dancefloor drive. Each step has an exact perceptual hue:

| Energy Step | Value | Hex Token | Tier Range | Descriptive Label |
|---|---|---|---|---|
| 1 | `1.0–1.9` | `#3b3a8f` | Low Tier | Ambient / Deep Warmup |
| 2 | `2.0–2.9` | `#4c3fa6` | Low Tier | Slow Burn Groove |
| 3 | `3.0–3.9` | `#6a43b3` | Low Tier | Steady Low Drive |
| 4 | `4.0–4.9` | `#8a47b5` | Low Tier | Bridge to Building |
| 5 | `5.0–5.9` | `#a94ba9` | Building Tier | Room Filling |
| 6 | `6.0–6.9` | `#c65293` | Building Tier | Tension Riser |
| 7 | `7.0–7.9` | `#dc6076` | Building Tier | Pre-Peak Stomp |
| 8 | `8.0–8.9` | `#ea7556` | High Tier | Peak Headline Drive |
| 9 | `9.0–9.9` | `#f19036` | High Tier | Maximum Velocity |
| 10 | `10.0` | `#f2b01e` | High Tier | Euphoric Overdrive |

---

## 3. Typography Architecture

SongNodes strictly pairs three typefaces:
- **Sora**: Display headings, thin–bold page headers, numerical hero figures.
- **Inter**: Body copy, form controls, descriptive text, documentation prose.
- **JetBrains Mono**: Tabular data, BPM, Camelot codes, transition metrics, database IDs, durations.

```
Font Stacks:
--font-display: "Sora", "Inter", system-ui, sans-serif
--font-body:    "Inter", system-ui, -apple-system, "Segoe UI", sans-serif
--font-data:    "JetBrains Mono", ui-monospace, Consolas, monospace
```

### 3.1 Type Scale Tokens

| Token Name | Family | Font Size | Line Height | Weight | Letter Spacing | Standard Usage |
|---|---|---|---|---|---|---|
| `display-xl` | Sora | `2.5rem` (40px) | `1.1` | 700 | `-0.01em` | Cover page, hero report titles |
| `title-l` | Sora | `1.75rem` (28px) | `1.2` | 700 | Normal | Page title (bold half of thin–bold title) |
| `title-m` | Sora | `1.375rem` (22px)| `1.25` | 700 | Normal | Section headings, modal dialog titles |
| `title-s` | Sora | `1.125rem` (18px)| `1.3` | 700 | Normal | Card titles, drawer group headers |
| `title-lead` | Sora | `1em` | `1.2` | 400 | Normal | Thin lead-in of thin–bold titles (`color: var(--fg-3)`) |
| `figure` | Sora | `2.0rem` (32px) | `1.05` | 700 | Normal | Large headline metric count tiles |
| `body-l` | Inter | `1.0625rem` (17px)| `1.55`| 400 | Normal | Executive summaries, lead paragraphs |
| `body` | Inter | `0.9375rem` (15px)| `1.45`| 400 | Normal | Standard UI, table cells, general copy |
| `body-strong`| Inter| `0.9375rem` (15px)| `1.45`| 600 | Normal | Table row headers, track titles, buttons |
| `body-s` | Inter | `0.8125rem` (13px)| `1.4` | 400 | Normal | Secondary metadata, helper text, toasts |
| `label` | Inter | `0.75rem` (12px) | `1.3` | 600 | `0.08em` | Eyebrow badges, column headers (CSS uppercase) |
| `caption` | Inter | `0.75rem` (12px) | `1.35`| 400 | Normal | Freshness timestamps, footnotes, chart notes |
| `data` | Mono | `0.8125rem` (13px)| `1.4` | 400 | Normal | BPM, Camelot keys, durations, hashes |
| `data-strong`| Mono | `0.8125rem` (13px)| `1.4` | 600 | Normal | Key transition delta (`+1 key · +2 BPM`) |
| `data-s` | Mono | `0.6875rem` (11px)| `1.35`| 400 | Normal | External IDs (ISRC, Spotify ID, UUID) |

### 3.2 Thin–Bold Title Pattern
Every major header uses the signature SongNodes pattern:
```html
<h1 class="sn-title title-l">
  <span class="sn-lead">Investigation:</span> Architectural Data Flow & System Topology
</h1>
```

---

## 4. Spacing, Geometry & Radius Tokens

### 4.1 Spacing Scale (4px Rhythmic Base)

```
Token        Value    Semantic Application
--space-0     0px     No margin or padding
--space-0.5   2px     Hairline nudges, meter segment gaps
--space-1     4px     Tight padding, pill inline gaps
--space-2     8px     Default control padding, badge spacing
--space-3    12px     Form field gap, table cell inline padding
--space-4    16px     Card padding (compact), layout gutters
--space-5    20px     Default card padding, panel padding
--space-6    24px     Inter-section spacing, drawer padding
--space-8    32px     Region separation (rail to content)
--space-10   40px     Major section top margins
--space-12   48px     Page top header breathing room
--space-16   64px     Hero block and empty state margins
```

### 4.2 Radius Scale (Object Scale Hierarchy)

```
Token             Value   Usage
--radius-chip      4px    Chips, tags, energy meter segments, key badges
--radius-control   8px    Buttons, inputs, selects, dropdowns, table shells
--radius-card     14px    Cards (neutral and tonal), figure metric tiles
--radius-sheet    18px    Navigation drawers, modal dialog surfaces
--radius-pill    999px    Status pills, category badges, switch tracks
```

### 4.3 Shadows & Elevation

```
Token        CSS Definition                                                Usage
--shadow-1   0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)       Resting cards, table containers
--shadow-2   0 4px 6px -1px rgba(0,0,0,0.2), 0 2px 4px -1px rgba(0,0,0,0.1) Floating dropdowns, sticky header
--shadow-3   0 20px 25px -5px rgba(0,0,0,0.3), 0 10px 10px -5px rgba(0,0,0,0.2) Drawers, modal dialogs above scrim
```

---

## 5. Component Patterns & UI Shell Rules

### 5.1 Application Shell (`AppShell`)
- **Header (`AppHeader`)**: Fixed height `var(--header-h, 56px)`, sticky top `z-index: 100`, frosted blur backdrop (`backdrop-filter: blur(8px)`), containing hamburger trigger, thin–bold title, live freshness badge, and preferences icon.
- **Navigation Drawer (`NavDrawer`)**: Left-sliding panel (`width: min(320px, 85vw)`), grouped into **Make** (`/sets`, `/paths`), **Explore** (`/graph`, `/library`, `/harmony`), **Collect** (`/sources`), and **System** (`/pipeline`, `/settings`).
- **Data Table (`sn-table`)**: Striped rows with `hover: var(--hover-bg)`, sticky headers with `background: var(--surface-1)`, tabular numbers in `var(--font-data)`.
- **Card (`sn-card`)**: Surface-1 background, 1px `--line` border, 14px border radius, 20px padding. Tonal variants use `--mod-*-bg` and `--mod-*-line`.

### 5.2 Print & Export Architecture (`@media print`)
Per guideline `15-print-export.md`:
- **Paper Dimensions**: A4 portrait (`210mm x 297mm`) standard; A4 landscape (`297mm x 210mm`) for wide matrices and architectural diagrams.
- **Margins**: `margin: 14mm 12mm 18mm`.
- **Theme Override**: Light theme forced; dark and booth backgrounds suppressed (`color-scheme: light`).
- **Suppressed UI**: Header, navigation drawers, floating buttons, action pills, interactive controls (`display: none !important`).
- **Page Break Rules**: `break-inside: avoid` on cards, figure tiles, and table rows; `break-after: avoid` on headings (`h1`, `h2`, `h3`); table headers repeat across pages (`thead { display: table-header-group; }`).
- **Traceability Footer**: Fixed running footer with document title, URL, timestamp in Melbourne time (`Australia/Melbourne`), data freshness stamp, and page counter (`Page X of Y`).

---

## 6. Verification & Token Conformance Guarantee

All diagrams, artifacts, reports, and generated web views produced in this investigation strictly utilise the tokens catalogued above. No raw hex codes (e.g. `#fff`, `#000`), raw pixel font sizes, or undeclared margin/padding rules are permitted.
