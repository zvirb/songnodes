# SelectField

A styled native `<select>` (`sn-select`) for choosing one option from a short, fixed list.

## When to use / not use
Use for up to about 15 known options: Heard on, Set shape, Track pool, Sort by. Switch to a searchable combobox when the list is long or open-ended, or people already know what to type: artists, labels, playlists with dozens of entries. For 2–4 options that are always visible, use radio buttons or `sn-seg`. For several choices at once, use FilterChips or checkboxes.

## Anatomy & markup
```html
<div class="sn-field sn-select-field">
  <label for="heard">Heard on</label>
  <select class="sn-select" id="heard"><option value="">Any show</option><option>PBS Soul Time</option></select>
</div>
```
Inline variant for toolbars: `sn-select-field sn-select-field--inline` (label beside, 32px tall). `sn-select-field__narrow` caps the width at 16rem.

## States
Hover (`fg-2` border), focus ring, error (`aria-invalid="true"`, 2px `status-bad` border, `sn-field__error`), disabled (help text says why). Native menus follow the theme through `color-scheme`.

## Content rules
Options in sentence case, as the item is named elsewhere ("3RRR Superfreak", "Peak time, three waves"). A neutral first option for "no filter": "Any show", never a blank row. A placeholder option that must be changed reads "Choose a pool" and triggers the error "Choose a track pool to build the set from." if left.

## Accessibility
Native select: full keyboard and screen-reader support for free. Always a visible label. Don't submit or navigate on change; filters may apply on change.

## Responsive
Full width in forms; inline variant in toolbars. On touch the control is 44px and opens the OS picker.

## Do / don't
- Do keep the native element; don't rebuild a custom dropdown for a short list.
- Don't hide important choices in a select when there are only two or three; show them.

## In SongNodes / in the music library
Sort and source selects in `TargetTracksManager.tsx`, playlist choice in `SpotifyPlaylistManager.tsx`, preset pickers in `PathBuilder.tsx`. In the Naarm Set Builder: Heard on, Shape, Pool.
