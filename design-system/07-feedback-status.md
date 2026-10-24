# Feedback and status

How the interface says "nothing here", "working on it", "done" and "that went wrong", and how it shows whether data is fresh and sources are reachable. One idiom per situation; never invent a new one.

## Empty, loading and error states

| State | Component | Content |
|---|---|---|
| Nothing yet (first use) | `EmptyState` | What this area holds + one action: "No saved sets yet. Build a set from the library and save it here." → "Build a set" |
| Nothing matches | `EmptyState` (compact, inside the table box) | The filters that hide everything + "Clear filters" |
| Loading, first time | `LoadingState` | Skeleton (`.sn-skel`) in the shape of the content: table rows, `FigureTile`s, chart frame |
| Loading, long or staged | `StagedProgress` | Named steps and real progress |
| Failed | `ErrorState` (region) or `ErrorPage` (whole page) | What happened, what to do, Retry |
| Partly failed | `InlineMessage` above the affected content + the content that did load | "Spotify data didn’t load. BPM and key from SongNodes are shown." |

- An empty state is never blank and never a spinner that never ends.
- Errors replace only the region that failed. The rest of the page keeps working.

## The one loading idiom

- First load of a region: skeleton in the shape of the final content (`LoadingState`). No full-page overlays ("Loading DJ Interface..." in `App.tsx` and "Loading your music library..." in `DJInterface.tsx` become skeletons).
- Inline busy (a button or a row action): the button's own `aria-busy` + `.sn-spinner`, label "Saving…".
- `.sn-spinner` is the only spinner. No custom spinners, no `loading-spinner` class, no animated logos.
- Timing, from NN/g response-time limits:

| Expected wait | Show |
|---|---|
| under 0.1 s | Nothing; the result is the feedback |
| 0.1–1 s | Nothing for the first 300 ms; then the busy button or skeleton, held for at least 500 ms so it doesn't flash |
| 1–10 s | Skeleton or busy button; text says what is happening ("Building set…") |
| over 10 s | `StagedProgress` with steps, percentage or count, time so far, and Cancel or "Run in background" |

## Long and staged loads

- Use `StagedProgress` for the set build ("Filtering crate → Scoring transitions → Ordering slots"), tracklist import ("Parsing → Matching 42 tracks → Saving"), the weekly run and enrichment jobs.
- Each step shows done ●, current ↻ or waiting –, and the current step shows a count when known: "Matching 18 of 42".
- Progress bars move only with real progress (08-motion). If the total is unknown, say what is being done and how many so far, not a fake percentage.
- Long jobs survive navigation: leave the page, the job keeps running, a `Toast` reports the result.

## Refresh versus first load

- Refreshing data that is already on screen never blanks it. Keep the old values, show a small `.sn-spinner` next to the `FreshnessStamp` ("Refreshing…") and swap values in place when they arrive.
- If a refresh fails, keep the old data, mark the stamp warn ("▲ Couldn’t refresh, showing 24 Oct, 06:00 AEDT") and offer Retry. Do not replace good data with an `ErrorState`.
- Live updates (WebSocket) patch rows in place and never reorder rows under the pointer (08-motion).

## Timeouts, retries and specific errors

- Client timeout: 15 s for reads, 30 s for writes, then show the timeout error. Background jobs have their own server timeouts and report "Timed out".
- Retry automatically only for idempotent reads on network errors and 502–504: up to 3 times with backoff 1 s, 3 s, 9 s, silently. After that, show the error with a Retry button.
- Never retry writes automatically. Keep the person's input so Retry needs one click.

| Error | Message | Retry helps? |
|---|---|---|
| Offline | "You’re offline. Changes are kept on this device and saved when you reconnect." | Yes, automatically on reconnect |
| Request timed out | "SongNodes took too long to answer. Try again; if it keeps happening, check Pipeline." | Yes |
| 401 service token expired | "Your TIDAL connection has expired. Reconnect TIDAL in Settings." | No; link to Settings |
| 403 | "You can view this set but not change it." | No |
| 404 track or set | "This set was deleted or moved. Go to Saved sets." | No |
| 409 conflict | "“Peak time Friday” changed on another device. Reload to see the latest, or keep yours and overwrite." | No; choose |
| 422 validation | Field-level message under the field: "Length must be between 30 and 360 minutes." | No; fix the field |
| 429 rate limited | "Spotify is limiting requests. Try again after 21:45 AEDT." | Yes, after the time shown |
| 500 | "Something went wrong saving the set. Your changes are kept; try again." + Technical details | Sometimes |
| 502, 503, 504 | "The graph service is unreachable. The rest of SongNodes still works." | Yes |
| Scraper circuit open | "1001tracklists is paused after 5 failed requests. It tries again at 21:45 AEDT." | Not by the person; wait |
| Partial enrichment | "Enriched 38 of 42 tracks. 4 have no match on Beatport." + list | For the 4 only |

