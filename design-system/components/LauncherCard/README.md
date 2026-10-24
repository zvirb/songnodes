# LauncherCard

A hub tile that takes you into one module: tonal card in the module's colour with its icon, a thin–bold title, one-line summary, one or two key figures and a status pill only when attention is needed.

## When to use
- The Home page and any module index that launches sub-areas.
- Not for content items (tracks, sets: use their own cards or rows), not for metrics dashboards (use stat tiles).

## Anatomy and markup
The whole card is one link (core `a.sn-card.sn-card--tonal`), named by its title and described by summary, figures and pill.
```html
<div class="sn-launcher-card__grid">
  <a class="sn-card sn-card--tonal sn-launcher-card sn-m-pipeline" href="/pipeline"
     aria-labelledby="lc-t" aria-describedby="lc-s lc-f lc-p">
    <div class="sn-card__head"><span class="sn-launcher-card__icon">…activity…</span>
      <span class="sn-pill" data-status="bad" id="lc-p">2 paused after errors</span></div>
    <h3 class="sn-title title-s" id="lc-t"><span class="sn-lead">Pipeline:</span> 9 scrapers</h3>
    <p class="sn-launcher-card__summary" id="lc-s">MixesDB and Setlist.fm paused after repeated errors.</p>
    <dl class="sn-launcher-card__figures" id="lc-f">
      <div class="sn-launcher-card__figure"><dt>running</dt><dd>7</dd></div>
      <div class="sn-launcher-card__figure"><dt>paused</dt><dd>2</dd></div></dl>
  </a></div>
```
`dt` comes first in the markup and is shown under the figure (`column-reverse`).

## Variants
- With or without status pill (outlined so it reads on the tonal fill).
- One or two figures. No more: a launcher is not a dashboard.

## States
Hover: border takes `--m`. Focus: brand focus ring around the whole card. Loading: `sn-skel` lines in place of title and figures. Module unavailable (Services not connected): keep the card, say so in the summary, pill `idle` "Not set up".

## Content rules
Title lead is the module label, bold part is the headline count: "Set builder: 12 saved sets". Summary is one sentence with the most recent or most urgent fact. Figure labels are lower-case nouns ("new this week").

## Accessibility
One tab stop per card. Name = title; description = summary, figures, pill. Pill colour always comes with glyph and words.

## Responsive
Grid `auto-fill, minmax(260px, 1fr)`: 1-up on phones, 2-up on tablets, 3-up at 960px, 4–5-up on wall screens. Cards keep a 188px minimum height so rows line up.

## Do / don't
- Do keep everything inside the card in module shades; only the status pill breaks out.
- Don't add buttons inside the card; it is one link.
- Don't use a left-border accent or gradient; the tonal fill is the identity.

## In SongNodes
New Home hub; replaces the onboarding overlay's feature list and the top-level panel switcher in `App.tsx`.

## In the music library
Library, Set builder and Sources tiles with this week's counts (new tracks, saved sets, radio plays).
