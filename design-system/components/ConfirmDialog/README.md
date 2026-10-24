# ConfirmDialog

Confirms a destructive action by naming the object, the consequence and who it affects, with a danger button labelled verb + object and Cancel focused by default; includes the typed high-stakes variant and the non-modal armed button for low-stakes resets.

## Which pattern
| Situation | Use |
|---|---|
| Reversible, or Undo is cheap (remove a slot, archive a target track) | **No confirmation.** Do it and offer Undo in a Toast |
| Low stakes, local, nothing saved is lost (clear the current draft, reset filters, reset cues) | **Armed button**: first press arms for 3 s ("Clear the current draft?"), second press acts |
| Destroys saved data (delete a set, delete an API key, disconnect TIDAL) | **ConfirmDialog** |
| Irreversible **and** shared, scheduled or large (a set shared with others or on the weekly TIDAL run, all target tracks, saved credentials) | **ConfirmDialog with typing**: type the set name to enable the danger button |
Confirm rarely: if people see it every day they stop reading it.

## Anatomy
```html
<dialog class="sn-dialog sn-dialog--s sn-confirm-dialog" role="alertdialog" aria-labelledby="t" aria-describedby="d">
  <div class="sn-dialog__head"><span class="sn-confirm-dialog__icon">…trash-2…</span>
    <h2 class="sn-title title-s sn-dialog__title" id="t">Delete “Peak time Friday”?</h2></div>
  <div class="sn-dialog__body" id="d">
    <p class="sn-confirm-dialog__text">This removes the set … <strong>for everyone it’s shared with</strong>…</p>
    <ul class="sn-confirm-dialog__facts"><li>The 18 tracks stay in the library.</li></ul>
    <!-- typed: <div class="sn-field sn-confirm-dialog__typed"><label>Type the set name, …, to confirm</label><input class="sn-input"></div> -->
  </div>
  <div class="sn-dialog__foot"><button class="sn-btn" autofocus>Cancel</button><button class="sn-btn sn-btn--danger">Delete set</button></div>
</dialog>
```
Armed: `<button class="sn-btn sn-confirm-dialog__armed" data-armed>` with a 3 s fuse line along the bottom.

## Content rules
- Title is the question with the object in curly quotes: "Delete “Peak time Friday”?".
- Body: consequence, who it affects, what is kept, whether it can be undone. "This removes the set for everyone. Tracks stay in the library."
- Danger button = verb + object ("Delete set", "Disconnect TIDAL"), never "OK" or "Yes". Cancel is always "Cancel".
- Typed variant: the exact name, case-sensitive, shown in mono in the label.

## Accessibility (APG alertdialog)
- `role="alertdialog"`, `aria-modal`, `aria-labelledby` the title, `aria-describedby` the body.
- Initial focus on **Cancel** (the least destructive action); in the typed variant on the input. Esc = Cancel. Focus returns to the opener.
- The disabled danger button in the typed variant stays visible; the label says what unlocks it.
- Armed button: announces "Press again within 3 seconds to clear the draft" in a polite live region; it disarms on blur or after 3 s. Reduced motion: no fuse animation, the label still changes.

## Responsive
Always the S size, centred, also on phones (not full screen). Buttons wrap with Cancel first.

## Do / don't
- Do confirm after the person chose the action, never before showing what will be deleted.
- Don't make the danger button the default focus or the primary (brand) colour.

## In SongNodes
Replaces every `window.confirm` "Are you sure…" in ArtistAttributionManager, TargetTracksManager (single and bulk delete), APIKeyManager, SettingsPanel (clear saved credentials → typed) and DJInterface.

## In the music library
Delete a saved set (dialog), delete a shared or scheduled set (typed), "New empty set" while a draft has unsaved changes (armed "Clear the current draft?").
