# PAT rules (generated)

| ID | Rule | Check | Test |
|---|---|---|---|
| PAT-001 | A new page shall be built from the closest of the page patterns by composing its listed components and not by inventing a layout. | judgement | Pass if the page maps to a pattern in the catalogue. |
| PAT-002 | Every pattern except ErrorPage, AuthCallbackPage and PrintSheet shall sit inside the shell of AppHeader, NavDrawer, CommandPalette and toast region. | dom | Pass if shell elements are present on all other pages. |
| PAT-003 | Every shell page shall provide a skip link .sn-skip to <main>. | dom | Pass if .sn-skip exists with href targeting the main element. |
| PAT-004 | Page content width shall be capped at content-max (1400px) and centred. | lint | Pass if main max-width is var(--content-max) with auto margins. |
| PAT-005 | Side gutter shall be space-4 on phones, space-6 from bp-tablet and space-8 from bp-desktop. | lint | Pass if padding-inline matches per breakpoint. |
| PAT-006 | Vertical spacing between sections shall be space-8. | lint | Pass if section gap is var(--space-8). |
| PAT-007 | Vertical spacing inside a section shall be space-4. | lint | Pass if inner section gap is var(--space-4). |
| PAT-008 | Section headings shall use SectionHeading rendered as h2. | dom | Pass if each section heading is an h2 SectionHeading. |
| PAT-009 | Loading states shall use LoadingState with skeletons shaped like the content. | dom | Pass if pending regions render LoadingState. |
| PAT-010 | Errors shall use ErrorState in place of the failed region only. | dom | Pass if a failed region is replaced by ErrorState and the rest renders. |
| PAT-011 | Empty regions shall use EmptyState. | dom | Pass if empty regions render EmptyState. |
| PAT-012 | HomePage greeting band shall use .sn-title.display-xl "SongNodes", one line of body-l fg-2 and a FreshnessStamp. | dom | Pass if the band contains those three parts. |
| PAT-013 | HomePage launcher grid shall show eight LauncherCards in 4 columns at bp-desktop and above, 2 on tablet and 1 on phone. | visual | Pass if columns are 4, 2 and 1 at the breakpoints. |
| PAT-014 | HomePage shall include a "Recently opened" SectionHeading with a list of up to 5 recent sets and tracks as TextLinks. | dom | Pass if the list has at most 5 links. |
| PAT-015 | HomePage shall include a health strip of ServiceStatus for API, scrapers, Spotify and TIDAL with only problems expanded. | dom | Pass if four ServiceStatus exist and only failing ones are expanded. |
| PAT-016 | LibraryPage shall begin with PageHeader (Library: Crate) whose primary action is none or "Build set from filters". | dom | Pass if the header primary is absent or has that label. |
| PAT-017 | LibraryPage shall have a stats row of four FigureTiles. | dom | Pass if the row has 4 FigureTile. |
| PAT-018 | LibraryPage shall have a FilterRail of rail-w width, sticky at z-sticky, with SearchField, FilterChip groups, Checkbox conditions and "Clear filters". | dom | Pass if the rail has these parts, width var(--rail-w) and z-index var(--z-sticky). |
| PAT-019 | LibraryPage DataTable columns shall be Energy (EnergyBar), Track (TrackCell), BPM, Key (KeyBadge), Pillar, Rotation (CategoryTag), Heard (SourceBadge count) and an add-to-set Button --sm --icon plus. | dom | Pass if columns and cell components match. |
| PAT-020 | LibraryPage track detail shall open in a SideSheet addressed by ?track=. | dom | Pass if selecting a track opens a SideSheet and sets track. |
| PAT-021 | Below bp-tablet the LibraryPage rail shall become a "Filters" button with a SideSheet. | dom | Pass if below bp-tablet the rail is replaced by a Filters button. |
| PAT-022 | Below bp-phone LibraryPage rows shall render as two-line list items (row-two-line) with the track on line 1 and energy, key and BPM on line 2. | visual | Pass if at phone width rows are two lines in that arrangement. |
| PAT-023 | SetBuilderPage header shall be PageHeader (Set builder: <set name>) with primary "Build set", secondary "Save set", and overflow items Copy tracklist, Export, Print set, Send to TIDAL and Delete. | dom | Pass if header actions match. |
| PAT-024 | SetBuilderPage controls Card shall hold a TextField set name, SelectField shape, NumberField length in minutes, three RangeSliders for genre mix weights and a pool SelectField. | dom | Pass if the Card contains those fields. |
| PAT-025 | SetBuilderPage shall show a ChartFrame with EnergyWave (bars per slot, dashed target). | dom | Pass if ChartFrame contains EnergyWave. |
| PAT-026 | SetBuilderPage running order shall be a SetSlot list with TransitionNote strips and ShowMore spares per slot. | dom | Pass if slots are separated by TransitionNote. |
| PAT-027 | SetBuilderPage shall show saved sets as a SetCard grid. | dom | Pass if a SetCard grid exists. |
| PAT-028 | At bp-wide and above SetBuilderPage shall place controls in a 360px left column with wave and running order on the right. | visual | Pass if the layout is two columns with a 360px left column. |
| PAT-029 | On tablet and phone SetBuilderPage shall use one column and collapse controls into a Disclosure once a set exists. | dom | Pass if controls are inside Disclosure when a set exists on narrow widths. |
| PAT-030 | GraphExplorerPage shall have a compact one-line PageHeader with title, Play/Plan SegmentedControl (?mode=), GraphControls button and overflow. | dom | Pass if header contains these four parts. |
| PAT-031 | GraphExplorerPage canvas shall be a PIXI canvas filling the remaining height with GraphStyles from tokens, zoom-in/zoom-out, reset (crosshair) and locate (locate-fixed) controls and a legend. | dom | Pass if the canvas and controls are present. |
| PAT-032 | GraphExplorerPage side panel shall show "Up next" recommendations in Play and Tabs (Track analysis, Key & mood, Pathfinder, TIDAL, Spotify, Target tracks) addressed by ?tab= in Plan. | dom | Pass if the panel content depends on mode as stated. |
| PAT-033 | Play recommendations shall use TrackCell, CompatibilityBadge and a score band. | dom | Pass if each recommendation has those three. |
| PAT-034 | GraphExplorerPage overlays shall be ContextMenu (node, edge, empty canvas), Popover node summary and SideSheet track detail. | dom | Pass if the three overlays exist. |
| PAT-035 | GraphExplorerPage Play mode shall be the booth view with fewer controls, control-lg sizing, recommendations first and the canvas secondary. | judgement | Pass if Play mode has reduced controls at control-lg. |
| PAT-036 | GraphExplorerPage Plan mode shall expose all controls. | judgement | Pass if Plan exposes every control. |
| PAT-037 | On phones GraphExplorerPage shall show the list view with the canvas behind a "Show graph" button. | dom | Pass if at phone width the list shows and a Show graph button reveals the canvas. |
| PAT-038 | TrackDetailPage shall contain PageHeader (Track: <name>), an identity row (KeyBadge with name, BpmReadout, EnergyBar, duration), a KeyValueGrid with CopyButtons, a WaveformStrip, a "Heard on" SectionHeading with SourceBadges, a "Plays well with" list, and a "Raw data" Disclosure. | dom | Pass if all seven parts are present. |
| PAT-039 | The SideSheet track detail shall serve the same content as TrackDetailPage. | judgement | Pass if the sheet reuses the page content components. |
| PAT-040 | LogPage shall have a PageHeader with a primary action such as "Add target track" or "Import tracklist". | dom | Pass if the header has a primary add/import action. |
| PAT-041 | LogPage entry shall be an inline Card form or TracklistPaste or FileDrop. | dom | Pass if an entry component is present. |
| PAT-042 | LogPage log shall be a DataTable newest first with time (mono, Melbourne), what, who/source, result StatusPill and row overflow. | dom | Pass if columns match and rows sort by time descending. |
| PAT-043 | LogPage shall show a selection bar when rows are selected, reading "3 selected · Archive · Export · Clear". | dom | Pass if selecting rows reveals the bar with those actions. |
| PAT-044 | DailyViewPage shall consist of PageHeader, a day PeriodNav, a FigureTile row and a timeline list grouped by show or scraper (.sn-group rows). | dom | Pass if those four parts exist. |
| PAT-045 | DailyViewPage timeline items shall show time, TrackCell and SourceBadge. | dom | Pass if each item has the three parts. |
| PAT-046 | DailyViewPage shall show an amber --now line at the current time on today. | dom | Pass if the now line appears only when the day is today. |
| PAT-047 | Show air times shall come from each source's schedule in the library data and never from fixed slots. | lint | Fail if source code hardcodes air times. |
| PAT-048 | DailyViewPage shall be read-only with no edit controls, only links to detail. | dom | Fail if the page has input or edit controls. |
| PAT-049 | WeeklyGridPage shall have a week PeriodNav and a grid with rows for sources that aired and columns Mon–Sun. | dom | Pass if columns are Mon to Sun. |
| PAT-050 | WeeklyGridPage cells shall hold counts or SetCard minis. | dom | Pass if cells hold counts or SetCard minis. |
| PAT-051 | WeeklyGridPage shall mark today's column header in amber --now. | lint | Pass if today's header uses var(--now). |
| PAT-052 | WeeklyGridPage shall include a week total column. | dom | Pass if a total column exists. |
| PAT-053 | Below bp-tablet WeeklyGridPage shall become one list per day. | dom | Pass if below bp-tablet the grid renders as per-day lists. |
| PAT-054 | MatrixPage shall consist of PageHeader, a SegmentedControl for matrix type, and a Heatmap or DataTable with sticky first column and header. | dom | Pass if those parts exist with sticky first column and header. |
| PAT-055 | MatrixPage cell selection shall filter a DataTable below with a result line such as "38 tracks in 8A at energy 7". | dom | Pass if selecting a cell filters the table and shows the count line. |
| PAT-056 | MatrixPage shall always offer "Show as table". | dom | Pass if a Show as table control exists. |
| PAT-057 | MonitoringPage header shall be PageHeader (Pipeline: Health) with FreshnessStamp and ConnectionStatus for live updates. | dom | Pass if the header contains those three. |
| PAT-058 | MonitoringPage shall show a Banner per active incident before other regions. | dom | Pass if incident Banners precede Health. |
| PAT-059 | MonitoringPage health region shall be a ServiceStatus grid for scrapers, proxies, enrichment, validation, API and database. | dom | Pass if six ServiceStatus entries exist. |
| PAT-060 | MonitoringPage runs region shall use StagedProgress for running jobs and a DataTable of recent jobs with StatusPill. | dom | Pass if both exist. |
| PAT-061 | MonitoringPage recently scraped region shall be a newest-first DataTable with TrackCell, SourceBadge and time. | dom | Pass if columns and sort match. |
| PAT-062 | MonitoringPage trends region shall use ChartFrame with Sparklines for jobs per hour and failures per hour. | dom | Pass if two Sparklines are inside ChartFrame. |
| PAT-063 | MonitoringPage shall link to Grafana with TextLink --ext and answer whether anything is broken right now. | dom | Pass if a TextLink --ext to Grafana exists. |
| PAT-064 | SettingsPage shall present a left list of sections on desktop and stacked sections on phones. | visual | Pass if layout differs as stated by width. |
| PAT-065 | SettingsPage sections shall be Appearance (PreferencesPanel: theme, text size, density), Connections (Spotify and TIDAL with ServiceStatus and connect buttons in svc-*), API keys (SecretField), Keyboard shortcuts (ShortcutSheet) and About (version). | dom | Pass if the five sections exist with these components. |
| PAT-066 | Each SettingsPage section shall save explicitly except Appearance. | dom | Pass if non-Appearance sections have Save and Appearance does not. |
| PAT-067 | RetiredPageNotice shall be a centred Card in the shell with the title "This page has moved" or "This page is retired". | dom | Pass if the title matches one of the two. |
| PAT-068 | RetiredPageNotice shall state in one sentence where things went, link to the new place with a TextLink in its module colour and show the change date. | dom | Pass if sentence, link and date are present. |
| PAT-069 | RetiredPageNotice auto-redirect shall occur only after one release. | judgement | Pass if redirects activate only after the notice period. |
| PAT-070 | ErrorPage 404 and 50x pages shall be created as static HTML served by nginx via error_page directives in nginx/nginx.conf. | lint | Pass if nginx.conf has error_page for 404 and 500 502 503 504 and the files exist. |
| PAT-071 | ErrorPage shall be static HTML with no JS and inline CSS only, with tokens copied as literals at build time. | lint | Fail if the page has script elements or external stylesheets. |
| PAT-072 | ErrorPage font stack shall be Inter followed by a system font fallback. | lint | Pass if font-family lists Inter then system fonts. |
| PAT-073 | ErrorPage shall support both themes via prefers-color-scheme. | lint | Pass if the CSS has a prefers-color-scheme media query. |
| PAT-074 | ErrorPage content shall be the wordmark text, a title-l of "Page not found" or "SongNodes is not responding", one sentence of what to do, a plain link to "/" and the request ID in mono when available. | dom | Pass if those items are present. |
| PAT-075 | The in-app 404 shall use the same words as ErrorPage inside the shell. | dom | Pass if the in-app 404 text matches the static one. |
| PAT-076 | AuthCallbackPage shall have no shell and show a centred Card with StagedProgress "Checking with Spotify → Saving connection → Done". | dom | Pass if no shell elements exist and the stages are listed. |
| PAT-077 | AuthCallbackPage success shall show "Spotify connected" with a TextLink back to Settings and auto-return after 2 s. | dom | Pass if the link exists and redirect fires at about 2000 ms. |
| PAT-078 | AuthCallbackPage failure shall show an ErrorState saying what happened and a "Try again" button that restarts the flow. | dom | Pass if failure shows both. |
| PAT-079 | AuthCallbackPage shall never show raw codes or tokens. | lint | Fail if the DOM text contains the OAuth code or token. |
| PAT-080 | PrintSheet shall be a print-only layout in the light theme, with no shell, A4 portrait and a traceability footer. | lint | Pass if print CSS sets @page size A4 portrait, light tokens, and a footer element. |
