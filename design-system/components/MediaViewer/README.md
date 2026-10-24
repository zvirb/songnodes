# MediaViewer

A full-screen viewer for artwork, photos and track waveforms with zoom and pan, caption with source and alt text, previous/next, and close.

## When to use
- Looking closely at one image or waveform: cover art from Beatport/TIDAL, radio show photos, the audio-analysis waveform with mix cues.
- Not for thumbnails in lists (show them inline) or interactive waveform editing (that is a set-builder tool).

## Anatomy
```html
<div class="sn-media-viewer" role="dialog" aria-modal="true" aria-labelledby="mv-name" tabindex="-1">
  <div class="sn-media-viewer__bar">
    <span class="sn-media-viewer__name" id="mv-name">Bicep – Glue · cover</span>
    <span class="sn-media-viewer__count" aria-live="polite">1 of 3</span>
    <div class="sn-media-viewer__tools">zoom out · <span class="sn-media-viewer__zoom">100%</span> · zoom in · fit · close</div>
  </div>
  <div class="sn-media-viewer__stage">
    <button class="sn-btn sn-btn--icon sn-media-viewer__nav sn-media-viewer__nav--prev" aria-label="Previous">…</button>
    <img class="sn-media-viewer__media" alt="Horizontal bands of indigo fading to amber…">
    <button class="… sn-media-viewer__nav--next" aria-label="Next">…</button>
  </div>
  <div class="sn-media-viewer__caption">
    <span class="sn-media-viewer__title">Bicep – Glue (cover art)</span>
    <span>Source: Beatport · 1,400 × 1,400</span>
    <span class="sn-media-viewer__alt"><b>Alt text:</b> Horizontal bands of indigo fading to amber…</span>
  </div>
</div>
```
`sn-media-viewer--contained` renders it inside a page block (documentation, embedded previews). Zoom/pan are CSS variables `--z`, `--x`, `--y` on `__media`.

## Behaviour
- Zoom 100–400% in 50% steps (buttons, + / −, double-click); 0 or "Fit" resets. Drag to pan when zoomed (`data-zoomed` / `data-panning` on the stage).
- ← → move between items at 100%; when zoomed they pan (↑ ↓ too). Esc closes.
- Waveforms show mix cues as `--now` lines with mono labels ("cue in 0:32").

## Content rules
Caption: title with what it is ("(cover art)", "(waveform, 6:12)"), source as the source names itself with date or size, alt text always shown. Counts "2 of 3". Times and sizes mono.

## Accessibility
- Modal dialog: focus moves to Close on open, Tab is trapped, Esc closes and focus returns to the thumbnail.
- Every item has alt text used as its accessible name and printed in the caption; describe waveforms in words (intro, builds, breakdown, cues).
- Prev/next and zoom buttons have names; the count is a polite live region so paging is announced.

## Responsive
Phones: prev/next move to the bottom corners, stage padding shrinks, pinch-zoom maps to the same zoom state. Wall: caption stays readable at booth sizes.

## Do / don't
- Do keep the theme's surfaces (dark/light/booth); the image is the only colour.
- Don't autoplay audio or hide the caption.

## In SongNodes
New: track details artwork, audio analysis waveform (intro/outro, breakdowns, vocal segments, cue points) from the analysis panel, source thumbnails (SoundCloud/YouTube/Discogs artwork).

## In the music library
Cover art from the crate's TIDAL/Deezer/Beatport links and radio show images in "Heard on".
