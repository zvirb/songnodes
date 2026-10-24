# TransitionNote
The thin strip between two running-order rows that says how the move lands: energy step, key move, BPM delta and genre switch, each with a verdict glyph.

## When to use
- Between consecutive slots in the set builder and setlist builder, and between steps of a Pathfinder route.
- The expanded form goes in slot detail and hover cards, to explain why.

## Anatomy and markup
`sn-transition-note` (mono 0.75rem on `sunk`) holding `__item[data-level]` elements. Levels: perfect ● · compatible ◐ · possible ○ · clash ✕ (bold, `fg` text) · neutral →.
```html
<div class="sn-transition-note" role="note" aria-label="Transition">
  <span class="sn-transition-note__item" data-level="perfect">energy +1<span class="sn-sr"> (perfect)</span></span>
  <span class="sn-transition-note__item" data-level="compatible">+1 key 8A→9A<span class="sn-sr"> (compatible)</span></span>
  <span class="sn-transition-note__item" data-level="perfect">+2 BPM<span class="sn-sr"> (perfect)</span></span>
</div>
```
Expanded: add `sn-transition-note--expanded`; each item holds `__what` (the label) and `__why` (one sentence).

## Rules it shows
Energy climbs +1 at a time and holds; drops after a peak are 2–3 points at once; a second −1 in a row is "possible". Genre switches are fine in the Building tier after a run of 3+, "possible" earlier. Key and BPM verdicts come from `SongNodes.compat` and `bpmStep`.

## Content rules
Short labels: "energy +1", "energy hold", "+1 key 8A→9A", "+2 BPM", "House → UK garage". Leave out what doesn't change, except energy (always shown). Reasons in the expanded form say what to do ("Keys fight; cut on a break or pick a spare.").

## Accessibility
`role="note"`. Each item has sr text with the verdict word, so the glyph colour is never needed. `title` repeats the reason for mouse users; the expanded form is the accessible way to read it.

## Responsive
Items wrap. On phones the strip indents to line up with the track column.

## In SongNodes / the music library
Replaces the transition hints in `SetlistBuilder/TrackListItem.tsx` and `AnalyticsPanel.tsx`, and the Naarm set builder strip ("energy +1", "+1 key", "+2 BPM", "House → Techno").
