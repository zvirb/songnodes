# Breadcrumbs

A trail of the levels above the current view, for drill-downs (Library › Bicep › Glue) and the mobile explorer's navigation trail, with each link in its destination module's colour.

## When to use
- Pages two or more levels below a module index, and any explore-by-hopping view where people need a way back.
- Not as the main navigation (NavDrawer), and not on module index pages (the PageHeader band already links home).

## Anatomy and markup
```html
<nav class="sn-breadcrumbs" aria-label="Breadcrumb">
  <ol class="sn-breadcrumbs__list">
    <li class="sn-breadcrumbs__item"><a class="sn-link sn-m-library" href="/library">…icon… Library</a></li>
    <li class="sn-breadcrumbs__item"><a class="sn-link sn-m-library" href="/library/artist/bicep">Bicep</a></li>
    <li class="sn-breadcrumbs__item"><span class="sn-breadcrumbs__current" aria-current="page">Glue</span></li>
  </ol></nav>
```
The "›" separator is CSS content with empty alt text (`content: "›" / ""`), so screen readers do not read it.

## Variants
- **Drill-down**: first crumb may carry its module icon.
- **Collapsed**: more than 4 levels → keep the first and last two, replace the middle with `<button class="sn-breadcrumbs__collapse" aria-label="Show 3 more levels">…</button>`; activating it reveals the hidden crumbs and moves focus to the first one.
- **Trail** (`sn-breadcrumbs--trail` + `__caption` "Navigation trail"): a boxed history of graph hops in the mobile explorer; label the nav "Navigation trail".

## States
Links follow `sn-link` (underlined, 600, destination colour). Current crumb is `fg`, bold, not a link. Long names truncate with an ellipsis at 24ch (current at 32ch) and keep the full name in `title`.

## Content rules
Use the object's own name: artist "Bicep", track "Glue", edge "Glue → So U Kno". Module crumbs use the module label exactly ("Key & mood").

## Accessibility (WAI-ARIA breadcrumb)
`nav` with `aria-label`, an ordered list, `aria-current="page"` on the last item. The collapse button names how many levels it hides.

## Responsive
Phone: crumbs wrap to new lines rather than scroll; touch targets grow to `touch-min`. Over 4 levels collapse at every width.

## Do / don't
- Do colour each link by where it goes: a track crumb inside Sources is Library-coloured.
- Don't repeat the page title as a separate heading right under a breadcrumb that already ends with it, unless it is the PageHeader title.
- Don't use breadcrumbs for steps in a process.

## In SongNodes
Replaces the "Navigation trail" list in `MobileTrackExplorer.tsx` and the back buttons in the track and edge detail modals; drill-down from Stats into a track.

## In the music library
Library › artist › track, and Sources › Radio plays › PBS Soul Time › episode when checking where a play came from.
