# TextField

A single- or multi-line text input with a visible label, its help in an `InfoTip` after the label, an inline error tied to the input, an optional character count, and clear optional, read-only and disabled states.

## When to use / not use
Use for free text: set names, notes, ISRCs, IDs. Use NumberField for numbers with units, SelectField for short fixed lists, ChipInput for several short values, SecretField for keys.

## Anatomy & markup
```html
<div class="sn-field sn-text-field">
  <div class="sn-text-field__head"><label class="sn-text-field__label" for="name"><span>Set name</span></label>
    <span class="sn-infotip"><button type="button" class="sn-infotip__btn" aria-label="About set name" aria-expanded="false" aria-controls="name-help" aria-describedby="name-help">…info…</button><span class="sn-tooltip sn-infotip__tip" id="name-help" role="tooltip" hidden>Shown on the saved sets list.</span></span>
    <span class="sn-text-field__count" aria-hidden="true">18 / 40</span></div>
  <input class="sn-input" id="name" aria-describedby="name-help name-err" aria-invalid="true">
  <span class="sn-field__error" id="name-err">Enter a set name.</span>
</div>
```
Order: the head (`sn-text-field__head`: label, its InfoTip, the count pushed to the end), input, error. A field with no help keeps the label alone (with the count inside it, as before). **Every field's help is an `InfoTip` after its label, however short** (1.6.0, imported from BeanAlliance v4.19.1, Markus 1 Nov 2026): no guidance text stays under a field. The input still points `aria-describedby` at the tip's id, so a screen reader hears the help whether or not the tip is open. `.sn-field__help` is deprecated for guidance (removed in 2.0.0); it stays only for a value the field reports back ("Filled from the Spotify match"). Use `sn-input--data` for IDs and codes (mono), `sn-textarea` for multi-line.

## States
| State | Markup | Look |
|---|---|---|
| Error | `aria-invalid="true"` + `sn-field__error` in `aria-describedby` | 2px `status-bad` border, ✕ + message in `status-bad` |
| Optional | `<span class="sn-text-field__optional">(optional)</span>` in the label | Mark optional fields; required is the default and is not marked |
| Read-only | `readonly` | dashed border, transparent fill, `fg-2` text; still focusable and copyable |
| Disabled | `disabled` + `sn-text-field__reason` with a lock icon | `opacity-disabled`; always say why and how to enable it |
| Count | `sn-text-field__count`, `data-over` when over | "18 / 40"; over limit turns `status-bad` with ✕ |

## Content rules
Labels are nouns in sentence case ("Set name", "ISRC"). Help (in the InfoTip) gives a real example ("for example GBCEN2300412"). Errors say what is wrong and how to fix it: "ISRC must be 12 characters. This one has 10." No "Invalid input", no exclamation marks. Validate on blur or submit, not on every keystroke.

## Accessibility
Always a visible `<label for>`; placeholders are never the label. Help (the InfoTip's tip) and error are linked with `aria-describedby`; the InfoTip sits after the `label` element, never inside it. The character count is announced after typing pauses and only within 10 characters of the limit or over it (GOV.UK character count); let people type past the limit and show the error rather than truncating.

## Responsive
Full width of the form column; forms stack to one column below `bp-tablet`. Inputs are 40px (44px on touch via the core input height plus padding).

## Do / don't
- Do keep the label above the input at every width.
- Don't disable a field without the reason next to it.
- Don't use read-only for values people can't act on; show them as text instead.

## In SongNodes / in the music library
Setlist name in `SetlistBuilder/index.tsx`, preset name in `FilterPanel.tsx`, `EditTrackModal.tsx` / `TrackEditModal.tsx` fields. In the Naarm Set Builder: Set name.

## In a row of fields
Fields that sit side by side are one `.sn-field-row` (a grid aligned to the top), never a page's own flex, grid or table: every label line is one height, every control starts at one height and is `control-md` tall, and an error, a range line or a readout hangs below its own field without moving its neighbours. A field that needs more room spans columns (`sn-field-row__span-2`, `sn-field-row__span-all`); a button beside the fields sits in `sn-field-row__action`. Rules and the rendered check (`linters/check_alignment.js`) are in `22-forms-and-load.md`, *Form alignment*.

A label that shares its line with an InfoTip (`sn-text-field__head`, `sn-field__head`) keeps the label type of a label on its own, so a row of labels reads as one line of the same text (1.14.0).

## A file input in a field
For one optional file beside other fields (a cover image), a native `<input type="file">` inside `.sn-field` has no border, ground or padding of its own: only its Choose file button is a box, at `control-md`. Imports of data still use `FileDrop`.
```html
<div class="sn-field"><div class="sn-field__head"><label class="sn-field__label" for="cover">Cover image</label>…InfoTip…</div>
  <input type="file" id="cover" accept="image/jpeg,image/png"></div>
```

## Differs from beanAlliance
- The row is `.sn-field-row` (beanAlliance `.adjform` of `.fld`); the label line is the 24px height of the InfoTip button so a label with a tip and one without start and end together.
- A three-part `DateField` does not share a row with single-control fields (its Day, Month and Year labels sit between the legend and the inputs); beanAlliance's date field is one control.
- The status line beside a form's buttons is a plain `InlineMessage`; no `formmsg` class was added.
