# ShortcutSheet

The single keyboard-shortcut help surface, opened with ?, listing every shortcut by where it works, as key-cap tables.

## When to use
- Opened with ?, from the drawer's "Keyboard shortcuts" row, or from More actions. It is the only place shortcuts are documented in the UI.
- Not for teaching workflows (onboarding) and not for per-button hints (use `aria-keyshortcuts` and tooltips).

## Anatomy and markup
Modal sheet (`radius-sheet`, `shadow-3`) → head with title and close → grid of tables → removed-conflicts note.
```html
<div class="sn-shortcut-sheet__scrim">
  <div class="sn-shortcut-sheet" role="dialog" aria-modal="true" aria-labelledby="ks-title" tabindex="-1">
    <div class="sn-shortcut-sheet__head"><h2 class="sn-title title-m" id="ks-title">Keyboard shortcuts</h2><button class="sn-btn sn-btn--quiet sn-btn--icon" aria-label="Close keyboard shortcuts">…</button></div>
    <div class="sn-shortcut-sheet__body">
      <table class="sn-shortcut-sheet__table"><caption>Graph<small>When the graph canvas has focus</small></caption><tbody>
        <tr><th scope="row"><kbd>Space</kbd></th><td>Pause or resume the layout</td></tr>
        <tr><th scope="row"><kbd>G</kbd><span class="sn-shortcut-sheet__then">then</span><kbd>L</kbd></th><td>Go to Library</td></tr>
      </tbody></table>
      <section class="sn-shortcut-sheet__removed">…</section>
    </div></div></div>
```

## The shortcut set
- **Everywhere**: Ctrl/⌘ K or / quick search · ? this list · [ ] previous/next period · G then L / S / G go to Library / Set builder / Graph · Esc close the top-most layer.
- **Graph** (canvas focused): Space pause/resume · arrows pan · + / − zoom · F fit · Esc clear selection · Tab / Shift+Tab cycle selected tracks · Enter track info · Shift+F10 context menu.
- **Set builder** (slot focused): L lock/unlock · Alt+↑ / Alt+↓ move slot · Ctrl/⌘ Z undo · Ctrl/⌘ Shift Z redo.
- **Data-quality review**: A approve · R reject · S skip.

## Conflicts removed (accepted)
Markus accepted every removal below; the list stays as the record of what changed.
Ctrl+F, Ctrl+R and Ctrl+P go back to the browser (find, reload, print). Number keys 1–4, Alt/⌘ 1–5 (⌘1–5 also switches browser tabs) → G sequences. Ctrl+B sidebar → drawer. H and Ctrl+/ help → ?. Space in lists (review skip, recommendation pick) → S; Space only pauses the graph. Shift+Delete clear setlist (no confirmation) → menu item with confirmation. Ctrl+Shift+3 3D toggle (macOS screenshot) → removed with the retired 3D graph. D debug → development builds only.

## States
Open on ? when focus is not in a text field. Esc, close button or scrim click closes and returns focus to the opener. On Apple devices Ctrl is shown as ⌘.

## Content rules
Action column: verb phrase, sentence case ("Fit the graph to the screen"). Captions say where the keys work. Use "or" between alternatives and "then" in sequences; key caps use the key's printed name.

## Accessibility
Modal dialog labelled by its title; focus moves to the sheet. One real table per scope with a caption; key cells are row headers so each action is read with its keys.

## Responsive
Two columns from ~720px, one column on phones; the sheet scrolls inside the scrim. Wall: max 860px wide.

## Do / don't
- Do add any new shortcut here first, and check it against the browser and screen-reader keys.
- Don't use single-letter shortcuts outside a focused scope, except the Everywhere set.

## In SongNodes
Replaces the console-only help on H in `GraphVisualization.tsx`, the Ctrl+/ help in `SetlistBuilder/index.tsx` and the per-panel shortcut tooltips.

## In the music library
Set builder slot keys (L, Alt+↑/↓) and [ ] for the weekly view.
