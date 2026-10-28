# DateField

Date entry in en-AU order (day, month, year) as three short boxes, shown back as "Sat 24 Oct 2026", with range presets such as "Last 7 days" for filters like "Last heard between". The range variant has a calendar button that opens `DateRange` (1.3.0).

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

### Calendar button (range variant, 1.3.0)
The typed boxes stay the main path; the calendar is a visible second way in (imported from BeanAlliance v4.17.3, where the hint said "pick it on the calendar" and the calendar had no visible entry).
```html
<fieldset class="sn-date-field sn-date-field--calendar">
  <legend class="sn-date-field__legend">Last heard between</legend>
  <div class="sn-date-field__presets">…</div>
  <div class="sn-date-field__range">
    …From group… <span class="sn-date-field__to" aria-hidden="true">to</span> …To group…
    <button type="button" class="sn-btn sn-btn--icon sn-date-field__pick" aria-label="Pick the dates on the calendar"
      title="Pick the dates on the calendar" aria-haspopup="dialog" aria-expanded="false" aria-controls="dr">…calendar…</button>
  </div>
  <div class="sn-popover sn-date-range" id="dr" hidden>…DateRange…</div>
</fieldset>
```
- `sn-btn sn-btn--icon` with the `calendar` icon, after the To group, level with the boxes; `control-md` (44px on touch). The `Tooltip` / `title` repeats the name.
- Pressing it opens `DateRange` under the fieldset with **focus on the grid** (From, else today). Escape, the close button or the outcome button closes it and returns focus to the calendar button; a click outside closes it without moving focus.
- Two-way: typed dates show in the months (`set`), and picked dates fill the boxes and their readable dates. A preset pressed in either place is pressed in both; typing or picking a day unpresses it.
- The outcome reads "Use these dates" and only closes the popover: the boxes already hold the dates.

## States
Error: `sn-field__error` under the legend, `aria-invalid` and a 2px `status-bad` border only on the wrong part. Presets: the active preset is pressed; typing a date or picking one on the calendar unpresses it. Calendar button: `aria-expanded="true"` while the popover is open.

## Content rules
Presets: "Last 7 days" (today and the 6 days before), "Last 30 days", "This year" (1 Jan to today). Dates shown "Sat 24 Oct 2026". Errors (GOV.UK): "Released on must be a real date. September has 30 days."; "Released on must include a month"; "The From date must be on or before the To date." Date-only values have no time zone: format them from their parts, not through `SongNodes.format` (which converts instants to Melbourne time).

## Accessibility
The calendar button's name is its `aria-label` ("Pick the dates on the calendar"); the grid follows `DateRange` (APG date picker keys). Fieldset + legend, a visible label per box, `inputmode="numeric"` (not `type="number"`), no auto-advance between boxes. The readable date is linked with `aria-describedby`.

## Responsive
The three boxes stay on one line at every width; From and To stack below about 480px, and the calendar button follows the To group. Below 480px the calendar opens as a full-width bottom sheet with one month (see `DateRange`).

## Do / don't
- Do accept "9" and "09" for months.
- Don't use a US month-first order or a placeholder like "dd/mm/yyyy" as the only hint.

## In SongNodes / in the music library
New: SongNodes has no date filter yet. The calendar button replaces any free-standing date picker for a span (scrape history and "Recently scraped data" will need one). In the Naarm Set Builder: "Last heard between" in the filter rail and the crate's Last heard column filter.
