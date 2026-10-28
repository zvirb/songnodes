# DateRange

The calendar popover for choosing a from–to span: two months side by side, presets beside them, the range in words underneath. Use it for a span to export, print or filter by ("Plays to export", "Last heard between", "Gig dates"), past or future. Ported from the BeanAlliance `DateRange` (v4.17.3) and fitted to SongNodes in 1.3.0; every departure is marked **fitted, Markus to confirm**.

**Consumer provides:** the popover title (what the span is for), the current range or none, the day marks the page uses, its presets, the outcome button's label and what to do with the range. **The system provides:** the months, picking, keys, the live announcement, the range in words, and "today" as the Melbourne date.

## When to use / not use

| The person is… | Use |
|---|---|
| typing dates they know | `DateField` (the three boxes). Its range variant has a calendar button that opens this popover. |
| choosing a span to **export** or **print**, past or future | `DateRange` behind the export or print button, outcome "Download CSV" or "Print" |
| choosing a span for a **filter** or a **form** | `DateField` range with its calendar button, outcome "Use these dates" |
| moving through days, weeks or months on a page that shows one period | `PeriodNav`, not this |
| choosing one date | `DateField`, not this |

Typing is always possible (GOV.UK, USWDS): the calendar is a second way in, never the only one.

## Anatomy and markup

```html
<div class="sn-popover sn-date-range" id="dr" role="dialog" aria-labelledby="dr-t">
  <div class="sn-popover__head"><h3 class="sn-popover__title" id="dr-t" tabindex="-1">Plays to export</h3>
    <button class="sn-btn sn-btn--sm sn-btn--icon sn-btn--quiet" aria-label="Close">…x…</button></div>
  <div class="sn-date-range__body">
    <div class="sn-date-range__months">
      <div class="sn-date-range__month">
        <div class="sn-date-range__head">
          <button class="sn-btn sn-btn--sm sn-btn--icon sn-btn--quiet" aria-label="Previous month" title="Previous month">…chevron-left…</button>
          <h4 class="sn-date-range__title" id="m0">November 2026</h4>
          <button class="sn-btn sn-btn--sm sn-btn--icon sn-btn--quiet sn-date-range__next" aria-label="Next month">…chevron-right…</button>
        </div>
        <table class="sn-date-range__grid" role="grid" aria-labelledby="m0">
          <thead><tr><th class="sn-date-range__dow" scope="col" abbr="Monday">Mo</th>…</tr></thead>
          <tbody><tr>…<td role="gridcell" aria-selected="true">
            <button class="sn-date-range__day" data-iso="2026-11-09" data-range="start" tabindex="0"
              aria-label="Monday 9 November 2026, start of range"><span class="sn-date-range__n">9</span></button></td>…</tr></tbody>
        </table>
      </div>
      <div class="sn-date-range__month">… December 2026, with only a Next month button …</div>
    </div>
    <div class="sn-date-range__presets" role="group" aria-label="Preset dates">
      <button class="sn-chip" aria-pressed="false" data-preset="last-7-days">Last 7 days</button> …
    </div>
  </div>
  <ul class="sn-date-range__key" aria-label="Key"><li><span class="sn-date-range__code">PH</span> Public holiday</li> … <li><span class="sn-date-range__now-bar"></span> Today</li></ul>
  <div class="sn-date-range__foot">
    <p class="sn-date-range__sum"><b>Mon 9 – Fri 13 Nov 2026</b> · 5 days</p>
    <button class="sn-btn sn-btn--quiet">Clear</button><button class="sn-btn">Download CSV</button>
  </div>
  <p class="sn-sr" role="status" aria-live="polite"></p>
</div>
```

`SongNodes.dateRange(el, opts)` renders and runs all of this (artifacts and previews); React mirrors the markup and classes. Styles: `source/css/25-date-range.css`.

- **The popover** is a `Popover` (`surface-1`, `line` border, `radius-card`, `shadow-2`; booth: the 1px outline), sized to its content instead of Popover's 360px cap. Non-modal `role="dialog"` named by its title.
- **Months:** two, Monday first (weeks start Monday, DR-030). Each heading is the month and year in full ("November 2026") between Previous month / Next month (`chevron-left` / `chevron-right`, `sn-btn--icon sn-btn--sm sn-btn--quiet`); the first month has Previous, the second Next.
- **Presets** beside the months, separated by a `line` rule.
- **Key** under the months: one item per mark kind the page passes, then Today. A page with no marks has no key.
- **Footer:** the range in words and the day count, then Clear and the outcome button.

## Picking

