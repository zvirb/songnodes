# HomePage

The launcher at `/`: what changed since your last visit, one tonal card per module and a health strip, so you can jump anywhere in one tap.

## When to use / not use
The only page at `/` in both products (the music library uses the same page with its own rows). Not a dashboard: figures are teasers that link into modules; deep monitoring lives in Pipeline.

## Anatomy
| Region | Component | Notes |
|---|---|---|
| Shell | `AppHeader` (lead "SongNodes", title "Home"), `NavDrawer` (Home current), toast region, `.sn-skip` | `.sn-page` on the preview root, `.sn-page__main` around content |
| Title | `PageHeader` without a module band (decided: Home has no band, since it belongs to no module): `SongNodes: **Home**` (`title-l`), one-line description, `FreshnessStamp` in the meta row | No greeting, no primary action (a launcher has none) |
| Since your last visit | `SectionHeading` + `FigureTile` row (max 4): figure, label, delta, link in the destination module colour, `StatusPill` only for problems | `.sn-page__section` |
| Modules | `LauncherCard` × 8 in drawer order, tonal per module, attention pill only when needed | 4 columns ≥ 1100px, 2 from 768px, 1 on phones (`.sn-page-home .sn-launcher-card__grid`) |
| Recently opened | Two `Card`s: 5 sets (`TextLink` sets colour + mono stats + relative time with absolute tooltip) and 5 tracks (`TextLink` library colour + `EnergyBar`, `KeyBadge`, `BpmReadout`) | `.sn-page-home__recent`, `.sn-page__list`, `.sn-page__item` |
| Health | `ServiceStatus` rows for problems only, then one line of ok `StatusPill`s | Link "Open Pipeline health" |

## Data the page needs
`HomePageProps` (types/60-pages-a.d.ts): module figures, changes since `lastVisit` (stored per device), recent sets and tracks (per device), health summary, library `dataFrom`.

## States
- First load: `LoadingState` tiles shaped like the launcher grid (`__tiles`), stamp reads "Loading…". Figures never animate in.
- Refresh: old figures stay; `FreshnessStamp` shows "Updating…"; changed figures swap in place.
- Empty (first run): "Since your last visit" becomes an `EmptyState` "Nothing yet. Import a tracklist or run the weekly build." with a Sources link; Recently opened lists hide.
- Error: a failed module figure shows an en dash (`sn-none`) on its card, and one `ErrorState` replaces only the failed region; cards stay links.
- Offline: `ConnectionStatus` in the header plus its banner under the header; figures show the last data with its stamp.

## Responsive
Phone: one column, tiles 2-up, cards stacked; header keeps hamburger, wordmark, search, more. Tablet: 2-up cards. Desktop: 4-up. Wall (≥1920): content stays at `content-max` 1400px, centred. Booth theme: same order, larger type, cards grow taller (no truncation).

## Primary action
None. Each card is one link; nothing else inside it is focusable.

## Replaces
SongNodes: the `djModeEnabled` switch and onboarding overlay in `App.tsx` (first-run guidance moves to the empty state). Music library: the artifact had no index; its tabs become drawer rows and launcher cards.
