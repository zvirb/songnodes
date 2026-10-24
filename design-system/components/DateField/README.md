# DateField

Date entry in en-AU order (day, month, year) as three short boxes, shown back as "Sat 24 Oct 2026", with range presets such as "Last 7 days" for filters like "Last heard between".

## When to use / not use
Use three-field entry for dates people know (release date, a show date) and for date ranges in filters. Use the native `type="date"` (`sn-date-field__native`) in dense desktop forms where a picker helps, always with the readable date shown underneath because browsers display it in their own locale. For relative times ("3 h ago") use text, not a field.

## Anatomy & markup
```html
<fieldset class="sn-date-field">
  <legend class="sn-date-field__legend">Released on</legend>
  <p class="sn-date-field__help">For example, 24 10 2026</p>
  <div class="sn-date-field__parts">
    <div class="sn-date-field__part"><label for="d">Day</label><input class="sn-input" id="d" inputmode="numeric" maxlength="2"></div>
    <div class="sn-date-field__part"><label for="m">Month</label><input class="sn-input" id="m" inputmode="numeric" maxlength="2"></div>
    <div class="sn-date-field__part sn-date-field__part--year"><label for="y">Year</label><input class="sn-input" id="y" inputmode="numeric" maxlength="4"></div>
  </div>
  <span class="sn-date-field__shown">Sat 24 Oct 2026</span>
</fieldset>
```
Range: an outer fieldset ("Last heard between") with `sn-date-field__presets` (`sn-chip` buttons, `aria-pressed`), then `sn-date-field__range` holding "From" and "To" groups.

## States
Error: `sn-field__error` under the legend, `aria-invalid` and a 2px `status-bad` border only on the wrong part. Presets: the active preset is pressed; typing a date unpresses it.

## Content rules
Presets: "Last 7 days" (today and the 6 days before), "Last 30 days", "This year" (1 Jan to today). Dates shown "Sat 24 Oct 2026". Errors (GOV.UK): "Released on must be a real date. September has 30 days."; "Released on must include a month"; "The From date must be on or before the To date." Date-only values have no time zone: format them from their parts, not through `SongNodes.format` (which converts instants to Melbourne time).

## Accessibility
Fieldset + legend, a visible label per box, `inputmode="numeric"` (not `type="number"`), no auto-advance between boxes. The readable date is linked with `aria-describedby`.

## Responsive
The three boxes stay on one line at every width; From and To stack below about 480px.

## Do / don't
- Do accept "9" and "09" for months.
- Don't use a US month-first order or a placeholder like "dd/mm/yyyy" as the only hint.

## In SongNodes / in the music library
New: SongNodes has no date filter yet (scrape history and "Recently scraped data" will need one). In the Naarm Set Builder: "Last heard between" in the filter rail and the crate's Last heard column filter.
