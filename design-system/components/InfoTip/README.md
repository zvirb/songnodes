# InfoTip

An info button that holds the words of a notice that only explains: the text moves, unchanged, into a tooltip (40 words or fewer) or a small panel (more), and the page keeps one quiet `info` icon where the text was.

Added in 1.6.0, imported from BeanAlliance `InfoTip` (v4.18, rules confirmed and two changed by Markus on 1 Nov 2026 in v4.19.1: every field hint is an InfoTip, and a caveat on a figure may be one). Fitted to SongNodes: Lucide `info`, the existing `Tooltip` and `Popover` looks, the 768px phone breakpoint, and the `SongNodes.infoTip` / `SongNodes.infoTips` helpers instead of a pasted script.

**Consumer provides:** the words (copied verbatim from the notice they replace), the subject for the button's name ("About the energy tiers"), and a unique `id` for the tip.

## When to use

An InfoTip is for text a person reads once and then knows: it explains, it does not report. Move a notice into an InfoTip when it is one of these:

| Notice today | Becomes |
|---|---|
| A page subtitle or lede longer than one line | A one-line subtitle (or none) plus an InfoTip after the page title |
| A `SectionHeading` caveat that says how a figure is always worked out, what a column means, or where data comes from ("Energy is Mixed In Key's 1–10 scale") | An InfoTip after the section title or the column header it explains |
| Any field help (`.sn-field__help`), however short | An InfoTip after the field's label; no help text stays under a field |
| A caveat on a figure, including one about today ("Plays from 3RRR are a day behind this week") | An InfoTip after the figure's label. If the person must act on it, it is a warn `Banner` or `InlineMessage` with its source link instead |
| A "How the set is built" or "How confidence is scored" block shown open | The panel form, after the heading of the chart or table it serves |
| An `EmptyState` with step-by-step instructions | **Partial:** the one-line fact and its button stay; only the steps move into the InfoTip |
| A free-standing sentence of instruction ("Drag a crate track onto a slot to swap it in") | An InfoTip after the heading of the list it instructs |

**Never an InfoTip** (these stay as text):

- A warn or bad `Banner`, an `InlineMessage` with warn or bad, anything with `role="alert"`, an `ErrorState`, a stalled `StagedProgress` step: the person must see it without asking.
- A page-wide `Banner` that says something is in force now ("Sets are shaped on energy alone").
- A `Toast`, a chart legend or key (colour is never the only cue), a `StatusPill`, a `FreshnessStamp`, a count, a `CompatibilityBadge` word.
- A one-line subtitle, the loading skeleton, a field error (`.sn-field__error`).
- A *Connect Spotify* or *Choose folder* prompt that is the page's only action.
- Text already inside a closed `Disclosure` ("Technical details"): it is disclosed already; do not add a second layer.
- Anything a person must read to avoid a mistake in the booth: a locked slot's reason, a clash warning on a transition, "This deletes the set for everyone".

## Format: the two forms

**Tooltip form (40 words or fewer).**

```html
<span class="sn-infotip"><button type="button" class="sn-infotip__btn" aria-label="About the energy tiers" aria-expanded="false" aria-controls="tip-tiers" aria-describedby="tip-tiers"><svg class="sn-icon">…info…</svg></button><span class="sn-tooltip sn-infotip__tip" id="tip-tiers" role="tooltip" hidden>Low is 1–4, building 5–7, high 8–10, on Mixed In Key's scale.</span></span>
```

- Button: `.sn-infotip__btn`, a 24px square (`space-6`, the WCAG 2.5.8 minimum; 44px hit area on touch, DR-054) with the 16px Lucide `info`, `fg-2` and no border at rest; on hover or open it takes `surface-1`, a `line-strong` edge and `fg`. Its name is "About" + the subject; it has **no `title`** (a native tooltip would show a second tip).
- Tip: the system's `Tooltip` look (`fg` ground, `bg` text, `radius-chip`, `shadow-2`, `z-tooltip`), at most 16rem wide, under the button and left-aligned to it; it flips above or right-aligned when it would leave the viewport.
- Opens after **500 ms of mouse hover**, the same as `Tooltip`, so a pointer sweeping across a row of labels does not flash tips (DR-055, 1.7.1); a pointer that leaves sooner opens nothing. **Keyboard focus** and a **tap or click** open it at once. Hover and focus keep it open until the pointer or focus leaves (300 ms grace so the pointer can cross onto it); a tap or click pins it until a second tap, a tap outside or Escape. One InfoTip open per page.
- Plain text only: no links, buttons or fields inside a tooltip.

