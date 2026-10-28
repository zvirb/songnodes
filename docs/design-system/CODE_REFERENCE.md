# SongNodes design system: code reference

<!-- Code only. Source of truth: design-system/ (read-only). Generated blocks: python3 docs/design-system/gen_code_reference.py -->

## Import order

```ts
// frontend/src/main.tsx
import './styles/tokens.css';                      // legacy, removed in migration phase 6
import './styles/globals.css';                     // legacy
import './styles/global.css';                      // legacy
import './styles/design-system/tokens.css';        // 1. every token + @font-face
import './styles/design-system/bundle.css';        // 2. every sn-* class
import './styles/legacy-aliases.css';              // temporary bridge: old --color-* names -> tokens
import './styles/app.css';                         // 3. app layout only
import { SN } from './lib/songnodes';              // 4. window.SongNodes (bundle.js), typed
SN.prefs.init();
```

```html
<!-- any standalone page -->
<link rel="stylesheet" href="design-system/tokens.css">
<link rel="stylesheet" href="design-system/components/bundle.css">
<script src="design-system/components/bundle.js"></script>
<script>SongNodes.prefs.init();</script>
```

```bash
scripts/sync-design-system.sh           # copy design-system/ -> frontend/src/styles/design-system/, write VERSION
scripts/sync-design-system.sh --check   # CI: fail on drift or version mismatch
cd design-system && python3 source/build_tokens.py . && python3 source/build_bundle.py   # rebuild at the source
```

## Tokens

<!-- BEGIN GENERATED: tokens -->
<!-- tokens.json 1.2.0; themes: dark (Dark), light (Light), booth (Booth) -->

### Colour (`var(--name)`; value per theme where they differ)

#### Surfaces and lines

| Token | Value | Usage |
|---|---|---|
| `--bg` | dark `#222222` · light `#f4f4f1` · booth `#000000` | Page background (Elektronauts charcoal in dark). Everything sits on it. |
| `--surface-1` | dark `#2d2d2d` · light `#ffffff` · booth `#0f0f0f` | Panels, neutral cards, table body, drawer, dialog. |
| `--surface-2` | dark `#373737` · light `#ecece8` · booth `#1c1c1c` | Raised parts inside a surface-1 panel: table header, hovered row, segmented-control track. |
| `--surface-3` | dark `#414141` · light `#e1e1dc` · booth `#2a2a2a` | Pressed/selected neutral fills, progress tracks, skeleton shimmer base. |
| `--sunk` | dark `#1b1b1b` · light `#e9e9e5` · booth `#000000` | Inputs, code wells, the transition strip between set rows. |
| `--line` | dark `#3c3c3c` · light `#d9d9d4` · booth `#5e5e5e` | Dividers and hairlines between rows and sections. Decorative only: never the only edge of a control. |
| `--line-strong` | dark `#858585` · light `#86867f` · booth `#a8a8a8` | Control borders (inputs, secondary buttons, chips, checkboxes). Holds 3:1 on bg, surface-1 and surface-2. |
| `--overlay` | dark `rgba(0, 0, 0, 0.55)` · light `rgba(20, 20, 24, 0.40)` · booth `rgba(0, 0, 0, 0.80)` | Scrim behind drawers and dialogs. |
| `--hover-bg` | dark `rgba(255, 255, 255, 0.06)` · light `rgba(0, 0, 0, 0.045)` · booth `rgba(255, 255, 255, 0.14)` | Hover wash on rows, menu items and quiet buttons. |
| `--flag-bg` | dark `#3a3020` · light `#fbf0d9` · booth `#3a2a00` | Background for a row or cell flagged for attention (needs an energy check, duplicate, stale). The only tint used for flagging; pair with a warn marker. |

#### Text

| Token | Value | Usage |
|---|---|---|
| `--fg` | dark `#f9f9f9` · light `#1c1c1e` · booth `#ffffff` | Primary text and icons on bg, surface-1, surface-2 and surface-3. |
| `--fg-2` | dark `#bbbbbb` · light `#47474b` · booth `#e8e8e8` | Secondary text: metadata lines, table cells that support the main column. 4.5:1 on bg, surface-1, surface-2. |
| `--fg-3` | dark `#a3a3a3` · light `#616166` · booth `#cfcfcf` | Tertiary text: the dimmed lead-in of a thin–bold title, captions, column headers. 4.5:1 on bg and surface-1. |
| `--fg-disabled` | dark `#6a6a6a` · light `#a3a3a0` · booth `#8a8a8a` | Disabled labels only (exempt from contrast). Pair with not-allowed cursor and aria-disabled. |

#### Brand, link, focus

| Token | Value | Usage |
|---|---|---|
| `--brand` | dark `#9b85cb` · light `#6a52a6` · booth `#c9b9f0` | SongNodes itself: wordmark, the one primary button per view, focus ring, selection outline, the generic link colour where no module applies. Never a status. |
| `--brand-strong` | dark `#b4a2dc` · light `#56408f` · booth `#e0d6fa` | Hover and pressed state of brand fills and brand text. |
| `--brand-soft` | dark `#332b45` · light `#ebe5f7` · booth `#271e3d` | Selected row / selected chip background, current item in the drawer. |
| `--on-brand` | dark `#160f26` · light `#ffffff` · booth `#000000` | Text and icons on a brand fill (primary button). |
| `--link` | dark `var(--brand-strong)` · light `var(--brand)` · booth `var(--brand)` | Generic text link colour where a link leads nowhere module-specific (help, external sites). Dark uses brand-strong so it holds 4.5:1 on surface-1 and surface-2. Always underlined. |
| `--focus` | `var(--brand)` | Focus ring: 2px solid, 2px offset, on every interactive element. Brand lavender holds 3:1 on every surface in every theme. |

#### Modules

| Token | Value | Usage |
|---|---|---|
| `--mod-graph` | dark `#6fa8dc` · light `#2b679a` · booth `#acd6fe` | Graph identity: its menu icon, any text link leading to Graph, chart marks that mean 'Graph'. Explore the track graph: nodes, edges, neighbourhoods. Reads 4.5:1 on bg and surface-1. |
| `--mod-graph-bg` | dark `#22313e` · light `#e5f2fe` · booth `#081725` | Tonal card fill for Graph cards and the Graph page header band. |
| `--mod-graph-raised` | dark `#2d4256` · light `#cbe5fd` · booth `#162d42` | Chips, inner wells and secondary buttons inside a Graph tonal card. |
| `--mod-graph-line` | dark `#3d5872` · light `#accbe9` · booth `#658aad` | Border of a Graph tonal card and dividers inside it. |
| `--mod-graph-ink` | dark `#e2f0fe` · light `#14283b` · booth `#fafcfe` | Titles and primary text inside a Graph tonal card (on mod-graph-bg and mod-graph-raised). |
| `--mod-graph-muted` | dark `#acc8e3` · light `#2d4a66` · booth `#d1e8fe` | Secondary text inside a Graph tonal card. |
| `--on-mod-graph` | dark `#0a1c2c` · light `#ffffff` · booth `#000000` | Text on a solid Graph fill (a Graph action button inside its own page, the module chip in the drawer). |
| `--mod-library` | dark `#c9a85c` · light `#7d5e01` · booth `#e9ce92` | Library identity: its menu icon, any text link leading to Library, chart marks that mean 'Library'. The crate: every track, filters, rotation, sources. Reads 4.5:1 on bg and surface-1. |
| `--mod-library-bg` | dark `#362e1b` · light `#f9efda` · booth `#1d1502` | Tonal card fill for Library cards and the Library page header band. |
| `--mod-library-raised` | dark `#4a3e22` · light `#eee0c0` · booth `#372908` | Chips, inner wells and secondary buttons inside a Library tonal card. |
| `--mod-library-line` | dark `#63532f` · light `#d8c59e` · booth `#998352` | Border of a Library tonal card and dividers inside it. |
| `--mod-library-ink` | dark `#f6eedc` · light `#302508` · booth `#fffbf4` | Titles and primary text inside a Library tonal card (on mod-library-bg and mod-library-raised). |
| `--mod-library-muted` | dark `#d3c29f` · light `#56451d` · booth `#f1e3c6` | Secondary text inside a Library tonal card. |
| `--on-mod-library` | dark `#231902` · light `#ffffff` · booth `#000000` | Text on a solid Library fill (a Library action button inside its own page, the module chip in the drawer). |
| `--mod-sets` | dark `#e08a5f` · light `#9b4816` · booth `#fec1a4` | Set builder identity: its menu icon, any text link leading to Set builder, chart marks that mean 'Set builder'. Sets and setlists: running order, energy wave, saved sets. Reads 4.5:1 on bg and surface-1. |
| `--mod-sets-bg` | dark `#3f291e` · light `#ffece3` · booth `#250f05` | Tonal card fill for Set builder cards and the Set builder page header band. |
| `--mod-sets-raised` | dark `#573726` · light `#fcd9c8` · booth `#43210f` | Chips, inner wells and secondary buttons inside a Set builder tonal card. |
| `--mod-sets-line` | dark `#744935` · light `#e9bca7` · booth `#b0765a` | Border of a Set builder tonal card and dividers inside it. |
| `--mod-sets-ink` | dark `#feeae0` · light `#3c1d0d` · booth `#fefbf9` | Titles and primary text inside a Set builder tonal card (on mod-sets-bg and mod-sets-raised). |
| `--mod-sets-muted` | dark `#e6b9a4` · light `#673a24` · booth `#ffdccc` | Secondary text inside a Set builder tonal card. |
| `--on-mod-sets` | dark `#2c1206` · light `#ffffff` · booth `#000000` | Text on a solid Set builder fill (a Set builder action button inside its own page, the module chip in the drawer). |
| `--mod-paths` | dark `#d27aa8` · light `#964070` · booth `#feb9db` | Pathfinder identity: its menu icon, any text link leading to Pathfinder, chart marks that mean 'Pathfinder'. Routes between tracks: start, waypoints, finish. Reads 4.5:1 on bg and surface-1. |
| `--mod-paths-bg` | dark `#3e2732` · light `#ffe9f3` · booth `#240d19` | Tonal card fill for Pathfinder cards and the Pathfinder page header band. |
| `--mod-paths-raised` | dark `#553345` · light `#f9d6e6` · booth `#411d31` | Chips, inner wells and secondary buttons inside a Pathfinder tonal card. |
| `--mod-paths-line` | dark `#71455c` · light `#e6b8ce` · booth `#ad718f` | Border of a Pathfinder tonal card and dividers inside it. |
| `--mod-paths-ink` | dark `#fee7f2` · light `#3a1a2b` · booth `#fefbfc` | Titles and primary text inside a Pathfinder tonal card (on mod-paths-bg and mod-paths-raised). |
| `--mod-paths-muted` | dark `#e3b5cb` · light `#64364e` · booth `#ffd8ea` | Secondary text inside a Pathfinder tonal card. |
| `--on-mod-paths` | dark `#2b101e` · light `#ffffff` · booth `#000000` | Text on a solid Pathfinder fill (a Pathfinder action button inside its own page, the module chip in the drawer). |
| `--mod-harmony` | dark `#5fb8b0` · light `#00736c` · booth `#9ce0d9` | Key & mood identity: its menu icon, any text link leading to Key & mood, chart marks that mean 'Key & mood'. Camelot keys, mood and energy analysis. Reads 4.5:1 on bg and surface-1. |
| `--mod-harmony-bg` | dark `#1e3432` · light `#def6f3` · booth `#031a18` | Tonal card fill for Key & mood cards and the Key & mood page header band. |
| `--mod-harmony-raised` | dark `#264743` · light `#c5eae6` · booth `#0b322f` | Chips, inner wells and secondary buttons inside a Key & mood tonal card. |
| `--mod-harmony-line` | dark `#345e5a` · light `#a5d2cd` · booth `#59928d` | Border of a Key & mood tonal card and dividers inside it. |
| `--mod-harmony-ink` | dark `#dff4f1` · light `#0a2d2a` · booth `#f5fefd` | Titles and primary text inside a Key & mood tonal card (on mod-harmony-bg and mod-harmony-raised). |
| `--mod-harmony-muted` | dark `#a5cec9` · light `#21514d` · booth `#ccede9` | Secondary text inside a Key & mood tonal card. |
| `--on-mod-harmony` | dark `#03201d` · light `#ffffff` · booth `#000000` | Text on a solid Key & mood fill (a Key & mood action button inside its own page, the module chip in the drawer). |
| `--mod-sources` | dark `#8fbf6b` · light `#447214` · booth `#b8df9c` | Sources identity: its menu icon, any text link leading to Sources, chart marks that mean 'Sources'. Where tracks come from: tracklists, radio, target tracks, imports. Reads 4.5:1 on bg and surface-1. |
| `--mod-sources-bg` | dark `#27331e` · light `#e8f5e0` · booth `#0e1a05` | Tonal card fill for Sources cards and the Sources page header band. |
| `--mod-sources-raised` | dark `#344627` · light `#d6e8ca` · booth `#1f320f` | Chips, inner wells and secondary buttons inside a Sources tonal card. |
| `--mod-sources-line` | dark `#465d35` · light `#b8d0a8` · booth `#72925a` | Border of a Sources tonal card and dividers inside it. |
| `--mod-sources-ink` | dark `#e7f3de` · light `#1b2c0e` · booth `#f9fdf6` | Titles and primary text inside a Sources tonal card (on mod-sources-bg and mod-sources-raised). |
| `--mod-sources-muted` | dark `#b5cda5` · light `#375024` · booth `#d8eccb` | Secondary text inside a Sources tonal card. |
| `--on-mod-sources` | dark `#111f06` · light `#ffffff` · booth `#000000` | Text on a solid Sources fill (a Sources action button inside its own page, the module chip in the drawer). |
| `--mod-pipeline` | dark `#7fa1b3` · light `#46687a` · booth `#bad6e5` | Pipeline identity: its menu icon, any text link leading to Pipeline, chart marks that mean 'Pipeline'. Scrapers, jobs, enrichment, health and data quality. Reads 4.5:1 on bg and surface-1. |
| `--mod-pipeline-bg` | dark `#283135` · light `#e7f2f8` · booth `#0f171c` | Tonal card fill for Pipeline cards and the Pipeline page header band. |
| `--mod-pipeline-raised` | dark `#354249` · light `#d4e4ed` · booth `#202e35` | Chips, inner wells and secondary buttons inside a Pipeline tonal card. |
| `--mod-pipeline-line` | dark `#475861` · light `#b8cbd5` · booth `#738a96` | Border of a Pipeline tonal card and dividers inside it. |
| `--mod-pipeline-ink` | dark `#e7f0f5` · light `#1c282f` · booth `#f9fcfe` | Titles and primary text inside a Pipeline tonal card (on mod-pipeline-bg and mod-pipeline-raised). |
| `--mod-pipeline-muted` | dark `#b6c7d1` · light `#394b54` · booth `#d9e7ef` | Secondary text inside a Pipeline tonal card. |
| `--on-mod-pipeline` | dark `#121c22` · light `#ffffff` · booth `#000000` | Text on a solid Pipeline fill (a Pipeline action button inside its own page, the module chip in the drawer). |
| `--mod-services` | dark `#a5a07b` · light `#6a6440` · booth `#d6d2b4` | Services identity: its menu icon, any text link leading to Services, chart marks that mean 'Services'. Connected services and settings: Spotify, TIDAL, API keys. Reads 4.5:1 on bg and surface-1. |
| `--mod-services-bg` | dark `#312f26` · light `#f2f1e5` · booth `#18160d` | Tonal card fill for Services cards and the Services page header band. |
| `--mod-services-raised` | dark `#424032` · light `#e4e2d1` · booth `#2e2c1d` | Chips, inner wells and secondary buttons inside a Services tonal card. |
| `--mod-services-line` | dark `#585644` · light `#cbc8b3` · booth `#8a876e` | Border of a Services tonal card and dividers inside it. |
| `--mod-services-ink` | dark `#f0efe5` · light `#29271a` · booth `#fdfcf5` | Titles and primary text inside a Services tonal card (on mod-services-bg and mod-services-raised). |
| `--mod-services-muted` | dark `#c7c5b2` · light `#4b4835` · booth `#e7e5d6` | Secondary text inside a Services tonal card. |
| `--on-mod-services` | dark `#1d1b10` · light `#ffffff` · booth `#000000` | Text on a solid Services fill (a Services action button inside its own page, the module chip in the drawer). |

#### Status

| Token | Value | Usage |
|---|---|---|
| `--status-ok` | dark `#5fd08f` · light `#1d7a45` · booth `#6fe0a0` | Healthy / passed / perfect transition. Always with the ● glyph or the word. Text/icon colour, 4.5:1 on bg, surface-1 and its own -bg. |
| `--status-ok-bg` | dark `#143321` · light `#daf7e2` · booth `#001709` | Tinted fill behind a ok banner, pill or cell. |
| `--status-fair` | dark `#b6d35a` · light `#5d7414` · booth `#c6e36a` | Acceptable but not ideal: compatible transition, degraded-but-working. With the ◐ glyph. Text/icon colour, 4.5:1 on bg, surface-1 and its own -bg. |
| `--status-fair-bg` | dark `#282f11` · light `#e9f4d5` · booth `#0f1400` | Tinted fill behind a fair banner, pill or cell. |
| `--status-warn` | dark `#efb54a` · light `#8a5a00` · booth `#f7c35a` | Needs a look: stale data, retrying, needs a check. With the ▲ glyph (compat-possible uses ○). Text/icon colour, 4.5:1 on bg, surface-1 and its own -bg. |
| `--status-warn-bg` | dark `#38280c` · light `#feebd3` · booth `#1a0f00` | Tinted fill behind a warn banner, pill or cell. |
| `--status-bad` | dark `#ff7469` · light `#b3261e` · booth `#ff8a80` | Failed / clash / error. With the ✕ glyph. Traffic light in every theme, so the glyph and word are what make it readable without colour. Text/icon colour, 4.5:1 on bg, surface-1 and its own -bg. |
| `--status-bad-bg` | dark `#41211e` · light `#fee9e5` · booth `#240706` | Tinted fill behind a bad banner, pill or cell. |
| `--status-info` | dark `#bbbbbb` · light `#47474b` · booth `#e8e8e8` | Neutral information. Deliberately grey: blue belongs to the Graph module. Text/icon colour, 4.5:1 on bg, surface-1 and its own -bg. |
| `--status-info-bg` | dark `#2b2b2b` · light `#eeeef0` · booth `#121212` | Tinted fill behind a info banner, pill or cell. |
| `--on-status-bad` | dark `#2a0806` · light `#ffffff` · booth `#000000` | Text on a solid bad fill: the destructive button. |

