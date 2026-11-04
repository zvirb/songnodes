# TYP rules (generated)

| ID | Rule | Check | Test |
|---|---|---|---|
| TYP-001 | Text shall use the named text-style classes or their matching values and shall not set an ad-hoc font size. | lint | Grep CSS/JS for font-size literals outside tokens.css and named style classes; any hit fails. |
| TYP-002 | Sora (--font-display) shall be used for page and section titles, card titles and headline figures in FigureTile. | dom | Computed font-family of titles and FigureTile values starts with Sora. |
| TYP-003 | Sora shall not be used for body text, table cells or buttons. | dom | Computed font-family of body text, td and button does not start with Sora. |
| TYP-004 | Inter (--font-body) shall be used for all UI text: body, labels, buttons, table text and messages. | dom | Computed font-family of those elements starts with Inter. |
| TYP-005 | Inter shall not be used for numbers that must align in columns of data; mono shall be used. | dom | Computed font-family of aligned numeric data cells is JetBrains Mono. |
| TYP-006 | JetBrains Mono (--font-data) shall be used for BPM, Camelot keys, durations, times in rows, counts in data cells, IDs, paths and code. | dom | Computed font-family of those elements starts with JetBrains Mono. |
| TYP-007 | JetBrains Mono shall not be used for titles, prose or button labels. | dom | Computed font-family of h1-h6, p and button does not start with JetBrains Mono. |
| TYP-008 | Inter shall run with font-feature-settings "cv11", "ss01" set on body in 00-core.css. | lint | Computed font-feature-settings on body equals '"cv11", "ss01"'. |
| TYP-009 | Italic shall be used only for titles of works in prose. | lint | font-style: italic / <em> / <i> appear only for work titles. |
| TYP-010 | Italic shall not be used for emphasis in UI; body-strong shall be used for emphasis. | lint | Grep for font-style: italic and <em>/<i> in UI chrome; any hit fails. |
| TYP-011 | Classes shall exist with the same names as the named text styles (.title-l, .data-s), and titles shall use .sn-title plus a size class. | lint | Each h1-h3 title has class sn-title and one title-* size class. |
| TYP-012 | display-xl shall be Sora 2.5rem/40px, line height 1.1, weight 700, letter-spacing −0.01em and shall be used for the HomePage title only. | lint | tokens.json type.display-xl matches; class used only on HomePage title. |
| TYP-013 | title-l shall be Sora 1.75rem/28px, line height 1.2, weight 700 and shall be used for the page title in PageHeader, one per page. | lint | tokens.json type.title-l matches; exactly one .title-l per page. |
| TYP-014 | title-m shall be Sora 1.375rem/22px, line height 1.25, weight 700 and shall be used for SectionHeading and Dialog titles. | lint | tokens.json type.title-m matches. |
| TYP-015 | title-s shall be Sora 1.125rem/18px, line height 1.3, weight 700 and shall be used for Card titles, drawer group titles and the track title in TrackDetailPage. | lint | tokens.json type.title-s matches. |
| TYP-016 | title-lead shall be Sora at 1em of its title, line height 1.2, weight 400, colour fg-3 and shall be used for the lead-in half of a thin–bold title. | lint | tokens.json type.title-lead matches. |
| TYP-017 | figure shall be Sora 2rem/32px, line height 1.05, weight 700, tabular and shall be used for FigureTile values. | lint | tokens.json type.figure matches. |
| TYP-018 | body-l shall be Inter 1.0625rem/17px, line height 1.55, weight 400 and shall be used for help, EmptyState text and onboarding. | lint | tokens.json type.body-l matches. |
| TYP-019 | body shall be Inter 0.9375rem/15px, line height 1.45, weight 400 and shall be the default UI and table text. | lint | tokens.json type.body matches. |
| TYP-020 | body-strong shall be Inter 0.9375rem/15px, line height 1.45, weight 600 and shall be used for track titles in rows, button labels and link text. | lint | tokens.json type.body-strong matches. |
| TYP-021 | body-s shall be Inter 0.8125rem/13px, line height 1.4, weight 400 and shall be used for meta lines, field help and Toast text. | lint | tokens.json type.body-s matches. |
| TYP-022 | label shall be Inter 0.75rem/12px, line height 1.3, weight 600, letter-spacing 0.08em and shall be used for column headers, rail group titles and eyebrows. | lint | tokens.json type.label matches. |
| TYP-023 | caption shall be Inter 0.75rem/12px, line height 1.35, weight 400 and shall be used for FreshnessStamp, chart notes and method text. | lint | tokens.json type.caption matches. |
| TYP-024 | data shall be JetBrains Mono 0.8125rem/13px, line height 1.4, weight 400 and shall be used for BPM, keys, durations and counts in rows. | lint | tokens.json type.data matches. |
| TYP-025 | data-strong shall be JetBrains Mono 0.8125rem/13px, line height 1.4, weight 600 and shall be used for the transition verdict and the current value. | lint | tokens.json type.data-strong matches. |
| TYP-026 | data-s shall be JetBrains Mono 0.6875rem/11px, line height 1.35, weight 400 and shall be used for external IDs and chart tick labels. | lint | tokens.json type.data-s matches. |
| TYP-027 | Running text shall be capped at prose-max (68ch). | dom | Computed max-width of running text <= 68ch. |
| TYP-028 | Text shall not be smaller than 11px (data-s). | dom | Computed font-size of every text node >= 11px at 100% scale. |
| TYP-029 | Text that must be read in the booth shall not be smaller than body-s. | dom | Booth-critical text computed font-size >= 13px. |
| TYP-030 | Font weights in use shall be 400, 500, 600 and 700 and weights 300 and 800 shall not be used in UI. | lint | Grep font-weight for 300/800 and non-listed values; any hit fails. |
| TYP-031 | Weight 500 shall be used for chips and tags only. | lint | font-weight: 500 appears only on .sn-chip/.sn-tag selectors. |
| TYP-032 | Thin–bold page titles shall have a regular lead-in followed by a bold title in the form 'Lead: Title', produced with SongNodes.html.title(lead, title). | lint | Titles with lead-in render <span class="sn-lead"> via SongNodes.html.title. |
| TYP-033 | The title lead-in shall name the module or the object type and shall end with a colon. | lint | span.sn-lead textContent matches /:$/. |
| TYP-034 | The title lead-in shall be weight 400 and colour fg-3 (--m-muted inside a tonal card). | dom | Computed font-weight of .sn-lead = 400; colour = fg-3 or --m-muted in .sn-card--tonal. |
| TYP-035 | The bold half of a thin–bold title shall be the specific thing (a set name, track, or date). | judgement | Bold part is an instance name, not a type. |
| TYP-036 | Thin–bold titles should be used for title-l page titles and title-s card titles where a type prefix helps. | judgement | Typed-object pages use the lead-in pattern. |
| TYP-037 | Section headings (title-m) shall be plain bold without a lead-in. | dom | h2.title-m contains no .sn-lead. |
| TYP-038 | Each page shall have exactly one h1. | dom | document.querySelectorAll('h1').length === 1. |
| TYP-039 | The title lead-in shall be part of the heading text so screen readers hear the full title. | dom | h1 textContent includes the lead-in text; lead-in is not aria-hidden or CSS generated. |
| TYP-040 | Uppercase text shall be produced only through the label style (.sn-eyebrow, .sn-table th, .sn-group rows, .sn-preview__label) and source text shall stay sentence case. | lint | text-transform: uppercase only on listed selectors; source strings are not typed in capitals. |
| TYP-041 | Uppercase labels shall use letter-spacing 0.08em and weight 600 and shall not be uppercase at any other size. | dom | Elements with text-transform uppercase compute letter-spacing 0.08em, weight 600, size 12px. |
| TYP-042 | Uppercase labels shall be 3 words or fewer; longer labels shall stay sentence case. | dom | Elements with text-transform uppercase have <= 3 words. |
| TYP-043 | The .label class shall set size, weight and spacing but not case, and text-transform: uppercase shall be added only to column headers and eyebrows. | lint | '.label' rule has no text-transform; uppercase added only on th/eyebrow selectors. |
| TYP-044 | Letter-spacing shall not be set other than 0.08em on label and −0.01em on display-xl. | lint | Grep letter-spacing values; only 0.08em (label) and -0.01em (display-xl) allowed. |
| TYP-045 | Tabular figures shall be used wherever numbers align (td.num, FigureTile, ProgressBar labels, timers, set lengths) via .sn-num or .sn-mono. | dom | Computed font-variant-numeric includes tabular-nums or font-family is mono for those elements. |
| TYP-046 | Mono (--font-data) shall be used for BPM, Camelot key, durations, clock times in rows, counts in data cells and IDs. | dom | Computed font-family of those elements is --font-data. |
| TYP-047 | FigureTile values shall use Sora with font-variant-numeric: tabular-nums. | dom | FigureTile value computed font-family Sora and font-variant-numeric tabular-nums. |
| TYP-048 | Numeric columns shall be right-aligned. | dom | td.num and th for numeric columns compute text-align: right. |
| TYP-049 | The unit shall be aligned in the column header (e.g. 'BPM') and not repeated in each cell. | dom | Numeric cells contain no unit text when the header carries the unit. |
| TYP-050 | Numbers within prose shall stay in the body face. | dom | Numbers inside p/body text compute Inter, not mono. |
| TYP-051 | Every font shall be self-hosted from the fonts/ directory as latin-subset variable woff2 files: sora-latin-wght-normal.woff2, inter-latin-wght-normal.woff2, inter-latin-wght-italic.woff2, jetbrains-mono-latin-wght-normal.woff2. | lint | @font-face src URLs resolve to the four listed local woff2 files. |
| TYP-052 | @font-face declarations in tokens.css shall use font-display: swap. | lint | Every @font-face block contains font-display: swap. |
| TYP-053 | Pages shall not request Google Fonts or other CDN fonts. | lint | Grep for fonts.googleapis.com, fonts.gstatic.com or non-local font URLs; any hit fails. |
| TYP-054 | SongNodes shall install @fontsource-variable/sora, @fontsource-variable/inter and @fontsource-variable/jetbrains-mono and import them once in main.tsx. | lint | package.json lists the three packages; main.tsx imports each once. |
| TYP-055 | The system font stack and Monaco shall be removed from styles/tokens.css. | lint | Grep styles/tokens.css for Monaco; any hit fails. |
| TYP-056 | Font fallbacks shall be part of the token: display "Sora", "Inter", system-ui; body "Inter", system-ui, -apple-system, "Segoe UI"; data "JetBrains Mono", ui-monospace, Consolas. | lint | --font-display, --font-body, --font-data values equal the listed stacks. |
| TYP-057 | Layout shall not break if the fallback font renders. | visual | Screenshot with webfonts blocked shows no overflow or overlap. |
| TYP-058 | Only Inter roman shall be preloaded using <link rel="preload" as="font" type="font/woff2" crossorigin>. | lint | Exactly one preload link for inter-latin-wght-normal.woff2 with the listed attributes. |
| TYP-059 | Characters outside the latin subset shall fall back to the system font and shall not be replaced with '?'. | dom | Non-latin artist names render glyphs and not '?'. |
| TYP-060 | Users shall be able to set text size in PreferencesPanel as Small, Medium (default), Large or Extra large. | dom | PreferencesPanel exposes four text-size options with Medium default. |
| TYP-061 | Text size shall set data-text-size="s\|m\|l\|xl" on html via SongNodes.prefs.setTextSize, scaling html font-size to 93.75%, 100%, 112.5% and 125%. | dom | html[data-text-size] computes root font-size 15px, 16px, 18px, 20px for s, m, l, xl. |
| TYP-062 | Every font size shall be in rem. | lint | Grep font-size with px/em/% units outside tokens; any hit fails. |
| TYP-063 | Spacing tokens shall stay in px. | lint | Spacing tokens in tokens.css are px values. |
| TYP-064 | Containers holding text shall grow with text size, with no fixed heights on text boxes and min-height used instead. | lint | Grep height: on text containers; fixed height values fail; min-height allowed. |
| TYP-065 | Layouts shall survive Extra large text plus browser zoom 200% without loss of content. | visual | Screenshot at xl + 200% zoom shows no clipped or overlapping content. |
| TYP-066 | Layouts shall reflow at 320 CSS px without horizontal page scroll. | dom | At 320px viewport document.documentElement.scrollWidth <= clientWidth. |
| TYP-067 | Text shall not be clipped when line height is 1.5, paragraph spacing 2×, letter spacing 0.12em and word spacing 0.16em. | visual | Apply text-spacing override CSS; no text clipping or overlap. |
| TYP-068 | The booth theme shall scale the root to 118.75%, and to 131.25% when combined with Large. | dom | html[data-theme=booth] computes root font-size 19px; with Large 21px. |
| TYP-069 | The booth theme shall be used for the DJ booth. | judgement | Booth deployments set data-theme=booth. |
| TYP-070 | At wall and kiosk widths (≥ bp-wall, 1920px), minimum body text shall be 18px (1.125rem). | dom | At viewport >= 1920px computed body font-size >= 18px. |
| TYP-071 | At wall and kiosk widths, FigureTile values shall be 48px or larger. | dom | At viewport >= 1920px FigureTile value font-size >= 48px. |
| TYP-072 | At wall and kiosk widths, the now-playing title shall use display-xl. | dom | At viewport >= 1920px now-playing title has class display-xl. |
| TYP-073 | Wall and kiosk displays shall use the booth theme. | dom | At viewport >= 1920px kiosk, html data-theme equals booth. |
| TYP-074 | In Play mode, the now-playing track and the next recommendation shall be the two largest text items on screen, and nothing else shall exceed title-s. | dom | In Play mode, other text computed font-size <= 18px. |
| TYP-075 | At distance, emphasis shall prefer weight over size changes. | judgement | Emphasis at wall/booth uses font-weight rather than larger font-size. |
| TYP-076 | Text that must be read in the booth shall not rely on fg-3. | dom | Booth-critical text colour is not var(--fg-3). |
| TYP-077 | PIXI text in the graph shall use Inter and not Arial. | lint | GraphVisualization.tsx fontFamily is Inter; no Arial. |
| TYP-078 | The graph shall wait for document.fonts.load('600 12px Inter') before creating PIXI.Text or BitmapText styles. | lint | GraphVisualization.tsx awaits document.fonts.load('600 12px Inter') before creating text styles. |
| TYP-079 | The graph shall rebuild label textures after document.fonts.ready resolves. | lint | GraphVisualization.tsx rebuilds textures in document.fonts.ready.then. |
| TYP-080 | Graph labels shall be Inter 600 at 12px multiplied by device pixel ratio. | lint | Label style fontFamily Inter, fontWeight '600', fontSize 12 * devicePixelRatio. |
| TYP-081 | Graph label colour shall be read at runtime from --fg via getComputedStyle. | lint | Label fill obtained via getComputedStyle(...).getPropertyValue('--fg'). |
| TYP-082 | Graph labels shall use a 3px stroke in --bg behind the text instead of a PIXI dropShadow. | lint | Label style has stroke width 3 colour --bg; no dropShadow property. |
| TYP-083 | Graph labels shall be shown only for the hovered node, its neighbours, the selection and nodes above the zoom threshold. | dom | Visible label set is subset of hover, neighbours, selection, zoom-threshold nodes. |
| TYP-084 | No more than about 60 graph labels shall be shown at once. | dom | Visible graph label count <= 60. |
| TYP-085 | BPM and key in node tooltips shall use JetBrains Mono. | dom | Tooltip BPM/key elements compute JetBrains Mono. |
