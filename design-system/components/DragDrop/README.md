# DragDrop

The one drag-and-drop pattern in SongNodes: reorder the running order and drag crate tracks into a set, with a grip handle, a name-only ghost, a dashed target that says the outcome, locked slots that refuse and say why, a full keyboard path and an Undo toast for every drop. Imported in 1.4.0 from BeanAlliance DragDrop (v4.17–v4.17.2), chosen by Markus 28 Oct 2026.

## When to use
- Reordering `SetSlot`s in a running order; dragging a track from the crate (`LibraryPage` / `DataTable` row) into a set slot.
- Never the only way: `SetSlot`'s Move up / Move down and Alt+↑ / Alt+↓, and the row's "Add to set" action, stay (WCAG 2.5.7).

## Anatomy and markup
- Handle `.sn-drag-handle`: Lucide `grip-vertical`, at least 24px square (44px on touch), `fg-3`, `cursor: grab`, `touch-action: none`. Only the handle starts a drag; the rest of the row stays a click or link.
- The item left behind takes `.sn-drag-origin` until the drop.
- Ghost `.sn-drag-ghost` > `__name`: the track's name only ("Bicep – Glue"), `surface-1`, 1px `brand` border, `radius-control`, `shadow-2`, following the pointer.
- Target `.sn-drop-target`: a 2px dashed `brand` outline inside the slot or lane, with `.sn-drop-text` saying the outcome ("Drop to move to slot 7").
- Insertion line `.sn-drop-line` (2px `brand`) only where order matters: the running order has one, a set's saved list does not.
- Locked: over a locked slot the ghost gets `[data-locked]`, the `lock` icon and "Locked: can't drop here"; the slot itself does not change and nothing drops.

## Behaviour
- A drag starts after 4px of pointer movement. The whole slot, padding included, is the hit area. Near the top or bottom of the view the page scrolls on its own.
- Keyboard: focus the handle, Space picks up, arrow keys move, Enter or Space drops, Escape cancels and puts the item back. Every move is announced ("Glue, slot 7 of 18").
- Every drop saves and confirms with a `Toast` naming what happened, with Undo. A refused drop puts the item back and says why in a warn toast with `role="alert"`.
- Reduced motion: the ghost and item move without easing.

## Accessibility
Handle is a button named "Move Bicep – Glue"; `aria-describedby` points at the keyboard hint. Announcements go to one polite live region.

## In SongNodes / the music library
`SetSlot` reordering on `SetBuilderPage`; crate rows into a set. Styles: `source/css/35-drag-drop.css`.
