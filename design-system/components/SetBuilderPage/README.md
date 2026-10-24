# SetBuilderPage

Shape a set from the crate, check every transition and save it: controls, energy wave, running order and saved sets on one page.

## When to use / not use
`/sets/:id` in SongNodes, `#/set` in the music library. Not for listing sets only (that is the saved sets index with `SetCard`s).

## Anatomy
| Region | Component | Notes |
|---|---|---|
| Header | `PageHeader` sets band "Set builder › Saved sets"; primary "Build set", secondary "Save set", `OverflowMenu`: Copy tracklist, Export as CSV, Print set, Send to TIDAL on the weekly run (checkbox item), New empty set…, divider, Delete set… | Saved stamp + TIDAL `StatusPill` in the meta row |
| Controls | `Card` in sets scope inside a `Disclosure` (open on desktop, folded on tablet and phone once a set exists): `TextField` set name with count, `SelectField` shape, `NumberField` length (30–360 min), genre mix `NumberField` × 3 in a fieldset ("Adds up to 100%"), `SelectField` pool, `Switch` "Send to TIDAL on the weekly run", quiet "New empty set…" | `.sn-page-sets__controls`, `.sn-page-sets__mix` |
| Wave | `ChartFrame` + `EnergyWave`: bars per slot in energy colours, dashed target wave, Building band, ✕ on a too-steep step, summary pills | |
| Summary | Mono line "14 tracks · 92 min · 122–136 BPM · 6A → 12A" + `CompatibilityBadge` counts | `.sn-page-sets__summary` |
| Running order | `SectionHeading` with "Try another take", `SetSlot` rows (lock, up, down, remove) with `TransitionNote` between, spares under slot 5, `ShowMore` "Show 5 more slots" | |
| Saved sets | `SetCard` list (aside) with Open and Duplicate; the open set's link carries `aria-current` | `.sn-page-sets__aside` |
| Feedback | `Toast` "Saved “Peak time Friday” · 14 tracks, 92 min" with Undo; `ConfirmDialog` for New empty set | |

## Data
`SetBuilderPageProps`: the set (shape, length, mix, pool, slots with targets, lock state, spares), saved sets.

## States
- First load: wave skeleton bars and 6 slot skeletons; controls render immediately from the saved set.
- Building: "Build set" busy ("Building…"); the old order stays until the new one lands, then the wave redraws (no row animation).
- Empty (new set): wave area becomes `EmptyState` "No tracks yet" with "Build set" (`--lg`); controls open.
- Error: `ErrorState` in place of the running order, for example "Fix 2 fields to save the set" linking to Length and Genre mix; or "No track in the pool fits energy 9 after 9A" inside the empty slot.
- Offline: edits stay on the device; Save shows "Saved on this device. Syncs when back online." TIDAL send waits.

## Responsive
≥1100px: controls and saved sets in a 320px column (360px from 1440px), wave and running order right. Tablet: one column, saved sets 2-up after the running order. Phone: controls folded, slot rows wrap to three lines, saved sets last. Wall: capped at 1400px. Booth: Play mode at the decks uses `PrintSheet` or this page with larger type; lock and move buttons keep 44px targets on touch.

## Primary action
"Build set". Saving is secondary but also confirmed by a toast.

## Replaces
SongNodes `SetlistBuilder` (drag order, transitions, export) and `AnalyticsPanel` chart; `alert()`/`confirm()` for clearing. Music library: the Naarm set builder controls, energy wave, running order, transition strip and saved sets list.
