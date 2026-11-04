# COL rules (generated)

| ID | Rule | Check | Test |
|---|---|---|---|
| COL-001 | Colour shall be used only to layer surfaces, rank text, identify the module and convey status. | judgement | Each colour usage maps to one of surface, text rank, module identity or status. |
| COL-002 | Every colour shall be a token from tokens.css and colour literals shall not appear in component code except in the listed exceptions. | lint | Regex /#[0-9a-fA-F]{3,8}\b\|rgba?\(\|hsla?\(/ in component CSS/JS outside tokens.css and the exceptions; any match fails. |
| COL-003 | Token bg shall be #222222 in dark, #f4f4f1 in light and #000000 in booth. | lint | tokens.css --bg per theme equals the listed values. |
| COL-004 | Token surface-1 shall be #2d2d2d in dark, #ffffff in light and #0f0f0f in booth. | lint | tokens.css --surface-1 per theme equals the listed values. |
| COL-005 | Token surface-2 shall be #373737 in dark, #ecece8 in light and #1c1c1c in booth. | lint | tokens.css --surface-2 per theme equals the listed values. |
| COL-006 | Token surface-3 shall be #414141 in dark, #e1e1dc in light and #2a2a2a in booth. | lint | tokens.css --surface-3 per theme equals the listed values. |
| COL-007 | Token sunk shall be #1b1b1b in dark, #e9e9e5 in light and #000000 in booth. | lint | tokens.css --sunk per theme equals the listed values. |
| COL-008 | Token overlay shall be 55% black in dark, 40% ink in light and 80% black in booth. | lint | tokens.css --overlay per theme equals the listed values. |
| COL-009 | The bg token shall be used for the page background. | lint | body/page root background references var(--bg). |
| COL-010 | The surface-1 token shall be used for cards, panels, table body, drawer and dialog backgrounds. | lint | Those components' background references var(--surface-1). |
| COL-011 | The surface-2 token shall be used for raised parts inside a panel (table header, hovered row, .sn-seg track). | lint | Those selectors' background references var(--surface-2). |
| COL-012 | The surface-3 token shall be used for pressed or selected neutral fills, progress track and skeleton base. | lint | Those selectors' background references var(--surface-3). |
| COL-013 | The sunk token shall be used for inputs, code wells and the transition strip between set rows. | lint | Those selectors' background references var(--sunk). |
| COL-014 | The overlay token shall be used for the scrim behind NavDrawer, SideSheet on phones and Dialog. | lint | Scrim background references var(--overlay). |
| COL-015 | Surfaces shall step up one layer at a time: bg, surface-1, surface-2, surface-3. | dom | Computed background of each element is exactly one layer above its parent's layer. |
| COL-016 | surface-1 shall not be placed on surface-2. | dom | No element with background surface-1 has an ancestor/parent with background surface-2. |
| COL-017 | The line token shall be used only for decorative dividers between rows and sections. | lint | border color var(--line) appears only on dividers, not on controls. |
| COL-018 | Edges that define a control (input, chip, secondary button, checkbox) shall use line-strong, which holds 3:1 contrast. | lint | Control border-color is var(--line-strong); contrast >= 3:1 against its ground. |
| COL-019 | The fg token shall be used for titles, primary text and icons. | lint | Titles/primary text/icons colour references var(--fg). |
| COL-020 | The fg token shall hold 4.5:1 contrast on bg, surface-1, surface-2, surface-3 and brand-soft, and 7:1 in booth. | lint | build_tokens.py contrast report passes for fg on listed grounds. |
| COL-021 | The fg-2 token shall be used for metadata lines, supporting table cells and quiet buttons. | lint | Those elements' colour references var(--fg-2). |
| COL-022 | The fg-2 token shall hold 4.5:1 contrast on bg, surface-1 and surface-2, and 7:1 in booth. | lint | build_tokens.py contrast report passes for fg-2 on listed grounds. |
| COL-023 | The fg-3 token shall be used for the lead-in of thin–bold titles, captions and column headers. | lint | Those elements' colour references var(--fg-3). |
| COL-024 | The fg-3 token shall hold 4.5:1 contrast on bg and surface-1 only. | lint | build_tokens.py contrast report passes for fg-3 on bg and surface-1. |
| COL-025 | The fg-disabled token shall be used for disabled labels only. | lint | var(--fg-disabled) appears only on :disabled/[aria-disabled] label selectors. |
| COL-026 | fg-3 shall not be used on surface-2 or surface-3; fg-2 shall be used there. | dom | No element with colour fg-3 has background surface-2 or surface-3. |
| COL-027 | Text emphasis shall be limited to the three levels fg, fg-2 and fg-3 and a fourth level shall not be created by lowering opacity. | lint | No opacity < 1 applied to text elements to create an extra grey level. |
| COL-028 | Token brand shall be #9b85cb in dark, #6a52a6 in light and #c9b9f0 in booth. | lint | tokens.css --brand per theme equals the listed values. |
| COL-029 | Brand shall be used for the wordmark in AppHeader. | dom | AppHeader wordmark colour computes to var(--brand). |
| COL-030 | Brand shall be used for the single .sn-btn--primary per view. | dom | Only .sn-btn--primary uses brand as solid fill. |
| COL-031 | Brand shall be used for the focus ring (focus), selection outline and ::selection (brand-soft). | lint | focus-visible outline and ::selection reference brand/brand-soft tokens. |
| COL-032 | Brand shall be used for selected rows and chips (brand-soft fill) and the current drawer item. | dom | Selected row/chip/drawer item background computes to var(--brand-soft). |
| COL-033 | Brand shall be used for selected graph nodes as a lavender ring. | visual | Selected graph node has brand-coloured ring. |
| COL-034 | Brand shall be used for generic links with no module destination via the link token. | lint | Links without module destination use var(--link). |
| COL-035 | Brand shall not be used for the 'now' marker. | lint | No brand token in now marker styles (tr[data-now], now line, now ring). |
| COL-036 | Brand shall not be used for status. | lint | No brand token in status-* selectors or StatusPill. |
| COL-037 | Brand shall not be used for a chart series. | lint | No brand token among chart series colours. |
| COL-038 | Brand shall not be used for module identity. | lint | No brand token in mod-* / sn-m-* rules. |
| COL-039 | Brand shall not be used for decorative headers or large fills, and shall be a background behind text only as brand-soft. | lint | Large-area backgrounds or header decorations do not reference brand; text backgrounds use brand-soft only. |
| COL-040 | Each module shall own one hue for its drawer icon, links that lead to it, its tonal cards (.sn-card--tonal inside .sn-m-<key>) and its PageHeader band, exposed as mod-<key> and mod-<key>-bg. | lint | tokens.css defines --mod-<key> and --mod-<key>-bg for each module key. |
| COL-041 | Graph module tokens shall be #6fa8dc / #22313e in dark, #2b679a / #e5f2fe in light and #acd6fe / #081725 in booth under scope class sn-m-graph. | lint | tokens.css .sn-m-graph --mod-graph / --mod-graph-bg per theme equals the listed values. |
| COL-042 | Library module tokens shall be #c9a85c / #362e1b in dark, #7d5e01 / #f9efda in light and #e9ce92 / #1d1502 in booth under scope class sn-m-library. | lint | tokens.css .sn-m-library values per theme equal the listed values. |
| COL-043 | Set builder module tokens shall be #e08a5f / #3f291e in dark, #9b4816 / #ffece3 in light and #fec1a4 / #250f05 in booth under scope class sn-m-sets. | lint | tokens.css .sn-m-sets values per theme equal the listed values. |
| COL-044 | Pathfinder module tokens shall be #d27aa8 / #3e2732 in dark, #964070 / #ffe9f3 in light and #feb9db / #240d19 in booth under scope class sn-m-paths. | lint | tokens.css .sn-m-paths values per theme equal the listed values. |
| COL-045 | Key & mood module tokens shall be #5fb8b0 / #1e3432 in dark, #00736c / #def6f3 in light and #9ce0d9 / #031a18 in booth under scope class sn-m-harmony. | lint | tokens.css .sn-m-harmony values per theme equal the listed values. |
| COL-046 | Sources module tokens shall be #8fbf6b / #27331e in dark, #447214 / #e8f5e0 in light and #b8df9c / #0e1a05 in booth under scope class sn-m-sources. | lint | tokens.css .sn-m-sources values per theme equal the listed values. |
| COL-047 | Pipeline module tokens shall be #7fa1b3 / #283135 in dark, #46687a / #e7f2f8 in light and #bad6e5 / #0f171c in booth under scope class sn-m-pipeline. | lint | tokens.css .sn-m-pipeline values per theme equal the listed values. |
| COL-048 | Services module tokens shall be #a5a07b / #312f26 in dark, #6a6440 / #f2f1e5 in light and #d6d2b4 / #18160d in booth under scope class sn-m-services. | lint | tokens.css .sn-m-services values per theme equal the listed values. |
| COL-049 | A module hue shall mean identity only and shall not mean good, bad, new or selected. | judgement | Module tokens are not used to signal state. |
| COL-050 | Each page shall be dominated by its own module's hue, and other modules shall appear only as links (text colour) and small LauncherCard icons. | dom | Non-own mod-* tokens used only on link text colour and LauncherCard icons. |
| COL-051 | Inside a tonal card, every part shall be a shade of the card's hue (--m-bg, --m-raised, --m-line, --m-ink, --m-muted), and only status pills shall break out. | lint | .sn-card--tonal descendants use only --m-* tokens for colour, except StatusPill. |
| COL-052 | Solid module buttons (.sn-btn--mod) shall mean 'go to or act in that module' and use --m-on text. | lint | .sn-btn--mod text colour references var(--m-on). |
| COL-053 | Module hues shall not be used as chart series, except to mark a chart that compares modules; otherwise chart-* shall be used. | judgement | Chart series colours are chart-* unless chart compares modules. |
| COL-054 | Every backend enum shall be mapped to a status through SongNodes.status(raw). | lint | Status rendering calls SongNodes.status; no ad-hoc enum-to-colour maps. |
| COL-055 | Status colour shall always be paired with a glyph and a word in every theme. | dom | Every StatusPill/status element has glyph and text child. |
| COL-056 | Status ok shall use token status-ok, glyph ● and words Done, Healthy, OK, Saved, Normal, High confidence. | dom | [data-status=ok] colour is status-ok, glyph ●, text in the word list. |
| COL-057 | Status fair shall use token status-fair, glyph ◐ and words Medium confidence, compatible. | dom | [data-status=fair] colour is status-fair, glyph ◐, text in the word list. |
| COL-058 | Status warn shall use token status-warn, glyph ▲ and words Degraded, Partly done, Cooling down, Testing, Low confidence, Stale. | dom | [data-status=warn] colour is status-warn, glyph ▲, text in the word list. |
| COL-059 | Status bad shall use token status-bad, glyph ✕ and words Failed, Error, Timed out, Down, Critical, Paused after errors. | dom | [data-status=bad] colour is status-bad, glyph ✕, text in the word list. |
| COL-060 | Status info shall use token status-info (grey), glyph i and neutral notes, and shall not be blue. | dom | [data-status=info] colour is status-info (neutral grey), glyph i. |
| COL-061 | Status running shall use fg on surface-3, glyph ↻ and words Running, Processing, In progress, Saving…. | dom | [data-status=running] uses fg on surface-3, glyph ↻. |
| COL-062 | Status idle shall use fg-3 outlined, glyph – and words Queued, Idle, Off, Skipped, Cancelled, Not tested, Not set up. | dom | [data-status=idle] uses fg-3 outlined, glyph –. |
| COL-063 | Booth status colours shall use the same traffic-light hues as dark (green ok, amber warn, red bad) lifted to 7:1 on black. | lint | Booth status tokens hue-match dark and pass 7:1 on black in build_tokens.py. |
| COL-064 | Transition compatibility shall map perfect ●, compatible ◐, possible ○ and clash ✕ to compat-* tokens, shown via CompatibilityBadge and TransitionNote. | dom | CompatibilityBadge/TransitionNote use compat-* with listed glyphs. |
| COL-065 | Energy check shall map step +1 or hold to perfect, −1 to compatible, a second −1 in a row to possible, and +2 or more to clash, via SongNodes.energyStep, shown in TransitionNote. | lint | energyStep unit test returns the listed levels for the listed steps. |
| COL-066 | Rows needing an energy check shall carry data-flag (flag-bg) and a ▲ marker in DataTable. | dom | tr[data-flag] has flag-bg background and ▲ marker. |
| COL-067 | Rotation shall be rendered as a neutral CategoryTag and not as a status (High may use brand-soft emphasis). | dom | Rotation tag uses .sn-tag neutral; only High may add brand-soft. |
| COL-068 | Data confidence shall map high to ok, medium to fair and low to warn, shown in StatusPill. | dom | StatusPill data-status for confidence high/medium/low equals ok/fair/warn. |
| COL-069 | Scraper circuit shall map closed to ok 'Normal', half_open to warn 'Testing' and open to bad 'Paused after errors', shown in ServiceStatus. | dom | ServiceStatus maps circuit states to the listed status and words. |
| COL-070 | Proxy health shall map healthy to ok, degraded to warn, failed to bad and untested to idle, shown in ServiceStatus. | dom | ServiceStatus maps proxy states to the listed statuses. |
| COL-071 | Validation severity shall map error to bad, warning to warn and info to info, shown in StatusPill. | dom | StatusPill data-status for severity equals bad/warn/info. |
| COL-072 | Progress (ProgressBar, ProgressRing, StagedProgress) shall always use progress-fill on progress-track, both neutral. | lint | Progress fill/track reference var(--progress-fill) / var(--progress-track) only. |
| COL-073 | A health judgement about progress shall be placed in a StatusPill beside the bar and not expressed by the bar colour. | dom | Progress bar colour never changes with health; StatusPill sibling carries health. |
| COL-074 | Genres, Pillars, sources, shows, tags, rotation and edge types shall be shown as neutral CategoryTag (.sn-tag). | dom | Those values render .sn-tag with neutral colours. |
| COL-075 | Categories in charts shall be shown as chart-* series. | lint | Category series colours reference chart-N tokens. |
| COL-076 | Categories shall not be coloured with a status or module token. | lint | No status-* or mod-* tokens on .sn-tag or category series. |
| COL-077 | Edge types in the graph (adjacency, similarity, collaboration, genre, key_compatibility) shall use chart-1 to chart-5 in that order. | lint | Edge type to colour map equals chart-1..5 in the listed order. |
| COL-078 | flag-bg shall be the only tint for 'look at this row' (needs an energy check, duplicate, stale). | lint | Row-highlight uses var(--flag-bg) only. |
| COL-079 | flag-bg shall be used on tr[data-flag] or a cell. | dom | var(--flag-bg) applied only to tr[data-flag] or td. |
| COL-080 | A flagged row shall always include a status-warn ▲ marker and a text reason in the row or its Tooltip. | dom | tr[data-flag] contains ▲ marker and reason text or Tooltip. |
| COL-081 | Flagging shall not use status-*-bg. | lint | tr[data-flag] background is not status-*-bg. |
| COL-082 | Categorical chart colours shall be chart-1 to chart-8 in order, based on the Okabe-Ito palette (sky blue, orange, bluish green, reddish purple, yellow, blue, vermilion, grey). | lint | Series colours use --chart-1..8 in index order. |
| COL-083 | Charts with more than 8 categories shall show the top 7 and group the tail as 'Other' in chart-8 (grey). | dom | Series count <= 8; 8th series named 'Other' uses chart-8. |
| COL-084 | chart-1 to chart-8 shall be #56b4e9, #e69f00, #3fc29a, #cc79a7, #e8d95a, #5aa0e0, #f08a4b, #999999 in dark and #0072b2, #b36b00, #007a5a, #b0477f, #8a7d00, #005a8c, #b34700, #6b6b6b in light. | lint | tokens.css --chart-N per theme equals the listed values. |
| COL-085 | Booth chart colours shall use the dark values. | lint | Booth --chart-N equals dark --chart-N. |
| COL-086 | Light chart values shall hold 3:1 contrast on white for lines and labels. | lint | build_tokens.py contrast report passes chart-N on white at 3:1. |
| COL-087 | Chart colours shall be assigned to an entity and not to a rank, and the order shall be fixed. | judgement | Same entity gets same chart-N across charts. |
| COL-088 | Chart series shall be labelled directly so colour is never the only cue. | dom | Each series has a direct text label. |
| COL-089 | Ordered classes (energy, tiers) shall use energy-1 to energy-10. | lint | Energy/tier colour references --energy-N. |
| COL-090 | Other ordered data shall use a single-hue ramp built from one chart-* at stepped opacity and shall not use a rainbow. | judgement | Ramp is one hue with varying opacity. |
| COL-091 | Keys shall be coloured with key-1a to key-12b and shall always print the code. | dom | Key colour dots reference --key-N and sibling text shows the Camelot code. |
| COL-092 | Reference lines (target wave, average, threshold) shall use chart-ref, 1.5px dashed with dash array 5 4, labelled at the end of the line. | lint | Reference line stroke var(--chart-ref), stroke-width 1.5, stroke-dasharray '5 4', label at line end. |
| COL-093 | Chart grid shall use chart-grid and axis text shall use chart-axis. | lint | Grid stroke var(--chart-grid); axis text fill var(--chart-axis). |
| COL-094 | Charts shall have no background other than the surface they sit on. | dom | Chart container background is transparent or equals parent surface. |
| COL-095 | Token now shall be #f7c04a in dark, #9a6400 in light and #ffd166 in booth and shall be distinct from brand. | lint | tokens.css --now per theme equals the listed values. |
| COL-096 | The now marker shall indicate 'now playing', the current slot or the current time only. | judgement | --now used only for now-playing/current slot/current time. |
| COL-097 | A now row shall show a 3px inset bar on tr[data-now]. | lint | tr[data-now] has box-shadow inset 3px with var(--now). |
| COL-098 | A now timeline marker shall be a vertical line (ChartFrame now line, today's column on the weekly grid). | visual | Timelines draw a vertical now line in var(--now). |
| COL-099 | A now graph node shall have an amber ring plus a 'Now' tag. | visual | Now node has amber ring and a 'Now' tag. |
| COL-100 | The now token shall not be used for selection, and selection shall stay brand lavender. | lint | Selection styles use brand/brand-soft; no var(--now) in selected states. |
| COL-101 | The now token shall never appear without the word 'Now' or a time label beside it. | dom | Each element using --now has adjacent text 'Now' or a time label. |
| COL-102 | Simulated (proposed but not real) data shall be hatched in the sim token and labelled 'Preview' in the chart or slot. | dom | Simulated element has hatch pattern in var(--sim) and 'Preview' label. |
| COL-103 | The sim hatch shall be removed as soon as the data is saved. | dom | Saved data has no hatch pattern. |
| COL-104 | Neutral tokens shall be named <role>[-<variant>] (e.g. surface-2, fg-3). | lint | Regex ^--(bg\|surface-\d\|fg(-[23]\|-disabled)?\|line(-strong)?\|sunk\|overlay)$ on neutral names. |
| COL-105 | Module tokens shall be named mod-<module>[-bg\|-raised\|-line\|-ink\|-muted] and on-mod-<module>. | lint | Regex ^--(on-)?mod-[a-z]+(-bg\|-raised\|-line\|-ink\|-muted)?$. |
| COL-106 | Status tokens shall be named status-<state>[-bg] and on-status-bad. | lint | Regex ^--(status-(ok\|fair\|warn\|bad\|info)(-bg)?\|on-status-bad)$. |
| COL-107 | Compatibility, energy, key and chart tokens shall be named compat-<level>, energy-<1–10>, key-<n><a\|b>, chart-<n> and chart-grid\|axis\|ref. | lint | Regex ^--(compat-\w+\|energy-(10\|[1-9])\|key-(1[0-2]\|[1-9])[ab]\|chart-([1-8]\|grid\|axis\|ref))$. |
| COL-108 | Service tokens shall be named svc-<service> and on-svc-<service>. | lint | Regex ^--(on-)?svc-[a-z]+$. |
| COL-109 | Tokens prefixed on-* shall always be used for text on that fill. | lint | --on-X used only as colour on elements whose background is --X. |
| COL-110 | Body text (fg, fg-2, fg-3, link, mod-*, status-*) shall hold 4.5:1 on its listed grounds. | lint | build_tokens.py contrast report passes at 4.5:1 for listed pairs in all themes. |
| COL-111 | In booth, fg, fg-2, fg-3, mod-* and mod-*-ink shall hold 7:1 on their grounds. | lint | build_tokens.py booth contrast >= 7:1 for listed pairs. |
| COL-112 | on-brand on brand, on-mod-* on mod-*, and on-status-bad on status-bad shall hold 4.5:1 in all themes. | lint | build_tokens.py contrast >= 4.5:1 for listed pairs. |
| COL-113 | Control edges line-strong, the focus ring brand and key dots on surface-1 shall hold 3:1. | lint | build_tokens.py contrast >= 3:1 for listed pairs in all themes. |
| COL-114 | mod-*-line on mod-*-bg shall hold 1.4:1 as a decorative edge. | lint | build_tokens.py contrast >= 1.4:1 for listed pairs. |
| COL-115 | source/build_tokens.py shall be run after any colour change. | judgement | Colour-changing commits include a passing build_tokens.py run ('Contrast: all pairs pass.'). |
| COL-116 | A failing contrast pair shall block the change. | lint | build_tokens.py exits non-zero on any failing pair; CI blocks. |
| COL-117 | Only colour pairs listed in the token usage notes (tokens.json) shall be used. | lint | Every fg/bg pair in CSS exists in tokens.json usage notes. |
| COL-118 | A new colour pair shall be added to the generator before it is used. | judgement | New pair has a line in source/build_tokens.py before use. |
| COL-119 | svc-spotify, svc-tidal and their on-* tokens shall be used only on the 'Connect Spotify' and 'Connect TIDAL' buttons and their SourceBadge. | lint | Grep var(--svc-*) / var(--on-svc-*) usage outside those components. |
| COL-120 | PIXI graph rendering shall read colour tokens at runtime with getComputedStyle(document.documentElement).getPropertyValue and convert to a hex number. | lint | GraphVisualization.tsx calls getComputedStyle().getPropertyValue('--mod-graph') for colours. |
| COL-121 | PIXI graph rendering shall re-read colour tokens on theme change. | lint | GraphVisualization.tsx subscribes to theme change and re-reads tokens. |
| COL-122 | GraphVisualization.tsx shall not contain hex colour literals. | lint | Regex /#[0-9a-fA-F]{3,8}\b/ over GraphVisualization.tsx; any match fails. |
| COL-123 | Print (PrintSheet) shall render black on white via @media print with --fg: #000 and --bg: #fff overrides in one place. | lint | Exactly one @media print block sets --fg:#000 and --bg:#fff. |
| COL-124 | Gradients shall be used only for image placeholders. | lint | Grep linear-gradient\|radial-gradient outside image placeholder selectors; any hit fails. |
