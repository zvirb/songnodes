# CommandPalette

Quick search across tracks, artists, sets, pages and actions, opened with Ctrl/⌘ K or / from anywhere, showing key, BPM and energy in track rows.

## When to use
- Jumping to anything by name, key (8A) or BPM (124), and running common actions without hunting for them.
- Not as the library's filter (use the filter rail), not for long result lists (open Library with the query instead).

## Anatomy and markup
Modal dialog → combobox input → grouped listbox → footer key hints.
```html
<div class="sn-command-palette__scrim">
  <div class="sn-command-palette" role="dialog" aria-modal="true" aria-label="Quick search">
    <div class="sn-command-palette__field">…search…
      <input class="sn-command-palette__input" role="combobox" aria-expanded="true" aria-controls="qs-list" aria-autocomplete="list" aria-activedescendant="qs-o0" aria-label="Search" placeholder="Search tracks, artists, sets, pages or actions"><kbd>Esc</kbd></div>
    <div class="sn-command-palette__list" role="listbox" id="qs-list" aria-label="Results">
      <div class="sn-command-palette__group" role="group" aria-labelledby="qs-g0"><div class="sn-command-palette__heading" id="qs-g0" role="presentation">Tracks</div>
        <div class="sn-command-palette__option sn-m-library" role="option" id="qs-o0" aria-selected="true">…music…
          <span class="sn-command-palette__main"><span class="sn-command-palette__name">Glue</span><span class="sn-command-palette__sub">Bicep</span></span>
          <span class="sn-command-palette__data"><span class="sn-key" data-key="8A">8A</span><span class="sn-bpm"><b>130</b> BPM</span>…energy…</span></div></div></div>
    <div class="sn-command-palette__empty" hidden></div>
    <div class="sn-command-palette__foot">↑↓ move · Enter open · Esc clear, then close</div>
  </div></div>
```
Group order is fixed: Tracks, Artists, Sets, Pages, Actions. Icons take the destination module colour.

## States
- **Before typing**: recent tracks, artists and sets, then a few pages and actions; headings say "Recent tracks".
- **Results**: matches underlined in `brand` (`mark`), first result active. Track rows show key dot + code, BPM, energy bar.
- **No match**: icon, "No tracks, artists, sets or pages match “Bicep Atlas remix”.", then what to try next.
- Active row: `brand-soft` fill and a 3px `brand` inner edge.

## Content rules
Placeholder lists what can be found. A query that is a Camelot code filters by key; a 2–3 digit number filters by BPM ±1. Actions are verbs: "Build set", "Import tracklist".

## Accessibility (WAI-ARIA combobox with listbox popup)
- Focus stays in the input; ↑/↓ move `aria-activedescendant` (wrapping), Enter opens the active result.
- Esc clears the query, a second Esc closes and returns focus to where it was. Tab is kept inside the dialog.
- Result counts are announced politely ("6 results", "No results").
- / opens only when focus is not in a text field.

## Responsive
Phone: full width with 16px margins, opens near the top; energy bars hide, the number stays. Desktop: 640px wide, 12vh from the top. Wall: same size.

## Do / don't
- Do keep one palette; header search, / and Ctrl/⌘ K all open it.
- Don't show more than six tracks; offer "Show all in Library" instead.
- Don't hijack Ctrl/⌘ F (browser find).

## In SongNodes
Replaces `QuickSearch.tsx`, the Ctrl+F search panel toggle in `App.tsx`, `TrackSearch.tsx` in the header and the Cmd/Ctrl+K handler in `IntelligentBrowser/hooks.ts`.

## In the music library
Search across the crate, saved sets and shows ("PBS Soul Time"), plus actions like "Build set".
