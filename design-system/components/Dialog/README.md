# Dialog

A modal dialog for a focused task that must be finished or cancelled before going back to the page, such as editing a track's cues and transitions.

## When to use
- Short, self-contained edits or decisions: "Edit cues: Bicep – Glue", connect a service, export options.
- Not for details people browse while working (SideSheet), small pick-lists (Popover), destructive confirmation (ConfirmDialog), or long multi-page flows (a page).

## Anatomy
```html
<dialog class="sn-dialog sn-dialog--m" aria-labelledby="t">
  <div class="sn-dialog__head">
    <div class="sn-dialog__title"><h2 class="sn-title title-s" id="t"><span class="sn-lead">Edit cues:</span> Bicep – Glue</h2>
      <p class="sn-dialog__sub">Slot 7 of 18 in “Peak time Friday”</p></div>
    <button class="sn-btn sn-btn--icon sn-btn--quiet" aria-label="Close">…x…</button>
  </div>
  <form class="sn-dialog__body" method="dialog" id="f">…fields…</form>
  <div class="sn-dialog__foot">
    <button class="sn-btn sn-btn--quiet sn-dialog__foot-start">Reset cues</button>
    <button class="sn-btn">Cancel</button><button class="sn-btn sn-btn--primary" form="f">Save changes</button>
  </div>
</dialog>
```
`radius-sheet` (18px), `shadow-3`, `::backdrop` = `overlay`. `sn-dialog__stage` is a contained scrim for documentation and in-panel previews only.

## Sizes
`sn-dialog--s` 400px (confirmations, one field) · `--m` 600px (default, forms) · `--l` 800px (tables, previews). Max height 85vh; the body scrolls, head and foot stay.

## States
Opening: fade + 8px rise in `duration-base`. Busy save: primary gets `aria-busy` and "Saving…"; fields stay editable. Errors: InlineMessage under the field, focus the first invalid field.

## Content rules
Thin–bold title naming the object. Footer: Cancel, then the primary, right-aligned; the primary repeats the verb of the title ("Save changes"). Values in mono: "0:32", "130 → 132 BPM (+1.5%)", "5A → 12A".

## Accessibility (WAI-ARIA APG dialog modal)
- Native `<dialog>` + `showModal()`: page outside becomes inert (focus trap), Esc closes, `aria-modal` implied. Name via `aria-labelledby` the title.
- Initial focus: the first field (`autofocus`); for read-only content, the title (`tabindex="-1"`).
- On close, focus returns to the control that opened it.
- Clicking the scrim does not close a dialog with unsaved edits.

## Responsive
Decided: M and L become a full-screen sheet on phones, below 480px (no radius, `100dvh`, footer buttons share the width). S (confirmations, one field) stays a centred card on phones. Booth: `shadow-3` becomes a 2px white outline.

## Do / don't
- Do keep one primary per dialog.
- Don't open a dialog from a dialog; use a step inside it.

## In SongNodes
Replaces `ui/Modal.tsx` usage in TrackDetailsModal, EditTrackModal / TrackEditModal, EdgeDetailsModal (or SideSheet when browsing), SettingsPanel and APIKeyManager, ArtistAttributionManager's edit forms, TracklistImporter.

## In the music library
"Edit cues & transitions" from a running-order row (key shift, tempo change, mix cue in/out), Save set as, export options.
