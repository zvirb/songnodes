# Navigation

People reach every page in two taps or fewer and always know where they are. Site navigation lives in one place, the left drawer (`NavDrawer`), opened from the hamburger in `AppHeader`. Nothing else navigates between modules: no top nav bar, no site-level tabs, no sidebars of module links.

## App header

`AppHeader` is the only fixed bar. Height `--header-h` (56px), `surface-1` fill, 1px `line` bottom edge, `z-header`. Controls sit in this order, left to right, on every page in both products:

| # | Control | Component / class | Rule |
|---|---|---|---|
| 1 | Hamburger | `Button` `.sn-btn--quiet .sn-btn--icon`, icon `menu` | `aria-label="Open navigation"`, `aria-expanded`, `aria-controls` the drawer. Always first. |
| 2 | Wordmark | text "SongNodes" or "Music library" (see Identity) | A link to `HomePage`. `brand` colour. Never an image. |
| 3 | Page title | `body-strong`, `fg` | The bold half of the page title only ("Peak time Friday"), truncated with an ellipsis. Hidden below `bp-tablet` when `PageHeader` is on screen. |
| 4 | Freshness | `FreshnessStamp` | "Data from 24 Oct 2026, 06:00 AEDT". Only on pages that show stored data. |
| 5 | Connection | `ConnectionStatus` | Shown only when not normal (offline, reconnecting, live updates paused). Silent when healthy. |
| 6 | Search | `Button` icon `search` + `CommandPalette` | Opens the palette. Shortcut Ctrl/Cmd+K and `/`. |
| 7 | More | `OverflowMenu` icon `ellipsis` | Theme, text size, density (`PreferencesPanel`), keyboard shortcuts (`ShortcutSheet`), help. |

Rules:
- Items 1–3 align left; 4–7 align right. Gap `space-2`. Hit areas `touch-min` on coarse pointers.
- Do not add page actions to `AppHeader`. Page actions belong to `PageHeader`.
- The Play/Plan `SegmentedControl` of the graph workspace is a page control: it lives in `PageHeader` of `GraphExplorerPage`, not in `AppHeader`.
- Booth theme keeps the same order; the page title stays visible because the booth screen has no `PageHeader` scroll.

## Navigation drawer

`NavDrawer` slides in from the left over the page (overlay, `drawer-w` 300px, max 86vw, `surface-1`, `shadow-3`, scrim `overlay`, `z-drawer`).

- Row order is fixed: **Home** first, then the eight modules in `SongNodes.modules` order (Graph, Library, Set builder, Pathfinder, Key & mood, Sources, Pipeline, Services). Group titles in `title-s` only if a product needs sub-pages.
- Each row: module icon in `--m` (`.sn-m-<key> .sn-m-icon`), label in `fg`, optional count in `data-s`. Height `row-two-line` when a one-line summary is shown, else `control-lg`.
- The current page has `aria-current="page"`, a `brand-soft` fill and a 3px inset `brand` bar. Do not mark the current page with the module colour.
- Focus moves to the first row on open; Escape and the scrim close it; focus returns to the hamburger. Trap focus while open (it is modal).
- The music library (Naarm) uses the same drawer with its own rows: Home, Library, Set builder, Sources, Weekly run.

## Route to home

- The wordmark always links to `HomePage` (the launcher). Clicking it on Home does nothing harmful (no reload).
- Home is the first drawer row. There is no separate "Back to home" button anywhere.
- `Breadcrumbs` appear only below module level (Library › Track detail › Bicep – Glue). Never start breadcrumbs with "Home"; the wordmark already does that.

## Page header

`PageHeader` opens every page except `HomePage` and the canvas of `GraphExplorerPage` (which uses a compact one-line variant).

| Order | Part | Rule |
|---|---|---|
| 1 | Module band | Full-width `--m-bg` band (`.sn-m-<key>`), module icon + module label in `--m-muted` as an eyebrow. |
| 2 | Thin–bold title | `.sn-title.title-l`: `<span class="sn-lead">Set builder:</span> Peak time Friday`. One `h1` per page. |
| 3 | Description | One line `body`, `--m-muted`, ≤ `prose-max`. Says what the page holds, not how to use it. |
| 4 | Primary action | One `Button --primary` at most per view ("Build set"). Right-aligned on desktop, full width below `bp-phone`. |
| 5 | Secondary actions | Up to two `Button` (default) beside the primary, then `OverflowMenu` (`ellipsis`) last. |

The `OverflowMenu` is always the last control in `PageHeader`. Put destructive actions ("Delete set") at the bottom of that menu, separated by a divider, in `status-bad` text, each confirmed with `ConfirmDialog`.

## Tabs, overflow and change indicators

- `Tabs` swap panels inside one page (`role="tablist"`, arrow keys move, selection follows focus only when panels are cheap). Max seven tabs; beyond that, move the rest into a "More" tab menu, never wrap to a second row.
- The selected tab underline uses `--m` of the page's module (falls back to `brand`).
- Counts go in `.sn-tab__badge` ("Target tracks 42"). A `.sn-tab__dot` (brand) means "changed since you last looked"; clear it when the tab is opened. Do not use status colours on tabs; if a tab holds errors, show "2 errors" in the badge text and a `StatusPill` inside the panel.
- `SegmentedControl` switches a mode or view of the same content (Play / Plan, Table / Grid, Week / Month). Two to four options, text only, no icons.
- On phones, `Tabs` scroll horizontally in their box; `SegmentedControl` with more than three options becomes a `SelectField`.

## Which navigation for which job

