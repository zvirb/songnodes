# Data display

Data is the product. Show the value, its unit and its meaning in that order, in the same form everywhere, and give every colour a non-colour twin (number, glyph, word, position or pattern).

## Component index

| Component | Purpose | Use when | Not for |
|---|---|---|---|
| `TrackCell` | Artist – title, with optional meta line | Every list or table naming a track | Free text |
| `EnergyBar` | Energy 1–10 as ten segments + number | Any track energy | Completion (use `ProgressBar`) |
| `KeyBadge` | Camelot key dot + code | Any key | Compatibility (use `CompatibilityBadge`) |
| `BpmReadout` | BPM in mono, optional change | Any tempo | Durations |
| `CompatibilityBadge` | Verdict of a move: glyph + word | Key, BPM, energy, overall transition | System health |
| `TransitionNote` | The strip between two set rows | Running order, path results | Standalone verdicts |
| `StatusPill` | System or job status from a backend enum | Jobs, scrapers, proxies, saves, confidence | Categories, compatibility |
| `CategoryTag` | Neutral category: pillar, genre, rotation, tag | Classification | Anything with a good/bad meaning |
| `SourceBadge` | Where a track or play came from | Heard on, links, imports | Service connection status (`ServiceStatus`) |
| `FigureTile` | One headline figure + label + change | Stats rows, launcher figures | Long lists of numbers (`KeyValueGrid`) |
| `KeyValueGrid` | Label/value pairs | Track detail, job detail | Comparisons across rows (`DataTable`) |
| `DataTable` | Sortable, selectable rows, optional J/K keyboard navigation | Crate, jobs, imports, history | Fewer than 4 items (use a list) |
| `MiniAudioPreview` | 32px play/pause, progress and time for a preview clip; one plays at a time | Crate rows, set slots, suggestions | Full playback or analysis (`WaveformStrip`) |
| `Heatmap` | Counts over two dimensions | Keys × energy, shows × days | Exact values (pair with a table) |
| `Card`, `SetCard`, `SetSlot` | Grouped objects; a saved set; one running-order row | Indexes, set building | Page layout boxes |
| `ChartFrame` + `EnergyWave`, `Sparkline`, `WaveformStrip`, `CamelotWheel` | Charts with title, legend, table fallback | Shapes over time or space | Single numbers |
| `ProgressBar`, `ProgressRing`, `StagedProgress` | Completion | Jobs, imports, set length filled | Health or quality |
| `Checklist` | Items with done/not done | Pre-release checks, onboarding, set readiness | Statuses of systems |
| `Disclosure`, `ShowMore` | Hide secondary detail | Long meta, raw JSON, more suggestions | Primary content |
| `SectionHeading` | `title-m` heading with optional count and action | Every section inside a page | Page titles |
| `FreshnessStamp` | When the data was produced | Every page of stored data | Event times inside rows |

## Track identity

- Always "Artist – Title" with an en dash: "Overmono – So U Kno". Multiple artists joined with ", " and "&" before the last; "feat." stays in the title as the source writes it.
- `TrackCell` line 1 `body-strong` (title wins weight: artist `fg-2`, title `fg`); line 2 `body-s` `fg-3` meta: label, year, mix name. Truncate the title before the artist.
- The track title links to `TrackDetailPage` in Library colour (`.sn-link.sn-m-library`) only when the row has no other click target.
- Remix and version names stay in parentheses as written: "Fred again.. – Delilah (pull me out of this)".

## Energy

| Value | Tier | Token | Display |
|---|---|---|---|
| 1–4 | Low | `energy-1`…`energy-4` | Segments 1–4, then a 2px gap |
| 5–7 | Building | `energy-5`…`energy-7` | Segments 5–7, then a 2px gap |
| 8–10 | High | `energy-8`…`energy-10` | Segments 8–10 |
| none | – | `surface-3` empty segments | `<span class="sn-none">–</span>`, never a default of 5 |

