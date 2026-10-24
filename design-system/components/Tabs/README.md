# Tabs

Swap between views of the same thing inside a page, such as a track's overview, plays and transitions, with an active line in the module colour.

## When to use
- 2–8 sibling views of one object or panel, where only one shows at a time.
- Not for site navigation (NavDrawer), not for 2–4 display modes of the same data (SegmentedControl), not for steps in a flow.

## Anatomy and markup
Built on core `.sn-tabs` / `.sn-tab`; this component adds the overflow wrapper, More menu and panel spacing.
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

## Variants
- **Counts**: `sn-tab__badge`, mono figures; the selected tab's badge fills with the module colour.
- **Change dot**: `sn-tab__dot` (brand) means something changed since the person last opened that tab; it clears when the tab is selected.
- **Overflow**: when tabs do not fit, the strip scrolls sideways, fades at the cut edge (`data-fade-start` / `data-fade-end` on `__wrap`) and a "More" menu lists the tabs that are out of view.

## States
Hover lifts the label to `fg`. Selected: `fg` label plus 2px line in `--m` (falls back to `brand`). Focus ring sits inside the tab so the scroller does not clip it. Disabled tabs are not used; hide a view that does not apply.

## Content rules
Nouns in sentence case: "Overview", "Heard on", "Audio analysis". Counts are bare numbers in the badge ("14"), the unit goes in the hidden text. Never an emoji or icon-only tab.

## Accessibility (WAI-ARIA tabs, automatic activation)
- ←/→ move and select (wrap), Home/End jump to first/last; Tab moves into the panel.
- Roving `tabindex`: only the selected tab is in the tab order.
- The panel is focusable (`tabindex="0"`) when it has no focusable content of its own.
- The More menu follows the menu-button pattern; choosing an item selects that tab and scrolls it into view.

## Responsive
Phone and narrow side panels: horizontal scroll with fade and More menu; never wrap to two lines. Wall: same strip; the line stays 2px.

## Do / don't
- Do keep the order stable; counts and dots may change, positions do not.
- Don't use tabs to switch modules or pages.
- Don't show a count of zero; drop the badge.

## In SongNodes
The Plan-mode right panel (Track analysis, Key & mood, Pathfinder, TIDAL, Spotify, Target tracks) in `DJInterface/panels`, and the track details modal sections. Replaces the emoji-labelled panel buttons.

## In the music library
Track detail (Overview, Heard on, Transitions, Sources) and the saved-sets list versus running order on narrow screens.
