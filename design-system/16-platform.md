# Platform

The same pages run in a desktop browser at home, on a laptop in a dark booth with patchy wifi, on a phone in a record shop, and inside Claude artifacts. These rules keep them consistent and working in each.

## Themes and preferences

| Preference | Values | Storage key | Attribute on `<html>` | Default |
|---|---|---|---|---|
| Theme | `system`, `dark`, `light`, `booth` | `sn-theme` (absent = system) | `data-theme="dark|light|booth"` | system (dark when the OS has no preference) |
| Text size | `s`, `m`, `l`, `xl` | `sn-text-size` | `data-text-size` (absent = m) | m |
| Density | `comfortable`, `compact` | `sn-density` | `data-density` | comfortable |

- Set and read only through `SongNodes.prefs` (`setTheme`, `setTextSize`, `setDensity`, `get`, `init`). In React, wrap it in a `usePrefs()` hook; do not keep a second copy in Zustand.
- Preferences are per device and per person (local storage), never in the URL and never synced to the server. Booth laptops keep their own choice.
- "System" follows `prefers-color-scheme` live: listen to the media query's `change` event and call `prefs.applySystem()`.
- Booth is never chosen automatically. Offer it in `PreferencesPanel` and on `GraphExplorerPage` Play mode as "Booth display".
- Booth raises the root size (118.75%), uses pure black, 7:1 text and 3px focus. Its statuses use the same traffic-light hues as dark (green / amber / red, lifted to 7:1); booth is not a colour-blind-safe theme, so every status keeps its glyph and word.
- `prefers-contrast: more` on dark or light: no automatic switch; show a one-time `InlineMessage` suggesting Booth.
- `prefers-reduced-motion`: durations go to 0 except progress indication (handled in `00-core.css`). The force graph starts paused and settles without animation.

### No flash of the wrong theme

Put this inline as the first script in `<head>`, before any stylesheet, in `frontend/index.html` and every artifact:

```html
<script>
  (function () {
    try {
      var d = document.documentElement, t = localStorage.getItem("sn-theme");
      d.setAttribute("data-theme", t || (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark"));
      var s = localStorage.getItem("sn-text-size"); if (s && s !== "m") d.setAttribute("data-text-size", s);
      d.setAttribute("data-density", localStorage.getItem("sn-density") === "compact" ? "compact" : "comfortable");
    } catch (e) { document.documentElement.setAttribute("data-theme", "dark"); }
  })();
</script>
<meta name="color-scheme" content="dark light">
```

It duplicates `SongNodes.prefs.init()` on purpose: `bundle.js` loads later. Remove the hard-coded `background: #0a0a0a` and the Matrix-green loading screen from `index.html`; the body background comes from `--bg`.

### Artifacts

Inside Claude artifacts preferences are per viewer only: each artifact has its own origin, storage may be empty or throw (private windows, previews), so every read is in try/catch (as `SongNodes.prefs` does) and the page renders correctly with defaults. Never store sets, filters that matter, or anything shared in artifact local storage; use the host's storage capability.

## Offline and restricted networks

Booth laptops may be offline; venue wifi often blocks CDNs.

- Self-host everything: fonts (`fonts/*.woff2`, `font-display: swap`), icons (inlined in `bundle.js`, `lucide-react` bundled), CSS and JS. No Google Fonts, no CDN scripts, no remote images in the UI chrome. SongNodes today uses system fonts and no CDN; keep it that way when adding Sora, Inter and JetBrains Mono.
- Cache the last good data. SongNodes keeps the last graph, library and saved sets in IndexedDB and shows them with `FreshnessStamp` ("Data from 24 Oct 2026, 06:00 AEDT") when the API is unreachable.
- `ConnectionStatus` states: hidden when online and live; "Live updates paused" (`cloud-off`) when the WebSocket drops; "Offline. Showing data from 06:00" (`wifi-off`) when the device is offline; "Reconnecting…" while retrying with backoff.
- Writes while offline: set drafts save locally (autosave); shared saves are disabled with the reason "Saving needs a connection. Your draft is kept on this device."
- Service worker (PWA): register one for the app shell with `stale-while-revalidate` for static assets and `network-first` with cache fallback for `GET /api/*` reads. This reverses the current `index.html` script that unregisters all service workers and deletes all caches, and the no-cache `<meta>` tags. Cache-bust by hashed file names (Vite default), not by disabling caching.
- Never cache auth callbacks, API keys or write endpoints.

