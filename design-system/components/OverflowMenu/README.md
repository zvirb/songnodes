# OverflowMenu

The predictable home for secondary actions: a "More actions" button with an ellipsis that opens a keyboard-operable menu of grouped actions, destructive last.

## When to use
- Actions people need sometimes but that would crowd the page or row: duplicate, export, rename, delete.
- Not for navigation (links), not for choosing a value (select or SegmentedControl), not for the primary action (always a visible button).

## Anatomy and markup
```html
<div class="sn-overflow-menu">
  <button class="sn-btn sn-btn--icon" id="more-btn" aria-haspopup="menu" aria-expanded="false" aria-controls="more" aria-label="More actions">…ellipsis…</button>
  <div class="sn-overflow-menu__menu" role="menu" id="more" aria-labelledby="more-btn" hidden>
    <div role="group" aria-labelledby="h1"><div class="sn-overflow-menu__heading" id="h1" role="presentation">Set</div>
      <button class="sn-overflow-menu__item" role="menuitem" tabindex="-1">…copy… <span class="sn-overflow-menu__label"><span class="sn-overflow-menu__text">Duplicate set</span></span></button>
      <button class="sn-overflow-menu__item" role="menuitem" tabindex="-1" aria-disabled="true" aria-describedby="r1">…upload… <span class="sn-overflow-menu__label"><span class="sn-overflow-menu__text">Send to TIDAL on the weekly run</span><span class="sn-overflow-menu__reason" id="r1">Connect TIDAL in Services first</span></span></button>
    </div>
    <div class="sn-overflow-menu__sep" role="separator"></div>
    <button class="sn-overflow-menu__item sn-overflow-menu__item--danger" role="menuitem" tabindex="-1">…trash… <span class="sn-overflow-menu__label"><span class="sn-overflow-menu__text">Delete set…</span></span></button>
  </div></div>
```

## Variants
- Page level: secondary (bordered) icon button in PageHeader. Row level: `sn-btn--quiet sn-btn--sm`, labelled with the row ("More actions for Overmono – So U Kno").
- `__menu--start` aligns to the left edge; `__menu--up` opens upwards near the bottom of the screen.
- Checkbox item: `role="menuitemcheckbox"` + `aria-checked`, the check icon shows only when on.
- Shortcut hint: a `<kbd>` at the right of the item.

## States
Focused item: `surface-2` fill and inner focus ring. Disabled: `aria-disabled="true"`, stays focusable, dimmed, with a one-line reason in `fg-2`. Destructive: `status-bad` text and icon, always last, after a separator, label ends with "…" because it opens a confirmation.

## Content rules
Verb first, sentence case, name the object: "Export as CSV", "Delete set…". Reasons say what to do: "Connect TIDAL in Services first". Group headings are nouns ("Set", "Share", "View").

## Accessibility (WAI-ARIA menu button)
- Enter, Space or ↓ opens and focuses the first item; ↑ opens on the last.
- ↑/↓ move and wrap, Home/End jump, typing a letter jumps to the next item starting with it.
- Esc closes and returns focus to the button; Tab closes and moves on; clicking outside closes.
- Choosing an item closes the menu, returns focus to the button and announces the result in a status message.

## Responsive
Menu width 264–360px, never wider than the screen minus 32px. Touch: items grow to 44px. On phones near the bottom use `--up`.

## Do / don't
- Do keep the same order in every menu of the same kind: everyday actions, sharing, view toggles, destructive.
- Don't hide the only way to do something important in here.
- Don't nest submenus; use a dialog when choices branch.

## In SongNodes
Replaces scattered icon rows in `SetlistBuilder`, `TargetTracksManager.tsx` (archive, export JSON), `StatsPanel.tsx` (export CSV/JSON) and the settings cog menu.

## In the music library
"Save set", "Copy tracklist" stay visible; "Send to TIDAL on the weekly run", "New empty set" and delete live here.
