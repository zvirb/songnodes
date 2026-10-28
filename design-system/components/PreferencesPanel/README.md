# PreferencesPanel

Per-device display preferences, applied live as you choose: theme (System, Dark, Light, Booth), text size, row density and reduce motion.

## When to use
- Opened from the drawer footer ("Preferences") or Services › Preferences. One panel; never scatter these settings elsewhere.
- Not for account or service settings (Spotify, TIDAL, API keys live in Services).

## Anatomy and markup
Panel (`radius-sheet`, `shadow-2`) → head → four sets → footer ("Saved on this device only", Reset to defaults).
```html
<section class="sn-preferences-panel" aria-labelledby="pp-title">
  <div class="sn-preferences-panel__head"><h2 class="sn-title title-m" id="pp-title">Preferences</h2>…close…</div>
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
- Reduce motion → `html[data-motion="reduce"]`, stored as `sn-motion`; "Follow this device's setting" removes it. Not in `prefs` yet (see below).
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
- Do apply `prefs.init()` inline in `<head>` so the stored theme shows before first paint.
- Don't sync these to the account; they are per device on purpose (a booth laptop differs from a phone).

## In SongNodes
Replaces the theme toggle and display options in `SettingsPanel.tsx`; connection and API-key parts of that panel move to Services.

## In the music library
Same panel; compact density suits the crate table on a laptop.
