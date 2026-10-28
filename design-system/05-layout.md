# Layout

Pages are built from a small set of regions on a 4px grid. These rules decide width, spacing, scrolling, what sticks and how things line up.

## Page width and gutters

- Content is centred and capped at `content-max` (1400px). The graph canvas in `GraphExplorerPage` is the only full-bleed content.
- Side gutters: 16px (`space-4`) below `bp-tablet`, 24px (`space-6`) from `bp-tablet`, 32px (`space-8`) from `bp-desktop`.
- Running text and help never exceed `prose-max` (68ch), even inside wide pages.
- `AppHeader` spans the full window; its contents follow the same gutters.

## Spacing scale

4px base. Use `gap` on flex and grid containers, not margins between siblings.

| Token | px | Use |
|---|---|---|
| `space-0.5` | 2 | Energy segment gaps, icon to badge |
| `space-1` | 4 | Chip block padding, icon to label in dense rows, label to field |
| `space-2` | 8 | Inside controls, between chips and buttons in a group |
| `space-3` | 12 | Between fields in a row, table cell inline padding, card inner gap |
| `space-4` | 16 | Compact card padding, gap between cards, phone gutter |
| `space-5` | 20 | Default card padding |
| `space-6` | 24 | Between sections inside a page, drawer padding, tablet gutter |
| `space-8` | 32 | Between page regions (rail and content), desktop gutter |
| `space-10` | 40 | Above a `SectionHeading` |
| `space-12` | 48 | Page top padding below the header on wide screens |
| `space-16` | 64 | `EmptyState` and `HomePage` breathing room |

- Related things sit closer than unrelated things: the gap inside a group is always smaller than the gap between groups.
- Never use odd values (10px, 15px). If nothing fits, the design is wrong, not the scale.

### Text inset (no text touching an edge)

Any box that draws an edge (a border, a fill different from what is behind it, or an inset ring) keeps its text off that edge:

- Inline (left/right): at least `space-2` (8px) for chips, tags, badges, counts and key caps; `space-3` for table cells, menu items and inputs; card and panel padding per the table above. 4–7px counts as tight; under `space-1` (4px) is a defect.
- Block (top/bottom): at least `space-0.5` (2px) of clear space above and below the glyphs. Table cells pad `space-1` top and bottom so wrapped text never sits on the row rule.
- Small labelled objects (tags, pills, counts, key caps, badges) never wrap; a group of them wraps instead.
- On a phone no text runs closer than the 16px gutter to the screen edge, unless it is inside a box that scrolls sideways.
- A control that cannot fit its segments wraps them (`SegmentedControl --block`) rather than letting text spill past its track.
- A card whose only content is a table, or a lone `EmptyState`, `LoadingState` or `ErrorState`, is flush (no card padding): the cells or the panel carry the inset. Don't add an inner wrapper with padding to compensate.

`tools/padding-audit.js` measures this in every preview (dark, light, booth; 1440 and 390).

## Density

- Comfortable (default): rows `row-comfortable` 40px, controls `control-md` 40px.
- Compact (a saved per-person option in `PreferencesPanel`, `data-density="compact"`): rows `row-compact` 32px, table text 14px, controls in tables `control-sm`.
- Density changes rows and table controls only. Page gutters, card padding and touch targets stay the same.
- Touch devices (`pointer: coarse`) ignore compact for hit areas: rows may be 32px visually, but row actions keep 44px targets.

## Breakpoints and reflow

| Pattern | < 480 phone | 480–767 | 768–1099 tablet | 1100–1439 desktop | ≥ 1440 wide | ≥ 1920 wall |
|---|---|---|---|---|---|---|
| `LibraryPage` | One column; filters in `SideSheet` via "Filters" button; rows become two-line `TrackCell` cards | same | Filters button below 1024px; from 1024px the `FilterRail` stays visible beside the table | `FilterRail` (`rail-w` 248px) + table | Rail + table + Track detail `SideSheet` beside | as wide, booth theme |
| `SetBuilderPage` | Controls stacked above `EnergyWave`; running order one column | same | Controls in two columns | Controls left, wave + running order right | same, saved sets visible | booth |
| `GraphExplorerPage` | Canvas full width; details in bottom `SideSheet` | same | Canvas + overlay `SideSheet` | Canvas + docked side panel | Library list + canvas + panel | booth |
| `MonitoringPage` | `FigureTile` 2 per row, charts stacked | 2 per row | 3 per row | 4 per row | 4–6 per row | 6 per row, 48px figures |
| Cards grid | 1 column | 1 | 2 | 3 | 4 | 4 |
| `Dialog` | M and L: full-screen sheet; S (confirmations): centred | Centred | Centred, max 560px | Centred | Centred | Centred |

## Scrolling

- Only the page scrolls vertically. No region of a page has its own vertical scroll, with these exceptions: `SideSheet` body, `NavDrawer`, menus and select lists longer than the viewport, `CommandPalette` results.
- Wide content scrolls horizontally inside its own box: `DataTable` (`.sn-tablebox`), charts wider than the viewport, code and JSON. The page itself never scrolls horizontally (WCAG 1.4.10).
- The graph canvas captures the mouse wheel only when it has focus or the pointer has been over it for 400 ms; otherwise wheel scrolls the page. Show a caption hint on first wheel over an unfocused canvas: "Hold Ctrl to zoom, or click the graph". Today `GraphVisualization.tsx` captures every wheel event; change it.
- Keep the scroll position per route when moving back and forward (see 08-motion).

