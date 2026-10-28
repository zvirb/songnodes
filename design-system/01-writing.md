# Writing and content

Every word in SongNodes and the music library reads like a knowledgeable booth-mate: someone who knows the crate, tells you what you need between tracks, and gets out of the way. Plain, direct, specific. These rules apply to every label, message, tooltip, export header and page title in both products.

## Voice and tone

- Say what is true and what to do next. Lead with the fact, not the feeling.
- Be specific: name the track, the set, the source, the number. "3 tracks need an energy check", not "Some items need attention".
- Use the words a DJ uses: set, crate, slot, key, BPM, drop, peak. Use our glossary terms exactly (see the end of this page).
- No hype, no jokes in system messages, no apologies ("Sorry", "Oops"), no exclamation marks, no emoji.
- Address the person as "you" only when it removes ambiguity. Never refer to the product as "we" in UI.
- Tone flexes by severity, voice does not: success is one short line; errors are calm and exact.

| Situation | Write | Not |
|---|---|---|
| Set built | Built "Peak time Friday": 24 tracks, 1 h 52 min. | Awesome! Your set is ready to rock! |
| Missing data | 12 tracks have no key. Add keys in Track detail or run key analysis. | Oops, looks like some data is missing. |
| Transition hint | Energy +1, same key, +2 BPM | Smooth transition detected! |
| Scraper failed | 1001tracklists stopped after 5 failed requests. It retries at 21:45 AEDT. | Error: circuit_open |
| Onboarding | Pick two tracks to find a route between them. | Welcome to the future of DJing! |

## Capitalisation

- Sentence case everywhere: page titles, section headings, buttons, tabs, menu items, column headers, chart titles, toasts. "Build set", "Running order", "Last heard".
- Capitalise proper nouns only: artists, labels, shows, services, places, months, days. "Heard on PBS Soul Time", "Send to TIDAL".
- Write service names as the service writes them: TIDAL in prose and buttons for the music library (its brand mark is uppercase), Spotify, Beatport, MusicBrainz, Discogs, Deezer, SoundCloud, YouTube, Setlist.fm, 1001tracklists, MixesDB, ARIA Club Chart, triple j (lowercase), 3RRR, PBS.
- Genres and pillars are common nouns in sentences ("a house set") and capitalised as category values in tags and filters ("House", "Techno", "UK garage").
- Uppercase appears only through the `label` text style (`.sn-eyebrow`, `th`, `.sn-preview__label`). Type the source text in sentence case; CSS uppercases it. Never type "PLAY" or "ENERGY TIER" in caps. The SongNodes mode switch reads "Play" and "Plan" in source.
- Never Title Case ("Track Analysis", "Fix Artist Attribution" in `DJInterface.tsx` become "Track analysis", "Fix artist attribution").

## Spelling and locale

- en-AU spelling: colour, analyse, centre, catalogue, licence (noun), license (verb), organise, behaviour, favourite, programme (radio), program (software).
- Locale code `en-AU`; time zone `Australia/Melbourne`. Both are constants in `SongNodes.locale` and `SongNodes.timeZone`; never pass a different locale to `Intl`.
- Use "–" (en dash) between artist and title: "Bicep – Glue". Never a hyphen.

## Numbers

| Value | Format | Example | Producer |
|---|---|---|---|
| Counts | Grouped thousands, no decimals | 1,284 tracks | `format.count` |
| BPM | 0–1 dp, drop trailing .0 | 124 BPM, 128.5 BPM | `format.bpm` |
| BPM change | Signed with true minus, integer | +2 BPM, −3 BPM | `bpmStep` |
| Energy | Integer 1–10, never a decimal | Energy 7 | `html.energy` |
| Energy change | Signed integer | energy +1, drop −3 | `energyStep` |
| Key | Camelot code, mono | 8A | `camelot` |
| Track duration | m:ss from seconds; h:mm:ss over 1 h | 6:12, 1:02:40 | `format.duration(sec)` |
| Set length | h and min, rounded to minutes | 1 h 52 min, 92 min in inputs | `format.span(sec)` |
| Percentages | Integer by default, 1 dp only when the difference matters | 86%, 99.4% uptime | `format.percent` |
| Weights, ratios, scores | 2 dp | Genre mix 0.45, similarity 0.82 | local `toFixed(2)` |
| Confidence | Word first, number in detail | Medium confidence (0.64) | `status` |

