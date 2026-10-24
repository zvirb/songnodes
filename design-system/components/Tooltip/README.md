# Tooltip

A short supplementary label shown on hover and keyboard focus: an icon button's name, the key name behind "8A", the absolute time behind "3 h ago".

## When to use
- Names of icon-only buttons (with the shortcut), the full key name behind a Camelot code, the absolute time and source behind a relative time, a truncated track title.
- Never for essential information, instructions, errors, or anything interactive (links, buttons): use Popover or put it on the page. Never on touch-only controls as the only label.

## Anatomy
```html
<span class="sn-key" data-key="3B" tabindex="0" aria-describedby="tip">3B</span>
<div class="sn-tooltip" id="tip" role="tooltip">F♯ major · Camelot 3B</div>
<!-- icon button: aria-label="Lock slot 3"; tooltip shows "Lock slot 3" + <span class="sn-tooltip__kbd">L</span> -->
```
Inverse colours (`fg` on `bg`), `radius-chip`, `shadow-2`, `z-tooltip`, max 16rem. `__data` for mono values, `__kbd` for a key cap. `sn-tooltip--static` only for documentation.

## Behaviour
- Keyboard focus (`:focus-visible`): appears **immediately**, so keyboard users never wait for a name. Mouse hover: appears after **500 ms**, so sweeping the pointer across a toolbar doesn't flash tips. Hides **immediately** on leave or blur (decided).
- Esc hides it without moving focus (WCAG 1.4.13 dismissible). The pointer can move onto the tooltip without it closing (hoverable); it stays while hovered or focused (persistent).
- Above the trigger, flips below near the top edge, kept inside the viewport. No arrow.
- One tooltip at a time.

## Content rules
A few words, no full stops: "Lock slot 3", "A minor · Camelot 8A", "24 Oct 2026, 18:30 AEDT on 3RRR Superfreak". Same wording as the `aria-label` for icon buttons.

## Accessibility
- `role="tooltip"`; supplementary text is linked with `aria-describedby`. For icon buttons the name lives in `aria-label` and the tooltip repeats it visually (not linked twice).
- The trigger must be focusable (`tabindex="0"` on keys and times that have tooltips).
- Touch: long-press shows it; the information must also be reachable in a detail view.

## Responsive
Same at all widths; on wall displays text scales with the booth/text-size setting.

## Do / don't
- Do use for every icon-only button.
- Don't put links, buttons or multi-line explanations in a tooltip.

## In SongNodes
Replaces SmartTooltip.tsx (keep its 500 ms hover delay, but show at once on keyboard focus; drop interactive tooltip content into Popover), `title` attributes on graph controls, the ContextMenu icon hints, and relative times in the monitoring "Recently scraped data" list.

## In the music library
Key codes in the crate ("8A" → "A minor"), "Last heard" relative times, the lock/up/down/remove icons in the running order.