- Render with `EnergyBar` (`.sn-energy` from `SongNodes.html.energy(e)`): ten segments, lit up to the value, the integer printed beside it in `data`, screen-reader text "7 of 10, building tier". The colour is a mark, never text.
- Tier names are "Low", "Building", "High"; ranges "Low 1–4" from `TIER_LABEL`.
- Stored scales (`energy_scale` in `types/index.ts`, `utils/trackMetadata.ts`):

| Stored | Meaning | Show |
|---|---|---|
| `dj_1_10`, integer 1–10 | DJ scale | The integer |
| `legacy_0_1`, 0 < x ≤ 1 | Old Spotify-style float | `round(x × 10)`, clamped 1–10, with a dotted underline and tooltip "Converted from 0.73 (old 0–1 scale)" |
| no scale, 0 < x ≤ 1 | "scale not recorded" | Treat as `legacy_0_1` (same mark) and flag the row "Needs an energy check" |
| no scale, integer 1–10 | Assumed DJ scale | The integer |
| 0, null, NaN, > 10 | Not analysed | "–" |

- This replaces the three energy drawings in SongNodes: percentages (`Math.round(track.energy * 100)%` in `SetlistBuilder.tsx`, `EdgeDetailsModal.tsx`, `SmartTooltip.tsx`, `PathBuilder.tsx` "E:73%"), "7/10" text in `MobileTrackExplorer.tsx`, and the blue-to-red `getEnergyColor` meter in `utils/energyUtils.ts` / `EnergyMeter.tsx`. The `formatStoredEnergy` text "0 (scale not recorded)" is never shown to people.

## Camelot keys

`KeyBadge` = `.sn-key[data-key="8A"]`: a 9px dot in `key-8a`, the code in `data`. The key name ("A minor") appears in tooltips, `TrackDetailPage` and `CamelotWheel` only. Unknown key: hollow dot + "key ?" (`data-unknown`).

| Code | Key | Token | Code | Key | Token |
|---|---|---|---|---|---|
| 1A | A♭ minor | `key-1a` | 1B | B major | `key-1b` |
| 2A | E♭ minor | `key-2a` | 2B | F♯ major | `key-2b` |
| 3A | B♭ minor | `key-3a` | 3B | D♭ major | `key-3b` |
| 4A | F minor | `key-4a` | 4B | A♭ major | `key-4b` |
| 5A | C minor | `key-5a` | 5B | E♭ major | `key-5b` |
| 6A | G minor | `key-6a` | 6B | B♭ major | `key-6b` |
| 7A | D minor | `key-7a` | 7B | F major | `key-7b` |
| 8A | A minor | `key-8a` | 8B | C major | `key-8b` |
| 9A | E minor | `key-9a` | 9B | G major | `key-9b` |
| 10A | B minor | `key-10a` | 10B | D major | `key-10b` |
| 11A | F♯ minor | `key-11a` | 11B | A major | `key-11b` |
| 12A | D♭ minor | `key-12a` | 12B | E major | `key-12b` |

A = minor (darker inner ring), B = major (lighter outer ring). Enharmonic input ("G#m", "Abm", "A♭ minor") normalises through `SongNodes.camelot()`. Use flats for names except F♯ (as the table). This replaces `utils/camelotData.ts`, which labels 1A as C major and every A code as major; see the migration section.

Compatibility of a move from key a to key b (`SongNodes.compat`):

| Move | Example | Verdict | Label |
|---|---|---|---|
| Same code | 8A → 8A | perfect ● | "same key" |
| Same number, other letter | 8A → 8B | perfect ● | "relative A↔B" |
| ±1, same letter | 8A → 9A, 8A → 7A | compatible ◐ | "+1 key", "−1 key" |
| +2, same letter | 8A → 10A | possible ○ | "+2 energy boost" |
| +7, same letter | 8A → 3A | possible ○ | "+7 lift" |
| Anything else | 8A → 11B | clash ✕ | "key clash" |
| Either unknown | – | unknown ? | "key ?" |

