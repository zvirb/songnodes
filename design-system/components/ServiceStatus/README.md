# ServiceStatus
One row per connected music service (Spotify, TIDAL, Beatport) showing its connection state, account and expiry, and the one action that fixes it.

## When to use
- Services settings, onboarding, and anywhere an action depends on a connection ("Send to TIDAL").
- Don't use for scraper or data-source health (StatusPill in Pipeline) or for where a track was heard (SourceBadge).

## Anatomy and markup
`section.sn-service-status` (grid: mark, main, action) → `__mark` (neutral initials, or the official logo asset), `__main` (`__name` + StatusPill, `__detail`), `__act`.
```html
<section class="sn-service-status" aria-label="TIDAL connection">
  <span class="sn-service-status__mark" aria-hidden="true">Ti</span>
  <div class="sn-service-status__main">
    <div class="sn-service-status__name">TIDAL <span class="sn-pill sn-status-pill" data-status="warn">Expired</span></div>
    <div class="sn-service-status__detail">Sign-in expired 21 Oct 2026, 06:00 AEDT. Sunday's “Send to TIDAL” run will skip until you reconnect.</div>
  </div>
  <div class="sn-service-status__act"><button class="sn-btn sn-btn--sm sn-service-status__btn--tidal" type="button">Reconnect TIDAL</button></div>
</section>
```

## States
| state | pill | detail | action |
|---|---|---|---|
| Connected | ok "Connected" | account, expiry stamp | quiet "Disconnect" |
| Expired | warn "Expired" | when it expired, what stops working | "Reconnect TIDAL" (service colour) |
| Not connected | idle "Not connected" | what connecting enables | "Connect Beatport" |
| Error | bad "Error" | what happened, when it retries, whether to act | "Reconnect Spotify" (service colour) |

## Visual rules
Service colours (`svc-spotify`, `svc-tidal` and their `on-` pairs) appear only on Connect and Reconnect buttons (`__btn--spotify`, `__btn--tidal`). Beatport has no token, so it uses a secondary button. State is never shown by brand colour.

## Accessibility
Each row is a labelled section. Buttons name the service ("Reconnect TIDAL"). When OAuth returns, move focus to the row and announce the new state politely.

## Responsive
Below 600px the action moves under the text at full width.

## In SongNodes
Replaces the connect blocks in `SettingsPanel.tsx` (the 🎵 icon, "TIDAL - CONNECTED ✓" and the `alert()` messages) and the connection notes in `TidalPlaylistManager.tsx` and `SpotifyPlaylistManager.tsx`.