## Embedding in other hosts

### Claude artifacts (the music library, design-system previews)

| Capability | Rule |
|---|---|
| `window.print` | Not available. No print buttons. |
| `alert`, `confirm`, `prompt` | Blocked or ugly. Use `ConfirmDialog`, `Toast`, `Dialog`. |
| Clipboard | May fail. `CopyButton` falls back to a selected read-only field. |
| Downloads | Only through the host's download capability, on explicit request. |
| Storage | Per viewer, may be empty. Shared state through the host capability. |
| Network | No external fetches from previews; artifacts declare what they need. |
| Navigation | Hash views (`#library`), not paths. Links to other sites open in a new tab with `rel="noopener"`. |

### SongNodes inside iframes

- SongNodes itself is not embeddable: `nginx/nginx.conf` sends `X-Frame-Options: DENY` and `frame-ancestors 'none'`. Keep that for the app; if a read-only view (a set page, a now-playing card) must be embedded, give it its own route with `frame-ancestors` listing the host explicitly.
- nginx error pages (`404.html`, `50x.html`) are static files outside the app. `50x.html` shows the request ID through SSI: `ssi on;` in the `location = /50x.html` block only and `<!--# echo var="request_id" -->` in the page, with `add_header X-Request-ID $request_id always;` (see `ErrorPage`).
- Every `<iframe>` SongNodes renders has a `title` naming its content ("Spotify player: Bicep – Glue"), `loading="lazy"`, and a `sandbox` with the minimum tokens.
- Cross-frame messages use `postMessage` with an explicit `targetOrigin` (never `"*"`), a typed payload `{ type: "songnodes:<event>", version: 1, … }`, and an origin check on receipt.

## Third-party widgets (listed exceptions)

These render other people's UI. They are allowed exceptions to the token rules, contained in a `Card` with a heading and `FreshnessStamp` where relevant.

| Widget | Where | Theming |
|---|---|---|
| Spotify embed player | Track detail preview | `?theme=0` (dark) matches dark and booth; light uses the default. Never restyle inside. |
| TIDAL embed | Track detail preview | Use TIDAL's dark variant on dark and booth. |
| Swagger UI (`/docs` of REST services) | Developer pages, opened in a new tab | Leave unstyled; link from Services with `TextLink --ext`. |
| GraphiQL (`graphql-api`) | Developer tool, new tab | Leave unstyled. |
| Grafana (`/monitoring/grafana`) | Linked from `MonitoringPage` | Set Grafana's dark theme; do not iframe (it is proxied but our CSP forbids framing). |

Rules: never inject our CSS into third-party frames; wrap each in a frame with a visible "Opens on Spotify" style label; provide a non-embedded fallback link when the embed fails or is blocked offline.

## Device classes

| Class | Width / input | Theme | Layout | Tables | Graph | Set builder |
|---|---|---|---|---|---|---|
| Desktop | ≥ `bp-desktop` 1100px, pointer + keyboard | Any | Rail + content; side sheets open beside content (≥ `bp-wide` three regions) | Full `DataTable`, comfortable or compact | Canvas + side panel | Controls left, wave and running order right |
| Tablet | `bp-tablet` 768–1099px, touch | Any | One content column; rail becomes "Filters" `SideSheet` | Scroll in `.sn-tablebox`, sticky first column | Canvas full width, panel as `SideSheet` | One column; controls in a `Disclosure` |
| Phone | < 768px (< `bp-phone` 480px is the narrow case), touch | Any | One column, 16px gutters, primary action full width | Two-line list rows; no horizontal scroll of the page | List view first, canvas on demand | Running order list; drag handles replaced by up/down buttons |
| Wall / booth screen | ≥ `bp-wall` 1920px or a laptop in a booth, glanceable at 1–2 m | Booth recommended | Type scale one step up, `control-lg` targets | Fewer columns: Track, Key, BPM, Energy | Play mode only, now playing and up next | Read-only running order with the current slot `--now` |

- Touch targets ≥ `touch-min` on coarse pointers regardless of width.
- Hover never holds the only path to information: anything in a `Tooltip` is also reachable by focus or tap.
- Disable double-tap zoom only on the graph canvas (`touch-action: none` there); remove the global `touchend` `preventDefault` in `frontend/src/main.tsx`, which blocks zoom on every page.
- Do not block the context menu globally; `main.tsx` prevents it on canvases, which is right only where `ContextMenu` replaces it.
