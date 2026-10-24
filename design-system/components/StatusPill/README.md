# StatusPill
The one status vocabulary: seven statuses, each a pill with a glyph and a word, mapped from every backend enum through `SongNodes.status()`.

## When to use
- Health and state of things that run: scraper jobs, scrapers, proxies, enrichment, circuit breakers, connections, save state.
- Don't use for categories (genre, pillar, rotation, source): those are CategoryTag. Don't use for completion; progress bars stay neutral.

## Anatomy and markup
`sn-pill sn-status-pill` with `data-status`. The glyph comes from CSS `::before` (hidden from screen readers with `content: … / ""`, set in mono so ◐ renders); the word is the text.
```html
<span class="sn-pill sn-status-pill" data-status="bad">Paused after errors</span>
```
React: `<StatusPill raw={scraper.status} />` calls `SongNodes.status(raw)` → `{status, label}`.

## Vocabulary
| status | glyph | meaning | example words |
|---|---|---|---|
| `ok` | ● | healthy, done | Healthy, Done, Saved, Normal |
| `fair` | ◐ | acceptable, partial confidence | Medium confidence |
| `warn` | ▲ | needs attention | Degraded, Partly done, Testing, Expired |
| `bad` | ✕ | failed, stopped | Failed, Timed out, Paused after errors, Down |
| `info` | i | neutral fact | Note |
| `running` | ↻ | in progress | Running, In progress, Saving… |
| `idle` | – | not started or off | Queued, Idle, Off, Not tested, Not set up |

## Mapping (backend → design status)
TaskStatus: pending → idle "Queued", running → running, completed → ok "Done", failed → bad, cancelled → idle, timeout → bad "Timed out". ScraperStatus: idle, running, error → bad, disabled → idle "Off", circuit_open → bad "Paused after errors". ProxyStatus: healthy → ok, degraded → warn, failed → bad, untested → idle "Not tested". EnrichmentStatus: pending, in_progress → running, completed, failed, partial → warn "Partly done". CircuitState: closed → ok "Normal", half_open → warn "Testing", open → bad. Health strings: healthy, degraded, unhealthy → bad "Down", not_configured → idle "Not set up". Save: saving → running "Saving…", saved → ok, error → bad. Unknown strings fall back to `info` with the raw text; add them to the map rather than shipping raw enums.

## Variants
Filled (default); `sn-pill--outline` for dense tables and lists of many pills; `sn-status-pill--lg` for the page-level save state.

## Accessibility
Colour is never the only cue: the glyph shape and the word carry the meaning (WCAG 1.4.1). When a status changes live, announce it in one polite live region near the object ("1001tracklists scraper paused after errors"), not by making every pill live.

## Booth theme
Booth uses the same traffic-light hues as dark (ok green, warn amber, bad red), lifted to 7:1 on black. No theme is colour-blind-safe on hue alone, so the glyph and the word are mandatory on every pill in every theme; never refer to statuses by colour in copy ("the red ones").

## Do / don't
- Do keep words short (1–3 words); details go next to the pill.
- Don't invent new colours or glyphs per screen. Map to the seven.

## In SongNodes
Replaces the ✅/❌ emoji in `SettingsPanel.tsx`, the ad hoc badges in `DataQualityReview.tsx` and the status colours in `ui/Badge.tsx`. It is the status column for the planned Pipeline monitoring (scraper jobs, proxies, enrichment).
