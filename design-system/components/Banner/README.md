# Banner

A persistent page-level message under the page header about a condition that affects the whole page, with at most one action and, for non-critical messages, a dismiss.

## When to use
- A condition that persists and changes how the page behaves: incomplete data ("Sets are shaped on energy alone"), a disconnected service, an upcoming weekly build, a finished build.
- Not for one panel's load failure (ErrorState), a field or row (InlineMessage), or a completed action (Toast).
- **At most one banner per page.** If two conditions apply, show the most severe; the other waits.

## Anatomy
```html
<div class="sn-banner" data-status="warn" role="status">
  <span class="sn-banner__icon"><svg class="sn-icon">…triangle-alert…</svg></span>
  <div class="sn-banner__body">
    <p class="sn-banner__content"><span class="sn-banner__title">Sets are shaped on energy alone.</span> Only 611 of 1,284 tracks have a key and BPM so far.</p>
    <div class="sn-banner__actions"><button class="sn-btn sn-btn--sm">Show tracks without a key</button></div>
  </div>
  <button class="sn-btn sn-btn--sm sn-btn--icon sn-btn--quiet sn-banner__dismiss" aria-label="Dismiss: key and BPM notice">…x…</button>
</div>
```
`sn-banner--page` makes it full-bleed directly under the header.

## Variants
| `data-status` | Icon | Dismiss | Example |
|---|---|---|---|
| `info` | info | yes | "Next weekly build: Sat 31 Oct, 06:00." |
| `warn` | triangle-alert | yes | "Sets are shaped on energy alone. Only 611 of 1,284 tracks have a key and BPM so far." |
| `bad` | circle-x | **no** (stays until fixed) | "TIDAL is disconnected. Sets can’t be sent on Saturday’s weekly run until you reconnect." + Reconnect TIDAL |
| `ok` | circle-check | yes | "This week’s build is in. 48 new tracks and 12 new edges were added." |
Fill `status-*-bg`, border a 45% mix of the status colour, text `fg`; the status colour appears only on the icon. Info uses `surface-2`.

## Content rules
Bold first sentence states the condition; second sentence gives the number or consequence. Action is verb + object. No "Warning:" prefix (the icon says it).

## Accessibility
- Present on page load: no live role needed. Inserted later: `role="status"` (info/warn/ok) or `role="alert"` (bad).
- Dismiss button names what it dismisses; after dismissing, move focus to the page heading or the next control. Dismissal is remembered per person.

## Responsive
Actions wrap under the text on narrow widths; the dismiss stays top-right. Full width of the content column at every breakpoint.

## Do / don't
- Do remove the banner automatically once the condition is fixed.
- Don't stack banners or use them for marketing or tips.

## In SongNodes
TIDAL/Spotify token expiry (SettingsPanel reconnect prompt), API keys missing, WebSocket "live updates paused", scraper `circuit_open` on the monitoring page, read-only data during maintenance.

## In the music library
"Only 611 of 1,284 tracks have a key and BPM so far, so sets are shaped on energy alone" on Set builder and Library; next/finished weekly build notices.
