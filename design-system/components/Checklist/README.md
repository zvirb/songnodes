# Checklist
A list of checks with passed, failed, warning and pending rows, each with a glyph, a short label and an optional note on what to do, plus a counts summary.

## When to use
- Track readiness (has key, has BPM, energy checked, has TIDAL link), import validation, pre-release checks, validation results (severity error, warning, info).
- Don't use for a to-do list people tick (use `sn-check` checkboxes) or for step-by-step progress.

## Anatomy and markup
`sn-checklist-summary` (counts with glyphs), then `ul.sn-checklist` of `li.sn-checklist__item[data-state]` → `__glyph` (Lucide icon), `__text` (`__label` starting with an sr status word, optional `__note`), optional `__aside` (mono value).
```html
<ul class="sn-checklist">
  <li class="sn-checklist__item" data-state="fail">
    <span class="sn-checklist__glyph">…x icon…</span>
    <span class="sn-checklist__text"><span class="sn-checklist__label"><span class="sn-sr">Failed: </span>Has TIDAL link</span>
      <span class="sn-checklist__note">No TIDAL match for this ISRC. Search TIDAL by title or link it by hand.</span></span>
    <span></span>
  </li>
</ul>
```

## States
pass (`check`, `status-ok`), fail (`x`, `status-bad`, note in `status-bad`), warn (`triangle-alert`, `status-warn`), pending (dashed `circle-dot`, `fg-3`, label in `fg-2`). Validation severity maps error → fail, warning → warn, info → pass with a note.

## Variants
Default, with dividers. `sn-checklist--compact`, without dividers, for table cells and tooltips.

## Content rules
Labels state the condition as it should be ("Has key", "Timestamps in order"), not as a question. Notes on fail and warn say what happened and what to do. Summary: "2 passed · 1 failed · 1 to look at · 1 not checked", leaving out zero counts. Keep rows in the order the process runs, not sorted by state.

## Accessibility
Glyph shapes differ (✓ ✕ ▲ ○) and every label starts with a hidden status word, so colour is never needed.

## In SongNodes / the music library
Import validation in `TracklistImporter.tsx`, checks in `DataQualityReview.tsx`, the Naarm track-readiness filters ("Has key and BPM", "Needs an energy check"), and the planned validation results view.
