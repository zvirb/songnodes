# ChipInput

A free-entry field that turns typed values into removable chips: Enter or a comma adds, Backspace on an empty field removes the last chip, duplicates are rejected with a message, and suggestions appear as you type.

## When to use / not use
Use for short open-ended lists: genres, tags, search terms, aliases. If the values come from a closed list, use FilterChips; if only one value is allowed, use a TextField or combobox.

## Anatomy & markup
```html
<div class="sn-field sn-chip-input">
  <label class="sn-field__label" for="g">Genres</label>
  <span class="sn-field__help" id="g-h">Press Enter or a comma to add. Backspace removes the last one.</span>
  <div class="sn-chip-input__box">
    <ul class="sn-chip-input__list" aria-label="Genres added">
      <li class="sn-chip-input__chip">Deep house<button class="sn-chip-input__remove" aria-label="Remove Deep house">×</button></li>
    </ul>
    <input class="sn-chip-input__text" id="g" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="g-menu" aria-describedby="g-h g-msg">
    <ul class="sn-chip-input__menu" role="listbox" id="g-menu" hidden>
      <li class="sn-chip-input__option" role="option" aria-selected="false">Speed <mark>ga</mark>rage <small>41 tracks</small></li>
    </ul>
  </div>
  <span class="sn-chip-input__msg" id="g-msg" aria-live="polite"></span>
</div>
```

## Behaviour
Enter or comma adds the highlighted suggestion or the typed text (trimmed, spaces collapsed). Pasting "acid, dub, piano" adds three. Duplicates (case-insensitive) are not added: the message "“piano” is already added." shows in `status-warn` and the existing chip flashes an outline. Backspace on an empty field removes the last chip. Suggestions follow the APG combobox list pattern: Down/Up move (`aria-activedescendant`), Escape closes, clicking an option adds it; already-added values are not suggested.

## States
Focus ring on the whole box, invalid (`data-invalid`), suggestions open (`shadow-2` popover at `z-popover`), message (neutral or warn).

## Content rules
Chips keep the user's casing. Messages: "Added Deep house. 3 in total.", "Removed piano.", "“piano” is already added." Suggestions show the track count in mono.

## Accessibility
The list of chips is a labelled list; each remove button is named "Remove <value>". Adds, removals and rejections are announced in the polite message line. Remove buttons are 24px (WCAG 2.2 minimum), chips 26px.

## Responsive
Chips wrap inside the box; the text input keeps at least 6rem.

## Do / don't
- Do accept a comma-separated paste.
- Don't silently drop duplicates; say why nothing happened.

## In SongNodes / in the music library
Replaces genre multi-selects in `AdvancedSearch.tsx` and `TrackEditModal.tsx`, and search terms in `TargetTracksManager.tsx`. In the music library: track tags and the genre list per pillar.
