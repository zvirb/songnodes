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
Lead-in in sentence case with a colon, then the bold title: the lead names the module or object, the title names this section. Give the count its noun when it isn't obvious ("47 tracks"). A caveat says in one sentence what limits the data, without "Note:". A caveat that only explains (how the figure is worked out, what a scale means) is an `InfoTip` after the title instead (1.6.0); the `__caveat` line stays for a fact about the data right now that the person should see without asking ("47 tracks need a check"). Right-side links go to the module that owns the full list, in that module's colour ("See all sets").

## No "How this works" section
A page has no section headed "How it works" or "How this works", open or folded. Method text (how the set is built, how rotation is worked out, how confidence is scored) is the panel `InfoTip` after the heading of the table, chart or list it explains; a caveat that only explains is the tooltip form. Inside the heading every part of the panel is a `span` (`sn-infotip__p`, `sn-infotip__note`). `linters/check.py` reports such a heading as COG-HOWWORKS.

## Accessibility
Use the real heading level for the page outline (h2 under the page h1, h3 inside that). The count follows the heading in reading order rather than sitting inside it. One action per heading.

## Responsive
Wraps: the action drops under the title on phones; the caveat is always its own line.

## In SongNodes / the music library
Panel headings in `StatsPanel.tsx`, `PathfinderPanel.tsx`, `TargetTracksManager.tsx` and `DJInterface/panels/PlanModePanel.tsx`; the Naarm "Saved sets" and crate headings.
