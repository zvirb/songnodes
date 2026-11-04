# BRD rules (generated)

| ID | Rule | Check | Test |
|---|---|---|---|
| BRD-001 | Pages shall load tokens.css, then components/bundle.css, then components/bundle.js in that order. | lint | head/body load order is tokens.css, bundle.css, bundle.js. |
| BRD-002 | SongNodes.prefs.init() shall run inline in head before first paint so the saved theme, text size, density and motion apply without a flash. | lint | Inline prefs init precedes stylesheets. |
| BRD-003 | Pages shall not contain colour, font size, radius or shadow literals and shall use tokens. | lint | No hex/rgb colour, px font-size, radius or shadow literal outside tokens. |
| BRD-004 | The component guidelines shall be read before a component is used. | judgement | Component usage follows its guideline. |
| BRD-005 | Every date, time, duration, count and BPM shall be formatted through SongNodes.format. | lint | No hand formatting of those values. |
| BRD-006 | Transitions shall be judged with SongNodes.compat, bpmStep and energyStep. | lint | No separate transition logic. |
| BRD-007 | The system shall be changed only by editing source/build_tokens.py, source/css/*.css or source/bundle.src.js and regenerating with the build scripts. | judgement | Generated outputs are not hand edited. |
| BRD-008 | Nothing shall ship with a failing contrast pair in the generator contrast report. | lint | Contrast report has no failing pairs. |
| BRD-009 | Voice shall be plain, direct and specific like a knowledgeable booth-mate, never cute, never apologetic and never with an exclamation mark. | judgement | Copy has no exclamation marks and no cute or apologetic phrasing. |
| BRD-010 | Copy shall use sentence case everywhere. | judgement | UI strings are sentence case. |
| BRD-011 | Copy shall use en-AU spelling (colour, analyse, centre). | lint | Spell check en-AU passes. |
| BRD-012 | Uppercase shall be produced only through the label style and never typed in caps. | lint | No all-caps literal strings; uppercase only via text-transform in label style. |
| BRD-013 | Buttons shall be labelled with a verb plus its object. | judgement | Button labels are verb + object. |
| BRD-014 | There shall be one primary button per view. | dom | Each view has one primary button. |
| BRD-015 | Numbers shall be written like "1,284 tracks", "124 BPM", "8A", "6:12", "92 min", "+2 BPM" and "−1" with a true minus. | lint | Numbers match these formats; minus is U+2212. |
| BRD-016 | Missing values shall be an en dash "–" and never "N/A" or "Unknown". | lint | No N/A or Unknown for missing values. |
| BRD-017 | Times shall be shown in the Australia/Melbourne time zone in 24-hour format. | lint | Formatted times use Melbourne zone and 24h. |
| BRD-018 | Relative times shall carry the absolute stamp in a tooltip. | dom | Relative time has tooltip with absolute stamp. |
| BRD-019 | Confirmations shall name the object and the consequence. | judgement | Confirm text names object and consequence. |
| BRD-020 | Surfaces shall use bg for the ground, surface-1 for panels and cards, surface-2 for raised parts and table headers, surface-3 for pressed and tracks, and sunk for inputs. | lint | Components use the stated surface tokens. |
| BRD-021 | Dividers shall use line and control borders shall use line-strong. | lint | Dividers use --line; control borders --line-strong. |
| BRD-022 | Text shall use fg for primary, fg-2 for secondary, and fg-3 for tertiary and the dimmed lead-in of titles. | lint | Text colours follow the roles. |
| BRD-023 | Every page and section title shall be a regular dimmed .sn-lead lead-in plus a bold title, e.g. <h1 class="sn-title title-l"><span class="sn-lead">…</span> …</h1>. | dom | Headings contain .sn-lead span followed by bold text. |
| BRD-024 | Titles shall be Sora, body Inter, and data (BPM, keys, times, IDs) JetBrains Mono with tabular figures. | lint | Font families and font-variant-numeric tabular for data. |
| BRD-025 | The brand colour shall mark SongNodes itself (wordmark, the one primary button, focus ring, selection) and shall never mean a status. | judgement | Brand not used for status. |
| BRD-026 | The marker for "now" shall be amber (now) so it is never confused with selected. | lint | Now markers use --now not --brand. |
| BRD-027 | Each of the eight modules (Graph, Library, Set builder, Pathfinder, Key & mood, Sources, Pipeline, Services) shall use its identity hue (mod-<key>) on its drawer icon, on every text link to it, and on its cards. | dom | Module icon, links and cards use mod-<key> and sn-m-<key>. |
| BRD-028 | Links shall take the colour of where they lead and always be underlined (sn-link sn-m-<key>), with a link to nowhere module-specific using link. | dom | Links underlined; colour follows destination module. |
| BRD-029 | A module card (sn-card sn-card--tonal) shall use only its module hue shades (mod-<key>-bg fill, -line border, -ink and -muted text, -raised chips and secondary buttons) with only status colours breaking out. | lint | Tonal card uses only module tokens. |
| BRD-030 | Status colours (status-ok\|fair\|warn\|bad\|info) shall only ever mean state and shall come with a glyph and a word. | dom | Status colours accompany glyph and word. |
| BRD-031 | Transitions shall use compat-perfect\|compatible\|possible\|clash with the glyphs ● ◐ ○ ✕. | lint | Transition badges use compat-* tokens and glyphs. |
| BRD-032 | Energy 1-10 shall be a ten-step heat scale (energy-1 deep indigo to energy-10 amber) drawn as the ten-segment bar with gaps after 4 and 7, always with the number. | dom | EnergyBar has 10 segments, gaps after 4 and 7, and the number. |
| BRD-033 | Keys shall be Camelot codes with a wheel-colour dot (key-1a…key-12b; minor darker, major lighter) using the standard mapping (8A = A minor, 8B = C major). | dom | KeyBadge shows code with key-* dot; 8A=A minor. |
| BRD-034 | Radius shall use radius-chip 4 (chips, tags), radius-control 8 (buttons, inputs), radius-card 14 (cards, tiles), radius-sheet 18 (dialogs, drawers) and radius-pill (status pills, switches). | lint | Components use the radius token for their class. |
| BRD-035 | Cards shall rest at shadow-1 with a hairline border, and only floating layers shall rise: shadow-2 for menus and popovers, shadow-3 for drawers and dialogs over the overlay scrim. | lint | Shadow tokens match element class. |
| BRD-036 | Spacing shall use the 4px scale (space-1 … space-16). | lint | Spacing values are space-* tokens. |
| BRD-037 | Table rows shall be 40px in comfortable density and 32px in compact density. | dom | Row height 40px comfortable, 32px compact. |
| BRD-038 | Themes shall be Dark (default), Light and Booth, with System following the OS. | dom | Four theme options exist; default dark. |
| BRD-039 | Text size S/M/L/XL shall scale everything through rem. | lint | Sizes use rem so root size scales content. |
| BRD-040 | Motion shall be 120ms for state changes, 200ms for drawers and dialogs, and at most 320ms for charts. | lint | Transition durations within these values. |
| BRD-041 | Nothing shall animate in on load. | visual | No entry animation on page load. |
| BRD-042 | Reduced motion shall stop all motion including spinners and skeletons. | lint | Reduced-motion block disables spinner/skeleton animations. |
| BRD-043 | Every interactive element shall have a 2px solid focus ring with a 2px offset (3px in booth). | lint | Focus-visible outline 2px solid var(--focus) offset 2px. |
| BRD-044 | The interface shall not use gradients, glows, glass, coloured left-border accent cards, emoji, status colours on categories or a second primary button. | lint | No gradient/glow/backdrop-filter/left accent border; one primary button. |
| BRD-045 | Module icons shall be Graph share-2, Library library-big, Set builder list-music, Pathfinder route, Key & mood piano, Sources radio-tower, Pipeline activity and Services plug. | dom | Module icons match the mapping. |
| BRD-046 | Icons in code shall be created with SongNodes.icon(name, {label}) or lucide-react. | lint | No hand-drawn icon SVGs. |
