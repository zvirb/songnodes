# Information architecture

How SongNodes and the music library are divided into pages, how those pages are reached, and which source wins when two sources or two designs disagree.

## What counts as one page

A page does one job, has one primary action and belongs to one module.

- One job: a sentence of the form "Use this page to … ". If it needs "and", split it or move the second job into a `SideSheet`.
- One primary action: one `Button` with `.sn-btn--primary` per view (see 03-colour). Everything else is secondary, quiet or a row action.
- One module: the page header band, drawer row and links to it all use that module's colour and icon. A page never mixes two module hues in its chrome.
- A view that inspects one item from a list (track, edge, job) is a `SideSheet` over the list, with a deep-linkable URL; it becomes `TrackDetailPage` only when opened directly.
- A question that blocks progress (confirm, name a set, choose a playlist) is a `Dialog` or `ConfirmDialog`. Nothing else is modal.
- Tabs (`Tabs`) only switch views of the same object on the same page (Track detail: Overview, Audio analysis, Sources). Tabs never act as site navigation; site navigation is the `NavDrawer`.

## Page inventory

Owner of every surface: Markus. Status: live (exists today, to be restyled), planned (no UI yet), retired (remove).

### SongNodes

| Page | Module | Route | Purpose | Primary action | Status | Pattern |
|---|---|---|---|---|---|---|
| Home | – | `/` | Jump into a module; see what changed | – (launcher) | planned | `HomePage`, `LauncherCard` |
| Graph | graph | `/graph` | Play mode: browse neighbours of the now-playing track (replaces DJ Interface PLAY) | Set as now playing | live | `GraphExplorerPage` |
| Graph filters | graph | `/graph?filters=open` | Narrow nodes and edges by type, year, genre, BPM | Apply filters | live | `FilterRail` (desktop), `SideSheet` (phone); replaces `GraphFilterPanel` modal |
| Edge detail | graph | `/graph?edge=:id` | Why two tracks are connected | Focus in graph | live | `SideSheet`; replaces `EdgeDetailsModal` |
| Graph stats | graph | `/graph/stats` | Graph metrics, distributions, CSV/JSON export | Export CSV | live | `MonitoringPage` layout; replaces `StatsPanel` |
| Library | library | `/library` | Plan mode: search and filter the track list (replaces DJ Interface PLAN left column) | Add to set | live | `LibraryPage` |
| Track detail | library | `/library?track=:id`, `/track/:id` | Analysis, key, sources, IDs for one track (replaces `TrackDetailsModal` and the "Track analysis" tab) | Add to set | live | `SideSheet` / `TrackDetailPage` |
| Edit track | library | `/track/:id/edit` | Correct metadata | Save changes | live | `Dialog`; replaces `EditTrackModal` and `TrackEditModal` |
| Key & mood | harmony | `/harmony` | Camelot wheel, key distribution, mood flow (replaces "Key & mood" tab) | Filter library by key | live | `MatrixPage`, `CamelotWheel` |
| Pathfinder | paths | `/paths` | Route from a start to a finish track via waypoints (replaces "Pathfinder" tab and `PathBuilder`) | Find route | live | `GraphExplorerPage` + `SideSheet` |
| Saved sets | sets | `/sets` | All saved sets | New set | live | `LibraryPage` (list of `SetCard`) |
| Set builder | sets | `/sets/:id` | Order a set, check transitions, export (replaces `SetlistBuilder`) | Save set | live | `SetBuilderPage` |
| Send to TIDAL / Spotify | sets | `/sets/:id?send=tidal` | Push a set to a playlist (replaces "TIDAL" and "Spotify" tabs) | Send to TIDAL | live | `SideSheet` |
| Set print | sets | `/sets/:id/print` | Booth printout of the running order | Print | planned | `PrintSheet` |
| Target tracks | sources | `/sources/targets` | Tracks SongNodes is hunting for; priority, archive, import/export JSON | Add target track | live | `LibraryPage`; replaces `TargetTracksManager` and the "Targets" tab |
| Import tracklist | sources | `/sources/import` | Paste or upload a tracklist and match it | Import tracks | live | page with `TracklistPaste`; replaces `TracklistImporter` modal |
| Artist attribution | sources | `/sources/attribution` | Fix tracks with missing or wrong artists | Save attribution | live | `LibraryPage`; replaces `ArtistAttributionManager` modal |
| Monitoring | pipeline | `/pipeline` | Recently scraped data, pipeline progress, scraper and proxy health | Run scrapers now | planned | `MonitoringPage` |
| Jobs | pipeline | `/pipeline/jobs` | Scraper, enrichment and audio-analysis jobs with status | Retry failed | planned | `LogPage` |
| Validation | pipeline | `/pipeline/validation` | Validation findings by severity | Open track | planned | `LogPage` |
| Data quality review | pipeline | `/pipeline/review` | Approve, reject or skip low-confidence matches | Approve | live | `LibraryPage` (queue) ; replaces `DataQualityReview` |
| Settings | services | `/settings`, `/settings/:settingId` | Connect Spotify/TIDAL, API keys, theme, display preferences, data storage | Save settings | live | `SettingsPage` (card grid & individual sub-routes); replaces `SettingsPanel`, `APIKeyManager` overlays |
| Sign-in return | services | `/callback/spotify`, `/oauth/callback` | Finish a service connection, then return | Back to settings | live | `AuthCallbackPage`; replaces `OAuthCallback` |
| Not found / server error | – | nginx `404.html`, `50x.html` | Explain and offer a way home | Go to home | live | `ErrorPage` (static build) |
| Quick search | library | any page, Ctrl/Cmd K or / | Find a track, artist or page | Open result | live | `CommandPalette`; replaces `QuickSearch` |
| Shortcuts | – | any page, ? | List keyboard shortcuts | – | planned | `ShortcutSheet` |
| Context menu | graph | right-click / long-press | Node, edge, empty-canvas actions | – | live | `ContextMenu`; replaces `ContextMenu.tsx` and `RadialMenu` |
| Onboarding overlay | – | – | Replaced by first-run `EmptyState` on Home and the `ShortcutSheet` | – | retired | – |
| Mobile track explorer | – | – | Replaced by `LibraryPage` reflow below `bp-tablet` | – | retired | – |
| Classic interface | – | `/` when DJ mode off | Replaced by Graph and Library | – | retired | `RetiredPageNotice` |
| Debug and demo pages | – | `test-credentials.html`, `debug-storage.html`, `fix-structure.html`, `setlist-demo.html`, `visualization-controls-demo.html`, `test-component-structure.html`, `DesignTrendsShowcase` | Developer scaffolding | – | retired | remove from the production build; nginx returns 404 |
| Swagger UI (FastAPI `/docs`) | pipeline | third-party | API reference | – | live | not restyled; admin only; linked from Monitoring with `.sn-link--ext` |
| GraphiQL | pipeline | third-party | GraphQL explorer | – | live | as above |
| Grafana | pipeline | `/monitoring/` (nginx) | Metrics dashboards | – | live | as above |

