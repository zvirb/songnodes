# PLT rules (generated)

| ID | Rule | Check | Test |
|---|---|---|---|
| PLT-001 | Theme, text size and density preferences shall be set and read only through SongNodes.prefs. | lint | No direct localStorage access to sn-theme/sn-text-size/sn-density outside SongNodes.prefs. |
| PLT-002 | In React, preferences shall be wrapped in a usePrefs() hook and shall not be duplicated in Zustand. | lint | No Zustand store holds theme, text size or density. |
| PLT-003 | Preferences shall be stored per device in local storage and shall not be put in the URL or synced to the server. | judgement | Prefs absent from URL and API calls. |
| PLT-004 | Theme shall take the values system, dark, light or booth, stored in sn-theme (absent means system) and applied as data-theme on html. | dom | html[data-theme] is dark\|light\|booth and sn-theme holds one of the four values. |
| PLT-005 | Text size shall take the values s, m, l or xl, stored in sn-text-size and applied as data-text-size on html (absent means m). | dom | html[data-text-size] absent or s\|l\|xl; default m. |
| PLT-006 | Density shall take the values comfortable or compact, stored in sn-density and applied as data-density on html (default comfortable). | dom | html[data-density] is comfortable or compact. |
| PLT-007 | The default theme shall be system, resolving to dark when the OS has no preference. | dom | With no stored theme and no OS preference html[data-theme]=dark. |
| PLT-008 | The System theme shall follow prefers-color-scheme live by listening to the media query change event and calling prefs.applySystem(). | judgement | Changing the OS scheme with System selected updates data-theme without reload. |
| PLT-009 | Booth shall never be chosen automatically. | judgement | No code path sets theme booth without user action. |
| PLT-010 | Booth shall be offered in PreferencesPanel and in GraphExplorerPage Play mode as "Booth display". | dom | Both locations contain a Booth display option. |
| PLT-011 | The Booth theme shall raise the root size to 118.75%. | lint | [data-theme=booth] html font-size is 118.75%. |
| PLT-012 | The Booth theme shall use pure black and 7:1 text contrast. | lint | Booth bg is #000 and text contrast >= 7:1. |
| PLT-013 | The Booth theme shall use a 3px focus ring. | lint | Booth focus outline width is 3px. |
| PLT-014 | In every theme including booth, each status shall keep its glyph and word, because booth is not a colour-blind-safe theme. | dom | Every status element in booth contains glyph and word. |
| PLT-015 | Under prefers-contrast: more on dark or light, the theme shall not switch automatically and a one-time InlineMessage shall suggest Booth. | judgement | Theme unchanged; message shown once. |
| PLT-016 | Under prefers-reduced-motion, durations shall go to 0 except progress indication. | lint | Reduced-motion media block zeroes durations except progress indicators. |
| PLT-017 | Under prefers-reduced-motion, the force graph shall start paused and settle without animation. | judgement | Graph starts paused and does not animate settling. |
| PLT-018 | An inline script that applies the saved theme, text size and density shall be the first script in head, before any stylesheet, in frontend/index.html and every artifact. | lint | First element in head is the inline prefs script, before link/style. |
| PLT-019 | The head shall contain <meta name="color-scheme" content="dark light">. | lint | Meta color-scheme dark light is present. |
| PLT-020 | index.html shall not hard-code background #0a0a0a or a Matrix-green loading screen; the body background shall come from --bg. | lint | No #0a0a0a or loader markup in index.html; body background is var(--bg). |
| PLT-021 | Inside artifacts every storage read shall be in try/catch and the page shall render correctly with defaults. | lint | All localStorage reads are wrapped in try/catch. |
| PLT-022 | Artifacts shall not store sets, filters that matter or anything shared in local storage and shall use the host storage capability. | judgement | No shared state in artifact localStorage. |
| PLT-023 | Fonts shall be self-hosted as fonts/*.woff2 with font-display: swap. | lint | @font-face src are local woff2 with font-display swap. |
| PLT-024 | The UI shall not use Google Fonts or CDN scripts. | lint | No external font/script URLs in html or css. |
| PLT-025 | The UI chrome shall not use remote images. | lint | No http(s) image src in UI chrome. |
| PLT-026 | Icons, CSS and JS shall be self-hosted (icons inlined in bundle.js, lucide-react bundled). | lint | All asset URLs are same-origin. |
| PLT-027 | SongNodes shall keep the last graph, library and saved sets in IndexedDB and show them with FreshnessStamp when the API is unreachable. | judgement | With API blocked, cached data renders with FreshnessStamp. |
| PLT-028 | ConnectionStatus shall be hidden when online and live. | dom | No ConnectionStatus element when online and live. |
| PLT-029 | ConnectionStatus shall show "Live updates paused" with cloud-off when the WebSocket drops. | dom | WebSocket drop shows that text and icon. |
| PLT-030 | ConnectionStatus shall show "Offline. Showing data from <time>" with wifi-off when the device is offline. | dom | Offline shows that text and icon. |
| PLT-031 | ConnectionStatus shall show "Reconnecting…" while retrying with backoff. | dom | Retry state shows that text. |
| PLT-032 | While offline, set drafts shall save locally (autosave). | judgement | Offline edits persist locally. |
| PLT-033 | While offline, shared saves shall be disabled with the reason "Saving needs a connection. Your draft is kept on this device." | dom | Shared save control is disabled with that message. |
| PLT-034 | A service worker shall be registered for the app shell using stale-while-revalidate for static assets. | judgement | Service worker serves static assets stale-while-revalidate. |
| PLT-035 | The service worker shall use network-first with cache fallback for GET /api/* reads. | judgement | GET /api/* handled network-first with cache fallback. |
| PLT-036 | Cache-busting shall use hashed file names and shall not disable caching; index.html shall not contain no-cache meta tags or a script unregistering service workers. | lint | No no-cache meta and no serviceWorker unregister script in index.html. |
| PLT-037 | Auth callbacks, API keys and write endpoints shall never be cached. | judgement | Service worker excludes these requests from caching. |
| PLT-038 | In artifacts, alert, confirm and prompt shall not be used; ConfirmDialog, Toast and Dialog shall be used. | lint | No alert/confirm/prompt calls. |
| PLT-039 | In artifacts CopyButton shall fall back to a selected read-only field when the clipboard fails. | dom | Clipboard failure shows a selected read-only field. |
| PLT-040 | Artifact previews shall not make external fetches; artifacts shall declare what they need. | lint | Preview code contains no external fetch. |
| PLT-041 | Artifact navigation shall use hash views (#library), not paths. | lint | Artifact routes are hash based. |
| PLT-042 | Links to other sites from artifacts shall open in a new tab with rel="noopener". | lint | External anchors have target=_blank and rel contains noopener. |
| PLT-043 | The SongNodes app shall not be embeddable: nginx shall send X-Frame-Options: DENY and frame-ancestors 'none'. | lint | Response headers contain both values. |
| PLT-044 | A read-only view that must be embedded shall have its own route with frame-ancestors listing the host explicitly. | lint | Embeddable route CSP names the host. |
| PLT-045 | 50x.html shall show the request ID via SSI with ssi on only in the location = /50x.html block, <!--# echo var="request_id" --> in the page, and add_header X-Request-ID $request_id always. | lint | nginx.conf and 50x.html contain these directives. |
| PLT-046 | Every iframe SongNodes renders shall have a title naming its content. | dom | All iframes have a non-empty title. |
| PLT-047 | Every iframe SongNodes renders shall have loading="lazy". | dom | All iframes have loading=lazy. |
| PLT-048 | Every iframe SongNodes renders shall have a sandbox attribute with the minimum tokens. | dom | All iframes have sandbox with minimal tokens. |
| PLT-049 | Cross-frame messages shall use postMessage with an explicit targetOrigin and never "*". | lint | No postMessage(…, "*"). |
| PLT-050 | Cross-frame message payloads shall be typed { type: "songnodes:<event>", version: 1, … }. | lint | Payload has type starting songnodes: and version. |
| PLT-051 | Cross-frame messages shall be checked for origin on receipt. | lint | Message handlers check event.origin. |
| PLT-052 | Third-party widgets shall be contained in a Card with a heading and FreshnessStamp where relevant. | dom | Each widget sits in a Card with heading. |
| PLT-053 | The Spotify embed shall use ?theme=0 on dark and booth and the default on light, and shall never be restyled inside. | dom | Spotify embed URL carries theme=0 on dark/booth. |
| PLT-054 | The TIDAL embed shall use TIDAL's dark variant on dark and booth. | dom | TIDAL embed uses dark variant on dark/booth. |
| PLT-055 | Swagger UI and GraphiQL shall open in a new tab, be left unstyled, and be linked from Services with TextLink --ext. | dom | Links open in new tab; no CSS injected. |
| PLT-056 | Grafana shall be linked from MonitoringPage with Grafana's dark theme set and shall not be iframed. | dom | No iframe for Grafana; link present. |
| PLT-057 | Our CSS shall never be injected into third-party frames. | lint | No code injects styles into third-party frames. |
| PLT-058 | Each third-party frame shall be wrapped with a visible label such as "Opens on Spotify". | dom | Widget wrapper contains the label. |
| PLT-059 | Each third-party embed shall provide a non-embedded fallback link when the embed fails or is blocked offline. | dom | Fallback link exists next to each embed. |
| PLT-060 | On desktop (>= bp-desktop 1100px) the layout shall be rail plus content with side sheets opening beside content, and three regions at bp-wide. | visual | Layout at >=1100px is rail+content. |
| PLT-061 | On tablet (768-1099px) the layout shall be one content column with the rail becoming a "Filters" SideSheet. | visual | At 768-1099px the rail is a SideSheet. |
| PLT-062 | On phone (<768px) the layout shall be one column with 16px gutters and a full-width primary action. | visual | At <768px single column, 16px gutters, full-width primary. |
| PLT-063 | On tablet, tables shall scroll in .sn-tablebox with a sticky first column. | dom | Table wrapped in .sn-tablebox with sticky first column. |
| PLT-064 | On phone, tables shall be two-line list rows and the page shall not scroll horizontally. | dom | At 375px document.scrollWidth <= innerWidth. |
| PLT-065 | On wall/booth screens (>= bp-wall 1920px) the type scale shall go one step up with control-lg targets and tables limited to Track, Key, BPM and Energy. | visual | Wall class shows only four columns at larger scale. |
| PLT-066 | On tablet the graph shall use a full-width canvas with the panel as a SideSheet. | visual | Tablet graph panel is a SideSheet. |
| PLT-067 | On phone the graph shall show the list view first with the canvas on demand. | visual | Phone graph defaults to list view. |
| PLT-068 | On wall/booth screens the graph shall be Play mode only showing now playing and up next. | visual | Wall graph is Play mode only. |
| PLT-069 | On tablet the set builder shall be one column with controls in a Disclosure. | visual | Tablet set builder controls are in a Disclosure. |
| PLT-070 | On phone the set builder shall be a running order list with drag handles replaced by up/down buttons. | dom | Phone SetSlot has up/down buttons, no drag handle. |
| PLT-071 | On wall/booth screens the set builder shall be a read-only running order with the current slot marked --now. | dom | Wall set builder read-only; current slot uses --now. |
| PLT-072 | Touch targets shall be at least touch-min on coarse pointers regardless of width. | dom | Interactive targets >= touch-min under (pointer: coarse). |
| PLT-073 | Hover shall never hold the only path to information: anything in a Tooltip shall also be reachable by focus or tap. | dom | Tooltip content opens on focus and tap. |
| PLT-074 | Double-tap zoom shall be disabled only on the graph canvas (touch-action: none) and the global touchend preventDefault in main.tsx shall be removed. | lint | touch-action none only on the canvas; no global touchend preventDefault. |
| PLT-075 | The context menu shall not be blocked globally and shall be prevented only on canvases where ContextMenu replaces it. | lint | contextmenu preventDefault only on canvas elements. |
| PLT-076 | When browser storage refuses a write, a theme choice (dark, light or booth) and every other view setting (text size, density, reduce motion, a dismissed warning) shall still take effect for the visit, and the refusal shall be logged once for each setting at warn, through `SongNodes.diag.warn` when Diagnostics is on the page and `console.warn` otherwise. | dom | With `Storage.prototype.setItem` throwing, choose Booth: `data-theme` is `booth`, `SongNodes.prefs.get().theme` is `booth`, and exactly one warn line names the theme setting; choosing again logs nothing more. |
| PLT-077 | A refused view setting shall not be shown as a banner or a toast and shall not be retried; the next visit shall open on the defaults. | judgement | With storage blocked no message appears on the first screen; the Preferences footer reads "Kept for this visit only". |
| PLT-078 | A page shall read and set view settings only through `SongNodes.prefs` and `SongNodes.dismissal`; it shall not read or write their storage keys itself. | lint | Fail if page code calls `localStorage` with a key starting `sn-theme`, `sn-text-size`, `sn-density`, `sn-motion` or `sn-dismiss`. |
| PLT-079 | `SongNodes.prefs.init` shall only read: opening a page shall not write a setting back to storage. | dom | With `setItem` throwing, load a page and call `prefs.init()`: no warn line is logged. |
