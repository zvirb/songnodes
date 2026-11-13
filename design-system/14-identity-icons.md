# Identity and icons

SongNodes has no logo. Its identity is the wordmark, the lavender brand colour and the consistency of everything else. Icons are Lucide, one meaning each.

## Wordmark

- Set the word "SongNodes" in Sora 800 (`--font-display`, `font-weight: 800`), letter-spacing −0.01em, as live text. Never an image, never outlined, never in a box.
- Colour: `brand` on every theme (lavender #9b85cb on dark, #6a52a6 on light, #c9b9f0 on booth). On a brand fill use `on-brand`. No other colours, no gradients, no shadow.
- Sizes: 1.125rem in `AppHeader`, `display-xl` on `HomePage` and the cover. Minimum 0.875rem.
- The music library's product name is "Music library" in the same style, sentence case. Write "the music library" in prose. The Naarm Set Builder artifact may add a page title "Set builder" but its wordmark is "Music library".
- Never draw a mark: no node-and-edge glyph, no note, no disc, no monogram outside the favicon tile. Retire `frontend/public/favicon.svg` (gradient tile with drawn nodes and a note).

## Document titles

Pattern: `<Page title> · <Module> · SongNodes` (middle dot U+00B7, spaces either side).

| Page | `<title>` |
|---|---|
| Home | `SongNodes` |
| Set builder, one set | `Peak time Friday · Set builder · SongNodes` |
| Track detail | `Bicep – Glue · Library · SongNodes` |
| Graph | `Graph · SongNodes` (page title equals module: drop the repeat) |
| Errors | `Page not found · SongNodes` |
| Music library | `Crate · Music library` |

Update the title on every route change (react-router `handle` + an effect in `Shell`). Prefix unsaved work with "• " ("• Peak time Friday · Set builder · SongNodes"). Replace "SongNodes DJ - Interactive Mixing Assistant" in `frontend/index.html`.

## Favicon and home-screen icons

One favicon for every page and module; module-coloured favicons are not used (tabs would change colour as people navigate, and colour alone would carry meaning).

| File | Size | Content |
|---|---|---|
| `favicon.svg` | vector | Rounded tile (radius 22% of size) in `brand` dark value #9b85cb, "SN" in Sora 800 in `on-brand` #160f26, centred |
| `favfavicon-16.png`, `favfavicon-32.png` | 16, 32 | Same, rendered; at 16px use "S" only if "SN" fails legibility |
| `apple-touch-icon.png` | 180 | Same, full-bleed square (iOS rounds it) |
| `favicon-512.png`, `icon-192.png` | 512, 192 | Same; also a `maskable` variant with 20% safe padding |

Status: to be produced from `source/` by a small script (render the SVG with the self-hosted Sora file); until then link the SVG only. Link them in `<head>` and in `manifest.webmanifest` (`theme_color` #222222, `background_color` #222222, `name` "SongNodes").

## Icon set

- Lucide, ISC licence. The design system ships v1.53 SVGs in `assets/Icons/` (109 icons) and inlines them in `bundle.js` (`SongNodes.icon(name)`). SongNodes uses `lucide-react` pinned to an exact version in `package.json` (no caret); update both together.
- Self-hosted only; never load icons from a CDN.
- Stroke 2px (`.sn-icon`, `stroke-width: 2`), round caps and joins, no fill. Colour inherits `currentColor`.
- Sizes: 16px in dense tables and chips, 18px default (buttons, rows), 20px in `AppHeader` and drawer rows, 24px (`.sn-icon--lg`) in empty states and launcher cards. Do not scale the stroke.
- Add an icon only when its meaning is not already in the table below. Adding one: copy the SVG into `assets/Icons/`, rebuild the bundle, add a row here, bump minor version.

## Icon meaning table

One icon, one meaning. If the meaning is not in this table, use text.

| Icon | Meaning | Where |
|---|---|---|
| `activity` | Pipeline module | Drawer, launcher, links to Pipeline |
| `archive` | Archive | Target tracks, saved sets |
| `archive-restore` | Restore from archive | Archived lists |
| `arrow-down` | Move down one slot | `SetSlot`, ordered lists |
| `arrow-up` | Move up one slot | `SetSlot`, ordered lists |
| `arrow-up-down` | Sort options | Sort menu on phones |
| `audio-waveform` | Audio analysis; analysis pending (card flag) | `WaveformStrip` header, analysis jobs |
| `bell` | Alert settings | Settings, monitoring alerts |
| `bug` | Report a problem / diagnostics | Help menu, dev diagnostics |
| `calendar` | Pick a date | `DateField` |
| `calendar-range` | Pick a period | `PeriodNav` picker |
| `camera` | Take a photo | `PhotoCapture` |
| `chart-column` | Statistics | Stats views, "Show chart" |
| `chart-line` | Trend over time | Trend toggles, energy curve view |
| `check` | Done / chosen | `Checklist`, menu selection, `CopyButton` success |
| `chevron-down` | Expand | `Disclosure`, `ShowMore`, select menus |
| `chevron-left` | Previous | `PeriodNav`, `MediaViewer` |
| `chevron-right` | Next / open detail | `PeriodNav`, `MediaViewer`, drill-in rows |
| `chevron-up` | Collapse | Open `Disclosure` |
| `circle-alert` | Error | `InlineMessage` bad, `ErrorState`, `Toast` bad |
| `circle-check` | Success; a done suggestion action | `Toast` ok, `Banner` ok |
| `circle-dot` | Set as now playing | Context menu, Play mode |
| `circle-help` | Help | Help menu; fallback for unknown icon names |
| `circle-x` | Clear the field | `SearchField`, `ChipInput` |
| `clipboard-check` | Review queue; check a service match (card flag) | Data-quality review |
| `clock` | Time / last heard | Meta lines, column hints |
| `cloud-off` | Server unreachable, showing cached data | `ConnectionStatus` |
| `copy` | Copy; twice in this set (card flag) | `CopyButton` |
| `crosshair` | Reset view | Graph canvas |
| `database` | Database | `ServiceStatus` |
| `disc-3` | Track | Track detail, track rows without artwork |
| `download` | Download a file | Export actions |
| `ellipsis` | More actions (page, header) | `OverflowMenu` in `AppHeader`, `PageHeader` |
| `ellipsis-vertical` | More actions (row, card) | `DataTable` rows, card footers |
| `external-link` | Opens another site; as a go icon's badge, opens that SongNodes page in a new tab (1.6.0) | Beatport, TIDAL, Grafana links; `SongNodes.goIcon` |
| `eye` | Show | `SecretField`, graph layers |
| `eye-off` | Hide | `SecretField`, graph layers |
| `file-input` | Import a file | `FileDrop`, import actions |
| `file-json` | JSON file | Export menu item |
| `file-text` | Text or CSV file | Export menu item, tracklist text |
| `flag` | Flagged for a check; "Check energy" card flag | Flagged rows, "Needs an energy check" |
| `focus` | Isolate neighbourhood | Graph |
| `funnel` | Filters | "Filters" button opening `FilterRail` |
| `gauge` | Energy; energy jump (card flag) | Energy controls and filter labels |
| `git-merge` | Merge duplicates | Artist attribution fixer |
| `grip-vertical` | Drag to reorder | `SetSlot`, sortable lists |
| `hash` | External ID | ISRC, Spotify ID rows |
| `headphones` | Preview listen | Track preview button |
| `history` | Run history | `LogPage`, recent |
| `house` | Home | Drawer first row |
| `image` | Image | `MediaViewer`, artwork placeholders |
| `info` | Information; the `InfoTip` button, "about this" (1.6.0) | `Banner` info, `InfoTip` |
| `keyboard` | Keyboard shortcuts | More menu, `ShortcutSheet` |
| `layers` | Graph layers | `GraphControls` |
| `layout-grid` | Grid view | View switch |
| `library-big` | Library module | Drawer, launcher, links to Library |
| `link` | Copy link to this view | Overflow menus |
| `list` | List view | View switch |
| `list-filter` | Saved filter presets | `FilterRail` |
| `list-music` | Set builder module | Drawer, launcher, links to Set builder |
| `locate-fixed` | Find in graph | Graph, track rows |
| `lock` | Locked slot; locked off target (card flag) | `SetSlot` |
| `lock-open` | Unlocked slot | `SetSlot` |
| `log-out` | Disconnect a service | Settings connections |
| `map-pin` | Waypoint | Pathfinder |
| `maximize-2` | Full screen | Graph, `MediaViewer` |
| `menu` | Open navigation | `AppHeader` hamburger |
| `minimize-2` | Exit full screen | Graph, `MediaViewer` |
| `minus` | Decrease | `NumberField` stepper, zoom slider |
| `monitor` | System theme | `PreferencesPanel` |
| `moon` | Dark theme | `PreferencesPanel` |
| `music` | Genre / pillar | Filter group labels |
| `pause` | Pause | Graph simulation, preview |
| `pencil` | Edit | Rows, detail pages |
| `piano` | Key & mood module; no key and key clash (card flags) | Drawer, launcher, links to Key & mood |
| `play` | Play / resume | Preview, graph simulation |
| `plug` | Services module; not on a service (card flag) | Drawer, launcher, links to Services |
| `plus` | Add | Add to set, new item, `NumberField` stepper |
| `printer` | Print | "Print set" (SongNodes `PrintSheet` only) |
| `radio-tower` | Sources module | Drawer, launcher, links to Sources |
| `redo-2` | Redo | Set builder |
| `refresh-cw` | Refresh / try again | Data refresh, `ErrorState` retry |
| `rotate-ccw` | Reset to defaults | Controls, graph simulation restart |
| `route` | Pathfinder module | Drawer, launcher, links to Pathfinder |
| `save` | Save | "Save set" |
| `scan-search` | Find similar tracks | Track rows, context menu |
| `search` | Search | `SearchField`, `AppHeader` |
| `server` | Service or API instance | `ServiceStatus` |
| `settings` | Settings | More menu, `SettingsPage` |
| `share-2` | Graph module | Drawer, launcher, links to Graph |
| `shuffle` | Try another take | Set builder |
| `skip-forward` | Skip | Review queue |
| `sliders-horizontal` | Graph controls | `GraphControls` button |
| `star` | Priority / favourite | Target tracks priority |
| `sun` | Light theme | `PreferencesPanel` |
| `table-2` | Table view | View switch, "Show as table" |
| `tag` | Tags | `CategoryTag` filters, tag editing |
| `timer` | Set length; no BPM and BPM jump (card flags) | Set controls |
| `trash-2` | Delete | Overflow menus (always confirmed) |
| `triangle-alert` | Warning | `InlineMessage` warn, `Banner` warn |
| `undo-2` | Undo | Set builder, toasts |
| `upload` | Upload | `FileDrop`, `PhotoCapture` |
| `user` | Artist | Attribution, artist rows |
| `wand-sparkles` | Build set automatically | "Build set" |
| `wifi` | Live updates connected | `ConnectionStatus` |
| `wifi-off` | Device offline | `ConnectionStatus` |
| `x` | Close / remove | Dialogs, sheets, chips, remove slot |
| `zoom-in` | Zoom in | Graph |
| `zoom-out` | Zoom out | Graph |

### Banned substitutions

No emoji anywhere in UI text, buttons, tabs, placeholders, empty states, toasts or console-visible copy. Replace as follows (examples from `DJInterface.tsx`, `SettingsPanel.tsx`, `TargetTracksManager.tsx`):

| Was | Use |
|---|---|
| 🔧 Filters | `sliders-horizontal` "Graph controls" |
| 🔍 in placeholders and empty states | `search` icon outside the input; empty states use `EmptyState` with `search` |
| ▶️ PLAY / 📋 PLAN | `SegmentedControl` "Play" / "Plan", text only |
| 🎭 Key & Mood, 🗺️ Pathfinder | Tab text only "Key & mood", "Pathfinder" |
| 🎧 Spotify, 🎯 Targets | Tab text only "Spotify", "Target tracks" |
| 🎨 Fix Artist Attribution | `user` "Fix artist attribution" |
| 📝 Import Tracklist | `file-input` "Import tracklist" |
| 💾 / 📤 / 📥 / 🗑 / ✏ | `save` / `download` / `file-input` / `trash-2` / `pencil` |
| ✅ ❌ ⚠ in messages | `circle-check` / `circle-alert` / `triangle-alert` |
| ⚡ energy, 📊 stats, 🔄 refresh, ⚙ settings | `gauge`, `chart-column`, `refresh-cw`, `settings` |
| 🎉 success flourish | Nothing |

## Go icons (1.6.0)

Imported from BeanAlliance v4.20–v4.20.2 (Markus, 1 Nov 2026), drawn from Lucide here instead of Phosphor.

- A **go icon** is the target module's own icon (the module table above) drawn at 84% toward the top left, with a half-size `external-link` badge in its lower right corner. Only the badge's own corner is cut from the module icon, so both read. It means **opens that page in a new tab**.
- One helper makes it from any module: `SongNodes.goIcon("harmony")`. No separate files; a new module gets its go icon for free.
- **Where:** it leads every source link to another page (`sn-link--src`, `SongNodes.sourceLink`), before the words: `[go icon] Add keys in Key & mood`. A source on the same page has no icon. A source outside SongNodes links to the SongNodes page where that data comes in, so it takes that page's go icon. It is not used on ordinary navigation links, which open in the same tab.
- **Colour:** the target module's colour (`--m` through `sn-m-<key>`, DR-005), glyph and badge alike; the link's words are the same colour (DR-009). Every module colour holds 3:1 as an icon on every ground in every theme.
- Size follows the text (18px default); the badge's stroke is thickened so it does not look thinner than the glyph.
- Decorative: `aria-hidden="true"`; the link text says where it goes and "(opens in a new tab)" is in `sn-sr` text.

## Icon-only controls and accessible names

- Decorative icons (next to a label): `aria-hidden="true"` and `focusable="false"` (the `SongNodes.icon()` default).
- Meaningful standalone icons (not in a button): `SongNodes.icon(name, { label })` gives `role="img"` and `aria-label`.
- Icon-only buttons: the name goes on the `button` (`aria-label="Remove Overmono – So U Kno from set"`), the SVG stays hidden. Add a `Tooltip` with the same words. Two exceptions (1.6.0): the `InfoTip` button has no separate Tooltip or `title`, because its own tip carries the words; a dismissed warning's icon (`.sn-dismissed`) carries its name in `aria-label` and `title` ("Show warning: TIDAL disconnected").
- Never rely on `title` alone for a name.
- Toggle buttons keep one name and change `aria-pressed`; do not swap the label between "Show" and "Hide".

## Text glyphs versus icons

Status and verdicts use text glyphs from `SongNodes.GLYPH` (they sit in the text flow, scale with type and print in greyscale). Actions and objects use Lucide.

| Meaning | Glyph | Where |
|---|---|---|
| ok / perfect | ● | `StatusPill`, `CompatibilityBadge` |
| fair / compatible | ◐ | same |
| warn | ▲ | `StatusPill` |
| possible | ○ | `CompatibilityBadge` |
| bad / clash | ✕ | both; `.sn-field__error` |
| info | i | `StatusPill` info |
| running | ↻ | `StatusPill` running |
| idle | – | `StatusPill` idle |
| unknown | ? | "key ?", "BPM ?" |
| sort | ↑ ↓ | `DataTable` headers |
| external | ↗ | `.sn-link--ext` |
| chip on | ✓ | `FilterChip` pressed |

Never mix within one control: a pill carries a glyph, not a Lucide icon; a button carries a Lucide icon, not a glyph. Do not use ✓ ✗ ~ "✓✓" (the current `COMPATIBILITY_PROPS` in `utils/harmonicUtils.ts`).