## Message types and limits

| Type | Component | Use | Limit |
|---|---|---|---|
| Page message | `Banner` | Affects the whole page: offline, service down, view only, retired page | 1 per page; the most severe wins, others collapse into it ("and 2 more") |
| Inline message | `InlineMessage` | Affects one region, card or form | 1 per region |
| Field message | `.sn-field__error` / `__help` | One field | 1 per field |
| Transient confirmation | `Toast` | Result of an action the person took; optional Undo | 1 visible at a time; queue the rest; at least 6 s, or until dismissed when it has an action (today `useToast` uses 3 s) |
| Blocking question | `ConfirmDialog` | Destructive or irreversible action | 1 |

- Never `alert()`, `confirm()` or `prompt()` (`DJInterface.tsx` `clearQueue`).
- Messages never contain emoji, "Success!", or stacked bullet lists of internals. The clear-queue result becomes one toast: "Cleared 37 queued jobs." with a "Details" `Disclosure` in Pipeline → Jobs.

## Success confirmation is proportional

| Action | Confirmation |
|---|---|
| Toggle, filter, sort, reorder a slot | The change itself; no message |
| Add to set, lock slot | The row updates; count in the header updates; no toast |
| Save set, import tracklist, send to TIDAL | `Toast`: "Saved “Peak time Friday”." / "Sent 24 tracks to TIDAL. 2 had no TIDAL ID." |
| Long background job finished | `Toast` + `FreshnessStamp` update |
| Settings saved | `InlineMessage` next to the save button for 6 s, or autosave with "Saved" `StatusPill` |

## Destructive actions

- Reversible removal (remove from set, archive target track, clear a slot): do it immediately and offer Undo in a `Toast` for at least 10 s. No dialog.
- Low-stakes single-item delete inside a working view: an armed `Button` (first click turns it `danger` with "Click again to delete", resets after 4 s).
- Irreversible or wide-reaching actions (delete a saved set, clear the scraping queue, revoke an API key, overwrite a TIDAL playlist): `ConfirmDialog` with the object name and count in the title, the consequence in the body, a `.sn-btn--danger` button repeating the verb, Cancel focused by default.
- Bulk actions state the count: "Archive 12 target tracks?"

## Data freshness

`FreshnessStamp` sits under the `PageHeader` title or at the top right of the region it qualifies: "Library as of 24 Oct 2026, 06:00 AEDT". Relative time ("3 h ago") is allowed with the absolute stamp in a `Tooltip`.

| Data | Fresh | Stale (warn ▲) | Very stale (bad ✕) |
|---|---|---|---|
| Music library (weekly run) | ≤ 8 d | > 8 d | > 15 d (two runs missed) |
| Radio plays, ARIA Club Chart | ≤ 8 d | > 8 d | > 15 d |
| Scrape jobs and scraper status | ≤ 1 h | > 1 h | > 6 h |
| Live graph (WebSocket) | ≤ 60 s since last message or heartbeat | > 60 s | connection closed |
| Service connection (Spotify, TIDAL token) | valid | expires in < 24 h | expired |
| Audio analysis per track | any age (static) | – | – |

- Stale is a warning on the stamp, not a `Banner`, unless the page's main data is very stale.
- Simulated or preview data never shows a freshness stamp; it shows "Preview" (03-colour).

## Connection and source status

- `ConnectionStatus` in the `AppHeader` shows only when something is wrong: "● Live" is implied, so the header shows "▲ Reconnecting…" or "✕ Offline" and is otherwise empty.
- Name the source that is unreachable: "Can’t reach TIDAL", "Graph updates paused: live connection lost", "MusicBrainz is slow (8 s)". Never "A service is unavailable".
- `ServiceStatus` lists each source on `MonitoringPage` and `SettingsPage` with its `StatusPill` (Healthy, Degraded, Down, Paused after errors, Not set up), last success stamp and next attempt.
- When a source is down, everything that does not depend on it keeps working, and features that do are disabled with the reason (02-information-architecture, permissions).
