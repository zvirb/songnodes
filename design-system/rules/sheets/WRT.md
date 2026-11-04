# WRT rules (generated)

| ID | Rule | Check | Test |
|---|---|---|---|
| WRT-001 | Copy shall lead with the fact and then state what to do next, not the feeling. | judgement | Message opens with a concrete fact; next step follows; no leading sentiment. |
| WRT-002 | Copy shall name the specific track, set, source or number rather than using generic wording. | judgement | Message contains a named object or a number instead of phrases like 'some items'. |
| WRT-003 | Copy shall use DJ vocabulary (set, crate, slot, key, BPM, drop, peak). | judgement | Domain nouns match DJ vocabulary; no generic substitutes. |
| WRT-004 | Copy shall use glossary terms exactly as defined in the glossary. | lint | Grep UI strings for glossary-term synonyms (e.g. 'playlist' for Set, 'song' for Track); any hit fails. |
| WRT-005 | Copy shall not contain hype or jokes in system messages. | judgement | System messages contain no promotional or humorous phrasing. |
| WRT-006 | Copy shall not contain apologies. | lint | Regex /\b(sorry\|oops\|apolog\w*)\b/i over UI strings; any match fails. |
| WRT-007 | Copy shall not contain exclamation marks. | lint | Regex /!/ over UI string literals and rendered text; any match fails. |
| WRT-008 | Copy shall not contain emoji. | lint | Regex \p{Extended_Pictographic} over source and rendered text; any match fails. |
| WRT-009 | Copy shall address the person as 'you' only where it removes ambiguity. | judgement | Each 'you' in UI copy is needed to disambiguate actor. |
| WRT-010 | Copy shall not refer to the product as 'we'. | lint | Regex /\b(we\|our\|us)\b/i over UI strings; any match fails. |
| WRT-011 | Success messages shall be one short line. | judgement | Success toast/message is a single sentence. |
| WRT-012 | Error messages shall be calm and exact. | judgement | Error copy states specifics without alarm words or blame. |
| WRT-013 | Voice shall remain constant across message severities; only tone shall vary. | judgement | Same vocabulary and register at success, warning and error levels. |
| WRT-014 | Page titles, section headings, buttons, tabs, menu items, column headers, chart titles and toasts shall use sentence case and shall not use Title Case. | lint | Regex over those strings: two or more consecutive capitalised words not in the proper-noun list fails. |
| WRT-015 | Capitalisation in prose shall be limited to proper nouns (artists, labels, shows, services, places, months, days). | judgement | Capitalised words mid-sentence are proper nouns. |
| WRT-016 | Service names shall be written as the service writes them (TIDAL, Spotify, Beatport, MusicBrainz, Discogs, Deezer, SoundCloud, YouTube, Setlist.fm, 1001tracklists, MixesDB, ARIA Club Chart, triple j, 3RRR, PBS). | lint | Case-insensitive match of each name over UI strings must equal the canonical casing. |
| WRT-017 | Genres and pillars shall be written as common nouns in sentences. | judgement | Genre in a sentence is lowercase (e.g. 'a house set'). |
| WRT-018 | Genres and pillars shall be capitalised when shown as category values in tags and filters. | dom | Text of .sn-tag and filter options for genre/pillar starts uppercase (House, Techno, UK garage). |
| WRT-019 | Uppercase text shall be produced only by the label text style via CSS text-transform, namely .sn-eyebrow, th, and .sn-preview__label. | lint | Grep CSS for text-transform: uppercase; selector must be in {.sn-eyebrow, .sn-table th, .sn-group, .sn-preview__label}. |
| WRT-020 | Source text shall be typed in sentence case and shall not contain words typed in capitals. | lint | Regex /\b[A-Z]{4,}\b/ over UI strings outside the acronym allowlist; any match fails. |
| WRT-021 | The SongNodes mode switch labels shall be typed 'Play' and 'Plan' in source. | lint | Mode switch source strings equal 'Play' and 'Plan'. |
| WRT-022 | Copy shall use en-AU spelling (colour, analyse, centre, catalogue, licence as noun, license as verb, organise, behaviour, favourite, programme for radio, program for software). | lint | Wordlist of US spellings (color, analyze, center, catalog, organize, behavior, favorite) over UI strings; any match fails. |
| WRT-023 | The locale shall be en-AU and the time zone Australia/Melbourne, defined as constants SongNodes.locale and SongNodes.timeZone. | lint | SongNodes.locale === 'en-AU' and SongNodes.timeZone === 'Australia/Melbourne'. |
| WRT-024 | Code shall not pass a locale other than SongNodes.locale to Intl. | lint | Grep for Intl\.\w+\(\s*['"] literals other than via SongNodes.locale; any hit fails. |
| WRT-025 | An en dash shall separate artist and title and a hyphen shall not. | lint | Regex over artist-title strings: ' - ' between artist and title fails; ' – ' passes. |
| WRT-026 | Counts shall be formatted with grouped thousands and no decimals via format.count. | lint | Count display uses format.count; Regex for raw numbers >=1000 without separators in UI fails. |
| WRT-027 | BPM values shall be shown with 0 to 1 decimal places, dropping a trailing .0, via format.bpm. | lint | BPM display uses format.bpm; output matches /^\d+(\.\d)? BPM$/ and not /\.0 BPM/. |
| WRT-028 | BPM changes shall be shown as a signed integer using a true minus via bpmStep. | lint | BPM change output matches /^[+−]\d+ BPM$/ or 'same BPM'. |
| WRT-029 | Energy shall be shown as an integer from 1 to 10 and never as a decimal, via html.energy. | lint | Energy output matches /^Energy ([1-9]\|10)$/. |
| WRT-030 | Energy changes shall be shown as a signed integer. | lint | Energy change output matches /^(energy\|drop) [+−]\d+$/ or 'energy hold'. |
| WRT-031 | Keys shall be shown as Camelot codes in monospace via camelot. | dom | Key element has font-family data (--font-data) and text matches /^(1[0-2]\|[1-9])[AB]$/. |
| WRT-032 | Track durations shall be shown as m:ss, or h:mm:ss over one hour, via format.duration(sec). | lint | Output matches /^\d{1,2}:\d{2}$/ or /^\d+:\d{2}:\d{2}$/ and comes from format.duration. |
| WRT-033 | Set lengths shall be shown in hours and minutes rounded to minutes via format.span(sec), and in minutes in inputs. | lint | Output matches /^\d+ h \d+ min$/ in display; input values in minutes. |
| WRT-034 | Percentages shall be shown as integers by default and with 1 decimal place only when the difference matters, via format.percent. | lint | Output uses format.percent; matches /^\d+(\.\d)?%$/. |
| WRT-035 | Weights, ratios and scores shall be shown to 2 decimal places. | lint | Output matches /^\d+\.\d{2}$/. |
| WRT-036 | Confidence shall be shown as the word first with the number in detail, e.g. 'Medium confidence (0.64)'. | lint | Output matches /^(High\|Medium\|Low) confidence( \(\d\.\d{2}\))?$/. |
| WRT-037 | The unit shall follow the number after a space, except '%' which shall be closed up. | lint | Regex /\d(BPM\|min\|h\|ago)\b/ fails; /\d %/ fails. |
| WRT-038 | Signed changes shall always carry a sign, and zero shall be written as a word ('energy hold', 'same key', 'same BPM'). | lint | Regex /\b(energy\|BPM) 0\b\|[+−]0\b/ fails. |
| WRT-039 | Durations received in milliseconds shall be converted to seconds once at the API boundary (duration_ms / 1000). | lint | Grep for duration_ms outside API client layer; any hit fails. |
| WRT-040 | Components shall not format milliseconds and shall pass seconds to format.duration. | lint | Grep components for ms-based formatting (/1000 in components, Math.floor(ms); any hit fails. |
| WRT-041 | Missing values shall be rendered as an en dash inside <span class="sn-none">–</span>. | dom | Elements for absent data match span.sn-none with textContent '–'. |
| WRT-042 | Missing values shall not be rendered as 'N/A', 'null', 'undefined', '0', '---', 'Unknown' or an invented default. | lint | Regex /\b(N\/A\|null\|undefined\|Unknown)\b\|^---$/ over rendered cell text; a missing-value field showing a default number fails. |
| WRT-043 | The UI shall convert stored UTC (ISO 8601 with Z) to Australia/Melbourne on display and shall not show UTC or a server string. | lint | Regex for trailing 'Z' or ISO strings in rendered text; any match fails. |
| WRT-044 | Every date and time shown on screen shall come from SongNodes.format or lib/format.ts that mirrors it. | lint | Grep components for toLocaleString\|toLocaleDateString\|toLocaleTimeString\|toISOString and template-literal dates; any hit fails. |
| WRT-045 | Times shall use the 24-hour clock with no am/pm and a leading zero on hours. | lint | Output matches /^([01]\d\|2[0-3]):[0-5]\d$/; /[ap]m\b/i fails. |
| WRT-046 | Midnight shall be written 00:00 and shall start the day, and end of day shall be written 23:59. | lint | No '24:00' in output; midnight renders '00:00'. |
| WRT-047 | Dates shall not use ordinals. | lint | Regex /\d(st\|nd\|rd\|th)\b/ over date strings; any match fails. |
| WRT-048 | Days of the month shall not have a leading zero. | lint | Regex /\b0\d (Jan\|Feb\|Mar\|Apr\|May\|Jun\|Jul\|Aug\|Sep\|Oct\|Nov\|Dec)/ fails. |
| WRT-049 | Dates shall be formatted as D Mon YYYY via format.date. | lint | Output matches /^\d{1,2} [A-Z][a-z]{2} \d{4}$/. |
| WRT-050 | Days within the current week or a run shall be formatted as Ddd D Mon via format.day. | lint | Output matches /^[A-Z][a-z]{2} \d{1,2} [A-Z][a-z]{2}$/. |
| WRT-051 | Times shall be formatted as HH:mm via format.time. | lint | Output matches /^\d{2}:\d{2}$/. |
| WRT-052 | Dates with times shall be formatted as D Mon YYYY, HH:mm via format.dateTime. | lint | Output matches /^\d{1,2} [A-Z][a-z]{2} \d{4}, \d{2}:\d{2}$/. |
| WRT-053 | Stamps for freshness, logs and exports shall include the zone abbreviation via format.stamp. | lint | Output matches /, \d{2}:\d{2} (AEST\|AEDT)$/. |
| WRT-054 | Relative times shall be shown only together with the absolute stamp in a Tooltip, via format.relative. | dom | Any element with relative text ('ago') has a Tooltip containing a format.stamp value. |
| WRT-055 | Numeric ranges shall use an en dash with no spaces and date ranges shall use a spaced en dash. | lint | Numeric: /\d–\d/ not /\d - \d/; dates: /\d{1,2} \w{3} – \d{1,2} \w{3}/. |
| WRT-056 | Stamps shall show the zone abbreviation AEST or AEDT computed per date via format.zone and shall not hard-code it. | lint | Grep for literal 'AEST'/'AEDT' outside format.zone; any hit fails. |
| WRT-057 | File names containing dates shall use ISO dates (e.g. peak-time-friday_YYYY-MM-DD.json). | lint | Export filename matches /_\d{4}-\d{2}-\d{2}\.\w+$/. |
| WRT-058 | ISO dates shall not appear anywhere other than in file names. | lint | Regex /\d{4}-\d{2}-\d{2}/ in rendered text; any match fails. |
| WRT-059 | Action labels shall be a verb plus an object in sentence case of 1 to 3 words. | lint | Button text matches /^[A-Z][a-z]+( \w+){1,2}$/ with a leading verb; word count 1-3. |
| WRT-060 | Action labels shall say what is affected when it is not obvious from the place (e.g. 'Remove from set', 'Delete set'). | judgement | Bare 'Remove' or 'Delete' without an object fails. |
| WRT-061 | Action labels shall say who is affected when the action reaches beyond this device or this person. | judgement | Shared/remote actions name the audience (e.g. 'Save set for everyone'). |
| WRT-062 | The button that confirms a dialog shall repeat the action verb and shall not read 'OK' or 'Yes'. | dom | Dialog confirm button text is not in {OK, Yes} and starts with the action verb. |
| WRT-063 | Icon-only buttons shall have an accessible name that is the same verb plus object (e.g. 'Lock slot 4'). | dom | button without visible text has non-empty aria-label or aria-labelledby matching verb + object. |
| WRT-064 | A one-line caveat shall be placed in the SectionHeading subtitle. | dom | Single-line caveat text sits in the SectionHeading subtitle element. |
| WRT-065 | Longer method text shall be placed in a Disclosure directly under the chart or table it qualifies. | dom | Disclosure element is the next sibling after the chart/table it qualifies. |
| WRT-066 | Method text shall not be placed above the data or on a separate help page. | dom | No method-text Disclosure precedes its chart/table; no help route exists for method text. |
| WRT-067 | Footnotes shall reference a column by its header text and not by colour. | judgement | Footnote text names the column header; no colour words. |
| WRT-068 | External identifiers shall be named exactly as their source does (ISRC, Spotify ID, Spotify URI, Beatport ID, TIDAL ID, MusicBrainz ID, Discogs release ID, Deezer ID, 1001tracklists ID). | lint | KeyValueGrid labels for identifiers match the canonical list. |
| WRT-069 | External identifier values shall be rendered in data-s (.sn-mono). | dom | Identifier value element has class sn-mono or computed font-family equals --font-data at data-s size. |
| WRT-070 | External identifier values shall not be truncated in the middle when they fit. | dom | scrollWidth <= clientWidth for identifier value when container fits; no ellipsis inserted. |
| WRT-071 | Each external identifier shall have a CopyButton labelled 'Copy <identifier name>' (e.g. 'Copy ISRC'). | dom | Row has CopyButton with aria-label 'Copy ' + label. |
| WRT-072 | External identifiers shall be shown with the label in a KeyValueGrid row. | dom | Identifier is rendered inside KeyValueGrid with label cell and value cell. |
| WRT-073 | External identifiers shall link out with .sn-link--ext only where the source has a public page. | judgement | a.sn-link--ext present only for identifier types with public pages. |
| WRT-074 | Paths and URLs shall be rendered in data-s and middle-truncated. | dom | Path element has sn-mono/data-s and text-overflow middle ellipsis pattern '…' in the middle. |
| WRT-075 | Truncated paths and URLs shall provide the full value in a Tooltip and a CopyButton. | dom | Truncated path element has Tooltip with full text and adjacent CopyButton. |
| WRT-076 | Non-admin views shall not show container paths, hostnames, ports, queue names or stack traces. | lint | Regex for /app/, host:port, redis, 'scraper-orchestrator', 'at .*\(.*:\d+' in non-admin routes; any hit fails. |
| WRT-077 | Technical system messages shall be rewritten as plain human statements (e.g. 'The scraping service is unreachable.'). | judgement | Message states the user-facing condition, not the system identifier. |
| WRT-078 | Admin views shall show hostnames in data-s inside a Disclosure labelled 'Technical details'. | dom | Hostname elements are descendants of a Disclosure whose label is 'Technical details'. |
| WRT-079 | Emoji shall not be used anywhere in the UI. | lint | Regex \p{Extended_Pictographic} over source and rendered text; any match fails. |
| WRT-080 | Existing emoji shall be replaced with a Lucide icon plus a word. | dom | Elements that formerly held emoji contain svg Lucide icon and text. |
| WRT-081 | The glyph ● shall denote ok or perfect and shall be used in StatusPill and CompatibilityBadge. | dom | ● appears only within StatusPill/CompatibilityBadge with ok/perfect status. |
| WRT-082 | The glyph ◐ shall denote fair or compatible and shall be used in StatusPill and CompatibilityBadge. | dom | ◐ appears only within StatusPill/CompatibilityBadge with fair/compatible status. |
| WRT-083 | The glyph ○ shall denote possible compatibility and shall be used in CompatibilityBadge. | dom | ○ appears only within CompatibilityBadge. |
| WRT-084 | The glyph ✕ shall denote bad, clash or field error and shall be used in StatusPill and .sn-field__error. | dom | ✕ appears only within StatusPill, CompatibilityBadge or .sn-field__error. |
| WRT-085 | The glyph ▲ shall denote warn and shall be used in StatusPill and flagged rows. | dom | ▲ appears only within StatusPill or tr[data-flag]. |
| WRT-086 | The glyph ↻ shall denote running and shall be used in StatusPill. | dom | ↻ appears only within StatusPill with running status. |
| WRT-087 | The en dash glyph – shall denote idle, missing value and ranges and shall be used in .sn-none and StatusPill. | dom | – used for idle/missing only within .sn-none or StatusPill, and in ranges. |
| WRT-088 | The glyphs ↑ and ↓ shall denote sort direction and slot movement and shall be used in DataTable headers and SetSlot. | dom | ↑/↓ appear only within DataTable th or SetSlot. |
| WRT-089 | The glyph ↗ shall denote a link that opens outside the app and shall be used with .sn-link--ext. | dom | ↗ appears only inside a.sn-link--ext. |
| WRT-090 | The glyph × shall be used only for multiplication and dimensions and shall not be used as a close icon. | dom | × appears only in dimension strings; close buttons use Lucide x svg. |
| WRT-091 | The glyph → shall be used for from-to transitions and steps (e.g. in TransitionNote). | dom | → appears in TransitionNote or step text between from/to values. |
| WRT-092 | The glyph · shall be used as the separator in meta lines. | dom | Meta lines separate items with ' · '. |
| WRT-093 | Negative numbers shall use the true minus (−, U+2212) and a hyphen shall be used only inside words. | lint | Regex /(^\|[\s(])-\d/ over rendered text; any match fails. |
| WRT-094 | Quotation marks and apostrophes shall be curly in UI text, and straight quotes only in code and IDs. | lint | Regex /["'](?=\w)/ in UI strings (not code/IDs); any straight quote fails. |
| WRT-095 | The ellipsis character … shall be used only for truncation, for actions that open a dialog needing more input, and for busy labels. | lint | Regex /…\|\.\.\./ over labels: '...' fails; '…' allowed only on dialog-opening actions, busy labels, truncation. |
| WRT-096 | Labels, buttons, headings and single-sentence tooltips shall not end with a full stop. | lint | Regex /\.$/ over those strings; any match fails. |
| WRT-097 | Sentences in messages and help shall end with a full stop. | lint | Multi-word sentences in message/help text end with '.', '?' or '…'. |
| WRT-098 | Code shall not call window.alert, window.confirm or window.prompt. | lint | Grep /\b(window\.)?(alert\|confirm\|prompt)\s*\(/; any hit fails. |
| WRT-099 | Destructive or irreversible actions shall be confirmed with a ConfirmDialog. | judgement | Destructive action handler opens ConfirmDialog before executing. |
| WRT-100 | Low-stakes removes such as clearing a slot shall use an armed Button that is clicked once to arm and again within 4 s to confirm. | dom | Armed button requires second click within 4000 ms; resets after. |
| WRT-101 | Confirmation dialog titles shall end with '?'. | lint | ConfirmDialog title matches /\?$/. |
| WRT-102 | Confirmation dialog titles shall name the object (e.g. 'Clear 37 queued jobs?'). | judgement | Title contains the object noun and count where applicable. |
| WRT-103 | Confirmation dialog bodies shall state the consequence and what survives. | judgement | Body states what is removed and what remains. |
| WRT-104 | The destructive confirm button shall use .sn-btn--danger and be paired with a 'Cancel' button. | dom | ConfirmDialog contains button.sn-btn--danger and a button with text 'Cancel'. |
| WRT-105 | Cancel shall be the default focus in a ConfirmDialog. | dom | document.activeElement on open is the Cancel button. |
| WRT-106 | Error messages shall state what happened, why if known, and what to do next. | judgement | Message contains cause/event plus next action. |
| WRT-107 | Error messages shall be one or two sentences. | lint | Sentence count of error message <= 2. |
| WRT-108 | Error messages shall not show raw exception text, HTTP codes or 'Unknown error'. | lint | Regex /\b(Error:\|HTTP \d{3}\|[45]\d\d\b\|Unknown error\|Exception)/ over visible error text; any match fails. |
| WRT-109 | Raw exception text and HTTP codes shall be placed in a 'Technical details' Disclosure. | dom | Raw error details are descendants of a Disclosure labelled 'Technical details'. |
| WRT-110 | Empty states shall state what the area holds, why it is empty, and offer one action. | judgement | EmptyState contains explanation sentence and exactly one action. |
| WRT-111 | Empty states shall use the EmptyState component. | dom | Empty views render EmptyState. |
| WRT-112 | Copy shall use the glossary terms Energy, Tier, Pillar, Rotation, Crate, Set, Slot, Spare, Transition, Camelot key, Adjacency, Waypoint, Target track, Source and Run with their defined meanings. | judgement | Each glossary term appears only in its defined sense and written form. |
| WRT-113 | Energy tiers shall be Low 1-4, Building 5-7 and High 8-10. | lint | Tier mapping function returns Low for 1-4, Building for 5-7, High for 8-10. |
| WRT-114 | Rotation values shall be High, Standard and Vault. | lint | Rotation enum equals {High, Standard, Vault}. |
| WRT-115 | Each slot shall offer 3 spares. | dom | Count of spare suggestions per slot equals 3. |
