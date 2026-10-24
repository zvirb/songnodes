# AppHeader

The one sticky 56px bar at the top of every SongNodes page: hamburger, wordmark, the current page's title, and a fixed set of status and tools on the right.

## When to use
- Once per app shell, above every page. Never a second header inside a page (that is PageHeader).
- Not for site navigation links: the hamburger opens the NavDrawer, which holds every destination.

## Anatomy and markup
Order is fixed, left to right: menu button → wordmark → divider → page title → (mode switch, graph page only) → freshness stamp → connection status → quick search → More actions.
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
- Wordmark: "SongNodes" in Sora 800, `brand` colour. Plain type, not a link (decided): Home is the first row of the drawer, so the always-underlined link rule is not broken.
- Title: thin–bold, compact (`0.9375rem`), truncates with an ellipsis.

## Variants
- **Standard**: library, sets, sources, pipeline pages.
- **With mode switch**: graph page adds Play/Plan (`sn-segmented-control--sm`, sentence case) after the title.

## States
- Connection: `data-status="ok"` Live · `warn` Reconnecting… · `bad` Offline. Glyph plus word; the word folds to the glyph on phones and stays in the accessible name.
- Freshness: relative time with the absolute stamp in `title` and `datetime`.
- Menu button `aria-expanded` mirrors the drawer.

## Content rules
Title uses the module name as lead: "Graph: Adjacency". Stamp says what the time means: "Updated 15 h ago". Shortcut hint shows "⌘K" on Apple devices, "Ctrl K" elsewhere.

## Accessibility
- `header` landmark (banner). Menu button: `aria-expanded` + `aria-controls` to the drawer; focus returns to it when the drawer closes.
- Search button announces its shortcuts with `aria-keyshortcuts`; the key cap is `aria-hidden`.
- Ctrl/⌘ K and / (outside text fields) open CommandPalette from anywhere.

## Responsive
Width is read with a container query, so the header behaves the same in a narrow pane as on a phone.
- ≤760px: title and divider hide; the stamp keeps only its clock icon and time.
- ≤560px: search becomes icon-only, connection becomes its glyph, the stamp hides (it stays in PageHeader).
- ≤420px with a mode switch: wordmark hides (it stays in the drawer) so Play/Plan always fits.
- Wall screens: no change; the header never grows past 56px.

## Do / don't
- Do keep the right-hand order identical on every page, even when an item is empty.
- Don't add buttons here for page actions; they belong in PageHeader.
- Don't show a visible nav bar or tabs for site sections.

## In SongNodes
Replaces `DJHeader.tsx` (mode selector, emoji tool buttons) and the separate quick-search trigger. `DJModeSelector.tsx` becomes the SegmentedControl in `__mode`. The live WebSocket state feeds the connection pill.

## In the music library
The Naarm Set Builder's top bar becomes this header with "Library: Melbourne crate" or "Set builder: Peak time Friday" as the title and the weekly-run time as the freshness stamp.
