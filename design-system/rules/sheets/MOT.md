# MOT rules (generated)

| ID | Rule | Check | Test |
|---|---|---|---|
| MOT-001 | Motion shall explain a change of place or state and shall not decorate. | judgement | Every animation corresponds to a state or position change. |
| MOT-002 | Hover, press, focus, chip toggle and switch transitions shall last at most `duration-fast` (120 ms) with `ease-standard`, animating colour and opacity only. | lint | Those transitions use `var(--duration-fast)`, `var(--ease-standard)` and properties limited to color, background-color, border-color, opacity. |
| MOT-003 | Drawer, side sheet, dialog, disclosure, tab indicator and toast transitions shall last at most `duration-base` (200 ms), using `ease-standard` in and `ease-exit` out, animating transform and opacity only. | lint | Those transitions use `var(--duration-base)`, ease tokens, and properties limited to transform and opacity. |
| MOT-004 | Chart transitions and graph camera moves shall last at most `duration-slow` (320 ms) with `ease-standard`, animating data marks only. | lint | Chart/camera transitions use `var(--duration-slow)` and `var(--ease-standard)`. |
| MOT-005 | Graph physics shall run until settled on a separate time budget. | dom | Force simulation is stopped after settling and is not bound by UI durations. |
| MOT-006 | Only `transform` and `opacity` shall be animated; `width`, `height`, `top` and `left` of layout boxes shall not be animated. | lint | Flag `transition`/`@keyframes` on width, height, top, left. |
| MOT-007 | The energy wave shall animate bar heights with `transform: scaleY`. | lint | EnergyWave bar animation uses `transform: scaleY`. |
| MOT-008 | Nothing shall loop except a real busy indicator (`.sn-spinner`). | lint | Flag `animation-iteration-count: infinite` outside `.sn-spinner`. |
| MOT-009 | The ↻ glyph in a running `StatusPill` shall be static. | lint | `.sn-pill` ↻ glyph has no animation. |
| MOT-010 | Parallax, bounce or overshoot, animated gradients, and attention-seeking pulses on badges or the now-playing node shall not be used. | lint | Flag parallax scroll handlers, overshoot cubic-bezier (y>1), animated gradient, pulse keyframes on badges. |
| MOT-011 | Nothing shall flash more than 3 times per second, including beat-synced visuals. | judgement | Flash frequency of any element is <=3 Hz. |
| MOT-012 | Under `prefers-reduced-motion: reduce` or "Reduce motion" in `PreferencesPanel`, all UI durations shall become `duration-instant` (0 ms). | lint | Reduced-motion block sets durations to 0 ms and `data-reduce-motion` mirrors it. |
| MOT-013 | Under reduced motion, drawers, sheets and dialogs shall appear in place without sliding. | dom | No transform transition on those layers in reduced motion. |
| MOT-014 | Under reduced motion, chart changes shall jump to the final state. | dom | Chart transitions have 0 duration in reduced motion. |
| MOT-015 | Under reduced motion, graph camera moves shall cut instead of glide, and "Focus in graph" shall centre the node instantly. | dom | Camera animation duration 0 in reduced motion. |
| MOT-016 | Under reduced motion, the graph simulation shall compute its layout without drawing intermediate ticks and pause once settled. | judgement | Ticks run off-screen; one render after settling. |
| MOT-017 | Under reduced motion, dragging a graph node shall move only that node, with no spring on neighbours. | dom | Dragging a node leaves neighbour positions unchanged. |
| MOT-018 | Under reduced motion, skeletons shall be static `surface-2` blocks with no pulse or shimmer. | lint | `.sn-skel` has no animation and uses `var(--surface-2)` in reduced motion. |
| MOT-019 | Under reduced motion, the spinner shall be a static ring next to the busy label. | lint | `.sn-spinner` has `animation: none` in reduced motion and a text label is adjacent. |
| MOT-020 | Under reduced motion, real progress (`ProgressBar`, `StagedProgress`) shall still update its value, without easing. | lint | Progress value updates with `transition: none` in reduced motion. |
| MOT-021 | The force layout shall settle within 3 s for up to 5,000 nodes, then stop (`alpha` below threshold). | dom | Simulation with 5000 nodes stops within 3000 ms. |
| MOT-022 | The force layout shall restart only when data changes or the person drags a node. | dom | No simulation restart without a data or drag event. |
| MOT-023 | `GraphControls` shall always offer "Pause layout" / "Resume layout". | dom | GraphControls contains a Pause/Resume layout button. |
| MOT-024 | Live updates shall add graph nodes at their final computed positions near their neighbours, and existing nodes shall not move more than needed. | judgement | New nodes spawn at final position; existing node displacement is minimal. |
| MOT-025 | In Play mode the camera shall follow the now-playing track only when the person turns on "Follow now playing". | dom | Camera does not follow unless the toggle is on. |
| MOT-026 | Data (table rows, cards, set slots, figure values, chart marks) shall appear in place on load with no entrance animation, staggered fade-ins or count-up numbers. | lint | Flag entrance animations/keyframes on data elements and count-up libraries. |
| MOT-027 | `NavDrawer` and `SideSheet` shall slide in 200 ms from their edge. | lint | Transform transition 200 ms on those components. |
| MOT-028 | `Dialog` shall fade and scale from 0.98 in 200 ms. | lint | Dialog enter animation scale(0.98)->1, 200 ms, with opacity. |
| MOT-029 | `Toast` shall slide up in 200 ms and leave with `ease-exit`. | lint | Toast enter 200 ms translateY; exit uses `var(--ease-exit)`. |
| MOT-030 | `Disclosure` shall expand in 200 ms with an opacity and `grid-template-rows: 0fr -> 1fr` reveal, or instantly in reduced motion. | lint | Disclosure uses grid-template-rows transition 200 ms; none in reduced motion. |
| MOT-031 | `Tooltip` shall appear without animation, after 500 ms on hover and immediately on keyboard focus. | dom | Tooltip has no transition; delay 500 ms hover, 0 ms focus. |
| MOT-032 | Space shall be reserved for arriving content: skeletons shall have the final height, images and charts shall have fixed aspect ratios, and `FigureTile` shall reserve the figure line. | dom | Skeleton height equals final; images/charts declare aspect-ratio or width/height; FigureTile figure line has min-height. |
| MOT-033 | Cumulative layout shift shall be below 0.1. | dom | Measured CLS < 0.1. |
| MOT-034 | Counts, BPM, energy and freshness stamps shall update their text in place without moving neighbours, using tabular numerals. | dom | Those elements use `font-variant-numeric: tabular-nums` and neighbour offsets are unchanged after update. |
| MOT-035 | Rows shall not be reordered or inserted above the pointer or focus while the person is interacting. | dom | Live insert above hovered/focused row does not shift it. |
| MOT-036 | Live inserts into a sorted table shall queue behind a "38 new tracks – Show" `Button` at the top of the table, applied on click. | dom | Live insert renders a Show button at table top and applies rows only on click. |
| MOT-037 | A row being hovered, focused or dragged shall not move because of a background update. | dom | Hovered/focused/dragged row offsetTop is unchanged after background update. |
| MOT-038 | On set rebuild, slots shall keep their positions and changed slots shall swap content in place. | dom | Slot DOM order unchanged after rebuild. |
| MOT-039 | On set rebuild, `EnergyWave` shall animate bar heights only (`scaleY`, 320 ms) and the target line shall stay still. | lint | Rebuild animation is scaleY 320 ms; target line has no transition. |
| MOT-040 | Locked slots shall never change on set rebuild. | dom | Locked slot content is identical before and after rebuild. |
| MOT-041 | Removing a slot shall collapse the gap instantly (or in 120 ms), and the Undo toast shall restore it in the same place. | dom | Gap collapse <=120 ms; Undo restores original index. |
| MOT-042 | Back and Forward shall restore the exact scroll position and the open `SideSheet`. | dom | Navigate away and back; scrollY and open SideSheet match the prior state. |
| MOT-043 | Changing a filter shall keep the page in place if the results header is in view, otherwise move to the results header so the first matching row is visible. | dom | Filter change: header in view -> scrollY unchanged; else results header at top. |
| MOT-044 | Changing sort shall keep the results header in place while rows re-sort beneath it. | dom | Results header offsetTop unchanged after sort. |
| MOT-045 | Switching `Tabs` shall restore each tab's own scroll position. | dom | Switch tabs and back; each tab's scroll position is restored. |
| MOT-046 | Opening and closing a `SideSheet` or `Dialog` shall not move the page underneath. | dom | scrollY identical before open and after close. |
| MOT-047 | Changing density or text size shall keep the first visible row at the top. | dom | First visible row's getBoundingClientRect().top is unchanged after change. |
| MOT-048 | The app shall set `history.scrollRestoration = 'manual'` and store `scrollY` per history entry (`location.key`) in `sessionStorage`. | lint | Grep for scrollRestoration manual and sessionStorage keyed by location.key. |
| MOT-049 | Scroll restoration shall run in a layout effect after the first render with data, not after the skeleton. | judgement | Restore happens after data render, not skeleton. |
| MOT-050 | For density, text size and live updates, scroll shall anchor to the first visible row's id by recording its `getBoundingClientRect().top` before the change and correcting with `scrollBy` after. | judgement | Code records row top before and calls scrollBy delta after change. |
| MOT-051 | CSS scroll anchoring shall stay on (`overflow-anchor: auto`) and shall not be disabled on tables. | lint | Flag `overflow-anchor: none`. |
| MOT-052 | While a modal layer is open, page scroll shall be locked with `overflow: hidden` on `html` plus `scrollbar-gutter: stable`. | lint | Modal-open state sets `html{overflow:hidden; scrollbar-gutter:stable}`. |
| MOT-053 | Scrolling shall happen only in response to an explicit action ("Focus in graph", "Jump to slot 7", "Show in library", a `CommandPalette` result, a validation error link). | judgement | Every scrollTo/scrollIntoView call is reachable only from a user action handler. |
| MOT-054 | Auto-scroll shall not occur on data refresh, WebSocket updates, job completion or timers. | lint | Flag scroll calls inside timer, WebSocket or refresh callbacks. |
| MOT-055 | A list shall not scroll to follow the now-playing track unless "Follow now playing" is on. | dom | No follow-scroll with the toggle off. |
| MOT-056 | Programmatic scrolls shall use `scrollIntoView({ block: 'nearest' })`, smooth only when reduced motion is off. | lint | Grep scrollIntoView calls for block nearest and behavior gated on reduced motion. |
| MOT-057 | Programmatic scrolls shall move focus to the target. | dom | After scroll, document.activeElement is the target. |
| MOT-058 | Scroll targets shall set `scroll-margin-top: calc(var(--header-h) + var(--space-2))`. | lint | Scroll targets have that `scroll-margin-top` value. |
| MOT-059 | Progress shall be animated only when it reflects real measured progress. | judgement | Progress values derive from counts or bytes. |
| MOT-060 | `ProgressBar` shall ease between real values over at most 200 ms. | lint | ProgressBar transition duration <=200 ms. |
| MOT-061 | The indeterminate progress form shall be used only when the total is truly unknown, switching to determinate as soon as a total is known. | judgement | Indeterminate used only before a total exists. |
| MOT-062 | Spinners shall not be used decoratively: not on an idle page, on a "Live" indicator, beside a value that is not loading, or as branding. | judgement | Every `.sn-spinner` is paired with an in-flight request. |
| MOT-063 | Progress shall not show 100% before the work is confirmed done. | judgement | Progress reaches 100% only upon completion confirmation. |
| MOT-064 | Progress shall not move backwards except on a labelled real reset (e.g. "Restarted: 0 of 42"). | judgement | Decreasing progress values only accompany a "Restarted" label. |
