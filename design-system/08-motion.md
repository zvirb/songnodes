# Motion

Motion explains a change of place or state; it never decorates. A DJ glancing at the screen mid-mix must never have to wait for an animation or find that the row they were about to tap has moved.

## Motion allowance

| What moves | Max duration | Easing | Notes |
|---|---|---|---|
| Hover, press, focus, chip toggle, switch | `duration-fast` 120 ms | `ease-standard` | Colour and opacity only |
| Drawer, side sheet, dialog, disclosure, tab indicator, toast | `duration-base` 200 ms | `ease-standard` in, `ease-exit` out | Transform and opacity only |
| Chart transitions (bar heights, line morph), graph camera moves (focus, zoom to fit) | `duration-slow` 320 ms | `ease-standard` | Data marks only |
| Graph physics (force simulation) | runs until settled, separate budget | – | See "Graph simulation" |

- Animate `transform` and `opacity`. Never animate `width`, `height`, `top` or `left` of layout boxes (the energy wave animates bar `transform: scaleY`).
- Nothing loops except a real busy indicator (`.sn-spinner`). The ↻ glyph in a running `StatusPill` is static.
- No parallax, no bounce or overshoot, no animated gradients, no attention-seeking pulses on badges or the now-playing node.
- Nothing flashes more than 3 times per second (WCAG 2.3.1), including beat-synced visuals.

## Reduced motion

When `prefers-reduced-motion: reduce` is set, or "Reduce motion" is on in `PreferencesPanel`:
- All UI durations become `duration-instant` (0 ms). `00-core.css` already collapses transitions and animations.
- Drawers, sheets and dialogs appear in place, without sliding.
- Chart changes jump to the final state.
- Graph camera moves cut instead of glide; "Focus in graph" centres the node instantly.
- The graph simulation computes its layout without drawing intermediate ticks (run ticks off-screen, then render), and pauses once settled. Dragging a node moves only that node; neighbours do not spring.
- No pulse or shimmer: skeletons are static `surface-2` blocks; the spinner is a static ring next to the busy label ("Saving…"). Text, not motion, says that work is happening.
- Real progress (`ProgressBar`, `StagedProgress`) still updates its value, without easing.

This meets WCAG 2.3.3 (Animation from interactions, AAA) and 2.2.2 (Pause, stop, hide).

## Graph simulation

- The force layout settles within 3 s for up to 5,000 nodes, then stops (`alpha` below threshold). It restarts only when data changes or the person drags a node.
- `GraphControls` always offers "Pause layout" / "Resume layout" (2.2.2).
- Live updates add nodes at their final computed positions near their neighbours; existing nodes do not move more than needed.
- In Play mode the camera follows the now-playing track only when the person turns on "Follow now playing".

## Reveal and entrance

- No entrance animation for data: table rows, cards, set slots, figure values and chart marks appear in place on load. No staggered fade-ins, no count-up numbers.
- `NavDrawer` and `SideSheet` slide 200 ms from their edge; `Dialog` fades and scales from 0.98 in 200 ms; `Toast` slides up 200 ms and leaves with `ease-exit`.
- `Disclosure` expands with a 200 ms height-free reveal (opacity + `grid-template-rows: 0fr → 1fr`), or instantly in reduced motion.
- `Tooltip` appears after 500 ms hover (immediately on keyboard focus) without animation.

## Layout stability when data changes

- Reserve space for content that will arrive: skeletons have the final height; images and charts have fixed aspect ratios; `FigureTile` reserves the figure line. Target cumulative layout shift below 0.1.
- Update numbers in place: counts, BPM, energy, freshness stamps change their text without moving neighbours (tabular numerals keep widths stable).
- Never reorder or insert rows above the pointer or focus while the person is interacting. Live inserts into a sorted table queue behind a "38 new tracks – Show" `Button` at the top of the table, applied on click.
- A row being hovered, focused or dragged never moves because of a background update.
- Set rebuild ("Build set", "Try another take"): slots keep their positions; changed slots swap content in place; the `EnergyWave` animates bar heights only (`scaleY`, 320 ms), the target line stays still. Locked slots never change.
- Removing a slot collapses the gap instantly (or in 120 ms); the Undo toast restores it in the same place.

## Preserving scroll position

Rules:
- Back and Forward restore the exact scroll position and the open `SideSheet`.
- Changing a filter keeps the page where it is if the results header is in view; if the person has scrolled past the top of the results, move to the results header (not the page top) so the first matching row is visible.
- Changing sort keeps the results header in place; rows re-sort beneath it.
- Switching `Tabs` restores each tab's own scroll position.
- Opening and closing a `SideSheet` or `Dialog` never moves the page underneath.
- Changing density or text size keeps the first visible row at the top.

Implementation notes:
- Set `history.scrollRestoration = 'manual'` and store `scrollY` per history entry (`location.key`) in `sessionStorage`; restore in a layout effect after the first render with data, not after the skeleton.
- For density, text size and live updates, anchor to the first visible row's id: record its `getBoundingClientRect().top` before the change and correct `scrollBy` after.
- Keep CSS scroll anchoring on (`overflow-anchor: auto`, the default); do not disable it on tables.
- Lock page scroll with `overflow: hidden` on `html` (plus scrollbar-gutter `stable`) while a modal layer is open, so the page does not jump sideways.

## Programmatic scrolling

- Scroll only in response to an explicit action: "Focus in graph", "Jump to slot 7", "Show in library", a `CommandPalette` result, a validation error link ("Go to field").
- Never auto-scroll on data refresh, WebSocket updates, job completion or timers. Never scroll a list to follow the now-playing track unless "Follow now playing" is on.
- Programmatic scrolls use `scrollIntoView({ block: 'nearest' })`, smooth only when reduced motion is off, and move focus to the target so keyboard and screen-reader users land there too.
- Account for the sticky header with `scroll-margin-top: calc(var(--header-h) + var(--space-2))` on targets.

## Animated progress

- Animate progress only when it reflects real measured progress: items processed, bytes uploaded, steps complete. `ProgressBar` eases between real values over at most 200 ms.
- Use the indeterminate form only when the total is truly unknown (waiting for a first server response). Switch to determinate as soon as a total is known.
- No decorative spinners: no spinner on a page that is idle, on a "Live" indicator, beside a value that is not loading, or as branding.
- Never show 100% before the work is confirmed done; never move backwards except on a real reset, which is labelled ("Restarted: 0 of 42").
