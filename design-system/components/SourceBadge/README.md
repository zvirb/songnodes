# SourceBadge
A neutral badge naming where a track was heard or found (a radio show, tracklist site, chart or store), with "+N" opening the full list.

## When to use
- Crate Sources and Heard columns, "Heard on" in track detail, target-track provenance, import results.
- Don't use for a service's connection state (ServiceStatus) or links to a service (TrackCell links).

## Anatomy and markup
`sn-source-badge` → `__name` (icon by kind + name + optional mono `__detail`). With more than one source, a `__more` button toggles `__pop`, a list of every source with when or detail.
```html
<span class="sn-source-badge">
  <span class="sn-source-badge__name">… triple j Mix Up</span>
  <button class="sn-source-badge__more" type="button" aria-expanded="false" aria-controls="src-1" aria-label="3 more sources">+3</button>
  <ul class="sn-source-badge__pop" id="src-1" hidden>…</ul>
</span>
```
Kinds and icons: radio `radio-tower`, tracklists `list-music`, chart `chart-column`, store or streaming `disc-3`.

## Content rules
Names as the source writes them: "1001tracklists", "MixesDB", "PBS Soul Time", "3RRR Superfreak", "triple j Mix Up", "ARIA Club Chart" with detail "#12 · 4w" (position · weeks on chart), "Beatport", "Spotify". The list adds when: "Fri 23 Oct", "14 sets".

## Accessibility
"+N" is a real button (click, Enter or Space) with `aria-expanded`. Escape closes and returns focus; clicking elsewhere closes. Don't rely on a hover-only tooltip; touch users can't hover. Long names truncate with the full name in `title`.

## Visual rules
Neutral `surface-2` fill and `fg-2` text, never brand-coloured (no Spotify green). Inside tonal cards it takes `--m-raised` / `--m-ink`. In dense table cells a plain "+N" with the list in `title` is acceptable when the row's detail view shows the full list.

## In SongNodes / the music library
Crate "Heard on" column and filter results, the source column in `TracklistImporter.tsx`, the source field in `TargetTracksManager.tsx`, and lists in the Sources module.
