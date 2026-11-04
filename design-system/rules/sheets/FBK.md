# FBK rules (generated)

| ID | Rule | Check | Test |
|---|---|---|---|
| FBK-001 | A first-use empty area shall use `EmptyState` stating what the area holds plus one action. | dom | First-use empty region renders EmptyState with description text and exactly one action button. |
| FBK-002 | A no-match result shall use a compact `EmptyState` inside the table box naming the filters that hide everything and offering "Clear filters". | dom | Zero-result table shows compact EmptyState with filter summary and a "Clear filters" button. |
| FBK-003 | First-time loading shall use `LoadingState` with a `.sn-skel` skeleton in the shape of the content. | dom | Loading regions contain `.sn-skel` blocks mirroring final layout (table rows, FigureTiles, chart frame). |
| FBK-004 | Long or staged loading shall use `StagedProgress` with named steps and real progress. | dom | Long loads render StagedProgress with step names and a progress value. |
| FBK-005 | A failed region shall use `ErrorState` and a failed whole page shall use `ErrorPage`, each stating what happened, what to do, and offering Retry. | dom | Failure renders ErrorState/ErrorPage with message, instruction and a Retry button. |
| FBK-006 | A partial failure shall show an `InlineMessage` above the affected content together with the content that did load. | dom | Partial failure shows InlineMessage above loaded content, which remains rendered. |
| FBK-007 | An empty state shall not be blank and shall not be a spinner that never ends. | dom | Empty regions contain visible text and no indefinite `.sn-spinner`. |
| FBK-008 | Errors shall replace only the region that failed, so the rest of the page keeps working. | dom | Simulated region failure leaves other regions rendered and interactive. |
| FBK-009 | Full-page loading overlays shall not be used. | lint | Flag full-viewport overlay elements with loading text. |
| FBK-010 | Inline busy states (button or row action) shall use the control's own `aria-busy` and `.sn-spinner`, with a verb label such as "Saving…". | dom | Busy control has aria-busy="true", contains `.sn-spinner`, and label ends with "…". |
| FBK-011 | `.sn-spinner` shall be the only spinner; custom spinners, a `loading-spinner` class and animated logos shall not be used. | lint | Flag `loading-spinner` class and any `@keyframes` rotation outside `.sn-spinner`. |
| FBK-012 | For an expected wait under 0.1 s, nothing shall be shown. | judgement | Responses under 100 ms show no loading indicator. |
| FBK-013 | For an expected wait of 0.1 to 1 s, no indicator shall appear for the first 300 ms, and a busy button or skeleton shall then be held for at least 500 ms. | dom | Indicator appears at >=300 ms and persists >=500 ms once shown. |
| FBK-014 | For an expected wait of 1 to 10 s, a skeleton or busy button shall be shown with text saying what is happening. | dom | Waits of 1-10 s show skeleton/busy button with descriptive text (e.g. "Building set…"). |
| FBK-015 | For an expected wait over 10 s, `StagedProgress` shall show steps, percentage or count, time so far, and Cancel or "Run in background". | dom | StagedProgress for long waits contains steps, count/percentage, elapsed time and a Cancel or "Run in background" button. |
| FBK-016 | `StagedProgress` shall be used for set build, tracklist import, the weekly run and enrichment jobs. | dom | Those four flows render StagedProgress. |
| FBK-017 | Each `StagedProgress` step shall show done (●), current (↻) or waiting (–). | dom | Step markers are one of ●, ↻, –. |
| FBK-018 | The current `StagedProgress` step shall show a count when known, e.g. "Matching 18 of 42". | dom | Current step text includes "N of M" when total known. |
| FBK-019 | Progress bars shall move only with real progress, and an unknown total shall be described as what is being done and how many so far, not a fake percentage. | judgement | Progress value derives from measured counts; no timer-driven percentage. |
| FBK-020 | Long jobs shall keep running when the person navigates away and shall report the result with a `Toast`. | dom | Navigate away during a job; job continues and a Toast reports the result. |
| FBK-021 | Refreshing data already on screen shall not blank it; old values shall be kept and swapped in place when new ones arrive. | dom | During refresh the existing values stay in the DOM until replaced. |
| FBK-022 | During a refresh a small `.sn-spinner` shall be shown next to the `FreshnessStamp` with the text "Refreshing…". | dom | FreshnessStamp sibling contains `.sn-spinner` and "Refreshing…" during refresh. |
| FBK-023 | If a refresh fails, the old data shall be kept and the `FreshnessStamp` marked warn with a Retry offered (e.g. "▲ Couldn’t refresh, showing 24 Oct, 06:00 AEDT"). | dom | Failed refresh keeps data, stamp carries warn glyph and text, Retry button present. |
| FBK-024 | Good data shall not be replaced with an `ErrorState` when a refresh fails. | dom | Failed refresh does not render ErrorState over existing data. |
| FBK-025 | Live updates (WebSocket) shall patch rows in place and shall not reorder rows under the pointer. | dom | Live update leaves hovered row position unchanged. |
| FBK-026 | Client timeouts shall be 15 s for reads and 30 s for writes, after which the timeout error is shown. | lint | Fetch wrapper uses 15000 ms for GET and 30000 ms for mutating requests. |
| FBK-027 | Background jobs that time out on the server shall report "Timed out". | judgement | Server-timeout job status text reads "Timed out". |
| FBK-028 | Automatic retry shall be limited to idempotent reads failing on network errors or 502-504, up to 3 times with backoff of 1 s, 3 s and 9 s, silently, before showing the error with a Retry button. | lint | Retry helper applies only to GET, max 3 attempts, delays 1000/3000/9000 ms. |
| FBK-029 | Writes shall not be retried automatically. | lint | No automatic retry wrapper around POST/PUT/PATCH/DELETE. |
| FBK-030 | A failed write shall keep the person's input so Retry needs one click. | dom | After a failed write the form values remain and Retry re-submits them. |
| FBK-031 | When offline, the message shall read "You’re offline. Changes are kept on this device and saved when you reconnect." and saving shall retry automatically on reconnect. | dom | Offline state shows that text and flushes pending changes on `online` event. |
| FBK-032 | A request timeout shall show "SongNodes took too long to answer. Try again; if it keeps happening, check Pipeline." with Retry. | dom | Timeout error text and Retry button present. |
| FBK-033 | A 401 expired service token shall show "Your TIDAL connection has expired. Reconnect TIDAL in Settings." with a link to Settings and no Retry. | dom | 401 message names the service, links to Settings, has no Retry button. |
| FBK-034 | A 403 shall show "You can view this set but not change it." with no Retry. | dom | 403 message text matches and no Retry button. |
| FBK-035 | A 404 on a track or set shall show "This set was deleted or moved. Go to Saved sets." with no Retry. | dom | 404 message text matches and links to Saved sets. |
| FBK-036 | A 409 conflict shall show a message offering to reload the latest or keep the person's version and overwrite, with no Retry. | dom | 409 message offers Reload and Overwrite choices. |
| FBK-037 | A 422 validation error shall show a field-level message under the field, e.g. "Length must be between 30 and 360 minutes.", with no Retry. | dom | 422 renders `.sn-field__error` under the field. |
| FBK-038 | A 429 rate limit shall show "Spotify is limiting requests. Try again after 21:45 AEDT." with a Retry allowed only after the time shown. | dom | 429 message names service and time; Retry disabled until that time. |
| FBK-039 | A 500 shall show "Something went wrong saving the set. Your changes are kept; try again." with Technical details. | dom | 500 message text, Technical details disclosure present. |
| FBK-040 | A 502, 503 or 504 shall show "The graph service is unreachable. The rest of SongNodes still works." with Retry. | dom | 5xx gateway message text and Retry button present. |
| FBK-041 | An open scraper circuit shall show "1001tracklists is paused after 5 failed requests. It tries again at 21:45 AEDT." with no person-triggered retry. | dom | Circuit-open message names source, count and next-attempt time; no Retry button. |
| FBK-042 | Partial enrichment shall show "Enriched 38 of 42 tracks. 4 have no match on Beatport." with a list, and Retry for the failed items only. | dom | Partial message includes counts, a list of failures and Retry limited to them. |
| FBK-043 | A page-wide message shall use `Banner`, limited to one per page, with the most severe winning and others collapsing into it (e.g. "and 2 more"). | dom | Page contains at most one Banner; additional messages are aggregated into it. |
| FBK-044 | A message affecting one region, card or form shall use `InlineMessage`, limited to one per region. | dom | Each region contains at most one InlineMessage. |
| FBK-045 | A single-field message shall use `.sn-field__error` or `.sn-field__help`, limited to one per field. | dom | Each field has at most one `.sn-field__error`/`__help`. |
| FBK-046 | A transient confirmation of an action the person took shall use `Toast` with optional Undo, one visible at a time and the rest queued. | dom | At most one `.sn-toast` visible; others queued. |
| FBK-047 | A `Toast` shall stay at least 6 s, or until dismissed when it has an action. | dom | Toast timeout >=6000 ms; no auto-dismiss when it contains an action. |
| FBK-048 | A blocking question about a destructive or irreversible action shall use `ConfirmDialog`, one at a time. | dom | At most one ConfirmDialog open; used for destructive actions. |
| FBK-049 | `alert()`, `confirm()` and `prompt()` shall not be used. | lint | Grep for `\b(alert\|confirm\|prompt)\(` returns no matches. |
| FBK-050 | Messages shall not contain emoji, "Success!", or stacked bullet lists of internals. | lint | Messages match no emoji range, no /Success!/ and no multi-bullet internals list. |
| FBK-051 | A bulk result such as clearing the queue shall be one toast (e.g. "Cleared 37 queued jobs.") with a "Details" `Disclosure` in Pipeline -> Jobs. | judgement | Clear-queue produces one Toast; details live in a Disclosure on Pipeline Jobs. |
| FBK-052 | Toggle, filter, sort and slot reorder shall confirm through the change itself, with no message. | dom | These actions produce no Toast or message. |
| FBK-053 | Add to set and lock slot shall update the row and header count, with no toast. | dom | These actions produce no Toast; row and count update. |
| FBK-054 | Save set, import tracklist and send to TIDAL shall confirm with a `Toast` (e.g. "Saved “Peak time Friday”.", "Sent 24 tracks to TIDAL. 2 had no TIDAL ID."). | dom | Those actions produce a Toast naming the object and counts. |
| FBK-055 | A finished long background job shall show a `Toast` and update the `FreshnessStamp`. | dom | Job completion shows Toast and updates FreshnessStamp. |
| FBK-056 | Settings saved shall confirm with an `InlineMessage` next to the save button for 6 s, or autosave with a "Saved" `StatusPill`. | dom | Settings save shows InlineMessage for 6 s or a "Saved" StatusPill. |
| FBK-057 | Reversible removal (remove from set, archive target track, clear a slot) shall act immediately with no dialog and offer Undo in a `Toast` for at least 10 s. | dom | Reversible removal shows no dialog; Toast with Undo persists >=10000 ms. |
| FBK-058 | A low-stakes single-item delete inside a working view shall use an armed `Button` that turns `danger` with "Click again to delete" on first click and resets after 4 s. | dom | First click sets danger style and label; reverts after 4000 ms. |
| FBK-059 | Irreversible or wide-reaching actions shall use `ConfirmDialog` with the object name and count in the title and the consequence in the body. | dom | ConfirmDialog title contains object name/count; body states consequence. |
| FBK-060 | A `ConfirmDialog` shall have a `.sn-btn--danger` button repeating the verb, with Cancel focused by default. | dom | ConfirmDialog contains `.sn-btn--danger` with the action verb; Cancel has initial focus. |
| FBK-061 | Bulk actions shall state the count (e.g. "Archive 12 target tracks?"). | dom | Bulk-action prompts include the item count. |
| FBK-062 | `FreshnessStamp` shall sit under the `PageHeader` title or at the top right of the region it qualifies. | dom | FreshnessStamp is a child of PageHeader below the title or top-right of its region. |
| FBK-063 | Relative time (e.g. "3 h ago") in a stamp shall be accompanied by the absolute stamp in a `Tooltip`. | dom | Relative-time stamp has a Tooltip containing the absolute time. |
| FBK-064 | Music library freshness shall be fresh at <= 8 d, stale (warn ▲) above 8 d, and very stale (bad ✕) above 15 d. | lint | Threshold function returns fresh <=8 d, warn >8 d, bad >15 d. |
| FBK-065 | Radio plays and ARIA Club Chart freshness shall be fresh at <= 8 d, stale above 8 d, and very stale above 15 d. | lint | Threshold function returns fresh <=8 d, warn >8 d, bad >15 d. |
| FBK-066 | Scrape jobs and scraper status freshness shall be fresh at <= 1 h, stale above 1 h, and very stale above 6 h. | lint | Threshold function returns fresh <=1 h, warn >1 h, bad >6 h. |
| FBK-067 | Live graph (WebSocket) freshness shall be fresh within 60 s of the last message or heartbeat, stale above 60 s, and very stale when the connection is closed. | lint | Threshold function returns fresh <=60 s, warn >60 s, bad on closed. |
| FBK-068 | Service connection (Spotify, TIDAL token) shall be fresh when valid, stale when expiring in under 24 h, and very stale when expired. | lint | Token status: valid -> fresh, <24 h -> warn, expired -> bad. |
| FBK-069 | Audio analysis per track shall not show staleness. | dom | Audio analysis has no stale/very stale state. |
| FBK-070 | Stale data shall be a warning on the stamp, not a `Banner`, unless the page's main data is very stale. | dom | Stale (warn) state renders on FreshnessStamp only; Banner appears only when main data is very stale. |
| FBK-071 | Simulated or preview data shall not show a freshness stamp and shall show "Preview" instead. | dom | Preview data renders "Preview" and no FreshnessStamp. |
| FBK-072 | `ConnectionStatus` in the `AppHeader` shall show only when something is wrong ("▲ Reconnecting…" or "✕ Offline") and otherwise be empty. | dom | ConnectionStatus is empty when connected; shows glyph+text otherwise. |
| FBK-073 | Connection messages shall name the unreachable source (e.g. "Can’t reach TIDAL") and shall not say "A service is unavailable". | lint | Connection error copy contains a source name; flag /A service is unavailable/. |
| FBK-074 | `ServiceStatus` on `MonitoringPage` and `SettingsPage` shall list each source with its `StatusPill` (Healthy, Degraded, Down, Paused after errors, Not set up), last success stamp and next attempt. | dom | ServiceStatus rows each have StatusPill with one of five labels, last-success stamp and next attempt. |
| FBK-075 | When a source is down, everything that does not depend on it shall keep working, and dependent features shall be disabled with the reason. | dom | Simulated source outage leaves independent features operable and disables dependent ones with a reason. |
