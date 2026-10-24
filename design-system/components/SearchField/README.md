# SearchField

A search box with a search icon, a clear button, a live result count ("42 of 1,284 tracks"), a typo-tolerant "Did you mean Overmono?" line and the "/" shortcut.

## When to use / not use
Use to filter a list in place (library, crate, target tracks, review queue) or to search one module. For the app-wide Cmd/Ctrl+K quick search use the QuickSearch dialog. For picking one value from a known list use a combobox.

## Anatomy & markup
```html
<form class="sn-search-field" role="search" data-empty>
  <label class="sn-sr" for="q">Search tracks</label>
  <div class="sn-search-field__box">
    <span class="sn-search-field__icon"><svg class="sn-icon">search</svg></span>
    <input class="sn-input sn-search-field__input" type="search" id="q" aria-keyshortcuts="/" aria-describedby="q-meta">
    <span class="sn-search-field__end">
      <kbd class="sn-search-field__kbd" aria-hidden="true">/</kbd>
      <button class="sn-search-field__clear" type="button" aria-label="Clear search">…</button>
    </span>
  </div>
  <div class="sn-search-field__meta" id="q-meta">
    <span class="sn-search-field__count" role="status"><b>42</b> of 1,284 tracks</span>
    <span class="sn-search-field__suggest">Did you mean <button type="button">Overmono</button>?</span>
  </div>
</form>
```
`data-empty` on the form hides the clear button; the `/` hint shows only when empty and unfocused (and never on touch).

## States
Empty (hint), typing (clear button, live count), no results (count 0 + suggestion or "No tracks match “…”. Check the spelling or clear filters."), focus ring on the input.

## Behaviour
Filter as you type (debounce about 150 ms for large lists). "/" focuses the field from anywhere except other text fields. Escape clears the text and keeps focus in the field. The suggestion uses edit distance against artist and title names (at most 2 edits, or a quarter of the query length) and only shows when there are no results.

## Content rules
Placeholder names what can be searched: "Search artist, title or label". Count: "**42** of 1,284 tracks". No emoji in the placeholder.

## Accessibility
`role="search"` landmark, a real (visually hidden) label, `type="search"`. The count is a polite `role="status"` described by the input. The clear button is a 32px button (44px on touch) named "Clear search" and returns focus to the input.

## Responsive
Full width of its container; in the FilterRail it fills `rail-w`. On phones the shortcut hint is hidden.

## In SongNodes / in the music library
Replaces the "🔍 Search tracks, artists, BPM, key..." input in `DJInterface.tsx`, the search in `MobileTrackExplorer.tsx` and `IntelligentBrowser/SearchBar.tsx`. In the Naarm Set Builder: the search at the top of the filter rail.
