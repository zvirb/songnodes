# ErrorPage

The nginx `404.html` and `50x.html` pages: static HTML and inline CSS, no JavaScript, wordmark, a plain explanation, what to do next, and the request ID on server errors.

## When to use
- nginx: `error_page 404 /404.html; error_page 500 502 503 504 /50x.html;` (root `/usr/share/nginx/html`). Also 410 for retired routes after their notice period.
- The in-app 404 route renders the same words inside the shell (`ErrorPage inShell`). Region failures use `ErrorState`, not this page.

## Anatomy
| Part | Class | Content |
|---|---|---|
| Page | `.sn-page-error` | Centred column, max 34rem, `bg` |
| Wordmark | `__wordmark` | "SongNodes" in Sora 800, `brand` (plain text, not a link) |
| Code | `__code` | "404 · Not found", "503 · Service unavailable" in mono `fg-3` |
| Title | `__title` (title-l) | "Page not found" / "SongNodes is not responding" |
| Text | `__text` | What happened and what is safe |
| Next | `__next` (list) | "Check the address, or go to Home." / "Try again in a minute: reload this page." / "check the status page in Grafana" (`/monitoring/`) |
| Request ID | `__ref` | 50x only (decided): nginx `$request_id` printed by SSI, in mono, selectable. The preview shows a sample ID because it can't run SSI |

## Static build
The files must work when the app and fonts are down: inline the CSS, use a system font stack after Inter/Sora/JetBrains Mono, and copy these token values as literals:

| Token | Dark | Light |
|---|---|---|
| `bg` | `#222222` | `#f4f4f1` |
| `surface-1` | `#2d2d2d` | `#ffffff` |
| `line` | `#3c3c3c` | `#d9d9d4` |
| `fg` / `fg-2` / `fg-3` | `#f9f9f9` / `#bbbbbb` / `#a3a3a3` | `#1c1c1e` / `#47474b` / `#616166` |
| `brand` (wordmark, focus) | `#9b85cb` | `#6a52a6` |
| `link` | `#b4a2dc` | `#6a52a6` |

Light is the default block; dark under `@media (prefers-color-scheme: dark)`. Links underlined 1px, offset 3px, weight 600. The request ID is inserted by nginx SSI: turn on `ssi on;` in the error-page location only (not site-wide), write `<!--# echo var="request_id" -->` inside `__ref` in `50x.html`, and add `add_header X-Request-ID $request_id always;` so logs and the page carry the same ID.

```nginx
error_page 500 502 503 504 /50x.html;
location = /50x.html {
    root /usr/share/nginx/html;
    internal;
    ssi on;   # only here
}
```

## States
Static; no loading. 404 has no request ID. 502/503/504 share 50x.html with the 503 wording ("not responding"); 500 may use "SongNodes hit an error" with the same next steps.

## Responsive
One column at every width; 24px side padding on phones. No booth handling (served outside the app).

## Primary action
Go to Home (a plain link; no buttons, no JavaScript).

## Replaces
nginx's default "404 Not Found / nginx" and "502 Bad Gateway" pages, which today show for every missing route and for the removed debug pages.
