# EmptyState

Fills a panel that has nothing to show yet, says what will appear there and why it is empty, and offers the one action that fills it; a panel is never blank.

## When to use
- A list, table, graph or tab with zero items: first use, filters that match nothing, a service not connected, a queue that is done.
- Not for loading (use LoadingState) or failures (use ErrorState). Not for a single empty cell: use an en dash in `sn-none`.

## Anatomy
```html
<div class="sn-empty-state">
  <div class="sn-empty-state__icon"><svg class="sn-icon">…list-music…</svg></div>
  <h3 class="sn-empty-state__title">No sets yet</h3>
  <p class="sn-empty-state__text">Sets you build from the crate land here with their energy wave and running order.</p>
  <div class="sn-empty-state__meta">…optional tags, e.g. active filters…</div>
  <div class="sn-empty-state__actions"><button class="sn-btn sn-btn--primary sn-btn--lg">Build set</button></div>
</div>
```
Icon: one Lucide icon at 24px in a `surface-2` circle, coloured `fg-3` (muted). Never an emoji or illustration.

## Variants
| Case | Title pattern | Action |
|---|---|---|
| First use | "No sets yet" | The creating action, primary if it is the view's main action ("Build set") |
| Filtered to nothing | "No tracks match these filters" + the filters as `sn-tag`s in `__meta` | "Clear filters" (secondary); clearing announces the new count |
| Not connected / no access | "Connect TIDAL to see your playlists" | Module button in the destination scope (`sn-m-services` + `sn-btn--mod`) |
| All done | "Review queue is clear" + when new work arrives | None, or a link to what was done. No confetti, no celebration copy |

`sn-empty-state--compact` for side panels, tabs and cards under ~320px tall.

## Content rules
- Title says the state in plain words; text is one sentence saying what will appear and why it is empty, with real numbers ("None of the 1,284 tracks are Techno, High energy and heard on PBS Soul Time at once").
- Exactly one action. Verb first, names the object.
- No "Oops", no exclamation marks, no "Nothing here!".

## Accessibility
- The title is a heading at the panel's next level, so screen-reader users find the state by heading.
- When the empty state appears because of the person's action (filtering), announce the result through the list's existing `role="status"` count ("0 tracks match"); don't move focus.
- The icon is decorative (`aria-hidden`).

## Responsive
Centred, max 44ch text at every width. On phones the action button grows to `touch-min`; use `--compact` inside bottom sheets.

## Do / don't
- Do keep the panel's frame (header, filters) visible so people can change what produced the empty result.
- Don't show an empty state while data is still loading or after a failed load.

## In SongNodes
Replaces "No tracks found" in MobileTrackExplorer.tsx, the `setlist-empty` block in SetlistBuilder.tsx, "No results found. Try a different search." in MusicServiceSearch.tsx, and the emoji "🎉 No tracks missing artist attribution!" in ArtistAttributionManager.tsx (becomes the all-done variant). Use for the TIDAL/Spotify tabs before connecting, the data-quality review queue, Target tracks and the planned monitoring dashboard.

## In the music library
Crate with filters that match nothing (shows the active Pillar/Energy/Heard on tags and "Clear filters"), saved sets before the first save, running order before "Build set".