### Music library

| Page | Module | Route | Purpose | Primary action | Status | Pattern |
|---|---|---|---|---|---|---|
| Library | library | `#/library` | The crate: filter by Pillar, Energy tier, Rotation, Heard on, Tags | Build set from crate | live (Naarm Set Builder) | `LibraryPage` |
| Set builder | sets | `#/set` | Shape, length, genre mix, build, edit running order | Build set | live | `SetBuilderPage` |
| Saved sets | sets | `#/sets` | Sets saved on this device and queued for the weekly run | New set | live | `SetCard` list |
| Weekly run report | sources | `#/run/2026-10-25` | What the weekly run added, changed and pushed to TIDAL | Review new tracks | planned | `WeeklyGridPage` |
| Radio plays by day | sources | `#/plays/2026-10-24` | Plays per show for one day (PBS, 3RRR, triple j) | Add to library | planned | `DailyViewPage` |
| Set print | sets | `#/set/print` | Printable running order | Print | planned | `PrintSheet` |

## Permissions in the interface

- Hide what a role can never do. A viewer with a shared link never sees "Clear queue", API keys or Pipeline in the drawer.
- Disable and explain what the person can't do right now: "Send to TIDAL" is disabled with helper text "Connect TIDAL in Settings to send sets" and a `TextLink` to Settings (Services colour). Use `aria-disabled="true"` so it stays focusable and announces the reason via `aria-describedby`.
- Read-only views carry a "View only" `StatusPill` (`data-status="info"`) next to the page title and drop every edit control rather than disabling dozens of them.
- Admin-only surfaces (Monitoring, Jobs, third-party tools) live under Pipeline and are hidden for non-admins.

## Page retirement and redirects

- Every retired route keeps working for 90 days and renders `RetiredPageNotice`: what moved, where, one `TextLink` in the destination module colour, and the date the redirect becomes permanent.
- After 90 days: a 301 to the new route if there is one, otherwise 410 via `ErrorPage`.
- Old in-app state maps to routes:

