# LAY rules (generated)

| ID | Rule | Check | Test |
|---|---|---|---|
| LAY-001 | Page content shall be centred and capped at `content-max` (1400px). | lint | Page content container has `max-width: var(--content-max)` and `margin-inline: auto`. |
| LAY-002 | Only the `GraphExplorerPage` graph canvas shall be full-bleed content. | dom | On every page except GraphExplorerPage, no content element spans the full viewport width beyond `content-max`. |
| LAY-003 | Side gutters shall be `space-4` (16px) below `bp-tablet`. | lint | Page gutter padding below the tablet breakpoint resolves to `var(--space-4)`. |
| LAY-004 | Side gutters shall be `space-6` (24px) from `bp-tablet` up to below `bp-desktop`. | lint | Page gutter padding at the tablet breakpoint resolves to `var(--space-6)`. |
| LAY-005 | Side gutters shall be `space-8` (32px) from `bp-desktop`. | lint | Page gutter padding at the desktop breakpoint resolves to `var(--space-8)`. |
| LAY-006 | Running text and help shall not exceed `prose-max` (68ch). | lint | Prose and help containers have `max-width` no greater than `var(--prose-max)`. |
| LAY-007 | `AppHeader` shall span the full window width. | dom | AppHeader bounding width equals viewport width. |
| LAY-008 | `AppHeader` contents shall follow the page gutters. | dom | AppHeader inline padding equals the page gutter for the current breakpoint. |
| LAY-009 | Spacing shall be built on a 4px base unit. | lint | All margin, padding and gap values resolve to a `--space-*` token (multiples of 4px, or 2px for `space-0.5`). |
| LAY-010 | Spacing between siblings in flex and grid containers shall use `gap`, not margins. | lint | Flag margin-top/bottom/left/right used between siblings inside `display:flex\|grid` containers. |
| LAY-011 | Energy segment gaps and icon-to-badge spacing shall use `space-0.5` (2px). | lint | Those gaps resolve to `var(--space-0\.5)`. |
| LAY-012 | Chip block padding, icon-to-label spacing in dense rows, and label-to-field spacing shall use `space-1` (4px). | lint | Those spacings resolve to `var(--space-1)`. |
| LAY-013 | Spacing inside controls and between chips and buttons in a group shall use `space-2` (8px). | lint | Those spacings resolve to `var(--space-2)`. |
| LAY-014 | Spacing between fields in a row, table cell inline padding, and card inner gap shall use `space-3` (12px). | lint | Those spacings resolve to `var(--space-3)`. |
| LAY-015 | Compact card padding, gap between cards, and phone gutter shall use `space-4` (16px). | lint | Those spacings resolve to `var(--space-4)`. |
| LAY-016 | Default card padding shall use `space-5` (20px). | lint | `.sn-card` padding resolves to `var(--space-5)`. |
| LAY-017 | Spacing between sections inside a page, drawer padding, and tablet gutter shall use `space-6` (24px). | lint | Those spacings resolve to `var(--space-6)`. |
| LAY-018 | Spacing between page regions (rail and content) and the desktop gutter shall use `space-8` (32px). | lint | Those spacings resolve to `var(--space-8)`. |
| LAY-019 | Spacing above a `SectionHeading` shall use `space-10` (40px). | lint | SectionHeading margin-top/preceding gap resolves to `var(--space-10)`. |
| LAY-020 | Page top padding below the header on wide screens shall use `space-12` (48px). | lint | Page top padding at wide breakpoints resolves to `var(--space-12)`. |
| LAY-021 | `EmptyState` and `HomePage` breathing room shall use `space-16` (64px). | lint | EmptyState and HomePage outer padding resolves to `var(--space-16)`. |
| LAY-022 | The gap inside a group shall be smaller than the gap between groups. | visual | Inspect each group: inner gap token is numerically smaller than the inter-group gap token. |
| LAY-023 | Spacing values shall not be odd values such as 10px or 15px. | lint | Flag any px spacing value not equal to a `--space-*` token value. |
| LAY-024 | In comfortable density (default), rows shall be `row-comfortable` (40px). | dom | Without `data-density`, table row height is 40px. |
| LAY-025 | In comfortable density (default), controls shall be `control-md` (40px). | dom | Without `data-density`, default control height is 40px. |
| LAY-026 | In compact density (`data-density="compact"`), rows shall be `row-compact` (32px). | dom | With `data-density="compact"` table row height is 32px. |
| LAY-027 | In compact density, table text shall be 14px. | dom | With `data-density="compact"` computed table font-size is 14px. |
| LAY-028 | In compact density, controls in tables shall be `control-sm`. | dom | With `data-density="compact"` controls inside tables have height of `control-sm` (32px). |
| LAY-029 | Density shall change rows and table controls only, leaving page gutters, card padding and touch targets unchanged. | dom | Gutter, card padding and touch-target sizes are identical with and without `data-density="compact"`. |
| LAY-030 | On touch devices (`pointer: coarse`), row actions shall keep 44px targets even when rows are compact. | dom | Under `pointer: coarse` with compact density, row-action hit area is at least 44x44px. |
| LAY-031 | On phones, `LibraryPage` shall be one column with filters in a `SideSheet` opened by a "Filters" button. | visual | At width <480px LibraryPage has one column and the filters live in a SideSheet. |
| LAY-032 | On phones, `LibraryPage` rows shall become two-line `TrackCell` cards. | visual | At width <480px Library rows render as two-line TrackCell cards. |
| LAY-033 | `LibraryPage` shall show a Filters button below 1024px and keep the `FilterRail` (`rail-w` 248px) visible beside the table from 1024px. | dom | Filters button present at <1024px; FilterRail visible with width 248px at >=1024px. |
| LAY-034 | At 1440px and wider, `LibraryPage` shall show the Track detail `SideSheet` beside the rail and table. | visual | At >=1440px the Track detail SideSheet renders beside rail and table. |
| LAY-035 | `SetBuilderPage` shall stack controls above `EnergyWave` with a one-column running order below 768px. | visual | At <768px controls stack above EnergyWave and running order is one column. |
| LAY-036 | `SetBuilderPage` shall show controls in two columns at tablet width, and controls left with wave and running order right from desktop width. | visual | At 768-1099px controls are two columns; at >=1100px controls left, wave and running order right. |
| LAY-037 | `GraphExplorerPage` shall show the canvas full width with details in a bottom `SideSheet` below 768px. | visual | At <768px canvas is full width and details open in a bottom SideSheet. |
| LAY-038 | `GraphExplorerPage` shall use an overlay `SideSheet` at tablet width and a docked side panel from desktop width. | visual | At 768-1099px details are an overlay SideSheet; at >=1100px a docked side panel. |
| LAY-039 | At 1440px and wider, `GraphExplorerPage` shall show library list, canvas and panel together. | visual | At >=1440px library list, canvas and panel are all visible. |
| LAY-040 | `MonitoringPage` `FigureTile`s shall be 2 per row below 768px, 3 per row at tablet, 4 per row at desktop, 4 to 6 per row at wide, and 6 per row with 48px figures at wall width. | dom | Count FigureTiles per row at 400, 800, 1200, 1500 and 1920px against 2, 3, 4, 4-6, 6. |
| LAY-041 | Card grids shall be 1 column below 768px, 2 at tablet, 3 at desktop, and 4 at wide and wall widths. | dom | Count grid columns at 400, 800, 1200, 1500 and 1920px against 1, 2, 3, 4, 4. |
| LAY-042 | On phones, medium and large `Dialog`s shall be full-screen sheets, while small (confirmation) dialogs are centred. | visual | At <480px Dialog M/L fills the viewport; Dialog S is centred. |
| LAY-043 | At tablet width and above, `Dialog` shall be centred with a maximum width of 560px at tablet. | dom | At 768-1099px Dialog is centred with max-width 560px. |
| LAY-044 | Only the page shall scroll vertically; no page region may have its own vertical scroll except `SideSheet` body, `NavDrawer`, menus and select lists longer than the viewport, and `CommandPalette` results. | dom | No element outside the allowed list has `overflow-y: auto\|scroll` with scrollHeight > clientHeight. |
| LAY-045 | Wide content (`DataTable` in `.sn-tablebox`, wide charts, code and JSON) shall scroll horizontally inside its own box. | dom | Elements wider than their container are wrapped in a box with `overflow-x:auto`. |
| LAY-046 | The page itself shall not scroll horizontally. | dom | At 320px width `document.documentElement.scrollWidth <= clientWidth`. |
| LAY-047 | The graph canvas shall capture the mouse wheel only when it has focus or the pointer has been over it for 400 ms; otherwise the wheel shall scroll the page. | judgement | Wheel over an unfocused canvas within 400 ms scrolls the page; after focus or 400 ms it zooms. |
| LAY-048 | A caption hint "Hold Ctrl to zoom, or click the graph" shall be shown on the first wheel over an unfocused graph canvas. | judgement | First wheel event over an unfocused canvas displays the exact hint caption. |
| LAY-049 | `AppHeader` shall be sticky at all widths using `z-header`. | lint | `.sn-header` has `position: sticky` and `z-index: var(--z-header)`. |
| LAY-050 | `FilterRail` shall not be pinned below 1024px, and shall be sticky below the header (`z-sticky`) from 1024px. | dom | FilterRail is static at <1024px; at >=1024px it has `position: sticky` with `z-index: var(--z-sticky)`. |
| LAY-051 | `DataTable` header row shall be sticky (`th` is `position: sticky`) at all widths. | lint | `.sn-table th` has `position: sticky`. |
| LAY-052 | The set builder action bar shall not be pinned at any width. | dom | Set builder action bar computed `position` is not sticky or fixed. |
| LAY-053 | No element other than those listed in the pinned table shall be sticky or fixed, except by an explicit rule. | dom | Any element with `position: sticky\|fixed` is AppHeader, desktop FilterRail, DataTable th, or a layer listed in the design system. |
| LAY-054 | On phones nothing except the header and table headers shall be pinned: no floating action buttons, no sticky footers, no pinned now-playing bar over content. | dom | At <768px only AppHeader and `th` have `position: sticky\|fixed`. |
| LAY-055 | `html` shall set `scroll-padding-top: calc(var(--header-h) + var(--space-2))` so sticky elements never hide the focused element. | lint | `html` rule contains `scroll-padding-top: calc(var(--header-h) + var(--space-2))`. |
| LAY-056 | Below `bp-tablet`, `DataTable` shall by default keep the table, scroll horizontally inside `.sn-tablebox`, freeze the first (track) column, and show at most 4 default columns. | dom | At <768px table is inside `.sn-tablebox`, first column sticky, <=4 visible default columns. |
| LAY-057 | Where the job is picking rather than comparing (Library on phone, Target tracks), `DataTable` below `bp-tablet` shall render rows as two-line `TrackCell` list items with title and artist on line 1, "BPM · key · Energy" on line 2, and the row action at the right. | visual | Picking views at <768px render TrackCell rows with the two-line structure. |
| LAY-058 | Table text shall not be shrunk below `body-s` to fit columns. | lint | Table font-size is not below `var(--text-body-s)` at any width. |
| LAY-059 | The column a sort or filter is applied to shall not be hidden. | dom | At phone width the sorted or filtered column remains visible. |
| LAY-060 | `control-sm` (32px) shall be used for dense toolbars and table rows. | lint | Dense toolbar and table-row controls use `var(--control-sm)`. |
| LAY-061 | `control-md` (40px) shall be the default control height. | lint | Default controls use `var(--control-md)`. |
| LAY-062 | `control-lg` (48px) shall be used for empty-state actions, booth, and touch-first pages. | lint | Those controls use `var(--control-lg)`. |
| LAY-063 | Buttons, inputs, selects and `SegmentedControl` in one row shall share one height. | dom | All controls in a row have identical offsetHeight. |
| LAY-064 | `header-h` shall be 56px. | lint | `--header-h` equals 56px. |
| LAY-065 | Two-line rows (running order, list items) shall be `row-two-line` (56px). | lint | Two-line rows use `var(--row-two-line)`. |
| LAY-066 | Cards in a row shall stretch to equal height with `align-items: stretch`. | dom | Cards sharing a row have equal offsetHeight. |
| LAY-067 | Card footers (`.sn-card__foot`) shall align at the bottom using `margin-top: auto`. | lint | `.sn-card__foot` has `margin-top: auto`. |
| LAY-068 | Label and value pairs in a row of mixed controls shall align on the baseline (`align-items: baseline`), and icon plus text inside a control shall use `center`. | lint | Label/value rows use `align-items: baseline`; control icon+text uses `align-items: center`. |
| LAY-069 | `FigureTile` labels shall align on the top line and values shall align on the baseline across the row. | visual | FigureTile labels share a top edge; values share a baseline across the row. |
| LAY-070 | Every target shall be at least 24 x 24 CSS px, or have 24px of clear spacing around it. | dom | Every interactive element has a box >=24x24px or no other target within 24px. |
| LAY-071 | On touch (`pointer: coarse`) every target shall be at least `touch-min` 44 x 44px, padding the hit area where the visual is smaller. | dom | Under `pointer: coarse` interactive hit area >=44x44px. |
| LAY-072 | Components with custom controls shall raise their touch hit area to `touch-min` in the way `00-core.css` does for `.sn-btn` and `.sn-chip`. | lint | Custom control CSS contains a `@media (pointer: coarse)` rule setting min-height/min-width to `var(--touch-min)`. |
| LAY-073 | `AppHeader` shall be 56px high with a 40px menu button (44px on touch). | dom | Header height 56px; menu button 40px, or 44px under `pointer: coarse`. |
| LAY-074 | `NavDrawer` shall be `drawer-w` 300px wide (max 86vw on phones) with 44px rows and 20px icons. | dom | Drawer width 300px (<=86vw at phone), row height 44px, icon 20px. |
| LAY-075 | `Tabs` shall be 44px high with `body-strong` labels. | dom | Tabs height 44px; label font token is body-strong. |
| LAY-076 | `SegmentedControl` shall have a 36px track and 30px segments (44px hit area on touch). | dom | Track 36px, segment 30px; under `pointer: coarse` hit area 44px. |
| LAY-077 | `Breadcrumbs` shall use `body-s` with a 32px target height. | dom | Breadcrumbs font token body-s; target height 32px. |
| LAY-078 | Fixed widths shall be allowed only for `rail-w` (248px) and `drawer-w` (300px). | lint | Fixed width declarations other than `--rail-w`, `--drawer-w`, SideSheet, Dialog and numeric columns are flagged. |
| LAY-079 | `SideSheet` shall be 420px wide (480px on wide screens), max 100vw on phones. | dom | SideSheet width 420px (480px at >=1440px) and max-width 100vw. |
| LAY-080 | `Dialog` shall be 400px (small), 560px (medium) or 800px (large) wide, each with `max-width: calc(100vw - 32px)`. | lint | Dialog size classes use those widths and include `max-width: calc(100vw - 32px)`. |
| LAY-081 | Numeric table columns shall be sized in `ch` (`BPM` 7ch, `Key` 6ch, `Energy` 12ch, durations 7ch). | lint | Column widths for BPM/Key/Energy/duration equal 7ch/6ch/12ch/7ch. |
| LAY-082 | All widths other than the listed fixed widths shall be fluid. | lint | No fixed px `width` outside the allowed fixed-width list. |
| LAY-083 | Cards shall rest on a `line` border and `shadow-1`. | lint | `.sn-card` uses `border: 1px solid var(--line)` and `box-shadow: var(--shadow-1)`. |
| LAY-084 | `shadow-2` shall be used only for popovers, menus, tooltips and the header once scrolled. | lint | `var(--shadow-2)` appears only on those selectors. |
| LAY-085 | `shadow-3` shall be used only for the drawer, side sheet on phones, and dialogs. | lint | `var(--shadow-3)` appears only on those selectors. |
| LAY-086 | In the booth theme, shadows shall be replaced with outlines: `shadow-2` as a 1px line and `shadow-3` as a 2px white line. | lint | Booth theme tokens define `--shadow-2` as 1px line and `--shadow-3` as 2px white line. |
| LAY-087 | A coloured left border shall not be used as an accent on cards or messages. | lint | Flag `border-left` with a non-neutral colour on card and message selectors. |
| LAY-088 | `FilterChip`, `CategoryTag`, `KeyBadge` and energy segments shall use `radius-chip` (4px). | lint | Those selectors use `var(--radius-chip)`. |
| LAY-089 | `Button`, inputs, `SelectField`, `SegmentedControl`, menu items, `Tooltip` and `.sn-tablebox` shall use `radius-control` (8px). | lint | Those selectors use `var(--radius-control)`. |
| LAY-090 | `Card`, `SetCard`, `LauncherCard`, `FigureTile` and `Popover` shall use `radius-card` (14px). | lint | Those selectors use `var(--radius-card)`. |
| LAY-091 | `NavDrawer` inner edge, `SideSheet`, `Dialog` and `MediaViewer` shall use `radius-sheet` (18px). | lint | Those selectors use `var(--radius-sheet)`. |
| LAY-092 | `StatusPill`, `Switch`, `ProgressBar` and service avatars shall use `radius-pill` (999px). | lint | Those selectors use `var(--radius-pill)`. |
| LAY-093 | A nested element's inner radius shall equal the outer radius minus the padding and shall not exceed the outer radius. | visual | For nested rounded boxes, inner radius = outer radius - padding and <= outer radius. |
| LAY-094 | While a `Dialog`, `ConfirmDialog` or `SideSheet` is open nothing outside it except a toast shall be drawn over it: the scrim shall cover the page, the `AppHeader`, a `ConnectionStatus` banner and every fixed bar. | dom | Open each dialog and sheet at 1440 x 900 and 390 x 844: `document.elementsFromPoint` at the centre of each footer button returns that button first. |
| LAY-095 | No fixed or sticky element outside a dialog or side sheet shall take a layer above `z-dialog` other than the toast region; a popover, menu or tooltip opened from the page shall close when a dialog or sheet opens. | lint | No rule outside the dialog, popover, tooltip and toast components uses `z-popover`, `z-toast` or `z-tooltip`; open a menu, then a dialog: the menu is gone. |
