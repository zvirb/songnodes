# WorkQueue
The tracker for work packages: one row per package with its code, one-job title, state, owner and the next step, so a person can see what is open, blocked or done without reading STATUS.md.

## When to use
- The work queue page, wave views (W1 to W6) and any list of packages that move through proposed, in progress, in review and merged.
- Don't use for scrape or run progress (StagedProgress) or for a to-do list people tick (checkboxes).

## Anatomy and markup
Composed from existing parts, with no new classes: `SectionHeading` per wave, `Checklist` summary for counts, then a `DataTable` (code, package, state as `StatusPill`, depends on, next step).
```html
<table class="sn-table">
  <caption class="sn-sr">Wave W6 work packages</caption>
  <thead><tr><th scope="col">Code</th><th scope="col">Package</th><th scope="col">State</th><th scope="col">Depends on</th></tr></thead>
  <tbody>
    <tr><td class="sn-mono">UX-T04</td><td>Build the Buy list page</td><td><span class="sn-pill sn-status-pill" data-status="info">In review</span></td><td class="sn-mono">UX-T09</td></tr>
  </tbody>
</table>
```

## States
| state | pill | meaning |
|---|---|---|
| Proposed | idle | nothing built or queued |
| In progress | running | a branch exists |
| In review | info | a pull request is open |
| Blocked | warn | a dependency or a failing check, named in the next step |
| Merged | ok | on main |

## Content rules
Package titles are one verb and one object, sentence case. A blocked row says what blocks it. Empty cells show an en dash. Counts read "2 merged · 1 in review", leaving out zero counts.

## Accessibility
State is a word as well as a pill colour. The table has a caption and column headers with `scope`.

## In SongNodes
Replaces reading the slots in STATUS.md by hand. Pages that show it follow the LogPage pattern.

## Queue monitor
A page that watches a work queue as a whole: one square tile per task, grouped by folder or area, with charts of rows added and completed per hour, rolling 24-hour rates, rows still to do, rows queued per day by origin, a finish estimate three ways, which folders a run is working in (from its locks), and a searchable table of every row. The table above stays the form for reading packages one by one; the monitor is for seeing the queue at a glance. Rules WKQ-001 to WKQ-010.

**Consumer provides:** the queue rows (id, title, state, origin, folder or area, added and completed times), the lock and claim files, and the page's theme through `SongNodes.prefs`.

### Colours
All ten are aliases of existing tokens, so they follow dark, light and booth with no value of their own.

| token | alias of | used for |
|---|---|---|
| `queue-done` | `status-ok` | tile fill, task complete |
| `queue-ready` | `status-warn` | tile fill, ready for a run to pick up |
| `queue-running` | `fg` | tile fill, claimed by a run (In progress); the inverse of the page |
| `queue-waiting` | `line-strong` | dashed `stroke-mark` edge of a waiting tile, which is otherwise `surface-1` |
| `queue-tile-ink` | `surface-1` | the origin letter on a solid tile |
| `origin-original` | `fg-2` | bottom edge and chart fill, original plan; neutral on purpose, no letter |
| `origin-split` | `chart-1` | split off a task that needed another run; letter S |
| `origin-followup` | `chart-2` | follow-up added by a run; letter F |
| `origin-planner` | `chart-3` | added by the planner; letter P |
| `origin-chat` | `chart-4` | added from a chat session; letter C |

### Anatomy
- **Group card** (`Card`): the folder or area as a `SectionHeading`, "12 done · 30 live" in `data`, a stacked bar in the state colours (done, running, ready, waiting), then the tiles in id order.
- **Tile**: a square of `control-sm` with `radius-chip`; fill by state, a 4px bottom edge by origin, and the origin letter centred in `data-strong`. A waiting tile is `surface-1` with a dashed edge and its letter in `fg-2`.
- **Legend**: every state and every origin in words beside its swatch, once per page.
- **Charts** (`ChartFrame`): rows added per hour above the zero line and rows completed below it, coloured by origin; rows still to do; rows queued per day by origin.
- **Finish estimate**: three figures side by side (all rows, without one-off batches, completions only), each a date or "No finish date at this pace".
- **Running now**: the folders a run holds, read from the lock and claim files.
- **All rows**: a `SearchField` and a `DataTable` with the state as a `StatusPill`.

### Rules
- **WKQ-001** One tile per live task; retired tasks and split parents get no tile and are left out of every total.
- **WKQ-002** The tile's fill is its state: `queue-done`, `queue-ready` and `queue-running` solid; a waiting tile is the card surface with a dashed `queue-waiting` edge.
- **WKQ-003** A tile's 4px bottom edge is its origin (`origin-*`); split, follow-up, planner and chat tiles also carry the letter S, F, P or C in `queue-tile-ink` (on a waiting tile, `fg-2`).
- **WKQ-004** State is never colour alone: hover, focus or select shows the id, state word and title; the legend names every state and origin.
- **WKQ-005** Tiles are grouped by folder or area, each group a card with a done and live count and a stacked progress bar in the same state colours, tiles in id order by default.
- **WKQ-006** Rates use the 24 hours ending at the last whole hour; the finish estimate shows three methods (all rows, without one-off batches, completions only) and says "No finish date at this pace" when rows arrive as fast as they complete; it never invents a date.
- **WKQ-007** Rows added sit above the zero line and rows completed below it, coloured by origin.
- **WKQ-008** "Running now" comes from the lock and claim files, not the State column.
- **WKQ-009** Every time shown is Australia/Melbourne time through `SongNodes.format` ("Sat 14 Nov, 10:47", stamps with AEDT or AEST).
- **WKQ-010** The theme switch is a `SegmentedControl` with one option per theme (Dark and Light, Booth where offered) that sets the theme of the whole page through `SongNodes.prefs`; the page carries no colour of its own. SongNodes' `SegmentedControl` is a radiogroup (`aria-checked`), so the switch uses it rather than `aria-pressed` buttons.

### Accessibility
Each tile is a button whose name is "UX-T04, ready: Build the Buy list page"; the same words show in its tooltip on hover or focus. The letter on a solid tile holds 4.5:1 in every theme (checked by `build_tokens.py`); the dashed edge of a waiting tile holds 3:1 on `surface-1`. Origin edges are marks beside the letter and the legend, so they need no text contrast.
