# NavDrawer

The left overlay drawer that holds every SongNodes destination, opened from the AppHeader hamburger and hidden the rest of the time.

## When to use
- The only site navigation. There is no visible nav bar or site tab strip.
- Not for page content or filters (use a rail or panel), and not for actions (OverflowMenu).

## Anatomy and markup
Scrim + panel (`drawer-w`, `shadow-3`, `radius-sheet` on the right-hand corners) → head (wordmark, close) → Home → groups → footer (Preferences, Keyboard shortcuts).
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
Groups, in this order: **Make** (Set builder, Pathfinder) · **Explore** (Graph, Library, Key & mood) · **Collect** (Sources) · **System** (Pipeline, Services). Each row carries its `sn-m-<module>` class so the Lucide icon takes the module colour; the label stays `fg`.

## Variants
`sn-nav-drawer--contained` positions it inside a relative parent (docs, previews, embedded panes) instead of the viewport.

## States
- Closed: no `data-open`; `visibility: hidden`, so nothing inside is focusable or announced.
- Open: `data-open`; panel slides in over `duration-base`, scrim fades to `overlay`. No motion with reduced motion.
- Current page: `aria-current="page"`, `brand-soft` fill, bold label and a 3px `brand` inner edge (a cue that is not colour alone).
- Count: `__count` neutral number. Attention: an `sn-pill` with status (for example ▲ 2 paused scrapers). Both carry a hidden phrase.

## Accessibility (WAI-ARIA modal dialog plus disclosure)
- Opener: `aria-expanded`, `aria-controls`. Opening moves focus to the current page row (or the first row).
- Focus is trapped: Tab and Shift+Tab wrap; the page behind is `inert`.
- Esc, the close button, a scrim click and choosing a row all close it and return focus to the hamburger.
- Rows are real links inside `nav aria-label="Main"`; group lists are labelled by their headings.

## Responsive
Phone: width is `min(drawer-w, 100% − 48px)` so a strip of page stays visible to tap away. Desktop and wall: same overlay at 300px; it never docks. Touch rows grow to `touch-min`.

## Do / don't
- Do keep the group order and row order fixed; people find things by position.
- Don't colour the label or the current-row fill by module; only the icon carries the hue.
- Don't put more than one badge on a row, or badges on Home.

## In SongNodes
Replaces the sidebar toggled by Ctrl+B in `useKeyboardShortcuts.ts`, the panel-switch number keys and the left tool panel in `App.tsx`. Settings, Spotify/TIDAL connections and API keys sit under Services; Preferences in the footer opens PreferencesPanel.

## In the music library
Library, Set builder and Sources (radio plays, ARIA Club Chart) are rows here; the Naarm Set Builder's separate tabs go away.
