# CategoryTag
A small neutral tag for what kind of thing something is: genre, pillar, rotation, remix type or graph edge type.

## When to use
- Categories that describe or filter: House, Techno, UK garage; High rotation, Standard, Vault; Original, Extended, Edit, VIP; Played next to, Similar.
- Don't use for status (StatusPill) or toggles (`sn-chip` with `aria-pressed`). Tags are not buttons.

## Anatomy and markup
Core `sn-tag` plus `sn-category-tag`: 4px radius (`radius-chip`), `surface-2` fill, `fg-2` text, optional Lucide icon.
```html
<span class="sn-tag sn-category-tag">UK garage</span>
<span class="sn-tag sn-category-tag sn-category-tag--high">High rotation</span>
<span class="sn-tag sn-category-tag sn-category-tag--vault">Vault</span>
```

## Variants
- Default: neutral.
- Rotation values are calculated: High rotation and Vault are worked out by the weekly run from the library's own play data (rule in Music domain → Rotation). The tag shows the run's verdict; never explain it with a fixed threshold.
- `--high`: High rotation only. `brand-soft` fill, `fg` text, 600 weight. The word carries the meaning; the fill is emphasis. In selected table rows it gains a `brand` border so it stays visible on `brand-soft`.
- `--vault`: muted. Transparent with a `line-strong` border and `fg-3` text.
- `--data`: mono, for code-like categories.
- Inside `sn-card--tonal` every tag takes `--m-raised` / `--m-ink`; High rotation adds a `--m-line` border; Vault becomes a `--m-line` outline.

## Content rules
Sentence case, the user's own words: "UK garage", not "UKG" (abbreviate only in narrow columns, with the full word in `title`). Remix types: Original, Extended, Edit, VIP, Remix, Dub, Radio edit. Edge types: Played next to (adjacency), Similar (similarity), Collaboration, Same genre, Key compatible.

## Accessibility
Plain text, no role. If a tag also filters, render it as a link or an `sn-chip` button, never a clickable span.

## Do / don't
- Don't colour genres or pillars. Category colours read as status and break the traffic-light vocabulary.
- Don't put more than 3 tags in a table cell; the rest go in the detail view.

## In SongNodes / the music library
Crate Pillar and Rotation columns, genres in track detail, the graph edge legend and edge type in `EdgeDetailsModal.tsx`, remix type in `TrackDetailsModal.tsx`. Replaces the coloured genre chips in `FilterPanel.tsx`.