| Old state (DJInterface / App.tsx) | New route |
|---|---|
| `mode = 'play'` | `/graph` |
| `mode = 'plan'` | `/library` |
| `rightPanelTab = 'analysis'` | `/library?track=:id` |
| `rightPanelTab = 'keymood'` | `/harmony` |
| `rightPanelTab = 'pathfinder'` | `/paths` |
| `rightPanelTab = 'tidal'` | `/sets/:id?send=tidal` |
| `rightPanelTab = 'spotify'` | `/sets/:id?send=spotify` (connection: `/settings/streaming-services`) |
| `rightPanelTab = 'targets'` | `/sources/targets` |
| `leftPanel = 'search'` | `/library` with `SearchField` focused |
| `leftPanel = 'setlist'` | `/sets` |
| Classic interface (`djModeEnabled = false`) | `/graph` |

## Module and section identity

- Colour, icon and name always appear together: drawer row, `LauncherCard`, `PageHeader` band, `Breadcrumbs`. Never the colour alone, never the icon alone in navigation.
- Use the module table in the brief (`SongNodes.modules`); labels are exactly "Graph", "Library", "Set builder", "Pathfinder", "Key & mood", "Sources", "Pipeline", "Services".
- A link carries the colour of where it goes, not where it is.

## Content imported from other sources

| Data | Authoritative source | Others |
|---|---|---|
| Track identity (artist, title, ISRC, duration) | SongNodes DB (after enrichment) | Spotify, TIDAL, Beatport, MusicBrainz are inputs |
| Adjacency, similarity, graph edges | SongNodes DB | 1001tracklists, MixesDB, Setlist.fm are inputs |
| Pillar, Rotation, Tags, energy-check flag, Heard on | Music library ledger | – |
| Energy, BPM, key | Ledger value when hand-set, else SongNodes audio analysis, else Mixed In Key import | show which in `SourceBadge` |
| Availability, TIDAL ID, playlist state | TIDAL | – |
| Spotify ID, Spotify availability | Spotify | – |

- Wherever imported data is shown, show its source (`SourceBadge`) and its age (`FreshnessStamp`). When two sources disagree, show the authoritative value and list the others in a `Disclosure` "Other sources".

## Conflicts between source designs

Decision order when two designs disagree: Markus's choices page > this system > SongNodes `styles/tokens.css` > the Naarm Set Builder artifact > inline iOS-palette styles in components.

| Conflict | Found in | Resolution |
|---|---|---|
| Brand colour: Matrix green `#00ff41` vs blue `#44aaff` vs iOS `#7ED321` / `#4A90E2` mode buttons | `styles/tokens.css`, `DJInterface.tsx` | Lavender `brand`; Play/Plan is a `SegmentedControl` in neutral surfaces |
| Three Camelot tables | `utils/camelotData.ts` (1A = C major, wrong), `CamelotWheel.tsx` inline, `utils/harmonic.ts` | Standard mapping in `harmonic.ts` and `SongNodes.camelot` (1A = A♭ minor, 8A = A minor, 8B = C major); delete the others |
| Two compatibility palettes | `utils/harmonicUtils.ts` (Tailwind green/yellow/orange/red, ✓✓ ✓ ~ ✗), `HarmonicCompatibility.tsx` (`#7ED321` `#F5A623` `#FFA500` `#D0021B`) | `compat-*` tokens with ● ◐ ○ ✕ and words via `CompatibilityBadge` |
| Three energy drawings | `EnergyMeter.tsx` bars, `PathBuilder.tsx` curve, `SetlistBuilder/AnalyticsPanel.tsx` chart | `EnergyBar` in rows, `EnergyWave` for sets and paths, both on `energy-1…10` |
| Per-key colours and "mood" words | `camelotData.ts`, `CamelotWheel.tsx` | `key-1a…key-12b`; mood words removed (not data) |
| Emoji icons | header, tabs, toasts, alerts | Lucide icons plus words |
| Modal z-indexes 1000, 2000, 9999, 10000, 10001 | 14 components, `useToast.tsx` | `z-*` scale: drawer 40, overlay 50, dialog 60, popover 70, toast 80, tooltip 90 |
| System font stack, Monaco mono | `styles/tokens.css` | Sora, Inter, JetBrains Mono (04-typography) |
| `alert()` / `confirm()` | `DJInterface.tsx` clear queue | `ConfirmDialog` + `Toast` |
