# PageHeader

The header region at the top of a page's content: module band, thin–bold title, one-line description, freshness stamp and the page's actions in one fixed order.

## When to use
- Once per page, directly under AppHeader.
- Not inside cards or dialogs (they have their own heads), and not as the app bar.

## Anatomy and fixed order
1. **Module band**: tonal strip in `--m-bg` with the module icon and the module name as a link back to its index, optionally "› sub-page".
2. **Title**: `sn-title title-m`, lead = module name: "Set builder: **Peak time Friday**".
3. **Description**: one line, `fg-2`, max `prose-max`.
4. **Meta row**: freshness stamp ("Saved 24 Oct 2026, 21:30 AEDT"), then at most one status pill.
5. **Actions** at the right, always in this order: secondary buttons (0–2) → More actions (OverflowMenu) → primary (the view's single `sn-btn--primary`, last).
```html
<header class="sn-page-header sn-m-sets">
  <div class="sn-page-header__band">…icon… <a class="sn-link" href="/sets">Set builder</a><span class="sn-page-header__band-sep" aria-hidden="true">›</span><span class="sn-page-header__band-here">Saved sets</span></div>
  <div class="sn-page-header__main">
    <div class="sn-page-header__text">
      <h1 class="sn-title title-m"><span class="sn-lead">Set builder:</span> Peak time Friday</h1>
      <p class="sn-page-header__desc">Three waves over 92 min: 18 tracks, House 50 · Techno 30 · UK garage 20.</p>
      <p class="sn-page-header__meta"><span class="sn-page-header__stamp">…clock… Saved <time datetime="…">24 Oct 2026, 21:30 AEDT</time></span></p>
    </div>
    <div class="sn-page-header__actions">
      <button class="sn-btn sn-page-header__secondary">Copy tracklist</button>
      <!-- OverflowMenu; repeat the secondary actions in it with class sn-page-header__narrow-only -->
      <button class="sn-btn sn-btn--primary">Save set</button>
    </div></div></header>
```

## Variants
- With or without band sub-page ("› Saved sets").
- Meta with status pill when something needs attention ("✕ 2 paused after errors").
- No primary: pages that only show data (Key & mood) end with More actions.

## States
Primary busy: `aria-busy="true"` + spinner + "Saving…". Stamp updates in place after save. Band link uses `aria-current="page"` when you are on the module index itself.

## Content rules
Title is a name, not a sentence. Description says what the page holds in numbers ("18 tracks", "92 min"). Stamp verb names the event: Saved, Checked, Imported, Updated.

## Accessibility
The title is the page's only `h1`. The band link is a normal underlined link in `--m-ink`. Actions are a flat row of buttons; More actions follows the menu-button pattern.

## Responsive
Container query on the header:
- ≤600px: actions move under the text; secondary buttons hide and their `__narrow-only` copies appear inside More actions; the primary stretches to fill the row.
- Wide and wall: actions stay top-right; the description keeps its `prose-max` measure.

## Do / don't
- Do keep the order even when items are missing; never move the primary to the left.
- Don't put filters or tabs in the header; they go below it.
- Don't use a status colour for the band; it is the module's identity, never health.

## In SongNodes
Replaces the ad-hoc panel titles in `SetlistBuilder`, `StatsPanel`, `DataQualityReview` and `TargetTracksManager` (each had its own button row) and the planned monitoring dashboard heading.

## In the music library
The Set builder's controls header ("Build set", "Try another take", "Save set", "Copy tracklist") maps to: Copy tracklist and Try another take as secondary, Send to TIDAL and New empty set in More actions, Build set or Save set as primary depending on state.
