# SectionHeading
A heading for a section inside a page: the thin–bold title at `title-m` or `title-s`, with an optional count, a right-side action or link, and a one-line caveat.

## When to use
- Every section below the page title: "Crate: Needs an energy check", "Set builder: Saved sets", "Pipeline: Scraper health".
- Not for page titles (`sn-title title-l`) or titles inside cards (`title-s` alone).

## Anatomy and markup
`sn-section-heading` (flex, wraps) → `h2/h3.sn-title.title-m|title-s` with `sn-lead`, `__count` (mono `fg-3`), `__end` (one action or link, right-aligned), `__caveat` (full-width line, `fg-3`, optional info icon). `--rule` adds a divider underneath.
```html
<div class="sn-section-heading sn-section-heading--rule">
  <h2 class="sn-title title-m"><span class="sn-lead">Crate:</span> Needs an energy check</h2>
  <span class="sn-section-heading__count">47 tracks</span>
  <div class="sn-section-heading__end"><button class="sn-btn sn-btn--sm" type="button">Export CSV</button></div>
  <p class="sn-section-heading__caveat">Energy is estimated from BPM and source; 47 tracks need a check.</p>
</div>
```

## Content rules
Lead-in in sentence case with a colon, then the bold title: the lead names the module or object, the title names this section. Give the count its noun when it isn't obvious ("47 tracks"). A caveat says in one sentence what limits the data, without "Note:". Right-side links go to the module that owns the full list, in that module's colour ("See all sets").

## Accessibility
Use the real heading level for the page outline (h2 under the page h1, h3 inside that). The count follows the heading in reading order rather than sitting inside it. One action per heading.

## Responsive
Wraps: the action drops under the title on phones; the caveat is always its own line.

## In SongNodes / the music library
Panel headings in `StatsPanel.tsx`, `PathfinderPanel.tsx`, `TargetTracksManager.tsx` and `DJInterface/panels/PlanModePanel.tsx`; the Naarm "Saved sets" and crate headings.
