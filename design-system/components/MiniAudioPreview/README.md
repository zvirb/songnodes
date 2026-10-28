# MiniAudioPreview

A 32px inline player for a track's preview clip: one play/pause button, a thin progress line and the time in mono, with only one preview playing anywhere in the app.

## When to use / not use
Use in a crate row, a set slot, a suggestion card or a transition note, where people audition a track without leaving the list. Don't use for full playback or analysis (the now-playing deck and WaveformStrip), or when there is no clip at all for a whole list (say so once above the list instead of a column of unavailable players).

## Anatomy & markup
```html
<div class="sn-mini-preview" data-state="playing" style="--sn-mini-preview-pct: 40%">
  <button class="sn-mini-preview__btn" type="button" aria-pressed="true" aria-label="Pause preview of Bicep – Glue">
    <svg class="sn-icon">pause</svg>
  </button>
  <span class="sn-mini-preview__track" aria-hidden="true"><span class="sn-mini-preview__fill"></span></span>
  <span class="sn-mini-preview__time">0:12 / 0:30</span>
</div>
```
`--sn-mini-preview-pct` sets the fill. States are `data-state="paused|loading|playing|unavailable"`.

## States
- Paused (default): play icon, outline button, time "0:00 / 0:30".
- Loading: the button shows `sn-spinner` and has `aria-busy="true"`; still operable (a second press cancels).
- Playing: pause icon on a `fg` button (the same filled treatment as a pressed chip, so it doesn't rely on colour), `fg` fill.
- Unavailable: no clip or it failed to load. Dashed disabled button, the progress line is hidden and the time reads "No preview" in `fg-3`. It never disappears, so rows keep their layout.
- Ended: back to paused at 0:00.

## Behaviour
- One preview at a time across the app: starting one pauses any other (a shared audio manager).
- Press to play, press again to pause; it resumes where it stopped while the component stays mounted. Unmounting stops and releases the audio.
- In a DataTable with keyboard navigation, Space plays or pauses the active row's preview.
- Nothing autoplays. Respect the person's volume; no fades longer than `duration-fast`.

## Content rules
Button names say the action and the track: "Play preview of Bicep – Glue", "Pause preview of …". Time is `SN.format.duration` style "m:ss / m:ss". Unavailable reads "No preview", never "N/A".

## Accessibility
A real button with `aria-pressed` and a full name; the progress line is decorative (`aria-hidden`) because the time text carries it. The button is 32px (44px on touch). Loading sets `aria-busy`. A failure is not announced; the state change and the disabled button carry it.

## Responsive
Inline and shrinkable: the progress line flexes between 40px and 160px; in tight cells it can be hidden by the container while the button and time stay.

## In SongNodes / in the music library
Built in React as `components/ds/MiniAudioPreview.tsx` (FL4). Replaces the ad-hoc preview button in `NowPlayingDeck.tsx` where a small player is needed, and is the Space action of crate keyboard navigation (FL1).
