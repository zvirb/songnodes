# TextField

A single- or multi-line text input with a visible label, optional help text, an inline error tied to the input, an optional character count, and clear optional, read-only and disabled states.

## When to use / not use
Use for free text: set names, notes, ISRCs, IDs. Use NumberField for numbers with units, SelectField for short fixed lists, ChipInput for several short values, SecretField for keys.

## Anatomy & markup
```html
<div class="sn-field sn-text-field">
  <label class="sn-text-field__label" for="name"><span>Set name</span><span class="sn-text-field__count" aria-hidden="true">18 / 40</span></label>
  <span class="sn-field__help" id="name-help">Shown on the saved sets list.</span>
  <input class="sn-input" id="name" aria-describedby="name-help name-err" aria-invalid="true">
  <span class="sn-field__error" id="name-err">Enter a set name.</span>
</div>
```
Order: label, help, input, error. Use `sn-input--data` for IDs and codes (mono), `sn-textarea` for multi-line.

## States
| State | Markup | Look |
|---|---|---|
| Error | `aria-invalid="true"` + `sn-field__error` in `aria-describedby` | 2px `status-bad` border, ✕ + message in `status-bad` |
| Optional | `<span class="sn-text-field__optional">(optional)</span>` in the label | Mark optional fields; required is the default and is not marked |
| Read-only | `readonly` | dashed border, transparent fill, `fg-2` text; still focusable and copyable |
| Disabled | `disabled` + `sn-text-field__reason` with a lock icon | `opacity-disabled`; always say why and how to enable it |
| Count | `sn-text-field__count`, `data-over` when over | "18 / 40"; over limit turns `status-bad` with ✕ |

## Content rules
Labels are nouns in sentence case ("Set name", "ISRC"). Help gives a real example ("for example GBCEN2300412"). Errors say what is wrong and how to fix it: "ISRC must be 12 characters. This one has 10." No "Invalid input", no exclamation marks. Validate on blur or submit, not on every keystroke.

## Accessibility
Always a visible `<label for>`; placeholders are never the label. Help and error are linked with `aria-describedby`. The character count is announced after typing pauses and only within 10 characters of the limit or over it (GOV.UK character count); let people type past the limit and show the error rather than truncating.

## Responsive
Full width of the form column; forms stack to one column below `bp-tablet`. Inputs are 40px (44px on touch via the core input height plus padding).

## Do / don't
- Do keep the label above the input at every width.
- Don't disable a field without the reason next to it.
- Don't use read-only for values people can't act on; show them as text instead.

## In SongNodes / in the music library
Setlist name in `SetlistBuilder/index.tsx`, preset name in `FilterPanel.tsx`, `EditTrackModal.tsx` / `TrackEditModal.tsx` fields. In the Naarm Set Builder: Set name.
