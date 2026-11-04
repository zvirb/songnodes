# ICO rules (generated)

| ID | Rule | Check | Test |
|---|---|---|---|
| ICO-001 | The wordmark "SongNodes" shall be live text, not an image, outlined path or boxed element. | dom | Fail if the wordmark is an img/svg/canvas or sits inside a bordered or filled box. |
| ICO-002 | The wordmark shall be set in Sora weight 800 via --font-display with letter-spacing -0.01em. | lint | Computed font-family resolves to Sora, font-weight is 800, letter-spacing is -0.01em. |
| ICO-003 | The wordmark shall use the brand colour token on every theme and the on-brand token when placed on a brand fill. | lint | Wordmark color resolves to var(--brand), or var(--on-brand) on a brand-filled background. |
| ICO-004 | The wordmark shall not use other colours, gradients or shadow. | lint | Fail if the wordmark has a gradient, text-shadow or a colour other than brand/on-brand. |
| ICO-005 | The wordmark shall be 1.125rem in AppHeader and display-xl on HomePage and the cover. | dom | Computed font-size is 1.125rem in AppHeader and the display-xl size on HomePage/cover. |
| ICO-006 | The wordmark shall not be set smaller than 0.875rem. | lint | Computed wordmark font-size >= 0.875rem. |
| ICO-007 | The music library product name shall be "Music library" set in the same style as the wordmark, in sentence case. | dom | Music library wordmark text equals "Music library" and uses the wordmark style. |
| ICO-008 | Prose shall refer to the music library as "the music library". | judgement | Prose mentions use lower-case "the music library". |
| ICO-009 | The Naarm Set Builder artifact may add the page title "Set builder" but its wordmark shall be "Music library". | dom | Naarm Set Builder wordmark text is "Music library". |
| ICO-010 | The interface shall not draw a logo mark (node-and-edge glyph, note, disc or monogram) outside the favicon tile. | visual | No drawn mark appears in header, home or cover. |
| ICO-011 | The favicon shall not be a gradient tile with drawn nodes and a note. | visual | favicon.svg contains no gradient, node glyph or note glyph. |
| ICO-012 | The document title shall follow the pattern "<Page title> · <Module> · SongNodes" using a middle dot (U+00B7) with a space either side. | dom | document.title matches /^.+ · .+ · SongNodes$/ (or the shorter forms for Home, Graph and Errors). |
| ICO-013 | The document title shall drop the module segment when the page title equals the module. | dom | No title repeats the same text as both page title and module. |
| ICO-014 | The document title shall be updated on every route change. | dom | After each client-side navigation document.title changes to the new route title. |
| ICO-015 | The document title of unsaved work shall be prefixed with "• ". | dom | With unsaved changes document.title starts with "• ". |
| ICO-016 | The frontend index.html shall not contain the title "SongNodes DJ - Interactive Mixing Assistant". | lint | grep of index.html for the old title returns nothing. |
| ICO-017 | One favicon shall be used for every page and module; module-coloured favicons shall not be used. | lint | All pages link the same favicon file; no per-module favicon files exist. |
| ICO-018 | favicon.svg shall be a rounded tile (radius 22% of size) in the brand dark value with "SN" in Sora 800 in the on-brand colour, centred. | visual | Rendered favicon.svg shows a #9b85cb rounded tile with centred #160f26 "SN". |
| ICO-019 | The favicon set shall also provide 16 and 32 px PNGs, a 180 px apple-touch-icon, 512 and 192 px icons and a maskable variant with 20% safe padding. | lint | All listed files exist at the listed sizes; maskable variant has 20% padding. |
| ICO-020 | Favicons shall be linked in head and in manifest.webmanifest with theme_color #222222, background_color #222222 and name "SongNodes". | lint | head has the link tags and the manifest holds the three listed values. |
| ICO-021 | Icons shall be Lucide icons. | lint | Every icon SVG comes from the Lucide set (assets/Icons or lucide-react). |
| ICO-022 | The lucide-react dependency shall be pinned to an exact version without a caret. | lint | package.json lucide-react version has no ^ or ~. |
| ICO-023 | Icons shall be self-hosted and shall not be loaded from a CDN. | lint | No icon URL points to an external host. |
| ICO-024 | Icons shall use a 2px stroke, round caps and joins and no fill. | lint | .sn-icon computed stroke-width is 2, stroke-linecap and linejoin round, fill none. |
| ICO-025 | Icons shall inherit their colour from currentColor. | lint | Icon stroke computes to currentColor. |
| ICO-026 | Icon size shall be 16px in dense tables and chips, 18px by default, 20px in AppHeader and drawer rows, and 24px (.sn-icon--lg) in empty states and launcher cards. | dom | Computed icon size matches the size for its context. |
| ICO-027 | Icon stroke width shall not be scaled with icon size. | lint | Computed stroke width stays 2px at every icon size. |
| ICO-028 | A new icon shall be added only when its meaning is not already in the icon meaning table, and shall be added to assets/Icons and the table. | judgement | New icon has no existing equivalent in the table and a table row is added. |
| ICO-029 | Each icon shall be used only for the single meaning given in the icon meaning table; where a meaning is not in the table text shall be used. | judgement | Each icon use maps to its table meaning; no icon carries a second meaning. |
| ICO-030 | Emoji shall not appear in UI text, buttons, tabs, placeholders, empty states, toasts or console-visible copy. | lint | Emoji regex over UI strings and logs returns no match. |
| ICO-031 | Emoji that previously appeared in UI shall be replaced by the icon or text-only form given in the banned-substitutions table. | judgement | Each former emoji site uses the substitution from the table. |
| ICO-032 | Decorative icons next to a label shall have aria-hidden="true" and focusable="false". | dom | Every icon beside a visible label has both attributes. |
| ICO-033 | Meaningful standalone icons outside a button shall be created with SongNodes.icon(name, { label }) so they carry role="img" and aria-label. | dom | Standalone meaningful icon has role=img and a non-empty aria-label. |
| ICO-034 | Icon-only buttons shall carry the accessible name on the button element (aria-label naming action and object) and keep the SVG hidden. | dom | Every button with no visible text has a non-empty aria-label and an aria-hidden svg. |
| ICO-035 | Icon-only buttons shall have a Tooltip with the same words as the accessible name. | dom | Icon-only button tooltip text equals its aria-label. |
| ICO-036 | An accessible name shall not rely on the title attribute alone. | lint | No element is named only by title. |
| ICO-037 | Toggle buttons shall keep one accessible name and change aria-pressed rather than swapping the label. | dom | Toggling a button leaves aria-label unchanged and flips aria-pressed. |
| ICO-038 | Status and verdicts shall use text glyphs from SongNodes.GLYPH, and actions and objects shall use Lucide icons. | judgement | Status/verdict elements contain a GLYPH character; action buttons contain a Lucide icon. |
| ICO-039 | Each text glyph shall be used only for its meaning in the glyph table. | judgement | Glyph usage matches the glyph table meaning. |
| ICO-040 | A status pill or compatibility badge shall carry a glyph and shall not carry a Lucide icon. | dom | StatusPill/CompatibilityBadge contain no .sn-icon svg. |
| ICO-041 | A button shall carry a Lucide icon and shall not carry a text glyph. | dom | Button contains no GLYPH character as icon. |
| ICO-042 | Compatibility verdicts shall not use the glyphs ✓, ✗, ~ or "✓✓". | lint | COMPATIBILITY_PROPS and compat UI contain none of those glyphs. |
