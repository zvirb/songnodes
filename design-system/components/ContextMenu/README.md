# ContextMenu

The right-click, long-press or Shift+F10 menu on graph nodes, edges, the empty canvas and table rows, using the same look and keyboard model as OverflowMenu.

## When to use
- Shortcuts to actions on the thing under the pointer. Every action here must also exist somewhere visible (OverflowMenu, panel or toolbar), because context menus are hard to discover.
- Not as the only way to act, and not on plain text or links (leave the browser's menu there).

## Anatomy and markup
A positioned wrapper around an OverflowMenu menu, with a title naming the target.
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
Targets get `sn-context-menu__target` (context-menu cursor, focus ring) and must be focusable.

## Menus by target
- **Node**: Route (Set as starting track, Set as waypoint, Set as finish, Calculate route) · Track (View track info, Add to set…, Hide adjacency edges).
- **Edge**: View connection details, Add both tracks to set…, Hide adjacency edges, Hide this connection.
- **Empty canvas**: Fit graph to screen (F), Reset view, Pause layout (Space), Show hidden edges, Clear route.
- **Table row**: View track info, Add to set…, Set as starting track, Show in graph, Remove from crate (destructive, last).

## States
Calculate route is `aria-disabled` with its reason until both start and finish are set. The target keeps a highlighted state (`data-on`) while its menu is open. `--contained` positions inside a relative parent.

## Accessibility
- Opens with right-click, a 500ms long-press on touch, Shift+F10 or the Menu key on the focused target; focus moves to the first enabled item.
- Same keys as OverflowMenu: arrows, Home/End, typeahead, Esc closes and returns focus to the target.
- The menu is named "Actions for <target>"; results are announced in a status message.

## Responsive
Clamped inside the viewport; on phones long-press opens it at the finger and items grow to 44px. Wall: same size; never scales with zoom.

## Do / don't
- Do keep the same item order on every node.
- Don't block the browser menu on text, inputs or links.
- Don't put destructive actions in canvas menus.

## In SongNodes
Replaces `ContextMenu.tsx` and `RadialMenu.tsx` (node, edge and empty-canvas menus) and the path-builder start/end buttons in `PathfinderPanel`.

## In the music library
Crate rows: add to set, start a route, remove from crate.
