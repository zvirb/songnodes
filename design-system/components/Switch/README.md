# Switch

An on/off control for a setting that takes effect immediately, with the setting stated in the label and its state shown by thumb position and the words On and Off.

## When to use / not use
Use in settings lists where flipping it is the whole action: "Send to TIDAL on the weekly run", "Sprite mode (performance)". If the change needs a Save button, or is part of a form or filter, use a Checkbox.

## Anatomy & markup
```html
<li class="sn-switch">
  <div class="sn-switch__text">
    <span class="sn-switch__label" id="tidal-l">Send to TIDAL on the weekly run</span>
    <span class="sn-switch__desc" id="tidal-d">Each Monday at 06:00 the newest saved set becomes a TIDAL playlist.</span>
    <span class="sn-switch__saved" aria-hidden="true">Saved 21:30</span>
  </div>
  <button type="button" role="switch" class="sn-switch__control" aria-checked="true" aria-labelledby="tidal-l" aria-describedby="tidal-d">
    <span class="sn-switch__state" aria-hidden="true">On</span>
    <span class="sn-switch__track" aria-hidden="true"><span class="sn-switch__thumb"></span></span>
  </button>
</li>
```
Wrap rows in `ul.sn-switch-list` (rows divided by `line`).

## States
Off: `surface-3` track with `line-strong` outline, `fg-2` thumb on the left, "Off". On: `brand` track, `on-brand` thumb on the right, "On". Hover darkens the outline / track. Focus ring around the control. Disabled: `aria-disabled="true"` (stays focusable) with the reason in the description and a lock icon. After a change: "Saved 21:30" under the label and a polite announcement.

## Content rules
The label names the setting, not the action: "Sprite mode (performance)", not "Turn on sprite mode". Descriptions say what changes and when, in Melbourne time ("Each Monday at 06:00"). No "Enable"/"Disable" prefixes.

## Accessibility
`role="switch"` with `aria-checked` (APG switch pattern); Space and Enter toggle. The visible On/Off text is `aria-hidden` because the role already conveys state; the label stays the same in both states. Clicking the label toggles too. The control is 44px tall; the track is 44×24 (52×28 in booth).

## Responsive
Label left, control right at every width; long descriptions wrap under the label.

## Do / don't
- Do apply the change at once and confirm it ("Saved").
- Don't use a switch inside a form that has a Save button.
- Don't colour the track by status (green = on); on is brand.

## In SongNodes / in the music library
Settings in `SettingsPanel.tsx` (performance mode, live updates), service toggles in Services. In the Naarm Set Builder: "Send to TIDAL on the weekly run".
