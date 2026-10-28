# CopyButton

Copies a tracklist, ID, ISRC, link or a listed file's path to the clipboard, swaps its icon to a check for 2 seconds and announces "Copied"; when the browser refuses, it selects the text in a box so the person can copy it themselves.

## When to use / not use
Use next to values people paste elsewhere: tracklists for socials, Spotify IDs, ISRCs, Beatport IDs, links to a set. Don't use it for values that are only read, or as a substitute for an export (CSV/JSON export is a Button).

**A file's path (1.4.0, imported from BeanAlliance CopyPath v4.17/v4.17.1):** a path is never printed on a page (01-writing, *File paths and system locations*). A file listed in a table or list shows its file **name** in mono, and its row ends with an **icon-only** CopyButton whose `title` tooltip carries the full path: the only place the path appears. There is no labelled "Copy path" button, and a folder gets no copy button at all (it is named in words: "Music library folder").

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
- File in a table row: the name in the cell as `<code>overmono-so-u-kno.aiff</code>`; in the row's last cell `<button class="sn-btn sn-btn--icon sn-btn--quiet sn-btn--sm sn-copy-button" aria-label="Copy the path of overmono-so-u-kno.aiff" title="/Volumes/Crates/2026/10-Oct/overmono-so-u-kno.aiff" data-copy="…">`. The `title` lets a mouse user read the path on hover without it taking a line; a screen reader hears "Copy the path of …" and then "Path copied" (nobody needs a path read out, and `title` is not reliably announced). In the React app the tooltip is the `Tooltip` component, so it also shows at once on keyboard focus (16-platform: hover never holds the only way to information), with the path on a second line in `sn-tooltip__data`; it repeats the name visually and is not linked with `aria-describedby`. Static artifacts use the `title`.
- Fallback: `sn-copy-button__fallback` with a message, a read-only `<textarea>` (selected and focused) and "Try copy again". For a path, this box is the one time the path is drawn.

## States
| State | How |
|---|---|
| Idle | copy icon + label |
| Copied | `data-state="copied"`: check icon in `status-ok`, label "Copied" for 2 s, width held with `min-width` |
| Refused | fallback box in `status-warn-bg` with the text selected |

## Behaviour
Try `navigator.clipboard.writeText` (secure contexts), then the legacy `execCommand("copy")`, then the fallback. Never fail silently.

## Content rules
Button: "Copy tracklist", "Copy Spotify link". Icon-only for a file: "Copy the path of <file name>". Announcement: "<What> copied" ("Spotify ID copied", "Path copied"). Never a path in the label, the announcement or a toast. Fallback: "Copy isn’t allowed in this browser. The tracklist is selected below: press Ctrl + C (⌘ + C on Mac) to copy it." Tracklists copy as "1. Artist – Title" lines with an en dash.

## Accessibility
Icon-only copy buttons name the value ("Copy ISRC"). The result is announced through a polite live region; focus stays on the button. In the fallback, focus moves to the selected text.

## Responsive
Value rows wrap and long values break anywhere. On touch screens the icon button grows to 44px.

## Do / don't
- Do keep the button where the value is; don't make people open a menu to copy an ID.
- Don't show a toast as well as the inline check; one confirmation is enough.

## In SongNodes / in the music library
Replaces `navigator.clipboard.writeText` + `toast.success('Setlist copied to clipboard')` in `SetlistBuilder/index.tsx`; adds copy to the track details modal (Spotify ID, ISRC) and an icon-only path copy on each file row in Pipeline (audio analysis, exports), with the file name shown and the path only in the tooltip. In the Naarm Set Builder: "Copy tracklist".
