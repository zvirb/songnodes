# TextLink

A link takes the colour of the module it opens, is always underlined (1px, offset 3px) and set in weight 600, so colour tells you where you will land and the underline tells you it is a link.

## When to use / not use
Use for navigation: to another module, a detail page, an external source (1001tracklists, MixesDB, Spotify) or a file path. Don't use a link to run an action (use Button), and don't style plain text as a link.

## Anatomy & markup
```html
<a class="sn-link sn-m-sources" href="/sources/pbs">PBS Soul Time</a>
<a class="sn-link sn-link--ext" href="https://…" target="_blank" rel="noopener">Open on 1001tracklists<span class="sn-sr">, opens in a new tab</span></a>
```
- `sn-link` + `sn-m-<module>`: destination colour (`--m`). Without a module class it uses `link` (lavender: `brand-strong` on dark, decided, so it holds 4.5:1 on `surface-1` and `surface-2`; `brand` on light and booth), or the nearest `sn-m-*` scope it sits in.
- `sn-link--ext`: appends " ↗" for links that leave SongNodes. Add the hidden ", opens in a new tab" text when you use `target="_blank"`.
- `aria-current="page"`: dotted underline for "you are here".

## Variants
| Class | Use |
|---|---|
| `sn-text-link--on-tonal` | Any link inside a `sn-card--tonal`. Text takes the destination `--m-ink` (always passes on a tonal fill); the 2px underline keeps the destination hue. |
| `sn-text-link--path` | File paths and IDs: `font-data`, breaks anywhere. |
| `sn-text-link--break` | Long URLs in prose: `overflow-wrap: anywhere`, never horizontal scroll. |
| `sn-text-link-list` | A vertical list of related links. |

## States
Hover thickens the underline to 2px at full colour. Focus shows the `focus` ring. Visited links are not styled differently (decided): no `:visited` rule, because the colour encodes the destination module, not history.

## Content rules
Link text names the destination: "Open running order", "PBS Soul Time", "Get an API key". Never "click here" or a bare URL when a name exists; when you must show a URL, drop the protocol ("mixesdb.com/w/…"). Sentence case.

## Accessibility
Destination colour is never the only cue: the underline is always present and the text names the place. Module hues pass 4.5:1 on `bg` and `surface-1`; on tonal cards use `--on-tonal`. External links announce that they open a new tab.

## Responsive
Inline in prose at every width. Long paths wrap rather than overflow; on phones keep links at least 24px tall when they stand alone (WCAG 2.2 target size), for example in a `sn-text-link-list` with `gap: space-2`.

## Do / don't
- Do colour by destination, not by the page you are on.
- Don't remove the underline, even in navigation-dense tables.
- Don't use status colours for links.

## In SongNodes / in the music library
Track and artist names in the library table linking to Graph, source names linking to Sources, the external "Open on …" links in the track details modal, file paths in the Pipeline audio-analysis view. In the Naarm Set Builder: the TIDAL/Deezer/Beatport links column and the "Heard on" show names.
