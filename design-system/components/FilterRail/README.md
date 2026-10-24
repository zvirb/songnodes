# FilterRail

The library filter panel: a sticky `rail-w` rail beside the crate on desktop, and a "Filters (3)" button with removable active-filter chips that opens the same panel as a side sheet on phones and tablets.

## When to use / not use
Use beside any long list that people narrow with several facets (library crate, target tracks, review queue). For two or three filters, put FilterChips above the table instead. Not for site navigation (that is the drawer).

## Anatomy & markup
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
Sections (`sn-filter-rail__section`, separated by `line`): Search, Pillar, Energy tier (chips with the mini 3-segment tier bar), Rotation, Heard on (select), Tags, Track checks ("Has key and BPM", "Needs an energy check", "Played on 2+ shows").

Rotation counts come from the latest weekly run: High rotation and Vault are worked out by the weekly run from the library's own play data, never from a fixed rule in the UI. A "How rotation is worked out" `Disclosure` under the Rotation chips shows the values the run used. Vault reads 0 (dashed `data-empty` chip) until the run has 8 weeks of history to learn its threshold.

## Layout
- ≥ 1024px: rail (decision: it stays visible on 1024px laptops and tablets in landscape, so it switches below 1024, not at `bp-desktop` 1100), `position: sticky; top: space-4`, scrolls inside itself, `radius-card`, `shadow-1`.
- < 1024px: bar with trigger and summary chips; the panel is a right side sheet (`min(380px, 100vw)`, `radius-sheet`, `shadow-3`, `z-dialog`, scrim `overlay`). Below 480px the sheet is full width.
- The sheet matches SideSheet's width and elevation but is built in, so rail and sheet share one panel and one set of state. In React you may instead render the same body inside SideSheet.

## States
Trigger reads "Filters" or "Filters (n)". "Clear filters" appears only when something is set. Filters apply as you change them; the sheet footer shows the live result: "Show 95 tracks".

## Accessibility
Desktop: an `aside` landmark named "Filters". Sheet: modal dialog; focus moves into it, Tab is trapped, Escape and the close button return focus to the trigger; `aria-expanded` on the trigger. Summary chips are buttons named "Remove filter: House"; after removal focus moves to the next chip or the trigger. Groups use `role="group"` with visible legends.

## Do / don't
- Do keep the same order and labels in rail and sheet.
- Don't hide the result count; people need to see what a filter did.
- Don't use the rail for actions on the selection (that is a toolbar).

## In SongNodes / in the music library
Replaces the "🔧 Filters" toggle and `FilterPanel.tsx` / `GraphFilterPanel.tsx` panels in `DJInterface.tsx`, and the filter area of `MobileTrackExplorer.tsx`. In the Naarm Set Builder: the library filter rail.
