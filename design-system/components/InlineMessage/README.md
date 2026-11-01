# InlineMessage

A short status message attached to a field, row or card section, with a status glyph and text; a warn or bad message ends with where to fix it, and a boxed one can be dismissed.

## When to use
- Explaining something about one thing on screen: under the transition list ("2 transitions to look at"), under a field, inside a table cell, at the foot of a card section.
- Not for page-wide conditions (Banner), failed loads (ErrorState) or completed actions (Toast). Plain field validation can keep `sn-field__error`; InlineMessage covers the other statuses and longer guidance.

## Anatomy
```html
<p class="sn-inline-message" data-status="warn">2 transitions to look at: a key clash into slot 6 and a +3 energy jump.
  <a class="sn-link sn-inline-message__action" href="#">Show them</a></p>
```
`sn-inline-message--boxed` adds the status tint for card sections. Use `<span>` inside table cells.

A boxed warn or bad message with its source link and dismiss (1.6.0):
```html
<p class="sn-inline-message sn-inline-message--boxed" data-status="warn">
  <span>4 tracks have no Beatport match, so their genre is a guess.
    <a class="sn-link sn-link--src sn-m-sources" href="/sources/enrichment?filter=unmatched" target="_blank" rel="noopener"><span class="sn-go sn-m-sources" aria-hidden="true">…</span>Open Sources · Enrichment<span class="sn-sr"> (opens in a new tab)</span></a></span>
  <button class="sn-btn sn-btn--sm sn-btn--icon sn-btn--quiet sn-inline-message__dismiss" type="button" aria-label="Dismiss: 4 tracks unmatched" title="Dismiss">…x…</button>
</p>
```

## Variants
| `data-status` | Glyph | Use |
|---|---|---|
| `ok` | ● | "All 14 transitions are perfect or compatible." |
| `fair` | ◐ | Acceptable but not ideal |
| `warn` | ▲ | Needs a look, not blocking |
| `bad` | ✕ | Blocks saving or is wrong |
| `info` | i | Context about the data right now: "673 tracks without a key are placed by energy alone." (A sentence that always holds, such as how a figure is worked out, is an `InfoTip`.) |
The glyph carries the colour; text stays `fg-2` (plain) or `fg` (boxed), so meaning never depends on colour.

## Content rules
One or two short sentences with the number. Bold the key phrase with `<strong>`. An optional link that takes the person to the thing ("Show them"). No icons beyond the glyph and a source link's go icon.

- **Warn and bad end with their source** (1.6.0, BeanAlliance v4.19): the last words are a `sn-link--src` naming the page and place where the cause is changed. When that place is on this page ("Show them", a field) it is a same-page link with no icon; another page opens in a new tab led by its go icon. A field error is fixed in the field itself and needs no link. Rules in `Banner`.
- **Boxed warn and bad can be dismissed** (1.6.0, BeanAlliance v4.19.1): an `x` button at the end; the message shrinks to its status icon in place (`.sn-dismissed`) until the next day or until its fact changes, exactly as a `Banner`. Plain messages under a field or in a row are not dismissable: they go when the thing is fixed.
- A message that only explains (help under a field, a note on how a figure is worked out) is not an InlineMessage: it is an `InfoTip` (1.6.0).

## Accessibility
- Under a field: give it an `id` and point the input's `aria-describedby` at it; set `aria-invalid="true"` on the field for `bad`.
- Messages that appear after a change sit inside an existing live region (the list's `role="status"`); don't add `role="alert"` to each.

## Responsive
Wraps naturally; glyph stays on the first line. In phone tables the message moves under the track name.

## Do / don't
- Do keep it next to the thing it is about.
- Don't use it for a message that only makes sense page-wide.

## In SongNodes
Validation `severity` error/warning/info in the data-quality review, enrichment `partial` notes on track rows, "Matched by ISRC; Spotify ID missing" in Target tracks, field help in SettingsPanel and the API key manager.

## In the music library
Under the running order ("2 transitions to look at"), set-control fields (length, pool), "Needs an energy check" on crate rows.
