# SideSheet

A right-side panel for details and filters that sits beside the work (non-modal) on desktop and becomes a modal bottom sheet with a grab handle on phones.

## When to use
- Browsing details while keeping context: track details, edge details, node neighbours, graph filters, crate filters on mobile.
- Not for a task that must be completed (Dialog) or a short pick-list (Popover).

## Anatomy
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
Width `--sheet-w` 380px. The layout should fill the app area under the header.

## Variants
- **Push** (default): the main area narrows; the graph re-fits.
- **Overlay** `sn-side-sheet--overlay`: floats over the content edge with `shadow-3` (use when the content can't reflow, e.g. the PIXI canvas mid-gesture).
- Content changes in place when another node or row is selected; the sheet doesn't close and reopen.

## States
Open/closed (`hidden`). On phones: slides up `duration-base`, scrim `overlay`, max 85% height.

## Content rules
Title names the object (thin–bold "Track: Bicep – Glue", or "Graph filters"). Facts as label/value pairs; missing values "–" in `sn-none`. Footer: up to two actions, primary last ("Add to set"); filters footer "Reset" + "Show 412 tracks".

## Accessibility
- Desktop: a complementary landmark (`aside`) named by its title; not modal, Tab moves freely; Esc closes when focus is inside.
- Opening by a button moves focus to the title; closing returns focus to the opener (or the selected node/row).
- Phones: becomes `role="dialog"` `aria-modal="true"`, the rest is `inert`, focus is trapped, Esc and scrim tap close. The grab handle is decorative; drag-to-dismiss is optional because the close button is always there.

## Responsive
Tablet, desktop and wall (≥ 768): beside the content, push by default, `--overlay` where reflow is costly. Phones (< 768): bottom sheet, footer buttons share the width, body scrolls with `overscroll-behavior: contain`.

## Do / don't
- Do keep the selection visible in the main area while the sheet is open.
- Don't stack two side sheets; replace the content.

## In SongNodes
Replaces SidePanel.tsx and the PLAN right tab panel's detail use, EdgeDetailsModal and TrackDetailsModal when browsing from the graph, GraphFilterPanel / FilterPanel (the emoji "🔧 Filters" button becomes a labelled `sliders-horizontal` button), and MobileTrackExplorer's detail view.

## In the music library
Filter rail on phones (search, Pillar, Energy tier, Rotation, Heard on, Tags, checkboxes) and track details from the crate.
