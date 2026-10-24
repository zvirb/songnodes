# Typography

Three typefaces, each with one job, and a fixed set of named text styles. Use the style classes or the matching values in component CSS; never set an ad-hoc font size.

## Typefaces and roles

| Family | Token | Role | Never for |
|---|---|---|---|
| Sora (variable 100–800) | `--font-display` | Page and section titles, card titles, headline figures in `FigureTile` | Body text, table cells, buttons |
| Inter (variable 100–900, roman and italic) | `--font-body` | All UI text: body, labels, buttons, table text, messages | Numbers that must align in columns of data (use mono) |
| JetBrains Mono (variable 100–800) | `--font-data` | BPM, Camelot keys, durations, times in rows, counts in data cells, IDs, paths, code | Titles, prose, button labels |

- Inter runs with `font-feature-settings: "cv11", "ss01"` (set on `body` in `00-core.css`): single-storey a and open digits that read well at small sizes.
- Italic is for titles of works in prose only (a mix name in a sentence). Never for emphasis in UI; use `body-strong`.

## Named text styles

From `tokens.json` → `type`. Classes exist with the same names (`.title-l`, `.data-s`); titles use `.sn-title` plus a size class.

| Style | Family | Size (rem / px at 100%) | Line height | Weight | Use |
|---|---|---|---|---|---|
| `display-xl` | Sora | 2.5 / 40 | 1.1 | 700, −0.01em | `HomePage` title only |
| `title-l` | Sora | 1.75 / 28 | 1.2 | 700 | Page title in `PageHeader`; one per page |
| `title-m` | Sora | 1.375 / 22 | 1.25 | 700 | `SectionHeading`, `Dialog` titles |
| `title-s` | Sora | 1.125 / 18 | 1.3 | 700 | `Card` titles, drawer group titles, track title in `TrackDetailPage` |
| `title-lead` | Sora | 1em of its title | 1.2 | 400, `fg-3` | Lead-in half of a thin–bold title |
| `figure` | Sora | 2 / 32 | 1.05 | 700, tabular | `FigureTile` values |
| `body-l` | Inter | 1.0625 / 17 | 1.55 | 400 | Help, `EmptyState` text, onboarding |
| `body` | Inter | 0.9375 / 15 | 1.45 | 400 | Default UI and table text |
| `body-strong` | Inter | 0.9375 / 15 | 1.45 | 600 | Track titles in rows, button labels, link text |
| `body-s` | Inter | 0.8125 / 13 | 1.4 | 400 | Meta lines, field help, `Toast` text |
| `label` | Inter | 0.75 / 12 | 1.3 | 600, 0.08em | Column headers, rail group titles, eyebrows (uppercased by CSS) |
| `caption` | Inter | 0.75 / 12 | 1.35 | 400 | `FreshnessStamp`, chart notes, method text |
| `data` | JetBrains Mono | 0.8125 / 13 | 1.4 | 400 | BPM, keys, durations, counts in rows |
| `data-strong` | JetBrains Mono | 0.8125 / 13 | 1.4 | 600 | Transition verdict, the current value |
| `data-s` | JetBrains Mono | 0.6875 / 11 | 1.35 | 400 | External IDs, chart tick labels |

- Running text is capped at `prose-max` (68ch).
- Never go below `data-s` (11px). Text that must be read in the booth never goes below `body-s`.
- Weights in use: 400, 500 (chips and tags only), 600, 700. No 300 or 800 in UI.

## Thin–bold titles

Page titles have a regular lead-in and a bold title: "Set builder: **Peak time Friday**".

```html
<h1 class="sn-title title-l"><span class="sn-lead">Set builder:</span> Peak time Friday</h1>
```

- The lead-in is the module or the object type, ends with a colon, weight 400, colour `fg-3` (`--m-muted` inside a tonal card). Produce it with `SongNodes.html.title(lead, title)`.
- The bold half is the specific thing: a set name, a track ("Track: **Overmono – So U Kno**"), a date ("Weekly run: **Sat 31 Oct**").
- Use it for `title-l` page titles and `title-s` card titles where a type prefix helps. Section headings (`title-m`) are plain bold: "Running order".
- One `h1` per page. The lead-in is part of the heading text so screen readers hear "Set builder: Peak time Friday".

## Uppercase and letter-spacing