## Pinned and sticky elements

| Element | Phone | Tablet | Desktop and up |
|---|---|---|---|
| `AppHeader` | sticky | sticky | sticky (`z-header`) |
| `FilterRail` | not pinned (it is a `SideSheet`) | not pinned below 1024px; sticky rail from 1024px | sticky below the header (`z-sticky`) |
| `DataTable` header row | sticky inside the page | sticky | sticky (`th` is `position: sticky`) |
| Set builder action bar | not pinned | not pinned | not pinned |
| Anything else | never | never | only by an explicit rule here |

- On phones nothing except the header and table headers is pinned: no floating action buttons, no sticky footers, no pinned now-playing bar over content.
- Sticky elements must never hide the focused element (WCAG 2.4.11): set `scroll-padding-top: calc(var(--header-h) + var(--space-2))` on `html`.

## Long tables on small screens

Decision for `DataTable` below `bp-tablet`:
1. Default: keep the table, scroll horizontally inside `.sn-tablebox`, freeze the first column (track) and show at most 4 default columns (see 09-cognitive-load).
2. When the job is picking, not comparing (Library on phone, Target tracks), render rows as two-line `TrackCell` list items: title + artist on line 1, "124 BPM · 8A · Energy 7" on line 2, row action at the right.
3. Never shrink text below `body-s` to fit columns. Never hide the column a sort or filter is applied to.

## Component heights and row alignment

- Control heights: `control-sm` 32px (dense toolbars, table rows), `control-md` 40px (default), `control-lg` 48px (empty-state actions, booth, touch-first pages). Buttons, inputs, selects and `SegmentedControl` in one row share one height.
- `header-h` is 56px. Two-line rows (running order, list items) are `row-two-line` 56px.
- Cards in a row stretch to equal height (`align-items: stretch`); their footers (`.sn-card__foot`) align at the bottom with `margin-top: auto`.
- Text in a row of mixed controls aligns on the baseline (`align-items: baseline` for label + value pairs; `center` for icon + text inside a control).
- `FigureTile` labels align on the top line; values align on the baseline across the row.

## Control sizes and touch targets

- WCAG 2.5.8 minimum: every target is at least 24 × 24 CSS px, or has 24px of clear spacing around it.
- On touch (`pointer: coarse`) our minimum is `touch-min` 44 × 44px. Visuals can stay smaller; pad the hit area. `00-core.css` raises `.sn-btn` and `.sn-chip` automatically; components with custom controls must do the same.
- Small repeated controls (slot lock, move up/down, remove; energy chips; table row actions) follow 06-interaction-accessibility.

## Navigation element sizes

| Element | Size |
|---|---|
| `AppHeader` | 56px high; menu button 40px (44px on touch) |
| `NavDrawer` | `drawer-w` 300px, max 86vw on phones; rows 44px, icon 20px |
| `Tabs` | 44px high; tab label `body-strong` |
| `SegmentedControl` | 36px track, 30px segments (44px hit on touch) |
| `Breadcrumbs` | `body-s`, 32px target height |

## Fixed widths

Allowed only for:
- `rail-w` 248px (filter rail), `drawer-w` 300px (navigation drawer);
- `SideSheet` 420px (480px on wide), max 100vw on phones;
- `Dialog` small 400px, medium 560px, large 800px, each with `max-width: calc(100vw - 32px)`;
- numeric table columns sized in `ch` (`BPM` 7ch, `Key` 6ch, `Energy` 12ch, durations 7ch).
Everything else is fluid.

## Borders, elevation and shadows

- A border separates; a shadow lifts. Cards rest on `line` + `shadow-1`. Only floating layers get more: `shadow-2` for popovers, menus, tooltips and the header once scrolled; `shadow-3` for drawer, side sheet on phones and dialogs.
- Booth replaces shadows with outlines (`shadow-2` is a 1px line, `shadow-3` a 2px white line) because shadows vanish on black.
- Never use a coloured left border as an accent on cards or messages.

## Corner radius

The bigger and more object-like it is, the rounder.

| Token | Value | Used by |
|---|---|---|
| `radius-chip` | 4px | `FilterChip`, `CategoryTag`, `KeyBadge`, energy segments |
| `radius-control` | 8px | `Button`, inputs, `SelectField`, `SegmentedControl`, menu items, `Tooltip`, `.sn-tablebox` |
| `radius-card` | 14px | `Card`, `SetCard`, `LauncherCard`, `FigureTile`, `Popover` |
| `radius-sheet` | 18px | `NavDrawer` inner edge, `SideSheet`, `Dialog`, `MediaViewer` |
| `radius-pill` | 999px | `StatusPill`, `Switch`, `ProgressBar`, service avatars |

Nested corners: inner radius = outer radius − padding, never larger than the outer.
