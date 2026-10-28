# AutocompleteSearchField

A SearchField that offers completions as you type: recent searches when the field is empty, then artists, titles, tags and keys that start with what you typed, chosen with the arrow keys and Enter.

## When to use / not use
Use where people search a known vocabulary and finish names they half remember: the crate filter search, the route finder's start and end tracks, target-track search. Keep the plain SearchField where completions would add nothing (a short list on screen). For the app-wide Cmd/Ctrl+K search use CommandPalette. To pick several values use ChipInput; to pick one value from a short fixed list use SelectField.

## Anatomy & markup
```html
<form class="sn-search-field sn-autocomplete" role="search">
  <label class="sn-sr" for="q">Search tracks</label>
  <div class="sn-search-field__box">
    <span class="sn-search-field__icon"><svg class="sn-icon">search</svg></span>
    <input class="sn-input sn-search-field__input" type="search" id="q" role="combobox"
           aria-autocomplete="list" aria-expanded="true" aria-controls="q-list"
           aria-activedescendant="q-opt-s1" aria-describedby="q-meta" autocomplete="off" spellcheck="false">
    <span class="sn-search-field__end">
      <button class="sn-search-field__clear" type="button" aria-label="Clear search">…</button>
    </span>
    <div class="sn-autocomplete__popup">
      <ul class="sn-autocomplete__list" role="listbox" id="q-list" aria-label="Search suggestions">
        <li class="sn-autocomplete__group" role="group" aria-labelledby="q-g-recent">
          <span class="sn-autocomplete__group-label" id="q-g-recent">Recent searches</span>
          <ul class="sn-autocomplete__options" role="none">
            <li class="sn-autocomplete__option" role="option" id="q-opt-r1" aria-selected="false">
              <span class="sn-autocomplete__icon" aria-hidden="true"><svg class="sn-icon">history</svg></span>
              <span class="sn-autocomplete__text"><mark>bic</mark>ep glue</span>
            </li>
          </ul>
        </li>
        <li class="sn-autocomplete__group" role="group" aria-labelledby="q-g-sugg">
          <span class="sn-autocomplete__group-label" id="q-g-sugg">Suggestions</span>
          <ul class="sn-autocomplete__options" role="none">
            <li class="sn-autocomplete__option" role="option" id="q-opt-s1" aria-selected="true">
              <span class="sn-autocomplete__icon" aria-hidden="true"><svg class="sn-icon">search</svg></span>
              <span class="sn-autocomplete__text"><mark>Bic</mark>ep</span>
              <span class="sn-autocomplete__meta">Artist · 41</span>
            </li>
          </ul>
        </li>
      </ul>
      <div class="sn-autocomplete__foot"><button class="sn-autocomplete__clear" type="button">Clear recent searches</button></div>
    </div>
  </div>
  <div class="sn-search-field__meta" id="q-meta">…count, as SearchField…</div>
</form>
```
Everything SearchField has (icon, clear button, `/` hint, live count, "Did you mean") stays. `data-empty` on the form still hides the clear button. The popup carries `hidden` when closed.

## States
Closed (a SearchField). Open with recent searches only (empty field, focused). Open with suggestions (typing; recent searches that match stay above them). Active option (`aria-selected="true"`: `brand-soft` with a 2px `brand` edge, so it never relies on colour alone). No match: the popup closes and the SearchField count and suggestion line explain it; never an empty popup.

## Behaviour
- Opens on focus when there are recent searches, and on typing when anything matches. At most 5 recent searches and 8 suggestions, best first; the typed prefix is bold (`<mark>`).
- ArrowDown/ArrowUp move the active option and wrap; Home/End stay in the text. Enter chooses the active option, or, with none active, searches the typed text. Choosing puts the value in the field, closes the popup, saves it to recent searches and calls `onSelect`.
- Escape closes an open popup and keeps the text; a second Escape clears the text (SearchField behaviour). Tab closes the popup and moves on. A pointer click chooses an option without moving focus out of the field.
- Recent searches are stored per place (`library-crate`, `pathfinder-waypoints`) by `utils/recentSearches.ts`, newest first, at most 10; "Clear recent searches" empties that place's list.
- Suggestions come from the caller (for example a `LexiconTrie` built from the loaded tracks); the field never fetches.

## Content rules
Group labels "Recent searches" and "Suggestions" (or what the suggestions are: "Tracks", "Artists"). Meta names the kind and a count in mono: "Artist · 41", "Tag · 112", "8A · 124 BPM". Sentence case; no emoji; never "Unknown".

## Accessibility
WAI-ARIA combobox with a listbox popup (APG "list autocomplete with manual selection"): the input has `role="combobox"`, `aria-autocomplete="list"`, `aria-expanded`, `aria-controls` and `aria-activedescendant`; options are `role="option"` with unique ids, grouped by `role="group"` named by their label. Focus never leaves the input. The live count stays the polite status. Options are 36px tall (44px on touch). Clear recent is a real button in the popup foot, outside the listbox.

## Responsive
The popup matches the field's width and scrolls inside itself (max 320px or half the viewport). On phones options grow to 44px; the `/` hint is hidden as in SearchField.

## Do / don't
- Do keep the order stable while the person is moving through it; don't reorder on every keystroke beyond the new prefix match.
- Don't autocomplete inline into the text (no type-ahead selection); the person chooses.

## In SongNodes / in the music library
The crate filter search in `CrateFilterRail.tsx` (UX5, vocabulary from the loaded crate), the start and end track fields in `PathfinderPage.tsx` (UX6, the track catalogue), later the target-track search. Built in React as `components/ds/AutocompleteSearchField.tsx` (UX4).
