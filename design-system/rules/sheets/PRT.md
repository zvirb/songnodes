# PRT rules (generated)

| ID | Rule | Check | Test |
|---|---|---|---|
| PRT-001 | Nothing shall download or print unless the person asks. | judgement | No download or print is triggered without a user action. |
| PRT-002 | Printed and exported output shall state what it is, where it came from, when it was produced and how fresh the data was. | judgement | Each print/export carries title, source, time and data freshness. |
| PRT-003 | Artifact pages shall not have print buttons. | dom | No Print button exists in artifact pages. |
| PRT-004 | The print stylesheet shall still apply in artifacts. | visual | Browser print of an artifact applies @media print rules. |
| PRT-005 | "Print set" (icon printer) shall be offered only in the PageHeader overflow of SetBuilderPage. | dom | Only SetBuilderPage overflow contains a Print set item. |
| PRT-006 | PrintSheet shall be a print-ready route (/sets/:id/print) that calls window.print() after document.fonts.ready. | dom | Route exists and print is invoked only after fonts.ready resolves. |
| PRT-007 | Pages other than PrintSheet shall print through the generic print rules and shall not have other Print buttons. | dom | No Print button exists outside the Set builder overflow. |
| PRT-008 | Print shall force the light theme with color-scheme: light and the light token values re-declared under @media print. | lint | @media print block sets color-scheme light and light token values. |
| PRT-009 | Booth and dark themes shall not print. | visual | Printing under booth or dark renders light theme output. |
| PRT-010 | AppHeader, NavDrawer, .sn-skip, FilterRail, toasts, tooltips and CommandPalette shall be display: none in print. | lint | @media print sets display none on each listed selector. |
| PRT-011 | Buttons, chips, inputs, OverflowMenu, CopyButton, row actions, SetSlot controls and ShowMore shall be hidden in print, with ShowMore content expanded. | lint | @media print hides each listed control and shows expanded content. |
| PRT-012 | Elements shall use data-print="hide" to be hidden and data-print="show" to be forced visible in print. | lint | @media print has rules for [data-print=hide] and [data-print=show]. |
| PRT-013 | Print pages shall use @page { size: A4 portrait; margin: 14mm 12mm 18mm; }. | lint | @page rule matches the given size and margin. |
| PRT-014 | Landscape print shall be used only for WeeklyGridPage and MatrixPage via the named page "wide". | lint | Only those two pages set page: wide. |
| PRT-015 | Print body text shall be 10pt Inter with titles in Sora. | lint | @media print body font-size 10pt, family Inter; titles Sora. |
| PRT-016 | The pt unit shall be used only in print CSS. | lint | pt units appear only within @media print or print stylesheets. |
| PRT-017 | Printed text shall be #1c1c1e on white. | lint | @media print text colour is #1c1c1e on a white background. |
| PRT-018 | print-color-adjust: exact shall be used only on EnergyBar, the KeyBadge dot and EnergyWave. | lint | print-color-adjust:exact occurs only on the three listed selectors. |
| PRT-019 | SetSlot, Card, table rows and FigureTile shall have break-inside: avoid in print. | lint | Each listed selector has break-inside avoid in @media print. |
| PRT-020 | Headings shall have break-after: avoid in print. | lint | h1-h6 have break-after avoid in @media print. |
| PRT-021 | Table header rows shall repeat on each printed page (thead display: table-header-group). | lint | thead has display table-header-group in print. |
| PRT-022 | Internal links shall print as plain text. | visual | Printed internal links show no URL suffix or link styling. |
| PRT-023 | External links shall append their domain in fg-3 when printed via a.sn-link--ext::after using data-host. | lint | Print CSS defines a.sn-link--ext::after content " (" attr(data-host) ")" in fg-3. |
| PRT-024 | Charts shall print as SVG. | dom | Printed charts are SVG elements. |
| PRT-025 | The canvas graph shall be replaced in print by the text "Graph view not printable. Open at <URL>." | dom | Print view contains that text and no canvas. |
| PRT-026 | PrintSheet shall hold up to 24 tracks on one A4 page and use two pages with the header repeated for 25 to 48 tracks. | visual | 24 tracks print on one page; 25-48 print on two pages with repeated header. |
| PRT-027 | PrintSheet rows shall be 9mm high. | lint | PrintSheet row height is 9mm. |
| PRT-028 | The PrintSheet header shall show the thin-bold title "Set: <name>", shape, length, track count and BPM range. | dom | Header contains title, shape, length, track count and BPM range. |
| PRT-029 | PrintSheet columns shall be Slot, Time in, Track ("Artist – Title"), BPM, Key, Energy and Transition note. | dom | Table headers equal the listed columns in order. |
| PRT-030 | Energy shall print as the number plus the ten-segment bar. | dom | Printed energy cell has number and ten segments. |
| PRT-031 | Lit energy segments shall also carry a pattern per tier (Low solid, Building diagonal hatch, High cross-hatch) so greyscale stays readable. | visual | Greyscale print distinguishes the three tiers by pattern. |
| PRT-032 | The only gradient allowed in print shall be repeating-linear-gradient used for the tier patterns. | lint | Print CSS gradients are only repeating-linear-gradient in tier patterns. |
| PRT-033 | Compatibility shall print as glyph plus word and never colour alone. | dom | Printed compatibility cell contains glyph and word. |
| PRT-034 | Locked slots shall print a lock icon. | dom | Locked SetSlot print includes a lock icon. |
| PRT-035 | Spare suggestions shall not print. | dom | Spare suggestions are hidden in print. |
| PRT-036 | PrintSheet shall add a blank 30mm Notes column only when the person ticks "Add a notes column". | dom | Notes column exists only when the option is ticked and is 30mm wide. |
| PRT-037 | Every printed page shall carry a fixed footer element repeated per page in body-s fg-3. | visual | Each printed page shows the footer in body-s fg-3. |
| PRT-038 | The printed footer shall show the page title as in the document title and the full URL of the view including query. | dom | Footer text includes document title and window.location.href. |
| PRT-039 | The printed footer shall show the printed stamp from SongNodes.format.stamp(new Date()). | dom | Footer printed stamp equals SongNodes.format.stamp output. |
| PRT-040 | The printed footer shall show the data freshness from FreshnessStamp. | dom | Footer includes the FreshnessStamp value. |
| PRT-041 | The printed footer shall show "Page x of y" via @page @bottom-right counters where supported, otherwise "Page 1" only from a JS-paginated PrintSheet. | visual | Footer shows page counters where supported. |
| PRT-042 | Downloads shall happen only after an explicit action naming the format. | judgement | Each download is triggered by a click labelled with the format. |
| PRT-043 | The interface shall not auto-download on load, run background exports or download from a toast without a click. | judgement | No download occurs without direct user click. |
| PRT-044 | Artifacts shall deliver files through the host download capability and, if unavailable, show the content in a read-only textarea with CopyButton. | judgement | Artifact export uses host capability or read-only textarea plus CopyButton. |
| PRT-045 | Export file names shall follow songnodes-<what>-<yyyy-mm-dd>-<hhmm>.<ext>. | lint | Export file name matches ^songnodes-[a-z0-9-]+-\d{4}-\d{2}-\d{2}-\d{4}\.[a-z0-9]+$. |
| PRT-046 | Export file name date and time shall be in Melbourne time. | lint | File name timestamp equals Australia/Melbourne local time. |
| PRT-047 | Export file names shall be lowercase with hyphens and the object slugged as [a-z0-9]+ joined by hyphens, maximum 40 characters. | lint | Object slug matches ^[a-z0-9]+(-[a-z0-9]+)*$ and is <= 40 chars. |
| PRT-048 | The music library shall use the export file name prefix music-library-<what>-… instead of songnodes-. | lint | Music library exports start with music-library-. |
| PRT-049 | CSV exports shall be UTF-8 with a BOM. | lint | CSV bytes start with EF BB BF. |
| PRT-050 | CSV exports shall be comma separated with CRLF line endings. | lint | CSV uses commas and \r\n line breaks. |
| PRT-051 | CSV exports shall use RFC 4180 quoting. | lint | CSV parses cleanly under an RFC 4180 parser. |
| PRT-052 | CSV header rows shall be in sentence case. | lint | CSV header cells are sentence case. |
| PRT-053 | Set CSV columns shall be Slot,Artist,Title,BPM,Key,Key name,Energy,Duration,Time in,Transition,Locked,Spotify ID,TIDAL ID,ISRC. | lint | Set CSV header equals the listed column list. |
| PRT-054 | Library CSV columns shall follow the visible table order plus IDs. | judgement | Library CSV columns equal visible columns in order plus IDs. |
| PRT-055 | CSV values shall be raw and undecorated: BPM as 124.5, key as 8A and energy as an integer. | lint | CSV BPM numeric, key Camelot code, energy integer. |
| PRT-056 | Legacy converted energy values shall be exported as converted integers with an Energy source column set to legacy_0_1. | lint | Legacy rows have integer energy and Energy source = legacy_0_1. |
| PRT-057 | CSV durations shall be m:ss. | lint | CSV duration cells match ^\d+:\d{2}$. |
| PRT-058 | CSV times shall be ISO 8601 with offset. | lint | CSV time cells match ISO 8601 with offset. |
| PRT-059 | Missing CSV values shall be empty and not "–". | lint | Missing cells are empty strings. |
| PRT-060 | Filters used shall be recorded in the library JSON export only and the CSV shall contain pure rows. | judgement | Library CSV has no filter metadata; JSON has filters. |
| PRT-061 | JSON exports shall always include schema and schemaVersion (semver). | lint | Export JSON has schema and semver schemaVersion. |
| PRT-062 | The JSON schemaVersion major shall be bumped when a field is removed or renamed. | judgement | Removing/renaming a field bumps the major version. |
| PRT-063 | Importers shall reject unknown major schema versions with a clear ErrorState. | judgement | Importing unknown major shows ErrorState. |
| PRT-064 | JSON export keys shall be camelCase. | lint | All JSON keys match camelCase. |
| PRT-065 | JSON durations shall be in seconds (durationSec) and never milliseconds. | lint | Duration fields are named *Sec and hold seconds. |
| PRT-066 | JSON times shall be ISO 8601 with the Melbourne offset. | lint | JSON time fields match ISO 8601 with Melbourne offset. |
| PRT-067 | Tracklist text shall list each track as two-digit slot, cumulative time, "Artist – Title" and key and BPM in brackets. | lint | Each line matches ^\d{2}  \d+:\d{2}  .+ – .+  \[\w+ · \d+\]$. |
| PRT-068 | Tracklist text shall not include energy or emoji. | lint | Tracklist text has no energy value or emoji. |
| PRT-069 | "Copy tracklist" shall copy exactly the tracklist text. | dom | Clipboard content equals the tracklist text export. |
| PRT-070 | M3U exports shall start with #EXTM3U and write per track #EXTINF:<seconds>,<Artist> – <Title> and the URL if known. | lint | M3U file begins #EXTM3U and each track has an EXTINF line. |
| PRT-071 | M3U tracks without a URL shall be listed as comments "# not found: Artist – Title". | lint | Unmatched tracks appear as "# not found:" comment lines. |
| PRT-072 | "Send to TIDAL" shall create or update a playlist named after the set, and the music library shall queue it on the weekly run and show the queued state with StatusPill. | judgement | Send to TIDAL queues and shows StatusPill idle "Queued for <day>". |
| PRT-073 | Send to TIDAL/Spotify shall report the result in the form "Sent 22 of 24 tracks to TIDAL. 2 not found: …". | judgement | Result message states sent count, total and not-found tracks. |
| PRT-074 | Set CSV and JSON exports shall include running order, locks, transitions, IDs and (JSON) controls, and shall exclude spare suggestions and drafts of other sets. | judgement | Set export content matches include/exclude list. |
| PRT-075 | Tracklist text shall include slot, time, artist, title, key and BPM and shall exclude IDs and energy. | judgement | Tracklist content matches include/exclude list. |
| PRT-076 | M3U shall include order, durations and URLs and exclude metadata beyond the title. | judgement | M3U content matches include/exclude list. |
| PRT-077 | Library CSV shall include the currently filtered rows with visible columns plus IDs and shall exclude hidden columns; the JSON adds the filter and sort used. | judgement | Library export content matches include/exclude list. |
| PRT-078 | Graph stats CSV/JSON shall include the metrics table shown with generated time and exclude node positions. | judgement | Graph stats export has metrics and generated time, no positions. |
| PRT-079 | Target tracks JSON shall include all target tracks with priority and archive state and exclude search history. | judgement | Target tracks export matches include/exclude list. |
| PRT-080 | Printed tables shall carry a hairline between columns as well as between rows, portrait and landscape. | visual | Print emulation shows a `line` hairline between cells of every `.sn-table`. |
| PRT-081 | Every printed page shall carry "Page n of N" in its bottom-right page margin box: the unnamed page, `doc`, `wide` and the `PrintSheet`'s `sheet` page, generated by `build_tokens.py` from the caption style. | lint | `02-theme-media.css` has an `@bottom-right` box with `counter(page)` and `counter(pages)` in `@page`, `@page doc`, `@page wide` and `@page sheet`; a PDF of the PrintSheet shows "Page 1 of 1". |
| PRT-082 | A `PrintSheet` shall not print a typed page number: the page number in its footer shall be `.sn-page-print__pageno`, shown on screen and hidden in print. | dom | In print media `.sn-page-print__pageno` computes `display: none`, and no other footer text reads "Page". |
| PRT-083 | On paper colour shall never be the only carrier: every status, tier, compatibility level, pillar and rotation shall print with its word, glyph, number or pattern, so a set list or library sheet reads the same in greyscale. | visual | Print to greyscale: every coloured mark still has a word, glyph, number or pattern beside or in it. |
| PRT-084 | An icon on paper shall sit beside its word and carry its screen meaning; no icon shall be printed for decoration. | judgement | Every printed icon other than the slot lock has its word beside it. |