| Job | Use | Never use |
|---|---|---|
| Swap content in the same place | `Tabs` (different panels), `SegmentedControl` (same data, other mode) | Links styled as tabs; drawer rows |
| Jump within a long page | In-page anchor links (`href="#running-order"`), styled `TextLink`; a sticky mini table of contents only on long documents (brand book sections, help) | Tabs; scroll-jacking |
| Go to another page | `TextLink` in the destination module colour (`.sn-link.sn-m-<key>`), `LauncherCard`, `NavDrawer` row | Buttons styled as links; `Button --primary` for navigation |
| Step through a sequence | `PeriodNav` (weeks, days), prev/next buttons in the data-quality review queue, `MediaViewer` arrows | Pagination numbers for time; tabs per week |
| Act on the current object | `Button`, `OverflowMenu`, `ContextMenu` | Links |

A link changes the URL; a button changes state. If it does both (open a track in a side sheet and update `?track=`), it is a link (`<a href>`) that the app intercepts.

## Date and period navigation

`PeriodNav` is the only control for moving through time.

- Anatomy: `chevron-left` button, period label, `chevron-right` button, "This week" quiet button, optional `calendar-range` picker.
- Label formats: day "Sat 24 Oct", week "Mon 19 – Sun 25 Oct 2026" ("Week of 19 Oct 2026"), month "Oct 2026". Weeks start Monday (Melbourne).
- The next button is disabled when the next period is in the future and has no data (radio plays, pipeline runs). Planning views (sets per week) allow the future.
- Keyboard: `[` previous, `]` next, `t` this period, when focus is not in a field.
- The period lives in the URL (`?week=2026-W43`, `?day=2026-10-24`), so prev/next are links.

## Where secondary actions live

| Place | Holds |
|---|---|
| End of `PageHeader` | Page-wide actions: export, print, duplicate, delete, refresh |
| End of a `DataTable` row | `OverflowMenu` with `ellipsis-vertical`, plus at most one visible row action (add to set `plus`) |
| `Card` footer (`.sn-card__foot`) | Card actions; the main one first, `OverflowMenu` last |
| `ContextMenu` (right-click, long-press, Shift+F10) | A shortcut copy of actions already reachable elsewhere. Never the only path to an action. |
| `CommandPalette` | Every navigation target and every page-level action, by name |

## Index and launcher cards

- `HomePage` is a grid of `LauncherCard`s, one per module in drawer order. Each card: `.sn-card--tonal.sn-m-<key>`, module icon, module label (`title-s`), the module summary from `SongNodes.modules`, one live figure ("1,284 tracks", "3 jobs running"). The whole card is the link; nothing else inside it is focusable.
- Index cards inside a module (saved sets, sources) use `Card` (neutral) or `SetCard`. The title is the link; footers may hold actions.
- Do not mix launcher cards and content cards in one grid.

## Deep links and URL state

Every view a person might want to return to or share has a URL that reopens it exactly.

| In the URL | Example | Not in the URL |
|---|---|---|
| Route (page) | `/library`, `/sets/peak-time-friday`, `/graph` | Hover, focus, open tooltips |
| Selected track | `?track=trk_8f2a` | Multi-select in progress |
| Filters | `?pillar=house&tier=building&heard=2` | Unsent text in a search box (debounced value is fine) |
| Sort | `?sort=-last_heard` (minus = descending) | Scroll position (the browser restores it) |
| Period | `?week=2026-W43` | Transient drag state |
| Tab / mode | `?tab=pathfinder`, `?mode=plan` | Open menus, dialogs that are confirmations |

Rules:
- Use `replaceState` for filter and sort changes (no history spam); use `pushState` for page, track and period changes so Back works.
- Defaults are omitted from the URL. Unknown parameters are ignored, not errors.
- A shared link must reopen the same view for another person, except per-person preferences (theme, density, text size), which stay in local storage.
- Artifact pages (Naarm Set Builder and other Claude artifacts) cannot rely on paths: use `#<view>` tokens (`#library`, `#set/peak-time-friday`, `#week/2026-W43`) and listen to `hashchange`.

### SongNodes: replace pathname switching with react-router

`App.tsx` currently branches on `window.location.pathname` (`/callback/spotify`, `/oauth/callback`) and a `djModeEnabled` flag. `react-router-dom` 7 is already a dependency and unused. Replace with:

```tsx
const router = createBrowserRouter([
  { path: "/", element: <Shell />, errorElement: <ErrorPage />, children: [
    { index: true, element: <HomePage /> },
    { path: "graph", element: <GraphExplorerPage /> },      // ?mode=play|plan&track=
    { path: "library", element: <LibraryPage /> },
    { path: "library/:trackId", element: <TrackDetailPage /> },
    { path: "sets", element: <SetBuilderPage /> },
    { path: "sets/:setId", element: <SetBuilderPage /> },
    { path: "paths", element: <GraphExplorerPage panel="paths" /> },
    { path: "harmony", element: <MatrixPage kind="keys-energy" /> },
    { path: "sources/*", element: <LogPage kind="sources" /> },
    { path: "pipeline/*", element: <MonitoringPage /> },
    { path: "settings/*", element: <SettingsPage /> },
    { path: "*", element: <ErrorPage code={404} /> },
  ]},
  { path: "/callback/:provider", element: <AuthCallbackPage /> },
  { path: "/oauth/callback", element: <AuthCallbackPage /> },
]);
```

- `Shell` renders `AppHeader`, `NavDrawer`, `CommandPalette`, the toast region and `<Outlet />`.
- Read and write URL state with `useSearchParams`; keep the Zustand store for data, not for which panel is open.
- The right-panel tab state in `DJInterface.tsx` (`rightPanelTab`) becomes `?tab=`; the Play/Plan mode becomes `?mode=`.
- Old routes that move get a `RetiredPageNotice` for one release, then a redirect.
