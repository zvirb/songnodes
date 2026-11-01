# Banner

A persistent page-level message under the page header about a condition that affects the whole page, with at most one action, a dismiss, and, for a warning, a link to where its cause is changed.

## When to use
- A condition that persists and changes how the page behaves: incomplete data ("Sets are shaped on energy alone"), a disconnected service, an upcoming weekly build, a finished build.
- Not for one panel's load failure (ErrorState), a field or row (InlineMessage), or a completed action (Toast).
- **At most one banner per page.** If two conditions apply, show the most severe; the other waits.

## Anatomy
```html
<div class="sn-banner" data-status="warn" role="status">
  <span class="sn-banner__icon"><svg class="sn-icon">…triangle-alert…</svg></span>
  <div class="sn-banner__body">
    <p class="sn-banner__content"><span class="sn-banner__title">Sets are shaped on energy alone.</span> Only 611 of 1,284 tracks have a key and BPM so far.
      <a class="sn-link sn-link--src sn-m-harmony" href="/harmony?missing=key" target="_blank" rel="noopener"><span class="sn-go sn-m-harmony" aria-hidden="true">…piano 84% + external-link badge…</span>Add keys in Key &amp; mood<span class="sn-sr"> (opens in a new tab)</span></a></p>
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
| `bad` | circle-x | yes; comes back when the blocked action is tried again (1.6.0) | "TIDAL is disconnected. Sets can’t be sent on Saturday’s weekly run until you reconnect." + Reconnect TIDAL |
| `ok` | circle-check | yes | "This week’s build is in. 48 new tracks and 12 new edges were added." |
Fill `status-*-bg`, border a 45% mix of the status colour, text `fg`; the status colour appears only on the icon. Info uses `surface-2`.

## Content rules
Bold first sentence states the condition; second sentence gives the number or consequence; a warning's last words are its source link (below). Action is verb + object. No "Warning:" prefix (the icon says it). A note that only explains is not a banner: it is an `InfoTip` (1.6.0).

## Every warning links to its source (1.6.0, imported from BeanAlliance v4.19)

- **Who it covers:** every `warn` and `bad` banner, every warn or bad `InlineMessage`, a stale `FreshnessStamp`'s phrase, a flagged row's reason, and an `ErrorState` whose cause is missing or wrong data (a track not in the library, a set that was deleted). Info and ok banners are not warnings and carry none.
- **One link, last in the sentence:** fact, consequence, then the link (`a.sn-link.sn-link--src`). It names the page and, where there is one, the place on it: "Add keys in Key & mood", "Open Settings · Streaming services", "Open the set in Set builder". Never "Click here", "Details" or a bare icon.
- **To the exact place:** the route opens at the record, tab, filter or field (`/settings/streaming-services`, `/library?filter=no-key`, `/tracks/123?tab=analysis`), using what the target already reads from its URL.
- **Another page opens in a new tab** (DR-052), so the page with the warning keeps its place, and the link is **led by that page's go icon**: its module icon at 84% with a half-size `external-link` badge, both in the module's colour (`SongNodes.goIcon`, `SongNodes.sourceLink`; 14-identity-icons). The link's words are in the same module colour (DR-009). A place on **this** page is a same-page link that scrolls to the control and focuses it, with no icon.
- **Fixed here in one step:** when the banner's own button fixes the cause where the person is ("Reconnect TIDAL", "Try again"), that button is the action and no source link is added.
- **A source outside SongNodes** (Spotify, TIDAL, Beatport, a radio station's playlist): the link goes to the page where that data comes in or is connected, and the sentence names the outside service: "Fix the match on Beatport, then run enrichment again. Open Sources · Enrichment".
- **No page to change it is a gap, not a dead link.** Never `href="#"`. Until a page exists the sentence names who can change it, and the gap goes on the open questions list (17-governance).
- Source links never sit on `surface-2`: in dark, module link text on `surface-2` falls below 4.5:1 for some modules (Pathfinder 4.02:1). Warn and bad grounds (`status-*-bg`) hold 4.5:1 for every module in every theme.

## Dismiss (1.6.0, imported from BeanAlliance v4.19 and v4.19.1)

- **Every banner can be dismissed,** `bad` included: the `x` button at the top right, `aria-label="Dismiss: <the fact in a few words>"`.
- **A dismissed warning shrinks to its status icon in place.** A warn or bad banner is replaced, where it stood, by one `button.sn-dismissed` with its own icon (`triangle-alert` in `status-warn`, `circle-x` in `status-bad`), `aria-label` and `title` "Show warning: <the fact in a few words>", `aria-expanded="false"`. Icon only, no word: the shape and the name carry it. Pressing it shows the warning in full again and clears the dismissal. Focus moves to it on dismiss, so a keyboard user knows where the warning went. Nothing else moves.
- **Info and ok banners** go entirely when dismissed (they are not warnings, DR-053), until their fact changes ("This week's build is in" returns for next week's build).
- **How long:** until the **next calendar day** in Melbourne (DR-051) or until the fact changes, whichever comes first. Kept on this device per page and fact key (`SongNodes.dismissal`, key `sn-dismiss:<page>:<fact key>`, the fact key including its value so a newer stale date or one more failing source shows again at once). If storage is unavailable the warning simply shows again.
- **A bad banner comes back when it matters:** dismissing "TIDAL is disconnected" shrinks it to its icon until the person tries the blocked action again (Send to TIDAL shows it in full at once).
- Dismissing never changes data, never hides the warning from anyone else, and is not an acknowledgement: nothing is recorded.
- Never dismissable: a `LoadingState` or `StagedProgress`, an `ErrorState` that stands in for a region's data (it is the region), a `ConfirmDialog` (it has its own Cancel).

## Accessibility
- Present on page load: no live role needed. Inserted later: `role="status"` (info/warn/ok) or `role="alert"` (bad).
- Dismiss button names what it dismisses. After dismissing a warning, focus moves to its `.sn-dismissed` icon; after dismissing an info or ok banner, to the page heading.
- The go icon is decorative (`aria-hidden`); the link says "(opens in a new tab)" to screen readers. The go icon holds 3:1 on every ground in every theme.

## Responsive
Actions wrap under the text on narrow widths; the dismiss stays top-right; a source link wraps with the sentence, its go icon kept with its first word. Full width of the content column at every breakpoint.

## Do / don't
- Do remove the banner automatically once the condition is fixed.
- Do end every warning with where to fix it.
- Don't stack banners or use them for marketing or tips.

## In SongNodes
TIDAL/Spotify token expiry (SettingsPanel reconnect prompt), API keys missing, WebSocket "live updates paused", scraper `circuit_open` on the monitoring page, read-only data during maintenance.

## In the music library
"Only 611 of 1,284 tracks have a key and BPM so far, so sets are shaped on energy alone" on Set builder and Library; next/finished weekly build notices.
