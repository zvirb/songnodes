# FilterChip

Toggle chips that narrow a list: pick any number in a group (pillars, energy tiers, rotation, tags), see how many tracks each one holds, and clear the group in one step.

## When to use / not use
Use for short sets of categories (2–10 options) that people combine. For long or open-ended lists (artists, labels) use a searchable combobox; for one-of-many settings use a radio group or `sn-seg`.

## Anatomy & markup
```html
<div class="sn-filter-chip-group" role="group" aria-labelledby="lg-pillar">
  <div class="sn-filter-chip-group__head">
    <span class="sn-filter-chip-group__legend" id="lg-pillar">Pillar</span>
    <button class="sn-filter-chip-group__clear" type="button">Clear (1)</button>
  </div>
  <ul class="sn-filter-chip-group__list">
    <li><button class="sn-chip sn-filter-chip" type="button" aria-pressed="true">
      <span>House</span><span class="sn-filter-chip__count"><span class="sn-sr">, </span>612<span class="sn-sr"> tracks</span></span>
    </button></li>
  </ul>
</div>
```

## Variants
- Energy tier: `data-tier="low|building|high"` with `<span class="sn-filter-chip__tier" aria-hidden="true"><i></i><i></i><i></i></span>`: a mini 3-segment bar (4px segments rising 6/9/12px) showing the tier's range, so it reads as a slice of the `EnergyBar`, not a single colour. Low = `energy-1`, `energy-3`, `energy-4` (1–4 compressed into three marks); Building = `energy-5`, `energy-6`, `energy-7`; High = `energy-8`, `energy-9`, `energy-10`. A mark, never a fill; the label carries the range. Labels come from `TIER_LABEL`: "Low 1–4", "Building 5–7", "High 8–10".
- Emphasis: `sn-filter-chip--emph` gives Rotation High a `brand-soft` tint while off.
- Empty: `data-empty` (dashed border, dim) when the count is 0. Keep it operable; selecting it shows the empty state.

## States
Off: outline. On: `fg` fill with ✓ (from `sn-chip`), so state never relies on colour. Hover: `hover-bg`. Focus: `focus` ring.

## Content rules
Labels in sentence case, as the library names them ("UK garage", "Vault"). Rotation counts are whatever the latest weekly run computed (High rotation and Vault are worked out by the weekly run from the library's own play data); Vault shows 0 until the run has learned its threshold. Counts in `font-data` with thousands separators ("1,102"). Clear reads "Clear (2)".

## Accessibility
Each chip is a toggle button with `aria-pressed`. The group has `role="group"` named by its legend. The Clear button's name includes the group ("Clear 2 pillar filters"); after clearing, focus moves to the first chip. Announce "House on/off" politely. Chips are 28px tall (36px on touch), above the 24px WCAG 2.2 minimum.

## Responsive
Chips wrap. In the FilterRail they fill `rail-w`; in a sheet they wrap to the sheet width.

## Do / don't
- Do keep chips in a fixed order; don't reorder by count while someone is choosing.
- Don't use status colours for categories; pillars and tags are neutral.

## In SongNodes / in the music library
Replaces the checkbox lists in `FilterPanel.tsx`, `MultiSelect.tsx` and the genre toggles in `GraphFilterPanel.tsx`. In the Naarm Set Builder filter rail: Pillar, Energy tier, Rotation and Tags.
