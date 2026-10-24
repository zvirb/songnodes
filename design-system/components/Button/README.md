# Button

Buttons start an action on this page; links go somewhere else. Label every button with a verb in sentence case that says what happens ("Build set", "Copy tracklist"), and name who or what it affects when that isn't obvious ("Delete set", "Clear the current draft").

## When to use / not use
Use for actions: build, save, copy, test, import, remove. Don't use a button to navigate; use `sn-link` (or `a.sn-btn` only for a launcher call to action on an empty state or hub page).

## Kinds
| Kind | Class | Use |
|---|---|---|
| Primary | `sn-btn sn-btn--primary` | The one action the view exists for. **At most one per view.** `brand` fill with `on-brand` text. |
| Secondary | `sn-btn` | Everything else. `surface-1` fill, `line-strong` border. Inside a tonal card it takes `--m-raised` and `--m-ink` automatically. |
| Quiet | `sn-btn sn-btn--quiet` | Low-stakes or repeated actions: "Clear filters", "Cancel", table row actions. |
| Module | `sn-btn sn-btn--mod` inside an `sn-m-<module>` scope | An action that takes you into another module, or the main action of a module card on a hub page. The module colour doubles as a destination cue. |
| Danger | `sn-btn sn-btn--danger` / `sn-btn--danger-quiet` | Irreversible removal, only inside a confirmation step (see ConfirmDialog). Never the first button the eye lands on. |

## Anatomy
```html
<button class="sn-btn" type="button"><svg class="sn-icon">…</svg>Copy tracklist</button>
```
Optional leading Lucide icon (`SongNodes.icon()`), then the label. Always set `type="button"` outside forms.

## Sizes
`sn-btn--sm` (32px) in toolbars and table rows, default 40px, `sn-btn--lg` (48px) for empty-state actions and booth mode. On touch screens every size grows to the 44px `touch-min` (WCAG 2.2 target size is met at 24px; 44px is our touch floor).

## Icon-only
`sn-btn sn-btn--icon` with an `aria-label` that names the action and its object ("Lock slot 3"). Use only for the icons in the icon table (lock, move up/down, remove, more actions, close, copy); everything else gets a text label. Never an emoji.

## States
Hover and pressed shift the fill one surface step; focus shows the 2px `focus` ring (3px in booth). Disabled uses the `disabled` attribute, or `aria-disabled="true"` when it must stay focusable so a tooltip or nearby text can explain why, at `opacity-disabled`. Busy: set `aria-busy="true"`, put an `sn-spinner` before the label and change the label to the ongoing verb ("Saving…", "Testing…"); keep the width stable (set `min-width` to the idle width).

## Content rules
Verb first, sentence case, no full stop: "Build set", "Try another take", "Send to TIDAL". Name the count when it matters: "Import 7 tracks", "Show 95 tracks". No "OK", "Submit" or "Click here".

## Accessibility
Native `<button>`: Enter and Space activate. Toggle buttons use `aria-pressed`. Never remove the focus ring. Announce results of an action (copied, saved) with a polite live region, not by changing the button alone.

## Responsive
Button rows wrap; in dialogs and sheet footers the primary stretches to full width on phones. Keep the primary last in reading order.

## Do / don't
- Do put the primary action last in a row of buttons (right-aligned in dialogs and forms), Cancel before it.
- Don't colour a button by status (no green "Save"). Status lives in pills and messages.
- Don't put two primary buttons in one view; demote one to secondary.

## In SongNodes / in the music library
Replaces the emoji buttons in `DJInterface.tsx` ("🔧 Filters"), `TracklistImporter.tsx` ("🔍 Parse Tracklist") and `TargetTracksManager.tsx` ("🔍 Search Services"). In the Naarm Set Builder: Build set (primary), Try another take, New empty set, Save set, Copy tracklist.
