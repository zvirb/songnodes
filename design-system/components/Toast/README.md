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

## Raising a toast: `SongNodes.toast`
A page raises its toasts with the helper and never builds the markup, adds a button of its own to a toast, or wraps the call to add a role (1.14.0).

```js
SongNodes.toast.mount();                       // once at start: the empty role="status" region
SongNodes.toast("Set saved");
SongNodes.toast({ html: 'Added to <q>Peak time Friday</q>', action: "Undo", onAction: function () { removeFromSet(id); } });
```

| Option | Meaning |
|---|---|
| `text` or `html` | The words. `text` is escaped; `html` is for a quoted name in `<q>`. |
| `action`, `onAction` | The one action's word and its handler. An action with no handler is not drawn. |
| `ms` | Visible time, when the default does not fit (`SongNodes.toast.DEFAULT_MS`: 4 s, 8 s with an action). |

It returns `{ dismiss(), closed }`; `closed` resolves with `"timeout"`, `"dismiss"`, `"action"` or `"dropped"` once the toast has left, which is the Undo window a `LiveChange` removal waits for. There is no `role`, `kind` or status option: a toast is a confirmation, so a call that asks for a warning or an alert is logged at warn and drawn as a confirmation.

## Behaviour
- **One visible**; others queue (max 3 waiting, oldest dropped). The visible toast shows "+2 more" instead of stacking.
- **At most one action**, one small button (`sn-btn sn-btn--sm sn-toast__action`) placed straight before the dismiss button. Pressing it calls the handler once and closes the toast; when the handler returns `false` (the action could not start) the toast and its button stay.
- **Wraps only when it must:** the sentence keeps its first line beside the check icon and wraps inside itself; a short toast stays on one line; the action and the dismiss button that do not fit take the next line, end-aligned, and a button never wraps inside itself.
- 4 s visible; 8 s with an action. Timer **pauses on hover and keyboard focus**, resumes on leave.
- Position: bottom centre; bottom right from `bp-desktop` (1,100 px). 24px from the edge, above the bottom sheet if one is open.
- Enter: 8px rise + fade in `duration-base`; exit fade in `duration-fast`. Reduced motion: no movement.

## Content rules
Past tense, object named: "Set saved", "Tracklist copied: 18 tracks", "Added to “Peak time Friday”". One action, one word if possible ("Undo"). No icons other than the check, no emoji, no exclamation marks.

## Accessibility
- Every toast is announced as `role="status"` (polite) by the one region it is drawn in; no toast and no toast region is ever `role="alert"` (`linters/check.py` FBK-TOASTALERT). A failure the person must act on is not a toast.
- A toast never takes focus. The action is reached by Tab and pressed with Enter or Space.
- The action must also be available another way (Ctrl/Cmd+Z, set history) because the toast times out (WCAG 2.2.1).
- Esc dismisses when focus is inside the toast; focus returns to where it was if the toast disappears while focused.

## Responsive
Phones: full width minus 16px gutters, bottom centre. Desktop and wall: bottom right, max 30rem.

## Do / don't
- Do use for quick, low-stakes confirmations.
- Don't use for progress (StagedProgress) or for warnings.
- Don't write a rule for a button inside `.sn-toast`, and don't add a second action: a second thing to do belongs on the page.

## In SongNodes
Replaces the Sonner-based `ui/Toast.tsx` and `useToast` usage: success/info stay as toasts; `toast.error` / `showError` calls ("Failed to export setlist", "Cannot save an empty setlist") move to ErrorState or InlineMessage.

## In the music library
"Set saved", "Tracklist copied", "Added to “Peak time Friday”" with Undo, "Sent to TIDAL on the weekly run".

## Differs from beanAlliance
- beanAlliance toasts can be warnings and failures with Try again and `role="alert"`; SongNodes toasts are confirmations only, so there is no alert toast, no Try again action and no state colours. The only action is Undo (or one other word).
- The role sits on the one region (mounted empty at start), not on each toast, so a screen reader hears each toast once.
- The Undo button is words only; beanAlliance puts an icon in it. SongNodes keeps the check as the toast's only icon.
- One toast is visible and the rest queue with "+2 more"; beanAlliance stacks them.
- Times stay SongNodes' own: 4 s, 8 s with an action.
