# CopyButton

Copies a tracklist, ID, ISRC, link or file path to the clipboard, swaps its icon to a check for 2 seconds and announces "Copied"; when the browser refuses, it selects the text in a box so the person can copy it themselves.

## When to use / not use
Use next to values people paste elsewhere: tracklists for socials, Spotify IDs, ISRCs, Beatport IDs, file paths, share links. Don't use it for values that are only read, or as a substitute for an export (CSV/JSON export is a Button).

## Anatomy & markup
```html
<button class="sn-btn sn-copy-button" type="button" data-copy="…">
  <span class="sn-copy-button__idle"><svg class="sn-icon">copy</svg></span>
  <span class="sn-copy-button__done"><svg class="sn-icon">check</svg></span>
  <span class="sn-copy-button__text">Copy tracklist</span>
</button>
<div class="sn-sr" aria-live="polite"></div>
```
- Value with icon-only copy: `sn-copy-button__value` holding `sn-copy-button__name` ("ISRC", in `data-s` style), `<code>` and an icon button (`sn-btn--icon sn-btn--quiet sn-btn--sm`, `aria-label="Copy ISRC"`).
- Fallback: `sn-copy-button__fallback` with a message, a read-only `<textarea>` (selected and focused) and "Try copy again".

## States
| State | How |
|---|---|
| Idle | copy icon + label |
| Copied | `data-state="copied"`: check icon in `status-ok`, label "Copied" for 2 s, width held with `min-width` |
| Refused | fallback box in `status-warn-bg` with the text selected |

## Behaviour
Try `navigator.clipboard.writeText` (secure contexts), then the legacy `execCommand("copy")`, then the fallback. Never fail silently.

## Content rules
Button: "Copy tracklist", "Copy Spotify link". Announcement: "<What> copied" ("Spotify ID copied"). Fallback: "Copy isn’t allowed in this browser. The tracklist is selected below: press Ctrl + C (⌘ + C on Mac) to copy it." Tracklists copy as "1. Artist – Title" lines with an en dash.

## Accessibility
Icon-only copy buttons name the value ("Copy ISRC"). The result is announced through a polite live region; focus stays on the button. In the fallback, focus moves to the selected text.

## Responsive
Value rows wrap and long values break anywhere. On touch screens the icon button grows to 44px.

## Do / don't
- Do keep the button where the value is; don't make people open a menu to copy an ID.
- Don't show a toast as well as the inline check; one confirmation is enough.

## In SongNodes / in the music library
Replaces `navigator.clipboard.writeText` + `toast.success('Setlist copied to clipboard')` in `SetlistBuilder/index.tsx`; adds copy to the track details modal (Spotify ID, ISRC) and Pipeline file paths. In the Naarm Set Builder: "Copy tracklist".
