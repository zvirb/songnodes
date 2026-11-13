# NAV rules (generated)

| ID | Rule | Check | Test |
|---|---|---|---|
| NAV-001 | Site navigation shall live only in the left NavDrawer opened from the hamburger in AppHeader. | dom | Pass if module links exist only inside the NavDrawer element. |
| NAV-002 | Pages shall not provide a top nav bar, site-level tabs or sidebars of module links. | dom | Fail if any element outside NavDrawer and PageHeader holds links to two or more modules. |
| NAV-003 | Every page shall be reachable in two taps or fewer from any other page. | judgement | Pass if the shortest path from Home to every route is at most two activations. |
| NAV-004 | AppHeader shall be the only fixed bar. | dom | Pass if exactly one bar element has position fixed at the top of the viewport. |
| NAV-005 | AppHeader height shall be the --header-h token. | lint | Pass if AppHeader height resolves to var(--header-h). |
| NAV-006 | AppHeader shall use the surface-1 fill. | lint | Pass if AppHeader background is var(--surface-1). |
| NAV-007 | AppHeader shall have a 1px line-colour bottom edge. | lint | Pass if AppHeader border-bottom is 1px solid var(--line). |
| NAV-008 | AppHeader shall use the z-header layer. | lint | Pass if AppHeader z-index is var(--z-header). |
| NAV-009 | AppHeader controls shall appear in the order hamburger, wordmark, page title, freshness, connection, search, more on every page in both products. | dom | Pass if the DOM order of AppHeader children matches the listed order on every page. |
| NAV-010 | The hamburger shall be the first AppHeader control and shall be a quiet icon Button with the menu icon. | dom | Pass if the first AppHeader control is .sn-btn--quiet.sn-btn--icon with icon menu. |
| NAV-011 | The hamburger shall carry aria-label "Open navigation", aria-expanded and aria-controls referencing the drawer. | dom | Pass if all three attributes are present with the stated label and a valid drawer id. |
| NAV-012 | The wordmark shall be text reading "SongNodes" or "Music library", not an image. | dom | Fail if the wordmark contains an img or svg element or other text. |
| NAV-013 | The wordmark shall link to HomePage. | dom | Pass if the wordmark is an anchor whose href is the HomePage route. |
| NAV-014 | The wordmark shall use the brand colour. | lint | Pass if wordmark colour is var(--brand). |
| NAV-015 | The AppHeader page title shall use body-strong in the fg colour. | lint | Pass if the title uses the body-strong style and colour var(--fg). |
| NAV-016 | The AppHeader page title shall show only the bold half of the page title. | dom | Pass if AppHeader title text equals the .sn-title text without the .sn-lead span. |
| NAV-017 | The AppHeader page title shall truncate with an ellipsis. | lint | Pass if the title sets text-overflow ellipsis. |
| NAV-018 | The AppHeader page title shall be hidden below bp-tablet when PageHeader is on screen. | dom | Pass if the title is display none below bp-tablet while PageHeader is visible. |
| NAV-019 | FreshnessStamp shall appear in AppHeader only on pages that show stored data. | dom | Pass if AppHeader contains FreshnessStamp if and only if the page renders stored data. |
| NAV-020 | ConnectionStatus shall be shown in AppHeader only when the connection is not normal and shall be silent when healthy. | dom | Pass if ConnectionStatus is absent from the DOM while the connection is healthy. |
| NAV-021 | The search control shall be an icon Button with the search icon that opens CommandPalette. | dom | Pass if activating the search button opens CommandPalette. |
| NAV-022 | CommandPalette shall open on Ctrl/Cmd+K and on "/". | dom | Pass if both key presses open CommandPalette when focus is not in a field. |
| NAV-023 | The More control shall be an OverflowMenu with the ellipsis icon holding theme, text size, density, keyboard shortcuts and help. | dom | Pass if the menu items are exactly those five entries. |
| NAV-024 | AppHeader items 1 to 3 shall align left and items 4 to 7 shall align right. | visual | Pass if the first three controls sit at the left edge and the last four at the right edge. |
| NAV-025 | AppHeader controls shall be separated by a space-2 gap. | lint | Pass if the AppHeader gap is var(--space-2). |
| NAV-026 | AppHeader hit areas shall be at least touch-min on coarse pointers. | lint | Pass if control min-height and min-width are var(--touch-min) under pointer coarse. |
| NAV-027 | Page actions shall not be placed in AppHeader. | dom | Fail if AppHeader contains a page-specific action button. |
| NAV-028 | The Play/Plan SegmentedControl shall live in PageHeader of GraphExplorerPage and not in AppHeader. | dom | Pass if the control is a descendant of PageHeader and not of AppHeader. |
| NAV-029 | The booth theme shall keep the AppHeader control order and keep the page title visible. | dom | Pass if in the booth theme the order is unchanged and the title is displayed. |
| NAV-030 | NavDrawer shall slide in from the left as an overlay over the page. | dom | Pass if the drawer is position fixed at left 0 and does not shift page content. |
| NAV-031 | NavDrawer width shall be drawer-w with a maximum of 86vw. | lint | Pass if width is var(--drawer-w) and max-width is 86vw. |
| NAV-032 | NavDrawer shall use the surface-1 fill and shadow-3. | lint | Pass if background is var(--surface-1) and box-shadow is var(--shadow-3). |
| NAV-033 | NavDrawer shall use the overlay token for its scrim. | lint | Pass if the scrim background is var(--overlay). |
| NAV-034 | NavDrawer shall use the z-drawer layer. | lint | Pass if drawer z-index is var(--z-drawer). |
| NAV-035 | NavDrawer rows shall be Home first, then the eight modules in SongNodes.modules order. | dom | Pass if row order is Home followed by modules in SongNodes.modules order. |
| NAV-036 | NavDrawer group titles shall use title-s and only where a product needs sub-pages. | judgement | Pass if group titles exist only for products with sub-pages and use title-s. |
| NAV-037 | Each NavDrawer row shall show the module icon in --m via .sn-m-<key> .sn-m-icon. | dom | Pass if each row has .sn-m-icon inside .sn-m-<key>. |
| NAV-038 | Each NavDrawer row label shall use the fg colour. | lint | Pass if row label colour is var(--fg). |
| NAV-039 | An optional NavDrawer row count shall use the data-s style. | lint | Pass if the count element uses the data-s type style. |
| NAV-040 | NavDrawer row height shall be row-two-line when a one-line summary is shown and control-lg otherwise. | lint | Pass if row height token matches whether a summary is rendered. |
| NAV-041 | The current NavDrawer row shall have aria-current="page". | dom | Pass if exactly one row has aria-current page and it matches the route. |
| NAV-042 | The current NavDrawer row shall use a brand-soft fill and a 3px inset brand bar. | lint | Pass if the current row has background var(--brand-soft) and a 3px inset var(--brand) bar. |
| NAV-043 | The current page shall not be marked with the module colour. | lint | Fail if the current-row styling references --m. |
| NAV-044 | Focus shall move to the first NavDrawer row when the drawer opens. | dom | Pass if document.activeElement is the first row after opening. |
| NAV-045 | Escape and the scrim shall close NavDrawer and focus shall return to the hamburger. | dom | Pass if Escape or scrim click closes it and focus lands on the hamburger. |
| NAV-046 | NavDrawer shall trap focus while open. | dom | Pass if Tab from the last row wraps to the first row. |
| NAV-047 | The music library drawer shall use the same NavDrawer with the rows Home, Library, Set builder, Sources, Weekly run. | dom | Pass if the music library drawer rows equal that list. |
| NAV-048 | The wordmark shall not reload the page when clicked on Home. | dom | Pass if clicking the wordmark on Home triggers no navigation or reload. |
| NAV-049 | A separate "Back to home" button shall not exist anywhere. | lint | Fail if any button or link is labelled "Back to home". |
| NAV-050 | Breadcrumbs shall appear only below module level. | dom | Pass if Breadcrumbs render only on pages deeper than a module root. |
| NAV-051 | Breadcrumbs shall not start with "Home". | dom | Fail if the first breadcrumb is Home. |
| NAV-052 | PageHeader shall open every page except HomePage and the canvas of GraphExplorerPage. | dom | Pass if every non-exempt page begins with PageHeader. |
| NAV-053 | GraphExplorerPage shall use the compact one-line PageHeader variant. | dom | Pass if GraphExplorerPage header is the compact variant. |
| NAV-054 | PageHeader shall begin with a full-width module band using --m-bg on .sn-m-<key>. | dom | Pass if the first PageHeader child is full width with background var(--m-bg). |
| NAV-055 | The PageHeader module band shall show the module icon and module label as an eyebrow in --m-muted. | dom | Pass if the band holds icon and label with colour var(--m-muted). |
| NAV-056 | The PageHeader title shall use .sn-title.title-l with a thin .sn-lead span followed by the bold part. | dom | Pass if the h1 matches .sn-title.title-l with a .sn-lead child. |
| NAV-057 | Each page shall have exactly one h1. | dom | Pass if document h1 count equals 1. |
| NAV-058 | The PageHeader description shall be one line in body style using --m-muted. | lint | Pass if the description uses body style, colour var(--m-muted) and does not wrap. |
| NAV-059 | The PageHeader description shall not exceed prose-max width. | lint | Pass if description max-width is at most var(--prose-max). |
| NAV-060 | The PageHeader description shall say what the page holds and not how to use it. | judgement | Pass if the text describes contents and contains no instructions. |
| NAV-061 | The PageHeader primary action shall be right-aligned on desktop and full width below bp-phone. | visual | Pass if alignment matches at desktop and phone widths. |
| NAV-062 | PageHeader secondary actions shall be at most two default Buttons beside the primary, followed by OverflowMenu. | dom | Pass if default Button count in PageHeader is at most 2. |
| NAV-063 | OverflowMenu shall be the last control in PageHeader. | dom | Pass if the OverflowMenu is the last focusable control in PageHeader. |
| NAV-064 | Destructive actions in the PageHeader OverflowMenu shall be at the bottom of the menu separated by a divider. | dom | Pass if destructive items are last and preceded by a separator. |
| NAV-065 | Destructive actions in the PageHeader OverflowMenu shall use status-bad text. | lint | Pass if destructive item colour is var(--status-bad). |
| NAV-066 | Destructive actions in the PageHeader OverflowMenu shall be confirmed with ConfirmDialog. | dom | Pass if activating a destructive item opens ConfirmDialog before acting. |
| NAV-067 | Tabs shall swap panels inside one page and use role="tablist". | dom | Pass if the tab container has role tablist and panels share one URL path. |
| NAV-068 | Tabs arrow keys shall move between tabs, and selection shall follow focus only when panels are cheap to render. | dom | Pass if arrow keys move focus and selection follows only for cheap panels. |
| NAV-069 | Tabs shall number at most seven, with the remainder moved into a "More" tab menu. | dom | Pass if visible tab count is at most 7. |
| NAV-070 | Tabs shall not wrap to a second row. | visual | Pass if all tabs share one row at every width. |
| NAV-071 | The selected tab underline shall use --m of the page module, falling back to brand. | lint | Pass if underline colour is var(--m, var(--brand)). |
| NAV-072 | Tab counts shall be placed in .sn-tab__badge. | dom | Pass if tab counts are inside .sn-tab__badge elements. |
| NAV-073 | A .sn-tab__dot in brand colour shall mean changed since the person last looked. | dom | Pass if the dot uses var(--brand) and appears only for changed tabs. |
| NAV-074 | The .sn-tab__dot shall be cleared when its tab is opened. | dom | Pass if the dot is removed after the tab is selected. |
| NAV-075 | Tabs shall not use status colours. | lint | Fail if any .sn-tab rule references a status- token. |
| NAV-076 | A tab holding errors shall show the error count in its badge text and a StatusPill inside the panel. | dom | Pass if the badge reads "N errors" and the panel contains a StatusPill. |
| NAV-077 | SegmentedControl shall switch a mode or view of the same content. | judgement | Pass if all options show the same data in different modes. |
| NAV-078 | SegmentedControl shall have two to four options. | dom | Pass if option count is between 2 and 4. |
| NAV-079 | SegmentedControl options shall be text only with no icons. | dom | Fail if any option contains an icon element. |
| NAV-080 | On phones Tabs shall scroll horizontally in their box. | visual | Pass if at phone width the tab list has overflow-x scroll. |
| NAV-081 | On phones a SegmentedControl with more than three options shall become a SelectField. | dom | Pass if at phone width a 4-option control renders as a select. |
| NAV-082 | To swap content in the same place, Tabs or SegmentedControl shall be used and not links styled as tabs or drawer rows. | judgement | Fail if links or drawer rows are styled as tabs. |
| NAV-083 | To jump within a long page, in-page anchor links styled as TextLink shall be used. | dom | Pass if intra-page jumps are a[href^="#"] with .sn-link. |
| NAV-084 | Jumping within a page shall not use Tabs. | judgement | Fail if Tabs are used only to scroll to sections. |
| NAV-085 | Pages shall not use scroll-jacking. | lint | Fail if scroll or wheel handlers call preventDefault for navigation. |
| NAV-086 | A sticky mini table of contents shall be used only on long documents. | judgement | Pass if sticky TOC appears only on brand book or help pages. |
| NAV-087 | To go to another page, a TextLink in the destination module colour (.sn-link.sn-m-<key>), a LauncherCard or a NavDrawer row shall be used. | dom | Pass if cross-page links match one of these three forms. |
| NAV-088 | Buttons styled as links and Button --primary shall not be used for navigation. | dom | Fail if a navigating element has .sn-btn--primary or button element with link styling. |
| NAV-089 | To step through a sequence, PeriodNav, review-queue prev/next buttons or MediaViewer arrows shall be used. | judgement | Pass if sequence stepping uses one of these components. |
| NAV-090 | Pagination numbers for time and tabs per week shall not be used. | judgement | Fail if time periods use numbered pagination or per-week tabs. |
| NAV-091 | To act on the current object, Button, OverflowMenu or ContextMenu shall be used and not links. | dom | Fail if an action on the current object is an anchor. |
| NAV-092 | An element that changes the URL shall be an a[href] and an element that only changes state shall be a button; one that does both shall be an a[href] that the app intercepts. | dom | Pass if URL-changing controls are anchors with href. |
| NAV-093 | PeriodNav shall be the only control for moving through time. | judgement | Fail if another control implements period stepping. |
| NAV-094 | PeriodNav shall contain a chevron-left button, the period label, a chevron-right button, a quiet "This week" button and an optional calendar-range picker. | dom | Pass if PeriodNav children match this anatomy. |
| NAV-095 | PeriodNav day labels shall use the format "Sat D Mon". | lint | Pass if day labels match ^[A-Z][a-z]{2} \d{1,2} [A-Z][a-z]{2}$. |
| NAV-096 | PeriodNav week labels shall use the format "Mon D – Sun D Mon YYYY" or "Week of D Mon YYYY". | lint | Pass if week labels match one of the two patterns. |
| NAV-097 | PeriodNav month labels shall use the format "Mon YYYY". | lint | Pass if month labels match ^[A-Z][a-z]{2} \d{4}$. |
| NAV-098 | Weeks shall start on Monday. | lint | Fail if any week calculation or grid uses Sunday as first day. |
| NAV-099 | The PeriodNav next button shall be disabled when the next period is in the future and has no data. | dom | Pass if next is disabled for future periods with no data. |
| NAV-100 | Planning views shall allow navigating to future periods. | dom | Pass if the next button is enabled into the future on planning views. |
| NAV-101 | PeriodNav shall support the keys "[" previous, "]" next and "t" this period when focus is not in a field. | dom | Pass if the three keys act as stated outside fields. |
| NAV-102 | The selected period shall be held in the URL (for example ?week= or ?day=) and PeriodNav prev/next shall be links. | dom | Pass if prev and next are a[href] containing the period parameter. |
| NAV-103 | Page-wide actions (export, print, duplicate, delete, refresh) shall be placed at the end of PageHeader. | dom | Pass if these actions are in the PageHeader end region. |
| NAV-104 | A DataTable row shall end with an OverflowMenu using ellipsis-vertical plus at most one visible row action. | dom | Pass if the last cell has one OverflowMenu and at most one other button. |
| NAV-105 | Card actions shall be placed in the Card footer .sn-card__foot with the main action first and OverflowMenu last. | dom | Pass if actions are in .sn-card__foot in that order. |
| NAV-106 | ContextMenu shall be a shortcut copy of actions already reachable elsewhere and shall never be the only path to an action. | judgement | Fail if an action exists only in a ContextMenu. |
| NAV-107 | ContextMenu shall open on right-click, long-press and Shift+F10. | dom | Pass if all three triggers open the menu. |
| NAV-108 | CommandPalette shall list every navigation target and every page-level action by name. | dom | Pass if palette entries cover all drawer rows and PageHeader actions. |
| NAV-109 | HomePage shall be a grid of LauncherCards, one per module, in drawer order. | dom | Pass if the grid card order equals the drawer module order. |
| NAV-110 | LauncherCard shall use .sn-card--tonal.sn-m-<key>. | dom | Pass if each LauncherCard has both classes. |
| NAV-111 | LauncherCard shall contain the module icon, the module label in title-s, the module summary from SongNodes.modules and one live figure. | dom | Pass if all four parts are present in each card. |
| NAV-112 | The whole LauncherCard shall be the link and nothing else inside it shall be focusable. | dom | Pass if the card has one focusable element, the card link. |
| NAV-113 | Index cards inside a module shall use Card (neutral) or SetCard with the title as the link; footers may hold actions. | dom | Pass if the card title is an anchor. |
| NAV-114 | Launcher cards and content cards shall not be mixed in one grid. | dom | Fail if a grid contains both LauncherCard and Card children. |
| NAV-115 | Every view a person might return to or share shall have a URL that reopens it exactly. | judgement | Pass if reloading the URL restores the same view. |
| NAV-116 | The route shall be part of the URL. | dom | Pass if each page has a distinct path or hash route. |
| NAV-117 | The selected track shall be held in the URL as ?track=. | dom | Pass if selecting a track sets the track parameter. |
| NAV-118 | Filters shall be held in the URL query. | dom | Pass if changing a filter updates the query string. |
| NAV-119 | Sort shall be held in the URL as ?sort= with a minus prefix for descending. | dom | Pass if sorting sets sort and descending order is prefixed with minus. |
| NAV-120 | The period shall be held in the URL. | dom | Pass if changing period updates the query string. |
| NAV-121 | The active tab and mode shall be held in the URL as ?tab= and ?mode=. | dom | Pass if tab and mode changes update the query. |
| NAV-122 | Hover, focus, open tooltips, multi-select in progress, unsent search text, scroll position, transient drag state, open menus and confirmation dialogs shall not be held in the URL. | dom | Fail if the URL changes on hover, focus, menu open or drag. |
| NAV-123 | Filter and sort changes shall use replaceState. | lint | Pass if filter and sort updates call history.replaceState. |
| NAV-124 | Page, track and period changes shall use pushState. | lint | Pass if these updates call history.pushState. |
| NAV-125 | Default values shall be omitted from the URL. | dom | Pass if the default state yields no query parameters. |
| NAV-126 | Unknown URL parameters shall be ignored and not raise errors. | dom | Pass if loading with an unknown parameter renders normally. |
| NAV-127 | A shared link shall reopen the same view for another person, except per-person preferences which shall stay in local storage. | dom | Pass if theme, density and text size are not in the URL and everything else is. |
| NAV-128 | Artifact pages shall use #<view> hash tokens and listen to hashchange instead of relying on paths. | lint | Pass if artifact pages register a hashchange listener and do not read location.pathname. |
| NAV-129 | SongNodes App.tsx shall route with createBrowserRouter and not branch on window.location.pathname. | lint | Fail if App.tsx reads window.location.pathname for routing. |
| NAV-130 | The SongNodes Shell route element shall render AppHeader, NavDrawer, CommandPalette, the toast region and an Outlet. | ast | Pass if Shell JSX contains those five elements. |
| NAV-131 | URL state shall be read and written with useSearchParams and the Zustand store shall hold data and not which panel is open. | lint | Fail if the store holds panel or tab open state. |
| NAV-132 | The right-panel tab state and the Play/Plan mode shall be held in ?tab= and ?mode= respectively. | lint | Fail if DJInterface keeps rightPanelTab in component state. |
| NAV-133 | Moved routes shall show a RetiredPageNotice for one release and then redirect. | judgement | Pass if each retired route renders RetiredPageNotice before being redirected. |
| NAV-134 | The tabs of one rail shall be views of the page's one thing and shall never hold different functions; a second function shall be its own page reached by a link. | judgement | Name the one thing every tab of the rail shows; if a tab needs another name, it is another page. |
| NAV-135 | `Tabs` and `SegmentedControl` shall switch views of one thing in place and shall never be a route to another function: no tab or segment shall open another page or module or start an action. | dom | Activating each tab or segment changes only the panel or mode and the `?tab=` or `?mode=` parameter; the path does not change and no request that writes is sent. |