- Uppercase only through the `label` style: `.sn-eyebrow`, `.sn-table th`, `.sn-group` rows, `.sn-preview__label`. Source text stays sentence case, so screen readers and copy-paste get "Energy tier", not spelt-out capitals.
- Always pair uppercase with `letter-spacing: 0.08em` and weight 600; never uppercase at any other size.
- Keep uppercase labels to 3 words or fewer ("Last heard", "Energy tier", "Heard on"). Longer labels stay sentence case.
- The token class `.label` sets size, weight and spacing but not the case; add `text-transform: uppercase` only where the element is a column header or eyebrow.
- No other letter-spacing except `display-xl` (−0.01em).

## Numerals

- Tabular figures wherever numbers align: table cells (`td.num`), `FigureTile`, `ProgressBar` labels, timers, set lengths. Use `.sn-num` (Inter or Sora tabular) or `.sn-mono`.
- Mono (`--font-data`) for BPM, Camelot key, durations, clock times in rows, counts in data cells and IDs. Mono keeps "124" and "128" the same width and separates 8A from 8B at a glance.
- `FigureTile` values use Sora with `font-variant-numeric: tabular-nums` so counters do not jitter when they update.
- Right-align numeric columns; align the unit in the header ("BPM"), not in each cell.
- Prose numbers ("3 tracks need an energy check") stay in the body face.

## Font hosting and offline

- Self-host every font. The design system ships latin-subset variable woff2 files in `fonts/`: `sora-latin-wght-normal.woff2`, `inter-latin-wght-normal.woff2`, `inter-latin-wght-italic.woff2`, `jetbrains-mono-latin-wght-normal.woff2` (about 170 KB together). `tokens.css` declares them with `font-display: swap`.
- No Google Fonts or CDN requests: the booth and the weekly run must work offline or on venue Wi-Fi.
- SongNodes installs the same faces as npm packages and imports them once in `main.tsx`:
  `@fontsource-variable/sora`, `@fontsource-variable/inter`, `@fontsource-variable/jetbrains-mono`. Remove the system stack and Monaco from `styles/tokens.css`.
- Fallbacks are part of the token: display "Sora", "Inter", system-ui; body "Inter", system-ui, -apple-system, "Segoe UI"; data "JetBrains Mono", ui-monospace, Consolas. Layout must not break if the fallback renders.
- Preload only Inter roman (`<link rel="preload" as="font" type="font/woff2" crossorigin>`); the others load on use.
- Characters outside the latin subset (Japanese or Cyrillic artist names) fall back to the system font. Never replace them with "?".

## User-adjustable text size

- People set text size in `PreferencesPanel` (Settings → Display): Small, Medium (default), Large, Extra large. It sets `data-text-size="s|m|l|xl"` on `html` via `SongNodes.prefs.setTextSize`, scaling `html` font-size to 93.75%, 100%, 112.5%, 125%.
- Every font size is in rem, so everything scales together. Spacing tokens stay in px; containers must grow with text (no fixed heights on text boxes; use `min-height`).
- Layouts must survive Extra large plus browser zoom 200% (WCAG 1.4.4) and reflow at 320 CSS px (1.4.10) without horizontal page scroll.
- Respect WCAG 1.4.12 text spacing: no clipped text when line height is 1.5, paragraph spacing 2×, letter spacing 0.12em, word spacing 0.16em.

## Large-format and distance reading

- Booth theme scales the root to 118.75% (one step up) and 131.25% when combined with Large. Use booth for the DJ booth: low light, a laptop 60–80 cm away, glances between mixes.
- Wall and kiosk (≥ `bp-wall`, 1920px): minimum body text 18px (1.125rem), `FigureTile` values 48px or larger, now-playing title `display-xl`. Use the booth theme.
- In Play mode, the now-playing track and the next recommendation are the two largest text items on screen; nothing else exceeds `title-s`.
- At distance, prefer weight over size changes for emphasis and never rely on `fg-3` for anything that must be read in the booth.

## Graph label typography

- PIXI text in the graph (`GraphVisualization.tsx`) uses Inter, not Arial. Wait for `document.fonts.load('600 12px Inter')` before creating `PIXI.Text`/`BitmapText` styles, and rebuild label textures after `document.fonts.ready` resolves.
- Labels: Inter 600 at 12px × device pixel ratio, colour from `--fg`, read at runtime via `getComputedStyle`.
- Replace the PIXI `dropShadow` with a 3px stroke in `--bg` behind the text: legible halo, no glow.
- Show labels only for the hovered node, its neighbours, the selection and nodes above the zoom threshold; never more than about 60 at once.
- BPM and key in node tooltips use JetBrains Mono, as everywhere else.
