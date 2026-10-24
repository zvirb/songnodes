# MonitoringPage

The planned SongNodes Pipeline health page: answers "is anything broken right now" with one banner, live connection state, headline figures, scraper and proxy health, the running enrichment job, the review queue and recent errors with what to do.

## Scope (decided)
Full pipeline health on one page: scrapers, jobs, proxies, enrichment, the review queue and recent errors. Not a scraper-only page; graph metrics and history stay elsewhere.

## When to use
- Use this page to check the pipeline at a glance (`/pipeline`, admin only). Graph stats reuse the layout.
- Not for metrics history (Grafana, linked with `.sn-link--ext`) or a full job list (LogPage `/pipeline/jobs`).

## Anatomy
| Region | Component |
|---|---|
| Shell | `AppHeader` ("Pipeline: Health", "Checked just now"); drawer Pipeline row carries a bad pill "1" |
| Header | `PageHeader` with stamp "Checked …" and `ConnectionStatus` "Live"; secondary Test proxies; More actions: Pause all scrapers, Export health as CSV; primary **Run scrapers now** (busy "Starting…") |
| Problems first | One `Banner` (`bad`): "1001tracklists paused after errors. … Retries at 21:45 AEDT" + "See the errors". Severity budget: at most one bad banner; other incidents collapse into it ("and 2 more") |
| Figures | `FigureTile` × 4: Jobs today, Failed today (bad pill + "Show these"), Queue length, Proxies healthy "9 of 12" (warn pill) |
| Scrapers | `DataTable --stack`: name + kind, `StatusPill` via `SongNodes.status` (idle, running, error, disabled → Off, circuit_open → Paused after errors), last success `FreshnessStamp` (▲ after 1 h), `Sparkline` hourly success rate with latest %, jobs today, next run, row `OverflowMenu` (Run now disabled with its reason while paused). Rows in error carry `data-flag` |
| Enrichment | `Card` (Pipeline) + `StagedProgress`: steps (finished steps green `status-ok` "● Done · 6:02"), elapsed, estimate, meter on the running step |
| Proxies | `Card --list`: name + region, `StatusPill --outline` (healthy, degraded, failed, untested → Not tested), latency |
| Review queue | `Card` + `Checklist` summary and rows with counts; `TextLink` "Open review queue" |
| Errors | `ErrorState` for the newest error that needs the person (auth: "Retrying won't help until the key is renewed" + Services module button + reference), then a compact table of the last 24 h |
| Footer | `.sn-page-monitor__foot`: Grafana and API reference external links |

## Data
`MonitoringPageProps` in `61-pages-b.d.ts`; WebSocket patches rows in place.

## States
- First load: tile and table skeletons; StagedProgress appears only when a run exists.
- Live updates: values patch in place, rows never reorder under the pointer; status changes announced in one polite region.
- Reconnecting/offline: `ConnectionStatus` changes; stamp shows the age; nothing is blanked.
- Empty: no runs → enrichment card shows "No run in progress. Next run 22:00."; no errors → "No errors in the last 24 h."
- Error: one region failing (e.g. proxies) shows `ErrorState` in that card only.

## Responsive
Phone: actions fold into More actions with the primary full width; scrapers become cards; grids stack. Tablet: two-column grids wrap. Desktop/wide: as shown. Wall: suitable as an operations wall: keep live updates on, no animation, booth theme for distance (larger type and 7:1 text; statuses keep the same traffic-light hues as dark, so the glyph and word on every pill carry the meaning).

## Primary action
Run scrapers now.

## Replaces
The planned monitoring dashboard ("Recently scraped data", pipeline progress, scraper health), `clearQueue` `alert()` flows in `DJInterface.tsx`, and checking Grafana for basic health.
