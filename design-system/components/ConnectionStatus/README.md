# ConnectionStatus
Shows whether live updates (the WebSocket) are flowing: Live, Reconnecting (with the attempt), Offline (with the age of the data on screen), or a named source unreachable.

## When to use
- Compact form at the right of the app header whenever a page shows live data (graph, Play mode, pipeline monitoring).
- Banner form below the header when people need to know their view is frozen or a source is down.
- Don't use for scheduled data age (FreshnessStamp) or service sign-ins (ServiceStatus).

## Anatomy and markup
Compact: `sn-connection-status[data-state]` with a glyph (● live, ↻ reconnecting, ✕ offline, ▲ partial), words, optional `__sub`.
Banner: `sn-connection-status-banner[data-state]` → `__msg` (bold state + what it means) + one action (Retry now, or a link to Pipeline).
```html
<span class="sn-connection-status" data-state="reconnecting" role="status">Reconnecting <span class="sn-connection-status__sub">attempt 2</span></span>
<div class="sn-connection-status-banner" data-state="offline" role="status">
  <span class="sn-connection-status-banner__msg"><b>Offline.</b> Showing data from 24 Oct 2026, 21:30 AEDT. …</span>
  <button class="sn-btn sn-btn--sm" type="button">Retry now</button>
</div>
```

## States
| state | glyph / colour | compact words | banner |
|---|---|---|---|
| live | ● ok | Live | none |
| reconnecting | ↻ warn | Reconnecting · attempt 2 | after 2 failed attempts: attempt N of 5, next try in 8 s |
| offline | ✕ bad | Offline · data from 21:30 | what is shown, that edits are kept, Retry now |
| partial | ▲ warn | 1001tracklists unreachable | what paused, what carries on, Open Pipeline |

## Accessibility
`role="status"` (polite). Announce each state change once, not every retry; update the attempt count without re-announcing. The ↻ glyph is static; no spinning.

## Responsive
The compact form drops `__sub` below 480px (keep it in `title`). The banner wraps, with its action under the text on phones.

## In SongNodes
Replaces the connection text in `LiveDataLoader.tsx` and the WebSocket status in `PerformanceMonitor.tsx`; used by the planned monitoring dashboard.
