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