- First click (or Enter / Space) sets **From**; the second sets **To**. A second pick before From swaps them, so From is always the earlier date. A third pick starts again from From.
- While only From is picked the footer reads "Tue 3 Nov 2026 · pick the end date". The outcome button with only From uses a one-day range.
- A preset sets both ends, shows them in the months and **leaves the popover open**. Picking a day, typing in the DateField or Clear unpresses it.
- Changes apply as they happen (`onChange`); the outcome button does the thing the page is for (`onApply`). An outcome that downloads or opens a tab runs synchronously inside that button's click, so the browser treats it as the person's own gesture.

## Colour and marks

| Mark | Treatment | Not colour alone because |
|---|---|---|
| Range ends (`data-range="start"`, `"end"`, `"single"`) | `brand-soft` fill, 2px `brand` edge, `fg` bold numerals; the outer corners rounded | bold numerals and the edge; "start of range" / "end of range" in the name |
| Days between (`data-range="in"`) | `brand-soft` fill, square corners so the span reads as one band | "in range" in the name; `aria-selected` on the cell |
| Today (`data-today`, `aria-current="date"`) | a 16 × 3px amber `now` bar along the top of the cell and a bold numeral; Today in the key | ", today" in the name and "Today" in `title` |
| Day mark with a code (`data-mark`) | the code in `fg-2` small data type under the number (`fg` inside the range), the number underlined in `line-strong` | the code itself; its name and kind in `title` and in the name |
| Data dot (a mark with no code) | a 4px `fg-2` dot under the number ("this day has records", such as plays heard) | its name in the announced name and `title` |
| Hover | `hover-bg` (over `brand-soft` in the range) | — |
| Focus | the system's 2px `focus` ring, 2px offset (3px in booth) | — |

- Selection is never a solid `brand` fill; today is never brand. Selection and today differ by hue and by the word, as `now` does everywhere (DR-024).
- Marks are categories, not states: neutral `fg-2` and `line-strong`, never a status colour.
- **Weekends are not greyed** (fitted, Markus to confirm): club nights are weekends, so Friday to Sunday are the days that matter most.

**Contrast, measured on the rendered colours** (WCAG 2.2; booth needs 7:1 for text):

| Pair | Dark | Light | Booth |
|---|---|---|---|
| `fg` numerals on `brand-soft` (range) | 12.7:1 | 13.8:1 | 15.7:1 |
| `fg` on `hover-bg` over `surface-1` | 10.8:1 | 15.5:1 | 13.0:1 |
| `fg` on hover over `brand-soft` | 10.5:1 | 12.6:1 | 10.1:1 |
| `fg-2` mark code on `surface-1` | 7.2:1 | 9.3:1 | 15.6:1 |
| `fg-3` weekday headings on `surface-1` | 5.5:1 | 6.2:1 | 12.3:1 |
| `brand` range edge vs `surface-1` (1.4.11, 3:1) | 4.3:1 | 6.2:1 | 10.7:1 |
| `brand` range edge vs `brand-soft` | 4.2:1 | 5.1:1 | 8.7:1 |
| `now` today bar vs `surface-1` (3:1) | 8.3:1 | 5.0:1 | 13.3:1 |
| `now` today bar vs `brand-soft` (today in range) | 8.0:1 | 4.1:1 | 10.9:1 |
| `line-strong` underline vs `surface-1` | 3.7:1 | 3.7:1 | 8.1:1 |

`brand-soft` itself is a tint (1.03–1.23:1 against `surface-1`), as on selected rows; the range is carried by the ends' edge, the bold numerals and the names, not by the tint.

## Presets

- `sn-chip` toggles with `aria-pressed` (the pressed chip inverts to `fg` with ✓, as FilterChip does), in a column beside the months; under them on narrower windows. Chips, not menu items: SongNodes has no menu-toggle item, and DateField's presets are already chips (fitted, Markus to confirm).
- Default set, in DateField's order: **Last 7 days · Last 30 days · This year**. Then the page's own named spans ("Summer 2026–27").
- Optional week presets for pages that plan or report by week: **Last week · This week · Next week**, Monday to Sunday, Melbourne dates (`SongNodes.calendar.preset`). A page offers only the presets that make sense for it and never reorders them.
- "Last 7 days" is today and the 6 days before; "Last 30 days" today and the 29 before; "This year" 1 January to today.

## Keyboard (WAI-ARIA APG date picker grid)

| Key | In the grid |
|---|---|
| ← / → | Previous / next day |
| ↑ / ↓ | Same day previous / next week |
| Home / End | Monday / Sunday of the week |
| Page Up / Page Down | Same day previous / next month (31 Jan → 28 Feb) |
| Shift + Page Up / Page Down | Same day previous / next year |
| Enter or Space | Set From, then To |
| Escape | Close and return focus to the button that opened it |
| Tab | Out of the grid to the next control (presets, Clear, the outcome button) |

- One tab stop in the months (roving `tabindex`): the focused day, else From, else today. Moving past the months shown moves the months.
- Opening from the DateField calendar button or a trigger puts focus on the grid (From, else today), not the title.

## Content rules

