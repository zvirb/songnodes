# InlineMessage

A short status message attached to a field, row or card section, with a status glyph and text and no dismiss.

## When to use
- Explaining something about one thing on screen: under the transition list ("2 transitions to look at"), under a field, inside a table cell, at the foot of a card section.
- Not for page-wide conditions (Banner), failed loads (ErrorState) or completed actions (Toast). Plain field validation can keep `sn-field__error`; InlineMessage covers the other statuses and longer guidance.

## Anatomy
```html
<p class="sn-inline-message" data-status="warn">2 transitions to look at: a key clash into slot 6 and a +3 energy jump.
  <a class="sn-link sn-inline-message__action" href="#">Show them</a></p>
```
`sn-inline-message--boxed` adds the status tint for card sections. Use `<span>` inside table cells.

## Variants
| `data-status` | Glyph | Use |
|---|---|---|
| `ok` | ● | "All 14 transitions are perfect or compatible." |
| `fair` | ◐ | Acceptable but not ideal |
| `warn` | ▲ | Needs a look, not blocking |
| `bad` | ✕ | Blocks saving or is wrong |
| `info` | i | Context: "673 tracks without a key are placed by energy alone." |
The glyph carries the colour; text stays `fg-2` (plain) or `fg` (boxed), so meaning never depends on colour.

## Content rules
One or two short sentences with the number. Bold the key phrase with `<strong>`. An optional link that takes the person to the thing ("Show them"). No dismiss, no icons beyond the glyph.

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
