# Toast

A brief, transient confirmation that an action finished ("Set saved"), with at most one action such as Undo.

## When to use
- Confirming a completed action whose result is not otherwise visible: "Set saved", "Tracklist copied: 18 tracks", "Added to “Peak time Friday”" with Undo, "Weekly build finished".
- **Never for errors that need action** (use ErrorState, Banner or InlineMessage), never for anything the person must read to continue.

## Anatomy
```html
<div class="sn-toast__region" role="status" aria-live="polite" aria-label="Notifications">
  <div class="sn-toast">
    <span class="sn-toast__icon">…circle-check…</span>
    <span class="sn-toast__text">Added to <q>Peak time Friday</q></span>
    <span class="sn-toast__queue">+2 more</span>
    <button class="sn-btn sn-btn--sm sn-toast__action">Undo</button>
    <button class="sn-btn sn-btn--sm sn-btn--icon sn-btn--quiet sn-toast__close" aria-label="Dismiss notification">…x…</button>
  </div>
</div>
```
One region per app, mounted at start (an empty live region must exist before text is added). `surface-3` fill, `line-strong` border, `shadow-2`, `radius-control`.

## Behaviour
- **One visible**; others queue (max 3 waiting, oldest dropped). The visible toast shows "+2 more" instead of stacking.
- 4 s visible; 8 s with an action. Timer **pauses on hover and keyboard focus**, resumes on leave.
- Position: bottom centre; bottom right from `bp-desktop` (1,100 px). 24px from the edge, above the bottom sheet if one is open.
- Enter: 8px rise + fade in `duration-base`; exit fade in `duration-fast`. Reduced motion: no movement.

## Content rules
Past tense, object named: "Set saved", "Tracklist copied: 18 tracks", "Added to “Peak time Friday”". One action, one word if possible ("Undo"). No icons other than the check, no emoji, no exclamation marks.

## Accessibility
- `role="status"` (polite) on the region; never `alert`.
- The action must also be available another way (Ctrl/Cmd+Z, set history) because the toast times out (WCAG 2.2.1).
- Esc dismisses when focus is inside the toast; focus returns to where it was if the toast disappears while focused.

## Responsive
Phones: full width minus 16px gutters, bottom centre. Desktop and wall: bottom right, max 30rem.

## Do / don't
- Do use for quick, low-stakes confirmations.
- Don't use for progress (StagedProgress) or for warnings.

## In SongNodes
Replaces the Sonner-based `ui/Toast.tsx` and `useToast` usage: success/info stay as toasts; `toast.error` / `showError` calls ("Failed to export setlist", "Cannot save an empty setlist") move to ErrorState or InlineMessage.

## In the music library
"Set saved", "Tracklist copied", "Added to “Peak time Friday”" with Undo, "Sent to TIDAL on the weekly run".
