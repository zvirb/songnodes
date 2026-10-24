# ShowMore

Loads long tables in batches ("Showing 150 of 1,284 tracks" + "Show 300 more") and pages review queues with numbered pagination, without losing the reader's place.

## When to use
- **Show more**: lists people scan top to bottom (crate, radio plays, scraper jobs).
- **Pagination**: queues people work through and return to by position (data-quality review, target tracks).
- Not for time periods (PeriodNav) and not for infinite scroll: always an explicit button.

## Anatomy and markup
```html
<div class="sn-show-more">
  <span class="sn-show-more__count" role="status">Showing <b>150</b> of <b>1,284</b> tracks</span>
  <div class="sn-show-more__actions">
    <button class="sn-btn sn-btn--sm">Show 300 more</button>
    <button class="sn-btn sn-btn--sm sn-btn--quiet">Show all 1,284</button>
  </div></div>

<div class="sn-show-more">
  <span class="sn-show-more__count">Items <b>61–80</b> of <b>214</b> waiting for review</span>
  <nav aria-label="Review queue pages"><ul class="sn-show-more__pages">
    <li><button class="sn-show-more__page" aria-label="Previous page">‹</button></li>
    <li><button class="sn-show-more__page" aria-label="Page 1">1</button></li>
    <li class="sn-show-more__gap" aria-hidden="true">…</li>
    <li><button class="sn-show-more__page" aria-current="page" aria-label="Page 4">4</button></li>
  </ul></nav></div>
```

## Variants
- Batch size: 150 first, 300 per click for tracks; smaller for heavier rows.
- "Show all" only when the total is small enough to render well (up to about 2,000 rows).
- Pagination shows first, last, current ±1 and gaps.

## States
- Loading a batch: button `aria-busy="true"` with spinner and "Loading 300…".
- Last batch: "Show the last 84"; when all are shown the buttons go and the count stays.
- New rows get `sn-show-more__new` (a thin `line-strong` edge) until the next batch; rows never animate in.
- Current page: `aria-current="page"`, `brand-soft` fill and `brand` border. Disabled arrows: `aria-disabled`.

## Content rules
"Showing 150 of 1,284 tracks" (counts with thousands separators, the noun of the table). Buttons name the amount: "Show 300 more". Queue count says what the items are waiting for.

## Accessibility
- The count is a status region; after loading it adds "300 more tracks added".
- Focus moves to the first new row (`tabindex="-1"`), so keyboard and screen-reader users continue where the new content starts; the page does not jump because rows are appended below.
- Page buttons are named "Page 4"; the list is in a labelled `nav`.

## Responsive
Phone: count above, buttons full width below (wraps naturally); page numbers reduce to current ±1. Touch targets 44px.

## Do / don't
- Do keep sort and filters when loading more; the batch continues the same order.
- Don't auto-load on scroll; it breaks keyboard use and the footer.
- Don't reset to page 1 after approving an item; stay on the page.

## In SongNodes
Replaces unbounded lists in the library list, `TargetTracksManager.tsx` and the review queue in `DataQualityReview.tsx`; scraper job history in Pipeline.

## In the music library
The crate table ("Showing 150 of 1,284 tracks") and the "Heard on" history per show.
