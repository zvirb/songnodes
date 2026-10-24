# SetCard
The card for a saved set: name, shape, length, track count, peaks, a mini energy wave, its "Send to TIDAL" state, when it was updated, and Open / Duplicate.

## When to use
- Saved-set lists in the set builder and on the sets hub, "Recent sets" on the home page.
- Not for a running order (SetSlot) or a single track.

## Anatomy and markup
`sn-card sn-card--tonal sn-set-card` inside `sn-m-sets`: `__head` (shape CategoryTag), `__name` (Sora title-s), `__stats` (mono "92 min · 18 tracks · 3 peaks"), `__wave` (one bar per slot; `data-e` sets the energy colour, height = energy × 10%), `__meta` with a StatusPill for TIDAL and the updated `<time>`, `__foot` with an Open link and a Duplicate button.
```html
<article class="sn-card sn-card--tonal sn-set-card" aria-labelledby="set-1">
  <div class="sn-card__head"><span class="sn-tag sn-category-tag">Peak time three waves</span></div>
  <h3 class="sn-set-card__name" id="set-1">Peak time Friday</h3>
  <div class="sn-set-card__stats"><span>92 min</span><span>18 tracks</span><span>3 peaks</span></div>
  <div class="sn-set-card__wave" role="img" aria-label="Energy wave: 5, 6, 7, …"><i data-e="5" style="height:50%"></i>…</div>
  …
</article>
```

## TIDAL states
Not sent (no pill, or idle "Not sent"); queued (idle "Queued for Sunday's run"); sent (ok "Sent to TIDAL 20 Oct"); failed (bad, with the reason: "TIDAL send failed: sign-in expired").

## Content rules
Shapes as the builder names them: Journey two peaks, Peak time three waves, Warm-up opener, Closing, Steady groove. Length in minutes (`format.span` over an hour). Updated as a relative time with the absolute stamp in `title`. Actions: "Open set" (link) and "Duplicate" (button whose aria-label names the set).

## Accessibility
The wave is `role="img"` and lists the energies. Only the name's Open link goes to the set; the card isn't one big link, because it has a second action.

## Responsive
In `sn-card-grid` with `--sn-card-min: 260px`; one column on phones.

## In the music library / SongNodes
Replaces the Naarm "Saved sets" list and the setlist list in `SetlistBuilder/index.tsx`.
