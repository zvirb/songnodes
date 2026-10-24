# PrintSheet

The A4 portrait printout of a set: thin–bold title, set meta, running order (slot, time in, track, BPM, key code and name, energy number with a greyscale pattern bar, transition note with glyph and words) and a traceability footer.

## When to use
- `/sets/:id/print` from "Print set" in the Set builder's More actions (SongNodes), and the browser's own print in the music library artifact.
- Not for other pages: they print with the generic rules in 15 Print and export.

## Anatomy
| Region | Class / component |
|---|---|
| Route root | `.sn-page-print` on `body`; hides app chrome in print (`AppHeader`, `NavDrawer`, `.sn-skip`, `FilterRail`, toasts, tooltips, `CommandPalette`, `[data-print=hide]`) |
| Screen bar | `.sn-page-print__bar` (`data-print="hide"`): "Print preview · A4 portrait · 1 page", `Checkbox` "Add a notes column", primary **Print** |
| Paper | `.sn-page-print__paper` with `data-theme="light"` (dark and booth never print), 210 × 297 mm, margins 14/12/18 mm |
| Head | `.sn-page-print__head`: `sn-title title-l` "Set: Peak time Friday", `__meta` shape, length, tracks, BPM range, genre mix; `__key` pattern legend |
| Running order | `table.sn-page-print__table`, 9 mm rows, repeated `thead`, `break-inside: avoid` |
| Energy | `.sn-page-print__energy`: number + `__ebar` ten segments; lit segments by tier: Low 1–4 solid, Building 5–7 hatched, High 8–10 cross-hatched (`repeating-linear-gradient`, `print-color-adjust: exact`) |
| Key | Text only: "8A A minor" (no colour dependence) |
| Transition | Worst verdict as glyph + word ("● Perfect", "◐ Compatible") then the parts from `SongNodes.energyStep`, `compat`, `bpmStep` ("energy +1 · same key · +1 BPM") |
| Locks | `lock` icon after the slot number; spares never print |
| Footer | `.sn-page-print__foot`: "Peak time Friday · Set builder · SongNodes", full URL, "Printed 24 Oct 2026, 21:30 AEDT · Library as of 24 Oct 2026, 06:00 AEDT", "Page 1 of 1" (fixed per printed page) |

## Data
`PrintSheetProps` (`61-pages-b.d.ts`): name, shape, slots with play seconds, URL, data freshness.

## States
Waits for `document.fonts.ready`, then calls `window.print()` once. 25–48 slots: two pages with the header repeated. Missing values print "–"; missing key prints "key ?" in the note.

## Responsive
On screen the paper keeps its A4 size and the desk scrolls sideways on phones. Print: A4 portrait only.

## Primary action
Print.

## Replaces
`SetlistBuilder` export-to-print hacks and printing the dark app screen; nothing printed before carried its URL or data freshness.
