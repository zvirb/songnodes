# SetSlot
A running-order row: slot number, energy against the slot's target, the TrackCell, BPM and key, and lock / move up / move down / remove, with spare suggestions and transition strips between rows.

## When to use
- The set builder running order and the SongNodes setlist builder. Pathfinder routes can reuse it without lock and spares.

## Anatomy and markup
`ol.sn-set-slot-list` of `li.sn-set-slot` (grid: `__n`, `__energy`, `__track`, `__data`, `__act`). Between slots, an `li` holding a TransitionNote. After a slot, an optional `li` with `__spares` (up to 3 `__spare` buttons).
```html
<li class="sn-set-slot" data-locked aria-label="Slot 2: Peggy Gou – (It Goes Like) Nanana, locked">
  <span class="sn-set-slot__n">2</span>
  <span class="sn-set-slot__energy">…EnergyBar with target…</span>
  <span class="sn-set-slot__track">…TrackCell…</span>
  <span class="sn-set-slot__data"><span class="sn-bpm"><b>124</b></span><span class="sn-key" data-key="8A">8A</span></span>
  <span class="sn-set-slot__act">…lock (aria-pressed), up, down, remove…</span>
</li>
```

## States
- Default.
- Locked `data-locked`: `sunk` fill, lock button pressed; move and remove disabled; survives "Try another take".
- Now `data-now`: `surface-2` fill, 3px amber `--now` bar, slot number in `--now`, "Now" in the TrackCell. Not `brand-soft`: that fill means selected.
- Empty `sn-set-slot--empty`: a dashed box saying why and what to do ("No track in the pool fits energy 9 after 9A. Widen the pool or pick from the crate."), with Pick and Remove.
- Off target: the energy reads "target 8 · 1 under", and the target segment is outlined.

## Behaviour
Moving swaps with the neighbour unless the neighbour is locked; focus follows the moved row's button, and a polite live region announces "Slow Burner moved to slot 4". A drag handle (`grip-vertical`) may be added for pointer users, but up/down stay as the keyboard path. Spares swap in on click.

## Content rules
Button labels name the slot: "Lock slot 3", "Move slot 3 up", "Remove Bicep – Glue from slot 3". Spares show name, energy and key.

## Responsive
Below 768px: the number stays on the left; track and actions on top, then energy, then BPM and key. Action buttons wrap 2 × 2.

## In the music library / SongNodes
Replaces the Naarm running-order rows (slot, energy, track, lock/up/down/remove, 3 spares) and `SetlistBuilder/TrackListItem.tsx`.