#### Compatibility

| Token | Value | Usage |
|---|---|---|
| `--compat-perfect` | `var(--status-ok)` | Transition / harmonic compatibility: perfect (same key, relative major/minor). Glyph ●. |
| `--compat-compatible` | `var(--status-fair)` | Compatible (±1 on the Camelot wheel). Glyph ◐. |
| `--compat-possible` | `var(--status-warn)` | Possible with care (+2 energy boost, +7 lift, BPM gap 5–8). Glyph ○. |
| `--compat-clash` | `var(--status-bad)` | Clash (any other key move, BPM gap > 8, energy jump ≥ +2). Glyph ✕. |

#### Progress

| Token | Value | Usage |
|---|---|---|
| `--progress-fill` | `var(--fg-2)` | Completion bars and rings. Completion is not health, so it is neutral; a health judgement colours the label, never the bar. |
| `--progress-track` | `var(--surface-3)` | Unfilled part of progress bars and rings. |

#### Energy 1–10

| Token | Value | Usage |
|---|---|---|
| `--energy-1` | dark `#3b3a8f` · light `#3b3a8f` · booth `#47489f` | Energy 1 of 10 (Low tier). Fill of the energy bar segments and the set wave bars. A mark, never text: the number is always printed beside it. |
| `--energy-2` | dark `#4c3fa6` · light `#4c3fa6` · booth `#4e41a9` | Energy 2 of 10 (Low tier). Fill of the energy bar segments and the set wave bars. A mark, never text: the number is always printed beside it. |
| `--energy-3` | `#6a43b3` | Energy 3 of 10 (Low tier). Fill of the energy bar segments and the set wave bars. A mark, never text: the number is always printed beside it. |
| `--energy-4` | `#8a47b5` | Energy 4 of 10 (Low tier). Fill of the energy bar segments and the set wave bars. A mark, never text: the number is always printed beside it. |
| `--energy-5` | `#a94ba9` | Energy 5 of 10 (Building tier). Fill of the energy bar segments and the set wave bars. A mark, never text: the number is always printed beside it. |
| `--energy-6` | `#c55394` | Energy 6 of 10 (Building tier). Fill of the energy bar segments and the set wave bars. A mark, never text: the number is always printed beside it. |
| `--energy-7` | `#db6278` | Energy 7 of 10 (Building tier). Fill of the energy bar segments and the set wave bars. A mark, never text: the number is always printed beside it. |
| `--energy-8` | `#ea795c` | Energy 8 of 10 (High tier). Fill of the energy bar segments and the set wave bars. A mark, never text: the number is always printed beside it. |
| `--energy-9` | `#f39a45` | Energy 9 of 10 (High tier). Fill of the energy bar segments and the set wave bars. A mark, never text: the number is always printed beside it. |
| `--energy-10` | `#f7c04a` | Energy 10 of 10 (High tier). Fill of the energy bar segments and the set wave bars. A mark, never text: the number is always printed beside it. |

#### Camelot keys

| Token | Value | Usage |
|---|---|---|
| `--key-1a` | dark `#17a478` · light `#057c59` · booth `#2dc08e` | Camelot 1A (A♭ minor). Key dot and wheel segment. Minor (A) is the darker ring; always printed with its code. |
| `--key-1b` | dark `#5ed8a9` · light `#029e72` · booth `#68eeba` | Camelot 1B (B major). Key dot and wheel segment. Major (B) is the lighter ring; always printed with its code. |
| `--key-2a` | dark `#689d48` · light `#467922` · booth `#7db85a` | Camelot 2A (E♭ minor). Key dot and wheel segment. Minor (A) is the darker ring; always printed with its code. |
| `--key-2b` | dark `#99d079` · light `#629742` · booth `#a9e686` | Camelot 2B (F♯ major). Key dot and wheel segment. Major (B) is the lighter ring; always printed with its code. |
| `--key-3a` | dark `#989016` · light `#736c01` · booth `#b2a92a` | Camelot 3A (B♭ minor). Key dot and wheel segment. Minor (A) is the darker ring; always printed with its code. |
| `--key-3b` | dark `#cac256` · light `#928a07` · booth `#dfd65f` | Camelot 3B (D♭ major). Key dot and wheel segment. Major (B) is the lighter ring; always printed with its code. |
| `--key-4a` | dark `#ba7f14` · light `#8d5e00` · booth `#d79628` | Camelot 4A (F minor). Key dot and wheel segment. Minor (A) is the darker ring; always printed with its code. |
| `--key-4b` | dark `#eeb154` · light `#b37903` · booth `#fec675` | Camelot 4B (A♭ major). Key dot and wheel segment. Major (B) is the lighter ring; always printed with its code. |
| `--key-5a` | dark `#cc7044` · light `#a44c1d` · booth `#eb8656` | Camelot 5A (C minor). Key dot and wheel segment. Minor (A) is the darker ring; always printed with its code. |
| `--key-5b` | dark `#ffa47a` · light `#c56a3e` · booth `#fec1a6` | Camelot 5B (E♭ major). Key dot and wheel segment. Major (B) is the lighter ring; always printed with its code. |
| `--key-6a` | dark `#cf6872` · light `#a64450` · booth `#ef7d88` | Camelot 6A (G minor). Key dot and wheel segment. Minor (A) is the darker ring; always printed with its code. |
| `--key-6b` | dark `#fe9fa6` · light `#c8626d` · booth `#ffbdc1` | Camelot 6B (B♭ major). Key dot and wheel segment. Major (B) is the lighter ring; always printed with its code. |
| `--key-7a` | dark `#c3699e` · light `#9b467a` · booth `#e17eb9` | Camelot 7A (D minor). Key dot and wheel segment. Minor (A) is the darker ring; always printed with its code. |
| `--key-7b` | dark `#f99bd1` · light `#bc6398` · booth `#feb8df` | Camelot 7B (F major). Key dot and wheel segment. Major (B) is the lighter ring; always printed with its code. |
| `--key-8a` | dark `#aa72c2` · light `#854f9c` · booth `#c588e0` | Camelot 8A (A minor). Key dot and wheel segment. Minor (A) is the darker ring; always printed with its code. |
| `--key-8b` | dark `#dda4f7` · light `#a36cbc` · booth `#eabdfe` | Camelot 8B (C major). Key dot and wheel segment. Major (B) is the lighter ring; always printed with its code. |
| `--key-9a` | dark `#857fd7` · light `#635bb0` · booth `#9c96f8` | Camelot 9A (E minor). Key dot and wheel segment. Minor (A) is the darker ring; always printed with its code. |
| `--key-9b` | dark `#b6b4fe` · light `#7f79d1` · booth `#cbcbfe` | Camelot 9B (G major). Key dot and wheel segment. Major (B) is the lighter ring; always printed with its code. |
| `--key-10a` | dark `#528ed9` · light `#2e69b2` · booth `#65a7fa` | Camelot 10A (B minor). Key dot and wheel segment. Minor (A) is the darker ring; always printed with its code. |
| `--key-10b` | dark `#91c1ff` · light `#4c88d3` · booth `#b3d4ff` | Camelot 10B (D major). Key dot and wheel segment. Major (B) is the lighter ring; always printed with its code. |
| `--key-11a` | dark `#089ac3` · light `#027493` · booth `#03b5e4` | Camelot 11A (F♯ minor). Key dot and wheel segment. Minor (A) is the darker ring; always printed with its code. |
| `--key-11b` | dark `#49cffc` · light `#0994ba` · booth `#8cdeff` | Camelot 11B (A major). Key dot and wheel segment. Major (B) is the lighter ring; always printed with its code. |
| `--key-12a` | dark `#09a0a0` · light `#047879` · booth `#08bcbc` | Camelot 12A (D♭ minor). Key dot and wheel segment. Minor (A) is the darker ring; always printed with its code. |
| `--key-12b` | dark `#2ad7d7` · light `#009a9a` · booth `#2eeded` | Camelot 12B (E major). Key dot and wheel segment. Major (B) is the lighter ring; always printed with its code. |

#### Charts

| Token | Value | Usage |
|---|---|---|
| `--chart-1` | dark `#56b4e9` · light `#0072b2` · booth `#56b4e9` | Categorical chart series 1. Use in order; more than 8 categories group the tail as 'Other' in chart-8. |
| `--chart-2` | dark `#e69f00` · light `#b36b00` · booth `#e69f00` | Categorical chart series 2. Use in order; more than 8 categories group the tail as 'Other' in chart-8. |
| `--chart-3` | dark `#3fc29a` · light `#007a5a` · booth `#3fc29a` | Categorical chart series 3. Use in order; more than 8 categories group the tail as 'Other' in chart-8. |
| `--chart-4` | dark `#cc79a7` · light `#b0477f` · booth `#cc79a7` | Categorical chart series 4. Use in order; more than 8 categories group the tail as 'Other' in chart-8. |
| `--chart-5` | dark `#e8d95a` · light `#8a7d00` · booth `#e8d95a` | Categorical chart series 5. Use in order; more than 8 categories group the tail as 'Other' in chart-8. |
| `--chart-6` | dark `#5aa0e0` · light `#005a8c` · booth `#5aa0e0` | Categorical chart series 6. Use in order; more than 8 categories group the tail as 'Other' in chart-8. |
| `--chart-7` | dark `#f08a4b` · light `#b34700` · booth `#f08a4b` | Categorical chart series 7. Use in order; more than 8 categories group the tail as 'Other' in chart-8. |
| `--chart-8` | dark `#999999` · light `#6b6b6b` · booth `#999999` | Categorical chart series 8. Use in order; more than 8 categories group the tail as 'Other' in chart-8. |
| `--chart-grid` | dark `#353535` · light `#e4e4df` · booth `#3a3a3a` | Chart gridlines and the tier band behind the energy wave. |
| `--chart-axis` | `var(--fg-3)` | Axis labels and tick text. |
| `--chart-ref` | dark `#d9d9d9` · light `#3a3a3d` · booth `#ffffff` | Reference and target lines (target wave, average, threshold): 1.5px dashed 5 4. |

#### Now, similarity, services

| Token | Value | Usage |
|---|---|---|
| `--on-now` | dark `#1f1600` · light `#ffffff` · booth `#000000` | Text on a solid now fill (the small "Now" tag). |
| `--now` | dark `#f7c04a` · light `#9a6400` · booth `#ffd166` | The marker for 'now' (choice "now-marker: c"): the playing track, the current slot, today's column, the current time on a timeline. Amber, so it never reads as 'selected' (brand lavender). A mark (3:1), not body text. |
| `--sim` | dark `#8f8f8f` · light `#76767a` · booth `#bdbdbd` | Simulated or hypothetical data (a proposed set, a preview of a rebuild): hatched with this colour and labelled 'Preview'. |
| `--svc-spotify` | `#1db954` | Spotify's own green: only on the 'Connect Spotify' button and Spotify source badge, per Spotify's brand rules. |
| `--on-svc-spotify` | `#000000` | Text on svc-spotify. |
| `--svc-tidal` | `#000000` | TIDAL's black: only on the 'Connect TIDAL' button (with a 1px white border on dark grounds). |
| `--on-svc-tidal` | `#ffffff` | Text on svc-tidal. |

### Type

#### Families

| Token | Value |
|---|---|
| `--font-display` | `"Sora", "Inter", system-ui, sans-serif` |
| `--font-body` | `"Inter", system-ui, -apple-system, "Segoe UI", sans-serif` |
| `--font-data` | `"JetBrains Mono", ui-monospace, Consolas, monospace` |

#### Font files (`@font-face` in tokens.css)

| Family | File | Weight | Style |
|---|---|---|---|
| Sora | `design-system/fonts/sora-latin-wght-normal.woff2` | 100 800 | normal |
| Inter | `design-system/fonts/inter-latin-wght-normal.woff2` | 100 900 | normal |
| Inter | `design-system/fonts/inter-latin-wght-italic.woff2` | 100 900 | italic |
| JetBrains Mono | `design-system/fonts/jetbrains-mono-latin-wght-normal.woff2` | 100 800 | normal |

#### Text styles (class `.name`; titles: `.sn-title .name`)