**Panel form (more than 40 words, or a list).**

```html
<span class="sn-infotip"><button type="button" class="sn-infotip__btn" aria-label="How the set is built" aria-expanded="false" aria-controls="tip-build" aria-haspopup="dialog">…info…</button><span class="sn-popover sn-infotip__panel" id="tip-build" role="dialog" aria-label="How the set is built" hidden><span class="sn-popover__head"><b class="sn-popover__title">How the set is built</b><button type="button" class="sn-btn sn-btn--sm sn-btn--icon sn-btn--quiet sn-infotip__close" aria-label="Close">…x…</button></span><ol><li>…</li></ol></span></span>
```

- The `Popover` look (`surface-1`, `line`, `radius-card`, `shadow-2`, `z-popover`), at most 24rem wide, scrolls inside after 60% of the screen height. Its head is the words the old block was titled by (or "About …"), with an `x` Close button.
- Opens on click, tap, Enter or Space only, **never on hover** (a large panel under a passing pointer is movement the person did not ask for, 08-motion). Focus goes to Close; Escape, Close or a click outside closes it and focus returns to the button. It may hold a list, mono file names and links.

**Phones and tablets (under 768px).** No hover, so a tap opens either form, drawn fixed at the bottom of the screen, full width inside the 16px gutter and above the safe-area inset, where a `Toast` sits, so it is never clipped by a narrow column.

**Print.** Buttons and tips never print. A `PrintSheet` carries the words it needs as words.

## Where it goes

- **After the words it explains, on their line:** after the page title for a lede, after a `SectionHeading` title for a note or how-to, after a field's label for its help, after a `FigureTile` label for its method, after a column header's text for a column note. Gap `space-1`.
- Never inside a `button`, a link, a `summary` or a `label` element (nested controls): put it straight after.
- At most one InfoTip per heading, label or item. Two notices about one thing join in one tip, in their original order.
- The button never changes a row's height: 24px, on the text's centre line.

## Words

- Move the words **verbatim** from the notice it replaces: no rewriting, shortening or new wording. en-AU spelling and sentence case still apply.
- A path printed in the notice comes out entirely (01-writing: a page never prints a file or folder location).
- The button's name names the subject, not the icon: "About the energy tiers", "How the set is built", "About this field". Never "Info" or "Help" alone.

## Behaviour

Call `SongNodes.infoTips()` once per page (it installs one set of document-level listeners and is safe to call again, so tips added later work too). `SongNodes.infoTip({ id, about, text })` or `SongNodes.infoTip({ id, about, panel: { title, html } })` returns the markup. In the React app, `InfoTip` renders the same markup and the shell calls `infoTips()` once.

## Accessibility

- WCAG 1.4.13: the tip is dismissable (Escape), hoverable (the pointer can move onto it) and persistent (it stays until the pointer or focus leaves, or it is closed).
- The tooltip form's words reach a screen reader through `aria-describedby` whenever the button has focus, open or not; the panel is a `role="dialog"` named by its head.
- Contrast: the button is `fg-2` at rest (4.5:1 on `bg`, `surface-1` and `surface-2`), `fg` when open; the tip text holds 4.5:1 in every theme.

## Migrating a page

1. List the page's notices (subtitles, `SectionHeading` caveats, `.sn-field__help`, method `Disclosure`s shown open, `EmptyState` steps) and give each a verdict from the tables above: Move, Partial, Keep.
2. Change the source component, never a built page; shared text is changed once where it is defined.
3. For each Move: the button where the text was, the words into the tip (panel form over 40 words), the visible text removed. Partial keeps its one-line fact.
4. Check two ways: the words in each tip equal the old text; in Chromium at 1440 and 390px, dark, light and booth, the tip opens on hover, on Tab focus and on a tap, Escape closes it, nothing is clipped, and axe shows no new violations.

## In SongNodes

`SettingsPanel.tsx` and `APIKeyManager.tsx` field help, the "How the set is built" block in `PathBuilder.tsx`, the energy-scale caveat on `StatsPanel.tsx`, onboarding sentences in `OnboardingOverlay.tsx` that only explain.

## In the music library

The set-control field help (length, pool), the "How rotation is worked out" note, the energy-tier explanation over the crate.
