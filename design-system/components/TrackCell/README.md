# TrackCell
The standard track identity: "Artist – Title" on line one, mix name · label · duration on line two, plus the now-playing marker, flags and service links.

## When to use
- Every place a track is a row: crate table, running order, search results, Pathfinder, target tracks, data-quality review.
- Not for cards about a track (use Card with a title) or the large now-playing deck.

## Anatomy and markup
`sn-track-cell` (min-height `row-two-line`, 56px) → `__title` (optional `__now`, then `__name` with `__artist` in `fg-2` and the title in 600) and `__meta` (`__mix`, `__sep`, label, `__dur`, then `__flag` / `__flag--info`, then `__links`).
```html
<div class="sn-track-cell">
  <span class="sn-track-cell__title"><span class="sn-track-cell__name" title="Bicep – Glue">
    <span class="sn-track-cell__artist">Bicep –</span> Glue</span></span>
  <span class="sn-track-cell__meta"><span class="sn-track-cell__mix">Original mix</span>
    <span class="sn-track-cell__sep" aria-hidden="true">·</span><span>Ninja Tune</span>
    <span class="sn-track-cell__sep" aria-hidden="true">·</span><span class="sn-track-cell__dur">4:29</span>
    <span class="sn-track-cell__links"><a class="sn-link sn-link--ext" href="…" target="_blank" rel="noopener">TIDAL</a></span></span>
</div>
```

## Variants and states
- Now playing: `__now` (waveform icon + "Now" in `--now`); the row also gets `data-now` for the 3px bar.
- Flags: `__flag` "Check energy" (▲, `status-warn`); `__flag--info` "Check Beatport match" (i).
- Compact `sn-track-cell--compact` for 32px rows. DataTable in compact density hides mix, label and duration and keeps flags.
- Long names truncate with an ellipsis; the full name is in `title` and in the detail view.

## Content rules
En dash with spaces between artist and title. Title without the mix in brackets; the mix goes on line two ("Extended mix", "VIP"). Duration via `SongNodes.format.duration(sec)` ("6:12"). Service names as the services write them: TIDAL, Deezer, Beatport, Spotify. Links end with ↗ and open in a new tab.

## Accessibility
The name is one text run ("Bicep – Glue"). Service links have an aria-label naming track and service. The now marker has visible text, not just an icon.

## In SongNodes / the music library
Replaces the identity block in `SetlistBuilder/TrackListItem.tsx`, track rows in `TrackSearch.tsx`, `MobileTrackExplorer.tsx` and `TargetTracksManager.tsx`, and the crate Track and Links columns in the Naarm Set Builder.