- Day names: "Tuesday 3 November 2026, Melbourne Cup, public holiday" + ", today" + ", start of range" / ", end of range" / ", in range" (one-day range: ", start and end of range").
- Range in words (`SongNodes.format.range`): "Mon 9 – Fri 13 Nov 2026" (same month), "Mon 30 Nov – Fri 4 Dec 2026" (same year), "Mon 28 Dec 2026 – Fri 8 Jan 2027" (across years), "Mon 9 Nov 2026" (one day); then "· 5 days" (calendar days, inclusive).
- The live region says the result after each pick: "From Tuesday 3 November 2026. Now pick the end date.", then "Tue 3 – Fri 13 Nov 2026, 11 days picked."; for a preset "Last week: Mon 19 – Sun 25 Oct 2026, 7 days."; for Clear "Dates cleared."
- The outcome button is named for what it does: "Use these dates", "Download CSV", "Print". Never "OK" or "Apply".
- Dates are date-only ISO values ("2026-11-03"): never converted through a time zone. "Today" is the Melbourne date (`SongNodes.calendar.today()`), never the device's UTC date.
- No emoji, no exclamation marks, sentence case.

## The outcome button is not primary

`sn-btn` (default), Clear `sn-btn--quiet` (fitted, Markus to confirm). The popover is non-modal and sits over a page or dialog that already has its one primary (the form's Save, the export dialog's Export), and Popover's own footers use default and quiet buttons. Making the popover's button primary would put two primaries in one view. If DateRange is ever used as the whole of a view (a page that only picks dates), its outcome becomes the primary.

## Responsive

Viewport queries on SongNodes breakpoints (the popover sizes to its content, so a container query has nothing to measure), mirrored by modifiers for a popover in a narrow column:

| Width | Layout | Modifier |
|---|---|---|
| ≥ 1100px (`bp-desktop`) | Two months, presets beside | — |
| 768–1099px | Two months, presets under them in a wrapping row | `sn-date-range--stacked` |
| < 768px (`bp-tablet`) | One month; the first month carries its own Next month button (`__next`) | `sn-date-range--one` |
| < 480px (`bp-phone`) | Full-width bottom sheet (`radius-sheet` top corners, `shadow-3`, up to 90dvh, scrolls inside), as Popover does on phones; the footer's range line takes its own row and Clear and the outcome share the next at equal widths | `sn-date-range--sheet` |

- On touch (`pointer: coarse`) every day cell, preset and month button is 44px (`touch-min`).
- `sn-date-range--static` puts the popover in the flow (documentation and previews only).

## Do / don't

- Do pass only the marks the page uses; the key follows them.
- Do keep the typed path (DateField) beside the calendar.
- Don't grey weekends or disable days to show a calendar's working days; this is a span picker, not a roster.
- Don't use a status colour for a mark, or brand for today.
- Don't close the popover on a preset or on the second pick: the person checks the range and presses the outcome.

## In SongNodes

Scrape history and "Recently scraped data" exports; the planned monitoring page's CSV export; "Last heard between" through DateField's calendar button.

## In the music library

"Plays to export" from the weekly run's plays, with RUN marks on run days and a dot on days with plays heard; gig dates for a set list with the week presets; "Last heard between" in the filter rail.

## Fitted decisions (BeanAlliance → SongNodes), Markus to confirm

1. Selection colour: BA's terracotta `accent-wash` / `accent` → SongNodes `brand-soft` / `brand` with `fg` numerals; never solid.
2. Today: BA's teal `today` → amber `now` bar + "today" in the name (DR-024).
3. Weekends: BA greys them (non-working) → not greyed (club nights are weekends).
4. Marks: BA's fixed plant calendar (PH, CL closures) → data the page passes in (`{date, code?, name, kind}`), with PH and RUN as the preview examples and a plain dot for "this day has records".
5. Count: BA's "working days" (holidays and closures excluded) → calendar days, inclusive.
6. Presets: BA's Last week · This week · Next week · Last 30 days · closures → DateField's Last 7 days · Last 30 days · This year, then the page's spans; the week presets optional.
7. Presets as `sn-chip` toggles (BA used `.mi.tog` menu toggles).
8. Footer: BA's two `.btn` → Clear quiet, outcome default (one-primary rule).
9. Responsive: BA's single 760px step → SongNodes' 1100 / 768 / 480 steps, a bottom sheet below 480px, 44px touch targets (BA kept control height on phones).
10. Month buttons: BA's `ph-caret-*` → Lucide `chevron-left` / `chevron-right` (SongNodes has no caret icons; chevrons step time in `PeriodNav`).
11. Grid semantics: BA's `div` grid of buttons → a `table role="grid"` with `th abbr` weekday names, `aria-selected` cells and `aria-current="date"` on today (APG).
12. Shift + Page Up / Page Down step a year (APG; BA had none).
