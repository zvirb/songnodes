# Card
A 14px container that groups one thing: neutral by default, tonal in its module's colours on hub pages, with media, compact list and whole-card link variants.

## When to use
- A self-contained summary that links or acts: a radio show, a saved set, a module tile, a "this week" summary.
- Don't nest cards, and don't use a card only to put a border round a form section.

## Anatomy and markup
Core `sn-card` (`surface-1`, `line`, `radius-card`, `shadow-1`) with `__head`, `__eyebrow`, `sn-title title-s`, `__text` and `__foot` (pinned to the bottom so heights align). Grid: `sn-card-grid` (auto-fill, min `--sn-card-min`, default 220px; cards stretch to equal height).

## Variants
- Neutral: `sn-card`.
- Tonal: `sn-card sn-card--tonal` inside `sn-m-<module>`. Fill, border, text, tags and secondary buttons all take module shades; only status pills keep status colours. Hub pages only.
- Media: `sn-card--media` with `__media` (16:9 image flush to the 14px top corners, Ghost-style) then `__body`. Without an image use `__media--placeholder` (module-tinted; the only place a gradient is allowed) with a Lucide icon.
- Compact list: `sn-card--list` with `__list` rows (40px; the value on the right never wraps).
- Clickable: `sn-card--link` with exactly one `a.sn-card__primary` in the title; its `::after` covers the card so the whole card is the target. Any other link or button inside takes `sn-card__raise` to stay clickable. The focus ring draws round the whole card.
- Footer actions: `__foot` holds a secondary and a quiet button, never the page's primary.
- Holding a table or a lone state: when a card's only child is a `.sn-tablebox`, a `DataTable`, or one `EmptyState` / `LoadingState` / `ErrorState`, the card is flush (padding 0, clipped corners) and the table cells or state panel carry the inset. This rule has the same specificity as `.sn-card`, so a page's own card padding still wins. Put a title above such a card (a `SectionHeading`), not inside it; with a title inside, the card is padded as normal.

## States
Hover on link cards: the border takes the module colour. Loading: `sn-skel` lines in place of text. Empty: say what will appear here and how to get it.

## Accessibility
Use `article` or `section` with `aria-labelledby` pointing at the title. A clickable card has one accessible link (the title); don't wrap a card holding other controls in `<a>`.

## Responsive
The grid reflows from 4 across to 1 on phones. On wall displays raise `--sn-card-min` rather than stretching cards.

## Do / don't
- No left-border accent cards, no glow, no shadow beyond `shadow-1`.

## In SongNodes
Replaces `ui/Card.tsx` and `InfoCard.tsx`; the tonal module tiles are the hub/home layout.
