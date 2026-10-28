# FreshnessStamp
Says how current the data on screen is: an absolute Melbourne stamp, a relative age, a warning once it goes stale, and an "Updating…" state that keeps the old data visible.

## When to use
- Under page titles and in card footers, for data that refreshes on a schedule: the weekly library, the ARIA chart, radio plays, scraper stats.
- Don't use for live streams (ConnectionStatus) or for when a record was edited (KeyValueGrid).

## Anatomy and markup
`sn-freshness-stamp` → clock icon, label + `<time datetime>`, then one of `__rel` "(3 h ago)", `__stale` "▲ 11 days old, refresh due", or `__busy` (spinner + "Updating…"). Add `data-refreshing` while refreshing.
```html
<span class="sn-freshness-stamp" role="status">… <span>Library as of
  <time datetime="2026-10-23T19:00:00Z" title="3 h ago">24 Oct 2026, 06:00 AEDT</time></span>
  <span class="sn-freshness-stamp__rel">(3 h ago)</span></span>
```

## States
- Fresh: absolute stamp plus relative age.
- Stale: after `staleAfterDays` (default 8 for weekly data; set per source, for example 2 for daily radio plays) the relative age is replaced by the warning, with ▲ and the age in days.
- Refreshing: spinner and "Updating…". The old stamp stays until new data lands, then everything swaps in one step.
- Never loaded: "–" and "not loaded yet".
- After a staged first load (1.4.0): a "How this was read" `Disclosure` directly under the stamp holds the finished step counts and timings that `StagedProgress` showed ("Read the library · 2,410 tracks · 0:09"), so they stay available after the step list has gone.
- Short form: "Updated 30 min ago" with the absolute stamp in `title`, for headers and card footers.

## Content rules
Absolute: `SongNodes.format.stamp()` → "24 Oct 2026, 06:00 AEDT". Relative ages only alongside the absolute time (visible or in `title`). The lead-in names the data: "Library as of", "ARIA Club Chart as of".

## Accessibility
`role="status"`, so the change to "Updating…" and back is announced politely. The stale warning has a glyph and words.

## In SongNodes / the music library
The Naarm library header ("Library as of …"), Sources pages, "Recently scraped data" in the planned Pipeline monitoring, and the export time in `StatsPanel.tsx`.
