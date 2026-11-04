# DATA rules (generated)

| ID | Rule | Check | Test |
|---|---|---|---|
| DATA-001 | Every colour used to carry meaning shall have a non-colour twin (number, glyph, word, position or pattern). | judgement | Pass if each colour-coded mark also carries text, glyph, position or pattern. |
| DATA-002 | Data shall be shown in the order value, unit, meaning, in the same form everywhere. | judgement | Pass if the same datum renders identically on every page. |
| DATA-003 | TrackCell shall be used in every list or table that names a track and not for free text. | dom | Pass if every track name in lists and tables is inside a TrackCell. |
| DATA-004 | EnergyBar shall be used for any track energy and not for completion. | dom | Pass if track energy renders as .sn-energy and progress does not. |
| DATA-005 | KeyBadge shall be used for any key and not for compatibility. | dom | Pass if every key renders as .sn-key and no compatibility uses it. |
| DATA-006 | BpmReadout shall be used for any tempo and not for durations. | dom | Pass if every tempo renders as .sn-bpm and durations do not. |
| DATA-007 | CompatibilityBadge shall be used for the verdict of a key, BPM, energy or overall transition move and not for system health. | judgement | Pass if transition verdicts use CompatibilityBadge and health does not. |
| DATA-008 | TransitionNote shall be used for the strip between two set rows in running order and path results and not for standalone verdicts. | judgement | Pass if TransitionNote only appears between two rows. |
| DATA-009 | StatusPill shall be used for system or job status from a backend enum and not for categories or compatibility. | judgement | Pass if StatusPill values come from a backend status enum. |
| DATA-010 | CategoryTag shall be used for neutral categories and not for anything with a good or bad meaning. | judgement | Pass if CategoryTag text carries no good or bad meaning. |
| DATA-011 | SourceBadge shall be used for where a track or play came from and not for service connection status. | judgement | Pass if SourceBadge shows origin only and ServiceStatus shows connection. |
| DATA-012 | FigureTile shall be used for one headline figure with label and change and not for long lists of numbers. | judgement | Pass if each FigureTile holds one figure. |
| DATA-013 | KeyValueGrid shall be used for label/value pairs and not for comparisons across rows. | judgement | Pass if KeyValueGrid holds one object's pairs. |
| DATA-014 | DataTable shall be used for sortable selectable rows and not for fewer than four items. | dom | Pass if each DataTable has at least 4 rows. |
| DATA-015 | Heatmap shall be used for counts over two dimensions and not for exact values. | judgement | Pass if Heatmap is paired with a table for exact values. |
| DATA-016 | Card, SetCard and SetSlot shall be used for grouped objects and shall not be used as page layout boxes. | judgement | Fail if Card wraps page layout regions. |
| DATA-017 | Charts shall be built with ChartFrame and a chart component (EnergyWave, Sparkline, WaveformStrip, CamelotWheel) and not used for single numbers. | dom | Pass if each chart is inside ChartFrame and plots more than one value. |
| DATA-018 | ProgressBar, ProgressRing and StagedProgress shall be used for completion and not for health or quality. | judgement | Pass if progress components show completion only. |
| DATA-019 | Checklist shall be used for done/not-done items and not for statuses of systems. | judgement | Pass if Checklist items are tasks. |
| DATA-020 | Disclosure and ShowMore shall be used to hide secondary detail and not primary content. | judgement | Pass if collapsed content is secondary. |
| DATA-021 | SectionHeading shall be used for every section inside a page and not for page titles. | dom | Pass if every section has a SectionHeading and no h1 is a SectionHeading. |
| DATA-022 | FreshnessStamp shall be used on every page of stored data and not for event times inside rows. | dom | Pass if stored-data pages contain FreshnessStamp. |
| DATA-023 | Track names shall be written "Artist – Title" with an en dash. | lint | Pass if track text matches ^.+ – .+$ using U+2013. |
| DATA-024 | Multiple artists shall be joined with ", " and with "&" before the last. | lint | Pass if multi-artist strings use ", " and a final " & ". |
| DATA-025 | "feat." shall stay in the title as the source writes it. | judgement | Pass if feat. text is unchanged from source. |
| DATA-026 | TrackCell line 1 shall use body-strong with the artist in fg-2 and the title in fg. | lint | Pass if line 1 uses body-strong, artist var(--fg-2), title var(--fg). |
| DATA-027 | TrackCell line 2 shall use body-s in fg-3 for meta (label, year, mix name). | lint | Pass if line 2 uses body-s and var(--fg-3). |
| DATA-028 | TrackCell shall truncate the title before the artist. | visual | Pass if at narrow width the title ellipsises while the artist stays visible. |
| DATA-029 | A track title shall link to TrackDetailPage in .sn-link.sn-m-library only when the row has no other click target. | dom | Pass if the title anchor exists only where the row is not otherwise clickable. |
| DATA-030 | Remix and version names shall stay in parentheses as written. | judgement | Pass if remix names are parenthesised and unchanged from source. |
| DATA-031 | Energy segments shall be coloured energy-1 to energy-10 by segment index. | lint | Pass if segment n uses var(--energy-n). |
| DATA-032 | EnergyBar shall leave a 2px gap after segments 4 and 7. | lint | Pass if gaps of 2px follow segments 4 and 7 only. |
| DATA-033 | Empty EnergyBar segments shall use surface-3. | lint | Pass if unlit segments use var(--surface-3). |
| DATA-034 | Missing energy shall render as <span class="sn-none">–</span> and shall never default to 5. | dom | Pass if null energy renders .sn-none and not a value of 5. |
| DATA-035 | EnergyBar shall render ten segments lit up to the value, via .sn-energy from SongNodes.html.energy. | dom | Pass if .sn-energy has 10 segments with lit count equal to the value. |
| DATA-036 | EnergyBar shall print the integer value beside the bar in the data style. | dom | Pass if an integer in data style follows the segments. |
| DATA-037 | EnergyBar shall provide screen-reader text in the form "7 of 10, building tier". | dom | Pass if accessible text matches "N of 10, <tier> tier". |
| DATA-038 | Energy colour shall be used as a mark and never as text colour. | lint | Fail if color property uses an energy- token. |
| DATA-039 | Energy tier names shall be "Low", "Building" and "High" with ranges written "Low 1–4" from TIER_LABEL. | lint | Pass if tier labels come from TIER_LABEL. |
| DATA-040 | Energy stored as dj_1_10 integer 1 to 10 shall be shown as the integer. | dom | Pass if dj_1_10 value 7 displays 7. |
| DATA-041 | Energy stored as legacy_0_1 (0 < x ≤ 1) shall be shown as round(x × 10) clamped to 1–10 with a dotted underline and a "Converted from X (old 0–1 scale)" tooltip. | dom | Pass if 0.73 displays 7 with dotted underline and tooltip. |
| DATA-042 | Energy with no scale and 0 < x ≤ 1 shall be treated as legacy_0_1 with the same mark and the row flagged "Needs an energy check". | dom | Pass if such a row shows the converted value and the flag. |
| DATA-043 | Energy with no scale and an integer 1–10 shall be assumed to be on the DJ scale and shown as the integer. | dom | Pass if unscaled 6 displays 6. |
| DATA-044 | Energy of 0, null, NaN or greater than 10 shall be shown as "–". | dom | Pass if these inputs render "–". |
| DATA-045 | Energy shall not be drawn as a percentage, as "7/10" text or as a blue-to-red meter. | lint | Fail if code uses energy*100 percent, "/10" text or getEnergyColor for energy display. |
| DATA-046 | The text "0 (scale not recorded)" shall never be shown to people. | lint | Fail if "scale not recorded" appears in rendered text. |
| DATA-047 | KeyBadge shall be .sn-key[data-key] with a 9px dot in the matching key token. | dom | Pass if the dot is 9px and colour is var(--key-<code>). |
| DATA-048 | KeyBadge shall show the Camelot code in the data style. | lint | Pass if the code text uses the data style. |
| DATA-049 | The key name (for example "A minor") shall appear only in tooltips, TrackDetailPage and CamelotWheel. | dom | Fail if key names appear in other components. |
| DATA-050 | An unknown key shall render as a hollow dot with "key ?" and data-unknown. | dom | Pass if unknown key has data-unknown, hollow dot and text "key ?". |
| DATA-051 | Each Camelot code shall use the token key-<code in lowercase> (key-1a to key-12b). | lint | Pass if each code maps to var(--key-<code>). |
| DATA-052 | Camelot code to key-name pairs shall follow the design-system table. | lint | Pass if 1A=A♭ minor 2A=E♭ minor 3A=B♭ minor 4A=F minor 5A=C minor 6A=G minor 7A=D minor 8A=A minor 9A=E minor 10A=B minor 11A=F♯ minor 12A=D♭ minor and 1B=B major 2B=F♯ major 3B=D♭ major 4B=A♭ major 5B=E♭ major 6B=B♭ major 7B=F major 8B=C major 9B=G major 10B=D major 11B=A major 12B=E major. |
| DATA-053 | A codes (minor) shall be drawn with a darker inner ring and B codes (major) with a lighter outer ring. | visual | Pass if A uses the darker inner ring and B the lighter outer ring. |
| DATA-054 | Enharmonic key input shall be normalised through SongNodes.camelot(). | lint | Pass if key parsing calls SongNodes.camelot. |
| DATA-055 | Key names shall use flats except F♯. | lint | Fail if names contain ♯ other than F♯. |
| DATA-056 | A move between identical Camelot codes shall be a perfect ● verdict labelled "same key". | dom | Pass if compat(8A,8A) is perfect with label "same key". |
| DATA-057 | A move to the same number with the other letter shall be a perfect ● verdict labelled "relative A↔B". | dom | Pass if compat(8A,8B) is perfect labelled "relative A↔B". |
| DATA-058 | A move of ±1 on the same letter shall be a compatible ◐ verdict labelled "+1 key" or "−1 key". | dom | Pass if compat(8A,9A) and compat(8A,7A) are compatible with those labels. |
| DATA-059 | A move of +2 on the same letter shall be a possible ○ verdict labelled "+2 energy boost". | dom | Pass if compat(8A,10A) is possible labelled "+2 energy boost". |
| DATA-060 | A move of +7 on the same letter shall be a possible ○ verdict labelled "+7 lift". | dom | Pass if compat(8A,3A) is possible labelled "+7 lift". |
| DATA-061 | Any other key move shall be a clash ✕ verdict labelled "key clash". | dom | Pass if compat(8A,11B) is clash labelled "key clash". |
| DATA-062 | A move with either key unknown shall be an unknown ? verdict labelled "key ?". | dom | Pass if compat with unknown key is unknown labelled "key ?". |
| DATA-063 | BpmReadout shall be .sn-bpm in a mono font. | lint | Pass if .sn-bpm uses the mono font token. |
| DATA-064 | BPM shall be written as the bare number with "BPM" in column headers and "N BPM" in prose. | judgement | Pass if table cells omit the unit and prose includes it. |
| DATA-065 | BPM shall show one decimal only when not whole. | lint | Pass if 128.5 shows 128.5 and 124 shows 124. |
| DATA-066 | BPM changes shall be written "+N BPM", "−N BPM" or "same BPM". | lint | Pass if changes match those three forms. |
| DATA-067 | A BPM step of 2 or less shall give a perfect verdict. | dom | Pass if bpmStep(2) is perfect. |
| DATA-068 | A BPM step of 3 to 4 shall give a compatible verdict. | dom | Pass if bpmStep(3) and bpmStep(4) are compatible. |
| DATA-069 | A BPM step of 5 to 8 shall give a possible verdict. | dom | Pass if bpmStep(5) and bpmStep(8) are possible. |
| DATA-070 | A BPM step greater than 8 shall give a clash verdict. | dom | Pass if bpmStep(9) is clash. |
| DATA-071 | Track durations shall use format.duration(sec) in the form m:ss. | lint | Pass if durations match ^\d+:\d{2}$. |
| DATA-072 | Set lengths shall use format.span(sec) in the form "1 h 52 min". | lint | Pass if lengths match ^\d+ h \d+ min$. |
| DATA-073 | Duration cells in tables shall be right-aligned with td.num. | dom | Pass if duration cells carry class num. |
| DATA-074 | SourceBadge shall show the source name as the source writes it with an optional count written "×N". | lint | Pass if names are unaltered from source and counts use ×. |
| DATA-075 | SourceBadge shall use neutral sn-tag styling and never the service brand colour. | lint | Fail if SourceBadge references an svc- token other than svc-spotify. |
| DATA-076 | The svc-spotify colour shall be used only on the Spotify SourceBadge. | lint | Pass if svc-spotify appears only on the Spotify badge. |
| DATA-077 | Rotation shall be shown as CategoryTag with the values "High", "Standard" or "Vault". | dom | Pass if rotation tags are one of the three values. |
| DATA-078 | The High rotation tag may use brand-soft emphasis and the Vault tag shall be plain. | lint | Pass if only High may use brand-soft and Vault has no fill. |
| DATA-079 | Rotation tags shall not use status colours. | lint | Fail if rotation tags reference a status- token. |
| DATA-080 | Rotation thresholds shall not be printed; High rotation and Vault shall be computed by the weekly run from the library's play data. | lint | Fail if rendered text or source contains a fixed rotation threshold. |
| DATA-081 | Pillars and genres shall be shown as neutral CategoryTags. | dom | Pass if pillar and genre tags are CategoryTag with no status colour. |
| DATA-082 | The adjacency edge shall be a solid stroke with width by count. | visual | Pass if adjacency edges are solid with width varying by count. |
| DATA-083 | The similarity edge shall be a dashed stroke with pattern 4 3. | lint | Pass if similarity stroke-dasharray is "4 3". |
| DATA-084 | The collaboration edge shall be a dotted stroke with pattern 1 3. | lint | Pass if collaboration stroke-dasharray is "1 3". |
| DATA-085 | The genre edge shall be a thin solid 1px stroke. | lint | Pass if genre edge is solid at 1px. |
| DATA-086 | The key_compatibility edge shall be solid in the compat-* colour of the verdict and shown only when the key layer is on. | visual | Pass if key edges appear only with the key layer on and use compat- colours. |
| DATA-087 | Graph edges shall default to fg-3 at opacity-edge, selected edges to brand, path edges to mod-paths and faded edges to opacity-faded. | lint | Pass if edge states use those four token sets. |
| DATA-088 | Edge meaning shall be carried by dash pattern and never by colour alone. | judgement | Pass if each edge type is distinguishable in greyscale. |
| DATA-089 | Graph node fill mode shall be chosen by a "Colour by" SegmentedControl in GraphControls and remembered per device. | dom | Pass if the mode persists in device storage across reload. |
| DATA-090 | The graph legend under the controls shall always match the active colour mode. | dom | Pass if legend entries correspond to the active mode. |
| DATA-091 | In Neutral mode (default) every node shall be filled fg-2 and only states carry colour. | lint | Pass if default node fill is var(--fg-2). |
| DATA-092 | Node states shall be a brand ring for selected, an amber now ring with a "Now" tag, and mod-paths for path. | visual | Pass if each state uses its specified ring and label. |
| DATA-093 | The Neutral legend shall list only Selected, Now and In path. | dom | Pass if neutral legend has exactly these entries. |
| DATA-094 | In Energy mode nodes shall be filled with energy-1 to energy-10 by track energy and unknown energy shall be hollow. | visual | Pass if fills follow energy tokens and unknown is hollow. |
| DATA-095 | The Energy legend shall show the 1–10 ramp with gaps after 4 and 7 and the tier words Low · Building · High. | dom | Pass if the legend has these gaps and words. |
| DATA-096 | In Key mode nodes shall be filled with the key-* Camelot colour and unknown key shall be hollow. | visual | Pass if fills follow key tokens and unknown is hollow. |
| DATA-097 | The Key legend shall show key-wheel dots with codes and the selected track's clean mixes first. | dom | Pass if the legend lists dots with codes and compatible keys first. |
| DATA-098 | In Genre mode nodes shall use chart-1 to chart-8 in fixed order per genre with the tail grouped as "Other" in chart-8. | lint | Pass if House chart-1, Techno chart-2, UK garage chart-3 and Other chart-8. |
| DATA-099 | The Genre legend shall show a swatch and the genre name. | dom | Pass if each legend entry has swatch and name. |
| DATA-100 | Selected and now rings shall sit on top of every colour mode. | visual | Pass if rings render above fills in all four modes. |
| DATA-101 | In Energy mode the amber now ring shall also be labelled "Now". | dom | Pass if the now ring has the Now label in Energy mode. |
| DATA-102 | Recommendation scores shall be on a 0–100 scale, normalising 0–1 scores by ×100. | lint | Pass if displayed scores are in 0..100. |
| DATA-103 | Recommendation scores shall show the band word first and the number only in detail views. | dom | Pass if list views show band word only. |
| DATA-104 | A score of 80 or more shall be "Excellent match" shown as CompatibilityBadge perfect ●. | dom | Pass if score 80 gives that band and badge. |
| DATA-105 | A score of 60 to 79 shall be "Good match" shown as compatible ◐. | dom | Pass if score 60 gives that band and badge. |
| DATA-106 | A score of 40 to 59 shall be "Workable with care" shown as possible ○. | dom | Pass if score 40 gives that band and badge. |
| DATA-107 | A score below 40 shall be "Hard mix" shown as clash ✕. | dom | Pass if score 39 gives that band and badge. |
| DATA-108 | FigureTile shall show the label in label style above the figure. | lint | Pass if label uses the label style and precedes the figure. |
| DATA-109 | The FigureTile figure shall use the figure style (Sora 700, tabular) and the unit body-s. | lint | Pass if figure style and body-s unit are applied. |
| DATA-110 | The FigureTile change line shall use fg-2 and shall not be coloured good or bad unless the direction has a fixed meaning. | judgement | Pass if change colour is var(--fg-2) except for fixed-meaning metrics such as failed jobs. |
| DATA-111 | FigureTile rows shall show four tiles per row on desktop and two on phones. | visual | Pass if grid columns are 4 on desktop and 2 on phone. |
| DATA-112 | DataTable shall be built on .sn-tablebox .sn-table. | dom | Pass if every DataTable has those classes. |
| DATA-113 | DataTable column headers shall be written in sentence case. | lint | Pass if header source text is sentence case. |
| DATA-114 | DataTable numbers shall be right-aligned with td.num and text left-aligned. | dom | Pass if numeric cells have class num. |
| DATA-115 | DataTable energy, key and BPM columns shall have fixed width. | lint | Pass if those columns set an explicit width. |
| DATA-116 | DataTable default sort shall be the most useful one for the page and shall be shown with aria-sort. | dom | Pass if exactly one th has aria-sort on load. |
| DATA-117 | The crate DataTable shall default to sort by Energy descending. | dom | Pass if crate loads with Energy aria-sort descending. |
| DATA-118 | The crate DataTable default columns shall be Energy, Track, BPM, Key, Pillar, Rotation, Heard and the add-to-set action. | dom | Pass if default headers equal that list. |
| DATA-119 | Last heard, Links and ID columns shall be optional and added through the column chooser. | dom | Pass if they are hidden by default and in the chooser. |
| DATA-120 | DataTable row hover shall use hover-bg. | lint | Pass if tr:hover background is var(--hover-bg). |
| DATA-121 | A selected DataTable row shall use brand-soft and aria-selected. | dom | Pass if selected rows have aria-selected true and var(--brand-soft). |
| DATA-122 | A flagged DataTable row shall use flag-bg with a warn marker and data-flag. | dom | Pass if flagged rows have data-flag, var(--flag-bg) and a marker. |
| DATA-123 | The now-playing DataTable row shall use an amber --now inset bar with data-now and never brand. | lint | Pass if data-now rows use var(--now) and not var(--brand). |
| DATA-124 | DataTable rows shall be 40px comfortable by default and 32px compact via data-density="compact". | lint | Pass if row height is 40px and 32px under data-density compact. |
| DATA-125 | An empty DataTable shall show EmptyState inside the box and keep the header row. | dom | Pass if empty tables contain EmptyState and thead. |
| DATA-126 | KeyValueGrid labels shall use fg-3 body-s and values fg body. | lint | Pass if label and value styles match. |
| DATA-127 | KeyValueGrid IDs such as Spotify ID and ISRC shall use a mono font. | lint | Pass if ID values use the mono token. |
| DATA-128 | KeyValueGrid shall have two columns on desktop and one on phones. | visual | Pass if column count is 2 on desktop and 1 on phone. |
| DATA-129 | KeyValueGrid shall show "–" for a missing value. | dom | Pass if empty values render "–". |
| DATA-130 | KeyValueGrid IDs shall have a CopyButton. | dom | Pass if each ID value has a CopyButton. |
| DATA-131 | Heatmap shall use a single-hue ramp from surface-2 to fg-2 for counts. | lint | Pass if cell fills interpolate between those two tokens. |
| DATA-132 | Heatmap shall not use energy or status colours for counts. | lint | Fail if Heatmap references energy- or status- tokens. |
| DATA-133 | Every Heatmap cell shall show its number on hover and focus. | dom | Pass if hovering or focusing a cell reveals its count. |
| DATA-134 | Heatmap shall provide a table fallback. | dom | Pass if a table equivalent is available. |
| DATA-135 | Heatmap axes shall order keys by Camelot number with A before B, energy 1 to 10 and weekdays Monday to Sunday. | dom | Pass if axis labels follow those orders. |
| DATA-136 | SetCard shall contain the set name in title-s, shape, length, track count, an energy Sparkline and the last-saved stamp. | dom | Pass if all six parts are present. |
| DATA-137 | SetCard shall be tonal in the Set builder colour on its own page and neutral elsewhere. | dom | Pass if tonal class is used only on the Set builder page. |
| DATA-138 | SetSlot shall contain slot number in mono, EnergyBar, TrackCell, KeyBadge, BpmReadout and controls for lock, up, down and remove. | dom | Pass if all parts are present. |
| DATA-139 | SetSlot shall use ShowMore for the three spare suggestions. | dom | Pass if spares are in a ShowMore. |
| DATA-140 | TransitionNote shall sit between slots on the sunk surface. | lint | Pass if TransitionNote background is var(--sunk). |
| DATA-141 | Every chart shall sit in ChartFrame with a title-s title stating the finding, a legend, a "Show as table" toggle, the source and a FreshnessStamp. | dom | Pass if ChartFrame contains all five parts. |
| DATA-142 | Categorical chart series shall use chart-1 to chart-8 in order. | lint | Pass if series colours are var(--chart-n) in index order. |
| DATA-143 | Module meaning in charts shall use mod-* tokens and energy shall use energy-* tokens. | lint | Pass if module and energy series use those tokens. |
| DATA-144 | Chart reference lines shall use chart-ref dashed 5 4. | lint | Pass if reference lines use var(--chart-ref) with dasharray "5 4". |
| DATA-145 | Chart gridlines shall use chart-grid and axis text chart-axis. | lint | Pass if gridlines use var(--chart-grid) and axis text var(--chart-axis). |
| DATA-146 | Simulated data shall be hatched with the sim pattern and labelled "Preview". | dom | Pass if simulated series have the sim fill and a Preview label. |
| DATA-147 | EnergyWave shall draw bars per slot in energy-* with a dashed target wave in chart-ref. | visual | Pass if bars and dashed target match. |
| DATA-148 | EnergyWave tier bands at 4 and 7 shall use chart-grid. | lint | Pass if the bands at 4 and 7 use var(--chart-grid). |
| DATA-149 | EnergyWave shall mark the current slot with an amber --now line and a "Now" tag while the selected slot stays brand. | visual | Pass if current slot uses var(--now) and selected uses var(--brand). |
| DATA-150 | Sparkline and ChartFrame now lines shall be a 2px amber --now vertical line with a "Now" tag. | lint | Pass if the now line is 2px var(--now) with a Now label. |
| DATA-151 | ProgressBar and ProgressRing shall fill progress-fill on progress-track. | lint | Pass if fill and track use those tokens. |
| DATA-152 | Progress shall have text in the form "312 of 1,284 tracks enriched (24%)". | lint | Pass if progress text includes counts and percentage. |
| DATA-153 | A failed or degraded job shall show its StatusPill beside the bar and the bar shall never turn red. | lint | Fail if progress fill references a status-bad colour. |
| DATA-154 | StagedProgress shall name its steps (for example Fetch, Match, Enrich, Save). | dom | Pass if each step has a name label. |
| DATA-155 | Finished StagedProgress steps shall show status-ok ● "Done", the running step ↻ and the failed step ✕. | dom | Pass if steps carry those glyphs and colour. |
| DATA-156 | Checklist shall use the check icon for done, an empty circle for to-do, and the count "N of M done". | dom | Pass if icons and count follow the form. |
| DATA-157 | Disclosure shall use a chevron-down that rotates, and its summary shall say what is inside. | dom | Pass if chevron rotates on open and summary text names contents. |
| DATA-158 | ShowMore shall reveal more items of the same list with a label such as "Show 3 more". | dom | Pass if the label matches "Show N more". |
| DATA-159 | SectionHeading shall use title-m with an optional count in fg-3 and an optional right-hand action. | lint | Pass if heading uses title-m and count var(--fg-3). |
| DATA-160 | The design-system cover shall show the wordmark "SongNodes" in Sora 800 brand, the line "Design system for SongNodes and the music library", the version and date, and one EnergyWave sample with KeyBadges. | dom | Pass if the cover contains those four items. |
| DATA-161 | The design-system cover shall have no illustration, gradient or mark. | dom | Fail if the cover has img, svg illustration or gradient background. |