| Class | Family | Size | Line height | Weight | Letter spacing | Usage |
|---|---|---|---|---|---|---|
| `.display-xl` | `--font-display` | `2.5rem` | `1.1` | `700` | `-0.01em` | Cover and launcher home title only. |
| `.title-l` | `--font-display` | `1.75rem` | `1.2` | `700` | – | Page title (the bold half of the thin–bold title). One per page. |
| `.title-m` | `--font-display` | `1.375rem` | `1.25` | `700` | – | Section headings inside a page; dialog titles. |
| `.title-s` | `--font-display` | `1.125rem` | `1.3` | `700` | – | Card titles, drawer group titles, track title in detail views. |
| `.title-lead` | `--font-display` | `1em` | `1.2` | `400` | – | The lead-in of a thin–bold title: same size as the title it precedes, weight 400, colour fg-3 (or mod-*-muted inside a tonal card). Ends with a colon. |
| `.figure` | `--font-display` | `2rem` | `1.05` | `700` | – | Headline figures in figure tiles; tabular numerals. |
| `.body-l` | `--font-body` | `1.0625rem` | `1.55` | `400` | – | Help text, empty-state explanations, onboarding. |
| `.body` | `--font-body` | `0.9375rem` | `1.45` | `400` | – | Default UI and table text (15px, Elektronauts' size). |
| `.body-strong` | `--font-body` | `0.9375rem` | `1.45` | `600` | – | Track titles in rows, button labels, link text. |
| `.body-s` | `--font-body` | `0.8125rem` | `1.4` | `400` | – | Meta lines under titles, helper text under fields, toasts. |
| `.label` | `--font-body` | `0.75rem` | `1.3` | `600` | `0.08em` | Column headers, rail group titles, eyebrow labels. Uppercase via CSS only, never typed in caps; keep to 3 words. |
| `.caption` | `--font-body` | `0.75rem` | `1.35` | `400` | – | Freshness stamps, chart notes, method text. |
| `.data` | `--font-data` | `0.8125rem` | `1.4` | `400` | – | BPM, keys, durations, counts and IDs in rows. Tabular by nature. |
| `.data-strong` | `--font-data` | `0.8125rem` | `1.4` | `600` | – | Emphasised data: the transition verdict, the current value. |
| `.data-s` | `--font-data` | `0.6875rem` | `1.35` | `400` | – | External IDs (ISRC, Spotify ID), chart tick labels. |

### Spacing

<!-- 4px base. Use gap on flex/grid, never margins between siblings. -->

| Token | Value | Usage |
|---|---|---|
| `--space-0` | `0px` | No gap. |
| `--space-0\.5` | `2px` | Hairline nudges: energy segment gap, icon-to-badge. |
| `--space-1` | `4px` | Tight: chip padding block, icon-to-label in dense rows. |
| `--space-2` | `8px` | Default gap inside controls and between chips. |
| `--space-3` | `12px` | Gap between form fields in a row; table cell inline padding. |
| `--space-4` | `16px` | Card padding (compact), page side gutter minimum, gap between cards. |
| `--space-5` | `20px` | Card padding (default). |
| `--space-6` | `24px` | Gap between sections inside a page; drawer padding. |
| `--space-8` | `32px` | Gap between page regions (rail and content). |
| `--space-10` | `40px` | Space above a section heading. |
| `--space-12` | `48px` | Page top padding below the header on wide screens. |
| `--space-16` | `64px` | Cover and empty-state breathing room. |

### Radius

<!-- Three-step shape scale: the rounder, the bigger and more 'object' it is. -->

| Token | Value | Usage |
|---|---|---|
| `--radius-chip` | `4px` | Chips, tags, pills with text, energy segments (2px inside bars), key badges. |
| `--radius-control` | `8px` | Buttons, inputs, selects, segmented controls, menu items, tooltips, table containers. |
| `--radius-card` | `14px` | Cards (tonal and neutral), launcher tiles, figure tiles, popovers. |
| `--radius-sheet` | `18px` | Drawers' inner edge, dialogs, media viewer: the biggest objects. |
| `--radius-pill` | `999px` | Status pills, the toggle switch, progress bars, avatars of services. |

### Shadow

<!-- Depth means 'floats above the page'. Cards rest at shadow-1; only floating layers get more. -->

| Token | Value | Usage |
|---|---|---|
| `--shadow-1` | dark `0 1px 2px rgba(0, 0, 0, 0.30)` · light `0 1px 2px rgba(20, 20, 24, 0.08)` · booth `none` | Resting cards (Ghost style): barely there; the border does the work. |
| `--shadow-2` | dark `0 6px 20px rgba(0, 0, 0, 0.45)` · light `0 6px 20px rgba(20, 20, 24, 0.14)` · booth `0 0 0 1px #a8a8a8` | Popovers, menus, tooltips, the sticky header once scrolled. |
| `--shadow-3` | dark `0 18px 48px rgba(0, 0, 0, 0.55)` · light `0 18px 48px rgba(20, 20, 24, 0.22)` · booth `0 0 0 2px #ffffff` | Drawers and dialogs above the scrim. |

### Size

| Token | Value | Usage |
|---|---|---|
| `--control-sm` | `32px` | Small buttons and inputs in dense toolbars and table rows. |
| `--control-md` | `40px` | Default button, input and select height. |
| `--control-lg` | `48px` | Large buttons: empty-state actions, booth mode, touch-first screens. |
| `--touch-min` | `44px` | Minimum hit area for anything tappable on phone and tablet (pad small visuals to reach it). |
| `--row-compact` | `32px` | Table row height in compact density. |
| `--row-comfortable` | `40px` | Table row height, default density. |
| `--row-two-line` | `56px` | Two-line rows (title + meta) in lists and the running order. |
| `--header-h` | `56px` | App header height. |
| `--drawer-w` | `300px` | Navigation drawer width (max 86vw on phones). |
| `--rail-w` | `248px` | Filter rail width on desktop. |
| `--content-max` | `1400px` | Max content width; wider screens centre it. |
| `--prose-max` | `68ch` | Max line length for running text and help. |

### Z-index

| Token | Value | Usage |
|---|---|---|
| `--z-base` | `0` | Page content. |
| `--z-sticky` | `10` | Sticky table headers, sticky filter rail. |
| `--z-header` | `20` | App header. |
| `--z-drawer` | `40` | Navigation drawer and side sheets. |
| `--z-overlay` | `50` | Scrim. |
| `--z-dialog` | `60` | Dialogs and the media viewer. |
| `--z-popover` | `70` | Menus, popovers, context menu, select lists. |
| `--z-toast` | `80` | Toasts. |
| `--z-tooltip` | `90` | Tooltips. |

### Duration

<!-- Reduced motion sets every duration to 0ms except progress indication. -->

| Token | Value | Usage |
|---|---|---|
| `--duration-instant` | `0ms` | Reduced motion: every duration collapses to this. |
| `--duration-fast` | `120ms` | Hover, press, focus, chip toggle. |
| `--duration-base` | `200ms` | Drawer, dialog, disclosure, tab indicator. |
| `--duration-slow` | `320ms` | Chart transitions and graph camera moves (max). |

### Easing

| Token | Value | Usage |
|---|---|---|
| `--ease-standard` | `cubic-bezier(0.2, 0, 0, 1)` | Everything that moves in or changes size. |
| `--ease-exit` | `cubic-bezier(0.3, 0, 1, 1)` | Elements leaving (drawer close, toast out). |

### Breakpoint (reference values; media queries cannot read var())

| Token | Value | Usage |
|---|---|---|
| `--bp-phone` | `480px` | Below: one column, drawer navigation, tables become cards or scroll in their box. |
| `--bp-tablet` | `768px` | Tablet: rails collapse to a Filters button; two-column cards. |
| `--bp-desktop` | `1100px` | Desktop: filter rail + content; side panels open beside, not over. |
| `--bp-wide` | `1440px` | Wide: three-region layouts (library, graph, panel). |
| `--bp-wall` | `1920px` | Wall/kiosk: booth theme recommended, type scale steps up one size. |

### Opacity

| Token | Value | Usage |
|---|---|---|
| `--opacity-disabled` | `0.45` | Disabled controls (with aria-disabled). |
| `--opacity-faded` | `0.15` | Graph nodes and edges outside the current selection or filter. |
| `--opacity-edge` | `0.6` | Default graph edge opacity; strong edges 0.9. |
<!-- END GENERATED: tokens -->

## SongNodesHelpers (window.SongNodes)

<!-- BEGIN GENERATED: helpers -->
```ts
// design-system/components/index.d.ts (verbatim)
/* ---- window.SongNodes helpers (components/bundle.js) ---- */
export type ModuleKey = "graph" | "library" | "sets" | "paths" | "harmony" | "sources" | "pipeline" | "services";
export type DesignStatus = "ok" | "fair" | "warn" | "bad" | "info" | "running" | "idle";
export type CompatLevel = "perfect" | "compatible" | "possible" | "clash" | "unknown";
export interface SongNodesHelpers {
  version: string; locale: "en-AU"; timeZone: "Australia/Melbourne";
  modules: { key: ModuleKey; label: string; icon: string; summary: string }[];
  icon(name: string, opts?: { size?: number; label?: string; cls?: string }): string;
  camelot(input: string | null | undefined): string | null;
  keyName(code: string): string | null;
  compat(a: string, b: string): { level: CompatLevel; label: string };
  tier(energy: number): "low" | "building" | "high" | null;
  energyStep(prev: number, next: number, before?: number): { level: CompatLevel; label: string };
  bpmStep(a: number, b: number): { level: CompatLevel; label: string };
  format: { date(d: Date | string): string; day(d: Date | string): string; month(d: Date | string): string; time(d: Date | string): string; dateTime(d: Date | string): string; zone(d: Date | string): string; stamp(d: Date | string): string; relative(d: Date | string, now?: Date): string; duration(seconds: number): string; span(seconds: number): string; count(n: number): string; bpm(b: number): string; percent(x: number, digits?: number): string; dateOnly(isoDate: string): string };
  status(raw: string, domain?: "confidence" | "priority"): { status: DesignStatus; label: string; glyph: string };
  html: { energy(e: number): string; key(k: string, withName?: boolean): string; pill(raw: string, label?: string): string; compat(level: CompatLevel, label?: string): string; link(mod: ModuleKey, href: string, text: string): string; title(lead: string, title: string, size?: "title-l" | "title-m" | "title-s"): string };
  prefs: { init(): void; setTheme(t: "dark" | "light" | "booth" | "system"): void; setTextSize(s: "s" | "m" | "l" | "xl"): void; setDensity(d: "comfortable" | "compact"): void; setMotion(m: "system" | "reduce" | "full"): void; get(): { theme: string; textSize: string; density: string; motion: string } };
}
declare global { interface Window { SongNodes: SongNodesHelpers } }
```
<!-- END GENERATED: helpers -->

```js
// extra runtime fields on window.SongNodes (bundle.js), not in the interface
SongNodes.icons        // { [name]: "<path …/>" } – 109 Lucide icons
SongNodes.module(key)  // one entry of SongNodes.modules or null
SongNodes.KEY_NAMES    // { "8A": "A minor", … }
SongNodes.TIER_LABEL   // { low: "Low 1–4", building: "Building 5–7", high: "High 8–10" }
SongNodes.GLYPH        // { ok: "●", fair: "◐", warn: "▲", bad: "✕", info: "i", running: "↻", idle: "–", perfect: "●", compatible: "◐", possible: "○", clash: "✕", unknown: "?" }
SongNodes.DOMAIN_MAP   // status(raw, "confidence" | "priority") vocabularies
SongNodes.esc(s)       // HTML-escape
SongNodes.prefs.applySystem()
```

## React wrapper and shell

<!-- BEGIN GENERATED: react -->
```tsx
// frontend/src/lib/songnodes.tsx exports (signatures)
import { SN, SnIcon, Title, EnergyBar, KeyBadge, Bpm, StatusPill, CompatPill, MODULE_ROUTES, moduleOf } from '../lib/songnodes';
export type { ModuleKey, CompatLevel, DesignStatus };
export const SN: SongNodesHelpers;
export const GLYPH = extra.GLYPH;
export const TIER_LABEL = extra.TIER_LABEL;
export const MODULE_ROUTES: Record<ModuleKey, string>;
export const moduleOf = (key: ModuleKey) => SN.modules.find((m) => m.key === key)!;
export const SnIcon: React.FC<SnIconProps>;
export const Title: React.FC<{ lead?: string; children: React.ReactNode; size?: 'display-xl' | 'title-l' | 'title-m' | 'title-s'; as?: 'h1' | 'h2' | 'h3'; id?: string }>;
export const EnergyBar: React.FC<{ value: number | null | undefined }>;
export const KeyBadge: React.FC<{ value: string | null | undefined; withName?: boolean }>;
export const Bpm: React.FC<{ value: number | null | undefined }>;
export const StatusPill: React.FC<{ raw: string; label?: string }>;
export const CompatPill: React.FC<{ level: CompatLevel; label?: string }>;
// frontend/src/shell/AppShell.tsx
export function usePageHeader(s: HeaderState);
export const AppShell: React.FC;
// frontend/src/shell/PageParts.tsx
export const PageHeader: React.FC<PageHeaderProps>;
export const EmptyState: React.FC<{ icon: string; title: string; children?: React.ReactNode; actions?: React.ReactNode; meta?: React.ReactNode }>;
export const SectionHeading: React.FC<{ title: string; lead?: string; count?: string; caveat?: React.ReactNode; action?: React.ReactNode; id?: string; rule?: boolean }>;
export const LauncherCard: React.FC<{ mod: ModuleKey; title: string; summary: string; figures?: [string, React.ReactNode][]; pill?: React.ReactNode; to?: string }>;
// frontend/src/shell/PreferencesPanel.tsx
export const PreferencesPanel: React.FC<{ embedded?: boolean }>;
```
<!-- END GENERATED: react -->

## Core primitives (00-core.css)

| Class | Purpose |
|---|---|
| `sn-btn` | Secondary button (default): `surface-1`, `line-strong` border, 40px |
| `sn-btn--primary` | The one primary action per view (`brand`) |
| `sn-btn--quiet` | Low-stakes or repeated action, transparent |
| `sn-btn--mod` | Action into a module; needs an `sn-m-<module>` ancestor |
| `sn-btn--danger` / `sn-btn--danger-quiet` | Irreversible action, inside a confirmation only |
| `sn-btn--sm` / `sn-btn--lg` | 32px / 48px |
| `sn-btn--icon` | Square icon-only button; requires `aria-label` |
| `sn-card` | Neutral card: `surface-1`, `line`, `radius-card`, `shadow-1` |
| `sn-card--tonal` | Module card in module shades; needs `sn-m-<module>` |
| `sn-card--compact` / `sn-card--flat` | Less padding / no shadow |
| `sn-card__head` / `sn-card__foot` | Card head row / footer pinned to bottom |
| `sn-pill` + `data-status="ok\|fair\|warn\|bad\|info\|running\|idle"` | Status pill, glyph via CSS |
| `sn-pill` + `data-compat="perfect\|compatible\|possible\|clash"` | Compatibility pill |
| `sn-pill--outline` | Outline pill for dense tables |
| `sn-link` | Underlined link in destination colour (`--m`, else `link`) |
| `sn-link--ext` | External link, appends ↗ |
| `sn-title` + `title-l\|title-m\|title-s` | Sora title |
| `sn-lead` | Dimmed 400 lead-in of a thin–bold title, ends with ":" |
| `sn-eyebrow` | Uppercase `label` style line |
| `sn-none` | Missing value: `<span class="sn-none">–</span>` |
| `sn-mono` | JetBrains Mono, tabular figures |
| `sn-num` | Tabular figures in current face |
| `sn-muted` / `sn-dim` | `fg-2` / `fg-3` text |
| `sn-stack` | Column flex, gap `space-3` |
| `sn-row` | Wrapping row flex, gap `space-2` |
| `sn-sr` | Visually hidden, read by screen readers |
| `sn-skel` | Skeleton block (pulse; stops with reduced motion) |
| `sn-spinner` | Spinner (stops with reduced motion) |
| `sn-skip` | Skip link |
| `sn-icon` / `sn-icon--lg` | Lucide SVG from `SongNodes.icon()` / 24px |
| `sn-m-<module>` | Module scope: sets `--m --m-bg --m-raised --m-line --m-ink --m-muted --m-on`; modules: graph, library, sets, paths, harmony, sources, pipeline, services |
| `sn-m-icon` | Icon in module hue |
| `sn-chip` / `sn-chip--mod` | Toggle chip (`aria-pressed`) |
| `sn-tag` | Neutral category tag |
| `sn-field` `sn-field__help` `sn-field__error` | Field wrapper, help, error (✕) |
| `sn-input` `sn-input--data` `sn-select` `sn-textarea` `sn-check` | Inputs |
| `sn-tabs` `sn-tab` `sn-tab__badge` `sn-tab__dot` | Tabs |
| `sn-seg` | Segmented control track |
| `sn-tablebox` `sn-table` `sn-table--compact` `td.num` `tr[data-now]` `tr[data-flag]` `tr[aria-selected]` `tr.sn-group` | Tables |
| `sn-energy` `sn-energy__bar` `sn-energy__n` | Energy meter (use `SongNodes.html.energy`) |
| `sn-key` `sn-key__name` `[data-key]` `[data-unknown]` | Camelot key badge (use `SongNodes.html.key`) |
| `sn-bpm` | BPM in mono, value in `<b>` |
| `label` `display-xl` `title-*` `figure` `body-l` `body` `body-strong` `body-s` `caption` `data` `data-strong` `data-s` | Text style classes (tokens.css) |

## Rules

```text
[ ] Load tokens.css -> components/bundle.css -> components/bundle.js; SongNodes.prefs.init() inline in <head>
[ ] No hex / rgb() / hsl() / named colours outside design-system files: var(--token) only
[ ] No px (or any literal) font sizes: text style classes or rem values from tokens.json type
[ ] No literal radius, shadow, z-index, duration: --radius-* --shadow-* --z-* --duration-*
[ ] Titles: <h1 class="sn-title title-l"><span class="sn-lead">Lead:</span> Title</h1>; one h1 per page; title-m section headings plain bold
[ ] Sora titles/figures, Inter body, JetBrains Mono for BPM, keys, durations, times in rows, IDs
[ ] One sn-btn--primary per view, placed last; buttons are verb + object, sentence case, no full stop
[ ] Links: sn-link sn-m-<destination>, always underlined; external adds sn-link--ext
[ ] Status = glyph + word: sn-pill[data-status] from SongNodes.status(raw, domain); never colour alone
[ ] Compatibility = sn-pill[data-compat] from SongNodes.compat / energyStep / bpmStep
[ ] Missing value = <span class="sn-none">–</span>; never N/A, Unknown, null, 0
[ ] Dates/times/durations/counts/BPM/percent via SongNodes.format.*; Australia/Melbourne, 24-hour; stamps carry AEST/AEDT
[ ] Durations: seconds into format.duration (convert duration_ms once at the API boundary)
[ ] Keys via SongNodes.camelot / keyName (8A = A minor, 8B = C major); energy via html.energy (integer 1–10)
[ ] en-AU spelling, sentence case, en dash between artist and title, true minus (−) for negatives, "%" closed up
[ ] No emoji anywhere; Lucide icons via SongNodes.icon(name, {label}) or lucide-react; icon-only buttons need aria-label
[ ] Brand lavender = wordmark, primary button, focus, selection only; "now" = amber --now
[ ] Status colours never on categories; no gradients, glows, glass, coloured left-border cards
[ ] Never alert() / confirm() / prompt(): ConfirmDialog, Toast, armed Button
[ ] Cards rest at shadow-1; only floating layers use shadow-2 / shadow-3
[ ] Never edit frontend/src/styles/design-system/; change design-system/source, rebuild, bump version, re-sync
```

## Conformance checks (17-governance)

```bash
# no raw colours in app code (outside the synced design system and legacy files pending removal)
grep -rnE '#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(' frontend/src --include='*.css' --include='*.tsx' --include='*.ts' \
  | grep -v 'styles/design-system/' | grep -v 'design-system exception EX-'
npx stylelint 'frontend/src/**/*.css' --rule '{"color-no-hex": true}' --ignore-pattern 'frontend/src/styles/design-system/**'

# no px font sizes
grep -rnE 'font-size:\s*[0-9.]+px|fontSize:\s*[0-9]+' frontend/src --include='*.css' --include='*.tsx' | grep -v 'styles/design-system/'

# no emoji (U+1F300–1FAFF, U+2600–27BF) outside comments
grep -rnP '[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]' frontend/src | grep -vE '^\S+:\s*(//|/?\*)'

# no alert / confirm / prompt
grep -rnE '\b(window\.)?(alert|confirm|prompt)\(' frontend/src --include='*.ts' --include='*.tsx'
npx eslint --rule '{"no-alert": "error"}' frontend/src

# hand-formatted dates
grep -rnE 'toLocale(Date|Time)?String\(|toISOString\(\)' frontend/src --include='*.tsx' | grep -v 'dateTime='

# missing-value words
grep -rnE "['\">](N/A|Unknown|Unknown Artist)['\"<]" frontend/src --include='*.tsx'

# version sync and synced copy
scripts/sync-design-system.sh --check
python3 -c "import json;print(json.load(open('design-system/tokens.json'))['version'])"; grep -oE 'version: "[0-9.]+"' design-system/components/bundle.js

# contrast report (source)
cd design-system && python3 source/build_tokens.py .

# accessibility + visual (Playwright): axe-core on every route x theme; snapshots of every components/*/preview.html in dark, light, booth
cd frontend && npm run test:e2e -- --workers=1
```

## Components (README index order; first html block of components/&lt;Comp&gt;/README.md)

<!-- BEGIN GENERATED: components -->
### Navigation (14)

#### AppHeader

```html
<header class="sn-app-header"><div class="sn-app-header__bar">
  <div class="sn-app-header__start">
    <button class="sn-btn sn-btn--quiet sn-btn--icon" aria-expanded="false" aria-controls="nav" aria-label="Open navigation">…menu icon…</button>
    <span class="sn-app-header__wordmark">SongNodes</span></div>
  <span class="sn-app-header__divider" aria-hidden="true"></span>
  <p class="sn-app-header__title"><span class="sn-lead">Library:</span> Melbourne crate</p>
  <div class="sn-app-header__mode"><!-- SegmentedControl --sm: Play / Plan --></div>
  <div class="sn-app-header__end">
    <span class="sn-app-header__stamp">…clock… <span class="sn-app-header__stamp-text">Updated </span><time datetime="…" title="Updated 24 Oct 2026, 06:00 AEDT">15 h ago</time></span>
    <span class="sn-pill sn-app-header__conn" data-status="ok"><span class="sn-app-header__conn-text">Live</span><span class="sn-sr"> live updates</span></span>
    <button class="sn-btn sn-btn--sm sn-app-header__search" aria-keyshortcuts="Control+K Meta+K /">…search… <span class="sn-app-header__search-label">Search</span><kbd aria-hidden="true">Ctrl K</kbd></button>
    <!-- OverflowMenu -->
  </div></div></header>
```

#### Breadcrumbs

```html
<nav class="sn-breadcrumbs" aria-label="Breadcrumb">
  <ol class="sn-breadcrumbs__list">
    <li class="sn-breadcrumbs__item"><a class="sn-link sn-m-library" href="/library">…icon… Library</a></li>
    <li class="sn-breadcrumbs__item"><a class="sn-link sn-m-library" href="/library/artist/bicep">Bicep</a></li>
    <li class="sn-breadcrumbs__item"><span class="sn-breadcrumbs__current" aria-current="page">Glue</span></li>
  </ol></nav>
```

#### CommandPalette

```html
<div class="sn-command-palette__scrim">
  <div class="sn-command-palette" role="dialog" aria-modal="true" aria-label="Quick search">
    <div class="sn-command-palette__field">…search…
      <input class="sn-command-palette__input" role="combobox" aria-expanded="true" aria-controls="qs-list" aria-autocomplete="list" aria-activedescendant="qs-o0" aria-label="Search" placeholder="Search tracks, artists, sets, pages or actions"><kbd>Esc</kbd></div>
    <div class="sn-command-palette__list" role="listbox" id="qs-list" aria-label="Results">
      <div class="sn-command-palette__group" role="group" aria-labelledby="qs-g0"><div class="sn-command-palette__heading" id="qs-g0" role="presentation">Tracks</div>
        <div class="sn-command-palette__option sn-m-library" role="option" id="qs-o0" aria-selected="true">…music…
          <span class="sn-command-palette__main"><span class="sn-command-palette__name">Glue</span><span class="sn-command-palette__sub">Bicep</span></span>
          <span class="sn-command-palette__data"><span class="sn-key" data-key="8A">8A</span><span class="sn-bpm"><b>130</b> BPM</span>…energy…</span></div></div></div>
    <div class="sn-command-palette__empty" hidden></div>
    <div class="sn-command-palette__foot">↑↓ move · Enter open · Esc clear, then close</div>
  </div></div>
```

#### ContextMenu

```html
<div class="sn-context-menu" style="left: 312px; top: 140px">
  <div class="sn-overflow-menu__menu" role="menu" aria-label="Actions for Bicep – Glue">
    <div class="sn-overflow-menu__title" role="presentation">Bicep – Glue<small>8A · 130 BPM</small></div>
    <div role="group" aria-labelledby="h-route"><div class="sn-overflow-menu__heading" id="h-route" role="presentation">Route</div>
      <button class="sn-overflow-menu__item" role="menuitem" tabindex="-1">Set as starting track</button>
      …Set as waypoint, Set as finish…
      <button class="sn-overflow-menu__item" role="menuitem" tabindex="-1" aria-disabled="true" aria-describedby="why">Calculate route <span class="sn-overflow-menu__reason" id="why">Set a starting track and a finish first</span></button>
    </div>…</div></div>
```

#### LauncherCard

```html
<div class="sn-launcher-card__grid">
  <a class="sn-card sn-card--tonal sn-launcher-card sn-m-pipeline" href="/pipeline"
     aria-labelledby="lc-t" aria-describedby="lc-s lc-f lc-p">
    <div class="sn-card__head"><span class="sn-launcher-card__icon">…activity…</span>
      <span class="sn-pill" data-status="bad" id="lc-p">2 paused after errors</span></div>
    <h3 class="sn-title title-s" id="lc-t"><span class="sn-lead">Pipeline:</span> 9 scrapers</h3>
    <p class="sn-launcher-card__summary" id="lc-s">MixesDB and Setlist.fm paused after repeated errors.</p>
    <dl class="sn-launcher-card__figures" id="lc-f">
      <div class="sn-launcher-card__figure"><dt>running</dt><dd>7</dd></div>
      <div class="sn-launcher-card__figure"><dt>paused</dt><dd>2</dd></div></dl>
  </a></div>
```

#### NavDrawer

```html
<div class="sn-nav-drawer" id="nav" data-open>
  <div class="sn-nav-drawer__scrim"></div>
  <div class="sn-nav-drawer__panel" role="dialog" aria-modal="true" aria-label="Site navigation">
    <div class="sn-nav-drawer__head"><span class="sn-nav-drawer__wordmark">SongNodes</span><button class="sn-btn sn-btn--quiet sn-btn--icon" aria-label="Close navigation">…</button></div>
    <nav class="sn-nav-drawer__nav" aria-label="Main">
      <ul class="sn-nav-drawer__list"><li><a class="sn-nav-drawer__item" href="/">…house… <span class="sn-nav-drawer__label">Home</span></a></li></ul>
      <div class="sn-nav-drawer__group"><h2 class="sn-nav-drawer__heading" id="g-make">Make</h2>
        <ul class="sn-nav-drawer__list" aria-labelledby="g-make">
          <li><a class="sn-nav-drawer__item sn-m-sets" href="/sets" aria-current="page">…list-music… <span class="sn-nav-drawer__label">Set builder</span><span class="sn-nav-drawer__count">12<span class="sn-sr"> saved sets</span></span></a></li>
        </ul></div>
    </nav>
    <div class="sn-nav-drawer__foot">…Preferences link, Keyboard shortcuts button with <kbd>?</kbd>…</div>
  </div></div>
```

#### OverflowMenu

```html
<div class="sn-overflow-menu">
  <button class="sn-btn sn-btn--icon" id="more-btn" aria-haspopup="menu" aria-expanded="false" aria-controls="more" aria-label="More actions">…ellipsis…</button>
  <div class="sn-overflow-menu__menu" role="menu" id="more" aria-labelledby="more-btn" hidden>
    <div role="group" aria-labelledby="h1"><div class="sn-overflow-menu__heading" id="h1" role="presentation">Set</div>
      <button class="sn-overflow-menu__item" role="menuitem" tabindex="-1">…copy… <span class="sn-overflow-menu__label"><span class="sn-overflow-menu__text">Duplicate set</span></span></button>
      <button class="sn-overflow-menu__item" role="menuitem" tabindex="-1" aria-disabled="true" aria-describedby="r1">…upload… <span class="sn-overflow-menu__label"><span class="sn-overflow-menu__text">Send to TIDAL on the weekly run</span><span class="sn-overflow-menu__reason" id="r1">Connect TIDAL in Services first</span></span></button>
    </div>
    <div class="sn-overflow-menu__sep" role="separator"></div>
    <button class="sn-overflow-menu__item sn-overflow-menu__item--danger" role="menuitem" tabindex="-1">…trash… <span class="sn-overflow-menu__label"><span class="sn-overflow-menu__text">Delete set…</span></span></button>
  </div></div>
```

#### PageHeader

```html
<header class="sn-page-header sn-m-sets">
  <div class="sn-page-header__band">…icon… <a class="sn-link" href="/sets">Set builder</a><span class="sn-page-header__band-sep" aria-hidden="true">›</span><span class="sn-page-header__band-here">Saved sets</span></div>
  <div class="sn-page-header__main">
    <div class="sn-page-header__text">
      <h1 class="sn-title title-m"><span class="sn-lead">Set builder:</span> Peak time Friday</h1>
      <p class="sn-page-header__desc">Three waves over 92 min: 18 tracks, House 50 · Techno 30 · UK garage 20.</p>
      <p class="sn-page-header__meta"><span class="sn-page-header__stamp">…clock… Saved <time datetime="…">24 Oct 2026, 21:30 AEDT</time></span></p>
    </div>
    <div class="sn-page-header__actions">
      <button class="sn-btn sn-page-header__secondary">Copy tracklist</button>
      <!-- OverflowMenu; repeat the secondary actions in it with class sn-page-header__narrow-only -->
      <button class="sn-btn sn-btn--primary">Save set</button>
    </div></div></header>
```

#### PeriodNav

```html
<div class="sn-period-nav" role="group" aria-label="Period"><div class="sn-period-nav__bar">
  <div class="sn-period-nav__steps">
    <button class="sn-btn sn-btn--icon sn-btn--sm" aria-label="Previous week" aria-keyshortcuts="[">‹</button>
    <button class="sn-btn sn-btn--icon sn-btn--sm" aria-label="Next week" aria-keyshortcuts="]">›</button></div>
  <button class="sn-btn sn-btn--sm" aria-disabled="true" title="Already showing this week">This week</button>
  <h2 class="sn-period-nav__label" aria-live="polite"><span class="sn-lead">Week of</span> 19 Oct 2026</h2>
  <span class="sn-period-nav__hint"><kbd>[</kbd><kbd>]</kbd> previous / next</span>
  <div class="sn-period-nav__scale"><!-- SegmentedControl --sm: Day, Week, Month --></div>
</div></div>
```

#### PreferencesPanel

```html
<section class="sn-preferences-panel" aria-labelledby="pp-title">
  <div class="sn-preferences-panel__head"><h2 class="sn-title title-m" id="pp-title">Preferences</h2>…close…</div>
  <div class="sn-preferences-panel__body">
    <div class="sn-preferences-panel__set"><span class="sn-field__label" id="lbl-theme">Theme</span>
      <div class="sn-preferences-panel__themes" role="radiogroup" aria-labelledby="lbl-theme">
        <button class="sn-preferences-panel__theme" role="radio" aria-checked="true" data-value="system">…monitor… <span>System</span><span class="sn-preferences-panel__check" aria-hidden="true">✓</span></button>
        …Dark (moon), Light (sun), Booth (headphones)…</div></div>
    <!-- Text size: SegmentedControl --block S/M/L/XL; Row density: --block Comfortable/Compact -->
    <fieldset class="sn-preferences-panel__set"><legend>Reduce motion</legend>…two sn-check radios…</fieldset>
  </div>
  <div class="sn-preferences-panel__foot"><span>Saved on this device only</span><button class="sn-btn sn-btn--quiet sn-btn--sm">Reset to defaults</button></div>
</section>
```

#### SegmentedControl

```html
<span class="sn-segmented-control__group">
  <span class="sn-segmented-control__label" id="lbl-scale">Time scale</span>
  <div class="sn-seg sn-segmented-control" role="radiogroup" aria-labelledby="lbl-scale">
    <button type="button" role="radio" aria-checked="false" tabindex="-1" data-value="day">Day</button>
    <button type="button" role="radio" aria-checked="true" tabindex="0" data-value="week">Week</button>
    <button type="button" role="radio" aria-checked="false" tabindex="-1" data-value="month">Month</button>
  </div></span>
```

#### ShortcutSheet

```html
<div class="sn-shortcut-sheet__scrim">
  <div class="sn-shortcut-sheet" role="dialog" aria-modal="true" aria-labelledby="ks-title" tabindex="-1">
    <div class="sn-shortcut-sheet__head"><h2 class="sn-title title-m" id="ks-title">Keyboard shortcuts</h2><button class="sn-btn sn-btn--quiet sn-btn--icon" aria-label="Close keyboard shortcuts">…</button></div>
    <div class="sn-shortcut-sheet__body">
      <table class="sn-shortcut-sheet__table"><caption>Graph<small>When the graph canvas has focus</small></caption><tbody>
        <tr><th scope="row"><kbd>Space</kbd></th><td>Pause or resume the layout</td></tr>
        <tr><th scope="row"><kbd>G</kbd><span class="sn-shortcut-sheet__then">then</span><kbd>L</kbd></th><td>Go to Library</td></tr>
      </tbody></table>
      <section class="sn-shortcut-sheet__removed">…</section>
    </div></div></div>
```

#### ShowMore

```html
<div class="sn-show-more">
  <span class="sn-show-more__count" role="status">Showing <b>150</b> of <b>1,284</b> tracks</span>
  <div class="sn-show-more__actions">
    <button class="sn-btn sn-btn--sm">Show 300 more</button>
    <button class="sn-btn sn-btn--sm sn-btn--quiet">Show all 1,284</button>
  </div></div>

<div class="sn-show-more">
  <span class="sn-show-more__count">Items <b>61–80</b> of <b>214</b> waiting for review</span>
  <nav aria-label="Review queue pages"><ul class="sn-show-more__pages">
    <li><button class="sn-show-more__page" aria-label="Previous page">‹</button></li>
    <li><button class="sn-show-more__page" aria-label="Page 1">1</button></li>
    <li class="sn-show-more__gap" aria-hidden="true">…</li>
    <li><button class="sn-show-more__page" aria-current="page" aria-label="Page 4">4</button></li>
  </ul></nav></div>
```

#### Tabs

```html
<div class="sn-m-library">
  <div class="sn-tabs__wrap">
    <div class="sn-tabs" role="tablist" aria-label="Track detail">
      <button class="sn-tab" role="tab" id="t-0" aria-controls="p-0" aria-selected="true" tabindex="0">Overview</button>
      <button class="sn-tab" role="tab" id="t-2" aria-controls="p-2" aria-selected="false" tabindex="-1">Transitions<span class="sn-tab__badge">14</span><span class="sn-sr"> transitions</span><span class="sn-tab__dot" aria-hidden="true"></span><span class="sn-sr">, changed since you last looked</span></button>
    </div>
    <div class="sn-tabs__more" hidden><!-- menu button "More" + .sn-overflow-menu__menu --></div>
  </div>
  <div class="sn-tabs__panel" role="tabpanel" id="p-0" aria-labelledby="t-0" tabindex="0">…</div>
</div>
```

### Pages (15)

#### AuthCallbackPage

```html
<!-- AuthCallbackPage/README.md has no html block: static markup from components/AuthCallbackPage/preview.html (skeleton: depth 4, repeats folded; full markup there) -->
<main class="sn-page-auth sn-m-services" id="main">
  <p class="sn-page-auth__wordmark">
    SongNodes
  </p>
  <div class="sn-page-auth__states">
    <div class="sn-stack">
      <p class="sn-preview__label sn-page-auth__label">
        1 · Processing
      </p>
      <section class="sn-card sn-page-auth__card" aria-labelledby="p-t" aria-busy="true">
        <div class="sn-staged-progress">…</div>
        <p class="sn-page-auth__foot">…</p>
      </section>
    </div>
    <!-- … 2 more like this -->
  </div>
</main>
```

#### DailyViewPage

```html
<!-- DailyViewPage/README.md has no html block: static markup from components/DailyViewPage/preview.html (verbatim, scripts removed) -->
<a class="sn-skip" href="#main">Skip to content</a>
<div id="sh-head" data-drawer-inert></div>
<main class="sn-page-daily" id="main" tabindex="-1" data-drawer-inert>
  <div id="ph"></div>
  <section class="sn-page-daily__section" aria-label="Day">
    <div id="daynav"></div>
    <div class="sn-figure-tile-row" role="list" aria-label="Day at a glance" id="tiles"></div>
  </section>
  <section class="sn-page-daily__section" aria-labelledby="plays-h">
    <div class="sn-section-heading">
      <h2 class="sn-title title-s" id="plays-h"><span class="sn-lead">Plays:</span> by show</h2>
      <span class="sn-section-heading__count" id="plays-count"></span>
      <div class="sn-section-heading__end"><a class="sn-link sn-m-sources" href="#/plays/week/2026-10-19">Week of 19 Oct</a></div>
    </div>
    <div class="sn-data-table sn-data-table--stack">
      <div class="sn-tablebox sn-data-table__box" style="--sn-data-table-max:none" id="box">
        <table class="sn-table">
          <caption>Library-relevant plays on PBS, 3RRR and triple j, Melbourne time</caption>
          <thead><tr><th scope="col">Time</th><th scope="col">Track</th><th scope="col">Library</th><th scope="col">Also heard on</th></tr></thead>
          <tbody id="body"></tbody>
        </table>
      </div>
    </div>
  </section>
</main>
<div id="sh-drawer"></div>
<p class="sn-sr" role="status" id="sn-live"></p>
```

#### ErrorPage

```html
<!-- ErrorPage/README.md has no html block: static markup from components/ErrorPage/preview.html (verbatim, scripts removed) -->
<div class="pv-two">
  <div class="sn-stack"><span class="sn-preview__label">404.html · page not found</span>
    <div class="pv-frame">
      <main class="sn-page-error">
        <span class="sn-page-error__wordmark">SongNodes</span>
        <p class="sn-page-error__code">404 · Not found</p>
        <h1 class="sn-page-error__title">Page not found</h1>
        <p class="sn-page-error__text">There is nothing at this address. It may have been typed wrong, or the page was retired.</p>
        <ul class="sn-page-error__next">
          <li>Check the address, or <a href="/">go to Home</a>.</li>
          <li>Looking for a track or set? Search from Home with Ctrl K.</li>
        </ul>
      </main>
    </div>
  </div>
  <div class="sn-stack"><span class="sn-preview__label">50x.html · 503 service unavailable · sample request ID (a preview can’t run nginx SSI)</span>
    <div class="pv-frame">
      <main class="sn-page-error">
        <span class="sn-page-error__wordmark">SongNodes</span>
        <p class="sn-page-error__code">503 · Service unavailable</p>
        <h1 class="sn-page-error__title">SongNodes is not responding</h1>
        <p class="sn-page-error__text">The web server is up, but the SongNodes service behind it did not answer. Your sets and library are stored safely.</p>
        <ul class="sn-page-error__next">
          <li>Try again in a minute: <a href="">reload this page</a>.</li>
          <li>If it keeps happening, check the <a href="/monitoring/">status page in Grafana</a>.</li>
          <li>Or <a href="/">go to Home</a>.</li>
        </ul>
        <p class="sn-page-error__ref">Request ID, if you report this<code><!-- 50x.html: nginx SSI echoes request_id here; a sample is shown -->7f3a92c1e4b05d68a1c3f2e9b7d40a15</code></p>
      </main>
    </div>
  </div>
</div>
```

#### GraphExplorerPage

```html
<!-- GraphExplorerPage/README.md has no html block: static markup from components/GraphExplorerPage/preview.html (skeleton: depth 4, repeats folded; full markup there) -->
<a class="sn-skip" href="#main">
  Skip to main content
</a>
<div id="hdr" data-drawer-inert></div>
<main class="sn-page-graph sn-m-graph" id="main" tabindex="-1" data-drawer-inert>
  <div class="sn-page-graph__bar">
    <h1 class="sn-title title-s">
      <span class="sn-lead">
        Graph:
      </span>
      Neighbourhood of Bicep – Glue
    </h1>
    <span class="sn-page-graph__bar-meta">
      48 tracks · 112 links · 2 steps out
    </span>
    <button class="sn-btn sn-btn--sm" type="button" id="filters"></button>
    <span id="gmenu"></span>
  </div>
  <div class="sn-page-graph__work">
    <section class="sn-page-graph__recs" aria-labelledby="up-t">
      <div class="sn-page-graph__now" aria-label="Now playing">
        <span class="sn-eyebrow">…</span>
        <div class="sn-track-cell">…</div>
        <div class="sn-page-graph__now-data" id="nowdata"></div>
      </div>
      <div class="sn-section-heading">
        <h2 class="sn-title title-s" id="up-t">…</h2>
        <p class="sn-section-heading__caveat">…</p>
      </div>
      <ul class="sn-page-graph__rec-list" id="recs"></ul>
      <button class="sn-btn sn-page-graph__show-graph" type="button" id="showg" aria-controls="stage" aria-expanded="false"></button>
    </section>
    <div class="sn-page-graph__stage" id="stage" data-collapsed>
      <div class="sn-side-sheet__layout">
        <div class="sn-side-sheet__main sn-graph-styles">…</div>
        <div class="sn-side-sheet__scrim" hidden></div>
        <aside class="sn-side-sheet" id="sheet" aria-labelledby="sheet-t">…</aside>
      </div>
    </div>
  </div>
</main>
<div id="drw"></div>
<div class="sn-toast__region" role="status" aria-live="polite" aria-label="Notifications" id="toasts"></div>
<p class="sn-sr" role="status" id="sn-live"></p>
```

#### HomePage

```html
<!-- HomePage/README.md has no html block: static markup from components/HomePage/preview.html (verbatim, scripts removed) -->
<a class="sn-skip" href="#main">Skip to main content</a>
<div id="hdr" data-drawer-inert></div>
<main class="sn-page__main sn-page-home" id="main" tabindex="-1" data-drawer-inert>
  <div id="ph"></div>
  <section class="sn-page__section" aria-labelledby="chg-t">
    <div class="sn-section-heading">
      <h2 class="sn-title title-m" id="chg-t"><span class="sn-lead">Since your last visit:</span> Thu 22 Oct, 23:40</h2>
      <p class="sn-section-heading__caveat">What changed in the library, sets and pipeline since you were last here.</p>
    </div>
    <div class="sn-figure-tile-row" role="list" aria-label="Changes since your last visit" id="changes"></div>
  </section>
  <section class="sn-page__section" aria-labelledby="mod-t">
    <div class="sn-section-heading"><h2 class="sn-title title-m" id="mod-t">Modules</h2><span class="sn-section-heading__count">8</span></div>
    <div class="sn-launcher-card__grid" id="grid"></div>
  </section>
  <div class="sn-page-home__recent">
    <section class="sn-card sn-page__section" aria-labelledby="rs-t">
      <div class="sn-section-heading"><h2 class="sn-title title-s" id="rs-t"><span class="sn-lead">Recently opened:</span> Sets</h2>
        <div class="sn-section-heading__end"><a class="sn-link sn-m-sets" href="#sets">All 12 saved sets</a></div></div>
      <ul class="sn-page__list" id="rsets"></ul>
    </section>
    <section class="sn-card sn-page__section" aria-labelledby="rt-t">
      <div class="sn-section-heading"><h2 class="sn-title title-s" id="rt-t"><span class="sn-lead">Recently opened:</span> Tracks</h2>
        <div class="sn-section-heading__end"><a class="sn-link sn-m-library" href="#library">Open the library</a></div></div>
      <ul class="sn-page__list" id="rtracks"></ul>
    </section>
  </div>
  <section class="sn-page__section" aria-labelledby="hl-t">
    <div class="sn-section-heading"><h2 class="sn-title title-m" id="hl-t">Health</h2>
      <div class="sn-section-heading__end"><a class="sn-link sn-m-pipeline" href="#pipeline">Open Pipeline health</a></div></div>
    <div class="sn-service-status-list" id="health"></div>
    <p class="sn-page-home__healthy" id="healthy"></p>
  </section>
</main>
<div id="drw"></div>
<div class="sn-toast__region" role="status" aria-live="polite" aria-label="Notifications" id="toasts"></div>
<p class="sn-sr" role="status" id="sn-live"></p>
```

#### LibraryPage

```html
<!-- LibraryPage/README.md has no html block: static markup from components/LibraryPage/preview.html (verbatim, scripts removed) -->
<a class="sn-skip" href="#main">Skip to main content</a>
<div id="hdr" data-drawer-inert></div>
<main class="sn-page__main sn-page-library" id="main" tabindex="-1" data-drawer-inert>
  <div id="ph"></div>
  <div class="sn-figure-tile-row" role="list" aria-label="Library at a glance" id="tiles"></div>
  <div class="sn-banner" data-status="info" role="status" id="banner"></div>
  <div class="sn-page-library__body">
    <div class="sn-filter-rail" id="rail"></div>
    <div class="sn-page-library__crate">
      <div class="sn-data-table sn-data-table--stack" id="dt">
        <div class="sn-data-table__bar"><span class="sn-data-table__count" id="count" aria-live="polite">846 tracks match · showing 12</span></div>
        <div class="sn-tablebox sn-data-table__box">
          <table class="sn-table">
            <caption class="sn-sr">Crate, 12 of 846 matching tracks. Column headers with buttons are sortable.</caption>
            <thead><tr id="head"></tr></thead>
            <tbody id="body"></tbody>
          </table>
        </div>
      </div>
      <div class="sn-show-more">
        <span class="sn-show-more__count" role="status">Showing <b>12</b> of <b>846</b> tracks</span>
        <div class="sn-show-more__actions"><button class="sn-btn sn-btn--sm" type="button">Show 150 more</button><button class="sn-btn sn-btn--sm sn-btn--quiet" type="button">Show all 846</button></div>
      </div>
    </div>
  </div>
</main>
<div id="drw"></div>
<div class="sn-toast__region" role="status" aria-live="polite" aria-label="Notifications" id="toasts"></div>
<p class="sn-sr" role="status" id="sn-live"></p>
```

#### LogPage

```html
<!-- LogPage/README.md has no html block: static markup from components/LogPage/preview.html (skeleton: depth 4, repeats folded; full markup there) -->
<a class="sn-skip" href="#main">
  Skip to content
</a>
<div id="sh-head" data-drawer-inert></div>
<main class="sn-page-log" id="main" tabindex="-1" data-drawer-inert>
  <div id="ph"></div>
  <section class="sn-page-log__section" aria-label="Target tracks">
    <div class="sn-page-log__toolbar">
      <div id="chips-pri"></div>
      <!-- … 1 more like this -->
      <div class="sn-page-log__toolbar-end" id="summary"></div>
    </div>
    <div class="sn-data-table sn-data-table--stack" id="dt">
      <div class="sn-data-table__bar">
        <span class="sn-data-table__count" id="count" aria-live="polite"></span>
        <div class="sn-page-log__bulk" role="toolbar" aria-label="Bulk actions for selected target tracks" id="bulk" hidden>…</div>
      </div>
      <div class="sn-tablebox sn-data-table__box">
        <table class="sn-table">…</table>
      </div>
    </div>
    <p class="sn-sr" aria-live="polite" id="announce"></p>
  </section>
  <!-- … 2 more like this -->
</main>
<div id="sh-drawer"></div>
<dialog class="sn-dialog sn-dialog--m" id="add" aria-labelledby="add-title"></dialog>
<dialog class="sn-dialog sn-dialog--s sn-confirm-dialog" id="confirm" role="alertdialog" aria-modal="true" aria-labelledby="cf-t" aria-describedby="cf-d"></dialog>
<div class="sn-toast__region" role="status" aria-live="polite" aria-label="Notifications" id="sn-toasts"></div>
<p class="sn-sr" role="status" id="sn-live"></p>
```

#### MatrixPage

```html
<!-- MatrixPage/README.md has no html block: static markup from components/MatrixPage/preview.html (skeleton: depth 4, repeats folded; full markup there) -->
<a class="sn-skip" href="#main">
  Skip to content
</a>
<div id="sh-head" data-drawer-inert></div>
<main class="sn-page-matrix" id="main" tabindex="-1" data-drawer-inert>
  <div id="ph"></div>
  <section class="sn-page-matrix__section sn-m-sources" aria-label="Matrix views">
    <div class="sn-tabs__wrap">
      <div class="sn-tabs" role="tablist" aria-label="Matrix">
        <button class="sn-tab" role="tab" id="t-src" aria-controls="p-src" aria-selected="true" tabindex="0">…</button>
        <!-- … 1 more like this -->
      </div>
    </div>
    <div class="sn-tabs__panel sn-page-matrix__section" role="tabpanel" id="p-src" aria-labelledby="t-src" tabindex="0">
      <div class="sn-page-matrix__toolbar">
        <div class="sn-filter-chip-group" role="group" aria-labelledby="lg-grp">…</div>
        <label class="sn-checkbox">…</label>
        <div class="sn-page-matrix__toolbar-end">…</div>
      </div>
      <div class="sn-tablebox sn-page-matrix__box" tabindex="0" role="region" aria-labelledby="cap">
        <table class="sn-table sn-page-matrix__grid">…</table>
      </div>
      <ol class="sn-page-matrix__list" id="list" aria-label="Tracks and the sources that played them"></ol>
      <p class="sn-sr" aria-live="polite" id="announce"></p>
    </div>
    <!-- … 1 more like this -->
  </section>
</main>
<div id="sh-drawer"></div>
<p class="sn-sr" role="status" id="sn-live"></p>
```

#### MonitoringPage

```html
<!-- MonitoringPage/README.md has no html block: static markup from components/MonitoringPage/preview.html (skeleton: depth 4, repeats folded; full markup there) -->
<a class="sn-skip" href="#main">
  Skip to content
</a>
<div id="sh-head" data-drawer-inert></div>
<main class="sn-page-monitor" id="main" tabindex="-1" data-drawer-inert>
  <div class="sn-page-monitor__section">
    <div id="ph"></div>
    <!-- … 1 more like this -->
  </div>
  <div class="sn-figure-tile-row" role="list" aria-label="Pipeline at a glance" id="tiles"></div>
  <section class="sn-page-monitor__section" aria-labelledby="scr-h">
    <div class="sn-section-heading">
      <h2 class="sn-title title-m" id="scr-h">
        <span class="sn-lead">…</span>
        Scrapers
      </h2>
      <span class="sn-section-heading__count">
        6 scrapers
      </span>
      <p class="sn-section-heading__caveat">
        Last success turns ▲ after 1 h and ✕ after 6 h. Success r…
      </p>
    </div>
    <div class="sn-data-table sn-data-table--stack">
      <div class="sn-tablebox sn-data-table__box">
        <table class="sn-table">…</table>
      </div>
    </div>
  </section>
  <div class="sn-page-monitor__grid">
    <section class="sn-card sn-m-pipeline" aria-labelledby="enr-h" id="enrich"></section>
    <section class="sn-card sn-card--list" aria-labelledby="px-h">
      <div class="sn-card__head">
        <h2 class="sn-title title-s" id="px-h">…</h2>
      </div>
      <ul class="sn-card__list" id="proxies"></ul>
    </section>
  </div>
  <!-- … 1 more like this -->
  <p class="sn-page-monitor__foot">
    Deep metrics live in Grafana:
    <a class="sn-link sn-link--ext" href="/monitoring/" target="_blank" rel="noopener">
      Open Grafana
      <span class="sn-sr">
        , opens in a new tab
      </span>
    </a>
    <!-- … 1 more like this -->
  </p>
</main>
<div id="sh-drawer"></div>
<div class="sn-toast__region" role="status" aria-live="polite" aria-label="Notifications" id="sn-toasts"></div>
<p class="sn-sr" role="status" id="sn-live"></p>
```

#### PrintSheet

```html
<!-- PrintSheet/README.md has no html block: static markup from components/PrintSheet/preview.html (verbatim, scripts removed) -->
<div class="sn-page-print">
  <div class="sn-page-print__desk">
    <div class="sn-page-print__bar" data-print="hide">
      <span>Print preview · A4 portrait · 1 page</span>
      <label class="sn-checkbox"><input type="checkbox" id="notes"><span class="sn-checkbox__text"><span>Add a notes column</span></span></label>
      <button class="sn-btn sn-btn--primary" type="button" id="print"></button>
    </div>
    <article class="sn-page-print__paper" data-theme="light" aria-labelledby="ps-title">
      <header class="sn-page-print__head">
        <div>
          <h1 class="sn-title title-l" id="ps-title"><span class="sn-lead">Set:</span> Peak time Friday</h1>
          <p class="sn-page-print__meta" id="meta"></p>
        </div>
        <p class="sn-page-print__key" aria-label="Energy bar patterns">
          <span>Low 1–4 <span class="sn-page-print__ebar" aria-hidden="true"><i data-t="low"></i><i data-t="low"></i></span> solid segments</span>
          <span>Building 5–7 <span class="sn-page-print__ebar" aria-hidden="true"><i data-t="building"></i><i data-t="building"></i></span> hatched segments</span>
          <span>High 8–10 <span class="sn-page-print__ebar" aria-hidden="true"><i data-t="high"></i><i data-t="high"></i></span> cross-hatched segments</span>
        </p>
      </header>
      <table class="sn-page-print__table">
        <caption class="sn-sr">Running order, 18 slots</caption>
        <thead><tr id="head"></tr></thead>
        <tbody id="rows"></tbody>
      </table>
      <footer class="sn-page-print__foot">
        <span>Peak time Friday · Set builder · SongNodes</span><code>songnodes.local/sets/peak-time-friday</code>
        <span>Printed 24 Oct 2026, 21:30 AEDT · Library as of 24 Oct 2026, 06:00 AEDT</span><span>Page 1 of 1</span>
      </footer>
    </article>
  </div>
</div>
```

#### RetiredPageNotice

```html
<!-- RetiredPageNotice/README.md has no html block: static markup from components/RetiredPageNotice/preview.html (verbatim, scripts removed) -->
<a class="sn-skip" href="#main">Skip to content</a>
<div id="sh-head" data-drawer-inert></div>
<main class="sn-page-retired" id="main" tabindex="-1" data-drawer-inert>
  <section class="sn-card sn-page-retired__card" aria-labelledby="moved-h">
    <span class="sn-page-retired__icon" id="ic1" aria-hidden="true"></span>
    <h1 class="sn-title title-l" id="moved-h">This page has moved</h1>
    <p class="body-l sn-muted">Target tracks used to be a tab in the Plan view’s right panel. They now have their own page in Sources, with priority filters, bulk actions and a run log.</p>
    <p class="sn-page-retired__dest"><a class="sn-link sn-m-sources" href="#/sources/targets" id="dest">Go to Sources: Target tracks</a></p>
    <dl class="sn-page-retired__facts">
      <dt>Old address</dt><dd><code>/?mode=plan&amp;tab=targets</code></dd>
      <dt>New address</dt><dd><code>/sources/targets</code></dd>
      <dt>Moved</dt><dd>24 Oct 2026</dd>
      <dt>This notice</dt><dd>Shows until 22 Jan 2027; after that the old address goes straight to the new page.</dd>
    </dl>
    <label class="sn-checkbox"><input type="checkbox" id="auto" aria-describedby="auto-h"><span class="sn-checkbox__text"><span>Skip this notice on this device</span><span class="sn-checkbox__hint" id="auto-h">Off by default. When on, the old address opens Target tracks directly; there is no countdown.</span></span></label>
    <p class="sn-inline-message" data-status="ok" id="auto-msg" hidden>Saved. Next time the old address opens Target tracks directly.</p>
  </section>
</main>
<div class="sn-page-retired" aria-label="Variant: retired, no replacement" role="region" style="padding-top:0">
  <span class="sn-preview__label" style="align-self:stretch">Variant · retired, no replacement</span>
  <section class="sn-card sn-page-retired__card" aria-labelledby="gone-h">
    <span class="sn-page-retired__icon" id="ic2" aria-hidden="true"></span>
    <h2 class="sn-title title-l" id="gone-h">This page is retired</h2>
    <p class="body-l sn-muted">debug-storage.html was a developer tool for looking inside saved settings. It is no longer part of SongNodes and nothing replaces it.</p>
    <dl class="sn-page-retired__facts">
      <dt>Address</dt><dd><code>/debug-storage.html</code></dd>
      <dt>Retired</dt><dd>24 Oct 2026</dd>
      <dt>From 22 Jan 2027</dt><dd>This address answers “Gone” (410).</dd>
    </dl>
    <p class="sn-row"><a class="sn-link" href="#/">Go to Home</a><span class="sn-dim">·</span><span>Theme and text size are in <a class="sn-link sn-m-services" href="#/settings#appearance">Services: Settings</a></span></p>
  </section>
</div>
<div id="sh-drawer"></div>
<p class="sn-sr" role="status" id="sn-live"></p>
```

#### SetBuilderPage

```html
<!-- SetBuilderPage/README.md has no html block: static markup from components/SetBuilderPage/preview.html (skeleton: depth 4, repeats folded; full markup there) -->
<a class="sn-skip" href="#main">
  Skip to main content
</a>
<div id="hdr" data-drawer-inert></div>
<main class="sn-page__main sn-page-sets" id="main" tabindex="-1" data-drawer-inert>
  <div id="ph"></div>
  <div class="sn-page-sets__layout">
    <div class="sn-page-sets__side">
      <section class="sn-card sn-m-sets sn-page-sets__controls" aria-labelledby="ctl-t">
        <details class="sn-disclosure" open id="ctl-d">…</details>
      </section>
    </div>
    <div class="sn-page-sets__work">
      <section class="sn-card sn-m-sets" aria-labelledby="w-t">
        <figure class="sn-chart-frame sn-energy-wave" aria-labelledby="w-t">…</figure>
      </section>
      <p class="sn-page-sets__summary" id="summary"></p>
      <section class="sn-page__section" aria-labelledby="ro-t" id="running-order">
        <div class="sn-section-heading sn-section-heading--rule">…</div>
        <ol class="sn-set-slot-list" id="list" aria-label="Running order, Peak time Friday"></ol>
        <div class="sn-show-more">…</div>
      </section>
    </div>
    <aside class="sn-page__section sn-page-sets__aside" aria-labelledby="saved-t">
      <div class="sn-section-heading">
        <h2 class="sn-title title-s" id="saved-t">…</h2>
        <span class="sn-section-heading__count">…</span>
        <div class="sn-section-heading__end">…</div>
      </div>
      <div class="sn-page-sets__saved sn-m-sets" id="saved"></div>
    </aside>
  </div>
</main>
<div id="drw"></div>
<dialog class="sn-dialog sn-dialog--s sn-confirm-dialog" id="dlg" role="alertdialog" aria-modal="true" aria-labelledby="dlg-t" aria-describedby="dlg-d">
  <div class="sn-dialog__head">
    <span class="sn-confirm-dialog__icon" id="dlg-i"></span>
    <h2 class="sn-title title-s sn-dialog__title" id="dlg-t">
      Start a new empty set?
    </h2>
  </div>
  <div class="sn-dialog__body" id="dlg-d">
    <p class="sn-confirm-dialog__text">
      This clears the 14-slot running order on screen. The save…
    </p>
    <ul class="sn-confirm-dialog__facts">
      <li>
        Unsaved changes since 21:30 are lost: 2 slots moved.
      </li>
      <!-- … 1 more like this -->
    </ul>
  </div>
  <div class="sn-dialog__foot">
    <button class="sn-btn" type="button" data-cancel>
      Cancel
    </button>
    <button class="sn-btn sn-btn--danger" type="button" data-confirm>
      Clear running order
    </button>
  </div>
</dialog>
<div class="sn-toast__region" role="status" aria-live="polite" aria-label="Notifications" id="toasts"></div>
<p class="sn-sr" role="status" id="sn-live"></p>
```

#### SettingsPage

```html
<!-- SettingsPage/README.md has no html block: static markup from components/SettingsPage/preview.html (skeleton: depth 4, repeats folded; full markup there) -->
<a class="sn-skip" href="#main">
  Skip to main content
</a>
<div id="hdr" data-drawer-inert></div>
<main class="sn-page__main sn-page-settings" id="main" tabindex="-1" data-drawer-inert>
  <div id="ph"></div>
  <div class="sn-page-settings__layout">
    <nav class="sn-page-settings__toc sn-m-services" aria-label="Settings sections">
      <ol>
        <li>…</li>
        <!-- … 3 more like this -->
      </ol>
    </nav>
    <div class="sn-page-settings__sections">
      <section class="sn-page__section" id="services" aria-labelledby="c-t">
        <div class="sn-section-heading sn-section-heading--rule">…</div>
        <div class="sn-service-status-list" id="svc"></div>
      </section>
      <section class="sn-page__section sn-m-services" id="keys" aria-labelledby="k-t">
        <div class="sn-section-heading sn-section-heading--rule">…</div>
        <div class="sn-page-settings__keys" id="keyGrid"></div>
        <div class="sn-page-settings__actions">…</div>
      </section>
      <section class="sn-page__section" id="preferences" aria-labelledby="pp-title">
        <section class="sn-preferences-panel" aria-labelledby="pp-title">…</section>
      </section>
      <!-- … 3 more like this -->
    </div>
  </div>
</main>
<div id="drw"></div>
<dialog class="sn-dialog sn-dialog--s sn-confirm-dialog" id="dlg" role="alertdialog" aria-modal="true" aria-labelledby="dlg-t" aria-describedby="dlg-d"></dialog>
<div class="sn-toast__region" role="status" aria-live="polite" aria-label="Notifications" id="toasts"></div>
<p class="sn-sr" role="status" id="sn-live"></p>
```

#### TrackDetailPage

```html
<!-- TrackDetailPage/README.md has no html block: static markup from components/TrackDetailPage/preview.html (skeleton: depth 4, repeats folded; full markup there) -->
<a class="sn-skip" href="#main">
  Skip to main content
</a>
<div id="hdr" data-drawer-inert></div>
<main class="sn-page__main sn-page-track" id="main" tabindex="-1" data-drawer-inert>
  <div class="sn-page__section">
    <nav class="sn-breadcrumbs" aria-label="Breadcrumb">
      <ol class="sn-breadcrumbs__list" id="crumbs"></ol>
    </nav>
    <div id="ph"></div>
    <div class="sn-card sn-page-track__identity" role="group" aria-label="Key, tempo, energy and length" id="ident"></div>
  </div>
  <div class="sn-page__cols">
    <div class="sn-page-track__mainc">
      <section class="sn-card">
        <figure class="sn-chart-frame sn-waveform-strip" aria-labelledby="wf-t">…</figure>
      </section>
      <!-- … 1 more like this -->
      <section class="sn-page__section" aria-labelledby="ct-t">
        <div class="sn-section-heading sn-section-heading--rule">…</div>
        <div class="sn-data-table sn-data-table--stack">…</div>
      </section>
      <details class="sn-disclosure">
        <summary>…</summary>
        <div class="sn-disclosure__body">…</div>
      </details>
    </div>
    <aside class="sn-page-track__aside" aria-label="Key, identifiers and links">
      <section class="sn-card sn-page__section sn-m-harmony" aria-labelledby="k-t">
        <h2 class="sn-title title-s" id="k-t">…</h2>
        <div class="sn-page-track__wheel">…</div>
      </section>
      <section class="sn-card sn-page__section" aria-labelledby="id-t">
        <h2 class="sn-title title-s" id="id-t">…</h2>
        <dl class="sn-key-value-grid" id="ids"></dl>
      </section>
      <!-- … 2 more like this -->
    </aside>
  </div>
</main>
<div id="drw"></div>
<div class="sn-toast__region" role="status" aria-live="polite" aria-label="Notifications" id="toasts"></div>
<p class="sn-sr" role="status" id="sn-live"></p>
```

#### WeeklyGridPage

```html
<!-- WeeklyGridPage/README.md has no html block: static markup from components/WeeklyGridPage/preview.html (verbatim, scripts removed) -->
<a class="sn-skip" href="#main">Skip to content</a>
<div id="sh-head" data-drawer-inert></div>
<main class="sn-page-weekly" id="main" tabindex="-1" data-drawer-inert>
  <div id="ph"></div>
  <section class="sn-page-weekly__section" aria-label="Week">
    <div id="weeknav"></div>
    <div class="sn-figure-tile-row" role="list" aria-label="Week at a glance" id="tiles"></div>
  </section>
  <section class="sn-page-weekly__section" aria-labelledby="grid-h">
    <div class="sn-section-heading">
      <h2 class="sn-title title-s" id="grid-h"><span class="sn-lead">Plays:</span> show by day</h2>
      <p class="sn-section-heading__caveat">Each cell: library-relevant plays, then how many were tracks new to the crate. Use the arrow keys to move between cells; details show on focus.</p>
    </div>
    <div class="sn-tablebox sn-page-weekly__gridbox">
      <table class="sn-table sn-page-weekly__grid" role="grid" aria-labelledby="grid-h" id="grid"></table>
    </div>
    <ol class="sn-page-weekly__days" id="days" aria-label="Plays by day"></ol>
    <p class="sn-sr" aria-live="polite" id="readout"></p>
  </section>
</main>
<div id="sh-drawer"></div>
<p class="sn-sr" role="status" id="sn-live"></p>
```

### Feedback (7)

#### Banner

```html
<div class="sn-banner" data-status="warn" role="status">
  <span class="sn-banner__icon"><svg class="sn-icon">…triangle-alert…</svg></span>
  <div class="sn-banner__body">
    <p class="sn-banner__content"><span class="sn-banner__title">Sets are shaped on energy alone.</span> Only 611 of 1,284 tracks have a key and BPM so far.</p>
    <div class="sn-banner__actions"><button class="sn-btn sn-btn--sm">Show tracks without a key</button></div>
  </div>
  <button class="sn-btn sn-btn--sm sn-btn--icon sn-btn--quiet sn-banner__dismiss" aria-label="Dismiss: key and BPM notice">…x…</button>
</div>
```

#### EmptyState

```html
<div class="sn-empty-state">
  <div class="sn-empty-state__icon"><svg class="sn-icon">…list-music…</svg></div>
  <h3 class="sn-empty-state__title">No sets yet</h3>
  <p class="sn-empty-state__text">Sets you build from the crate land here with their energy wave and running order.</p>
  <div class="sn-empty-state__meta">…optional tags, e.g. active filters…</div>
  <div class="sn-empty-state__actions"><button class="sn-btn sn-btn--primary sn-btn--lg">Build set</button></div>
</div>
```

#### ErrorState

```html
<section class="sn-error-state" data-status="warn" aria-labelledby="e1">
  <div class="sn-error-state__icon"><svg class="sn-icon">…timer…</svg></div>
  <h3 class="sn-error-state__title" id="e1">TIDAL is slow right now</h3>
  <div class="sn-error-state__text">TIDAL took longer than 20 s to send your playlists.</div>
  <p class="sn-error-state__retry">Retrying usually works within a minute.</p>
  <div class="sn-error-state__actions"><button class="sn-btn">Retry</button></div>
  <div class="sn-error-state__last"><div class="sn-error-state__stamp">Showing playlists from <time>24 Oct 2026, 06:00 AEDT</time></div>…last data…</div>
</section>
```

#### InlineMessage

```html
<p class="sn-inline-message" data-status="warn">2 transitions to look at: a key clash into slot 6 and a +3 energy jump.
  <a class="sn-link sn-inline-message__action" href="#">Show them</a></p>
```

#### LoadingState

```html
<div class="sn-loading-state" aria-busy="true" data-slow>   <!-- data-slow set by a 1 s timer -->
  <div class="sn-tablebox"><table class="sn-table">…same thead…
    <tr aria-hidden="true"><td><span class="sn-skel" style="--w:64px;--h:12px"></span></td>…</tr>
  </table></div>
  <p class="sn-loading-state__msg" role="status">Loading 1,284 tracks…</p>
</div>
```

#### StagedProgress

```html
<div class="sn-staged-progress">
  <div class="sn-staged-progress__head">
    <h2 class="sn-title title-s"><span class="sn-lead">Weekly build:</span> Sat 24 Oct</h2>
    <div class="sn-staged-progress__time"><span>Elapsed <b>4:18</b></span><span>About 3 min left</span></div>
  </div>
  <ol class="sn-staged-progress__steps">
    <li class="sn-staged-progress__step" data-state="running" aria-current="step">
      <span class="sn-staged-progress__glyph" aria-hidden="true"></span>
      <span class="sn-staged-progress__name">Match plays to tracks</span>
      <span class="sn-staged-progress__state">Running</span>
      <p class="sn-staged-progress__detail">Matching 312 of 500 tracks</p>
      <div class="sn-staged-progress__meter" role="progressbar" aria-valuenow="312" aria-valuemax="500"><i style="--p:62.4%"></i></div>
    </li>…
  </ol>
  <p class="sn-staged-progress__notice">…You can leave this page…</p>
  <div class="sn-staged-progress__foot"><button class="sn-btn">Cancel build</button></div>
</div>
```

#### Toast

```html
<div class="sn-toast__region" role="status" aria-live="polite" aria-label="Notifications">
  <div class="sn-toast">
    <span class="sn-toast__icon">…circle-check…</span>
    <span class="sn-toast__text">Added to <q>Peak time Friday</q></span>
    <span class="sn-toast__queue">+2 more</span>
    <button class="sn-btn sn-btn--sm sn-toast__action">Undo</button>
    <button class="sn-btn sn-btn--sm sn-btn--icon sn-btn--quiet sn-toast__close" aria-label="Dismiss notification">…x…</button>
  </div>
</div>
```

### Music (12)

#### BpmReadout

```html
<span class="sn-bpm"><b>87</b> <span class="sn-bpm-readout__alt">(174)</span><span class="sn-sr"> BPM, double time 174</span></span>
<span class="sn-bpm"><b>122–128</b><span class="sn-bpm-readout__unit">BPM</span></span>
<span class="sn-transition-note__item sn-bpm-readout__delta" data-level="perfect">+2 BPM</span>
```

#### CamelotWheel

```html
<div class="sn-camelot-wheel">
  <svg class="sn-camelot-wheel__svg" viewBox="0 0 420 420" role="group" aria-label="Camelot wheel. Now playing 8A, A minor">
    <path class="sn-camelot-wheel__seg" data-key="8A" role="button" tabindex="0" aria-pressed="false" aria-label="8A, A minor, 96 tracks, now playing"/>
    … 24 segments, then codes, counts and rings (aria-hidden) …
    <g aria-hidden="true"><circle class="sn-camelot-wheel__hub"/> 8A · A minor · Now playing</g>
  </svg>
</div>
```

#### CompatibilityBadge

```html
<span class="sn-pill sn-compatibility-badge" data-compat="compatible">+1 key</span>
<span class="sn-pill sn-pill--outline sn-compatibility-badge" data-compat="clash">key clash</span>
```

#### EnergyBar

```html
<span class="sn-energy sn-energy-bar" title="Energy 7 · Building 5–7">
  <span class="sn-energy__bar" aria-hidden="true"><i class="on"></i>…<i class="target"></i>…</span>
  <span class="sn-energy__n">7</span><span class="sn-sr"> of 10, building tier, target 8</span>
  <span class="sn-energy-bar__target" aria-hidden="true">target 8</span>
</span>
```

#### EnergyWave

```html
<figure class="sn-chart-frame sn-energy-wave" aria-labelledby="t">
  <div class="sn-chart-frame__head">…title "Set builder: Peak time Friday", subtitle "Energy per slot, 1–10 · 14 tracks · 92 min"…</div>
  <ul class="sn-chart-frame__legend">Energy per slot · Target wave · Building 5–7 · ✕ Too steep · ○ Drop 2–3 at once instead</ul>
  <div class="sn-chart-frame__plot"><svg tabindex="0" role="group" aria-roledescription="energy wave chart">…</svg></div>
  <div class="sn-energy-wave__summary">sn-pill[data-compat] per problem</div>
</figure>
```

#### KeyBadge

```html
<span class="sn-key" data-key="8A" title="A minor">8A</span>
<span class="sn-key sn-key-badge--lg" data-key="8A">8A <span class="sn-key__name">A minor</span></span>
<span class="sn-key" data-unknown>–<span class="sn-sr">Key not set</span></span>
```

#### MiniAudioPreview

```html
<div class="sn-mini-preview" data-state="playing" style="--sn-mini-preview-pct: 40%">
  <button class="sn-mini-preview__btn" type="button" aria-pressed="true" aria-label="Pause preview of Bicep – Glue">
    <svg class="sn-icon">pause</svg>
  </button>
  <span class="sn-mini-preview__track" aria-hidden="true"><span class="sn-mini-preview__fill"></span></span>
  <span class="sn-mini-preview__time">0:12 / 0:30</span>
</div>
```

#### SetCard

```html
<article class="sn-card sn-card--tonal sn-set-card" aria-labelledby="set-1">
  <div class="sn-card__head"><span class="sn-tag sn-category-tag">Peak time three waves</span></div>
  <h3 class="sn-set-card__name" id="set-1">Peak time Friday</h3>
  <div class="sn-set-card__stats"><span>92 min</span><span>18 tracks</span><span>3 peaks</span></div>
  <div class="sn-set-card__wave" role="img" aria-label="Energy wave: 5, 6, 7, …"><i data-e="5" style="height:50%"></i>…</div>
  …
</article>
```

#### SetSlot

```html
<li class="sn-set-slot" data-locked aria-label="Slot 2: Peggy Gou – (It Goes Like) Nanana, locked">
  <span class="sn-set-slot__n">2</span>
  <span class="sn-set-slot__energy">…EnergyBar with target…</span>
  <span class="sn-set-slot__track">…TrackCell…</span>
  <span class="sn-set-slot__data"><span class="sn-bpm"><b>124</b></span><span class="sn-key" data-key="8A">8A</span></span>
  <span class="sn-set-slot__act">…lock (aria-pressed), up, down, remove…</span>
</li>
```

#### TrackCell

```html
<div class="sn-track-cell">
  <span class="sn-track-cell__title"><span class="sn-track-cell__name" title="Bicep – Glue">
    <span class="sn-track-cell__artist">Bicep –</span> Glue</span></span>
  <span class="sn-track-cell__meta"><span class="sn-track-cell__mix">Original mix</span>
    <span class="sn-track-cell__sep" aria-hidden="true">·</span><span>Ninja Tune</span>
    <span class="sn-track-cell__sep" aria-hidden="true">·</span><span class="sn-track-cell__dur">4:29</span>
    <span class="sn-track-cell__links"><a class="sn-link sn-link--ext" href="…" target="_blank" rel="noopener">TIDAL</a></span></span>
</div>
```

#### TransitionNote

```html
<div class="sn-transition-note" role="note" aria-label="Transition">
  <span class="sn-transition-note__item" data-level="perfect">energy +1<span class="sn-sr"> (perfect)</span></span>
  <span class="sn-transition-note__item" data-level="compatible">+1 key 8A→9A<span class="sn-sr"> (compatible)</span></span>
  <span class="sn-transition-note__item" data-level="perfect">+2 BPM<span class="sn-sr"> (perfect)</span></span>
</div>
```

#### WaveformStrip

```html
<figure class="sn-chart-frame sn-waveform-strip" aria-labelledby="t">
  …head "Audio analysis: Bicep – Glue" / "4:29 · 130 BPM · ● 8A A minor · analysed 24 Oct 2026, 06:00 AEDT", zoom out / 1× / zoom in…
  <ul class="sn-chart-frame__legend">Intro, outro · Breakdown · Vocal · Energy · Cue · Playhead</ul>
  <div class="sn-waveform-strip__scroll">
    <svg tabindex="0" role="slider" aria-label="Playhead position" aria-valuemin="0" aria-valuemax="269" aria-valuenow="102"
         aria-valuetext="1:42, bar 56, Breakdown, energy 4">…</svg>
  </div>
  <p class="sn-waveform-strip__readout">1:42 · bar 56 · Breakdown · energy 4</p>
</figure>
```

### Actions (3)

#### Button

```html
<button class="sn-btn" type="button"><svg class="sn-icon">…</svg>Copy tracklist</button>
```

#### CopyButton

```html
<button class="sn-btn sn-copy-button" type="button" data-copy="…">
  <span class="sn-copy-button__idle"><svg class="sn-icon">copy</svg></span>
  <span class="sn-copy-button__done"><svg class="sn-icon">check</svg></span>
  <span class="sn-copy-button__text">Copy tracklist</span>
</button>
<div class="sn-sr" aria-live="polite"></div>
```

#### TextLink

```html
<a class="sn-link sn-m-sources" href="/sources/pbs">PBS Soul Time</a>
<a class="sn-link sn-link--ext" href="https://…" target="_blank" rel="noopener">Open on 1001tracklists<span class="sn-sr">, opens in a new tab</span></a>
```

### Data (10)

#### Card

```html
<!-- Card/README.md has no html block: static markup from components/Card/preview.html (verbatim, scripts removed) -->
<div class="sn-card-grid">
  <section class="sn-card" aria-labelledby="n1">
    <div class="sn-card__eyebrow">This week</div>
    <h3 class="sn-title title-s" id="n1">38 new tracks</h3>
    <p class="sn-card__text">Mostly UK garage from triple j Mix Up and PBS Soul Time. 9 need an energy check.</p>
    <div class="sn-card__foot"><button class="sn-btn sn-btn--sm" type="button">Review new tracks</button><button class="sn-btn sn-btn--quiet sn-btn--sm" type="button">Dismiss</button></div>
  </section>
  <article class="sn-card sn-card--media sn-m-sources" aria-labelledby="n2">
    <div class="sn-card__media sn-card__media--placeholder" id="media" aria-hidden="true"></div>
    <div class="sn-card__body">
      <div class="sn-card__eyebrow">Radio · Sat 17 Oct</div>
      <h3 class="sn-title title-s" id="n2">PBS Soul Time</h3>
      <p class="sn-card__text">24 tracks, 6 new to the library.</p>
    </div>
  </article>
  <section class="sn-card sn-card--list" aria-labelledby="n3">
    <div class="sn-card__head"><h3 class="sn-title title-s" id="n3"><span class="sn-lead">Top:</span> heard most</h3></div>
    <ul class="sn-card__list" id="top"></ul>
  </section>
  <article class="sn-card sn-card--link sn-m-sets">
    <div class="sn-card__eyebrow">Saved set · updated 22 Oct</div>
    <h3 class="sn-title title-s"><a class="sn-card__primary" href="#set-peak-time-friday">Peak time Friday</a></h3>
    <p class="sn-card__text">92 min · 18 tracks · three waves. The whole card opens the set.</p>
    <div class="sn-card__foot"><a class="sn-link sn-card__raise" href="#export">Copy tracklist</a></div>
  </article>
</div>
<div class="sn-card-grid" id="tonal" style="--sn-card-min:200px"></div>
```

#### CategoryTag

```html
<span class="sn-tag sn-category-tag">UK garage</span>
<span class="sn-tag sn-category-tag sn-category-tag--high">High rotation</span>
<span class="sn-tag sn-category-tag sn-category-tag--vault">Vault</span>
```

#### Checklist

```html
<ul class="sn-checklist">
  <li class="sn-checklist__item" data-state="fail">
    <span class="sn-checklist__glyph">…x icon…</span>
    <span class="sn-checklist__text"><span class="sn-checklist__label"><span class="sn-sr">Failed: </span>Has TIDAL link</span>
      <span class="sn-checklist__note">No TIDAL match for this ISRC. Search TIDAL by title or link it by hand.</span></span>
    <span></span>
  </li>
</ul>
```

#### DataTable

```html
<!-- DataTable/README.md has no html block: static markup from components/DataTable/preview.html (verbatim, scripts removed) -->
<div class="sn-data-table sn-data-table--stack" id="dt">
  <div class="sn-data-table__bar">
    <span class="sn-data-table__count" id="count" aria-live="polite"></span>
    <button class="sn-btn sn-btn--sm" type="button" id="bulk" hidden></button>
    <div class="sn-data-table__bar-end">
      <span class="sn-preview__label" id="grp-l">Group</span>
      <div class="sn-seg" role="group" aria-labelledby="grp-l" id="group">
        <button type="button" aria-pressed="true" data-v="">None</button><button type="button" aria-pressed="false" data-v="tier">Energy tier</button><button type="button" aria-pressed="false" data-v="pillar">Pillar</button>
      </div>
      <div class="sn-seg" role="group" aria-label="Row density" id="density">
        <button type="button" aria-pressed="true" data-v="comfortable">Comfortable</button><button type="button" aria-pressed="false" data-v="compact">Compact</button>
      </div>
      <div class="sn-data-table__chooser">
        <button class="sn-btn sn-btn--sm" type="button" id="cols-btn" aria-expanded="false" aria-controls="cols-pop"></button>
        <div class="sn-data-table__chooser-pop" id="cols-pop" hidden></div>
      </div>
    </div>
  </div>
  <div class="sn-tablebox sn-data-table__box" id="box">
    <table class="sn-table">
      <caption>Crate · 12 of 1,284 tracks · <span class="sn-sr">Column headers with buttons are sortable.</span><span aria-hidden="true">Sort by any column header</span></caption>
      <thead><tr id="head"></tr></thead>
      <tbody id="body"></tbody>
    </table>
  </div>
  <div class="sn-row">
    <span class="sn-preview__label" id="st-l">Preview state</span>
    <div class="sn-seg" role="group" aria-labelledby="st-l" id="state">
      <button type="button" aria-pressed="true" data-v="data">Data</button><button type="button" aria-pressed="false" data-v="loading">Loading</button><button type="button" aria-pressed="false" data-v="empty">Empty</button><button type="button" aria-pressed="false" data-v="error">Error</button>
    </div>
  </div>
  <div class="sn-sr" aria-live="polite" id="announce"></div>
</div>
```

#### Disclosure

```html
<details class="sn-disclosure" data-remember="library.how-energy">
  <summary><span class="sn-disclosure__chev">…chevron-right…</span>How energy is scored<span class="sn-disclosure__hint">1 to 10</span></summary>
  <div class="sn-disclosure__body"><p>…</p></div>
</details>
```

#### FigureTile

```html
<div class="sn-figure-tile-row" role="list" aria-label="Library at a glance">
  <div class="sn-figure-tile" role="listitem">
    <span class="sn-figure-tile__figure">47</span>
    <span class="sn-figure-tile__label">Need an energy check</span>
    <div class="sn-figure-tile__foot"><span class="sn-pill sn-status-pill" data-status="warn">To check</span>
      <a class="sn-link sn-m-library" href="/library?check=energy">Review</a></div>
  </div>
</div>
```

#### KeyValueGrid

```html
<dl class="sn-key-value-grid sn-key-value-grid--cols-2">
  <dt>BPM</dt><dd><span class="sn-bpm"><b>128</b></span></dd>
  <dt>ISRC</dt><dd><span class="sn-key-value-grid__id">GBCFB1700384</span>
    <button class="sn-btn sn-btn--quiet sn-btn--sm sn-btn--icon sn-key-value-grid__copy" type="button" aria-label="Copy ISRC">…</button></dd>
  <dt>Beatport ID</dt><dd><span class="sn-none">–</span><span class="sn-sr">Beatport ID not known</span></dd>
</dl>
```

#### SectionHeading

```html
<div class="sn-section-heading sn-section-heading--rule">
  <h2 class="sn-title title-m"><span class="sn-lead">Crate:</span> Needs an energy check</h2>
  <span class="sn-section-heading__count">47 tracks</span>
  <div class="sn-section-heading__end"><button class="sn-btn sn-btn--sm" type="button">Export CSV</button></div>
  <p class="sn-section-heading__caveat">Energy is estimated from BPM and source; 47 tracks need a check.</p>
</div>
```

#### ServiceStatus

```html
<section class="sn-service-status" aria-label="TIDAL connection">
  <span class="sn-service-status__mark" aria-hidden="true">Ti</span>
  <div class="sn-service-status__main">
    <div class="sn-service-status__name">TIDAL <span class="sn-pill sn-status-pill" data-status="warn">Expired</span></div>
    <div class="sn-service-status__detail">Sign-in expired 21 Oct 2026, 06:00 AEDT. Sunday's “Send to TIDAL” run will skip until you reconnect.</div>
  </div>
  <div class="sn-service-status__act"><button class="sn-btn sn-btn--sm sn-service-status__btn--tidal" type="button">Reconnect TIDAL</button></div>
</section>
```

#### SourceBadge

```html
<span class="sn-source-badge">
  <span class="sn-source-badge__name">… triple j Mix Up</span>
  <button class="sn-source-badge__more" type="button" aria-expanded="false" aria-controls="src-1" aria-label="3 more sources">+3</button>
  <ul class="sn-source-badge__pop" id="src-1" hidden>…</ul>
</span>
```

### Charts (5)

#### ChartFrame

```html
<figure class="sn-chart-frame" aria-labelledby="t">
  <div class="sn-chart-frame__head">
    <div class="sn-chart-frame__titles">
      <h3 class="sn-title title-s" id="t"><span class="sn-lead">Library:</span> Plays per week by pillar</h3>
      <p class="sn-chart-frame__sub">Radio plays · 12 weeks, 3 Aug – 24 Oct 2026</p>
    </div>
    <div class="sn-chart-frame__actions"><button class="sn-btn sn-btn--sm sn-btn--quiet">View as table</button></div>
  </div>
  <ul class="sn-chart-frame__legend">…only when more than 3 series…</ul>
  <div class="sn-chart-frame__plot"><svg tabindex="0" role="group" aria-roledescription="line chart">…</svg><div class="sn-chart-frame__tip"></div></div>
  <div class="sn-chart-frame__table" hidden><div class="sn-tablebox"><table class="sn-table">…</table></div></div>
  <p class="sn-sr" aria-live="polite"></p>
</figure>
```

#### Heatmap

```html
<figure class="sn-chart-frame sn-heatmap" aria-labelledby="t">
  …ChartFrame head: "Key & mood: Library coverage" / "Tracks per Camelot key and energy · 1,284 tracks"…
  <span class="sn-heatmap__ramp">0 <span class="sn-heatmap__ramp-steps"><i></i>×7</span> 43 <span class="sn-heatmap__ramp-none">No episode</span></span>
  <div class="sn-chart-frame__plot"><svg role="grid">
    <g role="row"><text role="columnheader">Key</text><text role="columnheader" aria-label="Energy 1">1</text>…</g>
    <g role="row"><g role="rowheader" aria-label="8A A minor">● 8A</g>
      <rect class="sn-heatmap__cell" data-step="4" role="gridcell" tabindex="-1" aria-label="8A A minor, energy 7: 31 tracks"/>…</g>
  </svg></div>
  <p class="sn-heatmap__readout" aria-live="polite">● 8A A minor · energy 7: 31 tracks</p>
</figure>
```

#### ProgressBar

```html
<div class="sn-progress-bar">
  <div class="sn-progress-bar__head">
    <span class="sn-progress-bar__label" id="l">Import tracklists from 1001tracklists</span>
    <span class="sn-progress-bar__value">312 of 500 · 62%</span>
  </div>
  <div class="sn-progress-bar__track" role="progressbar" aria-labelledby="l" aria-valuemin="0" aria-valuemax="500"
       aria-valuenow="312" aria-valuetext="312 of 500 tracklists, 62%" style="--p: 62.4%"><div class="sn-progress-bar__fill"></div></div>
  <div class="sn-progress-bar__foot"><span>Started 21:04 · about 6 min left</span><span class="sn-pill" data-status="ok">Healthy</span></div>
</div>
```

#### ProgressRing

```html
<span class="sn-progress-ring sn-progress-ring--40" role="progressbar" aria-label="Library keyed"
      aria-valuemin="0" aria-valuemax="100" aria-valuenow="48" aria-valuetext="48%, 616 of 1,284 tracks">
  <span class="sn-progress-ring__box">
    <svg class="sn-progress-ring__svg" width="40" height="40" viewBox="0 0 40 40" aria-hidden="true">
      <circle class="sn-progress-ring__track" cx="20" cy="20" r="18" stroke-width="4"/>
      <circle class="sn-progress-ring__fill" cx="20" cy="20" r="18" stroke-width="4" stroke-dasharray="113.1" stroke-dashoffset="58.81"/>
    </svg>
    <span class="sn-progress-ring__value" aria-hidden="true">48</span>
  </span>
  <span class="sn-progress-ring__text"><b>Library keyed</b><span>616 of 1,284 tracks</span></span>
</span>
```

#### Sparkline

```html
<span class="sn-sparkline" role="img" aria-label="Plays per week, last 12 weeks: latest 12, low 2 in the week of 3 Aug, high 12 in the week of 19 Oct">
  <svg width="96" height="22" aria-hidden="true">
    <polyline class="sn-sparkline__line" points="…"/>
    <circle class="sn-sparkline__ext" r="2.5"/><circle class="sn-sparkline__ext" r="2.5"/>  <!-- low, high -->
    <circle class="sn-sparkline__end" r="3"/>
  </svg>
  <span class="sn-sparkline__val" aria-hidden="true">12</span>
  <span class="sn-sparkline__tip" aria-hidden="true">low <b>2</b> 3 Aug · high <b>12</b> 19 Oct</span>
</span>
```

### Inputs (17)

#### AutocompleteSearchField

```html
<form class="sn-search-field sn-autocomplete" role="search">
  <label class="sn-sr" for="q">Search tracks</label>
  <div class="sn-search-field__box">
    <span class="sn-search-field__icon"><svg class="sn-icon">search</svg></span>
    <input class="sn-input sn-search-field__input" type="search" id="q" role="combobox"
           aria-autocomplete="list" aria-expanded="true" aria-controls="q-list"
           aria-activedescendant="q-opt-s1" aria-describedby="q-meta" autocomplete="off" spellcheck="false">
    <span class="sn-search-field__end">
      <button class="sn-search-field__clear" type="button" aria-label="Clear search">…</button>
    </span>
    <div class="sn-autocomplete__popup">
      <div class="sn-autocomplete__list" role="listbox" id="q-list" aria-label="Search tracks: suggestions">
        <div class="sn-autocomplete__group" role="group" aria-labelledby="q-g-recent">
          <span class="sn-autocomplete__group-label" id="q-g-recent">Recent searches</span>
          <div class="sn-autocomplete__options">
            <div class="sn-autocomplete__option" role="option" id="q-opt-r1" tabindex="-1" aria-selected="false">
              <span class="sn-autocomplete__icon" aria-hidden="true"><svg class="sn-icon">history</svg></span>
              <span class="sn-autocomplete__text"><mark>bic</mark>ep glue</span>
            </div>
          </div>
        </div>
        <div class="sn-autocomplete__group" role="group" aria-labelledby="q-g-sugg">
          <span class="sn-autocomplete__group-label" id="q-g-sugg">Suggestions</span>
          <div class="sn-autocomplete__options">
            <div class="sn-autocomplete__option" role="option" id="q-opt-s1" tabindex="-1" aria-selected="true">
              <span class="sn-autocomplete__icon" aria-hidden="true"><svg class="sn-icon">search</svg></span>
              <span class="sn-autocomplete__text"><mark>Bic</mark>ep</span>
              <span class="sn-autocomplete__meta">Artist · 41</span>
            </div>
          </div>
        </div>
      </div>
      <div class="sn-autocomplete__foot"><button class="sn-autocomplete__clear" type="button">Clear recent searches</button></div>
    </div>
  </div>
  <div class="sn-search-field__meta" id="q-meta">…count, as SearchField…</div>
</form>
```

#### Checkbox

```html
<fieldset class="sn-checkbox-group">
  <legend class="sn-checkbox-group__legend">Track checks</legend>
  <label class="sn-checkbox"><input type="checkbox">
    <span class="sn-checkbox__text"><span>Needs an energy check<span class="sn-checkbox__count">37</span></span>
    <span class="sn-checkbox__hint">Energy came from one source only.</span></span></label>
</fieldset>
```

#### ChipInput

```html
<div class="sn-field sn-chip-input">
  <label class="sn-field__label" for="g">Genres</label>
  <span class="sn-field__help" id="g-h">Press Enter or a comma to add. Backspace removes the last one.</span>
  <div class="sn-chip-input__box">
    <ul class="sn-chip-input__list" aria-label="Genres added">
      <li class="sn-chip-input__chip">Deep house<button class="sn-chip-input__remove" aria-label="Remove Deep house">×</button></li>
    </ul>
    <input class="sn-chip-input__text" id="g" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="g-menu" aria-describedby="g-h g-msg">
    <ul class="sn-chip-input__menu" role="listbox" id="g-menu" hidden>
      <li class="sn-chip-input__option" role="option" aria-selected="false">Speed <mark>ga</mark>rage <small>41 tracks</small></li>
    </ul>
  </div>
  <span class="sn-chip-input__msg" id="g-msg" aria-live="polite"></span>
</div>
```

#### DateField

```html
<fieldset class="sn-date-field">
  <legend class="sn-date-field__legend">Released on</legend>
  <p class="sn-date-field__help">For example, 24 10 2026</p>
  <div class="sn-date-field__parts">
    <div class="sn-date-field__part"><label for="d">Day</label><input class="sn-input" id="d" inputmode="numeric" maxlength="2"></div>
    <div class="sn-date-field__part"><label for="m">Month</label><input class="sn-input" id="m" inputmode="numeric" maxlength="2"></div>
    <div class="sn-date-field__part sn-date-field__part--year"><label for="y">Year</label><input class="sn-input" id="y" inputmode="numeric" maxlength="4"></div>
  </div>
  <span class="sn-date-field__shown">Sat 24 Oct 2026</span>
</fieldset>
```

#### FileDrop

```html
<div class="sn-file-drop">
  <span class="sn-file-drop__label" id="l">Import tracklists</span>
  <div class="sn-file-drop__zone">                       <!-- data-dragover while dragging -->
    <svg class="sn-icon">upload</svg>
    <div class="sn-file-drop__zone-text"><strong><span class="sn-file-drop__drag">Drag files here, or choose them</span></strong>
      <span class="sn-file-drop__accept" id="h">.txt or .csv, one track per line, up to 2 MB each</span></div>
    <input type="file" class="sn-sr sn-file-drop__input" id="f" accept=".txt,.csv" multiple aria-labelledby="l b" aria-describedby="h">
    <label for="f" class="sn-btn sn-btn--sm sn-file-drop__choose" id="b">Choose files</label>
  </div>
  <ul class="sn-file-drop__files" aria-label="Selected files">
    <li class="sn-file-drop__file"> icon · <div class="sn-file-drop__name"><b>name</b><span class="sn-file-drop__size">2 KB</span></div> · remove
      <div class="sn-file-drop__result">pill + summary</div></li>
  </ul>
</div>
```

#### FilterChip

```html
<div class="sn-filter-chip-group" role="group" aria-labelledby="lg-pillar">
  <div class="sn-filter-chip-group__head">
    <span class="sn-filter-chip-group__legend" id="lg-pillar">Pillar</span>
    <button class="sn-filter-chip-group__clear" type="button">Clear (1)</button>
  </div>
  <ul class="sn-filter-chip-group__list">
    <li><button class="sn-chip sn-filter-chip" type="button" aria-pressed="true">
      <span>House</span><span class="sn-filter-chip__count"><span class="sn-sr">, </span>612<span class="sn-sr"> tracks</span></span>
    </button></li>
  </ul>
</div>
```

#### FilterRail

```html
<div class="sn-filter-rail">                       <!-- data-layout="rail|sheet" forces one layout -->
  <div class="sn-filter-rail__bar">                <!-- below 1024px only -->
    <button class="sn-btn sn-filter-rail__trigger" aria-haspopup="dialog" aria-expanded="false">Filters (3)</button>
    <ul class="sn-filter-rail__summary" aria-label="Active filters">
      <li><button class="sn-filter-rail__active" aria-label="Remove filter: House">House ×</button></li>
    </ul>
  </div>
  <div class="sn-filter-rail__scrim"></div>
  <aside class="sn-filter-rail__panel" aria-labelledby="t"> <!-- role="dialog" aria-modal="true" in sheet layout -->
    <div class="sn-filter-rail__head"><h2 class="sn-filter-rail__title" id="t">Filters</h2>…Clear filters / close</div>
    <div class="sn-filter-rail__body"> sections: SearchField, FilterChip groups, SelectField, Checkbox group </div>
    <div class="sn-filter-rail__foot"><button class="sn-btn sn-btn--primary">Show 95 tracks</button></div>
  </aside>
</div>
```

#### KeyPicker

```html
<div class="sn-key-picker">
  <div class="sn-key-picker__head"><span class="sn-key-picker__label" id="kl">Keys</span> quick-select and clear buttons</div>
  <div class="sn-key-picker__grid" role="group" aria-labelledby="kl">
    <span class="sn-key-picker__rowhead" data-span aria-hidden="true">Minor</span>
    <button class="sn-key-picker__key" data-key="8A" aria-pressed="true" tabindex="0" data-current>8A
      <span class="sn-sr">, A minor, current key</span><span class="sn-key-picker__tip" aria-hidden="true">A minor</span></button>
    …
  </div>
  <div class="sn-key-picker__foot">legend · <span role="status">2 keys: 8A, 9A</span></div>
</div>
```

#### NumberField

```html
<div class="sn-field sn-number-field">
  <label for="bpm" id="bpm-l">Target BPM</label>
  <div class="sn-number-field__box">
    <button class="sn-number-field__step" type="button" tabindex="-1" aria-label="Decrease target BPM">−</button>
    <input class="sn-number-field__input" id="bpm" role="spinbutton" inputmode="numeric"
      aria-valuenow="128" aria-valuemin="60" aria-valuemax="200" aria-valuetext="128 BPM" aria-labelledby="bpm-l bpm-u">
    <span class="sn-number-field__unit" id="bpm-u">BPM</span>
    <button class="sn-number-field__step" type="button" tabindex="-1" aria-label="Increase target BPM">+</button>
  </div>
  <span class="sn-number-field__range">60–200 BPM</span>
  <span class="sn-field__error" hidden></span>
</div>
```

#### PhotoCapture

```html
<div class="sn-photo-capture">
  <div class="sn-photo-capture__body">
    <div class="sn-photo-capture__frame" data-filled><img alt="" src="blob:…"></div>
    <div class="sn-photo-capture__side">
      <div class="sn-photo-capture__actions">
        <input type="file" accept="image/*" capture="environment" class="sn-sr sn-photo-capture__input" tabindex="-1" aria-hidden="true">
        <button class="sn-btn" type="button">camera icon Take photo</button>
        <input type="file" accept="image/jpeg,image/png,image/webp" class="sn-sr sn-photo-capture__input" tabindex="-1" aria-hidden="true">
        <button class="sn-btn" type="button">upload icon Choose image</button>
      </div>
      <p class="sn-photo-capture__meta">JPEG, PNG or WebP, up to 10 MB.</p>
      <div class="sn-field sn-text-field"> "Describe the photo" textarea </div>
    </div>
  </div>
</div>
```

#### RangeSlider

```html
<div class="sn-range-slider" role="group" aria-labelledby="bpm-l">
  <div class="sn-range-slider__head"><span class="sn-range-slider__label" id="bpm-l">BPM range</span><span class="sn-range-slider__readout" aria-hidden="true">120–130 BPM</span></div>
  <div class="sn-range-slider__main">
    <input class="sn-range-slider__num" aria-label="Minimum BPM" inputmode="numeric" value="120">
    <div class="sn-range-slider__rail">
      <div class="sn-range-slider__track"></div><div class="sn-range-slider__fill"></div>
      <div class="sn-range-slider__thumb" role="slider" tabindex="0" aria-label="Minimum BPM"
           aria-valuemin="100" aria-valuemax="130" aria-valuenow="120" aria-valuetext="120 BPM"></div>
      <div class="sn-range-slider__thumb" role="slider" tabindex="0" aria-label="Maximum BPM" …></div>
      <div class="sn-range-slider__ticks" aria-hidden="true"><span class="sn-range-slider__tick" style="left:0%">100</span>…</div>
    </div>
    <input class="sn-range-slider__num" aria-label="Maximum BPM" inputmode="numeric" value="130">
  </div>
</div>
```

#### SearchField

```html
<form class="sn-search-field" role="search" data-empty>
  <label class="sn-sr" for="q">Search tracks</label>
  <div class="sn-search-field__box">
    <span class="sn-search-field__icon"><svg class="sn-icon">search</svg></span>
    <input class="sn-input sn-search-field__input" type="search" id="q" aria-keyshortcuts="/" aria-describedby="q-meta">
    <span class="sn-search-field__end">
      <kbd class="sn-search-field__kbd" aria-hidden="true">/</kbd>
      <button class="sn-search-field__clear" type="button" aria-label="Clear search">…</button>
    </span>
  </div>
  <div class="sn-search-field__meta" id="q-meta">
    <span class="sn-search-field__count" role="status"><b>42</b> of 1,284 tracks</span>
    <span class="sn-search-field__suggest">Did you mean <button type="button">Overmono</button>?</span>
  </div>
</form>
```

#### SecretField

```html
<div class="sn-secret-field">
  <div class="sn-secret-field__head"><span class="sn-secret-field__label" id="k-l">Setlist.fm API key</span>
    <a class="sn-link sn-link--ext" href="…" target="_blank" rel="noopener">Get an API key</a></div>
  <!-- saved -->
  <div class="sn-secret-field__row"><div class="sn-secret-field__saved"><svg class="sn-icon">lock</svg> sk-…3f9a</div>
    <button class="sn-btn">Test key</button><button class="sn-btn sn-btn--quiet">Replace key</button></div>
  <!-- editing -->
  <div class="sn-secret-field__row"><div class="sn-secret-field__box">
    <input class="sn-input" type="password" autocomplete="off" spellcheck="false">
    <button class="sn-secret-field__reveal" aria-pressed="false" aria-label="Show key">eye</button></div>
    <button class="sn-btn">Test key</button><button class="sn-btn sn-btn--quiet">Cancel</button></div>
  <div class="sn-secret-field__status" aria-live="polite"><span class="sn-pill" data-status="ok">Key works</span>
    <span class="sn-secret-field__stamp">Last tested 24 Oct 2026, 06:00 AEDT</span></div>
</div>
```

#### SelectField

```html
<div class="sn-field sn-select-field">
  <label for="heard">Heard on</label>
  <select class="sn-select" id="heard"><option value="">Any show</option><option>PBS Soul Time</option></select>
</div>
```

#### Switch

```html
<li class="sn-switch">
  <div class="sn-switch__text">
    <span class="sn-switch__label" id="tidal-l">Send to TIDAL on the weekly run</span>
    <span class="sn-switch__desc" id="tidal-d">Each Monday at 06:00 the newest saved set becomes a TIDAL playlist.</span>
    <span class="sn-switch__saved" aria-hidden="true">Saved 21:30</span>
  </div>
  <button type="button" role="switch" class="sn-switch__control" aria-checked="true" aria-labelledby="tidal-l" aria-describedby="tidal-d">
    <span class="sn-switch__state" aria-hidden="true">On</span>
    <span class="sn-switch__track" aria-hidden="true"><span class="sn-switch__thumb"></span></span>
  </button>
</li>
```

#### TextField

```html
<div class="sn-field sn-text-field">
  <label class="sn-text-field__label" for="name"><span>Set name</span><span class="sn-text-field__count" aria-hidden="true">18 / 40</span></label>
  <span class="sn-field__help" id="name-help">Shown on the saved sets list.</span>
  <input class="sn-input" id="name" aria-describedby="name-help name-err" aria-invalid="true">
  <span class="sn-field__error" id="name-err">Enter a set name.</span>
</div>
```

#### TracklistPaste

```html
<div class="sn-tracklist-paste">
  <div class="sn-tracklist-paste__cols">
    <div class="sn-field"><label for="tl">Tracklist</label>
      <textarea class="sn-textarea sn-tracklist-paste__input" id="tl" spellcheck="false"></textarea>
      <details class="sn-tracklist-paste__formats"><summary>Supported formats</summary><ul>…</ul></details></div>
    <div class="sn-tracklist-paste__preview">
      <div class="sn-tracklist-paste__summary">9 lines: pills</div>
      <div class="sn-tablebox sn-tracklist-paste__table"><table class="sn-table">Line · Track · Status</table></div>
    </div>
  </div>
  <div class="sn-tracklist-paste__foot"><span class="sn-tracklist-paste__why"></span> Clear · <button class="sn-btn sn-btn--primary">Import 7 tracks</button></div>
</div>
```

### Surfaces (6)

#### ConfirmDialog

```html
<dialog class="sn-dialog sn-dialog--s sn-confirm-dialog" role="alertdialog" aria-labelledby="t" aria-describedby="d">
  <div class="sn-dialog__head"><span class="sn-confirm-dialog__icon">…trash-2…</span>
    <h2 class="sn-title title-s sn-dialog__title" id="t">Delete “Peak time Friday”?</h2></div>
  <div class="sn-dialog__body" id="d">
    <p class="sn-confirm-dialog__text">This removes the set … <strong>for everyone it’s shared with</strong>…</p>
    <ul class="sn-confirm-dialog__facts"><li>The 18 tracks stay in the library.</li></ul>
    <!-- typed: <div class="sn-field sn-confirm-dialog__typed"><label>Type the set name, …, to confirm</label><input class="sn-input"></div> -->
  </div>
  <div class="sn-dialog__foot"><button class="sn-btn" autofocus>Cancel</button><button class="sn-btn sn-btn--danger">Delete set</button></div>
</dialog>
```

#### Dialog

```html
<dialog class="sn-dialog sn-dialog--m" aria-labelledby="t">
  <div class="sn-dialog__head">
    <div class="sn-dialog__title"><h2 class="sn-title title-s" id="t"><span class="sn-lead">Edit cues:</span> Bicep – Glue</h2>
      <p class="sn-dialog__sub">Slot 7 of 18 in “Peak time Friday”</p></div>
    <button class="sn-btn sn-btn--icon sn-btn--quiet" aria-label="Close">…x…</button>
  </div>
  <form class="sn-dialog__body" method="dialog" id="f">…fields…</form>
  <div class="sn-dialog__foot">
    <button class="sn-btn sn-btn--quiet sn-dialog__foot-start">Reset cues</button>
    <button class="sn-btn">Cancel</button><button class="sn-btn sn-btn--primary" form="f">Save changes</button>
  </div>
</dialog>
```

#### MediaViewer

```html
<div class="sn-media-viewer" role="dialog" aria-modal="true" aria-labelledby="mv-name" tabindex="-1">
  <div class="sn-media-viewer__bar">
    <span class="sn-media-viewer__name" id="mv-name">Bicep – Glue · cover</span>
    <span class="sn-media-viewer__count" aria-live="polite">1 of 3</span>
    <div class="sn-media-viewer__tools">zoom out · <span class="sn-media-viewer__zoom">100%</span> · zoom in · fit · close</div>
  </div>
  <div class="sn-media-viewer__stage">
    <button class="sn-btn sn-btn--icon sn-media-viewer__nav sn-media-viewer__nav--prev" aria-label="Previous">…</button>
    <img class="sn-media-viewer__media" alt="Horizontal bands of indigo fading to amber…">
    <button class="… sn-media-viewer__nav--next" aria-label="Next">…</button>
  </div>
  <div class="sn-media-viewer__caption">
    <span class="sn-media-viewer__title">Bicep – Glue (cover art)</span>
    <span>Source: Beatport · 1,400 × 1,400</span>
    <span class="sn-media-viewer__alt"><b>Alt text:</b> Horizontal bands of indigo fading to amber…</span>
  </div>
</div>
```

#### Popover

```html
<span class="sn-popover__anchor">
  <button class="sn-btn sn-btn--sm" aria-haspopup="dialog" aria-expanded="false" aria-controls="p">Spares for slot 5</button>
  <div class="sn-popover" id="p" role="dialog" aria-labelledby="p-t" hidden>
    <div class="sn-popover__head"><h3 class="sn-popover__title" id="p-t" tabindex="-1">3 spare tracks</h3><button … aria-label="Close">…x…</button></div>
    <p class="sn-popover__text">Fit between slot 4 (energy 5, 8A) and slot 6:</p>
    <ul class="sn-popover__list"><li class="sn-popover__item">…<span class="sn-popover__grow">…</span><button class="sn-btn sn-btn--sm">Swap in</button></li></ul>
    <div class="sn-popover__foot">…</div>
  </div>
</span>
```

#### SideSheet

```html
<div class="sn-side-sheet__layout">
  <div class="sn-side-sheet__main">…graph or table…</div>
  <div class="sn-side-sheet__scrim" hidden></div>            <!-- phones only -->
  <aside class="sn-side-sheet" aria-labelledby="st">
    <span class="sn-side-sheet__handle" aria-hidden="true"></span>
    <div class="sn-side-sheet__head"><h2 class="sn-title title-s sn-side-sheet__title" id="st" tabindex="-1"><span class="sn-lead">Track:</span> Bicep – Glue</h2>
      <button class="sn-btn sn-btn--icon sn-btn--quiet" aria-label="Close track details">…x…</button></div>
    <div class="sn-side-sheet__body">… __section, __facts (dl), __list / __item …</div>
    <div class="sn-side-sheet__foot">…actions…</div>
  </aside>
</div>
```

#### Tooltip

```html
<span class="sn-key" data-key="3B" tabindex="0" aria-describedby="tip">3B</span>
<div class="sn-tooltip" id="tip" role="tooltip">F♯ major · Camelot 3B</div>
<!-- icon button: aria-label="Lock slot 3"; tooltip shows "Lock slot 3" + <span class="sn-tooltip__kbd">L</span> -->
```

### Status (3)

#### ConnectionStatus

```html
<span class="sn-connection-status" data-state="reconnecting" role="status">Reconnecting <span class="sn-connection-status__sub">attempt 2</span></span>
<div class="sn-connection-status-banner" data-state="offline" role="status">
  <span class="sn-connection-status-banner__msg"><b>Offline.</b> Showing data from 24 Oct 2026, 21:30 AEDT. …</span>
  <button class="sn-btn sn-btn--sm" type="button">Retry now</button>
</div>
```

#### FreshnessStamp

```html
<span class="sn-freshness-stamp" role="status">… <span>Library as of
  <time datetime="2026-10-23T19:00:00Z" title="3 h ago">24 Oct 2026, 06:00 AEDT</time></span>
  <span class="sn-freshness-stamp__rel">(3 h ago)</span></span>
```

#### StatusPill

```html
<span class="sn-pill sn-status-pill" data-status="bad">Paused after errors</span>
```

### Graph (2)

#### GraphControls

```html
<div class="sn-graph-controls">                       <!-- container-type: inline-size -->
  <svg class="sn-graph-controls__canvas" role="img" aria-label="Track graph, 1,284 nodes and 5,210 links">…</svg>
  <div class="sn-graph-controls__count">1,284 nodes · 5,210 links</div>
  <div class="sn-graph-controls__status" hidden><span class="sn-pill" data-status="idle">Layout paused</span></div>
  <div class="sn-graph-controls__colour" role="group" aria-labelledby="cb">
    <span class="sn-graph-controls__colour-label" id="cb">Colour by</span>
    <div class="sn-seg" role="group" aria-labelledby="cb"><button aria-pressed="true">Neutral</button><button aria-pressed="false">Energy</button><button aria-pressed="false">Key</button><button aria-pressed="false">Genre</button></div>
    <ul class="sn-graph-controls__legend" aria-label="Legend">…per mode, then Selected and Now playing rings…</ul>
  </div>
  <div class="sn-graph-controls__mini" role="img" aria-label="Minimap…"><svg>…<rect class="sn-graph-controls__mini-view"/></svg></div>
  <div class="sn-graph-controls__dock" role="group" aria-label="Graph controls">
    <div class="sn-graph-controls__group">
      <button class="sn-btn sn-btn--icon" aria-label="Zoom in">zoom-in</button>
      <div class="sn-graph-controls__zoom" aria-hidden="true">100%</div>
      <button … aria-label="Zoom out">zoom-out</button><button … aria-label="Fit graph to screen">maximize-2</button><button … aria-label="Reset view">rotate-ccw</button>
    </div>
    <div class="sn-graph-controls__group">
      <button … aria-label="Pause layout">pause</button>
      <div class="sn-graph-controls__layers-wrap"><button … aria-label="Link layers" aria-expanded="false" aria-controls="layers">layers</button>
        <div class="sn-graph-controls__layers" id="layers" hidden role="group">…sn-check per link type…</div></div>
    </div>
  </div>
  <p class="sn-sr" aria-live="polite"></p>
</div>
```

#### GraphStyles

```html
<aside class="sn-graph-styles__legend" aria-label="Graph legend">
  <h4>Colour by: genre</h4><ul class="sn-graph-styles__legend-grid"><li><span class="sn-graph-styles__swatch" style="--c: var(--chart-1)"></span>House</li>…</ul>
  <h4>Size</h4>… <h4>Rings</h4>… <h4>Links</h4><li><svg>line sample</svg>Played back to back in a set</li>…
</aside>
```
<!-- END GENERATED: components -->
