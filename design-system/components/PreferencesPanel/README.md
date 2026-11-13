# PreferencesPanel

Per-device display preferences, applied live as you choose: theme (System, Dark, Light, Booth), text size, row density and reduce motion.

## When to use
- Opened from the drawer footer ("Preferences") or Services › Preferences. One panel; never scatter these settings elsewhere.
- Not for account or service settings (Spotify, TIDAL, API keys live in Services).

## Anatomy and markup
Panel (`radius-sheet`, `shadow-2`) → head → four sets → footer ("Saved on this device only", Reset to defaults).
```html
<section class="sn-preferences-panel" aria-labelledby="pp-title">
  <div class="sn-preferences-panel__head"><h2 class="sn-title title-m" id="pp-title">Preferences</h2>…x…</div>
  <div class="sn-preferences-panel__body">
    <div class="sn-preferences-panel__set"><span class="sn-field__label" id="lbl-theme">Theme</span>
      <div class="sn-preferences-panel__themes" role="radiogroup" aria-labelledby="lbl-theme">
        <button class="sn-preferences-panel__theme" role="radio" aria-checked="true" data-value="system">…monitor… <span>System</span><span class="sn-preferences-panel__check" aria-hidden="true">✓</span></button>
        …Dark (moon), Light (sun), Booth (headphones)…</div></div>
    <!-- Text size: SegmentedControl --block S/M/L/XL; Row density: --block Comfortable/Compact -->
    <fieldset class="sn-preferences-panel__set"><legend>Reduce motion</legend>…two sn-check radios…</fieldset>
  </div>
  <div class="sn-preferences-panel__foot"><span>Saved on this device only</span><button class="sn-btn sn-btn--quiet sn-btn--sm">Reset to defaults</button></div>
</section>
```

## Behaviour
- Theme → `SongNodes.prefs.setTheme("system"|"dark"|"light"|"booth")`. System follows the OS.
- Text size → `prefs.setTextSize("s"|"m"|"l"|"xl")` (scales `html` font-size; booth adds its own step).
- Density → `prefs.setDensity("comfortable"|"compact")` (40px or 32px rows).
- Reduce motion → `prefs.setMotion("reduce"|"system")` (`html[data-motion="reduce"]`, stored as `sn-motion`); "Follow this device's setting" removes it.
- **When browser storage refuses the write** (a private window, blocked site data, a full quota) the choice still takes effect for this visit: `prefs` keeps the value in memory, reads it before storage until the page is closed, and logs the refusal once for each setting at warn (`SongNodes.diag.warn("storage", …)` when Diagnostics is on the page, `console.warn` otherwise). The next visit opens on the defaults. The panel never reads or writes storage itself, and it shows no banner or toast for this: the footer line reads "Kept for this visit only" instead of "Saved on this device only" (`prefs.keptForVisit()` lists the settings held in memory). A later write that storage accepts clears the memory copy. Dismissed warnings (`SongNodes.dismissal`) follow the same rule.
- Everything applies on choice and is announced ("Theme set to Light"); there is no Save button.

## States
Selected theme tile: `brand-soft` fill, `brand` border and a ✓ (not colour alone). Reset returns to System, M, Comfortable, follow device.

## Content rules
Option names as listed; help lines explain the effect in numbers ("32px rows instead of 40px"). Booth help says who it is for.

## Accessibility
Theme, text size and density are radio groups with arrow-key selection; reduce motion uses native radios in a fieldset. Each change is announced in a status message. Text size options have full names ("Extra large") as accessible names.

## Responsive
Panel width `min(440px, 100%)`; on phones it fills the screen as a sheet. Theme tiles stay 4-up down to 320px.

## Do / don't
- Do apply `prefs.init()` inline in `<head>` so the stored theme shows before first paint. `init()` only reads: it never writes a setting back, so opening a page logs no refusal nobody caused.
- Don't wrap a setting in a `try`/`catch` of your own or re-read storage after a change: that is how a refused theme choice used to snap back.
- Don't sync these to the account; they are per device on purpose (a booth laptop differs from a phone).

## In SongNodes
Replaces the theme toggle and display options in `SettingsPanel.tsx`; connection and API-key parts of that panel move to Services.

## In the music library
Same panel; compact density suits the crate table on a laptop.

## Differs from beanAlliance
- beanAlliance keeps a refused Theme and Reduce motion choice for the visit inside its Menu's View group; SongNodes has no Menu, so the rule sits in `SongNodes.prefs` and covers all four settings (theme with booth, text size, density, motion) and dismissed warnings.
- The footer line changes its words when a setting is held for the visit only; beanAlliance says nothing on the page.