## BPM and durations

- `BpmReadout`: `.sn-bpm`, mono, "124" with "BPM" in column headers and "124 BPM" in prose. One decimal only when not whole: "128.5".
- Changes: "+2 BPM", "−3 BPM", "same BPM". Verdict thresholds from `bpmStep`: ≤2 perfect, 3–4 compatible, 5–8 possible, >8 clash.
- Track durations `format.duration(sec)` "6:12"; set lengths `format.span(sec)` "1 h 52 min". Right-align in tables (`td.num`).

## Sources, rotation and pillars

- `SourceBadge`: source name as the source writes it ("1001tracklists", "PBS Soul Time", "Beatport") with an optional count ("3RRR Superfreak ×4"). Neutral `sn-tag` styling, never the service's brand colour, except the Spotify badge which may carry `svc-spotify` per Spotify's rules.
- Rotation: `CategoryTag` "High", "Standard", "Vault". High may use `brand-soft` emphasis; Vault is plain. Never status colours. Rotation is calculated: High rotation and Vault are worked out by the weekly run from the library's own play data (rule and current values in Music domain → Rotation); never print a fixed threshold.
- Pillars: `CategoryTag` "House", "Techno", "UK garage", neutral. Genres the same.

## Graph edge types

| Edge type | Meaning | Stroke |
|---|---|---|
| `adjacency` | Played next to each other in real sets | Solid, width by count |
| `similarity` | Audio/metadata similarity | Dashed 4 3 |
| `collaboration` | Shared artists | Dotted 1 3 |
| `genre` | Same genre | Thin solid 1px |
| `key_compatibility` | Harmonic neighbours | Solid, in `compat-*` of the verdict, only when the key layer is on |

All edges use `fg-3` at `opacity-edge` by default; selection `brand`; path edges `mod-paths`; faded `opacity-faded`. Dash pattern carries the meaning, never colour alone. Node states are in Music domain.

## Graph node colour modes

Node fill is a choice, set by the "Colour by" `SegmentedControl` in `GraphControls` (remembered per device). The legend under the controls always matches the mode.

| Mode | Fill | Legend |
|---|---|---|
| Neutral (default) | `fg-2` for every node; only states carry colour (selected `brand` ring, now amber `now` ring + "Now" tag, path `mod-paths`) | States only: Selected, Now, In path |
| Energy | `energy-1…10` by the track's energy; unknown energy hollow | 1–10 ramp with gaps after 4 and 7, tier words Low · Building · High |
| Key | `key-*` Camelot colour; unknown key hollow | Key-wheel dots with codes ("● 8A"), the selected track's clean mixes first |
| Genre | `chart-1…8` in fixed order per genre (House `chart-1`, Techno `chart-2`, UK garage `chart-3`), tail grouped as "Other" `chart-8` | Swatch + genre name |

Selected (lavender) and now (amber) rings sit on top of every mode; in Energy mode the amber now ring is also labelled "Now", so it never reads as a high-energy node.

## Recommendation scores

Scores are 0–100 (normalise 0–1 scores from `utils/harmonicMatching.ts` ×100). Show the band word first, the number in detail views.

| Score | Band | Shown as |
|---|---|---|
| ≥ 80 | Excellent match | `CompatibilityBadge` perfect ● |
| 60–79 | Good match | compatible ◐ |
| 40–59 | Workable with care | possible ○ |
| < 40 | Hard mix | clash ✕ |