- Put the unit after the number with a space ("124 BPM", "92 min", "3 h ago"), except "%" which is closed up.
- Signed changes always carry a sign; zero is written as the word: "energy hold", "same key", "same BPM".
- Durations arrive from the backend in milliseconds (`duration_ms` in `types/index.ts`, `types/pathfinding.ts`). Convert once at the API boundary (`duration_ms / 1000`) and pass seconds to `format.duration`. No component formats milliseconds.
- Missing values are an en dash in `.sn-none`: `<span class="sn-none">–</span>`. Never "N/A", "null", "undefined", "0", "---", "Unknown" or a made-up default (the current `EnergyMeter` renders missing energy as 5; it must render "–").

## Dates and times

- Time zone of record: Australia/Melbourne. The server stores UTC (ISO 8601 with Z); the UI converts on display. Never show UTC or a server string.
- Every date and time on screen comes from `SongNodes.format` (or the React app's single `lib/format.ts` that mirrors it). No `toLocaleString()`, `toLocaleDateString()`, `toISOString()` or template-literal dates in components. Current offenders: `APIKeyManager.tsx` "Last tested", `TargetTracksManager.tsx` "Last searched", `FilterPanel.tsx` preset dates, `StatsPanel.tsx` export timestamps.
- 24-hour clock, no "am/pm", leading zero on hours: 06:00, 21:30. Midnight is 00:00 and starts the day; end of day is 23:59.
- No ordinals, no leading zero on days.

| Use | Format | Example | Producer |
|---|---|---|---|
| Date | D Mon YYYY | 24 Oct 2026 | `format.date` |
| Day in this week or a run | Ddd D Mon | Sat 24 Oct | `format.day` |
| Time | HH:mm | 21:30 | `format.time` |
| Date and time | D Mon YYYY, HH:mm | 24 Oct 2026, 21:30 | `format.dateTime` |
| Stamp (freshness, logs, exports) | with zone abbreviation | 24 Oct 2026, 06:00 AEDT | `format.stamp` |
| Relative | only with the absolute stamp in a Tooltip | 3 h ago | `format.relative` |
| Ranges | en dash, no spaces for numbers, spaced for dates | 122–128 BPM; 18 Oct – 24 Oct 2026 | |

- Show the zone abbreviation (AEST or AEDT) in every stamp. It changes on daylight-saving boundaries, so it is computed per date (`format.zone`), never hard-coded.
- File names use ISO dates because they sort: `peak-time-friday_2026-10-24.json`. That is the only place ISO dates appear.

## Action labels

- Verb + object, sentence case, 1–3 words: "Build set", "Save set", "Copy tracklist", "Add to set", "Connect Spotify", "Clear queue".
- Say what is affected when it is not obvious from the place: "Remove from set" (not "Remove"), "Delete set" (not "Delete"), "Clear all queued jobs".
- Say who an action affects when it reaches beyond this device or this person: "Send to TIDAL on the weekly run", "Save set for everyone".
- The button that confirms a dialog repeats the action verb: "Delete set", never "OK" or "Yes".
- No icon-only buttons without an accessible name; the name is the same verb + object ("Lock slot 4").

## Caveats and method text

- A one-line caveat lives in the `SectionHeading` subtitle: "Energy is Mixed In Key's 1–10 scale; 12 tracks are estimates."
- Longer method text ("How the set is built", "How confidence is scored") goes in a `Disclosure` placed directly under the chart or table it qualifies. Never above the data and never in a separate help page.
- Footnotes reference a column by its header text, not by colour.

## External identifiers

- Name each identifier exactly as its source does: ISRC, Spotify ID, Spotify URI, Beatport ID, TIDAL ID, MusicBrainz ID (recording MBID in detail tooltips), Discogs release ID, Deezer ID, 1001tracklists ID.
- Render values in `data-s` (`.sn-mono`), never truncated in the middle of the value itself if it fits; always with a `CopyButton` labelled "Copy ISRC".
- Show the label in a `KeyValueGrid` row: "ISRC" → `GBCFB2100123`. Link out with `.sn-link--ext` only where the source has a public page.

## File paths and system locations

- Paths and URLs are `data-s`, middle-truncated (`/music/library/…/Overmono – So U Kno.flac`) with the full value in a Tooltip and a `CopyButton`.
- Non-admin views never show container paths, hostnames, ports, queue names or stack traces (`/app/data`, `redis:6379`, `scraper-orchestrator`). Say the human thing: "The scraping service is unreachable."
- Admin views (`MonitoringPage`) may show hostnames in `data-s` inside a `Disclosure` labelled "Technical details".

## Symbols, glyphs and punctuation

No emoji anywhere in the UI. Replace every emoji in the current code (the music-note wordmark, the play and clipboard emoji on the Play/Plan switch, the wrench on Filters, the gear on Settings, the palette on Fix artist attribution, the memo on Import tracklist, the target on Targets, the tick and cross in alerts) with a Lucide icon plus a word.

| Glyph | Meaning | Where |
|---|---|---|
| ● | ok / perfect | `StatusPill`, `CompatibilityBadge` |
| ◐ | fair / compatible | `StatusPill`, `CompatibilityBadge` |
| ○ | possible (compat) | `CompatibilityBadge` |
| ✕ | bad / clash / field error | `StatusPill`, `.sn-field__error` |
| ▲ | warn | `StatusPill`, flagged rows |
| ↻ | running | `StatusPill` |
| – | idle, missing value, ranges | `.sn-none`, `StatusPill` |
| ↑ ↓ | sort direction, move slot | `DataTable` headers, `SetSlot` |
| ↗ | opens outside the app | `.sn-link--ext` |
| × | multiplication and dimensions only (2 × 4 bars) | never as a close icon; Close uses Lucide `x` |
| → | from-to transitions, steps | "House → Techno" in `TransitionNote` |
| · | separator in meta lines | "124 BPM · 8A · 6:12" |

- True minus (−, U+2212) for negative numbers; hyphen only inside words.
- Curly quotes and apostrophes: “Peak time Friday”, You’ll. Straight quotes only in code and IDs.
- Ellipsis character (…) only for truncation and for actions that open a dialog needing more input ("Import tracklist…"). Busy labels use it: "Saving…".
- No full stop on labels, buttons, headings or single-sentence tooltips. Full stops on sentences in messages and help.

## Questions and confirmations

- Never `window.alert`, `window.confirm` or `window.prompt` (`DJInterface.tsx` `clearQueue` uses both). Use `ConfirmDialog` for destructive or irreversible actions and an armed `Button` (click once to arm, again within 4 s to confirm) for low-stakes removes such as clearing a slot.
- Question titles end with "?" and name the object: "Clear 37 queued jobs?"
- The body states the consequence and what survives: "Jobs in all queues stop and are removed. Completed results stay in the database."
- Buttons: the verb ("Clear queue", `.sn-btn--danger`) and "Cancel". Cancel is the default focus.

## Error messages

Pattern: what happened + why if known + what to do next. One or two sentences.

- "Couldn’t save “Peak time Friday”. The connection dropped. Your changes are kept on this device; try again."
- "TIDAL didn’t accept the playlist: 3 tracks have no TIDAL ID. Remove them or add links, then send again."
- "Key must be a Camelot code like 8A, or a key like A minor." (field error, under the field)
- Never show raw exception text, HTTP codes or "Unknown error" as the message; put them in a "Technical details" `Disclosure`.

## Empty states

Pattern: what this area holds + why it is empty + one action. Use `EmptyState`.

- "No saved sets yet. Build a set from the library and save it to see it here." Action: "Build a set".
- "No tracks match these filters. 1,284 tracks are hidden by Energy 8–10 and Pillar: UK garage." Action: "Clear filters".
- "Nothing scraped in the last 24 h. The next run starts Sun 25 Oct, 06:00 AEDT."

## Glossary

| Term | Meaning | Write |
|---|---|---|
| Energy | Mixed In Key-style intensity, integer 1–10 | Energy 7 |
| Tier | Energy band: Low 1–4, Building 5–7, High 8–10 | Building tier |
| Pillar | Top-level genre of the library: House, Techno, UK garage | Pillar: House |
| Rotation | How often a track is pulled: High, Standard, Vault | Rotation: Vault |
| Crate | The filtered set of library tracks you are working from | 412 tracks in the crate |
| Set | An ordered list of tracks with a shape and length | Set “Peak time Friday” |
| Slot | One position in a set's running order | Slot 7 |
| Spare | An alternative suggested for a slot (3 per slot) | Swap in spare |
| Transition | The move between two consecutive slots: energy, key, BPM, genre | Transition 6 → 7 |
| Camelot key | Key on the Camelot wheel, 1A–12B (A minor, B major) | 8A (A minor) |
| Adjacency | Two tracks played next to each other in real sets | Played next to each other 14 times |
| Waypoint | A track a Pathfinder route must pass through | Add waypoint |
| Target track | A track SongNodes is actively searching sources for | Target track |
| Source | Where a play or a track record came from | Source: 3RRR Superfreak |
| Run | One execution of a scheduled job (weekly library run, scrape run) | Weekly run, Sat 31 Oct |
