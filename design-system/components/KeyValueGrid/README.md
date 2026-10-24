# KeyValueGrid
A `<dl>` grid of labels and values for detail views, with mono values for data, copyable IDs and an en dash for anything missing.

## When to use
- Track detail (BPM, Key, Energy, Duration, Label, Year, ISRC, Spotify ID…), edge details (from, to, type, weight, strength), job and proxy details, set summaries.
- Don't use for lists of many records (DataTable).

## Anatomy and markup
`dl.sn-key-value-grid` with `dt` (`fg-3`, 0.8125rem) and `dd` (`fg`). IDs use `__id` (mono, ellipsis) plus a `__copy` quiet icon button.
```html
<dl class="sn-key-value-grid sn-key-value-grid--cols-2">
  <dt>BPM</dt><dd><span class="sn-bpm"><b>128</b></span></dd>
  <dt>ISRC</dt><dd><span class="sn-key-value-grid__id">GBCFB1700384</span>
    <button class="sn-btn sn-btn--quiet sn-btn--sm sn-btn--icon sn-key-value-grid__copy" type="button" aria-label="Copy ISRC">…</button></dd>
  <dt>Beatport ID</dt><dd><span class="sn-none">–</span><span class="sn-sr">Beatport ID not known</span></dd>
</dl>
```

## Variants
- One pair per row (default): labels in a `max-content` column, values left-aligned beside them.
- `--cols-2`: two pairs per row on wide screens; one pair per row below 600px.
- `--stacked`: label above value in an auto-fill grid, for 3–6 summary values in a card (wrap each pair in a `<div>`).
- Inside tonal cards, labels take `--m-muted` and values `--m-ink`.

## States
Copy: write to the clipboard, show "Copied" beside the button for 1.6 s, and announce "Copied ISRC" in a polite live region. Missing: an en dash in `sn-none`, with sr text saying what is missing.

## Content rules
Labels in sentence case. IDs named as the source names them: "ISRC", "Spotify ID", "TIDAL ID", "Beatport ID", "MusicBrainz ID". Values formatted with `SongNodes.format`. Never "N/A", "null" or "Unknown".

## Accessibility
`dt`/`dd` pairs read as term and definition. Copy buttons name the ID they copy.

## In SongNodes
Replaces the detail lists in `TrackDetailsModal.tsx`, `EdgeDetailsModal.tsx` and `InfoCard.tsx`.