This replaces `getScoreColor` in `components/IntelligentBrowser/utils.ts` (#7ED321 / #F5A623 / #FFA500).

## Headline figures

`FigureTile`: label (`label` style) above, figure in `figure` (Sora 700, tabular), unit in `body-s`, change line "+48 since last week" in `fg-2`. Changes are not coloured good/bad unless the direction has a fixed meaning (failed jobs up = `status-bad`). Four tiles per row on desktop, two on phones.

## Tables

- `DataTable` on `.sn-tablebox .sn-table`. Column headers in sentence case (CSS uppercases). Numbers right-aligned (`td.num`); text left; energy, key and BPM columns fixed width.
- Default sort is the most useful one for the page (crate: Energy, descending) and is shown with `aria-sort`.
- Crate default columns: Energy, Track, BPM, Key, Pillar, Rotation, Heard (plus the row's add-to-set action). "Last heard", Links and the IDs are optional columns, added from the column chooser.
- Row states: hover `hover-bg`, selected `brand-soft` (`aria-selected`), flagged `flag-bg` + warn marker (`data-flag`), now playing amber `--now` inset bar (`data-now`), never `brand`.
- Comfortable 40px rows by default; compact 32px via `data-density="compact"`.
- Keyboard-active row (J/K): `data-active`, a 2px `focus` outline, separate from selection; see DataTable "Keyboard row navigation".
- Empty table: `EmptyState` inside the box, the header row stays.

## Key-value grids

`KeyValueGrid`: labels `fg-3` `body-s`, values `fg` `body`; mono for IDs ("Spotify ID", "ISRC"). Two columns on desktop, one on phones. Missing value "–". IDs get a `CopyButton`.

## Heatmaps

`Heatmap` uses a single-hue ramp from `surface-2` to `fg-2` (neutral) for counts. Never energy or status colours for counts. Every cell has its number on hover/focus and the grid has a table fallback. Axis order: keys by Camelot number, A ring before B; energy 1→10; weekdays Mon→Sun.

## Set cards and slots

- `SetCard`: set name (`title-s`), shape, length "1 h 52 min", track count, a `Sparkline` of energy, last saved stamp. Tonal in Set builder colour on its own page, neutral elsewhere.
- `SetSlot`: slot number (mono), `EnergyBar`, `TrackCell`, `KeyBadge`, `BpmReadout`, controls (lock, up, down, remove), `ShowMore` for the three spare suggestions. `TransitionNote` sits between slots on `sunk`.

## Charts

- Every chart sits in `ChartFrame`: `title-s` title stating the finding, legend, "Show as table" toggle, source and `FreshnessStamp`.
- Categorical series use `chart-1`…`chart-8` (Okabe-Ito based, values in Colour) in order; module meaning uses `mod-*`; energy uses `energy-*`; reference lines `chart-ref` dashed 5 4; gridlines `chart-grid`; axis text `chart-axis`. Simulated data is hatched `sim` and labelled "Preview".
- `EnergyWave`: bars per slot in `energy-*`, the dashed target wave in `chart-ref`, tier bands at 4 and 7 in `chart-grid`, current slot amber `--now` (line + "Now" tag; selected slot stays `brand`).
- `Sparkline` / `ChartFrame` now line: 2px amber `--now` vertical line with a "Now" tag.

## Progress

`ProgressBar`/`ProgressRing` fill `progress-fill` on `progress-track`, with text "312 of 1,284 tracks enriched (24%)". A failed or degraded job shows its `StatusPill` beside the bar; the bar never turns red. `StagedProgress` names steps ("Fetch", "Match", "Enrich", "Save"); finished steps show `status-ok` ● "Done" in green (a finished step is a verdict, not a fill), the running step ↻, failed ✕.

## Checklists, disclosure, section headings

- `Checklist`: `check` icon for done, empty circle for to-do, the count "4 of 6 done". Not a status display.
- `Disclosure`: `chevron-down` that rotates; the summary says what is inside ("Raw response (JSON)"). `ShowMore` reveals more items of the same list: "Show 3 more".
- `SectionHeading`: `title-m`, optional count in `fg-3` ("Running order 24"), optional action at the right.

## The cover page

The design system's cover (`components/Cover/preview.html`) shows the wordmark "SongNodes" in Sora 800 brand, the line "Design system for SongNodes and the music library", the version and date ("1.0.0 · 24 Oct 2026"), and one real sample: an `EnergyWave` of a Peak time set with `KeyBadge`s. No illustration, no gradient, no mark.
