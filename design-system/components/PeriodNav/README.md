# PeriodNav

The one way to move through time in SongNodes: previous/next, jump to now, the period's name and a Day/Week/Month scale, with [ and ] on the keyboard.

## When to use
- Any view filtered to a calendar period: radio plays per week, ARIA Club Chart per week, scraper runs per day, stats per month.
- Not for picking an arbitrary date range (use a date field), and not for paging through results (ShowMore).

## Anatomy and markup
Fixed order: ‹ › → Today / This week / This month → period label → (hint) → scale.
```html
<div class="sn-period-nav" role="group" aria-label="Period"><div class="sn-period-nav__bar">
  <div class="sn-period-nav__steps">
    <button class="sn-btn sn-btn--icon sn-btn--sm" aria-label="Previous week" aria-keyshortcuts="[">‹</button>
    <button class="sn-btn sn-btn--icon sn-btn--sm" aria-label="Next week" aria-keyshortcuts="]">›</button></div>
  <button class="sn-btn sn-btn--sm" aria-disabled="true" title="Already showing this week">This week</button>
  <h2 class="sn-period-nav__label" aria-live="polite"><span class="sn-lead">Week of</span> 19 Oct 2026</h2>
  <span class="sn-period-nav__hint"><kbd>[</kbd><kbd>]</kbd> previous / next</span>
  <div class="sn-period-nav__scale"><!-- SegmentedControl --sm: Day, Week, Month --></div>
</div></div>
```

## Variants
- Day: "Saturday 24 Oct 2026" (weekday as lead). Week: "Week of 19 Oct 2026" (weeks start Monday). Month: "October 2026".
- Without scale: views that only make sense per week (the weekly radio run).

## States
- The jump button reads "Today", "This week" or "This month" to match the scale; it is `aria-disabled` with a reason when already on the current period.
- Changing the scale keeps the period that contains the current one (week of 19 Oct → October 2026).
- Next can be disabled in views with no future data ("No plays after today").

## Content rules
Dates as "19 Oct 2026", Australia/Melbourne. Button labels name the unit: "Previous week", never "Back".

## Accessibility
- `role="group"` named "Period" (not `toolbar`: it contains a radio group, whose arrow keys would clash with toolbar arrow navigation; plain Tab order is clearer).
- The label is a live region, so a step is announced ("Week of 26 Oct 2026").
- [ and ] step the page's main PeriodNav from anywhere except text fields; `aria-keyshortcuts` exposes them.

## Responsive
Container query ≤520px: the label moves to its own line above the controls and the key hint hides. Wall: one line, label in Sora at 1rem.

## Do / don't
- Do keep one PeriodNav per page and let [ ] drive it.
- Don't invent other arrows or date pickers for the same job.
- Don't show relative names ("last week") as the label; show the dates.

## In SongNodes
Stats panel periods, scraper job history and the planned monitoring dashboard's "Recently scraped data".

## In the music library
The weekly build (radio plays from PBS, 3RRR, triple j shows) and the ARIA Club Chart week, replacing the date dropdown in the Naarm Set Builder.
