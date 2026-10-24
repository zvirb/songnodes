# RetiredPageNotice

Tells someone who followed an old route or link that the page moved (and where, as a link in the destination module's colour) or that it is retired with no replacement, with the dates.

## When to use
- Every retired route for 90 days (see 02 Information architecture): old DJ Interface tab states, the Classic interface, old artifact links, removed debug pages.
- After 90 days: 301 to the new route (moved) or 410 via `ErrorPage` (retired).

## Anatomy
| Region | Component |
|---|---|
| Shell | `AppHeader` ("SongNodes: Page moved"), `NavDrawer` |
| Card | `Card` `.sn-page-retired__card`, centred, max 36rem |
| Icon | `.sn-page-retired__icon` (`route` for moved, `archive` for retired), muted |
| Title | `h1.sn-title.title-l`: "This page has moved" / "This page is retired" |
| Reason | One or two sentences, `body-l` muted |
| Destination | `TextLink` in the destination module (`sn-m-sources`): "Go to Sources: Target tracks" |
| Facts | `.sn-page-retired__facts` (`dl`): old and new address in mono, date moved, until when the notice shows |
| Opt-in | `Checkbox` "Skip this notice on this device", **off by default**; when on, an `InlineMessage` confirms. There is no countdown and no automatic redirect |

Retired, no replacement: same card without a destination; facts give the date and "From 22 Jan 2027 this address answers “Gone” (410)"; links: "Go to Home" and, if useful, where the nearest thing lives ("Theme and text size are in Services: Settings").

## Content
Say what moved and why in plain words; dates as "24 Oct 2026"; never "404", "deprecated" or "sunset" in the title.

## States
Static. If the destination itself is unavailable, the link still shows; the destination page handles its own error.

## Responsive
Card fills the width minus gutters on phones; facts stay two columns (labels are short). Wall/booth: not used.

## Primary action
The destination link (moved) or Go to Home (retired). No primary button: this page only points.

## Variants in SongNodes
| Old | Kind | Destination |
|---|---|---|
| `rightPanelTab = 'targets'` | moved | Sources: Target tracks |
| `mode = 'play'` / `'plan'` | moved | Graph / Library |
| Classic interface (`djModeEnabled = false`) | moved | Graph (secondary link Library) |
| `debug-storage.html`, `test-credentials.html`, `setlist-demo.html`, … | retired | none; removed from the production build |

## Replaces
Silent redirects and blank screens for old routes; the Classic interface toggle.
