# Disclosure
A show/hide section on native `<details>`/`<summary>`, with a rotating chevron, an optional hint, and its open state remembered per section on this device.

## When to use
- Secondary content people need sometimes: method notes ("How energy is scored", "How the library is built"), advanced filters, raw payloads, long help.
- Don't hide anything needed for the main task. Not for site navigation, or for tabs that swap content in place.

## Anatomy and markup
`details.sn-disclosure` → `summary` (chevron span, text, optional `__hint`) → `__body`. Stacked disclosures share dividers.
```html
<details class="sn-disclosure" data-remember="library.how-energy">
  <summary><span class="sn-disclosure__chev">…chevron-right…</span>How energy is scored<span class="sn-disclosure__hint">1 to 10</span></summary>
  <div class="sn-disclosure__body"><p>…</p></div>
</details>
```

## Variants
- Plain (default): divider lines, for method notes in pages and panels.
- `sn-disclosure--boxed`: a bordered `surface-1` box, for filter rails.
- Inside tonal cards, text and dividers take module shades.

## Behaviour
The chevron rotates 90° when open (`duration-fast`; off with reduced motion). With `data-remember` (React `rememberKey`) the open state is stored in localStorage under `sn-disclosure:<key>`, inside try/catch; if storage is blocked it falls back to the authored `open` state.

## Content rules
The summary is a noun phrase or a question in sentence case ("How energy is scored", "Advanced filters"). The hint shows state at a glance ("2 on").

## Accessibility
Native `details` gives the button role, expanded state and Enter/Space toggling; don't add ARIA on top. The summary is at least `touch-min` (44px) tall. Don't put interactive controls inside the `summary`.

## In SongNodes / the music library
Replaces the custom expand toggles for advanced filters in `FilterPanel.tsx` and `GraphFilterPanel.tsx`, and the method notes on the Naarm library page. "How energy is scored" sits next to the EnergyBar legend.
