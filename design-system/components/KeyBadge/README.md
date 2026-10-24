# KeyBadge
A musical key as a Camelot-coloured dot plus the code in mono ("● 8A"), with the key name ("A minor") in detail views and tooltips.

## When to use
- Every key display: crate Key column, running order, track detail, Key & mood, transition notes.
- Don't show raw notation ("Am", "F#m") in the UI; normalise it with `SongNodes.camelot()`.

## Anatomy and markup
Core `sn-key` with `data-key` (the colour comes from `01-keys.css`). `SongNodes.html.key(k, withName)` builds it.
```html
<span class="sn-key" data-key="8A" title="A minor">8A</span>
<span class="sn-key sn-key-badge--lg" data-key="8A">8A <span class="sn-key__name">A minor</span></span>
<span class="sn-key" data-unknown>–<span class="sn-sr">Key not set</span></span>
```

## Variants
- Row: dot + code, name in `title`.
- Detail `sn-key-badge--lg`: larger code, name in `fg-2`.
- Unknown: hollow dot and an en dash. Core `html.key()` currently prints "key ?"; use the en-dash markup until it changes.
- Reference grid `sn-key-badge-grid`: all 24 keys, 1A–12A then 1B–12B, in 12 columns (6 on tablet, 4 on phone). Use in Key & mood and in help.

## Content rules
The Camelot code is what DJs read first; the name is secondary and uses ♯/♭ ("F♯ minor"). A = minor, B = major.

## Accessibility
The dot is decorative; the code is the text, so wheel colour is never the only cue. In tables, sort by wheel position (1A, 1B, 2A…), not alphabetically.

## Rows vs detail
Rows show the code only, to keep the column narrow and scannable. Detail views, hover cards and the Key & mood panel show the name too.

## Do / don't
- Don't show the key name in table rows; it doubles the column width.
- Don't colour the text by key, only the dot.

## In SongNodes
Replaces key text in `TrackDetailsModal.tsx`, `KeyMoodPanel.tsx` and `IntelligentBrowser/CurrentTrack.tsx`, and the colour logic in `DJInterface/utils/camelotHelpers.ts` (colours now come from the `key-*` tokens).
