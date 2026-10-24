# Popover

A small click-opened panel anchored to its trigger for interactive content: spare-track suggestions, a column chooser, key detail with compatible keys.

## When to use
- A short list to pick from or toggle, or a detail that has links/actions, without leaving the spot.
- Not for plain labels (Tooltip), long forms (Dialog) or browsing details (SideSheet). Not for app navigation (that is the left drawer).

## Anatomy
```html
<span class="sn-popover__anchor">
  <button class="sn-btn sn-btn--sm" aria-haspopup="dialog" aria-expanded="false" aria-controls="p">Spares for slot 5</button>
  <div class="sn-popover" id="p" role="dialog" aria-labelledby="p-t" hidden>
    <div class="sn-popover__head"><h3 class="sn-popover__title" id="p-t" tabindex="-1">3 spare tracks</h3><button … aria-label="Close">…x…</button></div>
    <p class="sn-popover__text">Fit between slot 4 (energy 5, 8A) and slot 6:</p>
    <ul class="sn-popover__list"><li class="sn-popover__item">…<span class="sn-popover__grow">…</span><button class="sn-btn sn-btn--sm">Swap in</button></li></ul>
    <div class="sn-popover__foot">…</div>
  </div>
</span>
```
`surface-1`, `line` border, `radius-card` (14px), `shadow-2`, `z-popover`, 240–360px wide. `sn-popover--end` aligns to the trigger's right edge, `--up` opens above.

## Behaviour
- Click (or Enter/Space) on the trigger toggles it; one popover open at a time.
- Closes on Esc, outside click, the close button, or focus leaving it; Esc and the close button return focus to the trigger.
- Changes apply immediately (checkboxes, "Swap in"); no Save button unless the change is costly.

## Content rules
Title names what's inside ("3 spare tracks", "Crate columns", "8A A minor"). Keys with dot + code + name; compatibility with traffic-light pill + glyph + words. Up to ~8 rows; more belongs in a SideSheet.

## Accessibility
- Non-modal `role="dialog"` named by its title; trigger has `aria-expanded`, `aria-controls`, `aria-haspopup="dialog"`.
- On open, focus moves to the title (or the first control for pickers); Tab moves through the content and out (which closes it).
- Not a `menu`: use real buttons and checkboxes, not `menuitem`s.

## Responsive
Phones: if the popover would overflow, render it as a bottom sheet (SideSheet phone style) with the same content. Booth: `shadow-2` becomes a 1px outline.

## Do / don't
- Do keep it small and dismissible.
- Don't open a popover on hover.

## In SongNodes
Replaces RadialMenu and context-menu sub-panels that hold actions, HarmonicCompatibility's key popouts, column pickers in tables, and SmartTooltip's interactive mode.

## In the music library
The 3 spare suggestions per running-order slot, the crate's column chooser, key detail with compatible keys from any "● 8A".
