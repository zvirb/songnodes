# ErrorState

Explains a failed load in a panel: what happened, what it affects, whether retrying will help, and the one action that fixes it, keeping the last good data visible when there is some.

## When to use
- A panel, tab or page could not load or save its data.
- Not for page-wide conditions that persist (use Banner), field errors (use `sn-field__error` / InlineMessage), or confirmations (Toast). Never use a Toast for an error that needs action.

## Anatomy
```html
<section class="sn-error-state" data-status="warn" aria-labelledby="e1">
  <div class="sn-error-state__icon"><svg class="sn-icon">…timer…</svg></div>
  <h3 class="sn-error-state__title" id="e1">TIDAL is slow right now</h3>
  <div class="sn-error-state__text">TIDAL took longer than 20 s to send your playlists.</div>
  <p class="sn-error-state__retry">Retrying usually works within a minute.</p>
  <div class="sn-error-state__actions"><button class="sn-btn">Retry</button></div>
  <div class="sn-error-state__last"><div class="sn-error-state__stamp">Showing playlists from <time>24 Oct 2026, 06:00 AEDT</time></div>…last data…</div>
</section>
```
`sn-error-state--panel` drops the card frame when the error fills a panel.

## Variants
| Cause | Icon · status | Title | Retry hint (`__retry`) | Action |
|---|---|---|---|---|
| Offline | wifi-off · warn | "You’re offline" | "Retry once you’re back online." | Retry |
| Timeout | timer · warn | "TIDAL is slow right now" | "Retrying usually works within a minute." | Retry |
| Auth expired | plug · warn | "Your TIDAL connection has expired" | `data-helps="no"` "Retrying won’t help until you reconnect." | Reconnect TIDAL (module button) |
| Not found | scan-search · info | "This set was deleted" (+ when) | `data-helps="no"` | Link back to the list |
| Server 5xx | server · bad | "SongNodes couldn’t load the graph" | "Try again in a few minutes…" | Try again + copyable `__ref` reference ID |
| Validation | circle-alert · bad | "Fix 2 fields to save the set" | – | `__fields` list linking to each field |
| Stalled staged load (1.4.0) | timer · warn | Names the step: "Looking up key and BPM stopped" | "Try again carries on from track 1,205; the 1,204 already looked up are kept." | Try again (resumes from that step) |

## Stalled loads (1.4.0, imported from BeanAlliance AsyncState v4.15)
- A staged load (StagedProgress) is never failed by elapsed time. It stops only when the current step sends **no progress for 60 s**; that is shown first as the step's `stalled` state inside StagedProgress, with the done steps kept as evidence.
- Use the ErrorState *Stalled* variant only where the region cannot keep its step list (a compact card, a tile): it is `warn`, the title names the stalled step, the text says what was kept, and **Try again** resumes from that step, never from the start.
- A single request (not a staged load) keeps the 15 s read / 30 s write timeout and the *Timeout* variant.
- A refresh that fails never becomes an ErrorState while data is on screen: the data stays and the `FreshnessStamp` turns ▲ ("Couldn’t refresh, showing 24 Oct, 06:00 AEDT") with Retry (07-feedback-status).

## Content rules
Say what happened, what is safe, what to do next. No apologies, no "Oops", no exclamation marks, no raw codes as the title (the code goes in the text or reference). Reference IDs in `data-s` mono: "ref 7f3a-92c1".

## Accessibility
- After a person's action fails, focus the title (`tabindex="-1"`) or announce via `role="alert"` once; on passive loads, no interruption.
- Retry button keeps its width while busy (`aria-busy`, "Retrying…").
- Copy reference: button says "Copy", then "Copied" for 2 s.
- Colour is backed by icon shape and the title text; status colour only on the icon circle.

## Responsive
Icon beside text from tablet up; stacked above on phones. Last-good table scrolls inside its `sn-tablebox`.

## Do / don't
- Do keep and label stale data ("Showing playlists from …") rather than replacing it with an error.
- Don't offer Retry when it cannot help.

## In SongNodes
Replaces `showError(...)` / `toast.error` messages in SetlistBuilder ("Failed to export setlist"), MusicServiceSearch's "No results found. Check your API keys in Settings." (becomes auth-expired/not-connected), and the nginx 404/50x pages (not-found and server variants as full pages). Covers WebSocket disconnects (offline) and scraper `timeout`/`circuit_open`.

## In the music library
TIDAL/Deezer/Beatport link checks timing out, the weekly build failing to fetch a station, validation of set controls (length, genre-mix weights).
